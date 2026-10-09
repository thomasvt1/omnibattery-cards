import { css, html, nothing } from 'lit';
import { BaseCard } from '../base-card';
import { icon } from '../ui';
import type { Metric } from '../types';

export class OmnibatteryBatteryCard extends BaseCard {
  static getStubConfig() { return { type: 'custom:omnibattery-battery-card' }; }

  getCardSize() {
    if (!this.config) return 6;
    const batteries = this.snapshot.batteries;
    const battery = this.config.battery ? batteries.find(item => item.id === this.config.battery) : batteries[0];
    const compact = this.clientWidth && this.clientWidth <= 450;
    return battery?.health.length ? compact ? 6 : 7 : compact ? 5 : 6;
  }

  static styles = [BaseCard.styles, css`
    .content { padding: 0; }
    .charge { display: grid; grid-template-columns: 43px minmax(0, 1fr); align-items: center; gap: 12px; margin: 6px 0 21px; }
    .battery-disc { display: grid; place-items: center; width: 43px; height: 43px; color: var(--ob-battery, #009d91); background: color-mix(in srgb, var(--ob-battery, #009d91) 11%, transparent); border-radius: 50%; }
    .battery-disc svg { width: 25px; height: 25px; }
    .charge-heading { display: flex; align-items: baseline; justify-content: space-between; flex-wrap: wrap; gap: 2px 10px; margin-bottom: 7px; }
    .soc { font-size: 21px; line-height: 1.3; font-weight: 600; color: var(--primary-text-color, #17202c); }
    .stored { color: var(--secondary-text-color, #646b75); font-size: 12px; line-height: 1.5; }
    .meter { height: 9px; border-radius: 5px; background: var(--disabled-color, #dce1e6); overflow: hidden; }
    .meter-fill { height: 100%; background: var(--ob-battery, #009d91); border-radius: inherit; }
    .meter-unknown { color: var(--secondary-text-color, #646b75); font-size: 12px; line-height: 1.5; }
    .metrics { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); column-gap: 18px; border-top: 1px solid var(--divider-color, #e6e8ec); padding-top: 16px; }
    .instant { display: grid; gap: 14px; }
    .metric { display: flex; flex-direction: column; align-items: flex-start; gap: 2px; min-width: 0; }
    .metric-label { font-size: 12px; line-height: 1.5; color: var(--secondary-text-color, #646b75); }
    .metric-value { font-size: 17px; line-height: 1.5; font-weight: 600; color: var(--primary-text-color, #17202c); }
    .today { border-left: 1px solid var(--divider-color, #e6e8ec); padding-left: 18px; }
    h3 { margin: 0 0 8px; font-size: 13px; line-height: 1.5; font-weight: 600; color: var(--primary-text-color, #17202c); }
    .daily { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: 3px 8px; margin-top: 8px; font-size: 12px; line-height: 1.5; }
    .daily-label { color: var(--secondary-text-color, #646b75); }
    .daily-value { color: var(--primary-text-color, #17202c); font-weight: 500; white-space: nowrap; }
    button { padding: 0; border: 0; border-radius: 3px; background: transparent; text-align: left; font: inherit; cursor: pointer; }
    button:hover { text-decoration: underline; text-underline-offset: 3px; }
    button:focus-visible, summary:focus-visible { outline: 2px solid var(--primary-color, #03a9f4); outline-offset: 4px; }
    .soc, .stored, .metric-value, .daily-value, .health-value { font-variant-numeric: tabular-nums; }
    .ac { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 2px 10px; margin-top: 16px; font-size: 12px; line-height: 1.5; color: var(--secondary-text-color, #646b75); }
    .ac button { color: inherit; }
    .unavailable { display: flex; gap: 7px; align-items: flex-start; margin: 0 0 12px; color: var(--warning-color, #8f6900); font-size: 12px; line-height: 1.5; }
    .unavailable svg { flex: none; width: 17px; height: 17px; margin-top: 1px; }
    .empty { color: var(--secondary-text-color, #646b75); font-size: 14px; line-height: 1.6; margin: 0; padding: 7px 0; }
    details { margin-top: 16px; border-top: 1px solid var(--divider-color, #e6e8ec); padding-top: 11px; }
    summary { cursor: pointer; color: var(--secondary-text-color, #646b75); font-size: 12px; line-height: 1.6; border-radius: 3px; }
    summary:hover { color: var(--primary-text-color, #17202c); }
    .health { display: grid; gap: 7px; margin-top: 11px; }
    .health-row { display: flex; justify-content: space-between; flex-wrap: wrap; gap: 3px 12px; font-size: 12px; line-height: 1.5; color: var(--secondary-text-color, #646b75); }
    .health-value { color: var(--primary-text-color, #17202c); }
    @container (max-width: 450px) {
      .charge { margin-bottom: 16px; gap: 10px; }
      .metrics { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1.4fr); column-gap: 11px; padding-top: 14px; }
      .metrics.no-temperature { grid-template-columns: minmax(0, 1fr) minmax(0, 1.4fr); }
      .instant { display: contents; }
      .instant > .metric + .metric { border-left: 1px solid var(--divider-color, #e6e8ec); padding-left: 11px; }
      .metric-label { font-size: 11px; }
      .metric-value { font-size: 15px; }
      .today { padding-left: 11px; min-width: 0; }
      h3 { font-size: 12px; margin-bottom: 4px; }
      .daily { font-size: 11px; margin-top: 4px; gap: 0 5px; }
      .daily-value { margin-left: auto; }
      .ac { margin-top: 14px; font-size: 11px; }
      details { margin-top: 13px; padding-top: 10px; }
    }
    @container (max-width: 350px) {
      .metrics { column-gap: 8px; }
      .instant > .metric + .metric, .today { padding-left: 8px; }
      .stored { font-size: 11px; }
    }
  `];

