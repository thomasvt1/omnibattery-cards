import { css, html, svg, nothing } from 'lit';
import { BaseCard } from '../base-card';
import type { TimelineSlot, PriceSeries } from '../types';

type ChartSeries = { label: string; color: string; values: (number | null)[]; forecast?: boolean; area?: boolean; step?: boolean };
const COLORS = { solar: 'var(--ob-solar)', home: 'var(--ob-home)', battery: 'var(--ob-battery)', soc: 'var(--ob-soc)', price: 'var(--ob-price)', export: 'var(--ob-grid)' };

export class OmnibatteryPlanCard extends BaseCard {
  static properties = { width: { state: true }, selected: { state: true }, extended: { state: true } };
  private width = 900;
  private selected: number | null = null;
  private extended = false;
  private observer?: ResizeObserver;
  static styles = [BaseCard.styles, css`
    :host { --plot-label: var(--secondary-text-color, #687080); }
    .card-header { margin-bottom: 12px; }
    .topline { display:flex; justify-content:space-between; align-items:center; gap:12px; margin-bottom:10px; }
    .period { color:var(--ob-secondary); font-size:12px; }
    .range { display:flex; gap:2px; padding:3px; background:var(--ob-subtle); border-radius:8px; }
    .range button { border:0; background:transparent; padding:5px 9px; border-radius:5px; font-size:12px; }
    .range button[aria-pressed=true] { background:var(--ha-card-background,var(--card-background-color,#fff)); color:var(--primary-color,#0288d1); }
    .chart { border-radius:4px; touch-action:pan-y; }
    .chart svg { display:block; width:100%; overflow:visible; }
    .chart text { font-family:inherit; font-size:11px; fill:var(--plot-label); }
    .chart .axis { stroke:var(--ob-line); stroke-width:1; }
    .chart .zero { stroke:var(--ob-secondary); stroke-opacity:.35; }
    .chart .now { stroke:var(--ob-secondary); stroke-width:1; stroke-dasharray:4 4; }
    .chart .selected { stroke:var(--primary-text-color,#202530); stroke-width:1; stroke-opacity:.45; }
    .chart .line { fill:none; stroke-width:1.9; stroke-linecap:round; stroke-linejoin:round; }
    .chart .forecast { stroke-dasharray:5 5; opacity:.8; }
    .legend { display:flex; flex-wrap:wrap; gap:7px 15px; font-size:11px; color:var(--ob-secondary); margin-top:8px; }
    .legend span { display:inline-flex; align-items:center; gap:5px; }
    .dot { width:8px; height:8px; border-radius:50%; background:var(--color); }
    .sample { width:19px; border-top:2px solid var(--ob-secondary); }
    .sample.dashed { border-top-style:dashed; }
    .inspector { border-top:1px solid var(--ob-line); margin-top:15px; padding-top:11px; display:flex; gap:5px 18px; flex-wrap:wrap; font-size:12px; min-height:43px; }
    .inspector strong { font-weight:600; } .inspector span { color:var(--ob-secondary); }
    .inspector .value { color:var(--primary-text-color,#202530); }
    .empty { min-height:180px; display:grid; place-content:center; gap:8px; text-align:center; color:var(--ob-secondary); }
    .empty strong { font-size:16px; color:var(--primary-text-color,#202530); }
    .footnote { margin:9px 0 0; color:var(--ob-secondary); font-size:11px; }
    .footnote p { margin:6px 0 0; } .footnote summary { cursor:pointer; }
    .inspect-hint { color:var(--ob-secondary); font-size:12px; margin-top:10px; }
    .activity-inspector { width:100%; }
    @container(max-width:450px) { .card-header {margin-bottom:8px;} .card-header .subtitle {display:none;} .topline{margin-bottom:4px;} }
    @media(max-width:450px) { .topline { align-items:flex-start; } .period { max-width:50%; } .legend { gap:7px 11px; } .inspector { gap:5px 12px; } }
  `];
  static getStubConfig() { return { type: 'custom:omnibattery-plan-card' }; }
  getCardSize() { return this.config?.import_price_entity || this.config?.export_price_entity ? 13 : 11; }
  getGridOptions() { return { columns: 12, rows: 'auto', min_columns: 12, min_rows: 7 }; }
  connectedCallback() {
    super.connectedCallback();
    this.observer = new ResizeObserver(entries => {
      const measured = Math.max(260, Math.floor(entries[0].contentRect.width - 40));
      if (this.width !== measured) this.width = measured;
    });
    this.observer.observe(this);
  }
  disconnectedCallback() { this.observer?.disconnect(); super.disconnectedCallback(); }
  private get plotLeft() { return this.width<450?60:84; }

