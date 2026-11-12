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

console.log("\n" + passed + " passed, " + failed + " failed");
process.exit(failed ? 1 : 0);
