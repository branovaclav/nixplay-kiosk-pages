/* Reverse geocode with 0.01° cells, Nominatim → Photon. ES5 XHR. */
(function (global) {
  "use strict";

  var lastReqAt = 0;
  var MIN_GAP_MS = 15000;

  function cellKey(lat, lon) {
    return (Math.round(lat * 100) / 100).toFixed(2) + "," + (Math.round(lon * 100) / 100).toFixed(2);
  }

  function rounded(lat, lon) {
    return {
      lat: Math.round(lat * 100) / 100,
      lon: Math.round(lon * 100) / 100,
    };
  }

  function xhrGetJson(url) {
    return new Promise(function (resolve, reject) {
      var xhr = new XMLHttpRequest();
      xhr.open("GET", url, true);
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
      xhr.send();
    });
  }

  function waitGap() {
    var now = Date.now();
    var wait = MIN_GAP_MS - (now - lastReqAt);
    if (wait <= 0) {
      lastReqAt = now;
      return Promise.resolve();
    }
    return new Promise(function (resolve) {
      setTimeout(function () {
        lastReqAt = Date.now();
        resolve();
      }, wait);
    });
  }

  function pickLocality(addr) {
    if (!addr) return null;
    var loc =
      addr.city ||
      addr.town ||
      addr.village ||
      addr.municipality ||
      addr.county ||
      addr.state ||
      null;
    var country = addr.country || null;
    if (loc && country) return loc + ", " + country;
    if (loc) return loc;
    if (country) return country;
    return null;
  }

  function fromNominatim(data) {
    return pickLocality(data && data.address);
  }

  function fromPhoton(data) {
    var props = data && data.features && data.features[0] && data.features[0].properties;
    if (!props) return null;
    var loc = props.city || props.town || props.village || props.county || props.state || null;
    var country = props.country || null;
    if (loc && country) return loc + ", " + country;
    if (loc) return loc;
    if (country) return country;
    return null;
  }

  /**
   * @param {number} lat
   * @param {number} lon
   * @param {{nominatimUrl:string, photonUrl:string}} cfg
   * @param {function(string): Promise<string|null>} getCached  cell → label
   * @param {function(string,string): Promise} setCached
   */
  function lookup(lat, lon, cfg, getCached, setCached) {
    var r = rounded(lat, lon);
    var cell = cellKey(r.lat, r.lon);
    return getCached(cell).then(function (hit) {
      if (hit != null && hit !== "") return hit;
      if (hit === "") return null;
      return waitGap()
        .then(function () {
          var url =
            cfg.nominatimUrl +
            "?format=jsonv2&zoom=10&accept-language=sk&lat=" +
            encodeURIComponent(r.lat) +
            "&lon=" +
            encodeURIComponent(r.lon);
          return xhrGetJson(url).then(fromNominatim);
        })
        .catch(function () {
          return null;
        })
        .then(function (label) {
          if (label) return label;
          return waitGap().then(function () {
            var url =
              cfg.photonUrl +
              "?lat=" +
              encodeURIComponent(r.lat) +
              "&lon=" +
              encodeURIComponent(r.lon) +
              "&lang=sk";
            return xhrGetJson(url).then(fromPhoton).catch(function () {
              return null;
            });
          });
        })
        .then(function (label) {
          return setCached(cell, label || "").then(function () {
            return label || null;
          });
        });
    });
  }

  global.PS = global.PS || {};
  global.PS.geo = {
    cellKey: cellKey,
    rounded: rounded,
    lookup: lookup,
    pickLocality: pickLocality,
  };
})(typeof window !== "undefined" ? window : global);
