/* Visibility pause/resume helpers (testable, no I/O). ES5.
   Chromium 81 on Android may freeze a hidden page and later fire `resume`
   without a matching `visibilitychange`. Treat visibility as state. */
(function (global) {
  "use strict";

  /** Last-resort poll when freeze/resume/focus events are missed. */
  var POLL_INTERVAL_MS = 10000;
  /** Show path must not stay black if restore hangs. */
  var RESTORE_TIMEOUT_MS = 10000;

  /**
   * Compare browser hidden state with the page's own paused flag.
   * @returns {"hide"|"show"|null} action to run, or null when already in sync
   */
  function transition(documentHidden, currentlyPaused) {
    var wantHidden = !!documentHidden;
    var paused = !!currentlyPaused;
    if (wantHidden === paused) return null;
    return wantHidden ? "hide" : "show";
  }

  /**
   * What the slideshow show-path should do after restoreDisplay settles.
   * "ok" → keep restored photo and arm timer; anything else → advance().
   */
  function restoreFollowUp(outcome) {
    return outcome === "ok" ? "arm" : "advance";
  }

  global.PS = global.PS || {};
  global.PS.visibility = {
    POLL_INTERVAL_MS: POLL_INTERVAL_MS,
    RESTORE_TIMEOUT_MS: RESTORE_TIMEOUT_MS,
    transition: transition,
    restoreFollowUp: restoreFollowUp,
  };
})(typeof window !== "undefined" ? window : global);
