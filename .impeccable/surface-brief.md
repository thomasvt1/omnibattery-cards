# Omnibattery card collection

Mode: Operate. The user inspects household energy on desktop, tablet, and phone, in Home Assistant light or dark mode. Five independently usable cards fit the surrounding dashboard.

## System battery card

Approved on 2026-10-09: `.impeccable/mocks/system-battery-c.png` is the default new System battery card. The user requested at most three columns with additional batteries continuing on new rows. Preserve its system charge summary, aggregate bar, divider, and per-battery columns with small bars. Provide the other options through the visual editor and YAML: A (`stacked`, `.impeccable/mocks/system-battery-a.png`) and B (`compact`, `.impeccable/mocks/system-battery-b.png`); C is `columns`. Use the reported Omnibattery system SOC, stored energy, and capacity. Each discovered battery remains independently visible; unknown charge is unavailable, never zero. Long device names wrap. All interactions inspect sensor details. Do not add power, temperature, health, or control features to this compact card.

## Direction contract
THESIS: The day's energy story and present battery behavior stay readable at a glance.
OWN-WORLD: Home Assistant sans-serif, theme surfaces, thin dividers, amber solar, teal battery, blue grid, pink charge level, compact SVG plots.
STORY: Read current flows, inspect measured versus projected intervals, identify limits, then inspect an individual battery.
FIRST VIEWPORT: A wide plan card above a row of three compact cards: Overview, Battery, Status. On phones the four cards stack, keeping every chart row and legible labels.
FORM: User-pinned EMHASS Companion card composition, adapted to battery operations; compact grid C explicitly approved by the user.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Mockup review
Approved comp: `.impeccable/mocks/c-compact-grid.png`. User selected C on 2026-10-09. Preserve its wide timeline above three compact companion cards, theme surfaces, chart hierarchy, whitespace, and energy colors. Implement semantic SVG and HTML. The user explicitly reaffirmed the single segmented Activity strip after the first release: it is part of the approved design. Preserve multiple reported activities using split colors inside that strip, without claiming their order or duration. Exact example readings and the device frame are illustrative; use truthful data and no phone bezel in the actual interface. Every chart remains available on mobile. Images contain illustrative data, not live household values.

## User-pinned direction exceptions
The user requested a close match to EMHASS Companion and approved composition C. The visual world was pinned by that request, so a FORM roll and catalog QUALITY BAR card were not used. No seed or catalog approval is claimed. The benchmark is the referenced EMHASS project plus the approved C image.

The approved image is a presentation board containing desktop and phone surfaces. Whole-board comparison against a single runtime desktop viewport is not a valid fidelity measure. Preserve its original artifact and automated reports; compare cropped desktop and phone references against the corresponding runtime captures, then record the independent review disposition. Reference crops are analysis evidence only, with exact coordinates and source hash in `review/reference-crops.json`.
