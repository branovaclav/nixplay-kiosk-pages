#!/usr/bin/env python3
"""Render denný rodinný prehľad: data/*.json + themes/<id>/ → designs/<id>/ (návrhy).

Timeline sa počíta pri builde (minúty → top/height %), výstup je čisté HTML/CSS.
Žiadna ťažká knižnica — len štandardná knižnica Pythonu.

  python3 tools/build.py
"""
from __future__ import annotations

import html
import json
import os
import shutil
from datetime import date, datetime

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "data")
THEMES = os.path.join(ROOT, "themes")
DESIGNS = os.path.join(ROOT, "designs")
AVATARS = os.path.join(ROOT, "assets", "avatars")

WEEKDAYS_SK = [
    "pondelok",
    "utorok",
    "streda",
    "štvrtok",
    "piatok",
    "sobota",
    "nedeľa",
]
MONTHS_SK = [
    "",
    "január",
    "február",
    "marec",
    "apríl",
    "máj",
    "jún",
    "júl",
    "august",
    "september",
    "október",
    "november",
    "december",
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
}


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
        d
        for d in os.listdir(THEMES)
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


def members_by_id(members):
    return {m["id"]: m for m in members}


def people_members(members):
    """Členovia na dlaždiciach / detailoch (bez Rodina)."""
    return [m for m in members if m["role"] != "rodina"]


def lane_members(members, day):
    """Pruhy na časovej osi: ľudia + Rodina, ak má udalosť."""
    people = people_members(members)
    has_family = any(e.get("member") == "rodina" for e in day.get("events", []))
    rodina = next((m for m in members if m["id"] == "rodina"), None)
    if has_family and rodina:
        return people + [rodina]
    return people


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
    # zaokrúhli na celé hodiny s rezervou
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


def avatar_href(member, depth=0):
    prefix = "../" * depth + "avatars/"
    return prefix + member["avatar"]


def copy_theme_assets(tid, out_dir):
    meta = theme_meta(tid)
    fonts_src = os.path.join(THEMES, tid, "fonts")
    fonts_dst = os.path.join(out_dir, "fonts")
    if os.path.isdir(fonts_src):
        if os.path.isdir(fonts_dst):
            shutil.rmtree(fonts_dst)
        shutil.copytree(fonts_src, fonts_dst)
    av_dst = os.path.join(out_dir, "avatars")
    if os.path.isdir(av_dst):
        shutil.rmtree(av_dst)
    shutil.copytree(AVATARS, av_dst)
    return meta


def theme_css(tid):
    meta = theme_meta(tid)
    parts = []
    for name in meta.get("css", ["fonts.css", "design.css"]):
        parts.append(rd(THEMES, tid, name))
    shared = os.path.join(THEMES, "_shared", "base.css")
    if os.path.isfile(shared):
        parts.insert(0, rd(shared))
    return "\n".join(parts)


def shell(tid, title, body, autofocus_sel=None, extra_class=""):
    meta = theme_meta(tid)
    css = theme_css(tid)
    focus_js = ""
    if autofocus_sel:
        # Chromium 81: jednoduchý focus pri načítaní
        focus_js = (
            "<script>"
            f"document.addEventListener('DOMContentLoaded',function(){{"
            f"var e=document.querySelector('{autofocus_sel}');"
            f"if(e)e.focus();}});</script>"
        )
    return f"""<!doctype html>
<html lang="sk">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=1024, height=768, initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<meta name="theme-color" content="{esc(meta.get('theme_color', '#333'))}">
<title>{esc(title)}</title>
<style>
{css}
</style>
</head>
<body class="theme-{esc(tid)} {esc(extra_class)}">
{body}
{focus_js}
</body>
</html>
"""


