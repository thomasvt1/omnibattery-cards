import type { TimelineModel } from '../types';

/** Forecast energy is already prorated by the integration; never integrate a full current quarter twice. */
export function remainingToday(timeline: TimelineModel, now = new Date()): { solar: number | null; home: number | null } {
  const missing = { solar: null, home: null };
  if (!timeline.available || timeline.stale) return missing;
  let today: string;
  try {
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: timeline.timeZone, year:'numeric', month:'2-digit', day:'2-digit' }).formatToParts(now).map(p => [p.type,p.value]));
    today = `${parts.year}-${parts.month}-${parts.day}`;
  } catch { return missing; }
  if (timeline.localDate !== today) return missing;
  const daily = timeline.slots.filter(slot => slot.index < 96);
  if (daily.length !== 96) return missing;
  const remaining = daily.filter(slot => !slot.skipped && (slot.forecastRemainingSeconds ?? 0) > 0);
  const sum = (key: 'solarForecastKwh' | 'homeForecastKwh') => {
    if (remaining.some(slot => slot[key] == null || !Number.isFinite(slot[key]) || slot[key]! < 0)) return null;
    return remaining.reduce((total,slot) => total + slot[key]!,0);
  };
  return { solar:sum('solarForecastKwh'), home:sum('homeForecastKwh') };
}
