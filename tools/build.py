#!/usr/bin/env python3
"""Render denný rodinný prehľad: data/*.json + themes/<id>/ → designs/<id>/.

Jedna stránka na deň s pohľadmi Rodina → osoby (žiadne odkazy medzi stránkami).
Timeline HTML/CSS pri builde; view.js prepína pohľady (Chromium 81).

  python3 tools/build.py
"""
from __future__ import annotations

import html
import json
import os
import shutil
from datetime import date

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "data")
THEMES = os.path.join(ROOT, "themes")
DESIGNS = os.path.join(ROOT, "designs")
AVATARS = os.path.join(ROOT, "assets", "avatars")
WEATHER = os.path.join(ROOT, "assets", "weather")

WEEKDAYS_SK = [
    "pondelok", "utorok", "streda", "štvrtok", "piatok", "sobota", "nedeľa",
]
MONTHS_SK = [
    "", "január", "február", "marec", "apríl", "máj", "jún",
    "júl", "august", "september", "október", "november", "december",
]
STATUS_SK = {
    "confirmed": "potvrdené",
    "unconfirmed": "treba potvrdiť",
    "tentative": "nezáväzné",
    "todo": "úloha",
}
ICON_SK = {
    "sunny": "slnečno",
    "partly-cloudy": "polojasno",
    "cloudy": "zamračené",
    "rain": "dážď",
    "snow": "sneženie",
    "fog": "hmla",
    "storm": "búrka",
}

# Fixed column order for the family calendar
PEOPLE_ORDER = ["branislav", "zuzka", "andrej", "tomas"]


def esc(s):
    return html.escape("" if s is None else str(s), quote=True)


def rd(*parts):
    with open(os.path.join(*parts), encoding="utf-8") as f:
        return f.read()


def load_json(*parts):
    with open(os.path.join(*parts), encoding="utf-8") as f:
        return json.load(f)


def write(path, text):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8", newline="\n") as f:
        f.write(text)


def theme_ids():
    return sorted(
        d for d in os.listdir(THEMES)
        if not d.startswith("_") and os.path.isfile(os.path.join(THEMES, d, "theme.json"))
    )


def theme_meta(tid):
    return load_json(THEMES, tid, "theme.json")


def parse_hhmm(value):
    if not value:
        return None
    h, m = value.split(":")
    return int(h) * 60 + int(m)


def fmt_date_sk(iso):
    d = date.fromisoformat(iso[:10])
    return f"{WEEKDAYS_SK[d.weekday()]} {d.day}. {MONTHS_SK[d.month]} {d.year}"


def fmt_date_short(iso):
    d = date.fromisoformat(iso[:10])
    return f"{d.day}. {d.month}. {d.year}"


def fmt_range(ev):
    if ev.get("all_day"):
        return "celý deň"
    if ev.get("time_note") and not ev.get("start"):
        return ev["time_note"]
    if not ev.get("start"):
        return "čas neznámy"
    start = ev["start"]
    end = ev.get("end")
    return f"{start}–{end}" if end else start


def event_members(ev):
    """Normalize to members[] (compat: legacy member string)."""
    if isinstance(ev.get("members"), list) and ev["members"]:
        return [m for m in ev["members"] if m in PEOPLE_ORDER or m == "rodina"]
    if ev.get("member"):
        mid = ev["member"]
        if mid == "rodina":
            return list(PEOPLE_ORDER)
        return [mid]
    return []


def expand_members(mids):
    """Map rodina → all four people."""
    out = []
    for m in mids:
        if m == "rodina":
            out.extend(PEOPLE_ORDER)
        elif m in PEOPLE_ORDER and m not in out:
            out.append(m)
    # preserve PEOPLE_ORDER
    return [p for p in PEOPLE_ORDER if p in out]


def members_by_id(pack):
    return {m["id"]: m for m in pack["members"]}


def people_list(pack):
    by = members_by_id(pack)
    return [by[i] for i in PEOPLE_ORDER if i in by]