def weather_html(w):
    if not w:
        return ""
    sample = ' <span class="sample-flag" title="Ukážkové údaje">ukážka</span>' if w.get("sample") else ""
    summary = w.get("summary") or ICON_SK.get(w.get("icon", ""), "")
    hi = w.get("temp_high_c")
    lo = w.get("temp_low_c")
    temps = ""
    if hi is not None and lo is not None:
        temps = f'<span class="wx-temps">{esc(lo)}–{esc(hi)} °C</span>'
    elif hi is not None:
        temps = f'<span class="wx-temps">{esc(hi)} °C</span>'
    return (
        f'<div class="weather" data-icon="{esc(w.get("icon", ""))}">'
        f'<span class="wx-summary">{esc(summary)}</span>{temps}{sample}</div>'
    )


def highlight_items(items, members_map):
    if not items:
        return '<p class="empty-inline">Žiadne</p>'
    lis = []
    for it in items:
        if isinstance(it, str):
            text, mid = it, None
        else:
            text, mid = it.get("text", ""), it.get("member")
        who = ""
        if mid and mid in members_map:
            m = members_map[mid]
            who = (
                f'<span class="hl-who" style="--m:{esc(m["color"])}">'
                f'{esc(m["display_name"])}</span> '
            )
        lis.append(f"<li>{who}{esc(text)}</li>")
    return "<ul>\n" + "\n".join(lis) + "\n</ul>"


def nav_back(href, label="Späť"):
    return f'<a class="nav-back" href="{esc(href)}">{esc(label)}</a>'


