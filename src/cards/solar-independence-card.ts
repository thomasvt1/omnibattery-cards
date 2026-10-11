import { css, html, nothing } from 'lit';
import { BaseCard } from '../base-card';
import { icon } from '../ui';
import { metric } from '../data/values';
import { retainedShare } from '../data/insights';
import { insightStyles } from './insight-styles';

export class OmnibatterySolarIndependenceCard extends BaseCard {
  static styles = [BaseCard.styles, insightStyles, css`
    .summary { display:flex; align-items:center; justify-content:space-between; gap:12px; }
    .donut { width:100px; height:100px; flex-shrink:0; position:relative; border-radius:50%; }
    .donut::before { content:''; position:absolute; inset:18px; border-radius:50%; background:var(--ha-card-background,var(--card-background-color,#fff)); }
    .donut .icon { position:absolute; top:39px; left:39px; }
    .bar { display:flex; height:26px; border-radius:5px; overflow:hidden; margin-top:20px; background:var(--ob-subtle); }
    .bar span { display:flex; align-items:center; justify-content:center; font-size:11px; font-weight:600; color:#fff; }
    .totals { display:flex; justify-content:space-between; flex-wrap:wrap; gap:6px; font-size:12px; margin:8px 0 12px; }
    .row { display:flex; align-items:center; gap:12px; padding:6px 0; border-top:1px solid var(--ob-line); }
    .row strong { margin-left:auto; white-space:nowrap; }
  `];
  static getStubConfig() { return { type: 'custom:omnibattery-solar-independence-card' }; }
  render() {
    const d = this.snapshot.daily;
    const source = this.config.entities?.dailyGridToHome;
    const gridHome = source ? metric(this.hass.states[source], 'energy').value : this.config.assume_no_grid_charging ? d.gridImport.value : null;
    const share = retainedShare(d.home.value, gridHome);
    const solarShare = this.config.assume_solar_only_export ? retainedShare(d.solar.value, d.gridExport.value) : null;
    return html`<ha-card>${this.renderHeader('Solar independence', 'Today')}
      <div class="summary"><div><div class="hero teal">${this.format(share, '%', 0)}</div><div class="caption">Self-sufficiency${!source && this.config.assume_no_grid_charging ? '*' : ''}</div></div>
      <div class="donut" role="img" aria-label=${share === null ? 'Self-sufficiency unavailable' : `${this.format(share, '%', 0)} supplied without grid import`}
        style=${`background:${share === null ? 'var(--ob-subtle)' : `conic-gradient(var(--ob-grid) 0% ${100-share}%,var(--ob-battery) ${100-share}% 100%)`}`}>${icon('home')}</div></div>
      <div class="footnote">Share of home use supplied without grid import</div>
      <div class="bar" aria-hidden="true">${share === null ? nothing : html`<span style=${`width:${share}%;background:var(--ob-battery)`}>${share >= 12 ? this.format(share, '%', 0) : ''}</span><span style=${`width:${100-share}%;background:var(--ob-grid)`}>${share <= 88 ? this.format(100-share, '%', 0) : ''}</span>`}</div>
      <div class="totals"><span>Home use <strong>${this.format(d.home.value, 'kWh')}</strong></span><span>Grid import <strong>${this.format(d.gridImport.value, 'kWh')}</strong></span></div>
      <div class="row"><span class="amber">${icon('sun')}</span><span>Solar generated</span><strong>${this.format(d.solar.value, 'kWh')}</strong></div>
      <div class="row"><span style="color:var(--ob-grid)">${icon('grid')}</span><span>Grid export</span><strong>${this.format(d.gridExport.value, 'kWh')}</strong></div>
      <div class="row"><span class="amber">${icon('chart')}</span><span>Solar retained on site${this.config.assume_solar_only_export ? '*' : ''}</span><strong>${this.format(solarShare, '%', 0)}</strong></div>
      <div class="footnote">${!source && !this.config.assume_no_grid_charging ? 'Select grid-to-home daily energy or confirm no grid charging in the editor.' : !source ? '*Assumes no grid charging. ' : ''}${this.config.assume_solar_only_export ? '*Assumes solar-only export.' : ' Solar retention requires solar-only export.'}</div>
    </ha-card>`;
  }
}
