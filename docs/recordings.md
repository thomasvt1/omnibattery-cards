# Recordings and allocation model

## What gets recorded

**Saved forecast:** each future quarter-hour is frozen on its first valid observation. Values already recorded never change when the live forecast changes. The snapshot survives restart. Unknown values are left missing; late-arriving values are accepted only before the interval starts and carry their own capture timestamp. A completed interval is never backfilled with a revised forecast. Snapshots reset by the Home Assistant local day. Repeated DST clock cells are excluded because the upstream timeline aggregates them.

The first comparison appears after a future saved quarter-hour has completed and the upstream timeline reports full measured coverage. At first install this can take up to 30 minutes. The first partial quarter-hour is excluded. No historical forecast accuracy is invented. This captures the upstream **plan forecast**, including its fallback forecasts; it does not independently validate forecast quality or recover a forecast the upstream integration never supplied.

**Optional Solar Independence:** six daily kWh counters record home consumption, solar production, grid import/export, calculated grid-to-home, and calculated solar-to-grid. They use identical recording periods and coverage. All are calculated from power samples, not replacements for revenue-grade cumulative energy meters.

Power is sampled every 10 seconds with left-step integration. Unknown/unavailable sources stop accumulation; recovery and restart never fill gaps. Gaps longer than two minutes are excluded. Counters reset at local midnight, including DST days, and persist about once a minute and on clean shutdown. An abrupt power loss can lose the most recent minute; it is not filled with guessed energy on restart. Removing the integration deletes its recordings. Changing source options starts a new recording period.

## Allocation model and limitations

Metered totals do not uniquely identify source-to-destination flows when generation, battery charging, and grid import happen together. Enabling calculated independence explicitly selects this accounting convention:

1. Solar supplies home first, then battery charging, then export.
2. Battery discharge supplies the home's remaining demand before grid import.
3. Remaining imported energy supplies the home's remaining demand or battery charging.

With signed grid power `G`, solar generation `S`, battery charge `C`, and discharge `D`, home demand is `H = G + S + D − C`. Inconsistent negative home demand is rejected (up to 20 W of meter noise is clamped to zero). Different update times, sensor errors, conversion losses, unmetered sources, and AC/DC mismatches can affect the result. These are **allocation estimates**, not direct measurements of energy origin. Battery discharge is local supply even if that energy was charged from the grid yesterday.

The cards label these results **Calculated**, use only the companion's same-period totals, show when recording began, and disclose gaps. Neither “assume no grid charging” nor “assume solar-only export” is required. Nighttime battery export is not counted as solar export.

## Entities and compatibility contract

All entities have stable unique IDs and survive renaming. Attributes identify the source timeline, so separate Omnibattery systems are not mixed.

- Saved forecast: `companion_schema: 1`, `companion_kind: saved_forecast`, `source_timeline`, `schema_version: 1`, `local_date`, `saved_at`, and timestamped `intervals` with `solar_kwh` / `consumption_kwh` and per-interval `saved_at`.
- Daily counters: `companion_schema: 1`, `companion_kind`, `source_timeline`, `estimated: true`, `allocation_method`, `local_date`, `period_start`, `updated_at`, `coverage_seconds`, `gap_seconds`, and all six `*_kwh` totals from the same observation period.

