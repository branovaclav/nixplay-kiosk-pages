/* Chromium 81–safe view cycling + light/dark theme for the daily recap.
   Views: rodina → branislav → zuzka → andrej → tomas → (cycle).
   Enter / Tab = next; Shift+Tab = previous; Alt+ArrowLeft = Rodina.
   Theme: sun (NOAA sunrise/sunset) or fixed clock; ?theme= locks.
   Idle 60s → rodina. Now-marker every minute. Daily reload at refresh_at.
*/
(function () {
  var VIEWS = ["rodina", "branislav", "zuzka", "andrej", "tomas"];
  var IDLE_MS = 60000;
  var NOW_MS = 60 * 1000;
  var body = document.body;
  var root = document.documentElement;
  var idleTimer = null;
  var fallbackNow = body.getAttribute("data-fallback-now") || "";
  var tz = body.getAttribute("data-timezone") || "Europe/Prague";
  var dayStart = parseInt(body.getAttribute("data-day-start") || "420", 10);
  var dayEnd = parseInt(body.getAttribute("data-day-end") || "1260", 10);
  var refreshAt = body.getAttribute("data-refresh-at") || "06:30";
  var themeMode = (body.getAttribute("data-theme-mode") || "fixed").toLowerCase();
  var lat = parseFloat(body.getAttribute("data-lat") || "50.08");
  var lon = parseFloat(body.getAttribute("data-lon") || "14.42");
  var sunriseOffset = parseInt(body.getAttribute("data-sunrise-offset") || "0", 10) || 0;
  var sunsetOffset = parseInt(body.getAttribute("data-sunset-offset") || "0", 10) || 0;
  var darkFrom = body.getAttribute("data-dark-from") || "19:00";
  var darkUntil = body.getAttribute("data-dark-until") || "06:30";
  var themeLocked = null; // "light"|"dark" from ?theme=
  var lastSunKey = "";
  var cachedSun = null; // { rise, set } minutes from local midnight
  var VERSION_MS = 5 * 60 * 1000;
  var knownVersionId = null;

  function viewIndex(id) {
    for (var i = 0; i < VIEWS.length; i++) if (VIEWS[i] === id) return i;
    return 0;
  }

  function pragueParts() {
    try {
      var parts = new Intl.DateTimeFormat("en-GB", {
        timeZone: tz,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      }).formatToParts(new Date());
      var o = { year: "1970", month: "01", day: "01", hour: "00", minute: "00", second: "00" };
      for (var i = 0; i < parts.length; i++) {
        if (o.hasOwnProperty(parts[i].type)) o[parts[i].type] = parts[i].value;
      }
      if (o.hour === "24") o.hour = "00";
      return o;
    } catch (e) {
      return null;
    }
  }

  function mockTodayParam() {
    var m = (location.search || "").match(/[?&]today=(\d{4}-\d{2}-\d{2})/);
    return m ? m[1] : "";
  }

  function pragueToday() {
    var mock = mockTodayParam();
    if (mock) return mock;
    var p = pragueParts();
    if (!p) return "";
    return p.year + "-" + p.month + "-" + p.day;
  }

  function pragueHM() {
    var p = pragueParts();
    if (!p) return fallbackNow;
    return p.hour + ":" + p.minute;
  }

  function addDaysIso(iso, delta) {
    var p = iso.split("-");
    var dt = new Date(Date.UTC(parseInt(p[0], 10), parseInt(p[1], 10) - 1, parseInt(p[2], 10)));
    dt.setUTCDate(dt.getUTCDate() + delta);
    var y = dt.getUTCFullYear();
    var m = dt.getUTCMonth() + 1;
    var d = dt.getUTCDate();
    return (
      y +
      "-" +
      (m < 10 ? "0" : "") +
      m +
      "-" +
      (d < 10 ? "0" : "") +
      d
    );
  }

  function weekdaySk(iso) {
    var names = ["Pondelok", "Utorok", "Streda", "Štvrtok", "Piatok", "Sobota", "Nedeľa"];
    var p = iso.split("-");
    var dt = new Date(Date.UTC(parseInt(p[0], 10), parseInt(p[1], 10) - 1, parseInt(p[2], 10)));
    return names[dt.getUTCDay() === 0 ? 6 : dt.getUTCDay() - 1]; // JS Sun=0 → SK Mon-first
  }

  function jsWeekday(iso) {
    var p = iso.split("-");
    return new Date(Date.UTC(parseInt(p[0], 10), parseInt(p[1], 10) - 1, parseInt(p[2], 10))).getUTCDay();
  }

  /** Outlook title from target span relative to viewing day (Prague today). */
  function outlookTitleFor(from, to, viewing) {
    if (!from) return null;
    if (!to) to = from;
    var fromWd = jsWeekday(from);
    var toWd = jsWeekday(to);
    // Weekend span Sat+Sun (any order)
    if (from !== to && ((fromWd === 6 && toWd === 0) || (fromWd === 0 && toWd === 6))) {
      return "Víkend";
    }
    if (from === to && fromWd === 6 && toWd === 6) {
      /* single Saturday — weekday name below */
    }
    var tomorrow = addDaysIso(viewing, 1);
    if (from === to && from === tomorrow) return "Zajtra";
    if (from === to) return weekdaySk(from);
    // Multi-day non-weekend: prefer end day's weekday, else from
    return weekdaySk(to);
  }

  function parseHM(s) {
    if (!s) return null;
    var p = s.split(":");
    if (p.length < 2) return null;
    return parseInt(p[0], 10) * 60 + parseInt(p[1], 10);
  }

  function refreshSectionVisibility() {
    var blocks = document.querySelectorAll(".hl-block");
    for (var i = 0; i < blocks.length; i++) {
      var lis = blocks[i].querySelectorAll("li");
      var any = false;
      for (var j = 0; j < lis.length; j++) {
        var cs = window.getComputedStyle(lis[j]);
        if (cs.display !== "none") {
          any = true;
          break;
        }
      }
      blocks[i].style.display = any ? "" : "none";
    }
  }

  /** Hide secondary event lines that don't fit the block (no clipping). */
  function fitEventBlocks() {
    var blocks = document.querySelectorAll(".event-block");
    for (var i = 0; i < blocks.length; i++) {
      var el = blocks[i];
      if (el.offsetParent === null) continue;
      var extras = el.querySelectorAll(".ev-loc, .ev-status, .ev-flags, .ev-time");
      var k;
      for (k = 0; k < extras.length; k++) extras[k].style.display = "";
      // Prefer keeping title; drop flags → status → loc → time if overflowing
      var order = [".ev-flags", ".ev-status", ".ev-loc", ".ev-time"];
      var guard = 0;
      while (el.scrollHeight > el.clientHeight + 1 && guard < 8) {
        var hidden = false;
        for (k = 0; k < order.length; k++) {
          var nodes = el.querySelectorAll(order[k]);
          for (var n = 0; n < nodes.length; n++) {
            if (nodes[n].style.display === "none") continue;
            nodes[n].style.display = "none";
            hidden = true;
            break;
          }
          if (hidden) break;
        }
        if (!hidden) break;
        guard++;
      }
    }
  }

  function setView(id) {
    if (viewIndex(id) < 0) id = "rodina";
    body.setAttribute("data-view", id);
    setTimeout(function () {
      refreshSectionVisibility();
      fitEventBlocks();
    }, 0);
    try {
      if (history.replaceState) {
        var u = location.pathname + location.search;
        if (id === "rodina") history.replaceState(null, "", u.split("#")[0]);
        else history.replaceState(null, "", u.split("#")[0] + "#" + id);
      }
    } catch (e) {}
  }

  function nextView(dir) {
    var i = viewIndex(body.getAttribute("data-view") || "rodina");
    i = (i + dir + VIEWS.length) % VIEWS.length;
    setView(VIEWS[i]);
  }

  function armIdle() {
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(function () {
      setView("rodina");
    }, IDLE_MS);
  }

  function isDarkFixed(mins) {
    var from = parseHM(darkFrom);
    var until = parseHM(darkUntil);
    if (from == null) from = 19 * 60;
    if (until == null) until = 6 * 60 + 30;
    // e.g. 19:00–06:30 spans midnight
    if (from > until) return mins >= from || mins < until;
    return mins >= from && mins < until;
  }

  /** UTC offset (minutes east of UTC) for Europe/Prague on a civil date — Chromium 81 safe. */
  function pragueUtcOffsetMin(y, mo, d) {
    var utcNoon = new Date(Date.UTC(y, mo - 1, d, 12, 0, 0));
    try {
      var parts = new Intl.DateTimeFormat("en-GB", {
        timeZone: tz,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      }).formatToParts(utcNoon);
      var o = { year: "1970", month: "01", day: "01", hour: "12", minute: "00", second: "00" };
      for (var i = 0; i < parts.length; i++) {
        if (o.hasOwnProperty(parts[i].type)) o[parts[i].type] = parts[i].value;
      }
      if (o.hour === "24") o.hour = "00";
      var asUtc = Date.UTC(
        parseInt(o.year, 10),
        parseInt(o.month, 10) - 1,
        parseInt(o.day, 10),
        parseInt(o.hour, 10),
        parseInt(o.minute, 10),
        parseInt(o.second, 10)
      );
      return Math.round((asUtc - utcNoon.getTime()) / 60000);
    } catch (e) {
      // CET/CEST rough fallback
      return mo >= 4 && mo <= 10 ? 120 : 60;
    }
  }

  /**
   * NOAA solar calculator (approx.) → local sunrise/sunset minutes from midnight.
   * Zenith 90.833° (official sunrise/sunset with refraction).
   */
  function sunTimesForDay(y, mo, d) {
    var key = y + "-" + mo + "-" + d + ":" + lat + "," + lon;
    if (cachedSun && lastSunKey === key) return cachedSun;

    function toRad(x) {
      return (x * Math.PI) / 180;
    }
    function toDeg(x) {
      return (x * 180) / Math.PI;
    }

    // Day of year
    var start = Date.UTC(y, 0, 0);
    var day = Date.UTC(y, mo - 1, d);
    var N = Math.round((day - start) / 86400000);

    // Fractional year (radians), approx at noon
    var gamma = ((2 * Math.PI) / 365) * (N - 1 + (12 - 12) / 24);

    var eqtime =
      229.18 *
      (0.000075 +
        0.001868 * Math.cos(gamma) -
        0.032077 * Math.sin(gamma) -
        0.014615 * Math.cos(2 * gamma) -
        0.040849 * Math.sin(2 * gamma));

    var decl =
      0.006918 -
      0.399912 * Math.cos(gamma) +
      0.070257 * Math.sin(gamma) -
      0.006758 * Math.cos(2 * gamma) +
      0.000907 * Math.sin(2 * gamma) -
      0.002697 * Math.cos(3 * gamma) +
      0.00148 * Math.sin(3 * gamma);

    var latR = toRad(lat);
    var cosHa =
      Math.cos(toRad(90.833)) / (Math.cos(latR) * Math.cos(decl)) -
      Math.tan(latR) * Math.tan(decl);
    if (cosHa > 1) cosHa = 1;
    if (cosHa < -1) cosHa = -1;
    var ha = toDeg(Math.acos(cosHa)); // degrees

    // Minutes from UTC midnight (NOAA)
    var sunriseUtc = 720 - 4 * (lon + ha) - eqtime;
    var sunsetUtc = 720 - 4 * (lon - ha) - eqtime;
    var off = pragueUtcOffsetMin(y, mo, d);

    var rise = Math.round(sunriseUtc + off) + sunriseOffset;
    var set = Math.round(sunsetUtc + off) + sunsetOffset;
    // Clamp to day
    if (rise < 0) rise = 0;
    if (set > 24 * 60 - 1) set = 24 * 60 - 1;

    cachedSun = { rise: rise, set: set };
    lastSunKey = key;
    return cachedSun;
  }

  function fmtMins(m) {
    if (m == null || isNaN(m)) return "";
    var h = Math.floor(m / 60);
    var mm = m % 60;
    return (h < 10 ? "0" : "") + h + ":" + (mm < 10 ? "0" : "") + mm;
  }

  function isDarkSun(mins, y, mo, d) {
    var sun = sunTimesForDay(y, mo, d);
    if (!sun || sun.rise == null || sun.set == null || sun.rise >= sun.set) {
      return isDarkFixed(mins);
    }
    // light from sunrise through sunset; dark otherwise
    return mins < sun.rise || mins >= sun.set;
  }

  function isDarkNow() {
    var p = pragueParts();
    var hm = pragueHM();
    var mins = parseHM(hm);
    if (mins == null) mins = 12 * 60;
    if (themeMode === "sun" && p && !isNaN(lat) && !isNaN(lon)) {
      try {
        return isDarkSun(
          mins,
          parseInt(p.year, 10),
          parseInt(p.month, 10),
          parseInt(p.day, 10)
        );
      } catch (e) {
        return isDarkFixed(mins);
      }
    }
    return isDarkFixed(mins);
  }

  function applyTheme() {
    var mode = themeLocked;
    if (!mode) {
      mode = isDarkNow() ? "dark" : "light";
    }
    root.classList.remove("theme-dark", "theme-light");
    root.classList.add("theme-" + mode);
    root.setAttribute("data-theme", mode);
    try {
      var p = pragueParts();
      if (p && themeMode === "sun") {
        var sun = sunTimesForDay(
          parseInt(p.year, 10),
          parseInt(p.month, 10),
          parseInt(p.day, 10)
        );
        root.setAttribute("data-sunrise", fmtMins(sun.rise));
        root.setAttribute("data-sunset", fmtMins(sun.set));
      }
      var meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.setAttribute("content", mode === "dark" ? "#0B1220" : "#d9e3ea");
    } catch (e) {}
  }

  /** Page date is tomorrow relative to Prague viewing day. */
  function isTomorrowPage() {
    var pageDate = body.getAttribute("data-date") || "";
    var today = pragueToday();
    if (!pageDate || !today) return false;
    return pageDate === addDaysIso(today, 1);
  }

  function isTodayPage() {
    var pageDate = body.getAttribute("data-date") || "";
    var today = pragueToday();
    return !!(pageDate && today && pageDate === today);
  }

  function syncRelativeChrome() {
    var today = pragueToday();
    var tomorrow = isTomorrowPage();
    var todayPage = isTodayPage();
    if (tomorrow) body.classList.add("is-future-day");
    else body.classList.remove("is-future-day");
    body.setAttribute("data-day-role", tomorrow ? "tomorrow" : todayPage ? "today" : "other");

    var rodinaEyebrow = document.querySelector(".eyebrow-rodina");
    if (rodinaEyebrow) {
      rodinaEyebrow.textContent = tomorrow ? "Zajtra" : "Rodinný prehľad";
    }

    var boxes = document.querySelectorAll(".outlook-box[data-outlook-from]");
    for (var i = 0; i < boxes.length; i++) {
      var from = boxes[i].getAttribute("data-outlook-from") || "";
      var to = boxes[i].getAttribute("data-outlook-to") || from;
      var titleEl = boxes[i].querySelector("h3[data-outlook-title]");
      if (!titleEl || !today) continue;
      var computed = outlookTitleFor(from, to, today);
      if (computed) titleEl.textContent = computed;
    }
  }

  function updateNow() {
    var pageDate = body.getAttribute("data-date") || "";
    var hm = pragueHM();
    var useFallback = false;
    var today = pragueToday();
    var tomorrow = isTomorrowPage();
    var todayPage = isTodayPage();
    // Stale past day (page < today): keep sample fallback for demos if any
    if (pageDate && today && pageDate < today && fallbackNow) {
      hm = fallbackNow;
      useFallback = true;
    }
    var q = location.search || "";
    var m = q.match(/[?&]now=(\d{1,2}:\d{2})/);
    if (m) {
      hm = m[1].length === 4 ? "0" + m[1] : m[1];
      useFallback = true;
    }
    if (body.getAttribute("data-lock-now") === "1" && fallbackNow) {
      hm = fallbackNow;
      useFallback = true;
    }

    syncRelativeChrome();
    applyTheme();

    var mins = parseHM(hm);
    var markers = document.querySelectorAll(".tl-now");
    var i;
    // „teraz“ only when the page is today
    if (!todayPage || mins == null || mins < dayStart || mins > dayEnd) {
      for (i = 0; i < markers.length; i++) markers[i].style.display = "none";
    } else {
      var pct = ((mins - dayStart) / (dayEnd - dayStart)) * 100;
      for (i = 0; i < markers.length; i++) {
        markers[i].style.display = "";
        markers[i].style.top = pct + "%";
        var lab = markers[i].querySelector(".tl-now-label");
        if (lab) lab.textContent = "teraz " + hm;
      }
    }

    var blocks = document.querySelectorAll(".event-block[data-end-min]");
    for (i = 0; i < blocks.length; i++) {
      var endMin = parseInt(blocks[i].getAttribute("data-end-min"), 10);
      var cn = (blocks[i].className || "").replace(/\bis-past\b/g, "").replace(/\s+/g, " ");
      if (todayPage && !isNaN(endMin) && mins != null && endMin <= mins) cn += " is-past";
      blocks[i].className = cn.replace(/^\s|\s$/g, "");
    }
    body.setAttribute("data-now-source", useFallback ? "fallback" : "live");
    fitEventBlocks();
  }

  /** Ms until next refresh_at in Europe/Prague (today if still ahead, else tomorrow). */
  function msUntilRefresh() {
    var target = parseHM(refreshAt);
    if (target == null) target = 6 * 60 + 30;
    var p = pragueParts();
    if (!p) return 60 * 60 * 1000;
    var nowMin = parseInt(p.hour, 10) * 60 + parseInt(p.minute, 10);
    var nowSec = parseInt(p.second, 10) || 0;
    var deltaMin = target - nowMin;
    if (deltaMin < 0 || (deltaMin === 0 && nowSec > 0)) deltaMin += 24 * 60;
    return deltaMin * 60 * 1000 - nowSec * 1000;
  }

  function softReload() {
    try {
      location.reload();
    } catch (e) {
      location.href = location.href;
    }
  }

  function armDailyRefresh() {
    // Only bail when the page is *past* (page date < Prague today).
    // Tomorrow's evening file (page > today) must stay — no redirect loop.
    var pageDate = body.getAttribute("data-date") || "";
    var today = pragueToday();
    var frozen =
      /[?&]now=/.test(location.search || "") ||
      /[?&]today=/.test(location.search || "") ||
      body.getAttribute("data-lock-now") === "1";
    if (pageDate && today && pageDate < today && !frozen) {
      softReload(); // index.html rebuilt to today/tomorrow
      return;
    }
    var wait = msUntilRefresh();
    if (wait < 5000) wait = 5000;
    setTimeout(function () {
      softReload();
    }, wait);
  }

  /** Poll site/version.json so evening Pages deploys reach the frame quickly. */
  function armVersionPoll() {
    if (typeof fetch !== "function") return;
    function check() {
      var url = "version.json?_=" + String(Date.now());
      fetch(url)
        .then(function (r) {
          if (!r || !r.ok) return null;
          return r.json();
        })
        .then(function (data) {
          if (!data || !data.id) return;
          if (knownVersionId == null) {
            knownVersionId = data.id;
            return;
          }
          if (data.id !== knownVersionId) softReload();
        })
        .catch(function () {});
    }
    check();
    setInterval(check, VERSION_MS);
  }

  function onKey(e) {
    var key = e.key || "";
    var code = e.keyCode || e.which;
    var isTab = key === "Tab" || code === 9;
    var isEnter = key === "Enter" || code === 13;
    var isBack = (key === "ArrowLeft" || code === 37) && e.altKey;

    if (isBack) {
      e.preventDefault();
      e.stopPropagation();
      setView("rodina");
      armIdle();
      return;
    }
    if (isEnter || isTab) {
      e.preventDefault();
      e.stopPropagation();
      if (isTab && e.shiftKey) nextView(-1);
      else nextView(1);
      armIdle();
      return;
    }
    armIdle();
  }

  function boot() {
    var hash = (location.hash || "").replace(/^#/, "");
    var qView = location.search.match(/[?&]view=([a-z]+)/);
    var qTheme = location.search.match(/[?&]theme=(light|dark)/);
    if (qTheme) themeLocked = qTheme[1];
    var initial = body.getAttribute("data-view") || "rodina";
    if (qView) initial = qView[1];
    else if (hash && viewIndex(hash) >= 0) initial = hash;
    applyTheme();
    setView(initial);
    armIdle();
    updateNow();
    setInterval(updateNow, NOW_MS);
    armDailyRefresh();
    armVersionPoll();
    document.addEventListener("keydown", onKey, true);
    window.addEventListener("resize", fitEventBlocks);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
