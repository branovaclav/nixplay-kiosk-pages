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

test("built day page emits --m-rgb/--md-rgb and new avatar files", function () {
  var html = fs.readFileSync(
    path.join(__dirname, "..", "designs", "2026-11-18.html"),
    "utf8"
  );
  assert.ok(html.indexOf("--m:#E8B400;--m-rgb:232, 180, 0;--md-rgb:242, 196, 51") !== -1);
  assert.ok(html.indexOf("--m:#D52B2B;--m-rgb:213, 43, 43;--md-rgb:240, 82, 82") !== -1);
  assert.ok(html.indexOf("avatars/zuzka.webp") !== -1);
  assert.ok(html.indexOf("avatars/andrej.webp") !== -1);
  assert.ok(fs.existsSync(path.join(__dirname, "..", "assets", "avatars", "lukas.webp")));
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

console.log("\n" + passed + " passed, " + failed + " failed");
process.exit(failed ? 1 : 0);
