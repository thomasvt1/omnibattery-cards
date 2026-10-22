# v0.7.0 — Energy statistics without helper sensors

Solar Independence now uses your existing Energy dashboard sources and hourly recorder statistics. No additional daily energy helpers or power sampling are required. Both solar meters, multiple grid tariffs, and battery charge/discharge are included automatically.

Forecast snapshots are kept internally across restarts, without a saved-forecast sensor. Existing recordings and card references to renamed snapshot helpers migrate automatically. The seven integration-owned helper types are removed; other sensors and recorder history remain untouched. Existing dashboard resource deduplication remains in place.

**Upgrade:** update in HACS, restart Home Assistant, then refresh the browser. Do not remove/recreate the integration. No charging assumption checkboxes are needed. Solar Independence now represents the whole-home Energy configuration; old counter overrides are ignored. Flow attribution remains an explicitly labelled calculation, and statistics can lag live readings.

If you used the removed helpers in unrelated automations/cards, update those references. Downgrading to 0.6.x requires a pre-upgrade backup because this release migrates entries to version 2.
