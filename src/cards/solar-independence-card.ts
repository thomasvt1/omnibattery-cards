import { css, html, nothing } from 'lit';
import { BaseCard } from '../base-card';
import { icon } from '../ui';
import { retainedShare } from '../data/insights';
import { insightStyles } from './insight-styles';
import { ReadingsCard, readCached } from '../readings-card';
import { loadEnergy, localDay, type EnergyReadings } from '../data/energy-statistics';

export class OmnibatterySolarIndependenceCard extends ReadingsCard<EnergyReadings> {
  static styles = [BaseCard.styles, insightStyles, css`
    .summary { display:flex; align-items:center; justify-content:space-between; gap:12px; }
    .donut { width:100px; height:100px; flex-shrink:0; position:relative; border-radius:50%; }
    .donut::before { content:''; position:absolute; inset:18px; border-radius:50%; background:var(--ob-background, var(--ha-card-background, var(--card-background-color, #fff))); }
    .donut .icon { position:absolute; top:39px; left:39px; }
    .bar { display:flex; height:26px; border-radius:5px; overflow:hidden; margin-top:20px; background:var(--ob-subtle); }
    .bar span { display:flex; align-items:center; justify-content:center; font-size:11px; font-weight:600; color:#fff; }
    .totals { display:flex; justify-content:space-between; flex-wrap:wrap; gap:6px; font-size:12px; margin:8px 0 12px; }
    .row { display:flex; align-items:center; gap:12px; padding:6px 0; border-top:1px solid var(--ob-line); }
    .row strong { margin-left:auto; white-space:nowrap; }
  `];
  static getStubConfig() { return { type: 'custom:omnibattery-solar-independence-card' }; }
  protected loadReadings() {
    return readCached(this.hass, `energy:${localDay(Date.now(), this.hass.config?.time_zone ?? 'UTC')}`, () => loadEnergy(this.hass));
  }
  protected renderContent() {
    const zone = this.hass.config?.time_zone ?? 'UTC';
    const d = this.readings && localDay(this.readings.start, zone) === localDay(Date.now(), zone) ? this.readings : undefined;
    const share = retainedShare(d?.home ?? null, d?.gridToHome ?? null);
    const solarShare = retainedShare(d?.solar ?? null, d?.solarToGrid ?? null);
    const through = d ? new Intl.DateTimeFormat(this.hass.locale?.language || 'en', {timeZone: zone, hour: '2-digit', minute: '2-digit'}).format(d.end) : '';
    return html`<ha-card>${this.renderHeader('Solar independence', d ? `Today · to ${through}` : 'Today')}
      <div class="summary"><div><div class="hero teal">${this.format(share, '%', 0)}</div><div class="caption">Calculated self-sufficiency</div></div>
      <div class="donut" role="img" aria-label=${share === null ? 'Self-sufficiency unavailable' : `${this.format(share, '%', 0)} supplied without grid import`}
        style=${`background:${share === null ? 'var(--ob-subtle)' : `conic-gradient(var(--ob-grid) 0% ${100-share}%,var(--ob-battery) ${100-share}% 100%)`}`}>${icon('home')}</div></div>
      <div class="footnote">Share of home use supplied by solar and battery</div>
      <div class="bar" aria-hidden="true">${share === null ? nothing : html`<span style=${`width:${share}%;background:var(--ob-battery)`}>${share >= 12 ? this.format(share, '%', 0) : ''}</span><span style=${`width:${100-share}%;background:var(--ob-grid)`}>${share <= 88 ? this.format(100-share, '%', 0) : ''}</span>`}</div>
      <div class="totals"><span>Home use <strong>${this.format(d?.home ?? null, 'kWh')}</strong></span><span>Grid import <strong>${this.format(d?.gridImport ?? null, 'kWh')}</strong></span></div>
      <div class="row"><span class="amber">${icon('sun')}</span><span>Solar generated</span><strong>${this.format(d?.solar ?? null, 'kWh')}</strong></div>
      <div class="row"><span style="color:var(--ob-grid)">${icon('grid')}</span><span>Grid export</span><strong>${this.format(d?.gridExport ?? null, 'kWh')}</strong></div>
      <div class="row"><span class="amber">${icon('chart')}</span><span>Calculated solar retained</span><strong>${this.format(solarShare, '%', 0)}</strong></div>
      <div class="footnote" role="status">${d
        ? `Energy dashboard statistics. Flow allocation is estimated; battery discharge may include previously imported energy.${d.missing ? ` ${d.missing} incomplete intervals excluded.` : ''}`
        : this.readingsError || 'Loading Energy dashboard statistics…'}</div>
      <div class="footnote"><a href="/config/energy/electricity">Energy settings</a></div>
    </ha-card>`;
  }
}
