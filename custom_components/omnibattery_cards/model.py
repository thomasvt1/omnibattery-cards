"""Pure recording logic; no controls, recorder rewrites, or retrospective forecasts."""
from copy import deepcopy
from datetime import datetime, timedelta, timezone
import math
from zoneinfo import ZoneInfo

UTC = timezone.utc
ENERGIES = ("home", "solar", "grid_import", "grid_export", "grid_to_home", "solar_to_grid")


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


def power(state):
    """Read a normalized state mapping, preserving unavailable vs known zero."""
    if not isinstance(state, dict):
        return None
    value = number(state.get("state"))
    unit = state.get("attributes", {}).get("unit_of_measurement")
    return value * (1000 if unit == "kW" else 1) if value is not None and unit in ("W", "kW") else None


def energy_defaults(sources):
    """Use the Energy dashboard's power channels, not tariffs or meter-name guesses."""
    result = {key: [] for key in ("grid_power", "solar_power", "charge_power", "discharge_power")}
    for source in sources:
        kind = source.get("type")
        if kind in ("grid", "solar"):
            key = "grid_power" if kind == "grid" else "solar_power"
            if entity := source.get("stat_rate"):
                result[key].append(entity)
        elif kind == "battery":
            config = source.get("power_config") or {}
            if entity := config.get("stat_rate_to"):
                result["charge_power"].append(entity)
            if entity := config.get("stat_rate_from"):
                result["discharge_power"].append(entity)
    return {key: list(dict.fromkeys(ids)) for key, ids in result.items()}


def flows(grid, solar, charge, discharge):
    """AC accounting model: solar serves home, then battery, then grid.

    Battery discharge serves remaining home before grid import. Source attribution
    is an explicit model, not a claim that meters identify individual electrons.
    """
    values = [number(value) for value in (grid, solar, charge, discharge)]
    if any(value is None for value in values):
        return None
    grid, solar, charge, discharge = values
    if min(solar, charge, discharge) < 0:
        return None
    home = grid + solar + discharge - charge
    if home < -20:  # Reject inconsistent asynchronous readings; allow meter noise.
        return None
    home = max(0, home)
    imported, exported = max(0, grid), max(0, -grid)
    solar_home = min(solar, home)
    battery_home = min(discharge, max(0, home - solar_home))
    solar_charge = min(charge, max(0, solar - solar_home))
    return dict(home=home, solar=solar, grid_import=imported, grid_export=exported,
                grid_to_home=min(imported, max(0, home - solar_home - battery_home)),
                solar_to_grid=min(exported, max(0, solar - solar_home - solar_charge)))


class Recorder:
    """Persisted forecasts and same-period daily counters, excluding outages."""
    def __init__(self, zone, restored=None):
        self.zone = ZoneInfo(zone)
        self.data = deepcopy(restored) if isinstance(restored, dict) else {}
        self.data.setdefault("forecast", {})
        self.data.setdefault("daily", {})
        self.previous_time = None
        self.previous_flow = None

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

    def _day(self, now):
        daily = self.data["daily"]
        if daily.get("local_date") != self.local_date(now):
            daily = {"local_date": self.local_date(now), "period_start": now.isoformat(),
                     "coverage_seconds": 0, "gap_seconds": 0, **{key: 0.0 for key in ENERGIES}}
            self.data["daily"] = daily
        return daily

    def sample(self, now, current):
        previous = self.previous_time
        if previous is None:
            # Do not integrate through downtime, even when the old value is restored.
            last = timestamp(self.data["daily"].get("updated_at"))
            daily = self._day(now)
            if last and self.local_date(last) == self.local_date(now):
                daily["gap_seconds"] += max(0, (now - last).total_seconds())
        elif now > previous:
            cursor = previous
            elapsed = (now - previous).total_seconds()
            while cursor < now:
                daily = self._day(cursor)
                midnight = (cursor.astimezone(self.zone).date() + timedelta(days=1))
                boundary = datetime.combine(midnight, datetime.min.time(), self.zone).astimezone(UTC)
                stop = min(boundary, now)
                seconds = (stop - cursor).total_seconds()
                if self.previous_flow is not None and elapsed <= 120:
                    for key in ENERGIES:
                        daily[key] += self.previous_flow[key] * seconds / 3_600_000
                    daily["coverage_seconds"] += seconds
                else:
                    daily["gap_seconds"] += seconds
                cursor = stop
        daily = self._day(now)
        daily["updated_at"] = now.isoformat()
        daily["source_available"] = current is not None
        self.previous_time, self.previous_flow = now, current
        return daily
