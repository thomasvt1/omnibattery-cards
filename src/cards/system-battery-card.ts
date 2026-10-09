import { css, html, nothing, type TemplateResult } from 'lit';
import { BaseCard } from '../base-card';
import { icon } from '../ui';
import type { BatteryModel, CardConfig, Metric } from '../types';

type Layout = NonNullable<CardConfig['layout']>;

export class OmnibatterySystemBatteryCard extends BaseCard {
  static getStubConfig(): CardConfig {
    return { type: 'custom:omnibattery-system-battery-card', layout: 'columns' };
  }

  setConfig(config: CardConfig) {
    if (config?.layout !== undefined && !['columns', 'stacked', 'compact'].includes(config.layout)) {
      throw new Error('System battery layout must be "columns", "stacked", or "compact".');
    }
    super.setConfig({ ...config, layout: config?.layout ?? 'columns' });
  }

  getCardSize() {
    const count = this.config ? this.snapshot.batteries.length : 3;
    const layout = this.config?.layout ?? 'columns';
    const height = layout === 'compact' ? 110 + Math.max(1, count) * 34
      : layout === 'stacked' ? 160 + Math.max(1, count) * 55
        : 165 + Math.max(1, Math.ceil(count / 3)) * 87;
    return Math.ceil(height / 50);
  }

  getGridOptions() { return { columns: 12, rows: 'auto', min_columns: 6, min_rows: 3 }; }

  static styles = [BaseCard.styles, css`
    .ob-header { align-items: baseline; margin-bottom: 21px; }
    .ob-header .subtitle { flex: none; white-space: nowrap; }
    .system-summary { display: grid; grid-template-columns: 52px minmax(0, 1fr); align-items: center; gap: 14px; margin: 0 0 21px; }
    .system-icon { display: grid; place-items: center; width: 52px; height: 52px; border-radius: 50%; color: var(--ob-battery); background: color-mix(in srgb, var(--ob-battery) 12%, transparent); }
    .system-icon svg { width: 29px; height: 29px; }
    .system-values { min-width: 0; }
    .system-heading { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: baseline; gap: 3px 10px; margin-bottom: 9px; }
    .system-reading { display: flex; align-items: baseline; flex-wrap: wrap; gap: 3px 7px; }
    .system-soc { font-size: 24px; line-height: 1.25; font-weight: 600; color: var(--primary-text-color, #17202c); white-space: nowrap; }
    .stored { color: var(--ob-secondary); font-size: 12px; line-height: 1.5; overflow-wrap: anywhere; }
    .unavailable { color: var(--ob-secondary); font-size: 11px; line-height: 1.5; }
    button { padding: 0; border: 0; border-radius: 3px; background: transparent; text-align: left; font: inherit; cursor: pointer; }
    button:hover { text-decoration: underline; text-underline-offset: 3px; }
    button:focus-visible { outline: 2px solid var(--primary-color, #03a9f4); outline-offset: 4px; }
    .meter { position: relative; width: 100%; overflow: hidden; border-radius: 5px; background: var(--disabled-color, var(--ob-line)); }
    .meter-fill { height: 100%; border-radius: inherit; background: var(--ob-battery); }
    .system-meter { height: 9px; }
    .battery-meter { height: 5px; }
    .is-unavailable .meter-fill { background: transparent; }
    .battery-list { display: grid; margin: 0; padding: 20px 0 0; list-style: none; border-top: 1px solid var(--ob-line); }
    .battery-item { min-width: 0; }
    .battery-name { min-width: 0; color: var(--ob-secondary); font-size: 12px; line-height: 1.5; overflow-wrap: anywhere; }
    .battery-reading { display: flex; flex-wrap: wrap; align-items: baseline; gap: 2px 6px; }
    .battery-soc { font-size: 20px; line-height: 1.3; font-weight: 600; color: var(--primary-text-color, #17202c); white-space: nowrap; }
    [data-layout="columns"] .battery-list { grid-template-columns: repeat(var(--battery-columns, 3), minmax(0, 1fr)); gap: 22px 24px; }
    [data-layout="columns"] .battery-item { position: relative; display: flex; flex-direction: column; }
    [data-layout="columns"] .battery-item:not(.first-column)::before { content: ''; position: absolute; left: -12px; top: 0; bottom: 0; border-left: 1px solid var(--ob-line); }
    [data-layout="columns"] .battery-name { margin-bottom: 7px; }
    [data-layout="columns"] .battery-reading { margin-top: auto; }
    [data-layout="columns"] .battery-meter { margin-top: 10px; }
    [data-layout="stacked"] .battery-list { grid-template-columns: minmax(0, 1fr); gap: 21px; }
    [data-layout="stacked"] .battery-item { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: baseline; gap: 7px 12px; }
    [data-layout="stacked"] .battery-name { color: var(--primary-text-color, #17202c); font-size: 14px; }
    [data-layout="stacked"] .battery-reading { justify-content: flex-end; max-width: 100px; }
    [data-layout="stacked"] .battery-soc { font-size: 15px; font-weight: 500; }
    [data-layout="stacked"] .battery-meter { grid-column: 1 / -1; }
    .compact-header { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: 12px; margin-bottom: 17px; }
    .compact-title { min-width: 0; }
    .compact-title h2 { margin-bottom: 3px; }
    .compact-header .system-reading { justify-content: flex-end; max-width: 108px; }
    [data-layout="compact"] .battery-list { grid-template-columns: minmax(0, 1fr); gap: 13px; padding-top: 17px; }
    [data-layout="compact"] .battery-item { display: grid; grid-template-columns: minmax(0, 1fr) minmax(30px, 1.6fr) minmax(40px, auto); align-items: center; gap: 12px; }
    [data-layout="compact"] .battery-name { color: var(--primary-text-color, #17202c); font-size: 13px; }
    [data-layout="compact"] .battery-meter { grid-column: 2; grid-row: 1; }
    [data-layout="compact"] .battery-reading { grid-column: 3; grid-row: 1; justify-content: flex-end; max-width: 76px; }
    [data-layout="compact"] .battery-soc { font-size: 14px; font-weight: 500; }
    .empty { margin: 0; border-top: 1px solid var(--ob-line); padding-top: 17px; color: var(--ob-secondary); font-size: 13px; line-height: 1.6; }
    @container (max-width: 350px) {
      .system-summary { grid-template-columns: 46px minmax(0, 1fr); gap: 11px; }
      .system-icon { width: 46px; height: 46px; }
      .system-icon svg { width: 26px; height: 26px; }
      .system-heading { gap: 3px 7px; }
      .stored { font-size: 11px; }
      [data-layout="columns"] .battery-list { column-gap: 20px; }
      [data-layout="columns"] .battery-item:not(.first-column)::before { left: -10px; }
      [data-layout="compact"] .battery-item { gap: 9px; }
    }
  `];