def render_timeline(day, members, page_date):
    lanes = lane_members(members, day)
    start, end = timeline_bounds(day)
    labels = hour_labels(start, end)
    now_m = parse_hhmm(day.get("now"))

    # hour grid lines
    lines = []
    for m in labels:
        top = pct(m, start, end)
        hh = f"{m // 60:02d}:00"
        lines.append(
            f'<div class="tl-hour" style="top:{top:.3f}%">'
            f'<span class="tl-hour-label">{hh}</span></div>'
        )

    now_html = ""
    if now_m is not None and start <= now_m <= end:
        top = pct(now_m, start, end)
        now_html = (
            f'<div class="tl-now" style="top:{top:.3f}%">'
            f'<span class="tl-now-label">teraz {esc(day["now"])}</span></div>'
        )

    # all-day / untimed strip
    floating = [
        e
        for e in day.get("events", [])
        if e.get("all_day") or not e.get("start")
    ]
    float_html = ""
    if floating:
        chips = []
        mmap = members_by_id(members)
        for e in floating:
            m = mmap.get(e["member"], {})
            color = m.get("color", "#666")
            status = STATUS_SK.get(e.get("status", ""), "")
            conflict = " is-conflict" if "conflict" in e.get("flags", []) else ""
            unconf = " is-unconfirmed" if e.get("status") in ("unconfirmed", "tentative") else ""
            chips.append(
                f'<div class="allday-chip{conflict}{unconf}" style="--m:{esc(color)}">'
                f'<strong>{esc(m.get("display_name", ""))}</strong> '
                f'{esc(e["title"])}'
                f'<span class="chip-meta">{esc(fmt_range(e))}'
                f'{(" · " + status) if status else ""}</span></div>'
            )
        float_html = '<div class="allday-row">' + "".join(chips) + "</div>"

    # lane headers (focusable avatars → member page)
    heads = []
    cols = []
    mmap = members_by_id(members)
    timed = [e for e in day.get("events", []) if e.get("start") and not e.get("all_day")]

    for i, m in enumerate(lanes):
        autofocus = " autofocus" if i == 0 else ""
        href = f"{page_date}-{m['id']}.html" if m["role"] != "rodina" else f"{page_date}.html"
        if m["role"] == "rodina":
            heads.append(
                f'<div class="lane-head lane-head-static" style="--m:{esc(m["color"])}">'
                f'<img class="avatar" src="{esc(avatar_href(m))}" alt="" width="48" height="48">'
                f'<span class="lane-name">{esc(m["display_name"])}</span></div>'
            )
        else:
            heads.append(
                f'<a class="lane-head" href="{esc(href)}" style="--m:{esc(m["color"])}"{autofocus}>'
                f'<img class="avatar" src="{esc(avatar_href(m))}" alt="" width="48" height="48">'
                f'<span class="lane-name">{esc(m["display_name"])}</span></a>'
            )

        blocks = []
        lane_events = [e for e in timed if e.get("member") == m["id"]]
        # simple overlap columns within lane
        placed = []  # list of (end_minute, col)
        for e in sorted(lane_events, key=lambda x: parse_hhmm(x["start"])):
            s = parse_hhmm(e["start"])
            ee = parse_hhmm(e.get("end")) or (s + 30)
            col = 0
            used = {c for end_m, c in placed if end_m > s}
            while col in used:
                col += 1
            placed.append((ee, col))
            placed = [(em, c) for em, c in placed if em > s]
            n_cols = max((c for _, c in placed), default=0) + 1
            # recompute width based on concurrent — approximate with col count at place time
            width = 100.0 / max(n_cols, col + 1)
            left = col * width
            top = pct(s, start, end)
            # Min ~40 px on a 480 px track so 30-min blocks still show a title.
            height = max(pct(ee, start, end) - top, 8.5)
            short = " is-short" if (ee - s) <= 45 else ""
            conflict = " is-conflict" if ("conflict" in e.get("flags", []) or e.get("conflict_with")) else ""
            unconf = " is-unconfirmed" if e.get("status") in ("unconfirmed", "tentative") else ""
            todo = " is-todo" if e.get("status") == "todo" else ""
            loc = f'<span class="ev-loc">{esc(e["location"])}</span>' if e.get("location") else ""
            status = STATUS_SK.get(e.get("status", ""), "")
            flag_bits = []
            if conflict:
                flag_bits.append("konflikt")
            if "needs-ride" in e.get("flags", []):
                flag_bits.append("odvoz")
            flags = (
                f'<span class="ev-flags">{esc(" · ".join(flag_bits))}</span>'
                if flag_bits
                else ""
            )
            st = f'<span class="ev-status">{esc(status)}</span>' if status and e.get("status") != "confirmed" else ""
            blocks.append(
                f'<div class="event-block{short}{conflict}{unconf}{todo}" '
                f'style="top:{top:.3f}%;height:{height:.3f}%;left:{left:.3f}%;width:{width:.3f}%;--m:{esc(m["color"])}">'
                f'<span class="ev-time">{esc(fmt_range(e))}</span>'
                f'<span class="ev-title">{esc(e["title"])}</span>'
                f"{loc}{st}{flags}</div>"
            )
        cols.append(f'<div class="lane-col" style="--m:{esc(m["color"])}">{"".join(blocks)}</div>')

    n = len(lanes)
    return f"""
{float_html}
<div class="timeline" style="--lanes:{n}">
  <div class="lane-heads" style="--lanes:{n}">{"".join(heads)}</div>
  <div class="tl-body" style="--lanes:{n}">
    <div class="tl-hours">{"".join(lines)}</div>
    <div class="tl-lanes">{"".join(cols)}</div>
    {now_html}
  </div>
</div>
"""


def render_overview(tid, day, members):
    mmap = members_by_id(members)
    d = day["date"]
    hl = day.get("highlights", {})
    timeline = render_timeline(day, members, d)
    body = f"""
<div class="frame page-overview">
  <header class="topbar">
    {nav_back("home.html", "Domov")}
    <div class="topbar-main">
      <p class="eyebrow">Rodinný prehľad</p>
      <h1>{esc(fmt_date_sk(d))}</h1>
    </div>
    {weather_html(day.get("weather"))}
  </header>
  <div class="overview-grid">
    <section class="panel timeline-panel" aria-label="Časová os">
      {timeline}
    </section>
    <aside class="panel highlights-panel" aria-label="Dôležité">
      <h2>Dôležité</h2>
      <section class="hl-block">
        <h3>Rodina</h3>
        {highlight_items(hl.get("family_notes"), mmap)}
      </section>
      <section class="hl-block">
        <h3>Pripomienky</h3>
        {highlight_items(hl.get("reminders"), mmap)}
      </section>
      <section class="hl-block">
        <h3>Zobrať / vybaviť</h3>
        {highlight_items(hl.get("bring"), mmap)}
      </section>
      <section class="hl-block">
        <h3>Víkend</h3>
        {highlight_items(hl.get("weekend"), mmap)}
      </section>
    </aside>
  </div>
</div>
"""
    return shell(tid, f"Dnes — {fmt_date_short(d)}", body, autofocus_sel="a.lane-head", extra_class="page-overview")


