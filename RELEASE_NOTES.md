## Single HACS Integration install

Omnibattery Cards now includes its recording integration and automatically registers the bundled cards. Forecast snapshots and optional calculated Solar Independence are configured under Settings → Devices & services → Omnibattery Cards.

**Existing Dashboard users:** remove the old HACS Dashboard download/custom-repository entry, add this same repository as **Integration**, download, restart Home Assistant, and add the integration. Keep your dashboard configurations. Setup migrates known old resources and removes duplicates. Refresh every open browser tab afterward.

YAML-managed resources require a one-time URL replacement; setup shows a repair instruction and does not register a duplicate. Renamed files and absolute/custom resource paths must be removed manually. See the README for exact paths, migration, and rollback instructions.

Install `omnibattery_cards.zip` through HACS. The separate companion repository is retired. No changes are required in upstream Omnibattery.
