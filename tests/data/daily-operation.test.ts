import { describe, expect, it } from 'vitest';
import { createDemo } from '../../src/demo/fixtures';
import { parseTimeline } from '../../src/data/timeline';
import { operationAdvice, operationHomeEnergy, operationPrice } from '../../src/data/daily-operation';
import type { PriceSeries } from '../../src/types';

const now=new Date('2026-06-15T12:37:30Z');
function fixture() {
  const demo=createDemo('solar',now);
  const entity=Object.values(demo.hass.states).find(e=>e.attributes.schema_version===1 && e.attributes.operations)!;
  return {entity, timeline:parseTimeline(entity,now)};
}
describe('daily operation table',()=>{
  it('keeps current remaining forecast and measured coverage separate',()=>{
    const {timeline:t}=fixture(),slot=t.slots[t.currentIndex];
    expect(slot.batteryForecastKwh).toBeGreaterThan(0);
    expect(slot.batteryActualKwh).toBeGreaterThan(0);
    expect(operationHomeEnergy(slot,true)).toBe(slot.homeForecastKwh);
    expect(operationHomeEnergy(slot,false)).toBeCloseTo(slot.homeActualKw!*450/3600);
    expect(slot.solarToBatteryForecastKwh).toBeGreaterThan(0);
    expect(slot.storedForecastKwh).toBeGreaterThan(0);
    expect(t.slots[t.currentIndex-1].storedForecastKwh).toBeUndefined();
  });
  it('does not turn missing or invalid battery channels into zero',()=>{
    const {entity}=fixture();const ops=entity.attributes.operations as Record<string,unknown[]>;
    ops.planned_discharge_from_battery_kwh=[];
    ops.actual_charge_to_battery_kwh=[];
    ops.solar_to_battery_kwh=Array(96).fill(-1);
    const t=parseTimeline(entity,now),s=t.slots[t.currentIndex];
    expect(s.batteryActualKwh).toBeNull();expect(s.batteryForecastKwh).toBeNull();expect(s.solarToBatteryForecastKwh).toBeNull();
  });
  it('suppresses all projected table values when stale',()=>{
    const {entity}=fixture();entity.attributes.stale=true;
    const t=parseTimeline(entity,now),s=t.slots[t.currentIndex+1];
    expect(s.batteryForecastKwh).toBeUndefined();expect(s.storedForecastKwh).toBeUndefined();
    expect(operationHomeEnergy(s,true)).toBeNull();expect(operationAdvice(s,true).label).toBe('Unknown');
  });
  it('distinguishes idle, explicit hold, unknown and combined operations',()=>{
    const slot=fixture().timeline.slots[0];
    expect(operationAdvice({...slot,actionForecast:0,holdForecast:null},true).label).toBe('Idle');
    expect(operationAdvice({...slot,actionForecast:0,holdForecast:true},true).label).toBe('Hold');
    expect(operationAdvice({...slot,actionForecast:null,holdForecast:null},true).label).toBe('Unknown');
    expect(operationAdvice({...slot,actionForecast:5},true).label).toBe('Charge (solar) + Discharge');
    expect(operationAdvice({...slot,skipped:true},true).label).toBe('Skipped (DST)');
  });
  it('handles signed prices, coverage gaps, overlaps and DST ambiguity',()=>{
    const slot=fixture().timeline.slots[0];
    const prices:PriceSeries={entityId:'sensor.price',currency:'EUR',unit:'EUR/kWh',points:[
      {start:'2026-06-15T00:00:00Z',end:'2026-06-15T00:05:00Z',value:-.3},
      {start:'2026-06-15T00:05:00Z',end:'2026-06-15T00:15:00Z',value:.15},
    ]};
    expect(operationPrice(slot,prices)).toBeCloseTo(0);
    expect(operationPrice({...slot,repeated:true},prices)).toBeNull();
    prices.points[1].start='2026-06-15T00:06:00Z';expect(operationPrice(slot,prices)).toBeNull();
    prices.points[1].start='2026-06-15T00:04:00Z';expect(operationPrice(slot,prices)).toBeNull();
    expect(operationPrice(slot)).toBeNull();
  });
  it('uses explicit next-day energy without compressing sparse slots',()=>{
    const {entity}=fixture();const projection=entity.attributes.extended_projection as unknown[];
    entity.attributes.extended_projection=[projection[0],projection[2]];
    const t=parseTimeline(entity,now);expect(t.slots).toHaveLength(99);
    expect(t.slots[96].homeForecastKwh).toBeGreaterThan(0);
    expect(t.slots[97].batteryForecastKwh).toBeUndefined();
    expect(t.slots[98].batteryForecastKwh).not.toBeUndefined();
  });
});