  protected render() {
    const s = this.snapshot;
    const layout: Layout = this.config.layout ?? 'columns';
    const count = s.batteries.length;
    const columns = Math.max(1, Math.min(3, count));
    const soc = this.percentage(s.soc.value);
    const stored = `${this.format(s.stored.value, '', 2)} / ${this.format(s.capacity.value, '', 2)} kWh`;
    const energyEntity = s.stored.entityId ?? s.capacity.entityId;
    const reading = html`<div class="system-reading">
      ${this.value(this.format(soc, '%', 0), s.soc.entityId, 'system-soc', 'System charge level')}
      ${soc === null ? html`<span class="unavailable">Unavailable</span>` : nothing}
    </div>`;
    return html`<ha-card data-layout=${layout}>
      ${layout === 'compact' ? html`
        <div class="compact-header">
          <div class="compact-title"><h2>${this.config.title || 'System battery'}</h2>
            ${this.value(stored, energyEntity, 'stored', 'System stored energy / capacity')}
          </div>
          ${reading}
        </div>` : this.renderHeader('System battery', `${count} ${count === 1 ? 'battery' : 'batteries'}`)}
      ${this.renderNotice()}
      ${layout !== 'compact' ? html`
        <div class="system-summary">
          <span class="system-icon" aria-hidden="true">${icon('battery')}</span>
          <div class="system-values">
            <div class="system-heading">${reading}${this.value(stored, energyEntity, 'stored', 'System stored energy / capacity')}</div>
            ${this.meter(soc, 'System charge level', 'system-meter')}
          </div>
        </div>` : nothing}
      ${count ? html`<ul class="battery-list" style=${`--battery-columns: ${columns}`} aria-label="Individual battery charge levels">
        ${s.batteries.map((battery, index) => this.battery(battery, index % columns === 0))}
      </ul>` : html`<p class="empty">No battery charge-level sensors were found. Check Omnibattery or select another installation.</p>`}
    </ha-card>`;
  }

  private battery(battery: BatteryModel, firstColumn: boolean) {
    const soc = this.percentage(battery.soc.value);
    return html`<li class=${`battery-item${firstColumn ? ' first-column' : ''}`} data-battery-id=${battery.id}>
      <span class="battery-name">${battery.name}</span>
      <div class="battery-reading">
        ${this.value(this.format(soc, '%', 0), battery.soc.entityId, 'battery-soc', `${battery.name} charge level`)}
        ${soc === null ? html`<span class="unavailable">Unavailable</span>` : nothing}
      </div>
      ${this.meter(soc, `${battery.name} charge level`, 'battery-meter')}
    </li>`;
  }

  private meter(value: number | null, description: string, className: string) {
    if (value === null) return html`<div class=${`meter ${className} is-unavailable`} role="img" aria-label=${`${description}: unavailable`} data-available="false"><div class="meter-fill" style="width: 0%"></div></div>`;
    const fill = Math.min(100, Math.max(0, value));
    return html`<div class=${`meter ${className}`} role="meter" aria-label=${description} aria-valuemin="0" aria-valuemax="100" aria-valuenow=${fill} aria-valuetext=${this.format(value, '%', 0)} data-available="true"><div class="meter-fill" style=${`width: ${fill}%`}></div></div>`;
  }

  private percentage(value: Metric['value']) { return value !== null && Number.isFinite(value) ? value : null; }

  private value(label: string, entityId: string | undefined, className: string, description: string): TemplateResult {
    const accessible = `${description}: ${label === '—' ? 'unavailable' : label}`;
    return entityId && /^(sensor|binary_sensor)\./.test(entityId)
      ? html`<button class=${className} aria-label=${`${accessible}. Show details`} @click=${() => this.moreInfo(entityId)}>${label}</button>`
      : html`<span class=${className} aria-label=${accessible}>${label}</span>`;
  }
}
