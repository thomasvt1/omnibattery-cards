"""Exercise migration against HA's actual persistent resource collection."""
import asyncio
from types import SimpleNamespace

import pytest
from homeassistant.components.lovelace import LOVELACE_DATA
from homeassistant.components.lovelace.dashboard import LovelaceStorage
from homeassistant.components.lovelace.resources import ResourceStorageCollection, ResourceYAMLCollection
from homeassistant.helpers import issue_registry as ir

from custom_components.omnibattery_cards.const import DOMAIN
from custom_components.omnibattery_cards.frontend import CardResources, URL, owned_resource


async def collection(hass):
    resources = ResourceStorageCollection(hass, LovelaceStorage(hass, None))
    await resources.async_get_info()
    hass.data[LOVELACE_DATA] = SimpleNamespace(resources=resources)
    return resources


async def test_migration_preserves_one_id_and_other_cards(hass):
    resources = await collection(hass)
    old = await resources.async_create_item({'url': '/hacsfiles/omnibattery-cards/omnibattery-cards.js?hacstag=123', 'res_type': 'module'})
    await resources.async_create_item({'url': '/local/omnibattery-cards/omnibattery-cards.js?v=old', 'res_type': 'js'})
    unrelated = await resources.async_create_item({'url': '/hacsfiles/another-card/card.js', 'res_type': 'module'})
    manager = CardResources(hass, '0.6.0')
    await asyncio.gather(manager.async_register(), manager.async_register())
    items = resources.async_items()
    assert len(items) == 2
    assert {'id': old['id'], 'url': manager.url, 'type': 'module'} in items
    assert unrelated in items
    backup = await manager.backup.async_load()
    assert len(backup['resources']) == 2
    assert backup['resources'][0]['url'] == old['url']
    # Upgrades retain the same resource ID, and never overwrite the original backup.
    manager.url = f'{URL}?v=0.7.0'
    await manager.async_register()
    assert next(r for r in resources.async_items() if r['id'] == old['id'])['url'] == manager.url
    assert await manager.backup.async_load() == backup
    # Reload from persistent storage, not just the same in-memory objects.
    await resources.store.async_save({'items': resources.async_items()})
    reloaded = await collection(hass)
    await CardResources(hass, '0.7.0').async_register()
    assert len(reloaded.async_items()) == 2


async def test_fresh_install_and_late_hacs_duplicate(hass):
    resources = await collection(hass)
    manager = CardResources(hass, '0.6.0')
    await manager.async_register()
    original_id = resources.async_items()[0]['id']
    await resources.async_create_item({'url': '/hacsfiles/omnibattery-cards/omnibattery-cards.js?hacstag=456', 'res_type': 'module'})
    await hass.async_block_till_done()
    assert resources.async_items() == [{'id': original_id, 'url': manager.url, 'type': 'module'}]
    other = await resources.async_create_item({'url': '/local/unrelated.js', 'res_type': 'module'})
    await manager.async_remove()
    assert resources.async_items() == [other]
    await manager.async_register()
    assert len(resources.async_items()) == 2


@pytest.mark.parametrize('url', [
    '/local/omnibattery-cards.js?v=old',
    '/local/community/omnibattery-cards/omnibattery-cards.js#old',
    URL,
])
def test_known_paths(url):
    assert owned_resource(url)


@pytest.mark.parametrize('url', [
    'https://example.com/local/omnibattery-cards.js',
    '//example.com/local/omnibattery-cards.js',
    '/local/other/omnibattery-cards.js',
    '/local/omnibattery-cards.js.backup',
])
def test_does_not_claim_unknown_or_remote_scripts(url):
    assert not owned_resource(url)


async def test_yaml_resources_get_repair_without_duplicate_or_mutation(hass):
    original = [{'url': '/local/omnibattery-cards.js', 'type': 'module'}]
    resources = ResourceYAMLCollection(original.copy())
    hass.data[LOVELACE_DATA] = SimpleNamespace(resources=resources)
    manager = CardResources(hass, '0.6.0')
    await manager.async_register()
    await manager.async_register()
    assert resources.async_items() == original
    assert ir.async_get(hass).async_get_issue(DOMAIN, 'yaml_resource') is not None
    resources.data = [{'url': manager.url, 'type': 'module'}]
    await manager.async_register()
    assert ir.async_get(hass).async_get_issue(DOMAIN, 'yaml_resource') is None
