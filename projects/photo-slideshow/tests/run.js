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

test("overlay slotHtml includes comment SVG icon before text", function () {
  PS = loadLib("lib/overlay-label.js");
  var html = PS.overlayLabel.slotHtml({ kind: "comment", text: "Demo komentár" });
  assert.ok(html.indexOf('class="overlay-comment"') >= 0);
  assert.ok(html.indexOf('class="overlay-icon"') >= 0);
  assert.ok(html.indexOf("<svg") >= 0);
  assert.ok(html.indexOf("</svg>") >= 0);
  assert.ok(html.indexOf(PS.overlayLabel.ICON_COMMENT) >= 0);
  assert.ok(html.indexOf("Demo komentár") >= 0);
  // text is after the icon
  assert.ok(html.indexOf("</svg>") < html.indexOf("Demo komentár"));
});

test("overlay slotHtml includes place SVG icon and place class", function () {
  PS = loadLib("lib/overlay-label.js");
  var html = PS.overlayLabel.slotHtml({ kind: "place", text: "Paríž, Francúzsko" });
  assert.ok(html.indexOf('class="overlay-place"') >= 0);
  assert.ok(html.indexOf('class="overlay-icon"') >= 0);
  assert.ok(html.indexOf(PS.overlayLabel.ICON_PLACE) >= 0);
  assert.ok(html.indexOf("Paríž, Francúzsko") >= 0);
  assert.strictEqual(PS.overlayLabel.slotHtml(null), "");
});