def member_events(day, mid):
    return [e for e in day.get("events", []) if e.get("member") == mid]


def member_highlights(day, mid):
    """Pripomienky viazané na člena + pripomienky pri jeho udalostiach (nie duplicitné notes)."""
    hl = day.get("highlights", {})
    out = []
    for key in ("reminders", "bring"):
        for it in hl.get(key, []):
            if isinstance(it, dict) and it.get("member") == mid:
                out.append(it)
    for e in member_events(day, mid):
        for r in e.get("reminders", []):
            out.append({"text": r})
    return out


def render_member(tid, day, members, mid):
    mmap = members_by_id(members)
    m = mmap[mid]
    d = day["date"]
    events = member_events(day, mid)
    timed = [e for e in events if e.get("start") and not e.get("all_day")]
    floating = [e for e in events if e.get("all_day") or not e.get("start")]
    notes = member_highlights(day, mid)

    agenda = []
    for e in sorted(timed, key=lambda x: parse_hhmm(x["start"])):
        conflict = " is-conflict" if ("conflict" in e.get("flags", []) or e.get("conflict_with")) else ""
        unconf = " is-unconfirmed" if e.get("status") in ("unconfirmed", "tentative") else ""
        loc = f'<p class="agenda-loc">{esc(e["location"])}</p>' if e.get("location") else ""
        notes_h = ""
        bits = list(e.get("notes") or []) + list(e.get("reminders") or [])
        if bits:
            notes_h = "<ul class=\"agenda-notes\">" + "".join(f"<li>{esc(b)}</li>" for b in bits) + "</ul>"
        st = ""
        if e.get("status") and e["status"] != "confirmed":
            st = f'<span class="ev-status">{esc(STATUS_SK.get(e["status"], e["status"]))}</span>'
        flags = []
        if conflict:
            flags.append("konflikt")
        if "needs-ride" in e.get("flags", []):
            flags.append("odvoz")
        fl = f'<span class="ev-flags">{esc(" · ".join(flags))}</span>' if flags else ""
        agenda.append(
            f'<article class="agenda-item{conflict}{unconf}" style="--m:{esc(m["color"])}">'
            f'<div class="agenda-time">{esc(fmt_range(e))}</div>'
            f'<div class="agenda-body"><h3>{esc(e["title"])}{st}{fl}</h3>{loc}{notes_h}</div>'
            f"</article>"
        )

    for e in floating:
        unconf = " is-unconfirmed" if e.get("status") in ("unconfirmed", "tentative") else ""
        loc = f'<p class="agenda-loc">{esc(e["location"])}</p>' if e.get("location") else ""
        bits = list(e.get("notes") or []) + list(e.get("reminders") or [])
        notes_h = ""
        if bits:
            notes_h = "<ul class=\"agenda-notes\">" + "".join(f"<li>{esc(b)}</li>" for b in bits) + "</ul>"
        st = ""
        if e.get("status") and e["status"] != "confirmed":
            st = f'<span class="ev-status">{esc(STATUS_SK.get(e["status"], e["status"]))}</span>'
        agenda.append(
            f'<article class="agenda-item is-floating{unconf}" style="--m:{esc(m["color"])}">'
            f'<div class="agenda-time">{esc(fmt_range(e))}</div>'
            f'<div class="agenda-body"><h3>{esc(e["title"])}{st}</h3>{loc}{notes_h}</div>'
            f"</article>"
        )

    if not agenda:
        agenda_html = f"""
<div class="empty-state" style="--m:{esc(m["color"])}">
  <img class="avatar avatar-lg" src="{esc(avatar_href(m))}" alt="" width="96" height="96">
  <h2>Zatiaľ nič v kalendári</h2>
  <p>{esc(m["display_name"])} nemá na {esc(fmt_date_short(d))} žiadne známe udalosti.
  Voľný deň — alebo ešte len čakáme na doplnenie.</p>
</div>
"""
    else:
        agenda_html = '<div class="agenda">' + "".join(agenda) + "</div>"

    notes_html = highlight_items(notes, mmap) if notes else '<p class="empty-inline">Žiadne zvláštne poznámky.</p>'
    meta_bits = []
    for k, label in (("school", "škola"), ("grade", "trieda"), ("club", "krúžok")):
        if m.get("meta", {}).get(k):
            meta_bits.append(f'<span>{esc(label)}: {esc(m["meta"][k])}</span>')
    meta_html = ('<p class="member-meta">' + " · ".join(meta_bits) + "</p>") if meta_bits else ""

    body = f"""
<div class="frame page-member" style="--m:{esc(m["color"])}">
  <header class="topbar">
    {nav_back(d + ".html", "Prehľad")}
    <div class="member-hero">
      <img class="avatar avatar-lg" src="{esc(avatar_href(m))}" alt="" width="88" height="88">
      <div>
        <p class="eyebrow">Osobný prehľad · {esc(fmt_date_short(d))}</p>
        <h1>{esc(m["display_name"])}</h1>
        {meta_html}
      </div>
    </div>
  </header>
  <div class="member-grid">
    <section class="panel" aria-label="Agenda">
      <h2>Agenda</h2>
      {agenda_html}
    </section>
    <aside class="panel" aria-label="Poznámky">
      <h2>Poznámky a pripomienky</h2>
      {notes_html}
    </aside>
  </div>
</div>
"""
    return shell(
        tid,
        f"{m['display_name']} — {fmt_date_short(d)}",
        body,
        autofocus_sel="a.nav-back",
        extra_class="page-member",
    )


