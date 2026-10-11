import { describe, expect, it } from 'vitest';
import { createDemo } from '../../src/demo/fixtures';
import { parseTimeline } from '../../src/data/timeline';
import { remainingToday } from '../../src/data/energy-today';

const now=new Date('2026-06-15T12:37:30Z');
const fixture=()=>{
  const {hass}=createDemo('solar',now), entity=hass.states['sensor.demo_timeline'];
  return {entity, timeline:parseTimeline(entity,now)};
};
describe('energy today forecasts',()=>{
  it('sums remaining energy once, including only the remaining current interval and excluding tomorrow',()=>{
    const {entity,timeline}=fixture();
    const series=entity.attributes.series as Record<string,(number|null)[]>;
    const expected=series.solar_forecast_kwh.filter((v):v is number=>v!==null).reduce((a,b)=>a+b,0);
    expect(remainingToday(timeline,now).solar).toBeCloseTo(expected,8);
    expect(timeline.slots[50].forecastRemainingSeconds).toBe(450);
    expect(timeline.slots.length).toBeGreaterThan(96);
  });
  it('does not convert a gap, stale forecast or previous-day timeline into zero',()=>{
    const {timeline}=fixture();
    timeline.slots[60].solarForecastKwh=null;
    expect(remainingToday(timeline,now).solar).toBeNull();
    expect(remainingToday(timeline,now).home).not.toBeNull();
    timeline.stale=true;
    expect(remainingToday(timeline,now)).toEqual({solar:null,home:null});
    timeline.stale=false;
    expect(remainingToday(timeline,new Date('2026-06-16T00:00:00Z'))).toEqual({solar:null,home:null});
  });
  it('preserves genuine zero forecasts and excludes skipped DST cells',()=>{
    const {timeline}=fixture();
    for(const slot of timeline.slots){if(slot.forecastRemainingSeconds){slot.solarForecastKwh=0;}}
    timeline.slots[60].skipped=true;timeline.slots[60].solarForecastKwh=null;
    expect(remainingToday(timeline,now).solar).toBe(0);
  });
  it('uses integration energy for repeated DST cells without applying an extra duration multiplier',()=>{
    const {timeline}=fixture();
    const before=remainingToday(timeline,now).solar!;
    const slot=timeline.slots[60], previous=slot.solarForecastKwh!;
    slot.repeated=true;slot.durationSeconds=1800;slot.forecastRemainingSeconds=1800;slot.solarForecastKwh=2;
    expect(remainingToday(timeline,now).solar).toBeCloseTo(before-previous+2);
  });
});