test("overlay both slots each carry their own icon kind", function () {
  PS = loadLib("lib/overlay-label.js");
  var L = PS.overlayLabel.build("14. jún 2025", "Dovolenka", "Paríž, Francúzsko");
  var mid = PS.overlayLabel.slotHtml(L.middle);
  var right = PS.overlayLabel.slotHtml(L.right);
  assert.ok(mid.indexOf(PS.overlayLabel.ICON_COMMENT) >= 0);
  assert.ok(mid.indexOf(PS.overlayLabel.ICON_PLACE) < 0);
  assert.ok(right.indexOf(PS.overlayLabel.ICON_PLACE) >= 0);
  assert.ok(right.indexOf(PS.overlayLabel.ICON_COMMENT) < 0);
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

// ---- cloudkit asset/master pairing (synthetic; no network) ----
function loadCloudkit() {
  var code = fs.readFileSync(path.join(ROOT, "lib/cloudkit.js"), "utf8");
  var sandbox = {
    console: console,
    Promise: Promise,
    setTimeout: setTimeout,
    XMLHttpRequest: function () {},
    Math: Math,
  };
  sandbox.global = sandbox;
  sandbox.window = undefined;
  vm.runInNewContext(code, sandbox, { filename: "lib/cloudkit.js" });
  return sandbox.PS.cloudkit;
}

function synthMaster(name) {
  return { recordName: name, recordType: "CPLMaster", fields: {} };
}

function synthAsset(name, masterName) {
  return {
    recordName: name,
    recordType: "CPLAsset",
    fields: {
      masterRef: { value: { recordName: masterName, action: "NONE" } },
    },
  };
}

test("pairAssetAndMasterRecords: masters-then-assets page yields all N pairs", function () {
  var ck = loadCloudkit();
  // Mirrors live CloudKit page order: all Masters, then all Assets.
  var recs = [
    synthMaster("M1"),
    synthMaster("M2"),
    synthMaster("M3"),
    synthAsset("A1", "M1"),
    synthAsset("A2", "M2"),
    synthAsset("A3", "M3"),
  ];
  var pairs = ck.pairAssetAndMasterRecords(recs);
  assert.strictEqual(pairs.length, 3);
  assert.strictEqual(pairs[0].asset.recordName, "A1");
  assert.strictEqual(pairs[0].master.recordName, "M1");
  assert.strictEqual(pairs[1].asset.recordName, "A2");
  assert.strictEqual(pairs[1].master.recordName, "M2");
  assert.strictEqual(pairs[2].asset.recordName, "A3");
  assert.strictEqual(pairs[2].master.recordName, "M3");
});

test("pairAssetAndMasterRecords: interleaved and single-photo pages still work", function () {
  var ck = loadCloudkit();
  var interleaved = [
    synthMaster("M1"),
    synthAsset("A1", "M1"),
    synthMaster("M2"),
    synthAsset("A2", "M2"),
  ];
  var p1 = ck.pairAssetAndMasterRecords(interleaved);
  assert.strictEqual(p1.length, 2);
  assert.strictEqual(p1[0].master.recordName, "M1");
  assert.strictEqual(p1[1].asset.recordName, "A2");

  var one = [synthMaster("Mx"), synthAsset("Ax", "Mx")];
  var p2 = ck.pairAssetAndMasterRecords(one);
  assert.strictEqual(p2.length, 1);
  assert.strictEqual(p2[0].asset.recordName, "Ax");
  assert.strictEqual(p2[0].master.recordName, "Mx");
});

test("pairAssetAndMasterRecords: skips asset when master missing on page", function () {
  var ck = loadCloudkit();
  var recs = [synthMaster("M1"), synthAsset("A1", "M1"), synthAsset("A2", "M-missing")];
  var pairs = ck.pairAssetAndMasterRecords(recs);
  assert.strictEqual(pairs.length, 1);
  assert.strictEqual(pairs[0].asset.recordName, "A1");
});

// ---- sync / cache policy ----
PS = loadLib("lib/sync-policy.js");

test("filterMetasForAlbums drops demo and removed-album leftovers", function () {
  var metas = [
    { id: "a1", album: "albumA" },
    { id: "d1", album: "demo" },
    { id: "b1", album: "albumB" },
    { id: "x1", album: "gone" },
  ];
  var keep = PS.syncPolicy.filterMetasForAlbums(metas, ["albumA", "albumB"]);
  assert.strictEqual(keep.length, 2);
  assert.strictEqual(keep[0].id, "a1");
  assert.strictEqual(keep[1].id, "b1");
  var foreign = PS.syncPolicy.foreignMetaIds(metas, ["albumA", "albumB"]).slice().sort();
  assert.strictEqual(foreign.join(","), "d1,x1");
});

test("filterMetasForAlbums in demo only keeps demo album", function () {
  var metas = [
    { id: "d1", album: "demo" },
    { id: "a1", album: "albumA" },
  ];
  var keep = PS.syncPolicy.filterMetasForAlbums(metas, ["demo"]);
  assert.strictEqual(keep.length, 1);
  assert.strictEqual(keep[0].id, "d1");
});

test("shouldSyncOnVisible resumes interrupted sync", function () {
  var sp = PS.syncPolicy;
  var now = 1e12;
  assert.strictEqual(sp.shouldSyncOnVisible(now - 1000, true, now, sp.VISIBLE_SYNC_MIN_INTERVAL_MS), true);
  assert.strictEqual(
    sp.shouldSyncOnVisible(now - 1000, false, now, sp.VISIBLE_SYNC_MIN_INTERVAL_MS),
    false
  );
});

test("shouldSyncOnVisible after stale lastCompletedAt", function () {
  var sp = PS.syncPolicy;
  var now = 1e12;
  var fresh = now - 60 * 1000;
  var stale = now - sp.VISIBLE_SYNC_MIN_INTERVAL_MS - 1;
  assert.strictEqual(sp.shouldSyncOnVisible(fresh, false, now), false);
  assert.strictEqual(sp.shouldSyncOnVisible(stale, false, now), true);
  assert.strictEqual(sp.shouldSyncOnVisible(null, false, now), true);
});

test("assetIdsForPost maps via assetBatchId === post.recordName", function () {
  var ck = loadCloudkit();
  var post = { recordName: "POST-BATCH-1", fields: { caption: { value: "Trip" } } };
  var pairs = [
    {
      asset: {
        recordName: "A1",
        recordType: "CPLAsset",
        fields: { assetBatchId: { value: "POST-BATCH-1" } },
      },
      master: synthMaster("M1"),
    },
    {
      asset: {
        recordName: "A2",
        recordType: "CPLAsset",
        fields: { assetBatchId: { value: "OTHER" } },
      },
      master: synthMaster("M2"),
    },
    {
      asset: {
        recordName: "A3",
        recordType: "CPLAsset",
        fields: { assetBatchId: { value: "POST-BATCH-1" } },
      },
      master: synthMaster("M3"),
    },
  ];
  var ids = ck.assetIdsForPost(post, pairs);
  assert.strictEqual(ids.length, 2);
  assert.strictEqual(ids[0], "A1");
  assert.strictEqual(ids[1], "A3");
  assert.strictEqual(ck.postBatchId(post), "POST-BATCH-1");
});

test("assetIdsForPost prefers explicit post.assetBatchId field when present", function () {
  var ck = loadCloudkit();
  var post = {
    recordName: "POST-NAME",
    fields: { assetBatchId: { value: "EXPLICIT-BATCH" }, caption: { value: "X" } },
  };
  var pairs = [
    {
      asset: {
        recordName: "A1",
        fields: { assetBatchId: { value: "EXPLICIT-BATCH" } },
      },
    },
    {
      asset: {
        recordName: "A2",
        fields: { assetBatchId: { value: "POST-NAME" } },
      },
    },
  ];
  var ids = ck.assetIdsForPost(post, pairs);
  assert.strictEqual(ids.join(","), "A1");
});

console.log("\n" + passed + " passed, " + failed + " failed");
process.exit(failed ? 1 : 0);
