from copy import deepcopy
from datetime import datetime, timedelta, timezone
from custom_components.omnibattery_cards.model import Recorder

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
