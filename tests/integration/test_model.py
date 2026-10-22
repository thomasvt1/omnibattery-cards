from copy import deepcopy
from datetime import datetime, timedelta, timezone
from custom_components.omnibattery_cards.model import Recorder, energy_defaults, flows, power

UTC = timezone.utc

def timeline(now):
    return {"schema_version": 1, "timeline_available": True, "local_date": now.date().isoformat(),
            "timezone": "UTC", "interval_count": 96, "interval_minutes": 15, "generated_at": now.isoformat(),
            "series": {"solar_forecast_kwh": [0.1]*96, "consumption_forecast_kwh": [0.2]*96}}


def test_snapshot_is_frozen_and_does_not_backfill():
    now = datetime(2026, 10, 22, 12, 7, tzinfo=UTC)
    recorder = Recorder("UTC")
    source = timeline(now)
    assert recorder.capture(source, now)
    saved = deepcopy(recorder.data["forecast"])
    assert len(saved["intervals"]) == 47
    assert saved["intervals"][0]["start"] == "2026-10-22T12:15:00+00:00"
    source["series"]["solar_forecast_kwh"] = [99]*96
    assert not recorder.capture(source, now+timedelta(seconds=10))
    assert recorder.data["forecast"] == saved
    restored = Recorder("UTC", recorder.data)
    assert not restored.capture(source, now+timedelta(seconds=20))
    assert restored.data["forecast"] == saved


def test_snapshot_rejects_stale_unknown_and_missing_values_but_keeps_zero():
    now = datetime(2026, 10, 22, 12, tzinfo=UTC)
    recorder = Recorder("UTC")
    source = timeline(now)
    source["stale"] = True
    assert not recorder.capture(source, now)
    source["stale"] = False
    source["series"] = {"solar_forecast_kwh": [None]*96}
    assert not recorder.capture(source, now)
    source["series"]["solar_forecast_kwh"][49] = 0
    assert recorder.capture(source, now)
    assert recorder.data["forecast"]["intervals"][0]["solar_kwh"] == 0
    assert not recorder.capture(timeline(now-timedelta(hours=1)), now)


def test_dst_skips_repeated_cells_and_handles_short_days():
    for date, expected in [("2026-10-25", 92), ("2026-03-29", 92)]:
        from zoneinfo import ZoneInfo
        now = datetime.fromisoformat(date).replace(tzinfo=ZoneInfo("Europe/Amsterdam")).astimezone(UTC)
        source = timeline(now)
        source.update(local_date=date, timezone="Europe/Amsterdam")
        recorder = Recorder("Europe/Amsterdam")
        assert recorder.capture(source, now)
        assert len(recorder.data["forecast"]["intervals"]) == expected


def test_flow_model_handles_grid_charging_and_battery_export():
    # All grid charging at night: 2 kW of 3 kW grid goes to the battery.
    assert flows(3000, 0, 2000, 0)["grid_to_home"] == 1000
    # Solar supplies home then battery: grid funds the remaining battery charge.
    assert flows(1000, 2000, 2000, 0)["grid_to_home"] == 0
    # Battery export is not falsely labelled solar export.
    assert flows(-1000, 0, 0, 2000)["solar_to_grid"] == 0
    assert flows(-1000, 3000, 1000, 0)["solar_to_grid"] == 1000
    assert flows(None, 1, 2, 3) is None
    assert flows(0, 0, 3000, 0) is None
    assert power({"state": "unavailable", "attributes": {"unit_of_measurement": "W"}}) is None
    assert power({"state": "1.2", "attributes": {"unit_of_measurement": "kW"}}) == 1200


def test_counters_have_same_period_and_do_not_bridge_missing_or_restart():
    now = datetime(2026, 10, 22, 12, tzinfo=UTC)
    recorder = Recorder("UTC")
    flow = flows(3000, 0, 2000, 0)
    recorder.sample(now, flow)
    recorder.sample(now+timedelta(seconds=60), None)
    recorder.sample(now+timedelta(seconds=120), flow)
    daily = recorder.data["daily"]
    assert daily["coverage_seconds"] == 60
    assert daily["gap_seconds"] == 60
    assert abs(daily["home"] - 1/60) < 1e-9
    assert daily["home"] == daily["grid_to_home"]
    restored = Recorder("UTC", recorder.data)
    restored.sample(now+timedelta(seconds=180), flow)
    assert restored.data["daily"]["coverage_seconds"] == 60
    assert restored.data["daily"]["gap_seconds"] == 120


def test_midnight_splits_physical_time_and_resets_totals():
    now = datetime(2026, 10, 22, 23, 59, 30, tzinfo=UTC)
    recorder = Recorder("UTC")
    flow = flows(1000, 0, 0, 0)
    recorder.sample(now, flow)
    daily = recorder.sample(now+timedelta(seconds=60), flow)
    assert daily["local_date"] == "2026-10-23"
    assert daily["coverage_seconds"] == 30
    assert abs(daily["home"] - 1/120) < 1e-9


def test_energy_dashboard_multiple_tariffs_do_not_duplicate_grid_power():
    result = energy_defaults([
        {"type": "grid", "stat_rate": "sensor.p1"}, {"type": "grid", "stat_rate": "sensor.p1"},
        {"type": "solar", "stat_rate": "sensor.roof"}, {"type": "solar", "stat_rate": "sensor.shed"},
        {"type": "battery", "stat_rate": "sensor.net_battery", "power_config": {"stat_rate_from": "sensor.discharge", "stat_rate_to": "sensor.charge"}},
    ])
    assert result == {"grid_power": ["sensor.p1"], "solar_power": ["sensor.roof", "sensor.shed"],
                      "charge_power": ["sensor.charge"], "discharge_power": ["sensor.discharge"]}
