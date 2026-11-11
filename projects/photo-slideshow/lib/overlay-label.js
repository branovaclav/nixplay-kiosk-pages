/* Overlay label assembly (§10). Comment and place share one slot. ES5. */
(function (global) {
  "use strict";

  /**
   * @param {string} dateStr  already formatted Slovak date (may be "")
   * @param {string} comment  trip name / post caption (may be "")
   * @param {string} place    geocoded place (may be "")
   * @returns {{ date: string, primary: string|null, secondary: string|null, secondaryDim: boolean, showOsm: boolean }}
   *   primary = full-strength text in the comment/place slot (null if empty)
   *   secondary = dimmed place when both present (null otherwise)
   *   secondaryDim = true when secondary should be shown at ~60% opacity
   */
  function buildOverlayLabel(dateStr, comment, place) {
    var c = (comment || "").replace(/^\s+|\s+$/g, "");
    var p = (place || "").replace(/^\s+|\s+$/g, "");
    var d = (dateStr || "").replace(/^\s+|\s+$/g, "");
    var out = {
      date: d,
      primary: null,
      primaryKind: null, // "comment" | "place"
      secondary: null,
      secondaryKind: null,
      secondaryDim: false,
      showOsm: false,
    };
    if (c && p) {
      out.primary = c;
      out.primaryKind = "comment";
      out.secondary = p;
      out.secondaryKind = "place";
      out.secondaryDim = true;
      out.showOsm = true;
    } else if (c) {
      out.primary = c;
      out.primaryKind = "comment";
    } else if (p) {
      out.primary = p;
      out.primaryKind = "place";
      out.showOsm = true;
    }
    return out;
  }

  global.PS = global.PS || {};
  global.PS.overlayLabel = { build: buildOverlayLabel };
})(typeof window !== "undefined" ? window : global);