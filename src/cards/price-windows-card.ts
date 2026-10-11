import { css, html, svg } from 'lit';
import { BaseCard } from '../base-card';
import { priceWindows, type PriceWindow } from '../data/insights';
import { insightStyles } from './insight-styles';

export class OmnibatteryPriceWindowsCard extends BaseCard {
  static styles = [BaseCard.styles, insightStyles, css`
    .window { padding:9px 12px; margin-top:8px; border-radius:6px; background:color-mix(in srgb,var(--ob-price) 9%,transparent); }
    .window.low { background:color-mix(in srgb,var(--ob-battery) 9%,transparent); }
    .window-label { font-size:12px; font-weight:600; }
    .window-values { display:flex; justify-content:space-between; flex-wrap:wrap; gap:4px 12px; font-size:14px; }
    .window-values strong { font-size:17px; }
  `];
  static getStubConfig() { return { type: 'custom:omnibattery-price-windows-card' }; }
  private time(stamp: number, date = false) {
    return new Intl.DateTimeFormat(this.hass.locale?.language || 'en', { timeZone:this.hass.config?.time_zone || 'UTC', hour:'2-digit', minute:'2-digit', ...(date ? {month:'short',day:'numeric'} as const : {}) }).format(stamp);
  }
  private price(value: number | null) {
    const series = this.snapshot.importPrices;
    // Preserve the source's unit: never silently reinterpret MWh or cents as EUR/kWh.
    if (value === null) return '—';
    if (series?.currency && series.unit === `${series.currency}/kWh`) {
      try { return new Intl.NumberFormat(this.hass.locale?.language || 'en', { style:'currency', currency:series.currency, minimumFractionDigits:2, maximumFractionDigits:3 }).format(value); } catch { /* use source unit */ }
    }
    return this.format(value, '', 3);
  }
  private day(stamp: number) { return new Intl.DateTimeFormat('en-CA', {timeZone:this.hass.config?.time_zone || 'UTC',year:'numeric',month:'2-digit',day:'2-digit'}).format(stamp); }
  private windowRow(label: string, window: PriceWindow | undefined, low = false) {
    return html`<div class=${`window ${low ? 'low' : ''}`}><div class="window-label">${label}</div><div class="window-values"><span>${window ? `${this.time(window.start, this.day(window.start)!==this.day(Date.now()))} – ${this.time(window.end, this.day(window.end)!==this.day(Date.now()))}` : 'No complete 2-hour window'}</span>${window ? html`<strong class=${low ? 'teal' : 'purple'}>${this.price(window.value)} <small>${this.unit()}</small></strong>` : ''}</div></div>`;
  }
  private unit() {
    const s = this.snapshot.importPrices;
    return s?.currency && s.unit === `${s.currency}/kWh` ? '/ kWh' : s?.unit ?? '';
  }
  render() {
    const series = this.snapshot.importPrices, now = Date.now();
    const { current, low, high } = priceWindows(series, now);
    const zone = this.hass.config?.time_zone || 'UTC';
    const dateKey = (stamp:number) => new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).format(stamp);
    const today = dateKey(now);
    const points = (series?.points ?? []).filter(p => dateKey(Date.parse(p.start)) === today);
    const start = points.length ? Date.parse(points[0].start) : now, end = points.length ? Date.parse(points.at(-1)!.end) : now+86400000;
    const min = Math.min(0,...points.map(p=>p.value)), max = Math.max(0.01,...points.map(p=>p.value));
    const x = (t:number) => 36+(t-start)/(end-start)*350, y = (v:number) => 116-(v-min)/(max-min)*100;
    return html`<ha-card>${this.renderHeader('Price windows','Today')}
      <div class="hero purple">${this.price(current)} <span class="hero-unit">${this.unit()}</span></div><div class="caption muted">Import price now</div>
      ${series ? html`<svg class="chart" viewBox="0 0 410 145" role="img" aria-label="Today's import prices; negative prices extend below zero">
        ${[0,1,2,3].map(i=>{const v=min+(max-min)*i/3;return svg`<line class="gridline" x1="36" x2="386" y1=${y(v)} y2=${y(v)}/><text x="30" y=${y(v)+4} text-anchor="end">${this.format(v,'',2)}</text>`;})}
        ${points.map(p=>svg`<rect x=${x(Date.parse(p.start))+1} y=${Math.min(y(0),y(p.value))} width=${Math.max(0.5,x(Date.parse(p.end))-x(Date.parse(p.start))-2)} height=${Math.max(1,Math.abs(y(p.value)-y(0)))} fill="var(--ob-price)"><title>${this.time(Date.parse(p.start),true)}: ${p.value} ${series.unit}</title></rect>`)}
        <line class="gridline" x1="36" x2="386" y1=${y(0)} y2=${y(0)}/>
        ${[0,1,2,3,4].map(i=>svg`<text x=${36+i*87.5} y="140" text-anchor="middle">${this.time(start+(end-start)*i/4)}</text>`)}
        ${now>=start&&now<=end ? svg`<line x1=${x(now)} x2=${x(now)} y1="12" y2="118" stroke="var(--ob-secondary)" stroke-dasharray="3 3"/>` : ''}
      </svg>` : html`<div class="empty">Select an import price entity with timestamped prices.</div>`}
      ${this.windowRow('Lowest 2-hour window',low,true)}${this.windowRow('Highest 2-hour window',high)}
      <div class="footnote">${series?.points.some(p=>Date.parse(p.start)>now&&dateKey(Date.parse(p.start))!==today) ? 'Upcoming windows · Includes tomorrow' : 'Upcoming windows · Tomorrow prices not published'}</div>
    </ha-card>`;
  }
}
