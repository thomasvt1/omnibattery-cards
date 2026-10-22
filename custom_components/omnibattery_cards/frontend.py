"""Serve the bundled cards and migrate only this project's Lovelace resources."""
import asyncio
from pathlib import Path
from urllib.parse import urlsplit

from homeassistant.components.http import StaticPathConfig
from homeassistant.components.lovelace import LOVELACE_DATA
from homeassistant.components.lovelace.resources import ResourceStorageCollection
from homeassistant.helpers import issue_registry as ir
from homeassistant.helpers.storage import Store

from .const import DOMAIN

URL = "/omnibattery_cards/omnibattery-cards.js"
LEGACY_PATHS = {
    "/hacsfiles/omnibattery-cards/omnibattery-cards.js",
    "/local/community/omnibattery-cards/omnibattery-cards.js",
    "/local/omnibattery-cards/omnibattery-cards.js",
    "/local/omnibattery-cards.js",
    URL,
}


def owned_resource(url):
    """Ignore cache queries, but never claim a remote or similarly named script."""
    parsed = urlsplit(url)
    return not parsed.scheme and not parsed.netloc and parsed.path in LEGACY_PATHS


class CardResources:
    def __init__(self, hass, version):
        self.hass = hass
        self.url = f"{URL}?v={version}"
        self.lock = asyncio.Lock()
        self.reconciling = False
        self.unsubscribe = None
        self.backup = Store(hass, 1, f"{DOMAIN}.resource_migration")

    async def async_register(self):
        async with self.lock:
            resources = self.hass.data[LOVELACE_DATA].resources
            if not isinstance(resources, ResourceStorageCollection):
                # YAML is authoritative. Never add a second loading mechanism or
                # edit the user's YAML behind their back.
                matches = [r for r in resources.async_items() if owned_resource(r.get("url", ""))]
                if len(matches) == 1 and matches[0].get("url") == self.url and matches[0].get("type") == "module":
                    ir.async_delete_issue(self.hass, DOMAIN, "yaml_resource")
                else:
                    ir.async_create_issue(self.hass, DOMAIN, "yaml_resource", is_fixable=False,
                        severity=ir.IssueSeverity.WARNING, translation_key="yaml_resource",
                        translation_placeholders={"url": self.url})
                return
            await resources.async_get_info()  # Load before reading or creating.
            matches = [dict(r) for r in resources.async_items() if owned_resource(r.get("url", ""))]
            self.reconciling = True
            try:
                if matches:
                    # Save original entries once, through our own Store, before
                    # changing the resource collection through its public API.
                    if await self.backup.async_load() is None:
                        await self.backup.async_save({"resources": matches})
                    keep = next((r for r in matches if r["url"] == self.url), matches[0])
                    if keep["url"] != self.url or keep.get("type") != "module":
                        await resources.async_update_item(keep["id"], {"url": self.url, "res_type": "module"})
                    for duplicate in matches:
                        if duplicate["id"] != keep["id"]:
                            await resources.async_delete_item(duplicate["id"])
                else:
                    await resources.async_create_item({"url": self.url, "res_type": "module"})
                ir.async_delete_issue(self.hass, DOMAIN, "yaml_resource")
                if self.unsubscribe is None:
                    self.unsubscribe = resources.async_add_listener(self._changed)
            finally:
                self.reconciling = False

    async def _changed(self, change_type, item_id, item):
        # HACS may finish registering an old download after integration setup.
        # Schedule outside the collection callback to avoid recursive writes.
        if not self.reconciling and change_type != "removed" and owned_resource(item.get("url", "")):
            self.hass.async_create_task(self.async_register())

    async def async_remove(self):
        """Remove only our managed resource when the final config entry is removed."""
        async with self.lock:
            if self.unsubscribe:
                self.unsubscribe()
                self.unsubscribe = None
            resources = self.hass.data[LOVELACE_DATA].resources
            if isinstance(resources, ResourceStorageCollection):
                await resources.async_get_info()
                for item in list(resources.async_items()):
                    if owned_resource(item.get("url", "")) and urlsplit(item["url"]).path == URL:
                        await resources.async_delete_item(item["id"])
            ir.async_delete_issue(self.hass, DOMAIN, "yaml_resource")


async def async_setup_frontend(hass, version):
    bundle = Path(__file__).parent / "frontend" / "omnibattery-cards.js"
    await hass.http.async_register_static_paths([StaticPathConfig(URL, str(bundle), False)])
    manager = CardResources(hass, version)
    hass.data.setdefault(DOMAIN, {})["card_resources"] = manager
