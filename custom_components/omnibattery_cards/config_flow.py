"""Select the timeline whose future forecasts will be stored internally."""
import voluptuous as vol
from homeassistant import config_entries
from homeassistant.helpers import selector
from .const import DOMAIN, NAME


def schema(defaults, include_timeline=True):
    fields = {}
    if include_timeline:
        fields[vol.Required("timeline", description={"suggested_value": defaults.get("timeline", "")})] = selector.EntitySelector(selector.EntitySelectorConfig(domain="sensor"))
    return vol.Schema(fields)


def validate(hass, data):
    errors = {}
    timeline = hass.states.get(data.get("timeline", ""))
    if not timeline or timeline.attributes.get("schema_version") != 1 or timeline.attributes.get("interval_count") != 96 or timeline.attributes.get("interval_minutes") != 15:
        errors["base"] = "invalid_timeline"
    return errors


class CompanionConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    VERSION = 2

    async def async_step_user(self, user_input=None):
        errors = {}
        if user_input is not None:
            errors = validate(self.hass, user_input)
            if not errors:
                await self.async_set_unique_id(user_input["timeline"])
                self._abort_if_unique_id_configured()
                return self.async_create_entry(title=NAME, data=user_input)
        defaults = {}
        timelines = [state.entity_id for state in self.hass.states.async_all("sensor")
                     if state.attributes.get("schema_version") == 1 and state.attributes.get("interval_count") == 96
                     and state.attributes.get("interval_minutes") == 15 and "series" in state.attributes]
        if len(timelines) == 1:
            defaults["timeline"] = timelines[0]
        return self.async_show_form(step_id="user", data_schema=schema(user_input or defaults), errors=errors)
