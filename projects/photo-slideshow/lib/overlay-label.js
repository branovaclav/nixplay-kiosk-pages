/* Overlay label assembly (§10 revised). Date | comment | place. ES5. */
(function (global) {
  "use strict";

  // Inline SVG icons (not emoji / font glyphs) — Chromium 81 safe; fill via CSS currentColor.
  var ICON_COMMENT =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h16a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H9l-5 4v-4H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"/></svg>';
  var ICON_PLACE =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 6a2.5 2.5 0 0 1 0 5.5z"/></svg>';

  /**
   * Layout rules:
   * - Date always on the left (when present).
   * - When both comment and place: comment in the middle, place on the right.
   * - When only one of comment/place: that one on the right; middle empty.
   * - Place is always dimmed (with pin icon); comment always full strength.
   * - Comment and place slots always include their SVG icon before the text.
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

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function iconHtml(kind) {
    var svg = kind === "place" ? ICON_PLACE : ICON_COMMENT;
    return '<span class="overlay-icon">' + svg + "</span>";
  }

  /** Render a middle/right slot including the required comment or place icon. */
  function slotHtml(slot) {
    if (!slot) return "";
    var cls = slot.kind === "place" ? "overlay-place" : "overlay-comment";
    return (
      '<span class="' +
      cls +
      '">' +
      iconHtml(slot.kind) +
      escapeHtml(slot.text) +
      "</span>"
    );
  }

  global.PS = global.PS || {};
  global.PS.overlayLabel = {
    build: buildOverlayLabel,
    slotHtml: slotHtml,
    iconHtml: iconHtml,
    ICON_COMMENT: ICON_COMMENT,
    ICON_PLACE: ICON_PLACE,
  };
})(typeof window !== "undefined" ? window : global);
