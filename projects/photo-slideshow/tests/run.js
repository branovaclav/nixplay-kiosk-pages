#!/usr/bin/env node
/* Minimal Node test runner for pure ES5 libs (synthetic fixtures only). */
"use strict";

var fs = require("fs");
var path = require("path");
var assert = require("assert");
var vm = require("vm");

var ROOT = path.join(__dirname, "..");
var failed = 0;
var passed = 0;

function loadLib(rel) {
  var code = fs.readFileSync(path.join(ROOT, rel), "utf8");
  var sandbox = { console: console, atob: null, Uint8Array: Uint8Array, DataView: DataView };
  // Node Buffer-based atob
  sandbox.atob = function (b64) {
    return Buffer.from(b64, "base64").toString("binary");
  };
  sandbox.global = sandbox;
  sandbox.window = undefined;
  vm.runInNewContext(code, sandbox, { filename: rel });
  return sandbox.PS || sandbox.global.PS;
}

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

console.log("photo-slideshow unit tests (synthetic only)\n");

// ---- bplist ----
var PS = loadLib("lib/bplist.js");
var fixtures = path.join(__dirname, "fixtures");

test("bplist parses location dict", function () {
  // Minimal binary plist with {lat: 48.5, lon: 2.25} written as fixture file
  var buf = fs.readFileSync(path.join(fixtures, "location.bplist"));
  var obj = PS.bplist.parse(new Uint8Array(buf));
  assert.ok(obj);
  assert.ok(Math.abs(obj.lat - 48.5) < 1e-6 || Math.abs(obj.latitude - 48.5) < 1e-6);
  assert.ok(Math.abs((obj.lon != null ? obj.lon : obj.longitude) - 2.25) < 1e-6);
});

test("parseLocationEnc round-trip from base64 fixture", function () {
  var b64 = fs.readFileSync(path.join(fixtures, "location.b64"), "utf8").trim();
  var loc = PS.bplist.parseLocationEnc(b64);
  assert.ok(loc);
  assert.ok(Math.abs(loc.lat - 48.5) < 1e-6);
  assert.ok(Math.abs(loc.lon - 2.25) < 1e-6);
});

// ---- datefmt ----
PS = loadLib("lib/datefmt.js");

test("formatCaptureDate Slovak short months", function () {
  // 2025-06-14 10:00 UTC + tzOffset +2h → still 14 jún
  var s = PS.datefmt.formatCaptureDate(Date.UTC(2025, 5, 14, 10, 0, 0), 7200);
  assert.strictEqual(s, "14. jún 2025");
  assert.strictEqual(PS.datefmt.formatCaptureDate(Date.UTC(2024, 0, 1, 12, 0, 0), 0), "1. jan 2024");
  assert.strictEqual(PS.datefmt.formatCaptureDate(null, 0), "");
});

// ---- overlay label ----
PS = loadLib("lib/overlay-label.js");

test("overlay both → comment middle, place right dimmed", function () {
  var L = PS.overlayLabel.build("14. jún 2025", "Dovolenka", "Paríž, Francúzsko");
  assert.strictEqual(L.middle.kind, "comment");
  assert.strictEqual(L.middle.text, "Dovolenka");
  assert.strictEqual(L.right.kind, "place");
  assert.strictEqual(L.right.text, "Paríž, Francúzsko");
  assert.strictEqual(L.rightDim, true);
});

test("overlay comment only → right, middle empty", function () {
  var L = PS.overlayLabel.build("1. jan 2024", "Vianoce", "");
  assert.strictEqual(L.middle, null);
  assert.strictEqual(L.right.kind, "comment");
  assert.strictEqual(L.right.text, "Vianoce");
  assert.strictEqual(L.rightDim, false);
});

test("overlay place only → right dimmed, middle empty", function () {
  var L = PS.overlayLabel.build("2. aug 2025", "", "Brno, Česko");
  assert.strictEqual(L.middle, null);
  assert.strictEqual(L.right.kind, "place");
  assert.strictEqual(L.right.text, "Brno, Česko");
  assert.strictEqual(L.rightDim, true);
});

test("overlay neither → date only", function () {
  var L = PS.overlayLabel.build("8. mar 2023", null, null);
  assert.strictEqual(L.date, "8. mar 2023");
  assert.strictEqual(L.middle, null);
  assert.strictEqual(L.right, null);
});

test("clock date Slovak genitive", function () {
  PS = loadLib("lib/datefmt.js");
  var d = new Date(2026, 10, 12, 15, 4, 0); // Thu 12 Nov 2026
  assert.strictEqual(PS.datefmt.formatClockTime(d), "15:04");
  assert.strictEqual(PS.datefmt.formatClockDate(d), "štvrtok 12. novembra");
});

// ---- shuffle bag ----
PS = loadLib("lib/shuffle.js");

test("shuffle bag exhausts each id once per cycle", function () {
  var ids = ["a", "b", "c", "d"];
  var bag = new PS.ShuffleBag(ids);
  var seen = {};
  var i;
  for (i = 0; i < 4; i++) {
    var n = bag.next();
    assert.ok(ids.indexOf(n) >= 0);
    assert.ok(!seen[n]);
    seen[n] = true;
  }
  // next cycle refills
  var n2 = bag.next();
  assert.ok(ids.indexOf(n2) >= 0);
});

test("shuffle bag keeps remaining and adds new ids", function () {
  var bag = new PS.ShuffleBag(["a", "b", "c"]);
  bag.next();
  bag.next();
  var rem = bag.peekRemaining();
  assert.strictEqual(rem.length, 1);
  bag.setIds(["a", "b", "c", "d"]);
  var rem2 = bag.peekRemaining();
  assert.ok(rem2.indexOf("d") >= 0);
  assert.ok(rem2.indexOf(rem[0]) >= 0);
});

console.log("\n" + passed + " passed, " + failed + " failed");
process.exit(failed ? 1 : 0);
