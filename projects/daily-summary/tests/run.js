#!/usr/bin/env node
/* Regression: visibility state sync (same contract as themes/_shared/view.js). */
"use strict";

var assert = require("assert");
var fs = require("fs");
var path = require("path");

var failed = 0;
var passed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log("  ok  " + name);
  } catch (e) {
    failed++;
    console.log("  FAIL " + name);
    console.log("       " + (e && e.stack ? e.stack : e));
  }
}

/** Mirror of syncVisibility decision in view.js (document.hidden vs pageHidden). */
function transition(documentHidden, pageHidden) {
  var wantHidden = !!documentHidden;
  if (wantHidden === !!pageHidden) return null;
  return wantHidden ? "hide" : "show";
}

console.log("daily-summary visibility unit tests\n");

test("view.js defines syncVisibility and resume/pageshow/focus/poll wiring", function () {
  var src = fs.readFileSync(
    path.join(__dirname, "..", "themes", "_shared", "view.js"),
    "utf8"
  );
  assert.ok(src.indexOf("function syncVisibility()") !== -1);
  assert.ok(src.indexOf('addEventListener("resume", syncVisibility') !== -1);
  assert.ok(src.indexOf('addEventListener("pageshow", syncVisibility') !== -1);
  assert.ok(src.indexOf('addEventListener("focus", syncVisibility') !== -1);
  assert.ok(src.indexOf("VISIBILITY_POLL_MS") !== -1);
  assert.ok(src.indexOf("setInterval(syncVisibility, VISIBILITY_POLL_MS)") !== -1);
});

test("resume-only recovers when page still paused (frame screen-on)", function () {
  var documentHidden = false;
  var pageHidden = true;
  var actions = [];
  var listeners = {};

  function addEventListener(type, fn) {
    if (!listeners[type]) listeners[type] = [];
    listeners[type].push(fn);
  }
  function dispatchEvent(ev) {
    var list = listeners[ev.type] || [];
    for (var i = 0; i < list.length; i++) list[i](ev);
  }
  function syncVisibility() {
    var action = transition(documentHidden, pageHidden);
    if (action === "hide") {
      pageHidden = true;
      actions.push("hide");
    } else if (action === "show") {
      pageHidden = false;
      actions.push("show");
    }
  }

  addEventListener("visibilitychange", syncVisibility);
  addEventListener("resume", syncVisibility);
  addEventListener("pageshow", syncVisibility);
  addEventListener("focus", syncVisibility);

  dispatchEvent({ type: "resume" });
  assert.deepStrictEqual(actions, ["show"]);
  assert.strictEqual(pageHidden, false);

  dispatchEvent({ type: "resume" });
  dispatchEvent({ type: "focus" });
  assert.deepStrictEqual(actions, ["show"]);

  documentHidden = true;
  dispatchEvent({ type: "visibilitychange" });
  assert.deepStrictEqual(actions, ["show", "hide"]);
});

test("view.js light theme-color is #F5F7FA", function () {
  var src = fs.readFileSync(
    path.join(__dirname, "..", "themes", "_shared", "view.js"),
    "utf8"
  );
  assert.ok(src.indexOf('"#F5F7FA"') !== -1);
  assert.ok(src.indexOf('"#d9e3ea"') === -1);
});

