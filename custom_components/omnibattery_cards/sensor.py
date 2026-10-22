"""Sensors with explicit recording periods and source attribution metadata."""
from homeassistant.components.sensor import SensorEntity, SensorDeviceClass, SensorStateClass
from homeassistant.const import UnitOfEnergy
from homeassistant.helpers.entity import DeviceInfo
from homeassistant.helpers.update_coordinator import CoordinatorEntity

from .const import DOMAIN, NAME, ENERGY_KEYS, ALLOCATION


async def async_setup_entry(hass, entry, async_add_entities):
    coordinator = entry.runtime_data
    entities = [CompanionSensor(coordinator, "saved_forecast")]
    if coordinator.settings.get("enable_independence"):
        entities.extend(CompanionSensor(coordinator, key) for key in ENERGY_KEYS)
    async_add_entities(entities)


class CompanionSensor(CoordinatorEntity, SensorEntity):
    _attr_has_entity_name = True

    def __init__(self, coordinator, key):
        super().__init__(coordinator)
        self.key = key
        self._attr_unique_id = f"{coordinator.entry.entry_id}_{key}"
        self._attr_translation_key = "saved_forecast" if key == "saved_forecast" else f"daily_{key}"
        self._attr_device_info = DeviceInfo(identifiers={(DOMAIN, coordinator.entry.entry_id)},
                                           name=NAME, manufacturer="Omnibattery Cards", model="Cards and recordings", sw_version=coordinator.hass.data[DOMAIN]["version"])
        if key != "saved_forecast":
            self._attr_native_unit_of_measurement = UnitOfEnergy.KILO_WATT_HOUR
            self._attr_device_class = SensorDeviceClass.ENERGY
            self._attr_state_class = SensorStateClass.TOTAL_INCREASING

    @property
    def available(self):
        if not super().available:
            return False
        if self.key == "saved_forecast":
            return bool(self.coordinator.data["forecast"].get("intervals"))
        return self.coordinator.data["daily"].get("source_available", False)

    @property
    def native_value(self):
        if self.key == "saved_forecast":
            return self.coordinator.data["forecast"].get("local_date")
        return round(self.coordinator.data["daily"].get(self.key, 0), 6)

    @property
    def extra_state_attributes(self):
        common = {"companion_schema": 1, "source_timeline": self.coordinator.settings["timeline"],
                  "companion_kind": self.key}
        if self.key == "saved_forecast":
            return {**common, **self.coordinator.data["forecast"]}
        daily = self.coordinator.data["daily"]
        return {**common, "estimated": True, "allocation_method": ALLOCATION,
                **{key: daily.get(key) for key in ("local_date", "period_start", "updated_at", "coverage_seconds", "gap_seconds")},
                **{f"{key}_kwh": round(daily.get(key, 0), 6) for key in ENERGY_KEYS}}
