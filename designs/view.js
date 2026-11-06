/* Chromium 81–safe view cycling + light/dark theme for the daily recap.
   Views: rodina → branislav → zuzka → andrej → tomas → (cycle).
   Enter / Tab = next; Shift+Tab = previous; Alt+ArrowLeft = Rodina.
   Theme: html.theme-dark|theme-light from schedule (Europe/Prague) or ?theme=.
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
  var darkFrom = body.getAttribute("data-dark-from") || "19:00";
  var darkUntil = body.getAttribute("data-dark-until") || "06:30";
  var themeLocked = null; // "light"|"dark" from ?theme=

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

  function pragueToday() {
    var p = pragueParts();
    if (!p) return "";
    return p.year + "-" + p.month + "-" + p.day;
  }

  function pragueHM() {
    var p = pragueParts();
    if (!p) return fallbackNow;
    return p.hour + ":" + p.minute;
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

  function isDarkAt(mins) {
    var from = parseHM(darkFrom);
    var until = parseHM(darkUntil);
    if (from == null) from = 19 * 60;
    if (until == null) until = 6 * 60 + 30;
    // e.g. 19:00–06:30 spans midnight
    if (from > until) return mins >= from || mins < until;
    return mins >= from && mins < until;
  }

  function applyTheme() {
    var mode = themeLocked;
    if (!mode) {
      var hm = pragueHM();
      var mins = parseHM(hm);
      if (mins == null) mins = 12 * 60;
      mode = isDarkAt(mins) ? "dark" : "light";
    }
    root.classList.remove("theme-dark", "theme-light");
    root.classList.add("theme-" + mode);
    root.setAttribute("data-theme", mode);
    try {
      var meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.setAttribute("content", mode === "dark" ? "#0B1220" : "#d9e3ea");
    } catch (e) {}
  }

  function updateNow() {
    var pageDate = body.getAttribute("data-date") || "";
    var hm = pragueHM();
    var useFallback = false;
    if (pageDate) {
      var today = pragueToday();
      if (today && today !== pageDate && fallbackNow) {
        hm = fallbackNow;
        useFallback = true;
      }
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

    applyTheme();

    var mins = parseHM(hm);
    var markers = document.querySelectorAll(".tl-now");
    var i;
    if (mins == null || mins < dayStart || mins > dayEnd) {
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
      if (!isNaN(endMin) && mins != null && endMin <= mins) cn += " is-past";
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

  function goToTodayPage() {
    // index.html picks today's file; same folder as this page
    try {
      location.replace("index.html");
    } catch (e) {
      location.href = "index.html";
    }
  }

  function armDailyRefresh() {
    // If this page is not today's date, roll forward (new day published).
    var pageDate = body.getAttribute("data-date") || "";
    var today = pragueToday();
    if (pageDate && today && pageDate !== today) {
      // Demospages with ?now= stay put (screenshots / frozen samples).
      if (!/[?&]now=/.test(location.search || "") && body.getAttribute("data-lock-now") !== "1") {
        goToTodayPage();
        return;
      }
    }
    var wait = msUntilRefresh();
    if (wait < 5000) wait = 5000;
    setTimeout(function () {
      location.reload();
    }, wait);
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
    document.addEventListener("keydown", onKey, true);
    window.addEventListener("resize", fitEventBlocks);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
