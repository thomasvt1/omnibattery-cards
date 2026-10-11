import { describe, expect, it } from 'vitest';
import { retainedShare, priceWindows, forecastAccuracy } from '../../src/data/insights';
import { createDemo } from '../../src/demo/fixtures';
import { parseTimeline } from '../../src/data/timeline';
import type { PriceSeries } from '../../src/types';

const hour=3600000, start=Date.parse('2026-06-15T00:00:00Z');
const prices=(values:number[]):PriceSeries=>({entityId:'sensor.price',currency:'EUR',unit:'EUR/kWh',points:values.map((value,i)=>({start:new Date(start+i*hour).toISOString(),end:new Date(start+(i+1)*hour).toISOString(),value}))});
describe('daily independence',()=>{
  it('calculates physical shares and rejects missing, empty and inconsistent counters',()=>{
    expect(retainedShare(18,4)).toBeCloseTo(77.7778);
    expect(retainedShare(24,6)).toBe(75);
    for(const pair of [[null,4],[0,0],[18,20],[18,-1]] as const)expect(retainedShare(pair[0],pair[1])).toBeNull();
  });
});
describe('price windows',()=>{
  it('weights partial periods, preserves negative prices and excludes past windows',()=>{
    const result=priceWindows(prices([9,0.2,-0.2,-0.1,0.5]),start+hour/2);
    expect(result.current).toBe(9);
    expect(result.low?.start).toBe(start+2*hour);
    expect(result.low?.value).toBeCloseTo(-0.15);
    expect(result.high?.start).toBe(start+hour/2);
    expect(result.high?.value).toBeCloseTo(2.3);
  });
  it('does not bridge gaps or accept overlapping tariffs',()=>{
    const gap=prices([1,2,3]);gap.points.splice(1,1);
    expect(priceWindows(gap,start).low).toBeUndefined();
    const overlap=prices([1,2]);overlap.points.push({...overlap.points[0]});
    expect(priceWindows(overlap,start).low).toBeUndefined();
    expect(priceWindows(undefined,start).current).toBeNull();
  });
  it('uses physical timestamps for subhourly and DST-like repeated wall hours',()=>{
    const series=prices([0,0]);
    series.points=[{start:'2026-10-25T02:00:00+02:00',end:'2026-10-25T02:00:00+01:00',value:-1},{start:'2026-10-25T02:00:00+01:00',end:'2026-10-25T03:00:00+01:00',value:3}];
    expect(priceWindows(series,Date.parse(series.points[0].start)).low?.value).toBe(1);
  });
});
describe('saved forecast accuracy',()=>{
  const now=new Date('2026-06-15T12:30:00Z');
  const setup=()=>{const {hass}=createDemo('solar',now);return {entity:hass.states['sensor.demo_saved_forecast'],timeline:parseTimeline(hass.states['sensor.demo_timeline'],now)};};
  it('compares only completed matched intervals against an earlier snapshot',()=>{
    const {entity,timeline}=setup();const result=forecastAccuracy(entity,timeline,'solar',+now);
    expect(result.points).toHaveLength(50);expect(result.forecast).toBeGreaterThan(result.measured);
    expect(forecastAccuracy(entity,timeline,'home',+now).measured).toBeGreaterThan(0);
    entity.attributes.saved_at=now.toISOString();
    expect(forecastAccuracy(entity,timeline,'solar',+now).points).toHaveLength(0);
  });
  it('excludes partial per-source coverage, duplicates and repeated wall cells',()=>{
    const {entity,timeline}=setup();
    timeline.slots[0].solarCoverageSeconds=450;timeline.slots[1].repeated=true;
    const intervals=entity.attributes.intervals as unknown[];intervals.push(intervals[2]);
    const result=forecastAccuracy(entity,timeline,'solar',+now);
    expect(result.points).toHaveLength(47);
    expect(result.points[0].start).toBe(start+3*900000);
  });
  it('reports unavailable and malformed snapshots instead of zero error',()=>{
    const {entity,timeline}=setup();
    expect(forecastAccuracy(undefined,timeline,'solar',+now).error).toBeTruthy();
    entity.attributes.schema_version=2;
    expect(forecastAccuracy(entity,timeline,'solar',+now).error).toBeTruthy();
  });
});
