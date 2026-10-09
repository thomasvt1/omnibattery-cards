import { css, html, svg } from 'lit';

export const cardStyles = css`
  :host { display: block; container-type: inline-size; min-width: 0; color: var(--primary-text-color, #202530);
    font-family: var(--ha-font-family-body, var(--paper-font-body1_-_font-family, Roboto, Arial, sans-serif));
    --ob-solar: var(--energy-solar-color, #f5a900); --ob-home: var(--primary-text-color, #646b78);
    --ob-grid: var(--energy-grid-consumption-color, #2196f3); --ob-battery: var(--energy-battery-out-color, #00a99a);
    --ob-soc: #e84988; --ob-price: #9965e8; --ob-secondary: var(--secondary-text-color, #687080);
    --ob-line: var(--divider-color, #e2e5eb); --ob-subtle: var(--secondary-background-color, #f3f5f8);
    --ob-good: var(--success-color, #238b61); --ob-warning: var(--warning-color, #a86b00); --ob-error: var(--error-color, #d32f2f);
    font-size: 14px; line-height: 1.45; font-variant-numeric: tabular-nums;
  }
  * { box-sizing: border-box; }
  ha-card { display: block; padding: 20px; border: var(--ha-card-border-width, 1px) solid var(--ha-card-border-color, var(--ob-line));
    border-radius: var(--ha-card-border-radius, 12px); background: var(--ha-card-background, var(--card-background-color, #fff));
    box-shadow: none; overflow: hidden;
  }
  .card-header { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; margin-bottom: 18px; }
  h2 { margin: 0; font-size: 18px; line-height: 1.3; font-weight: 600; overflow-wrap: anywhere; letter-spacing: -.2px; }
  .subtitle { color: var(--ob-secondary); font-size: 12px; }
  button, input, select { font: inherit; color: inherit; }
  button { cursor: pointer; }
  button:disabled { cursor: default; opacity: .65; }
  button:focus-visible, summary:focus-visible, [tabindex]:focus-visible { outline: 2px solid var(--primary-color, #03a9f4); outline-offset: 3px; }
  button.metric { appearance: none; padding: 0; border: 0; background: transparent; text-align: inherit; border-radius: 3px; }
  button.metric:hover { color: var(--primary-color, #03a9f4); }
  .notice { font-size: 13px; color: var(--ob-secondary); padding: 12px; border-radius: 8px; background: var(--ob-subtle); margin: 0 0 14px; }
  .notice.error { color: var(--ob-error); }
  .notice p { margin: 4px 0; }
  .icon { width: 22px; height: 22px; fill: none; stroke: currentColor; stroke-width: 1.7; stroke-linecap: round; stroke-linejoin: round; flex: 0 0 auto; }
  .muted { color: var(--ob-secondary); } .good { color: var(--ob-good); } .warning { color: var(--ob-warning); } .error { color: var(--ob-error); }
  ::selection { color: var(--primary-text-color, #202530); background: color-mix(in srgb, var(--primary-color, #03a9f4) 25%, transparent); }
  @media (max-width: 450px) { ha-card { padding: 16px; } h2 { font-size: 17px; } }
  @media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation: none !important; transition: none !important; } }
`;
export function icon(name: string) {
  const paths: Record<string, unknown> = {
    sun: svg`<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/>`,
    home: svg`<path d="m3 11 9-8 9 8M5 10v11h5v-7h4v7h5V10"/>`,
    battery: svg`<rect x="6" y="4" width="12" height="18" rx="2"/><path d="M10 4V2h4v2m-1 4-3 5h4l-3 5"/>`,
    grid: svg`<path d="m12 2-7 20m7-20 7 20M8 9h8M6 15h12M4 5h16M3 10h18M9 5l6 10m0-10L9 15M7 22l10-7M17 22 7 15"/>`,
    shield: svg`<path d="m12 2 8 4v6c0 5-8 10-8 10S4 17 4 12V6Zm-4 10 3 3 5-6"/>`,
    clock: svg`<circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/>`,
    check: svg`<circle cx="12" cy="12" r="9"/><path d="m7 12 3 3 7-7"/>`,
    warning: svg`<path d="m12 3 10 18H2Zm0 6v5m0 3v.1"/>`,
    connection: svg`<path d="M3 8a14 14 0 0 1 18 0M6 12a9 9 0 0 1 12 0M9 16a4 4 0 0 1 6 0"/><circle cx="12" cy="20" r=".5"/>`,
    chart: svg`<path d="M3 3v18h18M6 15l4-5 4 3 6-8"/>`,
    info: svg`<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v.1"/>`,
  };
  return svg`<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${paths[name] || paths.info}</svg>`;
}
export function metricButton(label: string, entityId: string | undefined, callback: (id?: string) => void) {
  return entityId ? html`<button class="metric" @click=${() => callback(entityId)}>${label}</button>` : html`${label}`;
}
