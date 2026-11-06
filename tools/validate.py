#!/usr/bin/env python3
"""Validate data/*.json against SCHEMA.md / RULES.md. Exit 1 on any error."""
from __future__ import annotations

import json
import os
import re
import sys
from datetime import date

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "data")

PEOPLE = ["branislav", "zuzka", "andrej", "tomas"]
STATUSES = {"confirmed", "unconfirmed", "tentative", "todo"}
FLAGS = {"conflict", "needs-ride", "pickup", "time-tbd"}
WEATHER_ICONS = {"sunny", "partly-cloudy", "cloudy", "rain", "snow", "fog", "storm"}
HHMM = re.compile(r"^\d{1,2}:\d{2}$")
ISO_DATE = re.compile(r"^\d{4}-\d{2}-\d{2}$")

OUTLOOK_TITLES = {
    0: "Zajtra",      # Mon
    1: "Zajtra",      # Tue
    2: "Zajtra",      # Wed
    3: "Zajtra",      # Thu
    4: "Víkend",      # Fri
    5: "Pondelok",    # Sat
    6: "Zajtra",      # Sun
}


class Errors:
    def __init__(self):
        self.items = []

    def add(self, where, msg):
        self.items.append(f"{where}: {msg}")

    def __bool__(self):
        return bool(self.items)


