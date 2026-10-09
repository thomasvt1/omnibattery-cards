# Changelog

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