def render_home(tid, members, primary_date):
    people = people_members(members)
    tiles = [
        f'<a class="tile tile-dnes" href="{esc(primary_date)}.html" autofocus>'
        f'<span class="tile-kicker">Rodina</span>'
        f'<span class="tile-title">Dnes</span>'
        f'<span class="tile-sub">{esc(fmt_date_sk(primary_date))}</span>'
        f"</a>"
    ]
    for m in people:
        tiles.append(
            f'<a class="tile tile-member" href="{esc(primary_date)}-{esc(m["id"])}.html" style="--m:{esc(m["color"])}">'
            f'<img class="avatar" src="{esc(avatar_href(m))}" alt="" width="72" height="72">'
            f'<span class="tile-title">{esc(m["display_name"])}</span>'
            f"</a>"
        )
    body = f"""
<div class="frame page-home">
  <header class="home-header">
    <p class="eyebrow">Nixplay · rodinný rám</p>
    <h1>Domov</h1>
    <p class="lede">Vyberte prehľad dňa alebo člena rodiny. Tab = ďalší, Enter = otvoriť.</p>
  </header>
  <nav class="home-grid" aria-label="Menu">
    {"".join(tiles)}
  </nav>
</div>
"""
    return shell(tid, "Domov — rodinný prehľad", body, autofocus_sel="a.tile-dnes", extra_class="page-home")


