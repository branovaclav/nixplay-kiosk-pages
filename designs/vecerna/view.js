/* Chromium 81–safe view cycling for the daily recap page.
   Views: rodina → branislav → zuzka → andrej → tomas → (cycle).
   Enter / Tab = next; Shift+Tab = previous; Alt+ArrowLeft ignored.
   Idle 60s → rodina. Now-marker every minute (Europe/Prague). Reload ~30 min.
*/
(function () {
  var VIEWS = ["rodina", "branislav", "zuzka", "andrej", "tomas"];
  var IDLE_MS = 60000;
  var RELOAD_MS = 30 * 60 * 1000;
  var NOW_MS = 60 * 1000;
  var root = document.documentElement;
  var body = document.body;
  var idleTimer = null;
  var fallbackNow = body.getAttribute("data-fallback-now") || "";
  var tz = body.getAttribute("data-timezone") || "Europe/Prague";
  var dayStart = parseInt(body.getAttribute("data-day-start") || "420", 10);
  var dayEnd = parseInt(body.getAttribute("data-day-end") || "1260", 10);

  function viewIndex(id) {
    for (var i = 0; i < VIEWS.length; i++) if (VIEWS[i] === id) return i;
    return 0;
  }

  function refreshSectionVisibility() {
    var blocks = document.querySelectorAll(".hl-block");
    for (var i = 0; i < blocks.length; i++) {
      var lis = blocks[i].querySelectorAll("li");
      var any = false;
      for (var j = 0; j < lis.length; j++) {
        // offsetParent null when display:none
        if (lis[j].offsetParent !== null || lis[j].style.display === "") {
          var cs = window.getComputedStyle(lis[j]);
          if (cs.display !== "none") {
            any = true;
            break;
          }
        }
      }
      blocks[i].style.display = any ? "" : "none";
    }
  }

  function setView(id) {
    if (viewIndex(id) < 0) id = "rodina";
    body.setAttribute("data-view", id);
    // next frame so CSS display:none has applied
    setTimeout(refreshSectionVisibility, 0);
    try {
      if (history.replaceState) {
        var u = location.pathname + location.search;
        // keep ?now= for demos; strip only hash management
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

  function pragueHM() {
    try {
      var parts = new Intl.DateTimeFormat("en-GB", {
        timeZone: tz,
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).formatToParts(new Date());
      var h = "00",
        m = "00";
      for (var i = 0; i < parts.length; i++) {
        if (parts[i].type === "hour") h = parts[i].value;
        if (parts[i].type === "minute") m = parts[i].value;
      }
      if (h === "24") h = "00";
      return h + ":" + m;
    } catch (e) {
      return fallbackNow;
    }
  }

  function parseHM(s) {
    if (!s) return null;
    var p = s.split(":");
    if (p.length < 2) return null;
    return parseInt(p[0], 10) * 60 + parseInt(p[1], 10);
  }

  function updateNow() {
    var pageDate = body.getAttribute("data-date") || "";
    var hm = pragueHM();
    var useFallback = false;
    if (pageDate) {
      try {
        var today = new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date());
        if (today !== pageDate && fallbackNow) {
          hm = fallbackNow;
          useFallback = true;
        }
      } catch (e) {}
    }
    // Screenshots / frozen demos: ?now=09:30 or data-lock-now
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
      if (!isNaN(endMin) && mins != null && endMin <= mins) {
        blocks[i].className = (blocks[i].className || "").replace(/\bis-past\b/g, "") + " is-past";
      } else {
        blocks[i].className = (blocks[i].className || "").replace(/\bis-past\b/g, "").replace(/\s+/g, " ").replace(/^\s|\s$/g, "");
      }
    }
    body.setAttribute("data-now-source", useFallback ? "fallback" : "live");
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
    var q = location.search.match(/[?&]view=([a-z]+)/);
    // Prefer ?view= / #hash; else keep server-rendered data-view; else rodina.
    var initial = body.getAttribute("data-view") || "rodina";
    if (q) initial = q[1];
    else if (hash && viewIndex(hash) >= 0) initial = hash;
    setView(initial);
    armIdle();
    updateNow();
    setInterval(updateNow, NOW_MS);
    setInterval(function () {
      location.reload();
    }, RELOAD_MS);
    document.addEventListener("keydown", onKey, true);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
