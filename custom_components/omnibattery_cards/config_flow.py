"""UI setup with Energy dashboard suggestions and explicit calculation consent."""
import voluptuous as vol
from homeassistant import config_entries
from homeassistant.core import callback
from homeassistant.helpers import selector
from .const import DOMAIN, NAME, POWER_KEYS
from .model import energy_defaults, power


def schema(defaults, include_timeline=True):
    fields = {}
    if include_timeline:
        fields[vol.Required("timeline", description={"suggested_value": defaults.get("timeline", "")})] = selector.EntitySelector(selector.EntitySelectorConfig(domain="sensor"))
    fields[vol.Optional("enable_independence", default=defaults.get("enable_independence", False))] = bool
    for key in POWER_KEYS:
        fields[vol.Optional(key, default=defaults.get(key, []))] = selector.EntitySelector(selector.EntitySelectorConfig(domain="sensor", multiple=True))
    fields[vol.Optional("grid_inverted", default=defaults.get("grid_inverted", False))] = bool
    return vol.Schema(fields)


def validate(hass, data):
    errors = {}
    timeline = hass.states.get(data.get("timeline", ""))
    if not timeline or timeline.attributes.get("schema_version") != 1 or timeline.attributes.get("interval_count") != 96 or timeline.attributes.get("interval_minutes") != 15:
        errors["base"] = "invalid_timeline"
    if data.get("enable_independence"):
        all_ids = [entity for key in POWER_KEYS for entity in data.get(key, [])]
        if len(all_ids) != len(set(all_ids)):
            errors["base"] = "duplicate_power"
        for key in POWER_KEYS:
            ids = data.get(key, [])
            if not ids:
                errors["base"] = "missing_power"
            for entity in ids:
                state = hass.states.get(entity)
                value = power({"state": state.state, "attributes": dict(state.attributes)}) if state else None
                if value is None or key != "grid_power" and value < 0:
                    errors["base"] = "invalid_power"
    return errors


class CompanionConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    VERSION = 1

    async def async_step_user(self, user_input=None):
        errors = {}
        if user_input is not None:
            errors = validate(self.hass, user_input)
            if not errors:
                await self.async_set_unique_id(user_input["timeline"])
                self._abort_if_unique_id_configured()
                return self.async_create_entry(title=NAME, data=user_input)
        defaults = {}
        try:
            from homeassistant.components.energy import async_get_manager
            manager = await async_get_manager(self.hass)
            defaults = energy_defaults((manager.data or {}).get("energy_sources", []))
        except (KeyError, ValueError):
            pass
        timelines = [state.entity_id for state in self.hass.states.async_all("sensor")
                     if state.attributes.get("schema_version") == 1 and state.attributes.get("interval_count") == 96
                     and state.attributes.get("interval_minutes") == 15 and "series" in state.attributes]
        if len(timelines) == 1:
            defaults["timeline"] = timelines[0]
        return self.async_show_form(step_id="user", data_schema=schema(user_input or defaults), errors=errors)

    @staticmethod
    @callback
    def async_get_options_flow(config_entry):
        return CompanionOptionsFlow()


class CompanionOptionsFlow(config_entries.OptionsFlow):
    async def async_step_init(self, user_input=None):
        current = {**self.config_entry.data, **self.config_entry.options}
        errors = {}
        if user_input is not None:
            errors = validate(self.hass, {**user_input, "timeline": current["timeline"]})
            if not errors:
                return self.async_create_entry(title="", data=user_input)
        return self.async_show_form(step_id="init", data_schema=schema(user_input or current, False), errors=errors)
