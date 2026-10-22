"""Record card inputs without changing or controlling the upstream integration."""
from datetime import timedelta
import asyncio
import json

from homeassistant.core import callback
from homeassistant.components import websocket_api
from homeassistant.helpers import entity_registry as er, device_registry as dr
from homeassistant.helpers.event import async_track_state_change_event, async_track_time_interval
from homeassistant.helpers.storage import Store
from homeassistant.helpers import config_validation as cv
from homeassistant.helpers.update_coordinator import DataUpdateCoordinator
from homeassistant.util import dt as dt_util
import logging

from .const import DOMAIN, NAME, ENERGY_KEYS
from .model import Recorder
from .frontend import async_setup_frontend

LOGGER = logging.getLogger(__name__)
CONFIG_SCHEMA = cv.config_entry_only_config_schema(DOMAIN)


async def async_setup(hass, config):
    from homeassistant.loader import async_get_integration
    integration = await async_get_integration(hass, DOMAIN)
    await async_setup_frontend(hass, integration.version)
    hass.data[DOMAIN]["version"] = str(integration.version)
    websocket_api.async_register_command(hass, recordings)
    return True


@websocket_api.websocket_command({"type": "omnibattery_cards/recordings"})
@callback
def recordings(hass, connection, msg):
    results = []
    for entry in hass.config_entries.async_entries(DOMAIN):
        coordinator = getattr(entry, "runtime_data", None)
        if coordinator and not coordinator.stopped:
            results.append({"timeline": coordinator.settings["timeline"],
                            "legacy_entity_ids": coordinator.legacy_entity_ids,
                            "forecast": coordinator.recorder.data["forecast"]})
    connection.send_result(msg["id"], results)


class CompanionCoordinator(DataUpdateCoordinator):
    def __init__(self, hass, entry):
        super().__init__(hass, LOGGER, name=DOMAIN)
        self.entry = entry
        self.settings = {**entry.data, **entry.options}
        self.store = Store(hass, 1, f"{DOMAIN}.{entry.entry_id}", atomic_writes=True)
        self.recorder = None
        self.unsubscribers = []
        self.legacy_entity_ids = []
        self.stopped = False
        self.record_lock = asyncio.Lock()

    async def async_start(self):
        stored = await self.store.async_load() or {}
        # v1 keyed forecasts by every power setting. Keep its already-frozen
        # baseline when the timeline matches, irrespective of retired settings.
        try:
            old_settings = json.loads(stored.get("sources", "{}"))
        except (TypeError, ValueError):
            old_settings = {}
        matches = stored.get("timeline", old_settings.get("timeline")) == self.settings["timeline"]
        self.recorder = Recorder(self.hass.config.time_zone, stored.get("recordings") if matches else None)
        self.legacy_entity_ids = stored.get("legacy_entity_ids", [])
        registry = er.async_get(self.hass)
        owned = [entity for entity in er.async_entries_for_config_entry(registry, self.entry.entry_id)
                 if entity.platform == DOMAIN and entity.unique_id in
                 {f"{self.entry.entry_id}_{key}" for key in (*ENERGY_KEYS, "saved_forecast")}]
        self.legacy_entity_ids = sorted(set(self.legacy_entity_ids + [e.entity_id for e in owned
                                        if e.unique_id.endswith("_saved_forecast")]))
        # Save migration data before removing entities, including renamed aliases.
        await self.async_refresh()
        await self.store.async_save(self._stored())
        for entity in owned:
            registry.async_remove(entity.entity_id)
            self.hass.states.async_remove(entity.entity_id)
        ids = [self.settings["timeline"]]
        self.unsubscribers = [
            async_track_state_change_event(self.hass, list(set(ids)), self._changed),
            async_track_time_interval(self.hass, self._tick, timedelta(seconds=10)),
        ]

    @callback
    def _changed(self, event):
        if not self.stopped:
            self.hass.async_create_task(self.async_refresh())

    @callback
    def _tick(self, now):
        if not self.stopped:
            self.hass.async_create_task(self.async_refresh())

    async def _async_update_data(self):
        async with self.record_lock:
            return await self._async_record()

    async def _async_record(self):
        if self.stopped:
            return self.data
        now = dt_util.utcnow()
        state = self.hass.states.get(self.settings["timeline"])
        attrs = dict(state.attributes) if state and state.state not in ("unknown", "unavailable") else {}
        captured = self.recorder.capture(attrs, now)
        if captured:
            await self.store.async_save(self._stored())
        return self.recorder.data

    @callback
    def _stored(self):
        return {"timeline": self.settings["timeline"], "recordings": self.recorder.data,
                "legacy_entity_ids": self.legacy_entity_ids}

    async def async_stop(self):
        self.stopped = True
        for unsubscribe in self.unsubscribers:
            unsubscribe()
        self.unsubscribers.clear()
        async with self.record_lock:
            await self.store.async_save(self._stored())
        await self.async_shutdown()


async def async_setup_entry(hass, entry):
    await hass.data[DOMAIN]["card_resources"].async_register()
    coordinator = CompanionCoordinator(hass, entry)
    await coordinator.async_start()
    entry.runtime_data = coordinator
    entry.async_on_unload(entry.add_update_listener(_reload))
    dr.async_get(hass).async_get_or_create(config_entry_id=entry.entry_id,
        identifiers={(DOMAIN, entry.entry_id)}, name=NAME, manufacturer=NAME,
        model="Cards and recordings", sw_version=hass.data[DOMAIN]["version"])
    return True


async def _reload(hass, entry):
    await hass.config_entries.async_reload(entry.entry_id)


async def async_unload_entry(hass, entry):
    await entry.runtime_data.async_stop()
    return True


async def async_remove_entry(hass, entry):
    await Store(hass, 1, f"{DOMAIN}.{entry.entry_id}").async_remove()
    if not any(other.entry_id != entry.entry_id for other in hass.config_entries.async_entries(DOMAIN)):
        if manager := hass.data.get(DOMAIN, {}).get("card_resources"):
            await manager.async_remove()


async def async_migrate_entry(hass, entry):
    if entry.version > 2:
        return False
    if entry.version == 1:
        settings = {**entry.data, **entry.options}
        hass.config_entries.async_update_entry(entry, version=2,
            data={"timeline": settings["timeline"]}, options={})
    return True
