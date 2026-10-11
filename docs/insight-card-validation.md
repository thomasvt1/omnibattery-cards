# Insight card validation

Implemented Solar independence, Price windows, and Forecast accuracy against the approved image-generated light/dark concepts, plus Energy today against the supplied horizontal-bar reference.

The final production screenshots are [desktop light/dark](../examples/new-cards-preview.png) and [mobile light/dark](../examples/new-cards-mobile.png). They were rendered in Chromium using `dist/omnibattery-cards.js`, not just the TypeScript development components. Synthetic telemetry and a frozen UTC clock make the capture reproducible with `npm run validate:previews`. CI runs the same production capture after its build.

Visual inspection confirmed the concept compositions: a teal self-sufficiency hero, donut and split bar; purple tariff bars and two tinted price-window rows; and an amber measured-versus-saved-forecast plot above paired totals. Shared borders, rounded corners, theme surfaces and semantic colors follow the existing Home Assistant card styles. Desktop and mobile screenshots were inspected after building.

Deliberate differences from the concept image:

- Forecast paths use interval-average steps and preserve gaps rather than implying a smooth measured signal.
- Upcoming price windows exclude elapsed periods; the production preview's lowest window is 15:00–17:00 at its 14:00 clock.
- Values and spacing use Home Assistant formatting and responsive, content-sized layouts. These are visually matched concepts, not pixel-identical replicas.
- Energy attribution assumptions and the matched-interval count remain visible.

Validation completed: TypeScript check, production build, 54 unit tests and the full 64-test browser suite. New layout checks cover 320, 390, 820 and 1440px in both themes. Editor tests cover source changes, metric selection, missing inputs and live saved-forecast updates. Energy today also has responsive, forecast-availability, zero-value, shared-scale, editor, and sensor-detail checks. All example screenshots were regenerated. Its [light](../examples/energy-today-light.png) and [dark](../examples/energy-today-dark.png) previews were captured from the production bundle and visually inspected.

Forecast accuracy requires an external persisted snapshot in the documented schema. No forecast sensor, Home Assistant helper, service call, release or deployment is created by this change.
