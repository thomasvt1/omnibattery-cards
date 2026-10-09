---
name: Omnibattery Cards
description: Compact Home Assistant energy cards in the approved EMHASS Companion language.
colors:
  text: "var(--primary-text-color, #202530)"
  secondary: "var(--secondary-text-color, #687080)"
  surface: "var(--ha-card-background, var(--card-background-color, #fff))"
  subtle: "var(--secondary-background-color, #f3f5f8)"
  divider: "var(--divider-color, #e2e5eb)"
  interaction: "var(--primary-color, #03a9f4)"
  solar: "var(--energy-solar-color, #f5a900)"
  home: "var(--primary-text-color, #646b78)"
  grid: "var(--energy-grid-consumption-color, #2196f3)"
  battery: "var(--energy-battery-out-color, #00a99a)"
  charge-level: "#e84988"
  price: "#9965e8"
  warning: "var(--warning-color, #a86b00)"
  error: "var(--error-color, #d32f2f)"
typography:
  title:
    fontFamily: "var(--ha-font-family-body, var(--paper-font-body1_-_font-family, Roboto, Arial, sans-serif))"
    fontSize: "18px"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "-.2px"
  body:
    fontFamily: "var(--ha-font-family-body, var(--paper-font-body1_-_font-family, Roboto, Arial, sans-serif))"
    fontSize: "14px"
    lineHeight: 1.45
  section:
    fontSize: "13px"
    fontWeight: 600
    lineHeight: 1.5
  label:
    fontSize: "12px"
    lineHeight: 1.5
  compact-label:
    fontSize: "11px"
rounded:
  card: "var(--ha-card-border-radius, 12px)"
  control: "8px"
  metric: "3px"
  disc: "50%"
spacing:
  small: "8px"
  related: "12px"
  section: "16px"
  card: "20px"
components:
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.card}"
    padding: "{spacing.card}"
  metric-button:
    backgroundColor: "transparent"
    rounded: "{rounded.metric}"
    padding: "0"
  notice:
    backgroundColor: "{colors.subtle}"
    textColor: "{colors.secondary}"
    rounded: "{rounded.control}"
    padding: "{spacing.related}"
  editor-field:
    rounded: "{rounded.control}"
    padding: "10px 12px"
    width: "100%"
---

# Design System: Omnibattery Cards

## Overview

**Creative North Star: "EMHASS Companion card language"**

Compact energy instruments belong inside the user's Home Assistant dashboard. The approved world uses native Home Assistant typography, restrained light and dark surfaces, thin dividers, and colored SVG energy plots. Density comes from aligned information and short labels, with content determining card height.

The system makes present readings, measured history, projections, and unavailable information distinguishable. Theme inheritance is part of the identity: the demo's explicit light and dark palettes demonstrate the cards, but do not replace the host theme contract.

**Key Characteristics:**
- Theme-native surfaces and typography.
- Stable energy colors across plots and flow nodes.
- Compact readings with tabular numerals.
- Flat, content-sized cards with inspection on demand.

## Colors

Semantic energy accents sit on quiet host-theme neutrals; the source expressions in the frontmatter are normative, including their fallbacks.

### Primary
- **Battery Teal:** battery power plots, charge meters, flow connections, and positive status icon discs.
- **Interaction Blue:** keyboard focus and selected range controls; inherited independently from the grid energy color.

### Secondary
- **Solar Amber:** solar generation and solar charging activity.
- **Grid Blue:** grid exchange, grid charging activity, and export tariff series.

### Tertiary
- **Charge-level Pink:** state-of-charge plot.
- **Price Violet:** import price plot.
- **Warning / Error:** host semantic feedback colors, accompanied by text and SVG icons.

### Neutral
- **Surface / Subtle:** card canvas and restrained inset notices or range-control tracks.
- **Text / Secondary:** readings and titles versus labels, captions, and explanatory copy.
- **Divider:** chart grids and internal separation. Card outlines additionally honor the host's card border color.
- **Home:** follows primary text color rather than introducing another saturated energy accent.

### Named Rules
**The Energy Identity Rule.** Keep each energy role's color consistent across charts, the activity strip, and live flow nodes.

**The Host Theme Rule.** Resolve host theme variables before fallback values; do not freeze the demo palette into cards.

## Typography

**Body and Title Font:** the Home Assistant body stack recorded above. There is no separate display face in the reusable cards; native sans-serif typography is the user's pinned world.

The hierarchy is close and practical: semibold card titles, restrained section headings, regular descriptive labels, and tabular numerical readings. Labels use normal sentence case.

### Hierarchy
- **Title:** shared card heading; reduces to 17px at a viewport width of 450px or less.
- **Body:** inherited card text and form copy.
- **Section:** small headings such as Today.
- **Label:** captions, supporting readings, and metric descriptions.
- **Compact label:** plot text, legends, and narrow-card metric descriptions.

The battery's principal charge reading and its metric values have local emphasis in the built component; they are not a general-purpose display scale. Numeric content uses `font-variant-numeric: tabular-nums` rather than a separate monospace face.

### Named Rules
**The Reading Alignment Rule.** Use tabular numerals and baseline alignment for comparable readings, retaining the unit beside its value.

