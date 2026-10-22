import json
import pytest
from homeassistant.helpers import entity_registry as er
from homeassistant.helpers.storage import Store
from pytest_homeassistant_custom_component.common import MockConfigEntry
from custom_components.omnibattery_cards.const import DOMAIN
from .test_integration import seed
from homeassistant.util import dt as dt_util


@pytest.mark.freeze_time("2026-10-22T12:07:00Z")
async def test_migration_preserves_forecast_removes_only_owned_helpers(hass, freezer, hass_ws_client):
    freezer.move_to('2026-10-22T12:07:00Z')
    data = seed(hass, dt_util.utcnow())
    entry = MockConfigEntry(domain=DOMAIN, data=data, version=1)
    entry.add_to_hass(hass)
    registry = er.async_get(hass)
    old = []
    for kind in ('saved_forecast', 'home', 'solar', 'grid_import', 'grid_export', 'grid_to_home', 'solar_to_grid'):
        old.append(registry.async_get_or_create('sensor', DOMAIN, f'{entry.entry_id}_{kind}',
            config_entry=entry, suggested_object_id=f'renamed_{kind}').entity_id)
    unrelated = registry.async_get_or_create('sensor', 'template', 'user-helper', suggested_object_id='user_helper')
    forecast = {'schema_version': 1, 'local_date': '2026-10-22', 'saved_at': '2026-10-22T10:00:00+00:00',
        'intervals': [{'start': '2026-10-22T12:15:00+00:00', 'end': '2026-10-22T12:30:00+00:00',
                       'saved_at': '2026-10-22T10:00:00+00:00', 'solar_kwh': 0.7, 'consumption_kwh': 0.9}]}
    await Store(hass, 1, f'{DOMAIN}.{entry.entry_id}').async_save({'sources': json.dumps(data, sort_keys=True),
        'recordings': {'forecast': forecast, 'daily': {'home': 10}}})
    assert await hass.config_entries.async_setup(entry.entry_id)
    assert all(registry.async_get(entity_id) is None for entity_id in old)
    assert registry.async_get(unrelated.entity_id)
    assert not [s for s in hass.states.async_all() if s.attributes.get('companion_schema')]
    assert entry.version == 2
    assert entry.data == {'timeline': 'sensor.timeline'}
    client = await hass_ws_client(hass)
    await client.send_json({'id': 1, 'type': 'omnibattery_cards/recordings'})
    response = await client.receive_json()
    assert response['success']
    result = response['result'][0]
    assert result['forecast']['intervals'][0]['solar_kwh'] == 0.7
    assert old[0] in result['legacy_entity_ids']
    assert 'daily' not in entry.runtime_data.recorder.data
    assert await hass.config_entries.async_reload(entry.entry_id)
    assert entry.runtime_data.recorder.data['forecast']['intervals'][0]['solar_kwh'] == 0.7
    assert await hass.config_entries.async_unload(entry.entry_id)