test("shared CSS avoids Chromium-81-unsafe features", function () {
  var dir = path.join(__dirname, "..", "themes", "_shared");
  ["base.css", "light.css", "dark.css"].forEach(function (name) {
    var raw = fs.readFileSync(path.join(dir, name), "utf8");
    // Strip comments so the allow-list note itself does not fail the check.
    var src = raw.replace(/\/\*[\s\S]*?\*\//g, "");
    // Property names only (ignore custom props like --hdr-line-gap)
    assert.ok(!/(^|[^-])\bgap\s*:/.test(src), name + " uses gap");
    assert.ok(!/(^|[^-])\binset\s*:/.test(src), name + " uses inset");
    assert.ok(src.indexOf("color-mix") === -1, name + " uses color-mix");
    assert.ok(src.indexOf(":is(") === -1, name + " uses :is()");
    assert.ok(src.indexOf(":where(") === -1, name + " uses :where()");
    assert.ok(src.indexOf(":has(") === -1, name + " uses :has()");
    assert.ok(src.indexOf("::marker") === -1, name + " uses ::marker");
    assert.ok(src.indexOf("oklch(") === -1, name + " uses oklch");
  });
});

test("members.json has new person colours and RGB triplets", function () {
  var pack = JSON.parse(
    fs.readFileSync(path.join(__dirname, "..", "data", "members.json"), "utf8")
  );
  var byId = {};
  pack.members.forEach(function (m) {
    byId[m.id] = m;
  });
  assert.strictEqual(byId.branislav.color, "#8E5B2E");
  assert.strictEqual(byId.zuzka.color, "#E8B400");
  assert.strictEqual(byId.andrej.color, "#D52B2B");
  assert.strictEqual(byId.tomas.color, "#218538");
  assert.strictEqual(pack.family.color, "#0A7CC4");
  pack.members.concat([pack.family]).forEach(function (m) {
    assert.ok(m.color_rgb, m.id + " missing color_rgb");
    assert.ok(m.color_dark_rgb, m.id + " missing color_dark_rgb");
  });
  assert.ok(/\.(webp|png)$/i.test(byId.branislav.avatar));
});

test("generator emits --m-rgb/--md-rgb (render smoke, no designs/ commit needed)", function () {
  var { execFileSync } = require("child_process");
  var os = require("os");
  var out = fs.mkdtempSync(path.join(os.tmpdir(), "ds-rgb-"));
  var py = [
    "import os, sys",
    "sys.path.insert(0, " + JSON.stringify(path.join(__dirname, "..", "tools")) + ")",
    "import build",
    "day = build.load_json(build.DATA, '2026-11-18.json')",
    "pack = build.load_json(build.DATA, 'members.json')",
    "html = build.render_day_page(day, pack)",
    "open(os.path.join(" + JSON.stringify(out) + ", 'out.html'), 'w', encoding='utf-8').write(html)",
  ].join("\n");
  execFileSync("python3", ["-c", py], { encoding: "utf8" });
  var html = fs.readFileSync(path.join(out, "out.html"), "utf8");
  assert.ok(html.indexOf("--m:#E8B400;--m-rgb:232, 180, 0;--md-rgb:242, 196, 51") !== -1);
  assert.ok(html.indexOf("--m:#D52B2B;--m-rgb:213, 43, 43;--md-rgb:240, 82, 82") !== -1);
  assert.ok(html.indexOf("avatars/zuzka.webp") !== -1);
  assert.ok(html.indexOf("avatars/andrej.webp") !== -1);
  assert.ok(fs.existsSync(path.join(__dirname, "..", "assets", "avatars", "lukas.webp")));
  // Span layer must not cover the hour gutter (absolute kids ignore padding).
  var css = fs.readFileSync(
    path.join(__dirname, "..", "themes", "_shared", "base.css"),
    "utf8"
  );
  assert.ok(/\.tl-span-layer\s*\{[^}]*left:\s*52px/m.test(css));
  // Top-edge hour keeps a centered 07:00 label (tl-track inset prevents clip).
  assert.ok(html.indexOf('style="top:0.000%"><span class="tl-hour-label">07:00</span>') !== -1);
  assert.ok(html.indexOf('>22:00</span>') !== -1);
});

test("fitEventBlocks still prefers hiding flags/status before title", function () {
  var src = fs.readFileSync(
    path.join(__dirname, "..", "themes", "_shared", "view.js"),
    "utf8"
  );
  assert.ok(src.indexOf("function fitEventBlocks()") !== -1);
  assert.ok(src.indexOf('[".ev-flags", ".ev-status", ".ev-loc", ".ev-time"]') !== -1);
});

test("event status/flag CSS is inline-block (not full-width block)", function () {
  var src = fs.readFileSync(
    path.join(__dirname, "..", "themes", "_shared", "base.css"),
    "utf8"
  );
  assert.ok(/\.event-block \.ev-status,\s*\n\.event-block \.ev-flags\s*\{[^}]*display:\s*inline-block/m.test(src));
});

test("personal view 41/59 split and dotted lane separators", function () {
  var base = fs.readFileSync(
    path.join(__dirname, "..", "themes", "_shared", "base.css"),
    "utf8"
  );
  var light = fs.readFileSync(
    path.join(__dirname, "..", "themes", "_shared", "light.css"),
    "utf8"
  );
  var dark = fs.readFileSync(
    path.join(__dirname, "..", "themes", "_shared", "dark.css"),
    "utf8"
  );
  assert.ok(base.indexOf("flex: 0 0 401px") !== -1);
  assert.ok(base.indexOf("flex: 0 0 578px") !== -1);
  assert.ok(base.indexOf("flex: 0 0 102px") !== -1);
  assert.ok(base.indexOf("repeating-linear-gradient") !== -1);
  assert.ok(base.indexOf("var(--tl-lane-sep)") !== -1);
  assert.ok(light.indexOf("--tl-lane-sep:") !== -1);
  assert.ok(dark.indexOf("--tl-lane-sep:") !== -1);
});

test("name cards align over lanes; teraz is orange and lane-bound", function () {
  var base = fs.readFileSync(
    path.join(__dirname, "..", "themes", "_shared", "base.css"),
    "utf8"
  );
  var light = fs.readFileSync(
    path.join(__dirname, "..", "themes", "_shared", "light.css"),
    "utf8"
  );
  var dark = fs.readFileSync(
    path.join(__dirname, "..", "themes", "_shared", "dark.css"),
    "utf8"
  );
  assert.ok(/\.lane-heads\s*\{[^}]*padding-left:\s*52px/m.test(base));
  assert.ok(/\.tl-now\s*\{[^}]*left:\s*52px/m.test(base));
  assert.ok(light.indexOf("--now: #F07800") !== -1);
  assert.ok(dark.indexOf("--now: #FF9A33") !== -1);
});

test("hour labels centered with 07:00–22:00; date smaller; teraz badge centered", function () {
  var base = fs.readFileSync(
    path.join(__dirname, "..", "themes", "_shared", "base.css"),
    "utf8"
  );
  assert.ok(base.indexOf("--fs-date: 30px") !== -1);
  assert.ok(/\.tl-track\s*\{[^}]*top:\s*10px[^}]*bottom:\s*10px/m.test(base));
  assert.ok(/\.tl-hour-label\s*\{[^}]*translateY\(-50%\)/m.test(base));
  assert.ok(/\.tl-now-label\s*\{[^}]*translateY\(calc\(-50% - 1px\)\)/m.test(base));
  var cp = require("child_process");
  var script =
    "import sys\n" +
    "sys.path.insert(0, " +
    JSON.stringify(path.join(__dirname, "..", "tools")) +
    ")\n" +
    "import build\n" +
    "day = build.load_json(build.PROJECT, 'samples', 'redesign-states.json')\n" +
    "assert day['timeline']['end'] == '22:00'\n" +
    "pack = build.load_json(build.DATA, 'members.json')\n" +
    "html = build.render_day_page(day, pack)\n" +
    "assert 'tl-track' in html\n" +
    "assert '>07:00</span>' in html\n" +
    "assert '>22:00</span>' in html\n" +
    "print('ok')\n";
  var out = cp.execFileSync("python3", ["-c", script], { encoding: "utf8" });
  assert.ok(out.indexOf("ok") !== -1);
});