  private path(values: (number | null)[], x: (index: number) => number, y: (value: number) => number) {
    let pen = false;
    return values.map((value, i) => {
      if (value == null || !Number.isFinite(value)) { pen = false; return ''; }
      const command = `${pen ? 'L' : 'M'}${x(i).toFixed(2)},${y(value).toFixed(2)}`;
      pen = true; return command;
    }).join(' ');
  }
  private area(values: (number | null)[], x: (index: number) => number, y: (value: number) => number, zero: number) {
    const sections: string[] = []; let section: number[] = [];
    const flush = () => {
      if (!section.length) return;
      const first = section[0]; const last = section[section.length - 1];
      sections.push(`M${x(first)},${zero} ${section.map(i => `L${x(i)},${y(values[i]!)}`).join(' ')} L${x(last)},${zero}Z`); section = [];
    };
    values.forEach((v,i) => { if(v == null) flush(); else section.push(i); }); flush(); return sections.join(' ');
  }
  private steps(values: (number | null)[], x: (index: number) => number, y: (value: number) => number) {
    let pen = false;
    return values.map((value, i) => {
      if(value == null) { pen = false; return ''; }
      const segment = `${pen ? 'L' : 'M'}${x(i-.5)},${y(value)} L${x(i+.5)},${y(value)}`;
      pen = true; return segment;
    }).join(' ');
  }
  private series(slots: TimelineSlot[], actual: keyof TimelineSlot, projected: keyof TimelineSlot, label: string, color: string, area=false): ChartSeries[] {
    return [
      { label, color, area, values:slots.map(s => typeof s[actual] === 'number' ? s[actual] as number : null) },
      { label, color, forecast:true, area, values:slots.map(s => typeof s[projected] === 'number' ? s[projected] as number : null) },
    ];
  }
  private priceValues(series: PriceSeries | undefined, slots: TimelineSlot[]): (number | null)[] {
    if (!series) return slots.map(() => null);
    const timeline = this.snapshot.timeline;
    const formatter = new Intl.DateTimeFormat('en-CA',{timeZone:timeline.timeZone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
    const points = series.points.flatMap(p => {
      const start = new Date(p.start), end = new Date(p.end);
      if (!Number.isFinite(+start) || !Number.isFinite(+end)) return [];
      const part = formatter.formatToParts(start);
      const dict = Object.fromEntries(part.map(p=>[p.type,p.value]));
      return [{date:`${dict.year}-${dict.month}-${dict.day}`,minute:+dict.hour*60 + +dict.minute,duration:(+end-+start)/60000,value:p.value}];
    });
    // Repeated DST prices share a wall slot and are duration-weighted.
    return slots.map(slot => {
      if(slot.skipped) return null;
      const targetDate = slot.index >= 96 ? this.dateOffset(timeline.localDate, 1) : timeline.localDate;
      let total=0,weight=0;
      const wallTarget = (slot.index % 96) * 15;
      for(const p of points) {
        if(p.date!==targetDate) continue;
        const overlap=Math.max(0,Math.min(p.minute+p.duration,wallTarget+15)-Math.max(p.minute,wallTarget));
        total+=overlap*p.value; weight+=overlap;
      }
      return weight?total/weight:null;
    });
  }
  private dateOffset(date: string, days: number) {
    const parsed = new Date(`${date}T12:00:00Z`); if(!Number.isFinite(+parsed)) return date;
    parsed.setUTCDate(parsed.getUTCDate()+days); return parsed.toISOString().slice(0,10);
  }
  private timeLabel(index:number) {
    const preference = this.hass.locale?.time_format;
    const options: Intl.DateTimeFormatOptions = {timeZone:'UTC',hour:'2-digit',minute:'2-digit'};
    if(preference==='12'||preference==='24') options.hour12=preference==='12';
    const label=new Intl.DateTimeFormat(this.hass.locale?.language||this.hass.language||'en',options)
      .format(new Date(Date.UTC(2000,0,1,Math.floor(index/4)%24,index%4*15)));
    return `${label}${index>=96?' +1':''}`;
  }
  private activityLabel(slot: TimelineSlot) {
    const measured=slot.actionActual, planned=slot.actionForecast;
    const labels=(mask:number|null,hold:boolean|null)=>[
      mask!=null && (mask&1)?'solar charging':'',mask!=null && (mask&2)?'grid charging':'',
      mask!=null && (mask&4)?'discharging':'',hold?'charge delay':'',
    ].filter(Boolean).join(', ');
    return [labels(measured,slot.holdActual) && `Measured activity: ${labels(measured,slot.holdActual)}`,
      labels(planned,slot.holdForecast) && `Projected activity: ${labels(planned,slot.holdForecast)}`].filter(Boolean).join('. ');
  }
  private renderPlot(series: ChartSeries[], top:number, height:number, unit:string, count:number, fixed?:[number,number]) {
    const left = this.plotLeft, right = this.width-10;
    const numbers = series.flatMap(s=>s.values.filter((v):v is number=>v != null && Number.isFinite(v)));
    let [min,max] = fixed || [Math.min(0,...numbers),Math.max(0,...numbers)];
    if(max===min) max=min+1;
    if(!fixed) { const span=max-min; max+=span*.1; if(min<0) min-=span*.1; }
    const x=(i:number)=>left+(i+.5)/count*(right-left), y=(v:number)=>top+height-(v-min)/(max-min)*height;
    const ticks=[min,(max+min)/2,max];
    return svg`
      <text x="0" y=${top-9}>${unit}</text>
      ${ticks.map(v=>svg`<line class="axis ${Math.abs(v)<.0001?'zero':''}" x1=${left} x2=${right} y1=${y(v)} y2=${y(v)}/><text x=${left-8} y=${y(v)+3} text-anchor="end">${this.format(v,'',unit==='%'?0:1)}</text>`)}
      ${Array.from({length:count/24+1},(_,i)=>i*24).map(i=>svg`<line class="axis" x1=${left+i/count*(right-left)} x2=${left+i/count*(right-left)} y1=${top} y2=${top+height} stroke-opacity=".5"/>`)}
      ${series.map(s=>svg`${s.area?svg`<path d=${this.area(s.values,x,y,y(Math.max(0,min)))} fill=${s.color} opacity=${s.forecast?'.06':'.13'}/>`:nothing}<path class="line ${s.forecast?'forecast':''}" d=${s.step?this.steps(s.values,x,y):this.path(s.values,x,y)} stroke=${s.color}/>`)}
    `;
  }
  private setIndex(event: PointerEvent, count: number) {
    const rect=(event.currentTarget as HTMLElement).getBoundingClientRect();
    const x=(event.clientX-rect.left)/rect.width*this.width;
    this.selected=Math.max(0,Math.min(count-1,Math.floor((x-this.plotLeft)/(this.width-this.plotLeft-10)*count)));
  }
  private key(event: KeyboardEvent, count:number) {
    let index = this.selected ?? this.snapshot.timeline.currentIndex;
    if(event.key==='ArrowLeft') index--; else if(event.key==='ArrowRight') index++;
    else if(event.key==='Home') index=0; else if(event.key==='End') index=count-1;
    else if(event.key==='Escape') { this.selected=null; return; } else return;
    event.preventDefault(); this.selected=Math.max(0,Math.min(count-1,index));
  }
  private renderActivity(slots: TimelineSlot[], top:number,count:number) {
    const left=this.plotLeft, right=this.width-10, cell=(right-left)/count;
    const rows=[{label:'Solar charge',bit:1,color:COLORS.solar},{label:'Grid charge',bit:2,color:COLORS.export},{label:'Discharge',bit:4,color:COLORS.battery},{label:'Charge delay',bit:0,color:'var(--ob-secondary)'}];
    return svg`${rows.map((r,row)=>svg`
      <text x="0" y=${top+row*19+9}>${this.width<450?['Solar','Grid','Discharge','Delay'][row]:r.label}</text>
      <rect x=${left} y=${top+row*19} width=${right-left} height="11" rx="3" fill="var(--ob-line)" opacity=".35"/>
      ${slots.map((slot,i)=>{
        const actual=r.bit ? slot.actionActual!=null && Boolean(slot.actionActual&r.bit) : slot.holdActual;
        const planned=r.bit ? slot.actionForecast!=null && Boolean(slot.actionForecast&r.bit) : slot.holdForecast;
        if(slot.skipped || (!actual&&!planned)) return nothing;
        return svg`<rect x=${left+i*cell} y=${top+row*19} width=${Math.max(.5,cell-.6)} height="11" fill=${r.color} opacity=${actual?'.9':'.35'}><title>${slot.label}: ${r.label}, ${actual?'measured':'projected'}</title></rect>`;
      })}
    `)}`;
  }
  protected render() {
    const model=this.snapshot, timeline=model.timeline;
    if(!timeline.available) return html`<ha-card>${this.renderHeader('Energy plan')}${this.renderNotice()}<div class="empty"><strong>Timeline unavailable</strong><span>${timeline.error || 'Select an Omnibattery daily operation timeline entity.'}</span></div></ha-card>`;
    const extended=this.config.show_extension || this.extended;
    const slots=timeline.slots.slice(0,extended?144:96), count=slots.length;
    const selected=Math.min(this.selected??timeline.currentIndex,count-1), slot=slots[selected];
    const power=[...this.series(slots,'solarActualKw','solarForecastKw','Solar',COLORS.solar,true),...this.series(slots,'homeActualKw','homeForecastKw','Home',COLORS.home),...this.series(slots,'batteryActualKw','batteryForecastKw','Battery cell',COLORS.battery)];
    const soc=this.series(slots,'socActual','socForecast','Charge level',COLORS.soc);
    const importValues=this.priceValues(model.importPrices,slots);
    const exportValues=this.priceValues(model.exportPrices,slots);
    const hasPrices=importValues.some(v=>v!=null)||exportValues.some(v=>v!=null);
    const prices:ChartSeries[]=[{label:'Import price',color:COLORS.price,values:importValues,step:true},{label:'Export price',color:COLORS.export,values:exportValues,step:true}];
    const compact=this.width<450;
    const powerTop=26, powerHeight=compact?84:120, socTop=compact?136:178, priceTop=compact?198:256, activityTop=hasPrices?(compact?260:334):(compact?198:256), chartHeight=activityTop+98;
    const left=this.plotLeft,right=this.width-10;
    const nowX=left+(timeline.currentIndex+timeline.currentProgress)/count*(right-left);
    const selectedX=left+(selected+.5)/count*(right-left);
    const tickStep = right-left<400 ? (count>96?72:48) : 24;
    const ticks = Array.from({length:Math.ceil(count/tickStep)},(_,i)=>i*tickStep).filter(i=>i===0 || count-i>=tickStep*.7);
    ticks.push(count);
    const activeSeries=[...power.filter(s=>!s.forecast),soc[0],...(hasPrices?prices:[])].filter(s=>s.values.some(v=>v!=null)||[...power,...soc].find(p=>p.label===s.label&&p.forecast)?.values.some(v=>v!=null));
    const inspected=slot?`${this.timeLabel(selected)}, solar ${this.format(slot.solarActualKw??slot.solarForecastKw,'kW')}, home ${this.format(slot.homeActualKw??slot.homeForecastKw,'kW')}, battery cell ${this.format(slot.batteryActualKw??slot.batteryForecastKw,'kW')}, charge level ${this.format(slot.socActual??slot.socForecast,'%')}. ${this.activityLabel(slot)}${model.importPrices?`. Import ${this.format(importValues[selected],model.importPrices.unit,3)}`:''}${model.exportPrices?`. Export ${this.format(exportValues[selected],model.exportPrices.unit,3)}`:''}`:'';
    const dateLabel=new Intl.DateTimeFormat(this.hass.locale?.language||this.hass.language||'en',{timeZone:'UTC',dateStyle:'medium'}).format(new Date(`${timeline.localDate}T12:00:00Z`));
    return html`<ha-card>
      ${this.renderHeader('Energy plan',timeline.stale?'Forecast stale':'Measured & projected')}${this.renderNotice()}
      <div class="topline"><span class="period">${dateLabel} · ${timeline.timeZone}</span>${timeline.slots.length>96?html`<div class="range" aria-label="Timeline range"><button aria-pressed=${!extended} @click=${()=>{this.extended=false;this.config={...this.config,show_extension:false};this.selected=null;}}>Today</button><button aria-pressed=${extended} @click=${()=>{this.extended=true;this.selected=null;}}>+ Tomorrow</button></div>`:nothing}</div>
      <div class="chart" tabindex="0" role="slider" aria-label="Inspect energy timeline. Use left and right arrow keys to move between intervals." aria-valuemin="0" aria-valuemax=${count-1} aria-valuenow=${selected} aria-valuetext=${inspected}
        @focus=${()=>{this.selected??=timeline.currentIndex;}} @pointermove=${(e:PointerEvent)=>{if(e.pointerType==='mouse')this.setIndex(e,count);}} @pointerdown=${(e:PointerEvent)=>this.setIndex(e,count)} @keydown=${(e:KeyboardEvent)=>this.key(e,count)}>
        <svg viewBox=${`0 0 ${this.width} ${chartHeight}`} aria-hidden="true">
          ${this.renderPlot(power,powerTop,powerHeight,'kW · interval average',count)}
          ${this.renderPlot(soc,socTop,compact?34:46,'%',count,[0,100])}
          ${hasPrices?this.renderPlot(prices,priceTop,compact?34:46,model.importPrices?.unit||model.exportPrices?.unit||'Price',count):nothing}
          ${this.renderActivity(slots,activityTop,count)}
          <line class="now" x1=${nowX} x2=${nowX} y1="20" y2=${activityTop+68}/><text x=${Math.min(right-25,Math.max(left+25,nowX))} y="12" text-anchor="middle">${timeline.stale?'Last update':'Now'}</text>
          ${this.selected!=null?svg`<line class="selected" x1=${selectedX} x2=${selectedX} y1="20" y2=${activityTop+68}/>`:nothing}
          ${ticks.map(i=>svg`<text x=${left+i/count*(right-left)} y=${chartHeight-4} text-anchor=${i===0?'start':i===count?'end':'middle'}>${this.timeLabel(i)}</text>`)}
        </svg>
      </div>
      <div class="legend">${activeSeries.map(s=>html`<span><i class="dot" style=${`--color:${s.color}`}></i>${s.label}</span>`)}<span><i class="sample"></i>Measured</span><span><i class="sample dashed"></i>Projected</span></div>
      ${slot&&this.selected!=null?html`<div class="inspector"><strong>${this.timeLabel(selected)}${slot.repeated?' · repeated hour':''}${slot.skipped?' · skipped hour':''}</strong>
        <span>Solar <span class="value">${this.format(slot.solarActualKw??slot.solarForecastKw,'kW')}</span></span>
        <span>Home <span class="value">${this.format(slot.homeActualKw??slot.homeForecastKw,'kW')}</span></span>
        <span>Cell <span class="value">${this.format(slot.batteryActualKw??slot.batteryForecastKw,'kW')}</span></span>
        <span>Charge <span class="value">${this.format(slot.socActual??slot.socForecast,'%')}</span></span>
        ${model.importPrices?html`<span>Import <span class="value">${this.format(importValues[selected],model.importPrices.unit,3)}</span></span>`:nothing}
        ${model.exportPrices?html`<span>Export <span class="value">${this.format(exportValues[selected],model.exportPrices.unit,3)}</span></span>`:nothing}
        <span>${selected<timeline.currentIndex?'Measured':selected>timeline.currentIndex?'Projected':'Current interval · partial'}</span>
        ${this.activityLabel(slot)?html`<span class="activity-inspector">${this.activityLabel(slot)}</span>`:nothing}
      </div>`:html`<div class="inspect-hint">Touch or use arrow keys to inspect an interval.</div>`}
      <details class="footnote"><summary>Chart details</summary><p>Battery power is cell-side: positive charging, negative discharging. Activities may change within an interval.${hasPrices?' Prices show published intervals.':''}</p></details>
    </ha-card>`;
  }
}
