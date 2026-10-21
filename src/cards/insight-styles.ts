import { css } from 'lit';
export const insightStyles = css`
  ha-card { min-height: 402px; }
  .hero { font-size: var(--ob-value-size, 46px); font-weight: 650; letter-spacing: -1.5px; line-height: 1.15; }
  .hero-unit { font-size: 19px; font-weight: 400; letter-spacing: 0; }
  .caption { font-size: 15px; margin-top: 2px; }
  .footnote { color: var(--ob-secondary); font-size: 12px; margin-top: 14px; }
  .teal { color: var(--ob-battery); } .amber { color: var(--ob-solar); } .purple { color: var(--ob-price); }
  svg.chart { display: block; width: 100%; height: 155px; margin: 14px 0 8px; overflow: visible; }
  svg text { fill: var(--ob-secondary); font: 11px Roboto,Arial,sans-serif; }
  .gridline { stroke: var(--ob-line); stroke-width: 1; }
  .empty { margin: 24px 0; padding: 16px; background: var(--ob-subtle); border-radius: 8px; color: var(--ob-secondary); }
  .stats { display: grid; grid-template-columns: 1fr 1fr; border-top: 1px solid var(--ob-line); padding-top: 12px; text-align: center; }
  .stats > div + div { border-left: 1px solid var(--ob-line); }
  .stats strong { display: block; font-size: var(--ob-value-size, 21px); }
  @container (max-width: 330px) { .hero { font-size: var(--ob-value-size, 38px); } .hero-unit { font-size: 16px; } }
`;