test("family spans stack under lane events", function () {
  var base = fs.readFileSync(
    path.join(__dirname, "..", "themes", "_shared", "base.css"),
    "utf8"
  );
  // Specific .tl-span-layer rule (left:52px) must be under .tl-lanes (z-index 2 < 3).
  assert.ok(/\.tl-span-layer\s*\{[^}]*left:\s*52px[^}]*z-index:\s*2/m.test(base));
  assert.ok(/\.tl-lanes\s*\{[^}]*z-index:\s*3/m.test(base));
  var light = fs.readFileSync(
    path.join(__dirname, "..", "themes", "_shared", "light.css"),
    "utf8"
  );
  assert.ok(light.indexOf("background-color: #fff") !== -1);
  assert.ok(light.indexOf(".event-block.is-span") !== -1);
  // DOM: span layer before lanes (belt-and-braces with z-index).
  var cp = require("child_process");
  var script =
    "import sys,re\n" +
    "sys.path.insert(0, " +
    JSON.stringify(path.join(__dirname, "..", "tools")) +
    ")\n" +
    "import build\n" +
    "day = build.load_json(build.DATA, '2026-11-19.json')\n" +
    "pack = build.load_json(build.DATA, 'members.json')\n" +
    "html = build.render_day_page(day, pack)\n" +
    "fam = html[html.find('data-mode=\"family\"'):html.find('data-mode=\"member\"')]\n" +
    "assert fam.find('tl-span-layer') < fam.find('tl-lanes')\n" +
    "marker = 'data-mode=\"member\" data-focus=\"andrej\"'\n" +
    "i0 = html.find(marker)\n" +
    "assert i0 > 0\n" +
    "cal = html[i0:i0 + 9000]\n" +
    "assert cal.find('tl-span-layer') < cal.find('tl-lanes')\n" +
    "print('ok')\n";
  var out = cp.execFileSync("python3", ["-c", script], { encoding: "utf8" });
  assert.ok(out.indexOf("ok") !== -1);
});

