/* Photo slideshow boot + playback. Chromium 81 / ES5. */
(function () {
  "use strict";

  var cfg = null;
  var demoMode = PS.demo.isDemo();
  var metasById = {};
  var idOrder = []; // sequential: album order then date
  var shuffleBag = null;
  var modeShuffle = true;
  var overlayOn = true;
  var paused = false;
  var pageHidden = false;
  var allowBackgroundWork = true;
  var timer = null;
  var fadeMs = 600;
  var intervalMs = 5000;
  var history = [];
  var historyPos = -1;
  var currentId = null;
  var nextPrepared = null; // { id, url, img }
  var layerA;
  var layerB;
  var frontIsA = true;
  var statusEl;
  var overlayEl;
  var overlayDateEl;
  var overlayMiddleEl;
  var overlayRightEl;
  var clockEl;
  var clockTimeEl;
  var clockDateEl;
  var osmCreditEl;
  var toastEl;
  var syncDot;
  var lastKeyAt = 0;
  var objectUrls = {};
  var clockTimer = null;
  var clockAlignTimer = null;
  var syncInterval = null;
  var hideReleaseTimer = null;
  var syncGeneration = 0;

  var ICON_COMMENT =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h16a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H9l-5 4v-4H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"/></svg>';
  var ICON_PLACE =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 6a2.5 2.5 0 0 1 0 5.5z"/></svg>';

  function $(sel) {
    return document.querySelector(sel);
  }

  function showStatus(msg) {
    statusEl.textContent = msg || "";
    statusEl.className = msg ? "status" : "status is-hidden";
  }

  function setChromeVisible(on) {
    overlayEl.className = on ? "overlay is-on" : "overlay";
    clockEl.className = on ? "clock is-on" : "clock";
  }

  function tickClock() {
    var now = new Date();
    clockTimeEl.textContent = PS.datefmt.formatClockTime(now);
    clockDateEl.textContent = PS.datefmt.formatClockDate(now);
  }

  function stopClock() {
    if (clockTimer) {
      clearInterval(clockTimer);
      clockTimer = null;
    }
    if (clockAlignTimer) {
      clearTimeout(clockAlignTimer);
      clockAlignTimer = null;
    }
  }

  function armClock() {
    stopClock();
    if (pageHidden) return;
    tickClock();
    clockTimer = setInterval(tickClock, 30000);
    // Align to next minute boundary
    var ms = (60 - new Date().getSeconds()) * 1000 - new Date().getMilliseconds();
    clockAlignTimer = setTimeout(function () {
      clockAlignTimer = null;
      if (pageHidden) return;
      tickClock();
      clearInterval(clockTimer);
      clockTimer = setInterval(tickClock, 60000);
    }, Math.max(0, ms));
  }

  function revokeAllUrls() {
    var ids = [];
    var id;
    for (id in objectUrls) {
      if (objectUrls.hasOwnProperty(id)) ids.push(id);
    }
    for (var i = 0; i < ids.length; i++) revokeUrl(ids[i]);
  }

  /** Drop decoded images / object URLs so a hidden tab frees RAM. */
  function freeDisplayMemory() {
    nextPrepared = null;
    revokeAllUrls();
    if (layerA) {
      layerA.removeAttribute("src");
      layerA.src = "";
      layerA.className = "layer";
      layerA.style.transition = "none";
    }
    if (layerB) {
      layerB.removeAttribute("src");
      layerB.src = "";
      layerB.className = "layer";
      layerB.style.transition = "none";
    }
  }

  function restoreDisplay() {
    if (!currentId) {
      return refreshFromCache(true);
    }
    return prepareId(currentId).then(function (prep) {
      if (!prep) return refreshFromCache(true);
      var front = frontLayer();
      var back = backLayer();
      if (back) {
        back.src = "";
        back.className = "layer";
      }
      front.style.transition = "none";
      front.src = prep.url;
      front.className = "layer is-visible";
      void front.offsetWidth;
      front.style.transition = "opacity " + fadeMs + "ms linear";
      if (back) back.style.transition = "opacity " + fadeMs + "ms linear";
      return renderOverlay(currentId).then(function () {
        if (pageHidden) return null;
        return prepareId(pickNextId()).then(function (p) {
          if (!pageHidden) nextPrepared = p;
        });
      });
    });
  }

  function showOsmCreditSplash() {
    return new Promise(function (resolve) {
      osmCreditEl.className = "osm-credit is-on";
      setTimeout(function () {
        osmCreditEl.className = "osm-credit";
        resolve();
      }, 3000);
    });
  }

  function setSyncWarn(on) {
    syncDot.className = on ? "sync-dot is-on" : "sync-dot";
  }

  function revokeUrl(id) {
    if (objectUrls[id]) {
      try {
        URL.revokeObjectURL(objectUrls[id]);
      } catch (e) {}
      delete objectUrls[id];
    }
  }

  function urlForId(id, blob) {
    revokeUrl(id);
    var u = URL.createObjectURL(blob);
    objectUrls[id] = u;
    return u;
  }

  function frontLayer() {
    return frontIsA ? layerA : layerB;
  }

  function backLayer() {
    return frontIsA ? layerB : layerA;
  }

  function persistUiState() {
    return PS.idb.putState("ui", {
      modeShuffle: modeShuffle,
      overlayOn: overlayOn,
      currentId: currentId,
      shuffle: shuffleBag ? shuffleBag.toState() : null,
      history: history.slice(-40),
      historyPos: historyPos,
    });
  }

  function loadUiState() {
    return PS.idb.getState("ui").then(function (s) {
      if (!s) return;
      if (typeof s.modeShuffle === "boolean") modeShuffle = s.modeShuffle;
      if (typeof s.overlayOn === "boolean") overlayOn = s.overlayOn;
      if (s.shuffle) shuffleBag = PS.ShuffleBag.fromState(s.shuffle);
      if (s.history) history = s.history.slice();
      if (typeof s.historyPos === "number") historyPos = s.historyPos;
      if (s.currentId) currentId = s.currentId;
    });
  }

  function rebuildOrder(metas) {
    metasById = {};
    var byAlbum = {};
    var albums = demoMode ? ["demo"] : cfg.albums.slice();
    var i;
    for (i = 0; i < metas.length; i++) {
      metasById[metas[i].id] = metas[i];
      var a = metas[i].album || "";
      if (!byAlbum[a]) byAlbum[a] = [];
      byAlbum[a].push(metas[i]);
    }
    idOrder = [];
    for (i = 0; i < albums.length; i++) {
      var list = byAlbum[albums[i]] || [];
      list.sort(function (x, y) {
        return (x.takenUtc || 0) - (y.takenUtc || 0);
      });
      var j;
      for (j = 0; j < list.length; j++) idOrder.push(list[j].id);
    }
    // orphans
    for (i = 0; i < metas.length; i++) {
      if (idOrder.indexOf(metas[i].id) < 0) idOrder.push(metas[i].id);
    }
    if (!shuffleBag) shuffleBag = new PS.ShuffleBag(idOrder);
    else shuffleBag.setIds(idOrder);
  }

  function renderOverlay(id) {
    var meta = metasById[id] || {};
    var dateStr = PS.datefmt.formatCaptureDate(meta.takenUtc, meta.tzOffset);
    var commentP = meta.postId
      ? PS.idb.getPost(meta.postId).then(function (p) {
          return (p && p.comment) || "";
        })
      : Promise.resolve("");
    var placeP = Promise.resolve(meta.place || null);
    if (!meta.place && meta.geoCell) {
      placeP = PS.idb.getGeo(meta.geoCell);
    } else if (!meta.place && meta.lat != null && meta.lon != null && cfg) {
      placeP = PS.geo.lookup(
        meta.lat,
        meta.lon,
        cfg,
        function (cell) {
          return PS.idb.getGeo(cell);
        },
        function (cell, label) {
          return PS.idb.putGeo(cell, label);
        }
      );
    }

    return Promise.all([commentP, placeP]).then(function (pair) {
      var label = PS.overlayLabel.build(dateStr, pair[0], pair[1]);
      overlayDateEl.textContent = label.date || "";
      overlayMiddleEl.innerHTML = slotHtml(label.middle);
      overlayRightEl.innerHTML = slotHtml(label.right);
      setChromeVisible(overlayOn);
    });
  }

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

  function iconHtml(kind) {
    var svg = kind === "place" ? ICON_PLACE : ICON_COMMENT;
    return '<span class="overlay-icon">' + svg + '</span>';
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function prepareId(id) {
    if (!id) return Promise.resolve(null);
    return PS.idb.getPhoto(id).then(function (blob) {
      if (!blob) return null;
      var url = urlForId(id, blob);
      return new Promise(function (resolve) {
        var img = new Image();
        img.onload = function () {
          var done = function () {
            resolve({ id: id, url: url, img: img });
          };
          if (img.decode) {
            img.decode().then(done).catch(done);
          } else done();
        };
        img.onerror = function () {
          resolve(null);
        };
        img.src = url;
      });
    });
  }

  function pickNextId() {
    if (modeShuffle) return shuffleBag.next();
    if (!idOrder.length) return null;
    if (!currentId) return idOrder[0];
    var i = idOrder.indexOf(currentId);
    if (i < 0 || i >= idOrder.length - 1) return idOrder[0];
    return idOrder[i + 1];
  }

  function showPrepared(prep, addHistory) {
    if (!prep) return Promise.resolve();
    var back = backLayer();
    var front = frontLayer();
    back.src = prep.url;
    back.className = "layer";
    // force reflow
    void back.offsetWidth;
    back.style.transition = "opacity " + fadeMs + "ms linear";
    front.style.transition = "opacity " + fadeMs + "ms linear";
    back.className = "layer is-visible";
    front.className = "layer";
    frontIsA = !frontIsA;
    currentId = prep.id;
    if (addHistory !== false) {
      if (historyPos < history.length - 1) history = history.slice(0, historyPos + 1);
      history.push(currentId);
      if (history.length > 80) history.shift();
      historyPos = history.length - 1;
    }
    showStatus("");
    return renderOverlay(currentId).then(function () {
      return persistUiState();
    });
  }

  function armTimer() {
    clearTimeout(timer);
    if (paused || !currentId) return;
    timer = setTimeout(function () {
      advance();
    }, intervalMs);
  }

  function advance() {
    var id = nextPrepared && nextPrepared.id ? nextPrepared.id : pickNextId();
    var prepP = nextPrepared && nextPrepared.id === id ? Promise.resolve(nextPrepared) : prepareId(id);
    nextPrepared = null;
    prepP.then(function (prep) {
      if (!prep) {
        armTimer();
        return;
      }
      showPrepared(prep, true).then(function () {
        var n = pickNextId();
        prepareId(n).then(function (p) {
          nextPrepared = p;
        });
        armTimer();
      });
    });
  }

  function goPrevious() {
    if (historyPos <= 0) {
      overlayOn = true;
      if (currentId) renderOverlay(currentId);
      persistUiState();
      return;
    }
    historyPos--;
    var id = history[historyPos];
    prepareId(id).then(function (prep) {
      overlayOn = true;
      showPrepared(prep, false).then(function () {
        armTimer();
      });
    });
  }

  function showToast(text) {
    toastEl.textContent = text;
    toastEl.className = "shuffle-toast is-on";
    clearTimeout(showToast._t);
    showToast._t = setTimeout(function () {
      toastEl.className = "shuffle-toast";
    }, 1500);
  }

  function onKey(e) {
    if (e.repeat) return;
    var now = Date.now();
    if (now - lastKeyAt < 400) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    var key = e.key || "";
    var code = e.keyCode || e.which;
    var isTab = key === "Tab" || code === 9;
    var isEnter = key === "Enter" || code === 13;
    if (!isTab && !isEnter) return;
    e.preventDefault();
    e.stopPropagation();
    lastKeyAt = now;
    if (isEnter) {
      overlayOn = !overlayOn;
      setChromeVisible(overlayOn);
      persistUiState();
      return;
    }
    if (isTab && e.shiftKey) {
      goPrevious();
      return;
    }
    if (isTab) {
      modeShuffle = !modeShuffle;
      showToast(modeShuffle ? "Náhodne" : "Postupne");
      persistUiState();
    }
  }

  function setPausedAttr(on) {
    try {
      document.documentElement.setAttribute("data-paused", on ? "1" : "0");
    } catch (e) {}
  }

  function onVisibility() {
    if (document.hidden) {
      pageHidden = true;
      paused = true;
      allowBackgroundWork = false;
      setPausedAttr(true);
      clearTimeout(timer);
      timer = null;
      stopClock();
      if (PS.geo && PS.geo.setPaused) PS.geo.setPaused(true);
      // Finish the in-flight sync/download item, then free decoded images.
      if (hideReleaseTimer) clearTimeout(hideReleaseTimer);
      hideReleaseTimer = setTimeout(function () {
        hideReleaseTimer = null;
        if (!pageHidden) return;
        freeDisplayMemory();
      }, 800);
    } else {
      pageHidden = false;
      paused = false;
      allowBackgroundWork = true;
      setPausedAttr(false);
      if (hideReleaseTimer) {
        clearTimeout(hideReleaseTimer);
        hideReleaseTimer = null;
      }
      if (PS.geo && PS.geo.setPaused) PS.geo.setPaused(false);
      tickClock();
      armClock();
      restoreDisplay().then(function () {
        if (pageHidden) return;
        armTimer();
        // Catch up album sync only while visible (new photos download on-screen).
        backgroundSync();
      });
    }
  }

  /* ---------- sync (real albums) ---------- */

  function fingerprintOf(asset, master) {
    var ck = PS.cloudkit;
    var mod = asset.modified && asset.modified.timestamp;
    var fp =
      ck.fieldVal(asset, "resJPEGMedRes") &&
      ck.fieldVal(asset, "resJPEGMedRes").fileChecksum;
    if (!fp && ck.fieldVal(master, "resJPEGMedRes")) {
      fp = ck.fieldVal(master, "resJPEGMedRes").fileChecksum;
    }
    return String(mod || "") + "|" + String(fp || "");
  }

  function syncAlbum(key) {
    return PS.cloudkit.resolveAlbum(key).then(function (resolved) {
      var ctx = PS.cloudkit.sharedBase(resolved, key);
      return PS.cloudkit.listAssets(ctx).then(function (pairs) {
        return PS.cloudkit.listPosts(ctx).then(function (posts) {
          var postByAsset = {};
          var chain = Promise.resolve();
          var pi;
          for (pi = 0; pi < posts.length; pi++) {
            (function (post) {
              var caption =
                PS.cloudkit.fieldVal(post, "caption") ||
                PS.cloudkit.fieldVal(post, "Caption") ||
                "";
              chain = chain
                .then(function () {
                  return PS.cloudkit.listPostAssets(ctx, post);
                })
                .then(function (idsOr) {
                  var ids = idsOr;
                  if (ids && ids._batch) {
                    // Match assets by assetBatchId
                    var batch = ids._batch;
                    ids = [];
                    var j;
                    for (j = 0; j < pairs.length; j++) {
                      var b = PS.cloudkit.fieldVal(pairs[j].asset, "assetBatchId");
                      if (b === batch) ids.push(pairs[j].asset.recordName);
                    }
                  }
                  if (caption) {
                    return PS.idb.putPost({ postId: post.recordName, comment: String(caption) }).then(
                      function () {
                        var k;
                        for (k = 0; k < ids.length; k++) postByAsset[ids[k]] = post.recordName;
                      }
                    );
                  }
                  return null;
                });
            })(posts[pi]);
          }
          return chain.then(function () {
            var i;
            var work = Promise.resolve();
            var keep = {};
            for (i = 0; i < pairs.length; i++) {
              (function (pair) {
                var asset = pair.asset;
                var master = pair.master;
                if (PS.cloudkit.isVideo(master)) return;
                var id = asset.recordName;
                keep[id] = true;
                var fp = fingerprintOf(asset, master);
                work = work.then(function () {
                  // Stop starting new downloads while hidden; finish the current item only.
                  if (!allowBackgroundWork) return null;
                  return PS.idb.getMeta(id).then(function (old) {
                    if (!allowBackgroundWork) return null;
                    if (old && old.fingerprint === fp) return null;
                    var url = PS.cloudkit.pickJpegMedUrl(asset, master);
                    if (!url) return null;
                    // Once download starts, finish resize+store even if we go hidden.
                    return PS.cloudkit
                      .downloadBlob(url)
                      .then(function (blob) {
                        return PS.image.processForFrame(blob, cfg.sharpen);
                      })
                      .then(function (proc) {
                        if (!proc) return null;
                        var loc = PS.bplist.parseLocationEnc(
                          PS.cloudkit.fieldVal(asset, "locationEnc")
                        );
                        var taken = PS.cloudkit.fieldVal(asset, "assetDate");
                        var tz = PS.cloudkit.fieldVal(asset, "timeZoneOffset");
                        var meta = {
                          id: id,
                          album: key,
                          takenUtc: typeof taken === "number" ? taken : null,
                          tzOffset: typeof tz === "number" ? tz : null,
                          lat: loc ? loc.lat : null,
                          lon: loc ? loc.lon : null,
                          w: proc.w,
                          h: proc.h,
                          postId: postByAsset[id] || null,
                          geoCell:
                            loc != null ? PS.geo.cellKey(loc.lat, loc.lon) : null,
                          fingerprint: fp,
                          place: null,
                        };
                        return PS.idb.putPhoto(id, proc.blob).then(function () {
                          return PS.idb.putMeta(meta);
                        });
                      })
                      .catch(function () {
                        setSyncWarn(true);
                        return null;
                      });
                  });
                });
              })(pairs[i]);
            }
            return work.then(function () {
              // Delete ids from this album that vanished
              return PS.idb.allMeta().then(function (all) {
                var d = Promise.resolve();
                var j;
                for (j = 0; j < all.length; j++) {
                  if (all[j].album === key && !keep[all[j].id]) {
                    (function (mid) {
                      d = d.then(function () {
                        return PS.idb.del("photos", mid).then(function () {
                          return PS.idb.del("meta", mid);
                        });
                      });
                    })(all[j].id);
                  }
                }
                return d;
              });
            });
          });
        });
      });
    });
  }

  function backgroundSync() {
    if (demoMode || !cfg || !cfg.albums.length) return Promise.resolve();
    if (!allowBackgroundWork || pageHidden) return Promise.resolve();
    var gen = ++syncGeneration;
    var chain = Promise.resolve();
    var i;
    for (i = 0; i < cfg.albums.length; i++) {
      (function (key) {
        chain = chain.then(function () {
          if (!allowBackgroundWork || pageHidden || gen !== syncGeneration) {
            return null;
          }
          return syncAlbum(key).catch(function () {
            setSyncWarn(true);
          });
        });
      })(cfg.albums[i]);
    }
    return chain.then(function () {
      if (!allowBackgroundWork || pageHidden || gen !== syncGeneration) {
        return null;
      }
      return refreshFromCache(false);
    });
  }

  function refreshFromCache(startPlayback) {
    return PS.idb.allMeta().then(function (metas) {
      rebuildOrder(metas);
      if (!idOrder.length) {
        if (startPlayback) showStatus("Načítavam fotky…");
        return null;
      }
      if (!startPlayback && currentId) return null;
      var startId = currentId && metasById[currentId] ? currentId : pickNextId();
      return prepareId(startId).then(function (prep) {
        if (!prep) {
          showStatus("Načítavam fotky…");
          return null;
        }
        return showPrepared(prep, true).then(function () {
          prepareId(pickNextId()).then(function (p) {
            nextPrepared = p;
          });
          armTimer();
        });
      });
    });
  }

  function boot() {
    layerA = $("#layerA");
    layerB = $("#layerB");
    statusEl = $("#status");
    overlayEl = $("#overlay");
    overlayDateEl = $("#overlayDate");
    overlayMiddleEl = $("#overlayMiddle");
    overlayRightEl = $("#overlayRight");
    clockEl = $("#clock");
    clockTimeEl = $("#clockTime");
    clockDateEl = $("#clockDate");
    osmCreditEl = $("#osmCredit");
    toastEl = $("#shuffleToast");
    syncDot = $("#syncDot");

    layerA.style.transition = "opacity " + fadeMs + "ms linear";
    layerB.style.transition = "opacity " + fadeMs + "ms linear";

    document.addEventListener("keydown", onKey, true);
    document.addEventListener("visibilitychange", onVisibility, false);

    // Boot may happen while already hidden (frame opens all projects then hides).
    pageHidden = !!document.hidden;
    paused = pageHidden;
    allowBackgroundWork = !pageHidden;
    setPausedAttr(pageHidden);
    if (PS.geo && PS.geo.setPaused) PS.geo.setPaused(pageHidden);

    PS.idb.tryPersist();
    if (!pageHidden) armClock();
    else tickClock();
    setChromeVisible(overlayOn);

    var ready;
    if (demoMode) {
      cfg = PS.config.merge({ albums: ["demo"] });
      intervalMs = (cfg.interval || 5) * 1000;
      fadeMs = (cfg.fade || 0.6) * 1000;
      showStatus("Načítavam fotky…");
      ready = Promise.all([
        showOsmCreditSplash(),
        PS.demo.seed(PS.idb, PS.image).then(function () {
          return loadUiState();
        }),
      ]);
    } else {
      cfg = PS.config.load();
      if (!cfg || !cfg.albums.length) {
        showStatus("Prezentácia nie je nastavená");
        return;
      }
      intervalMs = (cfg.interval || 5) * 1000;
      fadeMs = (cfg.fade || 0.6) * 1000;
      showStatus("Načítavam fotky…");
      ready = Promise.all([showOsmCreditSplash(), loadUiState()]);
    }

    ready
      .then(function () {
        setChromeVisible(overlayOn);
        return refreshFromCache(true);
      })
      .then(function () {
        if (pageHidden) {
          // Stay paused; free decoded buffers until first visible.
          clearTimeout(timer);
          timer = null;
          freeDisplayMemory();
        }
        if (demoMode) {
          // Preview helper: ?demo=1&slide=demo-1 (also window.__psShow)
          window.__psShow = function (id) {
            paused = true;
            clearTimeout(timer);
            overlayOn = true;
            return prepareId(id).then(function (prep) {
              if (!prep) return null;
              return showPrepared(prep, true);
            });
          };
          var sm = /[?&]slide=([A-Za-z0-9_-]+)/.exec(
            location.search || ""
          );
          if (sm && sm[1] && !pageHidden) return window.__psShow(sm[1]);
          return null;
        }
        if (!pageHidden) backgroundSync();
        if (syncInterval) clearInterval(syncInterval);
        syncInterval = setInterval(function () {
          if (pageHidden || !allowBackgroundWork) return;
          backgroundSync();
        }, 6 * 60 * 60 * 1000);
        return null;
      })
      .catch(function () {
        setSyncWarn(true);
        showStatus("Načítavam fotky…");
      });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
