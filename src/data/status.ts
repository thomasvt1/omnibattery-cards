import type { BatteryModel, StatusRow, TimelineModel } from '../types';
import type { Discovery } from './discovery';
import { available, humanize, list, number, record, text } from './values';

const explanations: Record<string, string> = {
  balanced: 'Matching household demand', charging: 'Charging the batteries', discharging: 'Powering the home from batteries',
  grid_charging: 'Charging from the grid', initializing: 'Waiting for the controller to initialize', manual: 'Manual mode is active',
  charge_delayed: 'Charging is delayed', waiting_for_solar: 'Waiting for solar production', charging_to_setpoint: 'Charging to the target level',
  price_reserve_hold: 'Holding energy for a higher-price period', price_discharge_blocked: 'Price rules are preventing discharge',
  price_reserve: 'Energy reserved for a higher-price period', price_discharge: 'Discharge blocked by the price rule',
  min_soc: 'Minimum charge reserve reached', minimum_soc: 'Minimum charge reserve reached', max_soc: 'Maximum charge level reached',
  charge_delay: 'Waiting for the planned charging window', time_slot_charge: 'Outside the charging window', time_slot_discharge: 'Outside the discharge window',
  no_charge_slot: 'Outside the charging window', no_discharge_slot: 'Outside the discharge window',
  cell_balance_hold: 'Holding for cell balancing', balance_hold: 'Holding for cell balancing',
  ev_charging: 'Discharge paused while the vehicle charges', ev_pause: 'Battery operation paused for the vehicle charger',
  surplus_price_hold: 'Solar surplus is being exported until a cheaper period',
  backup_mode: 'Backup-mode cooldown is active', backup_cooldown: 'Backup-mode cooldown is active',
  weekly_full_charge: 'Weekly full charge is in progress', temperature_limit: 'Charging limited by temperature',
  temperature: 'Battery temperature is limiting operation', manual_mode: 'Battery is under manual control',
  peak_shaving: 'Reducing the grid peak', capacity_conserving: 'Conserving energy for grid peak protection',
  connection_unavailable: 'Battery connection is unavailable', non_delivery: 'Battery is not delivering the requested power',
  predischarging: 'Making room for upcoming solar production', protected_window: 'Preserving space for solar production',
  fail_safe: 'The controller cannot safely apply its solar plan', delayed: 'Waiting for the planned charging window',
  shaving: 'Reducing the grid peak', shaving_excluded: 'Reducing the grid peak', conserving: 'Conserving energy for grid peak protection',
};

function reasons(value: unknown): string[] {
  if (typeof value === 'string') return [explanations[value] ?? humanize(value)];
  if (Array.isArray(value)) return value.flatMap(reasons);
  return Object.entries(record(value)).filter(([, detail]) => detail !== false && detail !== null).map(([key, detail]) => {
    const explanation = explanations[key] ?? humanize(key);
    const message = text(detail) ?? text(record(detail).reason) ?? text(record(detail).detail);
    return message && message !== key && message !== 'true' ? `${explanation}: ${explanations[message] ?? message}` : explanation;
  });
}