def render_designs_index(metas, primary_date, busy_date):
    cards = []
    for tid, meta in metas:
        letter = esc(meta.get("letter", "?"))
        name = esc(meta.get("name", tid))
        blurb = esc(meta.get("blurb", ""))
        color = esc(meta.get("theme_color", "#333"))
        cards.append(
            f"""<li>
  <a class="card" style="--c:{color}" href="{esc(tid)}/home.html">
    <strong>{letter} · {name}</strong>
    <span>{blurb}</span>
  </a>
  <p class="card-links">
    <a href="{esc(tid)}/home.html">domov</a> ·
    <a href="{esc(tid)}/{esc(primary_date)}.html">prehľad {esc(fmt_date_short(primary_date))}</a> ·
    <a href="{esc(tid)}/{esc(busy_date)}.html">hustý deň {esc(fmt_date_short(busy_date))}</a> ·
    <a href="{esc(tid)}/{esc(primary_date)}-andrej.html">Andrej</a>
  </p>
</li>"""
        )
    return f"""<!doctype html>
<html lang="sk">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>Návrhy vzhľadu — denný rodinný prehľad</title>
<style>
  body {{ margin: 0; font: 20px/1.45 "Source Sans 3", system-ui, sans-serif; color: #1a1f24;
    background: #e7eef2; }}
  main {{ max-width: 820px; margin: 0 auto; padding: 1.6rem 1.2rem 3rem; }}
  h1 {{ font-size: 2rem; margin: .3rem 0 .4rem; }}
  .lede {{ color: #3d4a52; margin: 0 0 1.4rem; }}
  ul {{ list-style: none; margin: 0; padding: 0; }}
  li {{ margin: 0 0 1.1rem; }}
  a.card {{ display: block; text-decoration: none; color: inherit; background: #fff;
    border-radius: 14px; padding: 1.05rem 1.15rem; border: 2px solid #cfd8de;
    border-left: 10px solid var(--c); }}
  a.card strong {{ display: block; font-size: 1.35rem; margin-bottom: .25rem; }}
  a.card span {{ color: #3d4a52; }}
  .card-links {{ margin: .45rem 0 0 .2rem; font-size: .95rem; color: #3d4a52; }}
  .card-links a {{ color: #1f4f6e; }}
  footer {{ margin-top: 1.5rem; color: #3d4a52; font-size: .95rem; }}
</style>
</head>
<body>
<main>
  <h1>Návrhy vzhľadu denného prehľadu</h1>
  <p class="lede">Tri témy rovnakej vzorky dňa (piatok 6.&nbsp;11.&nbsp;2026) plus hustý utorok 3.&nbsp;11.&nbsp;2026.
  Cieľ: Nixplay 1024×768, Chromium 81, ovládanie gestami (Tab / Enter / Alt+←).</p>
  <ul>
    {"".join(cards)}
  </ul>
  <footer>Obsah z <code>data/*.json</code> · render <code>tools/build.py</code> · výstup v <code>designs/</code>.</footer>
</main>
</body>
</html>
"""


def build():
    members = load_json(DATA, "members.json")["members"]
    primary = load_json(DATA, "2026-11-06.json")
    busy = load_json(DATA, "2026-11-03.json")
    metas = []

    for tid in theme_ids():
        meta = theme_meta(tid)
        metas.append((tid, meta))
        out = os.path.join(DESIGNS, tid)
        os.makedirs(out, exist_ok=True)
        copy_theme_assets(tid, out)

        write(os.path.join(out, "home.html"), render_home(tid, members, primary["date"]))
        write(os.path.join(out, f'{primary["date"]}.html'), render_overview(tid, primary, members))
        write(os.path.join(out, f'{busy["date"]}.html'), render_overview(tid, busy, members))

        for m in people_members(members):
            write(
                os.path.join(out, f'{primary["date"]}-{m["id"]}.html'),
                render_member(tid, primary, members, m["id"]),
            )
            # hustý deň: aspoň Andrej (a ostatní lacno navyše)
            write(
                os.path.join(out, f'{busy["date"]}-{m["id"]}.html'),
                render_member(tid, busy, members, m["id"]),
            )

        print(f"built theme {tid} → designs/{tid}/")

    write(
        os.path.join(DESIGNS, "index.html"),
        render_designs_index(metas, primary["date"], busy["date"]),
    )
    print("built designs/index.html")


if __name__ == "__main__":
    build()