## Layout

Each custom element is an inline-size container. Card content is naturally sized, with the shared card padding reducing from the card spacing token to the section spacing token at a viewport width of 450px. Headers pair a left title with a secondary caption and permit long titles to wrap.

Overview and Battery adapt to their own container width at 450px and tighten spacing again at 350px. Compact Overview places flow and daily totals side by side; its captions span the row underneath. Compact Battery lays instantaneous metrics and Today totals across horizontal columns, removing the temperature column when that reading is absent. These are container decisions, so a narrow dashboard column receives the compact composition on a wide screen too.

The plan preserves every available chart row at small sizes, condensing plot heights and aligning plots and the activity strip to a shared left gutter: 84px normally and 60px when the measured internal chart width is below 450px. Legends wrap. Interval details appear after inspection instead of permanently consuming space.

The demo illustrates the approved wide plan above three companion cards, with a 16px gap and start-aligned, content-sized cards. At 1000px its grid has two columns and full-width Status; at 650px the cards stack. Those page breakpoints belong to the demo shell; host Home Assistant dashboards control their own placement.

## Elevation & Depth

Cards explicitly use no shadow. Depth comes from thin outlines, divider rules, subtle inset fills, and lightly tinted SVG icon discs. A typical disc mixes its semantic color at roughly 9–11% with the surface or transparency; node hover increases tint to 15%. There are no motion tokens or decorative entrance animations. The shared styles disable animation and transitions when reduced motion is requested.

### Named Rules
**The Flat Instrument Rule.** Use borders and tonal separation for card structure; keep readings and charts visually in the foreground.

## Shapes

The host controls the outer card radius and border width, with a one-pixel fallback outline. Shared controls and notices use gently rounded corners; small transparent metric buttons retain only enough radius for focus treatment. Circular icon discs and legend dots carry semantic color. Iconography consists of inline SVG strokes with rounded line caps and joins, never text glyphs or raster assets.

## Components

### Buttons

Metric inspection is visually quiet: transparent, unpadded buttons preserve a reading's alignment, with color change or underline on hover. Only backed sensor readings become inspection buttons. Keyboard focus uses a two-pixel host-primary outline with a three- or four-pixel offset in cards. Disabled shared buttons reduce opacity to 0.65.

The plan range selector uses a subtle rounded track and small transparent buttons; the pressed state uses the card surface and host primary color. It is local time-range navigation, not a battery-control action. Its shipped CSS supplies pressed and keyboard-focus states but no distinct hover styling.

### Cards / Containers

The shared card owns the border, theme surface, padding, and overflow clipping. Content remains naturally sized; a short status list does not stretch to match neighboring cards. Notices use the subtle surface and secondary text; errors use semantic error text.

### Inputs / Fields

The configuration editor uses full-width native inputs and selects with a one-pixel divider border, 44px minimum height, control radius, and generous horizontal padding. Labels are medium weight. Focus uses a two-pixel primary outline with a two-pixel offset. Optional entity overrides are disclosed with native details/summary controls, and native checkboxes remain recognizable.

### Energy Plan

SVG rows share a time axis. Measured series are solid; projections use a 5px/5px dash and 0.8 opacity. Subtle area fills differentiate measured and projected coverage without hiding the grid. Missing values break paths rather than connecting fabricated observations. The current-time marker is dashed; selected intervals use a separate neutral selection line. A single 11px rounded Activity strip follows the approved composition, with continuous amber solar charging, blue grid charging, teal discharging, and gray Hold blocks and a separate color legend. Projected activity is lighter. Multiple activities reported in a quarter share the strip's height, without implying order, duration, or simultaneity. Unreported activity remains unfilled, and Hold requires explicit evidence. Pointer, touch, and keyboard inspection reveal the interval's values, while source and data notes stay secondary.

### Live Flow and Battery Readings

Outlined SVG discs identify solar, home, grid, and battery. Connections show AC exchange independently of DC/cell readings; their direction follows the data. Battery charge uses a teal fill on a neutral track, with text beside it and explicit unavailable treatment. Additional health readings are disclosed below a divider.

### Status Rows

Flat rows pair a small tinted SVG disc with a title and optional secondary detail. Thin rules separate rows; long text wraps. Rows with an inspectable sensor become buttons, preserving the same layout and gaining underline hover and visible focus. Meaning never depends on color alone.

## Do's and Don'ts

### Do:
- **Do** inherit Home Assistant fonts, theme surfaces, energy colors, locale, and units.
- **Do** keep measured and projected data visually distinct and preserve missing-data gaps.
- **Do** size cards to content and use their container width to adapt dense readings.
- **Do** use inline SVG icons, visible focus, and textual status explanations.

### Don't:
- **Don't** turn demo readings, theme samples, or page composition into mandatory host-dashboard values.
- **Don't** equate missing telemetry with zero or draw unsupported activity and savings.
- **Don't** introduce battery-control affordances into this display-only card collection.
- **Don't** hide available chart rows to obtain a shorter mobile card.

Recorded from `src/ui.ts`, `src/cards/*`, `src/editor.ts`, and `src/demo/style.css` after the approved compact-card implementation. No runtime raster assets are part of this system.
