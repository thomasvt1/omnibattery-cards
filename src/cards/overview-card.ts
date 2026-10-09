import { css, html, nothing, svg, type TemplateResult } from 'lit';
import { BaseCard } from '../base-card';
import { icon } from '../ui';
import type { Metric } from '../types';

/** Live topology deliberately keeps DC solar separate from directional AC exchange. */
export class OmnibatteryOverviewCard extends BaseCard {
  static getStubConfig() { return { type: 'custom:omnibattery-overview-card' }; }

  getCardSize() { return this.clientWidth && this.clientWidth <= 450 ? 6 : 8; }

  static styles = [BaseCard.styles, css`
    .content { padding: 0; }
    .overview-main { display: grid; grid-template-columns: minmax(0, 1fr); }
    .flow { position: relative; max-width: 430px; margin: 1px auto 13px; }
    .connections { position: absolute; inset: 0; width: 100%; height: 184px; pointer-events: none; }
    .connections path { fill: none; stroke-width: 1.7; stroke-linecap: round; stroke-linejoin: round; }
    .nodes { position: relative; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); row-gap: 21px; padding-top: 2px; }
    .node { display: flex; flex-direction: column; align-items: center; min-width: 0; text-align: center; }
    .node.battery { grid-column: 2; }
    .node-copy { display: flex; flex-direction: column; align-items: center; min-width: 0; }
    .node-button { display: flex; flex-direction: column; align-items: center; padding: 0 4px; background: transparent; border: 0; border-radius: 8px; color: inherit; font: inherit; cursor: pointer; }
    .node-button:hover .disc { background: color-mix(in srgb, currentColor 15%, transparent); }
    .node-button:focus-visible { outline: 2px solid var(--primary-color, #03a9f4); outline-offset: 4px; }
    .disc { display: grid; place-items: center; box-sizing: border-box; width: 42px; height: 42px; margin-bottom: 6px; border: 1px solid currentColor; border-radius: 50%; background: color-mix(in srgb, currentColor 9%, var(--ha-card-background, var(--card-background-color, #fff))); }
    .disc svg { width: 24px; height: 24px; }
    .solar { color: var(--ob-solar, #d99500); }
    .home { color: var(--ob-home, #7a8491); }
    .grid { color: var(--ob-grid, #198ecc); }
    .battery { color: var(--ob-battery, #009d91); }
    .reading { color: var(--primary-text-color, #17202c); font-weight: 600; font-size: 15px; line-height: 1.4; font-variant-numeric: tabular-nums; white-space: nowrap; }
    .label { color: var(--secondary-text-color, #646b75); font-size: 12px; line-height: 1.5; }
    .flow-caption { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 5px 12px; margin: 0 0 12px; font-size: 12px; line-height: 1.5; color: var(--secondary-text-color, #646b75); }
    .flow-caption button { border: 0; padding: 0; background: transparent; color: inherit; font: inherit; border-radius: 3px; cursor: pointer; text-align: left; }
    .flow-caption button:hover { color: var(--primary-text-color, #17202c); }
    button:focus-visible { outline: 2px solid var(--primary-color, #03a9f4); outline-offset: 3px; }
    .today { margin: 0 0 5px; color: var(--primary-text-color, #17202c); font-size: 13px; font-weight: 600; line-height: 1.5; }
    .daily { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); column-gap: 18px; }
    .daily-item { display: flex; align-items: baseline; justify-content: space-between; gap: 5px; min-width: 0; padding: 5px 0; border-top: 1px solid var(--divider-color, #e6e8ec); color: var(--secondary-text-color, #646b75); font-size: 12px; line-height: 1.5; }
    .daily-value { color: var(--primary-text-color, #17202c); font-variant-numeric: tabular-nums; white-space: nowrap; font-weight: 500; }
    .daily-item button { padding: 0; border: 0; border-radius: 2px; background: transparent; font: inherit; cursor: pointer; }
    .daily-item button:hover { text-decoration: underline; text-underline-offset: 3px; }
    .operating { display: flex; align-items: center; gap: 7px; margin-top: 12px; padding-top: 11px; border-top: 1px solid var(--divider-color, #e6e8ec); color: var(--secondary-text-color, #646b75); font-size: 12px; line-height: 1.5; }
    .operating svg { width: 15px; height: 15px; flex: none; }
    @container (max-width: 450px) {
      .overview-main { grid-template-columns: minmax(0, 1.6fr) minmax(0, 1fr); gap: 12px; align-items: start; }
      .flow-block { display: contents; }
      .flow { grid-column: 1; grid-row: 1; width: 100%; margin: 1px 0 0; }
      .connections { height: 145px; }
      .nodes { row-gap: 20px; }
      .node-button { min-width: 0; max-width: 100%; padding: 0; }
      .disc { width: 32px; height: 32px; margin-bottom: 4px; }
      .disc svg { width: 20px; height: 20px; }
      .reading { font-size: 13px; }
      .label { font-size: 11px; }
      .node.battery { grid-column: 2 / 4; margin-left: calc(25% - 16px); align-items: flex-start; flex-direction: row; text-align: left; }
      .battery .node-button { flex-direction: row; text-align: left; }
      .battery .disc { flex: none; margin: 0 7px 0 0; }
      .battery .node-copy { align-items: flex-start; }
      .battery .label { overflow-wrap: anywhere; }
      .today-section { grid-column: 2; grid-row: 1; min-width: 0; border-left: 1px solid var(--divider-color, #e6e8ec); padding-left: 12px; }
      .today { font-size: 12px; margin: 0 0 5px; }
      .daily { grid-template-columns: minmax(0, 1fr); }
      .daily-item { flex-wrap: wrap; border: 0; padding: 2px 0; gap: 0 3px; font-size: 11px; }
      .daily-value { margin-left: auto; }
      .flow-caption { grid-column: 1 / -1; grid-row: 2; margin: 0; gap: 3px 10px; font-size: 11px; }
      .operating { margin-top: 11px; padding-top: 10px; }
    }
    @container (max-width: 350px) {
      .overview-main { gap: 9px; }
      .today-section { padding-left: 8px; }
    }
  `];