test("personal view puts multi-member events in family-blue span layer", function () {
  var cp = require("child_process");
  var script =
    "import sys\n" +
    "sys.path.insert(0, " +
    JSON.stringify(path.join(__dirname, "..", "tools")) +
    ")\n" +
    "import build\n" +
    "day = build.load_json(build.PROJECT, 'samples', 'redesign-states.json')\n" +
    "pack = build.load_json(build.DATA, 'members.json')\n" +
    "html = build.render_day_page(day, pack)\n" +
    "marker = 'data-mode=\"member\" data-focus=\"andrej\"'\n" +
    "idx = html.find(marker)\n" +
    "assert idx > 0, 'andrej calendar missing'\n" +
    "cal = html[idx:idx + 8000]\n" +
    "assert 'tl-span-layer' in cal\n" +
    "assert 'is-span' in cal\n" +
    "assert 'Premiéra' in cal\n" +
    "assert '--m:#0A7CC4' in cal\n" +
    "f0 = cal.find('lane-col-focus')\n" +
    "f1 = cal.find('lane-col-others')\n" +
    "assert f0 > 0 and f1 > f0\n" +
    "fc = cal[f0:f1]\n" +
    "assert 'Baseball' in fc\n" +
    "assert 'Premiéra' not in fc\n" +
    "assert 'Zabaliť bubny' not in fc\n" +
    "assert 'width:100.000%' in fc\n" +
    "span = cal[cal.find('tl-span-layer'):]\n" +
    "assert 'Premiéra' in span and 'width:100.000%' in span\n" +
    "print('ok')\n";
  var out = cp.execFileSync("python3", ["-c", script], { encoding: "utf8" });
  assert.ok(out.indexOf("ok") !== -1);
});

test("timeline_bounds clamps to at least 07:00–22:00", function () {
  var cp = require("child_process");
  var script =
    "import sys\n" +
    "sys.path.insert(0, " +
    JSON.stringify(path.join(__dirname, "..", "tools")) +
    ")\n" +
    "import build\n" +
    "# Old file style: end 21:00, no late events\n" +
    "day = {'timeline': {'start': '07:00', 'end': '21:00'}, 'events': []}\n" +
    "assert build.timeline_bounds(day) == (7 * 60, 22 * 60)\n" +
    "day2 = {'timeline': {'start': '08:00', 'end': '20:00'}, 'events': []}\n" +
    "assert build.timeline_bounds(day2) == (7 * 60, 22 * 60)\n" +
    "# Still expands past 22:00 when an event runs later\n" +
    "day3 = {\n" +
    "  'timeline': {'start': '07:00', 'end': '21:00'},\n" +
    "  'events': [{'start': '21:30', 'end': '23:15', 'all_day': False}],\n" +
    "}\n" +
    "assert build.timeline_bounds(day3) == (7 * 60, 24 * 60)\n" +
    "# 2026-11-19 published file still ends at 21:00 in JSON\n" +
    "live = build.load_json(build.DATA, '2026-11-19.json')\n" +
    "assert live['timeline']['end'] == '21:00'\n" +
    "assert build.timeline_bounds(live) == (7 * 60, 22 * 60)\n" +
    "pack = build.load_json(build.DATA, 'members.json')\n" +
    "html = build.render_day_page(live, pack)\n" +
    "assert '>07:00</span>' in html and '>22:00</span>' in html\n" +
    "print('ok')\n";
  var out = cp.execFileSync("python3", ["-c", script], { encoding: "utf8" });
  assert.ok(out.indexOf("ok") !== -1);
});

