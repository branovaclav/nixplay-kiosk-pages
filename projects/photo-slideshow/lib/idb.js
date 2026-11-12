/* IndexedDB stores for photos / meta / posts / geo / state. ES5 + IDB. */
(function (global) {
  "use strict";

  var DB_NAME = "ps.v1";
  var DB_VER = 1;
  var dbPromise = null;

  function openDb() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise(function (resolve, reject) {
      var req = indexedDB.open(DB_NAME, DB_VER);
      req.onupgradeneeded = function (e) {
        var db = e.target.result;
        if (!db.objectStoreNames.contains("photos")) db.createObjectStore("photos");
        if (!db.objectStoreNames.contains("meta")) db.createObjectStore("meta", { keyPath: "id" });
        if (!db.objectStoreNames.contains("posts")) db.createObjectStore("posts", { keyPath: "postId" });
        if (!db.objectStoreNames.contains("geo")) db.createObjectStore("geo");
        if (!db.objectStoreNames.contains("state")) db.createObjectStore("state");
      };
      req.onsuccess = function () {
        resolve(req.result);
      };
      req.onerror = function () {
        reject(req.error);
      };
    });
    return dbPromise;
  }

  function txDone(tx) {
    return new Promise(function (resolve, reject) {
      tx.oncomplete = function () {
        resolve();
      };
      tx.onerror = function () {
        reject(tx.error);
      };
      tx.onabort = function () {
        reject(tx.error || new Error("aborted"));
      };
    });
  }

  function reqToPromise(req) {
    return new Promise(function (resolve, reject) {
      req.onsuccess = function () {
        resolve(req.result);
      };
      req.onerror = function () {
        reject(req.error);
      };
    });
  }

  function put(store, key, value) {
    return openDb().then(function (db) {
      var tx = db.transaction(store, "readwrite");
      var os = tx.objectStore(store);
      if (key == null) os.put(value);
      else os.put(value, key);
      return txDone(tx);
    });
  }

  function get(store, key) {
    return openDb().then(function (db) {
      var tx = db.transaction(store, "readonly");
      return reqToPromise(tx.objectStore(store).get(key));
    });
  }

  function getAll(store) {
    return openDb().then(function (db) {
      var tx = db.transaction(store, "readonly");
      var os = tx.objectStore(store);
      if (os.getAll) return reqToPromise(os.getAll());
      return new Promise(function (resolve, reject) {
        var out = [];
        var req = os.openCursor();
        req.onsuccess = function () {
          var cur = req.result;
          if (cur) {
            out.push(cur.value);
            cur.continue();
          } else resolve(out);
        };
        req.onerror = function () {
          reject(req.error);
        };
      });
    });
  }

  function del(store, key) {
    return openDb().then(function (db) {
      var tx = db.transaction(store, "readwrite");
      tx.objectStore(store).delete(key);
      return txDone(tx);
    });
  }

  function clearStore(store) {
    return openDb().then(function (db) {
      var tx = db.transaction(store, "readwrite");
      tx.objectStore(store).clear();
      return txDone(tx);
    });
  }

  function getKeys(store) {
    return openDb().then(function (db) {
      var tx = db.transaction(store, "readonly");
      var os = tx.objectStore(store);
      if (os.getAllKeys) return reqToPromise(os.getAllKeys());
      return new Promise(function (resolve, reject) {
        var out = [];
        var req = os.openCursor();
        req.onsuccess = function () {
          var cur = req.result;
          if (cur) {
            out.push(cur.key);
            cur.continue();
          } else resolve(out);
        };
        req.onerror = function () {
          reject(req.error);
        };
      });
    });
  }

  function tryPersist() {
    try {
      if (navigator.storage && navigator.storage.persist) {
        return navigator.storage.persist().catch(function () {
          return false;
        });
      }
    } catch (e) {}
    return Promise.resolve(false);
  }

  global.PS = global.PS || {};
  global.PS.idb = {
    open: openDb,
    put: put,
    get: get,
    getAll: getAll,
    getKeys: getKeys,
    del: del,
    clearStore: clearStore,
    tryPersist: tryPersist,
    putPhoto: function (id, blob) {
      return put("photos", id, blob);
    },
    getPhoto: function (id) {
      return get("photos", id);
    },
    putMeta: function (meta) {
      return put("meta", null, meta);
    },
    getMeta: function (id) {
      return get("meta", id);
    },
    allMeta: function () {
      return getAll("meta");
    },
    putPost: function (post) {
      return put("posts", null, post);
    },
    getPost: function (postId) {
      return get("posts", postId);
    },
    putGeo: function (cell, label) {
      return put("geo", cell, label);
    },
    getGeo: function (cell) {
      return get("geo", cell);
    },
    getState: function (key) {
      return get("state", key);
    },
    putState: function (key, value) {
      return put("state", key, value);
    },
  };
})(typeof window !== "undefined" ? window : global);
