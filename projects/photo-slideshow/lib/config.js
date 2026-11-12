/* Config from #cfg= base64url JSON → localStorage['ps.cfg']. ES5. */
(function (global) {
  "use strict";

  var LS_KEY = "ps.cfg";

  var CLOCK_FONTS = {
    system: true,
    manrope: true,
    inter: true,
    outfit: true,
    figtree: true,
  };

  var DEFAULTS = {
    albums: [],
    interval: 5,
    fade: 0.6,
    sharpen: 0.3,
    clockFont: "system",
    nominatimUrl: "https://nominatim.openstreetmap.org/reverse",
    photonUrl: "https://photon.komoot.io/reverse",
  };

  function b64urlDecode(s) {
    var pad = s.length % 4;
    var b64 = s.replace(/-/g, "+").replace(/_/g, "/");
    if (pad) b64 += "====".slice(0, 4 - pad);
    var bin = atob(b64);
    // UTF-8
    try {
      return decodeURIComponent(escape(bin));
    } catch (e) {
      return bin;
    }
  }

  function parseHashCfg() {
    var hash = global.location && global.location.hash ? global.location.hash : "";
    var m = hash.match(/(?:^#|&)cfg=([A-Za-z0-9_-]+)/);
    if (!m) {
      // also allow sole #cfg=...
      m = hash.match(/^#cfg=([A-Za-z0-9_-]+)/);
    }
    if (!m) return null;
    try {
      return JSON.parse(b64urlDecode(m[1]));
    } catch (e) {
      return null;
    }
  }

  function readStored() {
    try {
      var raw = global.localStorage && global.localStorage.getItem(LS_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  }

  function writeStored(obj) {
    try {
      if (global.localStorage) {
        global.localStorage.setItem(LS_KEY, JSON.stringify(obj));
      }
    } catch (e) {}
  }

  function validate(raw) {
    if (!raw || typeof raw !== "object") return null;
    var albums = raw.albums;
    if (!albums || !albums.length || albums.length > 5) return null;
    var i;
    for (i = 0; i < albums.length; i++) {
      if (typeof albums[i] !== "string" || !albums[i]) return null;
    }
    return raw;
  }

  function merge(raw) {
    var out = {};
    var k;
    for (k in DEFAULTS) {
      if (DEFAULTS.hasOwnProperty(k)) out[k] = DEFAULTS[k];
    }
    if (!raw) return out;
    if (raw.albums) out.albums = raw.albums.slice();
    if (raw.interval != null && isFinite(raw.interval)) out.interval = Number(raw.interval);
    if (raw.fade != null && isFinite(raw.fade)) out.fade = Number(raw.fade);
    if (raw.sharpen != null && isFinite(raw.sharpen)) out.sharpen = Number(raw.sharpen);
    if (raw.clockFont && CLOCK_FONTS[String(raw.clockFont)]) {
      out.clockFont = String(raw.clockFont);
    }
    if (raw.nominatimUrl) out.nominatimUrl = String(raw.nominatimUrl);
    if (raw.photonUrl) out.photonUrl = String(raw.photonUrl);
    return out;
  }

  /** Optional ?clockFont=manrope|inter|outfit|figtree|system for A/B without rewriting #cfg=. */
  function clockFontFromQuery() {
    try {
      var m = /[?&]clockFont=([A-Za-z0-9_-]+)/.exec(
        global.location && global.location.search ? global.location.search : ""
      );
      if (m && CLOCK_FONTS[m[1]]) return m[1];
    } catch (e) {}
    return null;
  }

  /** Load config: fragment wins → mirror to LS; else LS; else null (unset). */
  function load() {
    var fromHash = validate(parseHashCfg());
    if (fromHash) {
      writeStored(fromHash);
      return merge(fromHash);
    }
    var stored = validate(readStored());
    if (stored) return merge(stored);
    return null;
  }

  global.PS = global.PS || {};
  global.PS.config = {
    DEFAULTS: DEFAULTS,
    CLOCK_FONTS: CLOCK_FONTS,
    LS_KEY: LS_KEY,
    load: load,
    merge: merge,
    validate: validate,
    parseHashCfg: parseHashCfg,
    b64urlDecode: b64urlDecode,
    clockFontFromQuery: clockFontFromQuery,
  };
})(typeof window !== "undefined" ? window : global);
