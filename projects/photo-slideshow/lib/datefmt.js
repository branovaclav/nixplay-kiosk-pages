/* Slovak date formatting for the overlay. ES5. */
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

  /**
   * Local civil date where the photo was taken.
   * takenUtcMs: UTC epoch ms (CPLAsset.assetDate)
   * tzOffsetSec: seconds east of UTC (CPLAsset.timeZoneOffset); may be null → UTC day
   * → "14. jún 2025"
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

  global.PS = global.PS || {};
  global.PS.datefmt = {
    MONTHS_SK_SHORT: MONTHS_SK_SHORT,
    formatCaptureDate: formatCaptureDate,
  };
})(typeof window !== "undefined" ? window : global);