export function buildStatus(discovery: Discovery, batteries: BatteryModel[], timeline: TimelineModel): StatusRow[] {
  const rows: StatusRow[] = [];
  const integration = discovery.get('status');
  const integrationEntityId = integration?.entity_id;
  const details = record(integration?.attributes);
  if (available(integration)) rows.push({ key: 'operation', title: explanations[integration.state] ?? humanize(integration.state),
    tone: ['initializing', 'manual'].includes(integration.state) ? 'neutral' : 'good', icon: 'mdi:home-battery', entityId: integration.entity_id });
  else rows.push({ key: 'operation', title: 'Controller status unavailable', tone: 'warning', icon: 'mdi:help-circle-outline', entityId: integrationEntityId });
  for (const direction of ['charge', 'discharge']) {
    const global = reasons(details[`${direction}_blockers`]);
    const perBattery = Object.entries(record(details[`battery_${direction}_blockers`]))
      .flatMap(([name, value]) => reasons(value).map(reason => `${name}: ${reason}`));
    if (details[`${direction}_blocked`] === true || global.length || perBattery.length) rows.push({
      key: `${direction}-blocked`, title: `${direction === 'charge' ? 'Charging' : 'Discharging'} ${details[`${direction}_blocked`] === true ? 'blocked' : 'restricted'}`,
      detail: [...new Set([...global, ...perBattery])].join(' · ') || 'The controller has reported a restriction.',
      tone: 'warning', icon: 'mdi:pause-circle-outline', entityId: integration?.entity_id,
    });
  }
  const predictive = discovery.get('predictive');
  const predictiveEnabled = available(predictive) ? ['on', 'true', 'enabled'].includes(predictive.state.toLowerCase()) :
    typeof details.predictive_charging_enabled === 'boolean' ? details.predictive_charging_enabled : text(details.predictive_charging_mode) ? true : undefined;
  if (predictiveEnabled !== undefined) rows.push({ key: 'predictive', title: predictiveEnabled ? 'Predictive charging enabled' : 'Predictive charging disabled',
    detail: predictiveEnabled ? humanize(text(details.predictive_charging_mode) ?? 'Planning from available forecasts') : 'Solar and household forecasts can still be available.',
    tone: 'neutral', icon: 'mdi:chart-timeline-variant', entityId: predictive?.entity_id ?? integration?.entity_id });
  const reserve = discovery.get('reserve');
  if (available(reserve) && reserve.state === 'on') {
    const percent = number(reserve.attributes.reserve_soc_pct);
    rows.push({ key: 'reserve', title: 'Energy reserved for a higher-price period',
      detail: percent !== null ? `${percent}% charge reserved; energy above this level remains available.` : text(reserve.attributes.reason),
      tone: 'neutral', icon: 'mdi:battery-lock', entityId: reserve.entity_id });
  }
  const surplusHold = discovery.get('surplusHold');
  if (available(surplusHold) && surplusHold.state === 'on') rows.push({ key: 'surplus-hold', title: 'Solar charging held for a cheaper period',
    detail: text(surplusHold.attributes.reason) ?? 'Surplus can be exported while the controller waits for a cheaper charging period.',
    tone: 'neutral', icon: 'mdi:pause-circle-outline', entityId: surplusHold.entity_id });
  const curtailment = discovery.get('curtailment');
  if (available(curtailment) && (curtailment.state === 'on' || curtailment.attributes.status === 'fail_safe')) {
    const state = text(curtailment.attributes.status) ?? 'predischarging';
    rows.push({ key: 'curtailment', title: explanations[state] ?? humanize(state),
      detail: curtailment.attributes.inverter_curtailment_required === true ? 'The controller reports that solar curtailment is required.' :
        text(curtailment.attributes.reason) ? humanize(String(curtailment.attributes.reason)) : undefined,
      tone: state === 'fail_safe' ? 'warning' : 'neutral', icon: 'mdi:weather-sunny-off', entityId: curtailment.entity_id });
  }
  const delay = discovery.get('chargeDelay');
  if (available(delay) && ['delayed', 'waiting_for_solar', 'charging_to_setpoint'].includes(delay.state)) {
    const unlock = text(delay.attributes.estimated_unlock_time) ?? text(delay.attributes.projected_unlock_time);
    rows.push({ key: 'charge-delay', title: explanations[delay.state] ?? humanize(delay.state),
      detail: unlock ? `Estimated charging start: ${unlock}` : text(delay.attributes.reason),
      tone: 'neutral', icon: 'mdi:clock-alert-outline', entityId: delay.entity_id });
  }
  const capacityProtection = discovery.get('capacityProtection');
  if (available(capacityProtection) && capacityProtection.state === 'on') rows.push({ key: 'capacity_protection', title: 'Grid peak protection active',
    detail: explanations[String(capacityProtection.attributes.action)] ?? humanize(text(capacityProtection.attributes.action) ?? 'Limiting battery operation'),
    tone: 'warning', icon: 'mdi:shield-check-outline', entityId: capacityProtection.entity_id });
  for (const [key, label] of [['capacity_protection', 'Grid peak protection'], ['temperature_charge_limit', 'Temperature protection'], ['normal_balance_protection', 'Charge-level protection']] as const) {
    if (rows.some(row => row.key === key)) continue;
    const protection = record(details[key]);
    if (protection.active === true || protection.limited === true || protection.action && !['idle', 'disabled', 'none'].includes(String(protection.action))) {
      rows.push({ key, title: `${label} active`, detail: text(protection.reason) ?? humanize(text(protection.action) ?? text(protection.state) ?? 'Limiting battery operation'),
        tone: 'warning', icon: 'mdi:shield-check-outline', entityId: integration?.entity_id });
    }
  }
  const phase = discovery.get('phaseProtection');
  if (available(phase)) {
    const d = phase.attributes;
    const limited = list(d.limited_batteries), unassigned = list(d.unassigned_batteries), degraded = list(d.degraded_phases);
    const affected = limited.length || unassigned.length || degraded.length;
    rows.push({ key: 'phase-protection', title: phase.state === 'disabled' ? 'Phase protection disabled' : affected ? 'Phase protection needs attention' : 'Phase protection enabled',
      detail: affected ? [limited.length ? `${limited.length} batteries limited` : '', unassigned.length ? `${unassigned.length} batteries unassigned` : '', degraded.length ? `${degraded.length} phases degraded` : ''].filter(Boolean).join(' · ') :
        phase.state === 'disabled' ? undefined : 'No batteries are currently limited.', tone: affected ? 'warning' : 'neutral', icon: 'mdi:shield-check-outline', entityId: phase.entity_id });
  }
  const connectivity = discovery.get('connectivity');
  const offline = batteries.filter(battery => !battery.available);
  const excluded = available(connectivity) ? Object.entries(connectivity.attributes)
    .filter(([, value]) => record(value).excluded === true || record(value).unreachable === true).map(([name]) => name) : [];
  const namedUnresponsive = available(connectivity) && !['none', '0', 'ok', 'normal'].includes(connectivity.state.toLowerCase()) ?
    connectivity.state.split(',').map(name => name.trim()).filter(Boolean) : [];
  const issues = [...new Set([...offline.map(battery => battery.name), ...excluded, ...namedUnresponsive])];
  if (batteries.length || connectivity) rows.push({ key: 'connectivity', title: issues.length ? `${issues.length} ${issues.length === 1 ? 'battery needs' : 'batteries need'} attention` : 'Batteries connected',
    detail: issues.length ? issues.join(' · ') : `${batteries.length} ${batteries.length === 1 ? 'battery' : 'batteries'} reporting`,
    tone: issues.length ? 'error' : 'good', icon: issues.length ? 'mdi:lan-disconnect' : 'mdi:check-network-outline', entityId: connectivity?.entity_id });
  const alarm = discovery.get('alarms');
  if (available(alarm)) {
    const state = alarm.state.toLowerCase();
    rows.push({ key: 'alarms', title: ['ok', 'none', 'normal', 'no active alarms/faults', '0'].includes(state) ? 'No active alarms' : `Battery alarm: ${humanize(alarm.state)}`,
      tone: state === 'fault' ? 'error' : ['ok', 'none', 'normal', 'no active alarms/faults', '0'].includes(state) ? 'good' : 'warning',
      icon: 'mdi:alert-circle-outline', entityId: alarm.entity_id });
  }
  // Driver-specific fault telemetry remains useful on devices without the aggregate alarm.
  for (const battery of batteries) {
    const fault = discovery.find(['fault_level'], battery.id);
    if (available(fault) && !['0', 'ok', 'none', 'normal', 'no fault'].includes(fault.state.toLowerCase())) {
      rows.push({ key: `fault-${battery.id}`, title: `${battery.name}: ${humanize(fault.state)}`,
        tone: number(fault.state) === 1 || /warn/i.test(fault.state) ? 'warning' : 'error', icon: 'mdi:battery-alert', entityId: fault.entity_id });
    }
  }
  rows.push({ key: 'timeline', title: !timeline.available ? 'Timeline unavailable' : timeline.stale ? 'Forecast needs an update' : 'Timeline up to date',
    detail: timeline.error ?? (timeline.stale ? 'Recorded history is preserved; stale projections are hidden.' : 'Actual measurements and forecasts are kept separate.'),
    tone: !timeline.available || timeline.stale ? 'warning' : 'good', icon: 'mdi:clock-check-outline', entityId: timeline.entityId });
  return rows;
}
