# Energy statistics and internal forecasts

## Solar Independence

The card discovers whole-home energy sources from `energy/get_prefs` and requests `recorder/statistics_during_period` with hourly `change` values normalized by Home Assistant to kWh. Both current and older grid preference formats are accepted. Identical statistic IDs within one direction are deduplicated; conflicting directions are rejected. All configured grid tariffs, solar meters and battery charge/discharge channels are included.

The period starts at midnight in Home Assistant's timezone, including DST days. Home use is import + solar + discharge − export − charge. Each interval follows Home Assistant frontend's `computeConsumptionSingle` allocation order: excess grid import charges the battery, solar supplies remaining battery charge and export, battery discharge supplies remaining export, and remaining solar/battery/grid supplies home. This is an estimate of flows, not measured energy provenance. Battery discharge may include earlier grid charging. Solar retention includes energy stored locally, not just household consumption.

Missing configured statistics do not become zero. Incomplete or inconsistent intervals are excluded and disclosed; no historical power integration is performed. The card refreshes every minute while attached, shares requests between instances, and shows the latest recorded period. Statistics can lag current meter states.

## Forecast snapshots

Each future quarter-hour is frozen on its first valid observation and persisted in the integration's private Home Assistant Store. Previously captured values cannot be revised by later forecasts. Missing values can be captured only before the interval begins. Completed intervals are never backfilled. Snapshots follow the Home Assistant local day; ambiguous repeated DST cells are excluded.

The first comparison requires a saved future interval followed by full measured coverage, which can take up to 30 minutes after initial setup. Internal snapshots survive restart and are delivered through the authenticated, read-only `omnibattery_cards/recordings` WebSocket endpoint. No sensor entities are created. Separate timeline recordings remain isolated. Removing an integration entry deletes that entry's recordings.

## Upgrade from 0.6.x

Update in HACS, restart Home Assistant, and refresh the browser. Existing entries migrate automatically to version 2. Timeline selection and frozen forecasts are retained; obsolete power-source options are removed. The integration removes only its own seven known helper types from the entity registry, including renamed/disabled entities. Other integrations' sensors and user helpers are untouched. Existing recorder history is not purged.

Old forecast entity IDs are retained internally as aliases so existing card overrides continue to work. Solar Independence ignores obsolete helper/assumption settings and uses Energy statistics automatically. Dashboard resources retain the existing deduplication migration. There is no need to remove and recreate the integration or cards.

Automations or third-party cards that explicitly reference the removed helper entities must be updated. Downgrading to 0.6.x requires restoring a pre-upgrade backup because those releases do not understand config-entry version 2.
