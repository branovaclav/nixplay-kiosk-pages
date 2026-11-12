/* Anonymous CloudKit shared-album client. ES5 XHR, Content-Type: text/plain. */
(function (global) {
  "use strict";

  var BUILD = "2642Build18";
  var RESOLVE_URL =
    "https://ckdatabasews.icloud.com/database/1/com.apple.photos.cloud/production/public/records/resolve";

  function xhrJson(method, url, bodyObj) {
    return new Promise(function (resolve, reject) {
      var xhr = new XMLHttpRequest();
      xhr.open(method, url, true);
      xhr.setRequestHeader("Content-Type", "text/plain");
      xhr.onreadystatechange = function () {
        if (xhr.readyState !== 4) return;
        if (xhr.status < 200 || xhr.status >= 300) {
          reject(new Error("HTTP " + xhr.status));
          return;
        }
        try {
          resolve(JSON.parse(xhr.responseText || "{}"));
        } catch (e) {
          reject(e);
        }
      };
      xhr.onerror = function () {
        reject(new Error("network"));
      };
      xhr.send(bodyObj != null ? JSON.stringify(bodyObj) : null);
    });
  }

  function sleep(ms) {
    return new Promise(function (resolve) {
      setTimeout(resolve, ms);
    });
  }

  function uuid() {
    // Chromium 81–safe-ish random id
    var s = "";
    var i;
    for (i = 0; i < 32; i++) s += "0123456789abcdef".charAt((Math.random() * 16) | 0);
    return (
      s.slice(0, 8) +
      "-" +
      s.slice(8, 12) +
      "-" +
      s.slice(12, 16) +
      "-" +
      s.slice(16, 20) +
      "-" +
      s.slice(20)
    );
  }

  function qs(params) {
    var parts = [];
    var k;
    for (k in params) {
      if (params.hasOwnProperty(k) && params[k] != null) {
        parts.push(encodeURIComponent(k) + "=" + encodeURIComponent(params[k]));
      }
    }
    return parts.join("&");
  }

  /** Resolve short GUID with TRY_AGAIN_LATER retries (up to 6×, 1.5 s). */
  function resolveAlbum(key) {
    var url =
      RESOLVE_URL +
      "?" +
      qs({
        remapEnums: "true",
        getCurrentSyncToken: "true",
        clientBuildNumber: BUILD,
        clientMasteringNumber: BUILD,
        sharing_url_key: key,
      });
    var attempt = 0;

    function once() {
      attempt++;
      return xhrJson("POST", url, { shortGUIDs: [{ value: key }] }).then(function (data) {
        var err = data && data.serverErrorCode;
        if (err === "TRY_AGAIN_LATER") {
          if (attempt >= 6) throw new Error("TRY_AGAIN_LATER");
          return sleep(1500).then(once);
        }
        var r = data && data.results && data.results[0];
        if (!r) throw new Error("resolve empty");
        if (r.serverErrorCode === "TRY_AGAIN_LATER") {
          if (attempt >= 6) throw new Error("TRY_AGAIN_LATER");
          return sleep(1500).then(once);
        }
        return r;
      });
    }
    return once();
  }

  function sharedBase(resolved, key) {
    var part = resolved.anonymousPublicAccess.databasePartition.replace(/\/$/, "");
    var token = resolved.anonymousPublicAccess.token;
    var zoneID = resolved.zoneID;
    function endpoint(path) {
      return (
        part +
        "/database/1/com.apple.photos.cloud/production/shared/" +
        path +
        "?" +
        qs({
          remapEnums: "true",
          getCurrentSyncToken: "true",
          sharing_url_key: key,
          publicAccessAuthToken: token,
          clientBuildNumber: BUILD,
          clientMasteringNumber: BUILD,
          clientId: uuid(),
        })
      );
    }
    return { zoneID: zoneID, token: token, endpoint: endpoint, resolved: resolved };
  }

  function countAssets(ctx) {
    var body = {
      query: {
        recordType: "HyperionIndexCountLookup",
        filterBy: [
          {
            fieldName: "indexCountID",
            comparator: "IN",
            fieldValue: { value: ["CPLAssetByAddedDate"], type: "STRING_LIST" },
          },
        ],
      },
      zoneID: ctx.zoneID,
    };
    return xhrJson("POST", ctx.endpoint("records/query"), body).then(function (data) {
      var rec = data.records && data.records[0];
      var fields = rec && rec.fields;
      return (fields && fields.itemCount && fields.itemCount.value) || 0;
    });
  }

  function queryPage(ctx, recordType, startRank, limit) {
    var body = {
      query: {
        recordType: recordType,
        filterBy: [
          {
            fieldName: "direction",
            comparator: "EQUALS",
            fieldValue: { value: "ASCENDING", type: "STRING" },
          },
          {
            fieldName: "startRank",
            comparator: "EQUALS",
            fieldValue: { value: startRank, type: "INT64" },
          },
        ],
      },
      zoneID: ctx.zoneID,
      resultsLimit: limit,
    };
    return xhrJson("POST", ctx.endpoint("records/query"), body);
  }

  /**
   * Pair CPLAsset + CPLMaster records from one query page.
   * CloudKit returns all Masters for the page, then all Assets (not interleaved).
   * Match each asset to its master via fields.masterRef — never by arrival order.
   */
  function pairAssetAndMasterRecords(recs) {
    var mastersByName = {};
    var i;
    var rec;
    var pairs = [];
    for (i = 0; i < recs.length; i++) {
      rec = recs[i];
      if (rec && rec.recordType === "CPLMaster" && rec.recordName) {
        mastersByName[rec.recordName] = rec;
      }
    }
    for (i = 0; i < recs.length; i++) {
      rec = recs[i];
      if (!rec || rec.recordType !== "CPLAsset") continue;
      var ref =
        rec.fields &&
        rec.fields.masterRef &&
        rec.fields.masterRef.value &&
        rec.fields.masterRef.value.recordName;
      var master = ref ? mastersByName[ref] : null;
      if (master) pairs.push({ asset: rec, master: master });
    }
    return pairs;
  }

  /** List all CPLAsset + CPLMaster pairs via startRank paging. */
  function listAssets(ctx) {
    var out = [];
    var rank = 0;
    var pageSize = 50; // records; ~25 photos

    function next() {
      return queryPage(ctx, "CPLAssetAndMasterByAddedDate", rank, pageSize).then(function (data) {
        var recs = data.records || [];
        if (!recs.length) return out;
        var pagePairs = pairAssetAndMasterRecords(recs);
        var i;
        for (i = 0; i < pagePairs.length; i++) out.push(pagePairs[i]);
        // Each photo ≈ 2 records; advance by photo count
        var photos = 0;
        for (i = 0; i < recs.length; i++) if (recs[i].recordType === "CPLAsset") photos++;
        if (photos === 0) return out;
        rank += photos;
        if (recs.length < pageSize) return out;
        return next();
      });
    }
    return next();
  }

  function listPosts(ctx) {
    var out = [];
    var rank = 0;
    var pageSize = 50;

    function next() {
      var body = {
        query: {
          recordType: "CPLPostByPostTimestamp",
          filterBy: [
            {
              fieldName: "direction",
              comparator: "EQUALS",
              fieldValue: { value: "DESCENDING", type: "STRING" },
            },
            {
              fieldName: "startRank",
              comparator: "EQUALS",
              fieldValue: { value: rank, type: "INT64" },
            },
          ],
        },
        zoneID: ctx.zoneID,
        resultsLimit: pageSize,
      };
      return xhrJson("POST", ctx.endpoint("records/query"), body).then(function (data) {
        var recs = data.records || [];
        var i;
        for (i = 0; i < recs.length; i++) {
          if (recs[i].recordType === "CPLPost") out.push(recs[i]);
        }
        if (!recs.length || recs.length < pageSize) return out;
        rank += recs.length;
        return next();
      });
    }
    return next();
  }

  /**
   * CloudKit shared posts: asset.assetBatchId === post.recordName for members.
   * CPLAssetAndMasterInPost requires BOTH postID and assetBatchId filters
   * (without assetBatchId → HTTP 400 "Expected a parameter with name: assetBatchId").
   * Posts themselves often have no assetBatchId field.
   */
  function postBatchId(post) {
    var fromField =
      post &&
      post.fields &&
      post.fields.assetBatchId &&
      post.fields.assetBatchId.value;
    return fromField || (post && post.recordName) || null;
  }

  /** Map assets → post via assetBatchId === post batch id (pure; synthetic-testable). */
  function assetIdsForPost(post, pairs) {
    var batch = postBatchId(post);
    var ids = [];
    var i;
    if (!batch || !pairs) return ids;
    for (i = 0; i < pairs.length; i++) {
      var asset = pairs[i] && pairs[i].asset;
      var b = fieldVal(asset, "assetBatchId");
      if (b === batch) ids.push(asset.recordName);
    }
    return ids;
  }

  /** Map post → asset ids via CPLAssetAndMasterInPost (+ required assetBatchId). */
  function listPostAssets(ctx, post) {
    var batch = postBatchId(post);
    if (!batch) return Promise.resolve([]);
    var body = {
      query: {
        recordType: "CPLAssetAndMasterInPost",
        filterBy: [
          {
            fieldName: "postID",
            comparator: "EQUALS",
            fieldValue: {
              value: { recordName: post.recordName, action: "NONE", zoneID: ctx.zoneID },
              type: "REFERENCE",
            },
          },
          {
            fieldName: "assetBatchId",
            comparator: "EQUALS",
            fieldValue: { value: batch, type: "STRING" },
          },
        ],
      },
      zoneID: ctx.zoneID,
      resultsLimit: 200,
    };
    return xhrJson("POST", ctx.endpoint("records/query"), body)
      .then(function (data) {
        var ids = [];
        var recs = data.records || [];
        var i;
        for (i = 0; i < recs.length; i++) {
          if (recs[i].recordType === "CPLAsset") ids.push(recs[i].recordName);
        }
        // Always expose batch so callers can fall back to local pair scan.
        return { _batch: batch, ids: ids };
      })
      .catch(function () {
        return { _batch: batch, ids: [] };
      });
  }

  function fieldVal(rec, name) {
    return rec && rec.fields && rec.fields[name] && rec.fields[name].value;
  }

  function pickJpegMedUrl(asset, master) {
    // Prefer asset (edited) derivative
    var sources = [asset, master];
    var s, i;
    for (i = 0; i < sources.length; i++) {
      s = sources[i];
      var res = fieldVal(s, "resJPEGMedRes");
      if (res && res.downloadURL) return res.downloadURL;
    }
    return null;
  }

  function isVideo(master) {
    var t = fieldVal(master, "itemType") || "";
    var dur = fieldVal(master, "duration");
    if (String(t).indexOf("quicktime") >= 0 || String(t).indexOf("mpeg") >= 0) return true;
    if (typeof dur === "number" && dur > 0 && String(t).indexOf("image") < 0) {
      // Live Photo masters still have images; skip only true movies
      if (String(t).indexOf("public.movie") >= 0 || String(t).indexOf("public.video") >= 0)
        return true;
    }
    return String(t) === "com.apple.quicktime-movie";
  }

  function downloadBlob(url) {
    return new Promise(function (resolve, reject) {
      var xhr = new XMLHttpRequest();
      xhr.open("GET", url, true);
      xhr.responseType = "blob";
      xhr.onreadystatechange = function () {
        if (xhr.readyState !== 4) return;
        if (xhr.status < 200 || xhr.status >= 300) {
          reject(new Error("HTTP " + xhr.status));
          return;
        }
        resolve(xhr.response);
      };
      xhr.onerror = function () {
        reject(new Error("network"));
      };
      xhr.send();
    });
  }

  function changesZone(ctx, syncToken) {
    var body = { zones: [{ syncToken: syncToken, zoneID: ctx.zoneID }] };
    return xhrJson("POST", ctx.endpoint("changes/zone"), body);
  }

  global.PS = global.PS || {};
  global.PS.cloudkit = {
    BUILD: BUILD,
    resolveAlbum: resolveAlbum,
    sharedBase: sharedBase,
    countAssets: countAssets,
    pairAssetAndMasterRecords: pairAssetAndMasterRecords,
    listAssets: listAssets,
    listPosts: listPosts,
    postBatchId: postBatchId,
    assetIdsForPost: assetIdsForPost,
    listPostAssets: listPostAssets,
    pickJpegMedUrl: pickJpegMedUrl,
    isVideo: isVideo,
    fieldVal: fieldVal,
    downloadBlob: downloadBlob,
    changesZone: changesZone,
    xhrJson: xhrJson,
  };
})(typeof window !== "undefined" ? window : global);