  protected render() {
    const s = this.snapshot;
    const battery = this.config.battery ? s.batteries.find(item => item.id === this.config.battery) : s.batteries[0];
    if (!battery) return html`<ha-card>${this.renderHeader('Battery')}${this.renderNotice()}<div class="content"><p class="empty">${this.config.battery ? 'The selected battery is unavailable. Choose a battery in the card configuration.' : 'No battery was found. Check the Omnibattery integration or select a battery in the card configuration.'}</p></div></ha-card>`;
    const cellPower = battery.cellPower.value;
    const action = cellPower === null ? 'Cell power' : cellPower > 0 ? 'Cell charging' : cellPower < 0 ? 'Cell discharging' : 'Cell power · idle';
    const acPower = battery.acPower.value;
    const acAction = acPower === null ? 'AC exchange' : acPower > 0 ? 'AC charging' : acPower < 0 ? 'AC discharging' : 'AC exchange';
    const soc = battery.soc.value;
    const stored = battery.stored.value !== null || battery.capacity.value !== null
      ? `${this.format(battery.stored.value, 'kWh', 2)} / ${this.format(battery.capacity.value, 'kWh', 2)}` : undefined;
    return html`
      <ha-card>
        ${this.renderHeader(battery.name || 'Battery', battery.model && battery.model !== battery.name ? battery.model : undefined)}
        ${this.renderNotice()}
        <div class="content">
          ${!battery.available ? html`<div class="unavailable">${icon('warning')}<span>Battery unavailable. Live readings may be missing.</span></div>` : nothing}
          <div class="charge">
            <span class="battery-disc" aria-hidden="true">${icon('battery')}</span>
            <div>
              <div class="charge-heading">
                ${this.value(this.format(soc, '%', 0), battery.soc.entityId, 'soc', 'Charge level')}
                ${stored ? this.value(stored, battery.stored.entityId, 'stored', 'Stored energy / capacity') : nothing}
              </div>
              ${soc !== null ? html`<div class="meter" role="meter" aria-label="Battery charge level" aria-valuemin="0" aria-valuemax="100" aria-valuenow=${Math.max(0, Math.min(100, soc))} aria-valuetext=${this.format(soc, '%', 0)}><div class="meter-fill" style=${`width: ${Math.max(0, Math.min(100, soc))}%`}></div></div>` : html`<div class="meter-unknown">Charge level unavailable</div>`}
            </div>
          </div>
          <div class=${`metrics${battery.temperature.value === null ? ' no-temperature' : ''}`}>
            <div class="instant">
              ${this.metric(action, battery.cellPower, 'W', true)}
              ${battery.temperature.value !== null ? this.metric('Temperature', battery.temperature, '°C') : nothing}
            </div>
            <div class="today">
              <h3>Today</h3>
              ${this.dailyMetric('Charged', battery.dailyCharge)}
              ${this.dailyMetric('Discharged', battery.dailyDischarge)}
            </div>
          </div>
          ${acPower !== null ? html`<div class="ac"><span>${acAction}</span>${this.value(this.format(Math.abs(acPower), 'W'), battery.acPower.entityId, '', acAction)}</div>` : nothing}
          ${battery.health.length ? html`<details><summary>Battery health</summary><div class="health">${battery.health.map(health => html`<div class="health-row"><span>${health.label}</span>${this.value(this.format(health.value, health.unit, 1), health.entityId, 'health-value', health.label)}</div>`)}</div></details>` : nothing}
        </div>
      </ha-card>`;
  }

  private metric(label: string, metric: Metric, unit: string, absolute = false) {
    const value = absolute && metric.value !== null ? Math.abs(metric.value) : metric.value;
    return html`<div class="metric"><span class="metric-label">${label}</span>${this.value(this.format(value, unit), metric.entityId, 'metric-value', label)}</div>`;
  }

  private dailyMetric(label: string, metric: Metric) {
    return html`<div class="daily"><span class="daily-label">${label}</span>${this.value(this.format(metric.value, 'kWh', 1), metric.entityId, 'daily-value', `${label} today`)}</div>`;
  }

  private value(label: string, entityId: string | undefined, className: string, description: string) {
    return entityId && /^(sensor|binary_sensor)\./.test(entityId)
      ? html`<button class=${className} aria-label=${`${description}: ${label}. Show details`} @click=${() => this.moreInfo(entityId)}>${label}</button>`
      : html`<span class=${className} aria-label=${`${description}: ${label}`}>${label}</span>`;
  }
}
