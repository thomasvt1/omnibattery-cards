import { css, html, svg } from 'lit';

export const cardStyles = css`
  :host { display: block; container-type: inline-size; min-width: 0; color: var(--ob-text);
    font-family: var(--ha-font-family-body, var(--paper-font-body1_-_font-family, Roboto, Arial, sans-serif));
    --ob-solar: var(--energy-solar-color, #f5a900); --ob-home: var(--energy-consumption-color, #7dcada);
    --ob-text: var(--primary-text-color, #202530); --ob-charge: var(--energy-battery-in-color, #4ecb88); --ob-export: var(--energy-grid-return-color, #ff951e);
    --ob-grid: var(--energy-grid-consumption-color, #2196f3); --ob-battery: var(--energy-battery-out-color, #00a99a);
    --ob-soc: #e84988; --ob-price: #9965e8; --ob-secondary: var(--secondary-text-color, #687080);
    --ob-line: var(--divider-color, #e2e5eb); --ob-subtle: var(--secondary-background-color, #f3f5f8);
    --ob-good: var(--success-color, #238b61); --ob-warning: var(--warning-color, #a86b00); --ob-error: var(--error-color, #d32f2f);
    font-size: 14px; line-height: 1.45; font-variant-numeric: tabular-nums;
  }
  * { box-sizing: border-box; }
  ha-card { display: block; padding: var(--ob-padding, 20px); color: var(--ob-text); border: var(--ob-border-width, var(--ha-card-border-width, 1px)) solid var(--ob-border-color, var(--ha-card-border-color, var(--ob-line)));
    border-radius: var(--ob-radius, var(--ha-card-border-radius, 12px)); background: var(--ob-background, var(--ha-card-background, var(--card-background-color, #fff)));
    box-shadow: var(--ob-shadow, var(--ha-card-box-shadow, none)); overflow: hidden;
  }
  .skeleton-content{animation:omnibattery-loading 1.5s ease-in-out infinite}
  .skeleton-block{background:color-mix(in srgb,var(--ob-secondary) 18%,transparent);border-radius:6px}
  .skeleton-title{width:42%;height:18px;margin-bottom:24px}
  .skeleton-body{display:flex;align-items:center;gap:20px;min-height:150px}
  .skeleton-icon{width:64px;height:100px;flex:none;border-radius:12px}
  .skeleton-readings{display:grid;gap:14px;flex:1;min-width:0}.skeleton-value{width:55%;height:26px}.skeleton-line{width:85%;height:12px}
  .skeleton-bar{height:8px;margin-top:20px;width:100%}
  ha-card.compact-loading{min-height:0;padding:var(--ob-padding,12px 14px)}
  .compact-loading .skeleton-content{display:grid;grid-template-columns:38px minmax(0,1fr);gap:8px 12px;min-height:64px}
  .compact-loading .skeleton-title{grid-column:2;grid-row:1;height:13px;width:55%;margin:0}
  .compact-loading .skeleton-body{display:contents}.compact-loading .skeleton-icon{grid-column:1;grid-row:1/4;width:32px;height:60px}
  .compact-loading .skeleton-readings{grid-column:2;grid-row:2;display:flex;justify-content:space-between;align-items:center;gap:12px}
  .compact-loading .skeleton-value{width:45%;height:11px}.compact-loading .skeleton-line{width:23%;height:20px}
  .compact-loading .skeleton-bar{grid-column:2;grid-row:3;margin:0;height:6px}
  @keyframes omnibattery-loading{0%,100%{opacity:.55}50%{opacity:1}}
  .skeleton-table { display:grid; gap:18px; min-height:240px; }.skeleton-table .skeleton-line { width:100%;height:14px; }
  .ob-header { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; margin-bottom: 18px; }
  h2 { margin: 0; font-size: var(--ob-title-size, 18px); line-height: 1.3; font-weight: 600; overflow-wrap: anywhere; letter-spacing: -.2px; }
  .subtitle { color: var(--ob-secondary); font-size: 12px; }
  button, input, select { font: inherit; color: inherit; }
  button { cursor: pointer; }
  button:disabled { cursor: default; opacity: .65; }
  button:focus-visible, summary:focus-visible, [tabindex]:focus-visible { outline: 2px solid var(--ob-focus, var(--primary-color, #03a9f4)); outline-offset: -2px; }
  button.metric { appearance: none; padding: 0; border: 0; background: transparent; text-align: inherit; border-radius: 3px; }
  @media (hover:hover) { button:not(:disabled):hover, summary:hover { background: var(--ob-hover, color-mix(in srgb,var(--primary-color,#03a9f4) 8%,transparent)); } }
  button:not(:disabled):active, summary:active { background: var(--ob-pressed, color-mix(in srgb,var(--primary-color,#03a9f4) 16%,transparent)); }
  .notice { font-size: 13px; color: var(--ob-secondary); padding: 12px; border-radius: 8px; background: var(--ob-subtle); margin: 0 0 14px; }
  .notice.error { color: var(--ob-error); }
  .notice p { margin: 4px 0; }
  .icon { width: 22px; height: 22px; fill: none; stroke: currentColor; stroke-width: 1.7; stroke-linecap: round; stroke-linejoin: round; flex: 0 0 auto; }
  .muted { color: var(--ob-secondary); } .good { color: var(--ob-good); } .warning { color: var(--ob-warning); } .error { color: var(--ob-error); }
  ::selection { color: var(--ob-text); background: color-mix(in srgb, var(--primary-color, #03a9f4) 25%, transparent); }
  @media (max-width: 450px) { ha-card { padding: var(--ob-padding, 16px); } h2 { font-size: var(--ob-title-size, 17px); } }
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