test("place_span_labels stacks down-first with sideways fallback", function () {
  var cp = require("child_process");
  var script =
    "import sys, re\n" +
    "sys.path.insert(0, " +
    JSON.stringify(path.join(__dirname, "..", "tools")) +
    ")\n" +
    "import build\n" +
    "\n" +
    "def spec(start, end, title, left=0.0, width=100.0):\n" +
    "  return {\n" +
    "    'start': start, 'end': end, 'title': title, 'left': left, 'width': width,\n" +
    "    'short': (end - start) <= 45,\n" +
    "    'ev': {\n" +
    "      'title': title,\n" +
    "      'start': '%02d:%02d' % (start // 60, start % 60),\n" +
    "      'end': '%02d:%02d' % (end // 60, end % 60),\n" +
    "    },\n" +
    "  }\n" +
    "\n" +
    "def boxes_ok(specs):\n" +
    "  boxes = []\n" +
    "  for s in specs:\n" +
    "    top = s['start'] + s['label_row'] * build.SPAN_LABEL_SLOT_MIN\n" +
    "    boxes.append((top, top + build.SPAN_LABEL_SLOT_MIN, s['label_left'], s['label_width']))\n" +
    "  for i in range(len(boxes)):\n" +
    "    for j in range(i + 1, len(boxes)):\n" +
    "      a, b = boxes[i], boxes[j]\n" +
    "      if not (a[0] < b[1] and b[0] < a[1]):\n" +
    "        continue\n" +
    "      assert not build.spans_horizontal_overlap(a[2], a[3], b[2], b[3]), (a, b)\n" +
    "\n" +
    "# No lane events → stack: first row 0 left, second row 1 left\n" +
    "stacked = [\n" +
    "  spec(15 * 60, 18 * 60, 'Laskavá kavárna'),\n" +
    "  spec(15 * 60, 19 * 60, 'Bertík oslava narodenín'),\n" +
    "]\n" +
    "build.place_span_labels(stacked, [])\n" +
    "assert stacked[0]['label_row'] == 0 and stacked[0]['label_left'] == 0.0\n" +
    "assert stacked[1]['label_row'] == 1 and stacked[1]['label_left'] == 0.0\n" +
    "boxes_ok(stacked)\n" +
    "\n" +
    "# Andrej prep until 15:45 — still stack (row 1 is free on Braňo/Zuzka)\n" +
    "occ = [{'left': 50.0, 'width': 25.0, 'start': 13 * 60 + 30, 'end': 15 * 60 + 45}]\n" +
    "live = [\n" +
    "  spec(15 * 60, 18 * 60, 'Laskavá kavárna'),\n" +
    "  spec(15 * 60, 19 * 60, 'Bertík oslava narodenín'),\n" +
    "]\n" +
    "build.place_span_labels(live, occ)\n" +
    "assert live[0]['label_row'] == 0 and live[0]['label_left'] == 0.0\n" +
    "assert live[1]['label_row'] == 1 and live[1]['label_left'] == 0.0\n" +
    "boxes_ok(live)\n" +
    "\n" +
    "# Short second span cannot fit a downward row → sideways in row 0\n" +
    "short = [\n" +
    "  spec(15 * 60, 18 * 60, 'Dlhá spoločná'),\n" +
    "  spec(15 * 60 + 5, 15 * 60 + 40, 'Krátka spoločná'),\n" +
    "]\n" +
    "build.place_span_labels(short, [])\n" +
    "assert short[0]['label_row'] == 0 and short[0]['label_left'] == 0.0\n" +
    "assert short[1]['label_row'] == 0 and short[1]['label_left'] > short[0]['label_left']\n" +
    "boxes_ok(short)\n" +
    "\n" +
    "# Personal events sit in row 1 → second label goes sideways in row 0\n" +
    "below = [\n" +
    "  spec(15 * 60, 18 * 60, 'Prvá spoločná'),\n" +
    "  spec(15 * 60 + 1, 16 * 60 + 55, 'Druhá spoločná'),\n" +
    "]\n" +
    "occ_below = [\n" +
    "  {'left': i * 25.0, 'width': 25.0, 'start': 15 * 60 + 56, 'end': 16 * 60 + 55}\n" +
    "  for i in range(4)\n" +
    "]\n" +
    "build.place_span_labels(below, occ_below)\n" +
    "assert below[0]['label_row'] == 0 and below[0]['label_left'] == 0.0\n" +
    "assert below[1]['label_row'] == 0 and below[1]['label_left'] > below[0]['label_left']\n" +
    "boxes_ok(below)\n" +
    "\n" +
    "# Partial lane block in a downward row → slide within that row\n" +
    "slide = [\n" +
    "  spec(15 * 60, 18 * 60, 'First long title here'),\n" +
    "  spec(15 * 60, 19 * 60, 'Second long title here'),\n" +
    "]\n" +
    "occ_slide = [{'left': 0.0, 'width': 50.0, 'start': 15 * 60 + 55, 'end': 16 * 60 + 30}]\n" +
    "build.place_span_labels(slide, occ_slide)\n" +
    "assert slide[0]['label_row'] == 0\n" +
    "assert slide[1]['label_row'] == 1 and slide[1]['label_left'] >= 50.0 - 0.01\n" +
    "boxes_ok(slide)\n" +
    "\n" +
    "# Adjacent bands (end == start) both row 0\n" +
    "adj = [\n" +
    "  spec(17 * 60 + 30, 19 * 60, 'Early event title'),\n" +
    "  spec(19 * 60, 20 * 60, 'Late event title'),\n" +
    "]\n" +
    "build.place_span_labels(adj, [])\n" +
    "assert adj[0]['label_row'] == 0 and adj[1]['label_row'] == 0\n" +
    "\n" +
    "# Live day + sample fixtures render expected rows\n" +
    "pack = build.load_json(build.DATA, 'members.json')\n" +
    "live_day = build.load_json(build.DATA, '2026-11-19.json')\n" +
    "fam = build.render_day_page(live_day, pack)\n" +
    "fam = fam[fam.find('data-mode=\"family\"'):fam.find('data-mode=\"member\"')]\n" +
    "assert 'Laskavá kavárna' in fam and 'Bertík oslava' in fam\n" +
    "assert 'data-label-row=\"0\"' in fam and 'data-label-row=\"1\"' in fam\n" +
    "no_prep = build.load_json(build.PROJECT, 'samples', '2026-11-19-no-prep.json')\n" +
    "np_html = build.render_day_page(no_prep, pack)\n" +
    "np_fam = np_html[np_html.find('data-mode=\"family\"'):np_html.find('data-mode=\"member\"')]\n" +
    "assert 'data-label-row=\"0\"' in np_fam and 'data-label-row=\"1\"' in np_fam\n" +
    "short_day = build.load_json(build.PROJECT, 'samples', 'overlap-short-span.json')\n" +
    "short_html = build.render_day_page(short_day, pack)\n" +
    "assert 'Krátka spoločná' in short_html and 'data-label-row=\"0\"' in short_html\n" +
    "below_day = build.load_json(build.PROJECT, 'samples', 'overlap-personal-below.json')\n" +
    "below_html = build.render_day_page(below_day, pack)\n" +
    "assert 'Druhá spoločná' in below_html\n" +
    "three = build.load_json(build.PROJECT, 'samples', 'overlap-three-spans.json')\n" +
    "three_html = build.render_day_page(three, pack)\n" +
    "assert 'span-label' in three_html and '>22:00</span>' in three_html\n" +
    "print('ok')\n";
  var out = cp.execFileSync("python3", ["-c", script], { encoding: "utf8" });
  assert.ok(out.indexOf("ok") !== -1);
});

