import { css, html, svg } from 'lit';
import { BaseCard } from '../base-card';
import { forecastAccuracy, type AccuracyPoint } from '../data/insights';
import { insightStyles } from './insight-styles';
import { companionSetup } from '../companion';
import { ReadingsCard, readCached } from '../readings-card';
import { localDay } from '../data/energy-statistics';
import type { HassEntity } from '../types';

interface Recording { timeline: string; legacy_entity_ids: string[]; forecast: Record<string, unknown>; }

export class OmnibatteryForecastAccuracyCard extends ReadingsCard<Recording[]> {
  static styles = [BaseCard.styles, insightStyles, css`
    .legend { display:flex; justify-content:center; gap:22px; font-size:12px; margin-top:18px; }
    .legend span { display:flex; align-items:center; gap:7px; }
    .sample { width:25px; border-top:2px solid var(--ob-solar); } .sample.saved { border-top:2px dashed var(--ob-secondary); }
    svg.chart { height:160px; margin-top:6px; }
  `];
  static getStubConfig() { return { type: 'custom:omnibattery-forecast-accuracy-card' }; }
  protected loadReadings() {
    return readCached(this.hass, `recordings:${localDay(Date.now(), this.hass.config?.time_zone ?? 'UTC')}`, async () => {
      if (!this.hass.callWS) throw new Error('Recording connection unavailable.');
      return this.hass.callWS<Recording[]>({type: 'omnibattery_cards/recordings'});
    });
  }
  private time(stamp:number) { return new Intl.DateTimeFormat(this.hass.locale?.language || 'en',{timeZone:this.hass.config?.time_zone || 'UTC',hour:'2-digit',minute:'2-digit'}).format(stamp); }
  protected renderContent() {
    const metric = this.config.forecast_metric ?? 'solar';
    const sources = this.snapshot.insightSources;
    const explicit = this.config.saved_forecast_entity;
    const matches = (this.readings ?? []).filter(r => explicit
      ? r.legacy_entity_ids.includes(explicit) : r.timeline === this.snapshot.timeline.entityId);
    const internal = matches.length === 1 ? matches[0] : undefined;
    const entity: HassEntity | undefined = internal ? {entity_id: '', state: 'recorded', attributes: internal.forecast} : sources.savedForecast;
    const result = forecastAccuracy(entity, this.snapshot.timeline, metric, Date.now());
    if (!internal && sources.savedForecastError) result.error = sources.savedForecastError;
    else if (!entity && explicit) result.error = 'Select an available saved forecast entity.';
    else if (!entity) result.error = this.readingsError
      ? 'Set up Omnibattery Cards recordings to save future forecasts internally.'
      : 'No internal forecast recording found for this timeline. Configure recordings for this installation.';
    if (internal && (!internal.forecast.saved_at || result.error === 'No complete matching intervals yet.'))
      result.error = 'Recording forecasts. The first comparison appears after a saved interval has been fully measured.';
    const points = result.points;
    const delta = result.measured-result.forecast;
    const start = points[0]?.start ?? 0, end = points.at(-1)?.end ?? 1;
    const max = Math.max(1,...points.flatMap(p=>[p.measured,p.forecast]));
    const x = (t:number) => 32+(t-start)/(end-start)*354, y=(v:number)=>120-v/max*100;
    const path = (key:'measured'|'forecast') => points.map((p,i)=>`${i&&points[i-1].end===p.start?'L':'M'}${x(p.start)},${y(p[key])}L${x(p.end)},${y(p[key])}`).join(' ');
    const groups:AccuracyPoint[][]=[];
    for(const p of points) { if(groups.at(-1)?.at(-1)?.end!==p.start)groups.push([]);groups.at(-1)!.push(p); }
    return html`<ha-card>${this.renderHeader('Forecast accuracy',points.length ? `Today · to ${this.time(end)}` : 'Today')}
      <div class="hero amber">${result.error ? '—' : `${delta>0?'+':delta<0?'−':''}${this.format(Math.abs(delta),'kWh')}`}</div>
      <div class="caption muted">${metric==='solar'?'Solar':'Consumption'} vs saved forecast</div>
      ${result.error ? html`<div class="empty" role="status">${result.error}</div>` : html`
      <div class="legend"><span><i class="sample"></i>Measured</span><span><i class="sample saved"></i>Saved forecast</span></div>
      <svg class="chart" viewBox="0 0 410 150" role="img" aria-label=${`${metric} power in kW: measured compared with saved forecast; gaps are excluded`}>
        ${[0,1,2,3,4].map(i=>svg`<line class="gridline" x1="32" x2="386" y1=${y(max*i/4)} y2=${y(max*i/4)}/><text x="25" y=${y(max*i/4)+4} text-anchor="end">${this.format(max*i/4,'',1)}</text>`)}
        <text x="8" y="12">kW</text>
        ${groups.map(g=>svg`<path d=${`M${x(g[0].start)},120 ${g.map(p=>`L${x(p.start)},${y(p.measured)}L${x(p.end)},${y(p.measured)}`).join(' ')} L${x(g.at(-1)!.end)},120 Z`} fill="var(--ob-solar)" fill-opacity="0.16"/>`)}
        <path d=${path('measured')} fill="none" stroke="var(--ob-solar)" stroke-width="2.5"/><path d=${path('forecast')} fill="none" stroke="var(--ob-secondary)" stroke-width="2" stroke-dasharray="6 4"/>
        ${[0,1,2,3,4].map(i=>svg`<text x=${32+i*88.5} y="145" text-anchor="middle">${this.time(start+(end-start)*i/4)}</text>`)}
      </svg><div class="stats"><div>Measured<strong>${this.format(result.measured,'kWh')}</strong></div><div>Forecast<strong>${this.format(result.forecast,'kWh')}</strong></div>`}
      <div class="footnote">${result.savedAt===undefined?'Requires a forecast snapshot saved before measurement.':`Forecast saved at ${this.time(result.savedAt)} · ${points.length} matched intervals`}</div>
      ${result.error ? companionSetup(Boolean(this.readings?.length) || sources.companionInstalled) : ''}
    </ha-card>`;
  }
}
