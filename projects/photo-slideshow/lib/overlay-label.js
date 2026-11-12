/* Overlay label assembly (§10 revised). Date | comment | place. ES5. */
(function (global) {
  "use strict";

  /**
   * Layout rules:
   * - Date always on the left (when present).
   * - When both comment and place: comment in the middle, place on the right.
   * - When only one of comment/place: that one on the right; middle empty.
   * - Place is always dimmed (with pin icon); comment always full strength.
   *
   * @returns {{ date: string, middle: {kind,text}|null, right: {kind,text}|null, rightDim: boolean }}
   */
  function buildOverlayLabel(dateStr, comment, place) {
    var c = (comment || "").replace(/^\s+|\s+$/g, "");
    var p = (place || "").replace(/^\s+|\s+$/g, "");
    var d = (dateStr || "").replace(/^\s+|\s+$/g, "");
    var out = {
      date: d,
      middle: null,
      right: null,
      rightDim: false,
    };
    if (c && p) {
      out.middle = { kind: "comment", text: c };
      out.right = { kind: "place", text: p };
      out.rightDim = true;
    } else if (c) {
      out.right = { kind: "comment", text: c };
      out.rightDim = false;
    } else if (p) {
      out.right = { kind: "place", text: p };
      out.rightDim = true;
    }
    return out;
  }

  global.PS = global.PS || {};
  global.PS.overlayLabel = { build: buildOverlayLabel };
})(typeof window !== "undefined" ? window : global);
