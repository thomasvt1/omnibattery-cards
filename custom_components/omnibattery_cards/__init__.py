"""Record card inputs without changing or controlling the upstream integration."""
from datetime import timedelta
import asyncio
import json

from homeassistant.const import Platform
from homeassistant.core import callback
from homeassistant.helpers.event import async_track_state_change_event, async_track_time_interval
from homeassistant.helpers.storage import Store
from homeassistant.helpers import config_validation as cv
from homeassistant.helpers.update_coordinator import DataUpdateCoordinator
from homeassistant.util import dt as dt_util
import logging

from .const import DOMAIN, POWER_KEYS
from .model import Recorder, flows, power
from .frontend import async_setup_frontend

LOGGER = logging.getLogger(__name__)
PLATFORMS = [Platform.SENSOR]
CONFIG_SCHEMA = cv.config_entry_only_config_schema(DOMAIN)


async def async_setup(hass, config):
    from homeassistant.loader import async_get_integration
    integration = await async_get_integration(hass, DOMAIN)
    await async_setup_frontend(hass, integration.version)
    hass.data[DOMAIN]["version"] = str(integration.version)
    return True


class CompanionCoordinator(DataUpdateCoordinator):
    def __init__(self, hass, entry):
        super().__init__(hass, LOGGER, name=DOMAIN)
        self.entry = entry
        self.settings = {**entry.data, **entry.options}
        self.store = Store(hass, 1, f"{DOMAIN}.{entry.entry_id}", atomic_writes=True)
        self.signature = json.dumps(self.settings, sort_keys=True)
        self.recorder = None
        self.unsubscribers = []
        self.last_save = None
        self.stopped = False
        self.record_lock = asyncio.Lock()

    async def async_start(self):
        stored = await self.store.async_load() or {}
        self.recorder = Recorder(self.hass.config.time_zone, stored.get("recordings") if stored.get("sources") == self.signature else None)
        await self.async_refresh()
        ids = [self.settings["timeline"]]
        if self.settings.get("enable_independence"):
            ids += [entity for key in POWER_KEYS for entity in self.settings.get(key, [])]
        self.unsubscribers = [
            async_track_state_change_event(self.hass, list(set(ids)), self._changed),
            async_track_time_interval(self.hass, self._tick, timedelta(seconds=10)),
        ]

    @callback
    def _changed(self, event):
        # Capture unavailability immediately so a brief outage cannot be bridged.
        old, new = event.data.get("old_state"), event.data.get("new_state")
        unavailable = lambda state: state is None or state.state in ("unknown", "unavailable")
        if not self.stopped and (unavailable(old) or unavailable(new)):
            self.hass.async_create_task(self.async_refresh())

    @callback
    def _tick(self, now):
        if not self.stopped:
            self.hass.async_create_task(self.async_refresh())

    def _sum_power(self, key):
        ids = self.settings.get(key, [])
        if not ids:
            return None
        values = []
        for entity_id in ids:
            state = self.hass.states.get(entity_id)
            value = power({"state": state.state, "attributes": dict(state.attributes)}) if state else None
            if value is None:
                return None
            values.append(value)
        return sum(values)

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
        current = None
        if self.settings.get("enable_independence"):
            grid = self._sum_power("grid_power")
            if grid is not None and self.settings.get("grid_inverted"):
                grid = -grid
            current = flows(grid, self._sum_power("solar_power"), self._sum_power("charge_power"), self._sum_power("discharge_power"))
        self.recorder.sample(now, current)
        # Persist newly frozen forecasts before publishing them. Write counters at
        # most once a minute; Store flushes pending delayed writes on HA shutdown.
        if captured:
            await self.store.async_save(self._stored())
            self.last_save = now
        elif self.last_save is None or (now - self.last_save).total_seconds() >= 60:
            self.store.async_delay_save(self._stored, 1)
            self.last_save = now
        return self.recorder.data

    @callback
    def _stored(self):
        return {"sources": self.signature, "recordings": self.recorder.data}

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
    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)
    return True


async def _reload(hass, entry):
    await hass.config_entries.async_reload(entry.entry_id)


async def async_unload_entry(hass, entry):
    if unloaded := await hass.config_entries.async_unload_platforms(entry, PLATFORMS):
        await entry.runtime_data.async_stop()
    return unloaded


async def async_remove_entry(hass, entry):
    await Store(hass, 1, f"{DOMAIN}.{entry.entry_id}").async_remove()
    if not any(other.entry_id != entry.entry_id for other in hass.config_entries.async_entries(DOMAIN)):
        if manager := hass.data.get(DOMAIN, {}).get("card_resources"):
            await manager.async_remove()
