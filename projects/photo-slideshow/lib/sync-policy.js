/* Pure sync / cache policy helpers (testable, no I/O). ES5. */
(function (global) {
  "use strict";

  /** Default: skip a fresh full sync on visible if one finished within this window. */
  var VISIBLE_SYNC_MIN_INTERVAL_MS = 3 * 60 * 60 * 1000; // 3 hours
  var PERIODIC_SYNC_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours (timer)

  function albumSet(albums) {
    var set = {};
    var i;
    if (!albums) return set;
    for (i = 0; i < albums.length; i++) {
      if (albums[i]) set[String(albums[i])] = true;
    }
    return set;
  }

  /**
   * Keep only metas whose album is in the configured list.
   * Demo mode passes albums = ["demo"]. Never plays foreign / leftover cache.
   */
  function filterMetasForAlbums(metas, albums) {
    var set = albumSet(albums);
    var out = [];
    var i;
    if (!metas) return out;
    for (i = 0; i < metas.length; i++) {
      if (metas[i] && set[metas[i].album]) out.push(metas[i]);
    }
    return out;
  }

  /** Ids (and albums) that must be deleted from cache given the configured albums. */
  function foreignMetaIds(metas, albums) {
    var set = albumSet(albums);
    var out = [];
    var i;
    if (!metas) return out;
    for (i = 0; i < metas.length; i++) {
      if (metas[i] && metas[i].id && !set[metas[i].album]) out.push(metas[i].id);
    }
    return out;
  }

  /**
   * Whether to start a full album sync when the page becomes visible.
   * Always true if a previous sync was interrupted by hide; otherwise only if
   * the last completed sync is older than minIntervalMs (default 3 h).
   * Boot and the 6 h timer call sync directly and do not use this gate.
   */
  function shouldSyncOnVisible(lastCompletedAt, interrupted, nowMs, minIntervalMs) {
    if (interrupted) return true;
    var min =
      typeof minIntervalMs === "number" && isFinite(minIntervalMs)
        ? minIntervalMs
        : VISIBLE_SYNC_MIN_INTERVAL_MS;
    var now = typeof nowMs === "number" ? nowMs : Date.now();
    if (lastCompletedAt == null || !isFinite(lastCompletedAt)) return true;
    return now - lastCompletedAt >= min;
  }

  global.PS = global.PS || {};
  global.PS.syncPolicy = {
    VISIBLE_SYNC_MIN_INTERVAL_MS: VISIBLE_SYNC_MIN_INTERVAL_MS,
    PERIODIC_SYNC_INTERVAL_MS: PERIODIC_SYNC_INTERVAL_MS,
    albumSet: albumSet,
    filterMetasForAlbums: filterMetasForAlbums,
    foreignMetaIds: foreignMetaIds,
    shouldSyncOnVisible: shouldSyncOnVisible,
  };
})(typeof window !== "undefined" ? window : global);
