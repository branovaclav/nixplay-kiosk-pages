/* Slovak date / clock formatting. ES5. */
(function (global) {
  "use strict";

  var MONTHS_SK_SHORT = [
    "jan",
    "feb",
    "mar",
    "apr",
    "máj",
    "jún",
    "júl",
    "aug",
    "sep",
    "okt",
    "nov",
    "dec",
  ];

  var MONTHS_SK_GENITIVE = [
    "januára",
    "februára",
    "marca",
    "apríla",
    "mája",
    "júna",
    "júla",
    "augusta",
    "septembra",
    "októbra",
    "novembra",
    "decembra",
  ];

  var WEEKDAYS_SK = [
    "nedeľa",
    "pondelok",
    "utorok",
    "streda",
    "štvrtok",
    "piatok",
    "sobota",
  ];

  function pad2(n) {
    return n < 10 ? "0" + n : String(n);
  }

  /**
   * Local civil date where the photo was taken.
   * takenUtcMs + tzOffsetSec → "14. jún 2025"
   */
  function formatCaptureDate(takenUtcMs, tzOffsetSec) {
    if (takenUtcMs == null || !isFinite(takenUtcMs)) return "";
    var offsetMs = typeof tzOffsetSec === "number" ? tzOffsetSec * 1000 : 0;
    var d = new Date(takenUtcMs + offsetMs);
    var day = d.getUTCDate();
    var month = MONTHS_SK_SHORT[d.getUTCMonth()];
    var year = d.getUTCFullYear();
    return day + ". " + month + " " + year;
  }

  /** Local clock time HH:MM (24h). */
  function formatClockTime(date) {
    var d = date || new Date();
    return pad2(d.getHours()) + ":" + pad2(d.getMinutes());
  }

  /** Local long date: "štvrtok 12. novembra" */
  function formatClockDate(date) {
    var d = date || new Date();
    return WEEKDAYS_SK[d.getDay()] + " " + d.getDate() + ". " + MONTHS_SK_GENITIVE[d.getMonth()];
  }

  global.PS = global.PS || {};
  global.PS.datefmt = {
    MONTHS_SK_SHORT: MONTHS_SK_SHORT,
    MONTHS_SK_GENITIVE: MONTHS_SK_GENITIVE,
    WEEKDAYS_SK: WEEKDAYS_SK,
    formatCaptureDate: formatCaptureDate,
    formatClockTime: formatClockTime,
    formatClockDate: formatClockDate,
  };
})(typeof window !== "undefined" ? window : global);
