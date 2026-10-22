import { css, html, nothing } from 'lit';
import { BaseCard } from '../base-card';
import { operationAdvice, operationHomeEnergy, operationPrice } from '../data/daily-operation';
import type { TimelineSlot } from '../types';

export class OmnibatteryDailyOperationCard extends BaseCard {
  static properties = { fullDay: { state:true } };
  private fullDay = false;
  static getStubConfig() { return {type:'custom:omnibattery-daily-operation-card'}; }
  getCardSize() { return 11; }
  getGridOptions() { return {columns:12, rows:'auto', min_columns:12, min_rows:6}; }
  static styles = [BaseCard.styles, css`
    .ob-header { margin-bottom:10px; }
    .toolbar { display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:8px 16px; margin-bottom:16px; }
    .period, .footnote { color:var(--ob-secondary); font-size:12px; }
    .range { display:flex; gap:2px; border-radius:8px; background:var(--ob-subtle); padding:3px; }
    .range button { border:0; background:transparent; border-radius:5px; min-height:36px; padding:5px 12px; font-size:12px; }
    @media (hover:hover) { .range button[aria-pressed]:hover { background:var(--ob-hover,color-mix(in srgb,var(--primary-color,#03a9f4) 8%,transparent)); } }
    .range button[aria-pressed]:active { background:var(--ob-pressed,color-mix(in srgb,var(--primary-color,#03a9f4) 16%,transparent)); }
    .range button[aria-pressed=true] { background:var(--ob-background,var(--ha-card-background,var(--card-background-color,#fff))); box-shadow:0 1px 3px #0001; }
    .table-scroll { overflow:auto; max-height:520px; scrollbar-width:thin; border:1px solid var(--ob-line); border-radius:8px; }
    table { width:100%; min-width:740px; border-collapse:separate; border-spacing:0; font-size:12px; }
    .table-description { color:var(--ob-secondary); font-size:12px; margin:0 0 10px; }
    th, td { padding:10px 12px; text-align:right; border-bottom:1px solid var(--ob-line); white-space:nowrap; }
    thead th { position:sticky; top:0; z-index:2; color:var(--ob-secondary); font-size:10px; text-transform:uppercase; letter-spacing:.6px; background:var(--ob-background,var(--ha-card-background,var(--card-background-color,#fff))); }
    th:first-child, td:first-child { text-align:left; position:sticky; left:0; background:var(--ob-background,var(--ha-card-background,var(--card-background-color,#fff))); z-index:1; }
    thead th:first-child { z-index:3; }
    td:nth-child(2), th:nth-child(2) { text-align:left; }
    tbody tr:last-child td, tbody tr:last-child th { border-bottom:0; }
    .now { background:color-mix(in srgb,var(--ob-price) 9%,transparent); }
    .now th:first-child { box-shadow:inset 3px 0 var(--ob-price); }
    .now-badge { font-size:9px; margin-left:6px; padding:2px 4px; border-radius:3px; color:var(--ob-text); background:var(--ob-subtle); }
    .basis { display:block; font-size:10px; font-weight:400; color:var(--ob-secondary); margin-top:2px; }
    .advice { font-weight:600; }.advice::before { content:''; display:inline-block; width:6px; height:6px; border-radius:2px; background:currentColor; margin-right:6px; }
    .solar { color:var(--ob-solar); }.grid { color:var(--ob-grid); }.discharge { color:var(--ob-battery); }.hold,.neutral { color:var(--ob-secondary); }
    .positive { color:var(--ob-charge); }.negative { color:var(--ob-battery); }
    .energy { font-size:var(--ob-value-size,12px); }
    .meter-value { display:flex; justify-content:flex-end; align-items:center; gap:8px; }
    .charge-level { display:grid; grid-template-columns:40px 5ch auto; justify-content:stretch; }
    .charge-level .stored { text-align:left; margin-left:0; }
    .meter { display:block; width:40px; height:5px; border-radius:3px; background:var(--ob-subtle); overflow:hidden; }
    .meter i { display:block; height:100%; background:var(--ob-soc); border-radius:inherit; }
    .stored { color:var(--ob-secondary); font-size:10px; margin-left:3px; }
    .price { color:var(--ob-price); }.price .meter i { background:var(--ob-price); }
    .footnote { margin:12px 0 0; line-height:1.6; }.footnote p { margin:4px 0; }
    .scroll-hint { display:none; }
    @container (max-width:450px) { table { min-width:680px; } .price .meter { display:none; } }
    @container (max-width:780px) { .scroll-hint { display:block; } th,td { padding:9px 10px; } }
  `];
  protected renderContent() {
    const s=this.snapshot, t=s.timeline;
    if (!t.available) return html`<ha-card>${this.renderHeader('Daily operation')}
      <p class="notice" role="status">${s.error || t.error}</p></ha-card>`;
    const all=t.slots.filter(slot=>this.config.show_extension === true || slot.index<96);
    const start=this.fullDay ? 0 : Math.max(0,t.currentIndex-2);
    const slots=this.fullDay ? all : all.filter(slot=>slot.index>=start).slice(0,26);
    const maxPrice=Math.max(0,...all.map(slot=>Math.abs(operationPrice(slot,s.importPrices)??0)));
    return html`<ha-card>${this.renderHeader('Daily operation','15-minute intervals')}
      <div class="toolbar"><span class="period">${t.localDate} · ${t.timeZone}</span>
        <div class="range" role="group" aria-label="Timeline range">
          <button aria-pressed=${!this.fullDay} @click=${()=>this.changeRange(false)}>Around now</button>
          <button aria-pressed=${this.fullDay} @click=${()=>this.changeRange(true)}>Full day</button>
        </div>
      </div>
      ${t.stale ? html`<p class="notice" role="status">Forecast is out of date. Only recorded values are shown.</p>` : nothing}
      <p class="table-description">Recorded history · Planned values from the current interval onward</p>
      <div class="table-scroll" tabindex="0" role="region" aria-label="Daily operation table. Scroll for more intervals and columns.">
        <table aria-label="Quarter-hour energy and operations">
          <thead><tr><th scope="col">Time</th><th scope="col">Operation</th><th scope="col">Charge level</th><th scope="col">Battery</th><th scope="col">Solar → battery</th><th scope="col">Home</th><th scope="col">Price</th></tr></thead>
          <tbody>${slots.map(slot=>this.row(slot,maxPrice))}</tbody>
        </table>
      </div>
      <div class="footnote"><span class="scroll-hint">Scroll sideways for all columns.</span>
        <p>Battery: + charge / − discharge (net kWh). Plans describe the remaining interval; recorded values describe measured coverage. — means unavailable.</p>
        ${!s.importPrices ? html`<p>Configure an import price sensor to show published tariffs.</p>` : html`<p>Price in ${s.importPrices.unit}; bar length shows absolute price.</p>`}
        ${t.warnings.length ? html`<details><summary>Timeline notes</summary>${t.warnings.map(w=>html`<p>${w}</p>`)}</details>` : nothing}
      </div>
    </ha-card>`;
  }
  private changeRange(fullDay:boolean) {
    this.fullDay=fullDay;
    this.renderRoot.querySelector('.table-scroll')?.scrollTo({top:0,left:0});
  }
  private row(slot:TimelineSlot,maxPrice:number) {
    const t=this.snapshot.timeline, current=slot.index===t.currentIndex && !t.stale;
    const projected=slot.index>=t.currentIndex && !t.stale;
    const advice=operationAdvice(slot,projected);
    const soc=projected ? slot.socForecast : slot.socActual;
    const stored=projected ? slot.storedForecastKwh : null;
    const battery=(projected ? slot.batteryForecastKwh : slot.batteryActualKwh) ?? null;
    const price=operationPrice(slot,this.snapshot.importPrices);
    const home=operationHomeEnergy(slot,projected);
    const coverage=slot.homeCoverageSeconds ?? slot.actualCoverageSeconds;
    const basis=slot.skipped ? 'DST gap' : projected ? (slot.repeated?'Planned · DST ×2':'Planned') : t.stale && slot.index>t.currentIndex ? 'Unavailable' : slot.repeated ? 'Recorded · DST ×2' : coverage !== null && coverage < slot.durationSeconds ? 'Partial record' : 'Recorded';
    return html`<tr class=${current?'now':''} aria-current=${current?'time':nothing}>
      <th scope="row">${slot.index>=96 ? '+1d ' : ''}${slot.label}${current ? html`<span class="now-badge">NOW</span>` : nothing}<span class="basis">${basis}</span></th>
      <td><span class=${`advice ${advice.tone}`}>${advice.label}</span></td>
      <td><div class="meter-value charge-level"><span class="meter" aria-hidden="true"><i style=${`width:${soc??0}%`}></i></span><span>${this.format(soc,'%',0)}</span>${stored != null ? html`<span class="stored">(${this.format(stored,'kWh',2)})</span>` : nothing}</div></td>
      <td class=${`energy ${battery!==null&&battery>0?'positive':battery!==null&&battery<0?'negative':''}`}>${battery!==null&&battery>0?'+':''}${this.format(battery,'kWh',3)}</td>
      <td class="solar energy">${this.format(projected?slot.solarToBatteryForecastKwh??null:null,'kWh',3)}</td>
      <td class="energy">${this.format(home,'kWh',3)}</td>
      <td class="price"><div class="meter-value"><span class="meter" aria-hidden="true"><i style=${`width:${price!==null&&maxPrice?Math.abs(price)/maxPrice*100:0}%`}></i></span>${this.format(price,'',3)}</div></td>
    </tr>`;
  }
}
