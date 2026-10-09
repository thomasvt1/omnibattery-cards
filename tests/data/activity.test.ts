import { describe, expect, it } from 'vitest';
import { activityKinds, activitySegments } from '../../src/data/activity';
import type { TimelineSlot } from '../../src/types';

function slot(index: number, overrides: Partial<TimelineSlot> = {}): TimelineSlot {
  return {
    index, label: `${Math.floor(index / 4)}:${index % 4 * 15}`,
    durationSeconds: 900, repeated: false, skipped: false,
    solarActualKw: null, solarForecastKw: null, homeActualKw: null, homeForecastKw: null,
    socActual: null, socForecast: null, batteryActualKw: null, batteryForecastKw: null,
    actionActual: null, actionForecast: null, holdActual: null, holdForecast: null,
    actualCoverageSeconds: null, ...overrides,
  };
}

describe('single activity strip', () => {
  it('merges adjacent quarters of the same measured or projected activity into continuous blocks', () => {
    const slots = [
      slot(0, { actionActual: 1 }), slot(1, { actionActual: 1 }),
      slot(2, { actionActual: 4 }), slot(3, { actionActual: 4 }),
      slot(4),
      slot(5, { actionForecast: 2 }), slot(6, { actionForecast: 2 }),
    ];
    expect(activitySegments(slots, 4, 0.5)).toEqual([
      { start: 0, end: 2, kinds: ['solar'], projected: false },
      { start: 2, end: 4, kinds: ['discharge'], projected: false },
      { start: 5, end: 7, kinds: ['grid'], projected: true },
    ]);
  });

  it('preserves unknown and zero-mask gaps between otherwise matching activities', () => {
    const slots = [
      slot(0, { actionActual: 1 }), slot(1),
      slot(2, { actionActual: 1 }), slot(3, { actionActual: 0, holdActual: false }),
      slot(4, { actionActual: 1 }),
    ];
    expect(activitySegments(slots, 5, 0)).toEqual([
      { start: 0, end: 1, kinds: ['solar'], projected: false },
      { start: 2, end: 3, kinds: ['solar'], projected: false },
      { start: 4, end: 5, kinds: ['solar'], projected: false },
    ]);
    expect(activityKinds(null, null)).toEqual([]);
    expect(activityKinds(0, false)).toEqual([]);
    expect(activityKinds(0, null)).toEqual([]);
  });

  it('keeps every mixed action together without inventing ordered sub-intervals or action durations', () => {
    const slots = [slot(0, { actionActual: 7 }), slot(1, { actionActual: 7 })];
    expect(activitySegments(slots, 2, 0)).toEqual([
      { start: 0, end: 2, kinds: ['solar', 'grid', 'discharge'], projected: false },
    ]);
    expect(activityKinds(5, true)).toEqual(['solar', 'discharge', 'hold']);
  });

  it('shows explicitly reported hold even without an action mask', () => {
    const slots = [
      slot(0, { holdActual: true }), slot(1, { actionActual: 0, holdActual: true }),
      slot(2), slot(3, { actionForecast: 0, holdForecast: true }),
    ];
    expect(activitySegments(slots, 2, 0.5)).toEqual([
      { start: 0, end: 2, kinds: ['hold'], projected: false },
      { start: 3, end: 4, kinds: ['hold'], projected: true },
    ]);
  });

  it('splits the current quarter into measured and remaining projected portions', () => {
    const slots = [
      slot(7, { actionActual: 1 }),
      slot(8, { actionActual: 1, actionForecast: 2 }),
      slot(9, { actionForecast: 2 }),
    ];
    expect(activitySegments(slots, 8, 0.25)).toEqual([
      { start: 7, end: 8.25, kinds: ['solar'], projected: false },
      { start: 8.25, end: 10, kinds: ['grid'], projected: true },
    ]);
  });

  it('retains the measured/projected boundary when the action itself stays the same', () => {
    expect(activitySegments([slot(8, { actionActual: 1, actionForecast: 1 })], 8, 0.5)).toEqual([
      { start: 8, end: 8.5, kinds: ['solar'], projected: false },
      { start: 8.5, end: 9, kinds: ['solar'], projected: true },
    ]);
  });

  it('leaves unsupported portions of the current quarter unfilled', () => {
    expect(activitySegments([slot(8, { actionActual: 4 })], 8, 0.25)).toEqual([
      { start: 8, end: 8.25, kinds: ['discharge'], projected: false },
    ]);
    expect(activitySegments([slot(8, { actionForecast: 2 })], 8, 0.25)).toEqual([
      { start: 8.25, end: 9, kinds: ['grid'], projected: true },
    ]);
  });

  it('does not create zero-width activity at quarter boundaries', () => {
    const slots = [slot(8, { actionActual: 1, actionForecast: 4 })];
    expect(activitySegments(slots, 8, 0)).toEqual([
      { start: 8, end: 9, kinds: ['discharge'], projected: true },
    ]);
    expect(activitySegments(slots, 8, 1)).toEqual([
      { start: 8, end: 9, kinds: ['solar'], projected: false },
    ]);
  });

  it('preserves skipped daylight-saving quarters as gaps even if masks are present', () => {
    const slots = [
      slot(7, { actionForecast: 1 }),
      ...[8, 9, 10, 11].map(index => slot(index, { skipped: true, durationSeconds: 0, actionForecast: 1 })),
      slot(12, { actionForecast: 1 }),
    ];
    expect(activitySegments(slots, 6, 0.5)).toEqual([
      { start: 7, end: 8, kinds: ['solar'], projected: true },
      { start: 12, end: 13, kinds: ['solar'], projected: true },
    ]);
  });

  it('uses measured coverage across both repeated occurrences rather than the current wall-clock progress', () => {
    const repeated = slot(8, {
      repeated: true, durationSeconds: 1800, actualCoverageSeconds: 900,
      actionActual: 1, actionForecast: 4,
    });
    expect(activitySegments([repeated], 9, 0.25)).toEqual([
      { start: 8, end: 8.5, kinds: ['solar'], projected: false },
      { start: 8.5, end: 9, kinds: ['discharge'], projected: true },
    ]);
    expect(activitySegments([{ ...repeated, actualCoverageSeconds: 1350 }], 8, 0.5)).toEqual([
      { start: 8, end: 8.75, kinds: ['solar'], projected: false },
      { start: 8.75, end: 9, kinds: ['discharge'], projected: true },
    ]);
  });

  it('keeps the measured gap in a repeated quarter when only the remaining occurrence has reported activity', () => {
    const repeated = slot(8, {
      repeated: true, durationSeconds: 1800, actualCoverageSeconds: 900,
      actionActual: 0, actionForecast: 4,
    });
    expect(activitySegments([repeated], 9, 0.25)).toEqual([
      { start: 8.5, end: 9, kinds: ['discharge'], projected: true },
    ]);
  });
});
