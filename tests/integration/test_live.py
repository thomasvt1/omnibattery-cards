"""Optional local replay. Private live captures are never committed."""
import json
import os
from pathlib import Path
import pytest
from homeassistant.util import dt as dt_util
from pytest_homeassistant_custom_component.common import MockConfigEntry
from custom_components.omnibattery_cards.const import DOMAIN
from custom_components.omnibattery_cards.model import timestamp


@pytest.mark.skipif(not os.environ.get("COMPANION_LIVE_FIXTURE"), reason="No private MCP capture supplied")
async def test_actual_mcp_sensor_capture(hass, freezer):
    fixture = json.loads(Path(os.environ["COMPANION_LIVE_FIXTURE"]).read_text())
    source = fixture["timeline"]
    captured = timestamp(source["attributes"]["generated_at"])
    freezer.move_to(captured)
    hass.config.time_zone = source["attributes"]["timezone"]
    hass.states.async_set(source["entity_id"], source["state"], source["attributes"])
    settings = {"timeline": source["entity_id"]}
    entry = MockConfigEntry(domain=DOMAIN, data=settings, unique_id=source["entity_id"])
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    coordinator = entry.runtime_data
    assert coordinator.data["forecast"]["intervals"]
    first = coordinator.data["forecast"]["intervals"][0]
    assert timestamp(first["start"]) > captured
    assert not [s for s in hass.states.async_all() if s.attributes.get("companion_schema")]
    assert set(coordinator.data) == {"forecast"}
    assert await hass.config_entries.async_unload(entry.entry_id)
