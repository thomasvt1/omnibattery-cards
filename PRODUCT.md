# Omnibattery Cards

<!-- impeccable:product-schema:3 -->

## Platform
web

## Stack
TypeScript, Lit custom elements, Vite, and inline SVG. The user delegated the technology choice and approved this stack. Output is one HACS dashboard JavaScript module.

## Product
Ten display-only Home Assistant dashboard cards for people using Omnibattery: Daily operation, Energy plan, Overview, Battery, System battery, Status, Solar independence, Price windows, Forecast accuracy, and Energy today. The cards help explain current energy flows, the day's measured and projected operation, each battery's condition, and why charging or discharging is limited.

## Constraints
Frontend only. No service calls, battery control, integration modifications, or new helpers. Work with Omnibattery v1.5.0 and Home Assistant 2026.10. Discover through registry metadata, not names. Distinguish actual from projected values and unknown from zero. No fictitious savings or appliance schedules. Respect Home Assistant units, locale, timezone, themes, and accessibility.

## Brand Commitments
Closely match EMHASS Companion's compact chart and card language. Use Home Assistant typography and energy colors, with restrained light and dark surfaces. The user explicitly chose image mockups for approval before implementation of the cards.

## Evidence on Hand
Public references: https://github.com/smefa/emhass-ha-companion and https://github.com/ffunes/Omnibattery. Read-only inspection confirmed three Zendure SolarFlow 800 Plus batteries, timeline schema 1, and Nord Pool timestamped price data. Public fixtures must be synthetic and must not contain household identifiers or diagnostics.

## Product Principles
- Make the battery's behavior understandable without changing it.
- Keep measured data, forecasts, and missing information visibly distinct.
- Prefer accurate omission over invented telemetry.
- Fit naturally into existing Home Assistant dashboards.

## Delivery
Public repository thomasvt1/omnibattery-cards, AGPL-3.0-or-later, versioned HACS custom-repository releases. Installation is authorized. Existing dashboards and automations remain unchanged; live verification uses an unsaved preview.

## Accessibility
Keyboard-accessible chart inspection, touch support, visible focus, sufficient contrast, responsive reflow, and reduced motion. English labels with locale-aware formatting.

## Insight cards

The three additional cards follow the approved light/dark concept previews. Solar independence requires explicit attribution inputs or assumptions. Price windows use published tariffs only. Forecast accuracy consumes an explicitly configured, separately persisted snapshot; it does not create helpers or capture forecasts itself.
