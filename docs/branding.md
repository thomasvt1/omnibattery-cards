# Repository icon

The project icon is [`icon.png`](../icon.png), a transparent PNG generated with the built-in imagegen tool. It combines a teal battery with stacked energy dashboard cards, using the project's battery teal and dark ink colors.

The README uses an absolute raw GitHub image URL so the icon also resolves when HACS renders the repository description. The image becomes available at that URL after it is published to `main`.

## HACS support

This repository is a **Dashboard / plugin**, not a Home Assistant integration. HACS currently uses a fixed dashboard category icon for plugin listings. Adding `icon.png` does not override that listing icon, and there is no supported `icon` key in `hacs.json`. The project icon appears in the repository README and its HACS description instead.

References checked on 2026-10-09:

- [HACS manifest options](https://www.hacs.xyz/docs/publish/start/#hacsjson)
- [HACS listing renderer](https://github.com/hacs/frontend/blob/main/src/dashboards/hacs-dashboard.ts)
- [HACS category icons](https://github.com/hacs/frontend/blob/main/src/tools/type-icon.ts)

## Generation prompt

Use case: logo-brand. Create a finished app icon for Omnibattery Cards, a Home Assistant dashboard card collection for home energy and battery storage. A compact, original geometric mark combining a recognizable battery silhouette with a restrained layered dashboard-card motif. Flat vector-like finish, thick clean shapes, battery teal #00a99a as primary with dark ink #202530 and a small white/light detail if needed. Clear at 32px, centered in a square composition, generous even transparent padding. No lettering, no words, no watermark, no mockup, no shadows, no gradients, no fine details. Output a single isolated icon with genuinely transparent background.