def family_meta(pack):
    return pack.get("family") or {
        "id": "rodina",
        "display_name": "Rodina",
        "color": "#4A6670",
        "avatar": "rodina.svg",
    }


def timeline_bounds(day):
    start = parse_hhmm(day["timeline"]["start"])
    end = parse_hhmm(day["timeline"]["end"])
    for ev in day.get("events", []):
        if ev.get("all_day"):
            continue
        s = parse_hhmm(ev.get("start"))
        e = parse_hhmm(ev.get("end"))
        if s is not None:
            start = min(start, s)
        if e is not None:
            end = max(end, e)
        elif s is not None:
            end = max(end, s + 30)
    start = (start // 60) * 60
    end = ((end + 59) // 60) * 60
    if end <= start:
        end = start + 60
    return start, end


def pct(minute, start, end):
    return 100.0 * (minute - start) / (end - start)


def hour_labels(start, end):
    out = []
    m = start
    while m <= end:
        out.append(m)
        m += 60
    return out


def contiguous_spans(indices):
    """Split sorted column indices into contiguous [lo, hi] inclusive spans."""
    if not indices:
        return []
    indices = sorted(set(indices))
    spans = []
    lo = hi = indices[0]
    for i in indices[1:]:
        if i == hi + 1:
            hi = i
        else:
            spans.append((lo, hi))
            lo = hi = i
    spans.append((lo, hi))
    return spans


def copy_site_assets(out_dir):
    fonts_src = os.path.join(THEMES, "_shared", "fonts")
    fonts_dst = os.path.join(out_dir, "fonts")
    if os.path.isdir(fonts_src):
        if os.path.isdir(fonts_dst):
            shutil.rmtree(fonts_dst)
        shutil.copytree(fonts_src, fonts_dst)
    for name, src in (("avatars", AVATARS), ("weather", WEATHER)):
        dst = os.path.join(out_dir, name)
        if os.path.isdir(dst):
            shutil.rmtree(dst)
        if os.path.isdir(src):
            shutil.copytree(src, dst)
    shutil.copy2(os.path.join(THEMES, "_shared", "view.js"), os.path.join(out_dir, "view.js"))


def site_css():
    """Fonts + layout + dark + light (toggle via html.theme-dark|theme-light)."""
    return "\n".join([
        rd(THEMES, "_shared", "fonts.css"),
        rd(THEMES, "_shared", "base.css"),
        rd(THEMES, "_shared", "dark.css"),
        rd(THEMES, "_shared", "light.css"),
    ])


def theme_schedule(pack, day):
    """dark_from / dark_until — day JSON overrides members.json."""
    sched = dict(pack.get("theme_schedule") or {})
    sched.update(day.get("theme_schedule") or {})
    return {
        "dark_from": sched.get("dark_from") or "19:00",
        "dark_until": sched.get("dark_until") or "06:30",
    }


def weather_icon_svg(icon):
    path = os.path.join(WEATHER, f"{icon}.svg")
    if not os.path.isfile(path):
        path = os.path.join(WEATHER, "cloudy.svg")
    raw = rd(path)
    # strip xml decl for inline
    if raw.startswith("<?xml"):
        raw = raw.split("?>", 1)[-1].strip()
    return raw


def house_icon_svg():
    return (
        '<svg class="home-glyph" xmlns="http://www.w3.org/2000/svg" width="36" height="36" '
        'viewBox="0 0 24 24" aria-hidden="true" focusable="false">'
        '<path fill="currentColor" d="M12 3.2 21 11h-2.5v8.5h-5V13H10.5v6.5h-5V11H3L12 3.2z"/>'
        "</svg>"
    )


def event_block_html(ev, color, top, height, left_pct, width_pct, extra_class="", short=False):
    s = parse_hhmm(ev.get("start"))
    e = parse_hhmm(ev.get("end")) or ((s + 30) if s is not None else None)
    conflict = " is-conflict" if ("conflict" in ev.get("flags", []) or ev.get("conflict_with")) else ""
    unconf = " is-unconfirmed" if ev.get("status") in ("unconfirmed", "tentative") else ""
    todo = " is-todo" if ev.get("status") == "todo" else ""
    short_c = " is-short" if short else ""
    loc = f'<span class="ev-loc">{esc(ev["location"])}</span>' if ev.get("location") else ""
    status = STATUS_SK.get(ev.get("status", ""), "")
    flag_bits = []
    if conflict.strip():
        flag_bits.append("konflikt")
    if "needs-ride" in ev.get("flags", []):
        flag_bits.append("odvoz")
    flags = f'<span class="ev-flags">{esc(" · ".join(flag_bits))}</span>' if flag_bits else ""
    st = (
        f'<span class="ev-status">{esc(status)}</span>'
        if status and ev.get("status") != "confirmed"
        else ""
    )
    end_attr = f' data-end-min="{e}"' if e is not None else ""
    mids = ",".join(expand_members(event_members(ev)))
    return (
        f'<div class="event-block{short_c}{conflict}{unconf}{todo}{extra_class}" '
        f'style="top:{top:.3f}%;height:{height:.3f}%;left:{left_pct:.3f}%;'
        f'width:{width_pct:.3f}%;--m:{esc(color)}" '
        f'data-members="{esc(mids)}"{end_attr}>'
        f'<span class="ev-time">{esc(fmt_range(ev))}</span>'
        f'<span class="ev-title">{esc(ev["title"])}</span>'
        f"{loc}{st}{flags}</div>"
    )


def place_events_in_track(events, start, end, color_for_ev, n_cols=1):
    """Absolute-position blocks in a single track; simple overlap columns."""
    timed = [e for e in events if e.get("start") and not e.get("all_day")]
    timed = sorted(timed, key=lambda x: parse_hhmm(x["start"]))
    placed = []
    blocks = []
    for e in timed:
        s = parse_hhmm(e["start"])
        ee = parse_hhmm(e.get("end")) or (s + 30)
        col = 0
        used = {c for end_m, c in placed if end_m > s}
        while col in used:
            col += 1
        placed.append((ee, col))
        placed = [(em, c) for em, c in placed if em > s]
        n = max((c for _, c in placed), default=0) + 1
        width = 100.0 / max(n, col + 1)
        left = col * width
        top = pct(s, start, end)
        height = max(pct(ee, start, end) - top, 8.5)
        short = (ee - s) <= 45
        blocks.append(
            event_block_html(e, color_for_ev(e), top, height, left, width, short=short)
        )
    return blocks


def family_calendar(day, people, start, end):
    """4-column family calendar with spanning events."""
    labels = hour_labels(start, end)
    lines = []
    for m in labels:
        top = pct(m, start, end)
        lines.append(
            f'<div class="tl-hour" style="top:{top:.3f}%">'
            f'<span class="tl-hour-label">{m // 60:02d}:00</span></div>'
        )

    heads = []
    for p in people:
        heads.append(
            f'<div class="lane-head" style="--m:{esc(p["color"])}" data-person="{esc(p["id"])}">'
            f'<img class="avatar" src="avatars/{esc(p["avatar"])}" alt="" width="44" height="44">'
            f'<span class="lane-name">{esc(p["display_name"])}</span></div>'
        )

    # Build per-column event lists for non-spanning; spanning drawn on overlay
    id_to_idx = {p["id"]: i for i, p in enumerate(people)}
    n = len(people)
    col_events = {p["id"]: [] for p in people}
    span_blocks = []

    timed = [e for e in day.get("events", []) if e.get("start") and not e.get("all_day")]
    for e in timed:
        mids = expand_members(event_members(e))
        if not mids:
            continue
        indices = [id_to_idx[m] for m in mids if m in id_to_idx]
        if not indices:
            continue
        spans = contiguous_spans(indices)
        # Single person → column list (overlap handling later)
        if len(mids) == 1 and len(spans) == 1 and spans[0][0] == spans[0][1]:
            col_events[mids[0]].append(e)
            continue
        # Multi: each contiguous span as one block across columns
        s = parse_hhmm(e["start"])
        ee = parse_hhmm(e.get("end")) or (s + 30)
        top = pct(s, start, end)
        height = max(pct(ee, start, end) - top, 8.5)
        short = (ee - s) <= 45
        # color: if all four → family slate; else first member color
        if len(mids) >= 4:
            color = "#4A6670"
        else:
            color = next(p["color"] for p in people if p["id"] == mids[0])
        for lo, hi in spans:
            left = (lo / n) * 100.0
            width = ((hi - lo + 1) / n) * 100.0
            span_blocks.append(
                event_block_html(
                    e, color, top, height, left, width,
                    extra_class=" is-span", short=short,
                )
            )

    cols = []
    for p in people:
        blocks = place_events_in_track(
            col_events[p["id"]], start, end, lambda ev, c=p["color"]: c
        )
        cols.append(
            f'<div class="lane-col" data-person="{esc(p["id"])}" style="--m:{esc(p["color"])}">'
            f'{"".join(blocks)}</div>'
        )

    now_html = (
        '<div class="tl-now" style="top:0">'
        '<span class="tl-now-label">teraz</span></div>'
    )

    return f"""
<div class="calendar calendar-family" data-mode="family">
  <div class="lane-heads lane-heads-4">{"".join(heads)}</div>
  <div class="tl-body">
    <div class="tl-hours">{"".join(lines)}</div>
    <div class="tl-lanes tl-lanes-4">{"".join(cols)}</div>
    <div class="tl-span-layer">{"".join(span_blocks)}</div>
    {now_html}
  </div>
</div>
"""


def member_calendar(day, people, focus_id, start, end):
    """Wide focus column + narrow ostatní merged column."""
    focus = next(p for p in people if p["id"] == focus_id)
    others = [p for p in people if p["id"] != focus_id]
    labels = hour_labels(start, end)
    lines = []
    for m in labels:
        top = pct(m, start, end)
        lines.append(
            f'<div class="tl-hour" style="top:{top:.3f}%">'
            f'<span class="tl-hour-label">{m // 60:02d}:00</span></div>'
        )

    heads = (
        f'<div class="lane-head lane-head-focus" style="--m:{esc(focus["color"])}">'
        f'<img class="avatar" src="avatars/{esc(focus["avatar"])}" alt="" width="48" height="48">'
        f'<span class="lane-name">{esc(focus["display_name"])}</span></div>'
        f'<div class="lane-head lane-head-others">'
        f'<span class="lane-name">ostatní</span></div>'
    )

    focus_ev = []
    other_unique = []
    seen_other = set()
    for e in day.get("events", []):
        if not e.get("start") or e.get("all_day"):
            continue
        mids = expand_members(event_members(e))
        if focus_id in mids:
            focus_ev.append(e)
        if any(m != focus_id for m in mids):
            if e["id"] not in seen_other:
                seen_other.add(e["id"])
                other_unique.append(e)

    def focus_color(ev):
        return focus["color"]

    def other_color(ev):
        mids = expand_members(event_members(ev))
        for p in people:
            if p["id"] in mids and p["id"] != focus_id:
                return p["color"]
        return "#6b7280"

    focus_blocks = place_events_in_track(focus_ev, start, end, focus_color)
    other_blocks = place_events_in_track(other_unique, start, end, other_color)

    now_html = (
        '<div class="tl-now" style="top:0">'
        '<span class="tl-now-label">teraz</span></div>'
    )

    return f"""
<div class="calendar calendar-member" data-mode="member" data-focus="{esc(focus_id)}">
  <div class="lane-heads lane-heads-2">{heads}</div>
  <div class="tl-body">
    <div class="tl-hours">{"".join(lines)}</div>
    <div class="tl-lanes tl-lanes-2">
      <div class="lane-col lane-col-focus" style="--m:{esc(focus["color"])}">{"".join(focus_blocks)}</div>
      <div class="lane-col lane-col-others">{"".join(other_blocks)}</div>
    </div>
    {now_html}
  </div>
</div>
"""


def untimed_strip(day, people_map):
    floating = [
        e for e in day.get("events", [])
        if e.get("all_day") or not e.get("start")
    ]
    if not floating:
        return '<div class="allday-row" hidden></div>'
    chips = []
    for e in floating:
        mids = expand_members(event_members(e))
        # color from first member
        color = "#4A6670"
        label = "Rodina"
        if mids:
            m = people_map.get(mids[0], {})
            color = m.get("color", color)
            if len(mids) == 1:
                label = m.get("display_name", "")
            elif len(mids) >= 4:
                label = "Rodina"
            else:
                label = "+".join(
                    people_map[i]["display_name"] for i in mids if i in people_map
                )
        status = STATUS_SK.get(e.get("status", ""), "")
        conflict = " is-conflict" if "conflict" in e.get("flags", []) else ""
        unconf = " is-unconfirmed" if e.get("status") in ("unconfirmed", "tentative") else ""
        mem_classes = " ".join(f"mem-{m}" for m in mids) or "mem-none"
        chips.append(
            f'<div class="allday-chip{conflict}{unconf} {mem_classes}" style="--m:{esc(color)}" '
            f'data-members="{esc(",".join(mids))}">'
            f"<strong>{esc(label)}</strong> {esc(e['title'])}"
            f'<span class="chip-meta">{esc(fmt_range(e))}'
            f'{(" · " + status) if status else ""}</span></div>'
        )
    return f'<div class="allday-row">{"".join(chips)}</div>'


def day_sections(day):
    out = []
    for sec in day.get("sections") or []:
        items = [it for it in (sec.get("items") or []) if isinstance(it, dict) and it.get("text")]
        if not items:
            continue
        out.append({"id": sec.get("id") or "", "title": sec.get("title") or "", "items": items})
    return out


def is_outlook(sec):
    sid = (sec.get("id") or "").lower()
    title = (sec.get("title") or "").lower()
    return sid == "vyhlad" or "víkend" in title or "zajtra" in title


def sidebar_html(day, people_map):
    sections = day_sections(day)
    main_secs = [s for s in sections if not is_outlook(s)]
    outlook = [s for s in sections if is_outlook(s)]

    def items_html(items):
        lis = []
        for it in items:
            mid = it.get("member")
            text = it.get("text") or ""
            detail = it.get("detail") or text
            who = ""
            data_m = mid or ""
            # family: false or level: "detail" → hide in Rodina view
            show_family = True
            if it.get("family") is False or it.get("level") == "detail":
                show_family = False
            if mid and mid in people_map:
                m = people_map[mid]
                who = (
                    f'<span class="hl-who" style="--m:{esc(m["color"])}">'
                    f'{esc(m["display_name"])}</span> '
                )
            lis.append(
                f'<li data-member="{esc(data_m)}" data-family="{1 if show_family else 0}">'
                f"{who}"
                f'<span class="item-text">{esc(text)}</span>'
                f'<span class="item-detail">{esc(detail)}</span>'
                f"</li>"
            )
        return "<ul>\n" + "\n".join(lis) + "\n</ul>"

    blocks = []
    for sec in main_secs:
        blocks.append(
            f'<section class="hl-block" data-section="{esc(sec["id"])}">'
            f"<h3>{esc(sec['title'])}</h3>"
            f"{items_html(sec['items'])}</section>"
        )
    main = "".join(blocks) or '<p class="empty-inline">Žiadne poznámky.</p>'

    outlook_html = ""
    for sec in outlook:
        outlook_html += (
            f'<aside class="outlook-box" data-section="{esc(sec["id"])}">'
            f'<h3>{esc(sec["title"])}</h3>'
            f"{items_html(sec['items'])}</aside>"
        )

    return f"""
<aside class="panel sidebar-panel">
  <div class="sidebar-main">
    <h2 class="sidebar-title">Dôležité</h2>
    {main}
  </div>
  {outlook_html}
</aside>
"""


ROLE_EYEBROW = {
    "otec": "Otec",
    "mama": "Mama",
    "dieta": "Syn",
    "rodina": "Rodinný prehľad",
}


def who_header(people, family):
    parts = [
        f'<div class="who who-rodina" data-who="rodina" style="--m:{esc(family.get("color", "#4A6670"))}">'
        f'<img class="avatar" src="avatars/{esc(family["avatar"])}" alt="" width="52" height="52">'
        f'<span class="who-name">{esc(family["display_name"])}</span></div>'
    ]
    for p in people:
        parts.append(
            f'<div class="who who-{esc(p["id"])}" data-who="{esc(p["id"])}" style="--m:{esc(p["color"])}">'
            f'<img class="avatar" src="avatars/{esc(p["avatar"])}" alt="" width="52" height="52">'
            f'<span class="who-name">{esc(p["display_name"])}</span></div>'
        )
    return f'<div class="view-who">{"".join(parts)}</div>'


def eyebrow_html(people):
    """Kicker above the date — changes with the active view."""
    bits = [
        '<p class="eyebrow eyebrow-rodina" data-who="rodina">Rodinný prehľad</p>'
    ]
    for p in people:
        label = ROLE_EYEBROW.get(p.get("role"), p["display_name"])
        # Prefer school grade for kids when present
        meta = p.get("meta") or {}
        if p.get("role") == "dieta" and meta.get("grade"):
            label = meta["grade"]
        bits.append(
            f'<p class="eyebrow eyebrow-{esc(p["id"])}" data-who="{esc(p["id"])}">{esc(label)}</p>'
        )
    return f'<div class="eyebrow-swap">{"".join(bits)}</div>'


def render_day_page(day, pack):
    people = people_list(pack)
    people_map = members_by_id(pack)
    family = family_meta(pack)
    start, end = timeline_bounds(day)
    d = day["date"]
    sched = theme_schedule(pack, day)
    w = day.get("weather") or {}

    calendars = [family_calendar(day, people, start, end)]
    for p in people:
        calendars.append(member_calendar(day, people, p["id"], start, end))

    body = f"""
<div class="frame page-day">
  <header class="topbar">
    <div class="home-icon" title="Domov" aria-hidden="true">{house_icon_svg()}</div>
    <div class="topbar-date">
      {eyebrow_html(people)}
      <h1>{esc(fmt_date_sk(d))}</h1>
    </div>
    <div class="top-divider" aria-hidden="true"></div>
    {who_header(people, family)}
    <div class="topbar-spacer"></div>
    <div class="weather" data-icon="{esc(w.get("icon", ""))}">
      <span class="wx-icon">{weather_icon_svg(w.get("icon", "cloudy"))}</span>
      <div class="wx-text">
        <span class="wx-temps">{esc(w.get("temp_low_c"))}–{esc(w.get("temp_high_c"))} °C</span>
        <span class="wx-summary">{esc(w.get("summary") or "")}</span>
      </div>
    </div>
  </header>
  <div class="day-main">
    <section class="panel cal-panel">
      {untimed_strip(day, people_map)}
      <div class="calendars">
        {"".join(calendars)}
      </div>
    </section>
    {sidebar_html(day, people_map)}
  </div>
</div>
<script src="view.js"></script>
"""

    css = site_css()
    return f"""<!doctype html>
<html lang="sk" class="theme-dark">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=1024, height=768, initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<meta name="theme-color" content="#0B1220">
<title>{esc(fmt_date_sk(d))} — rodinný prehľad</title>
<style>
{css}
</style>
</head>
<body class="page-day"
  data-view="rodina"
  data-date="{esc(d)}"
  data-timezone="{esc(day.get("timezone") or "Europe/Prague")}"
  data-fallback-now="{esc(day.get("now") or "")}"
  data-refresh-at="{esc(day.get("refresh_at") or "06:30")}"
  data-dark-from="{esc(sched["dark_from"])}"
  data-dark-until="{esc(sched["dark_until"])}"
  data-day-start="{start}"
  data-day-end="{end}"
  data-lock-now="0">
{body}
</body>
</html>
"""


def render_site_index(dates, primary):
    links = "".join(
        f'<li><a href="{esc(d)}.html">{esc(fmt_date_sk(d))}</a>'
        f' · <a href="{esc(d)}.html?theme=light">light</a>'
        f' · <a href="{esc(d)}.html?theme=dark">dark</a></li>'
        for d in dates
    )
    return f"""<!doctype html>
<html lang="sk">
<head>
<meta charset="utf-8">
<meta name="robots" content="noindex,nofollow">
<title>Denný prehľad — index</title>
<script>
(function(){{
  var dates = {json.dumps(dates)};
  var primary = {json.dumps(primary)};
  var today;
  try {{
    today = new Intl.DateTimeFormat("en-CA", {{ timeZone: "Europe/Prague" }}).format(new Date());
  }} catch (e) {{ today = primary; }}
  var target = primary;
  for (var i = 0; i < dates.length; i++) if (dates[i] === today) target = today;
  location.replace(target + ".html" + (location.search || ""));
}})();
</script>
</head>
<body>
<p>Presmerovanie na dnešný deň…</p>
<ul>{links}</ul>
<p><a href="archive/">Archív starých návrhov (Papier / Farbičky / Večerná)</a></p>
</body>
</html>
"""


def render_designs_hub(dates):
    day_links = "".join(
        f'<li><strong>{esc(fmt_date_sk(d))}</strong> — '
        f'<a href="{esc(d)}.html">auto</a> · '
        f'<a href="{esc(d)}.html?theme=light">light</a> · '
        f'<a href="{esc(d)}.html?theme=dark">dark</a></li>'
        for d in dates
    )
    return f"""<!doctype html>
<html lang="sk">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>Denný prehľad — dark / light</title>
<style>
  body {{ margin: 0; font: 20px/1.45 system-ui, sans-serif; color: #1a1f24; background: #e7eef2; }}
  main {{ max-width: 820px; margin: 0 auto; padding: 1.6rem 1.2rem 3rem; }}
  h1 {{ font-size: 2rem; margin: .3rem 0 .4rem; }}
  .lede {{ color: #3d4a52; margin: 0 0 1.4rem; }}
  ul {{ margin: 0; padding-left: 1.2em; }}
  li {{ margin: 0 0 .6rem; }}
  a {{ color: #1f4f6e; }}
</style>
</head>
<body>
<main>
  <h1>Denný rodinný prehľad</h1>
  <p class="lede">Jedna stránka na deň — režimy <strong>dark</strong> (Večerná) a <strong>light</strong>
  (tá istá štruktúra, Papier paleta). Prepínanie podľa času Europe/Prague
  (predvolene dark 19:00–06:30), alebo <code>?theme=light|dark</code>.
  Pohľady Rodina → Braňo → Zuzka → Andrej → Tomáš (Tab / Enter).</p>
  <ul>{day_links}</ul>
  <p><a href="index.html">index (dnes)</a> · <a href="archive/">archív starých A/B/C návrhov</a></p>
</main>
</body>
</html>
"""


def build():
    pack = load_json(DATA, "members.json")
    days = []
    for name in sorted(os.listdir(DATA)):
        if name.endswith(".json") and name[0].isdigit():
            days.append(load_json(DATA, name))
    dates = [d["date"] for d in days]
    primary = "2026-11-06" if "2026-11-06" in dates else (dates[0] if dates else None)

    os.makedirs(DESIGNS, exist_ok=True)
    # Remove stale top-level HTML from prior multi-theme layout (keep archive/)
    for fn in os.listdir(DESIGNS):
        path = os.path.join(DESIGNS, fn)
        if fn.endswith(".html") and os.path.isfile(path):
            os.remove(path)

    copy_site_assets(DESIGNS)
    for day in days:
        write(os.path.join(DESIGNS, f'{day["date"]}.html'), render_day_page(day, pack))
        print(f"built designs/{day['date']}.html")

    write(os.path.join(DESIGNS, "index.html"), render_site_index(dates, primary))
    write(os.path.join(DESIGNS, "hub.html"), render_designs_hub(dates))
    # Convenience: hub as main listing — also overwrite designs/index? Keep index as today redirect.
    print("built designs/index.html + hub.html")


if __name__ == "__main__":
    build()