test("weather icons use --wx-sun/--wx-cloud (no legacy --wx)", function () {
  var light = fs.readFileSync(
    path.join(__dirname, "..", "themes", "_shared", "light.css"),
    "utf8"
  );
  var dark = fs.readFileSync(
    path.join(__dirname, "..", "themes", "_shared", "dark.css"),
    "utf8"
  );
  var base = fs.readFileSync(
    path.join(__dirname, "..", "themes", "_shared", "base.css"),
    "utf8"
  );
  assert.ok(light.indexOf("--wx-sun:") !== -1);
  assert.ok(light.indexOf("--wx-cloud:") !== -1);
  assert.ok(dark.indexOf("--wx-sun:") !== -1);
  assert.ok(dark.indexOf("--wx-cloud:") !== -1);
  // No single-colour --wx leftover in active themes.
  assert.ok(!/(^|[^-])--wx\s*:/.test(light.replace(/\/\*[\s\S]*?\*\//g, "")));
  assert.ok(!/(^|[^-])--wx\s*:/.test(dark.replace(/\/\*[\s\S]*?\*\//g, "")));
  assert.ok(base.indexOf("var(--wx-cloud)") !== -1);
  assert.ok(base.indexOf(".wx-icon .wx-sun") !== -1);
  assert.ok(base.indexOf(".wx-icon .wx-cloud") !== -1);

  var sunny = fs.readFileSync(
    path.join(__dirname, "..", "assets", "weather", "sunny.svg"),
    "utf8"
  );
  var partly = fs.readFileSync(
    path.join(__dirname, "..", "assets", "weather", "partly-cloudy.svg"),
    "utf8"
  );
  assert.ok(sunny.indexOf('class="wx-sun"') !== -1);
  assert.ok(partly.indexOf('class="wx-sun"') !== -1);
  assert.ok(partly.indexOf('class="wx-cloud"') !== -1);

  var cp = require("child_process");
  var script =
    "import sys\n" +
    "sys.path.insert(0, " +
    JSON.stringify(path.join(__dirname, "..", "tools")) +
    ")\n" +
    "import build\n" +
    "svg = build.weather_icon_svg('partly-cloudy')\n" +
    "assert 'wx-sun' in svg and 'wx-cloud' in svg\n" +
    "assert 'class=\"wx-sun\"' in build.weather_icon_svg('sunny')\n" +
    "fallback = build.weather_icon_svg('not-a-real-icon')\n" +
    "assert 'M17 10a4' in fallback  # cloudy path\n" +
    "print('ok')\n";
  var out = cp.execFileSync("python3", ["-c", script], { encoding: "utf8" });
  assert.ok(out.indexOf("ok") !== -1);
});

test("sidebar items support members[] (legacy member, multi-owner, family badges)", function () {
  var base = fs.readFileSync(
    path.join(__dirname, "..", "themes", "_shared", "base.css"),
    "utf8"
  );
  assert.ok(base.indexOf('[data-members~="andrej"]') !== -1);
  assert.ok(base.indexOf("li[data-member]") === -1);
  assert.ok(base.indexOf('.hl-badges[data-count="3"]') !== -1);
  assert.ok(base.indexOf('.hl-badges[data-count="4"]') !== -1);

  var cp = require("child_process");
  var script =
    "import re, sys\n" +
    "sys.path.insert(0, " +
    JSON.stringify(path.join(__dirname, "..", "tools")) +
    ")\n" +
    "import build\n" +
    "\n" +
    "pack = build.load_json(build.DATA, 'members.json')\n" +
    "day = build.load_json(build.PROJECT, 'samples', 'sidebar-multi-owners.json')\n" +
    "html = build.render_day_page(day, pack)\n" +
    "\n" +
    "# Ownerless: no data-members attr on that li\n" +
    "own = re.search(\n" +
    "  r'<li ([^>]*)>\\s*<span class=\"item-text\">Rodinný nákup',\n" +
    "  html)\n" +
    "assert own, 'ownerless item missing'\n" +
    "assert 'data-members' not in own.group(1)\n" +
    "assert 'data-family=\"1\"' in own.group(1)\n" +
    "\n" +
    "# Legacy member → single owner\n" +
    "assert 'data-members=\"andrej\"' in html\n" +
    "assert 'Podpísať súhlas' in html\n" +
    "assert re.search(r'data-count=\"1\"[^>]*>\\s*<span class=\"hl-who\"[^>]*>Andrej</span>', html)\n" +
    "\n" +
    "# 2 owners: column order zuzka then andrej; both badges\n" +
    "assert 'data-members=\"zuzka andrej\"' in html\n" +
    "two = re.search(\n" +
    "  r'data-members=\"zuzka andrej\"[^>]*>\\s*'\n" +
    "  r'<span class=\"hl-badges\" data-count=\"2\">((?:(?!</span></span>).)*)</span></span>',\n" +
    "  html, re.S)\n" +
    "assert two, '2-owner badges missing'\n" +
    "assert two.group(1).index('Zuzka') < two.group(1).index('Andrej')\n" +
    "\n" +
    "# 3 owners: badges emitted (family CSS hides them); PEOPLE_ORDER\n" +
    "assert 'data-members=\"branislav zuzka andrej\"' in html\n" +
    "idx = html.index('data-members=\"branislav zuzka andrej\"')\n" +
    "chunk = html[idx:idx + 700]\n" +
    "assert 'data-count=\"3\"' in chunk\n" +
    "assert chunk.index('Braňo') < chunk.index('Zuzka') < chunk.index('Andrej')\n" +
    "\n" +
    "# family:false + 2 owners\n" +
    "assert re.search(\n" +
    "  r'data-members=\"zuzka tomas\" data-family=\"0\"',\n" +
    "  html)\n" +
    "assert 'Zubár Tomáš' in html\n" +
    "\n" +
    "# item_owners helper\n" +
    "assert build.item_owners({'member': 'andrej'}) == ['andrej']\n" +
    "assert build.item_owners({'members': ['andrej', 'zuzka']}) == ['zuzka', 'andrej']\n" +
    "assert build.item_owners({'members': ['tomas', 'branislav', 'andrej']}) == [\n" +
    "  'branislav', 'andrej', 'tomas']\n" +
    "assert build.item_owners({'text': 'x'}) == []\n" +
    "print('ok')\n";
  var out = cp.execFileSync("python3", ["-c", script], { encoding: "utf8" });
  assert.ok(out.indexOf("ok") !== -1);
});

test("validator accepts members[] and rejects both/duplicates/unknown", function () {
  var cp = require("child_process");
  var script =
    "import copy, json, os, sys, tempfile\n" +
    "sys.path.insert(0, " +
    JSON.stringify(path.join(__dirname, "..", "tools")) +
    ")\n" +
    "import validate\n" +
    "\n" +
    "pack = validate.load(os.path.join(validate.DATA, 'members.json'))\n" +
    "err0 = validate.Errors()\n" +
    "known = validate.validate_members(pack, err0)\n" +
    "assert not err0\n" +
    "\n" +
    "base = {\n" +
    "  'date': '2099-01-01',\n" +
    "  'locale': 'sk-SK',\n" +
    "  'timezone': 'Europe/Prague',\n" +
    "  'weather': {'summary': 'x', 'icon': 'sunny', 'temp_high_c': 1, 'temp_low_c': 0},\n" +
    "  'timeline': {'start': '07:00', 'end': '22:00'},\n" +
    "  'events': [],\n" +
    "  'sections': [{\n" +
    "    'id': 'pripomienky', 'title': 'Pripomienky',\n" +
    "    'items': [{'text': 'ok'}]\n" +
    "  }]\n" +
    "}\n" +
    "\n" +
    "def check(mutate, expect_ok, needle=None):\n" +
    "  day = copy.deepcopy(base)\n" +
    "  mutate(day)\n" +
    "  td = tempfile.mkdtemp()\n" +
    "  path = os.path.join(td, '2099-01-01.json')\n" +
    "  with open(path, 'w', encoding='utf-8') as f:\n" +
    "    json.dump(day, f)\n" +
    "  err = validate.Errors()\n" +
    "  validate.validate_day(path, known, err)\n" +
    "  msgs = ' | '.join(err.items)\n" +
    "  if expect_ok:\n" +
    "    assert not err, msgs\n" +
    "  else:\n" +
    "    assert err, 'expected errors'\n" +
    "    if needle:\n" +
    "      assert needle in msgs, msgs\n" +
    "\n" +
    "check(lambda d: None, True)  # ownerless\n" +
    "check(lambda d: d['sections'][0]['items'][0].__setitem__('member', 'andrej'), True)\n" +
    "check(lambda d: d['sections'][0]['items'][0].__setitem__('members', ['andrej', 'zuzka']), True)\n" +
    "check(lambda d: d['sections'][0]['items'][0].__setitem__('members', ['branislav', 'zuzka', 'andrej']), True)\n" +
    "check(\n" +
    "  lambda d: (d['sections'][0]['items'][0].__setitem__('members', ['zuzka', 'tomas']),\n" +
    "             d['sections'][0]['items'][0].__setitem__('family', False)),\n" +
    "  True)\n" +
    "\n" +
    "def both(d):\n" +
    "  it = d['sections'][0]['items'][0]\n" +
    "  it['member'] = 'andrej'\n" +
    "  it['members'] = ['zuzka']\n" +
    "check(both, False, 'not both')\n" +
    "\n" +
    "check(lambda d: d['sections'][0]['items'][0].__setitem__('members', []), False, 'non-empty')\n" +
    "check(lambda d: d['sections'][0]['items'][0].__setitem__('members', ['andrej', 'andrej']), False, 'duplicate')\n" +
    "check(lambda d: d['sections'][0]['items'][0].__setitem__('members', ['nobody']), False, 'unknown')\n" +
    "check(lambda d: d['sections'][0]['items'][0].__setitem__('member', 'ghost'), False, 'unknown')\n" +
    "print('ok')\n";
  var out = cp.execFileSync("python3", ["-c", script], { encoding: "utf8" });
  assert.ok(out.indexOf("ok") !== -1);
});

test("span label CSS is transparent with top border on bands", function () {
  var base = fs.readFileSync(
    path.join(__dirname, "..", "themes", "_shared", "base.css"),
    "utf8"
  );
  var light = fs.readFileSync(
    path.join(__dirname, "..", "themes", "_shared", "light.css"),
    "utf8"
  );
  var dark = fs.readFileSync(
    path.join(__dirname, "..", "themes", "_shared", "dark.css"),
    "utf8"
  );
  assert.ok(base.indexOf(".tl-span-layer .span-label") !== -1);
  assert.ok(light.indexOf(".tl-span-layer .span-label") !== -1);
  assert.ok(dark.indexOf(".tl-span-layer .span-label") !== -1);
  assert.ok(/border-top:\s*2px solid/.test(light));
  assert.ok(/border-top:\s*2px solid/.test(dark));
  // No opaque chip fill / ring on labels
  assert.ok(/html\.theme-light \.tl-span-layer \.span-label\s*\{[^}]*background:\s*transparent/m.test(light));
  assert.ok(/html\.theme-dark \.tl-span-layer \.span-label\s*\{[^}]*background:\s*transparent/m.test(dark));
  assert.ok(/html\.theme-light \.tl-span-layer \.span-label\s*\{[^}]*box-shadow:\s*none/m.test(light));
  assert.ok(/html\.theme-dark \.tl-span-layer \.span-label\s*\{[^}]*box-shadow:\s*none/m.test(dark));
});

console.log("\n" + passed + " passed, " + failed + " failed");
process.exit(failed ? 1 : 0);