def load(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def check_hhmm(val, where, err, allow_null=True):
    if val is None:
        if not allow_null:
            err.add(where, "missing HH:MM")
        return
    if not isinstance(val, str) or not HHMM.match(val):
        err.add(where, f"expected HH:MM, got {val!r}")
        return
    h, m = val.split(":")
    if not (0 <= int(h) <= 23 and 0 <= int(m) <= 59):
        err.add(where, f"out of range HH:MM {val!r}")


def validate_members(pack, err):
    where = "members.json"
    if not isinstance(pack, dict):
        err.add(where, "must be an object")
        return set()
    members = pack.get("members")
    if not isinstance(members, list) or not members:
        err.add(where, "members[] required")
        return set()
    ids = []
    for i, m in enumerate(members):
        w = f"{where} members[{i}]"
        if not isinstance(m, dict):
            err.add(w, "must be object")
            continue
        for key in ("id", "display_name", "color", "avatar"):
            if not m.get(key):
                err.add(w, f"missing {key}")
        mid = m.get("id")
        if mid:
            ids.append(mid)
    for expected in PEOPLE:
        if expected not in ids:
            err.add(where, f"missing member id {expected!r}")
    fam = pack.get("family")
    if not isinstance(fam, dict):
        err.add(where, "family object required")
    else:
        for key in ("id", "display_name", "color", "avatar"):
            if not fam.get(key):
                err.add(f"{where} family", f"missing {key}")
    sched = pack.get("theme_schedule") or {}
    if sched:
        mode = (sched.get("mode") or "").lower()
        if mode and mode not in ("sun", "fixed"):
            err.add(f"{where} theme_schedule.mode", f"expected sun|fixed, got {mode!r}")
        if mode == "sun" or (sched.get("lat") is not None and sched.get("lon") is not None):
            for key in ("lat", "lon"):
                if not isinstance(sched.get(key), (int, float)):
                    err.add(f"{where} theme_schedule.{key}", "number required for sun mode")
            for key in ("sunrise_offset_min", "sunset_offset_min"):
                if key in sched and not isinstance(sched[key], (int, float)):
                    err.add(f"{where} theme_schedule.{key}", "must be number (minutes)")
        check_hhmm(sched.get("dark_from"), f"{where} theme_schedule.dark_from", err)
        check_hhmm(sched.get("dark_until"), f"{where} theme_schedule.dark_until", err)
    return set(ids)


def validate_day(path, known_ids, err):
    name = os.path.basename(path)
    where = name
    try:
        day = load(path)
    except Exception as e:
        err.add(where, f"invalid JSON ({e})")
        return
    if not isinstance(day, dict):
        err.add(where, "must be an object")
        return

    d = day.get("date")
    if not isinstance(d, str) or not ISO_DATE.match(d):
        err.add(where, "date must be YYYY-MM-DD")
    else:
        stem = name[:-5] if name.endswith(".json") else name
        if stem != d:
            err.add(where, f"filename stem {stem!r} != date {d!r}")
        try:
            date.fromisoformat(d)
        except ValueError:
            err.add(where, f"invalid calendar date {d!r}")

    if day.get("timezone") not in (None, "Europe/Prague"):
        err.add(where, "timezone should be Europe/Prague")

    check_hhmm(day.get("now"), f"{where} now", err)
    check_hhmm(day.get("refresh_at"), f"{where} refresh_at", err)

    weather = day.get("weather")
    if not isinstance(weather, dict):
        err.add(where, "weather object required")
    else:
        icon = weather.get("icon")
        if icon not in WEATHER_ICONS:
            err.add(f"{where} weather.icon", f"unknown icon {icon!r}")
        if "summary" not in weather:
            err.add(f"{where} weather", "missing summary")
        for k in ("temp_high_c", "temp_low_c"):
            if k in weather and not isinstance(weather[k], (int, float)):
                err.add(f"{where} weather.{k}", "must be number")

    tl = day.get("timeline") or {}
    if tl:
        check_hhmm(tl.get("start"), f"{where} timeline.start", err, allow_null=False)
        check_hhmm(tl.get("end"), f"{where} timeline.end", err, allow_null=False)

    events = day.get("events")
    if events is None:
        err.add(where, "events[] required (may be empty)")
        events = []
    if not isinstance(events, list):
        err.add(where, "events must be an array")
        events = []

    for i, ev in enumerate(events):
        w = f"{where} events[{i}]"
        if not isinstance(ev, dict):
            err.add(w, "must be object")
            continue
        if not ev.get("id"):
            err.add(w, "missing id")
        if not ev.get("title"):
            err.add(w, "missing title")
        if "member" in ev and "members" not in ev:
            err.add(w, "legacy member string — use members[]")
        members = ev.get("members")
        if not isinstance(members, list) or not members:
            err.add(w, "members[] required (non-empty)")
        else:
            for mid in members:
                if mid == "rodina":
                    continue
                if mid not in known_ids and mid not in PEOPLE:
                    err.add(w, f"unknown member id {mid!r}")
        check_hhmm(ev.get("start"), f"{w} start", err)
        check_hhmm(ev.get("end"), f"{w} end", err)
        if ev.get("start") is None and not ev.get("time_note") and not ev.get("all_day"):
            # untimed band — time_note recommended per RULES
            pass
        status = ev.get("status", "confirmed")
        if status not in STATUSES:
            err.add(w, f"unknown status {status!r}")
        for fl in ev.get("flags") or []:
            if fl not in FLAGS:
                err.add(w, f"unknown flag {fl!r}")

    sections = day.get("sections")
    if sections is None:
        err.add(where, "sections[] required (may be empty)")
        sections = []
    if not isinstance(sections, list):
        err.add(where, "sections must be an array")
        sections = []

    for i, sec in enumerate(sections):
        w = f"{where} sections[{i}]"
        if not isinstance(sec, dict):
            err.add(w, "must be object")
            continue
        if not sec.get("id"):
            err.add(w, "missing id")
        title = sec.get("title")
        if not title:
            err.add(w, "missing title")
        items = sec.get("items")
        if not isinstance(items, list) or not items:
            err.add(w, "items[] required and non-empty (omit empty sections)")
            continue
        for j, it in enumerate(items):
            iw = f"{w} items[{j}]"
            if not isinstance(it, dict):
                err.add(iw, "must be object")
                continue
            if not (it.get("text") or "").strip():
                err.add(iw, "text required")
            mid = it.get("member")
            if mid is not None and mid not in known_ids and mid not in PEOPLE:
                err.add(iw, f"unknown member id {mid!r}")

        # Outlook title rule
        if (sec.get("id") or "").lower() == "vyhlad":
            if title == "Zajtra / Víkend":
                err.add(w, 'outlook title must never be "Zajtra / Víkend"')
            if d and ISO_DATE.match(d):
                try:
                    wd = date.fromisoformat(d).weekday()
                    expected = OUTLOOK_TITLES[wd]
                    if title != expected:
                        err.add(
                            w,
                            f"outlook title for {d} (weekday {wd}) should be {expected!r}, got {title!r}",
                        )
                except ValueError:
                    pass

    sched = day.get("theme_schedule") or {}
    if sched:
        check_hhmm(sched.get("dark_from"), f"{where} theme_schedule.dark_from", err)
        check_hhmm(sched.get("dark_until"), f"{where} theme_schedule.dark_until", err)


def main():
    err = Errors()
    members_path = os.path.join(DATA, "members.json")
    if not os.path.isfile(members_path):
        err.add("members.json", "file missing")
        known = set(PEOPLE)
    else:
        try:
            pack = load(members_path)
        except Exception as e:
            err.add("members.json", f"invalid JSON ({e})")
            pack = {}
        known = validate_members(pack, err) or set(PEOPLE)

    day_files = sorted(
        f for f in os.listdir(DATA)
        if f.endswith(".json") and f[0].isdigit()
    )
    if not day_files:
        err.add("data/", "no YYYY-MM-DD.json day files")
    for name in day_files:
        validate_day(os.path.join(DATA, name), known, err)

    if err:
        print("Schema validation FAILED:", file=sys.stderr)
        for item in err.items:
            print(f"  ✗ {item}", file=sys.stderr)
        print(f"\n{len(err.items)} error(s). See data/SCHEMA.md and data/RULES.md.", file=sys.stderr)
        return 1

    print(f"Schema OK — members.json + {len(day_files)} day file(s).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
