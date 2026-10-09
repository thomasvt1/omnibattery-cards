# Implementation research, Omnibattery v1.5.0

Read-only research completed before implementation; these source contracts guide the adapter and its tests.

## Registry and frontend
- Registry platform is `omnibattery`; retain legacy `marstek_venus` compatibility. Match selected config entry, translation keys, and known unique-ID suffixes. System IDs retain `marstek_venus_system_`, sometimes followed by another `system_`.
- Per-device unique IDs may contain private IP/port identifiers. Synthetic fixtures must replace the device-key prefix.
- Full `config/entity_registry/list` includes config_entry_id and unique_id; basic hass.entities may not. Share registry requests and invalidate on registry changes.
- HA 2026.10 recommends `context-request` with context `states` and subscribe true. Retain hass setter for API/editor compatibility. Unsubscribe on disconnect.
- Omnibattery panel metadata supplies grid_entity, grid_inverted, home_entity, solar_entity, daily_operation_timeline_entity. Match panel config.domain. solar_entity is the complete source; never add MPPT again. Explicit overrides win.
- Backend home translation key is `home_consumption`; upstream panel's `system_home_consumption` constant appears inconsistent.

## Power
- Battery cell keys battery_power, battery_cell_power, system_battery_cell_power are positive charging / negative discharging.
- Marstek ac_power is negative charging / positive delivered AC. System charge/discharge power sensors represent AC exchange. Keep AC and cell power distinct; absent AC measurements never become cell power by assumption.
- Zendure driver calculates cell power from outputPackPower minus packInputPower; separate AC exchange uses gridInputPower minus outputHomePower. Do not count DC solar charging as grid import.

## Timeline
- Schema 1: 96 fixed local wall-clock quarter-hour cells, up to 48 next-day extension cells. Not 96 consecutive absolute UTC intervals.
- series: solar_actual_kwh, solar_forecast_kwh, consumption_actual_kwh, consumption_forecast_kwh, actual_coverage_s, solar_actual_coverage_s, consumption_actual_coverage_s.
- operations: separate actual/planned action/context/coexistence masks, actual_soc_pct/planned_soc_pct, actual/planned energy and grid decisions. Mixed soc_pct is only a fallback when semantics can be established.
- Action bits: solar_charge=1, grid_charge=2, discharge=4. Context: setpoint=1, charge_delay=2, dynamic_price=4, time_slot=8, realtime_price=16, hourly_balance=32.
- Zero action mask is not evidence of hold. Multiple bits may be sequential, not simultaneous; use coexistence masks or observed_seconds_by_action_by_interval.
- Actual current energy covers measured-so-far time; current forecast covers remaining time. Convert each using its own coverage/duration. Repeated DST quarters have 1800 physical seconds; skipped quarters are gaps. Sensor DTO omits internal interval_grid but exposes dst_skipped/dst_repeated.
- Extension uses sparse extension_index/index and explicit start/end timestamps; extended_horizon contains duration_s and DST arrays.
- Freshness: generated_at/entity update time is age. freshness.updated_at may remain at midnight while data stays fresh. Preserve observed history if forecasts go stale. Predictive charging off does not erase profile forecasts.

## Status and optional telemetry
- integration_status can be balanced while discharge_blocked. Read blocker dictionaries and details before summarizing state.
- Three-phase active means enabled, not necessarily limiting; inspect limited_batteries, unassigned_batteries, degraded_phases.
- Alarms: OK, Warning, Fault. Unsupported health/MPPT entities can exist but be unknown. Omit unsupported optional values.
- Nord Pool raw_today/raw_tomorrow use timestamped start,end,value. Preserve negative prices and missing tomorrow data.

## Delivery
- One dist/omnibattery-cards.js and same named release asset; root hacs.json includes name, filename, homeassistant 2026.10.0. Public repository needs description, README, topics.
- HACS add_repository category lovelace, then download version. Read back resources, do not duplicate HACS-created hacstag URL.
- Live verification through an unsaved card-editor preview, cancel without saving. Browser availability confirmed; use discovered HA origin rather than assuming port 8123.
- Public artifacts must not include local origin, household device IDs, raw diagnostics, or private configuration.

## Primary references
- https://github.com/ffunes/Omnibattery/blob/v1.5.0/custom_components/omnibattery/sensor.py
- https://github.com/ffunes/Omnibattery/blob/v1.5.0/custom_components/omnibattery/tracking/daily_timeline.py
- https://github.com/ffunes/Omnibattery/blob/v1.5.0/custom_components/omnibattery/sensors/aggregate_sensors.py
- https://github.com/ffunes/Omnibattery/blob/v1.5.0/custom_components/omnibattery/drivers/zendure.py
- https://github.com/ffunes/Omnibattery/blob/v1.5.0/custom_components/omnibattery/__init__.py
- https://developers.home-assistant.io/docs/frontend/custom-ui/custom-card/
- https://www.hacs.xyz/docs/publish/plugin/
