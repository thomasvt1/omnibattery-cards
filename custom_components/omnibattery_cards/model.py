"""Pure recording logic; no controls, recorder rewrites, or retrospective forecasts."""
from copy import deepcopy
from datetime import datetime, timedelta, timezone
import math
from zoneinfo import ZoneInfo

UTC = timezone.utc


def number(value):
    if isinstance(value, bool):
        return None
    try:
        result = float(value)
        return result if math.isfinite(result) else None
    except (TypeError, ValueError):
        return None


def timestamp(value):
    try:
        result = datetime.fromisoformat(value.replace("Z", "+00:00"))
        return result.astimezone(UTC) if result.tzinfo is not None else None
    except (TypeError, AttributeError, ValueError):
        return None


class Recorder:
    """Persisted future forecasts; energy totals come from HA statistics."""
    def __init__(self, zone, restored=None):
        self.zone = ZoneInfo(zone)
        self.data = {"forecast": deepcopy(restored.get("forecast", {})) if isinstance(restored, dict) else {}}

    def local_date(self, now):
        return now.astimezone(self.zone).date().isoformat()

    def capture(self, attributes, now):
        """Freeze each future interval on first sight; never fill elapsed cells."""
        date = self.local_date(now)
        if self.data["forecast"].get("local_date") != date:
            self.data["forecast"] = {"schema_version": 1, "local_date": date, "intervals": []}
        saved = self.data["forecast"]
        generated = timestamp(attributes.get("generated_at"))
        if (attributes.get("schema_version") != 1 or attributes.get("timeline_available") is not True
            or attributes.get("local_date") != date or attributes.get("timezone") != str(self.zone)
            or attributes.get("interval_count") != 96 or attributes.get("interval_minutes") != 15
            or attributes.get("stale") is True or attributes.get("freshness", {}).get("stale") is True
            or generated is None or not 0 <= (now - generated).total_seconds() <= 900):
            return False
        series = attributes.get("series") or {}
        # Build physical intervals, then exclude repeated/nonexistent local cells.
        start = datetime.fromisoformat(date).replace(tzinfo=self.zone).astimezone(UTC)
        end = (datetime.fromisoformat(date) + timedelta(days=1)).replace(tzinfo=self.zone).astimezone(UTC)
        cells = {}
        cursor = start
        while cursor < end:
            local = cursor.astimezone(self.zone)
            cells.setdefault(local.hour * 4 + local.minute // 15, []).append(cursor)
            cursor += timedelta(minutes=15)
        existing = {p["start"]: p for p in saved["intervals"]}
        changed = False
        for index, occurrences in cells.items():
            if len(occurrences) != 1 or occurrences[0] < now:
                continue
            if any(index < len(attributes.get(flag, [])) and attributes[flag][index] for flag in ("dst_skipped", "dst_repeated")):
                continue
            start = occurrences[0]
            point = existing.get(start.isoformat(), {"start": start.isoformat(), "end": (start + timedelta(minutes=15)).isoformat()})
            for source, target in (("solar_forecast_kwh", "solar_kwh"), ("consumption_forecast_kwh", "consumption_kwh")):
                array = series.get(source, [])
                value = number(array[index]) if isinstance(array, list) and index < len(array) else None
                if target not in point and value is not None and value >= 0:
                    point[target] = value
                    point["saved_at"] = now.isoformat()
                    changed = True
            if "saved_at" in point:
                existing[point["start"]] = point
        if changed:
            saved.setdefault("saved_at", now.isoformat())
            saved["intervals"] = sorted(existing.values(), key=lambda p: p["start"])
        return changed