  protected render() {
    const s = this.snapshot;
    const gridDirection = s.grid.value === null ? 'Grid' : s.grid.value > 0 ? 'From grid' : s.grid.value < 0 ? 'To grid' : 'Grid';
    const acDirection = s.acPower.value === null ? 'AC exchange' : s.acPower.value > 0 ? 'AC charging' : s.acPower.value < 0 ? 'AC discharging' : 'AC exchange';
    const operating = s.status.find(row => row.key === 'operation' || row.key === 'operating' || row.key === 'mode');
    return html`
      <ha-card>
        ${this.renderHeader('Overview', 'Live power')}
        ${this.renderNotice()}
        <div class="content">
          <div class="overview-main">
          <div class="flow-block">
          <div class="flow" aria-label="Live solar, home, grid, and battery AC power">
            <svg class="connections" viewBox="0 0 300 184" preserveAspectRatio="none" aria-hidden="true">
              <path d="M 76 24 H 124" stroke="var(--ob-solar, #d99500)" />
              <path d="M 176 24 H 224" stroke="var(--ob-grid, #198ecc)" />
              ${this.arrow(s.grid.value, 'grid')}
              <path d="M 150 90 V 112" stroke="var(--ob-battery, #009d91)" />
              ${this.arrow(s.acPower.value, 'battery')}
            </svg>
            <div class="nodes">
              ${this.node('solar', 'sun', 'Solar', s.solar)}
              ${this.node('home', 'home', 'Home', s.home)}
              ${this.node('grid', 'grid', gridDirection, s.grid)}
              ${this.node('battery', 'battery', acDirection, s.acPower)}
            </div>
          </div>
          <div class="flow-caption">
            ${s.soc.value !== null ? this.caption(`Charge level ${this.format(s.soc.value, '%', 0)}`, s.soc.entityId) : nothing}
            ${s.cellPower.value !== null ? this.caption(`Cell ${s.cellPower.value > 0 ? 'charging' : s.cellPower.value < 0 ? 'discharging' : 'power'} ${this.format(Math.abs(s.cellPower.value), 'W')}`, s.cellPower.entityId) : nothing}
          </div>
          </div>
          <section class="today-section" aria-label="Daily energy totals">
          <h3 class="today">Today</h3>
          <div class="daily">
            ${this.dailyMetric('Solar', s.daily.solar)}
            ${this.dailyMetric('Home', s.daily.home)}
            ${this.dailyMetric('From grid', s.daily.gridImport)}
            ${this.dailyMetric('To grid', s.daily.gridExport)}
            ${this.dailyMetric('Charged', s.daily.charge)}
            ${this.dailyMetric('Discharged', s.daily.discharge)}
          </div>
          </section>
          </div>
          ${operating ? html`<div class="operating">${icon('home')}<span>${operating.title}</span></div>` : nothing}
        </div>
      </ha-card>`;
  }

  private arrow(value: number | null, connection: 'grid' | 'battery') {
    if (value === null || value === 0) return nothing;
    if (connection === 'grid') return svg`<path d=${value > 0 ? 'M 195 20 L 189 24 L 195 28' : 'M 205 20 L 211 24 L 205 28'} stroke="var(--ob-grid, #198ecc)" />`;
    return svg`<path d=${value > 0 ? 'M 146 101 L 150 107 L 154 101' : 'M 146 103 L 150 97 L 154 103'} stroke="var(--ob-battery, #009d91)" />`;
  }

  private node(tone: string, glyph: string, label: string, metric: Metric) {
    const value = metric.value === null ? null : tone === 'grid' || tone === 'battery' ? Math.abs(metric.value) : metric.value;
    const content = html`<span class="disc" aria-hidden="true">${icon(glyph)}</span><span class="node-copy"><span class="reading">${this.format(value, 'W')}</span><span class="label">${label}</span></span>`;
    return html`<div class=${`node ${tone}`}>${this.canInspect(metric.entityId)
      ? html`<button class="node-button" aria-label=${`${label}: ${this.format(value, 'W')}. Show details`} @click=${() => this.moreInfo(metric.entityId)}>${content}</button>`
      : content}</div>`;
  }

  private dailyMetric(label: string, metric: Metric) {
    return html`<div class="daily-item"><span>${label}</span>${this.canInspect(metric.entityId)
      ? html`<button class="daily-value" aria-label=${`${label} today: ${this.format(metric.value, 'kWh', 1)}. Show details`} @click=${() => this.moreInfo(metric.entityId)}>${this.format(metric.value, 'kWh', 1)}</button>`
      : html`<span class="daily-value">${this.format(metric.value, 'kWh', 1)}</span>`}</div>`;
  }

  private caption(label: string, entityId?: string): TemplateResult {
    return this.canInspect(entityId)
      ? html`<button @click=${() => this.moreInfo(entityId)} aria-label=${`${label}. Show details`}>${label}</button>`
      : html`<span>${label}</span>`;
  }

  private canInspect(entityId?: string) { return !!entityId && /^(sensor|binary_sensor)\./.test(entityId); }
}
