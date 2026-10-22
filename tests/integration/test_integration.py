from datetime import timedelta
from unittest.mock import AsyncMock, patch
from types import SimpleNamespace

from homeassistant.config_entries import SOURCE_USER
from homeassistant.components.lovelace import LOVELACE_DATA
from homeassistant.util import dt as dt_util
from pytest_homeassistant_custom_component.common import MockConfigEntry, async_fire_time_changed

from custom_components.omnibattery_cards.const import DOMAIN
from custom_components.omnibattery_cards.model import energy_defaults
from .test_model import timeline


def seed(hass, now):
    hass.config.time_zone = "UTC"
    hass.states.async_set("sensor.timeline", now.date().isoformat(), timeline(now))
    for entity, value in [("grid", 3000), ("solar", 0), ("charge", 2000), ("discharge", 0)]:
        hass.states.async_set(f"sensor.{entity}", value, {"unit_of_measurement": "W", "device_class": "power"})
    return {"timeline": "sensor.timeline", "enable_independence": True,
            "grid_power": ["sensor.grid"], "solar_power": ["sensor.solar"],
            "charge_power": ["sensor.charge"], "discharge_power": ["sensor.discharge"]}


async def test_real_setup_sensors_freeze_and_unload(hass, freezer):
    freezer.move_to("2026-10-22T12:07:00Z")
    data = seed(hass, dt_util.utcnow())
    entry = MockConfigEntry(domain=DOMAIN, data=data, unique_id="sensor.timeline")
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    sensors = [s for s in hass.states.async_all("sensor") if s.attributes.get("companion_schema") == 1]
    assert len(sensors) == 7
    resources = hass.data[LOVELACE_DATA].resources
    assert len(resources.async_items()) == 1
    saved = next(s for s in sensors if s.attributes["companion_kind"] == "saved_forecast")
    assert len(saved.attributes["intervals"]) == 47
    assert saved.attributes["source_timeline"] == "sensor.timeline"
    freezer.tick(timedelta(seconds=60))
    async_fire_time_changed(hass, dt_util.utcnow())
    await hass.async_block_till_done()
    grid = next(s for s in hass.states.async_all("sensor") if s.attributes.get("companion_kind") == "grid_to_home")
    assert abs(float(grid.state) - 1/60) < 0.000001
    assert grid.attributes["home_kwh"] == grid.attributes["grid_to_home_kwh"]
    assert grid.attributes["estimated"] is True
    # A changed live forecast cannot revise the saved comparison baseline.
    attrs = timeline(dt_util.utcnow())
    attrs["series"]["solar_forecast_kwh"] = [99]*96
    hass.states.async_set("sensor.timeline", "2026-10-22", attrs)
    await hass.async_block_till_done()
    assert hass.states.get(saved.entity_id).attributes["intervals"][0]["solar_kwh"] == 0.1
    await entry.runtime_data.store.async_save(entry.runtime_data._stored())
    coordinator = entry.runtime_data
    assert await hass.config_entries.async_unload(entry.entry_id)
    assert not coordinator.unsubscribers
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    assert hass.states.get(saved.entity_id).attributes["intervals"][0]["solar_kwh"] == 0.1
    assert len(resources.async_items()) == 1
    assert await hass.config_entries.async_unload(entry.entry_id)


async def test_serves_release_bundle(hass, hass_client, freezer):
    freezer.move_to("2026-10-22T12:07:00Z")
    data = seed(hass, dt_util.utcnow())
    entry = MockConfigEntry(domain=DOMAIN, data=data)
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    client = await hass_client()
    response = await client.get('/omnibattery_cards/omnibattery-cards.js?v=0.6.0')
    assert response.status == 200
    body = await response.text()
    assert 'omnibattery-overview-card' in body
    assert '0.6.0' in body
    assert await hass.config_entries.async_remove(entry.entry_id)
    assert hass.data[LOVELACE_DATA].resources.async_items() == []


async def test_ui_flow_and_validation(hass, freezer):
    freezer.move_to("2026-10-22T12:07:00Z")
    data = seed(hass, dt_util.utcnow())
    manager = SimpleNamespace(data={"energy_sources": [{"type": "solar", "stat_rate": "sensor.solar"}]})
    with patch("homeassistant.components.energy.async_get_manager", AsyncMock(return_value=manager)):
        result = await hass.config_entries.flow.async_init(DOMAIN, context={"source": SOURCE_USER})
        assert result["type"] == "form"
        invalid = {**data, "solar_power": ["sensor.grid"]}
        result = await hass.config_entries.flow.async_configure(result["flow_id"], invalid)
        assert result["errors"]["base"] == "duplicate_power"
        with patch("custom_components.omnibattery_cards.async_setup_entry", return_value=True):
            result = await hass.config_entries.flow.async_configure(result["flow_id"], data)
            assert result["type"] == "create_entry"
            assert result["data"]["timeline"] == "sensor.timeline"
            await hass.async_block_till_done()


async def test_forecast_only_setup_does_not_require_power_sensors(hass, freezer):
    freezer.move_to("2026-10-22T12:07:00Z")
    seed(hass, dt_util.utcnow())
    entry = MockConfigEntry(domain=DOMAIN, data={"timeline": "sensor.timeline", "enable_independence": False})
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    assert len([s for s in hass.states.async_all("sensor") if s.attributes.get("companion_schema") == 1]) == 1
    assert await hass.config_entries.async_unload(entry.entry_id)
