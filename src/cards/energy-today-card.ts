import { css, html, nothing } from 'lit';
import { BaseCard } from '../base-card';
import { remainingToday } from '../data/energy-today';
import type { Metric } from '../types';

interface EnergyRow { label: string; metric: Metric; color: string; forecast?: boolean; }

export class OmnibatteryEnergyTodayCard extends BaseCard {
  static getStubConfig() { return { type:'custom:omnibattery-energy-today-card' }; }
  getCardSize() { return this.config.show_forecasts === false ? 5 : 7; }
  static styles = [BaseCard.styles, css`
    .rows { display:grid; gap:16px; }
    .row { min-width:0; }
    .reading { display:flex; justify-content:space-between; align-items:baseline; gap:12px; margin-bottom:7px; }
    .label { color:var(--ob-secondary); overflow-wrap:anywhere; }
    .value { font-size:var(--ob-value-size,14px); font-weight:600; font-variant-numeric:tabular-nums; white-space:nowrap; }
    button.value { border:0; padding:0; background:transparent; cursor:pointer; font:inherit; font-size:var(--ob-value-size,14px); font-weight:600; }
    button.value:hover { text-decoration:underline; text-underline-offset:3px; }
    .unit { font-size:12px; font-weight:400; color:var(--ob-secondary); margin-left:3px; }
    .track { height:9px; overflow:hidden; border-radius:999px; background:var(--ob-subtle); }
    .fill { height:100%; border-radius:inherit; background:var(--row-color); }
    .forecast .fill { opacity:.55; }
    .forecast-start { border-top:1px solid var(--ob-line); padding-top:16px; }
    .tag { font-size:10px; color:var(--ob-secondary); margin-left:6px; }
    .footnote { color:var(--ob-secondary); font-size:11px; margin:16px 0 0; }
    .unknown .track { border:1px dashed var(--ob-line); background:transparent; }
    @container (max-width:350px) { .rows { gap:14px; } .reading { font-size: var(--ob-value-size, 13px); gap:8px; } }
  `];
  protected renderContent() {
    const s = this.snapshot, d = s.daily, remaining = remainingToday(s.timeline);
    const nonnegative = (m:Metric):Metric => ({...m,value:m.value !== null && m.value >= 0 ? m.value : null});
    const rows:EnergyRow[] = [
      {label:'Charged',metric:nonnegative(d.charge),color:'var(--ob-charge)'},
      {label:'Discharged',metric:nonnegative(d.discharge),color:'var(--ob-battery)'},
      {label:'Solar',metric:nonnegative(d.solar),color:'var(--ob-solar)'},
      {label:'Home',metric:nonnegative(d.home),color:'var(--ob-home)'},
      {label:'Grid imported',metric:nonnegative(d.gridImport),color:'var(--ob-grid)'},
      {label:'Grid exported',metric:nonnegative(d.gridExport),color:'var(--ob-export)'},
    ];
    const showForecasts = this.config.show_forecasts !== false;
    if (showForecasts) rows.push(
      {label:'Solar remaining',metric:{value:remaining.solar},color:'var(--ob-solar)',forecast:true},
      {label:'Expected consumption',metric:{value:d.home.value !== null && d.home.value >= 0 && remaining.home !== null ? d.home.value + remaining.home : null},color:'var(--ob-home)',forecast:true},
    );
    const maximum = Math.max(0,...rows.map(row=>row.metric.value??0));
    return html`<ha-card>${this.renderHeader('Energy today','kWh')}
      ${s.error ? html`<div class="notice error" role="status">${s.error}</div>` : nothing}
      <div class="rows">${rows.map((row,index)=>{
        const value=row.metric.value, text=this.format(value,'kWh',2);
        const reading=html`${this.format(value,'',2)}${value===null ? nothing : html`<span class="unit">kWh</span>`}`;
        return html`<div class=${`row ${row.forecast?'forecast':''} ${index===6?'forecast-start':''} ${value===null?'unknown':''}`} style=${`--row-color:${row.color}`}>
          <div class="reading"><span class="label">${row.label}${row.forecast ? html`<span class="tag">Forecast</span>` : nothing}</span>
            ${row.metric.entityId ? html`<button class="value" aria-label=${`${row.label}: ${text}. Show details`} @click=${()=>this.moreInfo(row.metric.entityId)}>${reading}</button>` : html`<span class="value">${reading}</span>`}
          </div>
          ${value===null ? html`<div class="track" role="img" aria-label=${`${row.label}: unavailable`}></div>` : html`<div class="track" role="meter" aria-label=${row.label} aria-valuemin="0" aria-valuemax=${maximum||1} aria-valuenow=${value} aria-valuetext=${text}><div class="fill" style=${`width:${maximum?value/maximum*100:0}%`}></div></div>`}
        </div>`;
      })}</div>
      <p class="footnote">Shared scale${maximum>0 ? ` · ${this.format(maximum,'kWh',2)}` : ''}${showForecasts ? html`<br>Expected consumption = home so far + forecast remaining.${remaining.solar===null||remaining.home===null ? html`<br>Forecast unavailable or incomplete.` : nothing}` : nothing}</p>
    </ha-card>`;
  }
}
