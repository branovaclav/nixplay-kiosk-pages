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

test("assign_span_label_rows stacks same-start and partial overlaps", function () {
  var cp = require("child_process");
  var script =
    "import sys\n" +
    "sys.path.insert(0, " +
    JSON.stringify(path.join(__dirname, "..", "tools")) +
    ")\n" +
    "import build\n" +
    "\n" +
    "def spec(start, end, title, left=0.0, width=100.0):\n" +
    "  return {'start': start, 'end': end, 'title': title, 'left': left, 'width': width}\n" +
    "\n" +
    "# Same start → distinct rows\n" +
    "same = [\n" +
    "  spec(15 * 60, 18 * 60, 'A'),\n" +
    "  spec(15 * 60, 19 * 60, 'B'),\n" +
    "]\n" +
    "build.assign_span_label_rows(same)\n" +
    "rows = sorted(s['label_row'] for s in same)\n" +
    "assert rows == [0, 1], rows\n" +
    "\n" +
    "# Adjacent (end == start) → separate clusters, both row 0\n" +
    "adj = [\n" +
    "  spec(17 * 60 + 30, 19 * 60, 'Early'),\n" +
    "  spec(19 * 60, 20 * 60, 'Late'),\n" +
    "]\n" +
    "build.assign_span_label_rows(adj)\n" +
    "assert adj[0]['label_row'] == 0 and adj[1]['label_row'] == 0\n" +
    "\n" +
    "# Partial overlap with different starts\n" +
    "partial = [\n" +
    "  spec(17 * 60 + 30, 19 * 60, 'A'),\n" +
    "  spec(18 * 60, 20 * 60, 'B'),\n" +
    "]\n" +
    "build.assign_span_label_rows(partial)\n" +
    "assert partial[0]['label_row'] == 0\n" +
    "assert partial[1]['label_row'] >= 1\n" +
    "\n" +
    "# Three same-start spans → rows 0,1,2\n" +
    "three = [\n" +
    "  spec(15 * 60, 18 * 60, 'A'),\n" +
    "  spec(15 * 60, 19 * 60, 'B'),\n" +
    "  spec(15 * 60, 17 * 60 + 30, 'C'),\n" +
    "]\n" +
    "build.assign_span_label_rows(three)\n" +
    "assert sorted(s['label_row'] for s in three) == [0, 1, 2]\n" +
    "\n" +
    "# Non-overlapping horizontally → independent row 0\n" +
    "cols = [\n" +
    "  spec(15 * 60, 18 * 60, 'L', left=0.0, width=50.0),\n" +
    "  spec(15 * 60, 18 * 60, 'R', left=50.0, width=50.0),\n" +
    "]\n" +
    "build.assign_span_label_rows(cols)\n" +
    "assert cols[0]['label_row'] == 0 and cols[1]['label_row'] == 0\n" +
    "\n" +
    "# Absolute label slots must not overlap within a cluster\n" +
    "def slots_ok(specs):\n" +
    "  build.assign_span_label_rows(specs)\n" +
    "  boxes = []\n" +
    "  for s in specs:\n" +
    "    top = s['start'] + s['label_row'] * build.SPAN_LABEL_SLOT_MIN\n" +
    "    boxes.append((top, top + build.SPAN_LABEL_SLOT_MIN, s['left'], s['width']))\n" +
    "  for i in range(len(boxes)):\n" +
    "    for j in range(i + 1, len(boxes)):\n" +
    "      a, b = boxes[i], boxes[j]\n" +
    "      if not build.spans_horizontal_overlap(a[2], a[3], b[2], b[3]):\n" +
    "        continue\n" +
    "      assert not (a[0] < b[1] and b[0] < a[1]), (a, b)\n" +
    "  return True\n" +
    "assert slots_ok(three)\n" +
    "assert slots_ok(partial)\n" +
    "\n" +
    "# Rendered HTML uses data-label-row + span-label chip\n" +
    "day = build.load_json(build.PROJECT, 'samples', 'overlap-three-spans.json')\n" +
    "pack = build.load_json(build.DATA, 'members.json')\n" +
    "html = build.render_day_page(day, pack)\n" +
    "assert 'span-label' in html\n" +
    "assert 'data-label-row=\"0\"' in html\n" +
    "assert 'data-label-row=\"1\"' in html\n" +
    "assert 'data-label-row=\"2\"' in html\n" +
    "assert 'margin-top:44px' in html\n" +
    "assert 'margin-top:88px' in html\n" +
    "# Clamped end despite sample timeline.end 21:00\n" +
    "assert '>22:00</span>' in html\n" +
    "# Live bug day: two same-start family spans get distinct rows\n" +
    "live = build.load_json(build.DATA, '2026-11-19.json')\n" +
    "html_live = build.render_day_page(live, pack)\n" +
    "fam = html_live[html_live.find('data-mode=\"family\"'):html_live.find('data-mode=\"member\"')]\n" +
    "assert 'Laskavá kavárna' in fam and 'Bertík oslava' in fam\n" +
    "assert 'data-label-row=\"0\"' in fam and 'data-label-row=\"1\"' in fam\n" +
    "assert 'margin-top:0px' in fam and 'margin-top:44px' in fam\n" +
    "print('ok')\n";
  var out = cp.execFileSync("python3", ["-c", script], { encoding: "utf8" });
  assert.ok(out.indexOf("ok") !== -1);
});

test("span overlap CSS has label chip + top border (Chromium 81 safe)", function () {
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
});

console.log("\n" + passed + " passed, " + failed + " failed");
process.exit(failed ? 1 : 0);
