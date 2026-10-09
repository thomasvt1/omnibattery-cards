import type { TimelineSlot } from '../types';

export type ActivityKind = 'solar' | 'grid' | 'discharge' | 'hold';
export interface ActivitySegment {
  start: number;
  end: number;
  kinds: ActivityKind[];
  projected: boolean;
}

/** Multiple bits describe activities within a quarter, not their order or duration. */
export function activityKinds(mask: number | null, hold: boolean | null): ActivityKind[] {
  const kinds: ActivityKind[] = [];
  if (mask !== null) {
    if (mask & 1) kinds.push('solar');
    if (mask & 2) kinds.push('grid');
    if (mask & 4) kinds.push('discharge');
  }
  if (hold) kinds.push('hold');
  return kinds;
}

/** Merge adjacent equal quarters so the strip has continuous blocks, not tick marks. */
export function activitySegments(slots: TimelineSlot[], currentIndex: number, currentProgress: number): ActivitySegment[] {
  const segments: ActivitySegment[] = [];
  const append = (start: number, end: number, kinds: ActivityKind[], projected: boolean) => {
    if (!kinds.length || end <= start) return;
    const previous = segments.at(-1);
    if (previous && previous.end === start && previous.projected === projected && previous.kinds.join() === kinds.join()) previous.end = end;
    else segments.push({ start, end, kinds, projected });
  };
  for (const slot of slots) {
    if (slot.skipped) continue;
    const actual = activityKinds(slot.actionActual, slot.holdActual);
    const planned = activityKinds(slot.actionForecast, slot.holdForecast);
    const partial = slot.index === currentIndex || actual.length > 0 && planned.length > 0 ||
      slot.repeated && slot.actualCoverageSeconds !== null && slot.actualCoverageSeconds > 0;
    const progress = slot.repeated && slot.actualCoverageSeconds !== null && slot.durationSeconds > 0
      ? slot.actualCoverageSeconds / slot.durationSeconds : currentProgress;
    const split = slot.index + Math.max(0, Math.min(1, progress));
    append(slot.index, partial ? split : slot.index + 1, actual, false);
    append(partial ? split : slot.index, slot.index + 1, planned, true);
  }
  return segments;
}
