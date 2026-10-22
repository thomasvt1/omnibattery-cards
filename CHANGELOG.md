# Changelog

## 0.4.2 — 2026-10-22

- Automatically discover compatible timestamped price sources, saved forecast snapshots, and Omnibattery daily grid-to-home counters, including renamed entities.
- Explain ambiguous sources and missing specialized data; preserve explicit selections and grid-charging safeguards.
- Refresh automatically selected sources when their state changes and add discovery and browser regression coverage.

## 0.4.1 — 2026-10-22

- Align Daily operation charge-level bars and percentages across recorded and planned rows, including rows with stored energy in kWh.
- Add browser regression coverage for charge-bar alignment at mobile and desktop widths.

## 0.4.0 — 2026-10-21

- Add Daily operation: a quarter-hour table with measured/planned labels, current interval, charge level, battery energy, solar-to-battery, consumption, and optional tariffs.
- Preserve missing values, signed tariffs, DST gaps, sparse next-day projections, and stale-data boundaries.
- Add shared native appearance controls to all ten cards, including theme reset, semantic colors, spacing, typography, and interaction feedback, aligned with Quatt Cards.
- Show accessible, theme-aware skeletons during initial discovery and reconnects; retain readings during background refresh and respect reduced motion.
- Prevent stalled or failed old registry requests from blocking replacement connections.
- Add data and browser regressions, plus production-bundle visual previews in light, dark, custom themes, and mobile layouts.

## 0.3.0 — 2026-10-11

- Add Solar independence, Price windows, Forecast accuracy, and Energy today cards with visual editors and light/dark previews.
- Show daily energy totals as horizontal bars with a shared kWh scale, sensor detail links, and optional remaining-forecast rows.
- Add duration-weighted upcoming tariff windows, preserving negative prices and excluding incomplete windows.
- Require explicit solar attribution assumptions and a separately persisted forecast source; preserve missing data and incomplete intervals.
- Hide retained import/export tariffs when their source is unavailable or unknown.
- Reject prior-day timelines in Forecast accuracy using the timeline timezone.
- Add regression tests, responsive browser checks, and production-bundle preview validation.

## 0.2.0

- Add the System battery card with the reported system charge level, total stored energy, and a charge bar for every battery.
- Default to layout C with at most three columns and additional rows for larger installations.
- Offer layouts A (stacked) and B (compact) through the visual editor and YAML.
- Keep unavailable batteries visible and system charge independent of individual readings.

## 0.1.2

- Match the approved design with one continuous, rounded Activity strip and a compact color legend.
- Preserve gaps and mixed activities within the strip, and distinguish measured from projected activity.
- Show Hold only when explicit observations or delay evidence support it.

## 0.1.1

- Preserve compact header spacing inside Home Assistant's native `ha-card` element.
- Verified live discovery, timeline, Nord Pool prices, battery telemetry, and status using unsaved Home Assistant previews.

## 0.1.0

- Four display-only Home Assistant cards: Energy plan, Overview, Battery, and Status.
- Omnibattery entity discovery, including legacy Marstek identifiers and renamed entities.
- Measured and forecast energy timelines, next-day coverage, and optional Nord Pool prices.
- Visual configuration editors, card-picker previews, and Home Assistant theme support.
- One self-contained JavaScript bundle for HACS custom-repository installation.
