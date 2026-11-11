/* Demo mode (?demo=1): synthetic photos + fake metadata. No real album data. ES5. */
(function (global) {
  "use strict";

  var DEMO_ITEMS = [
    {
      id: "demo-1",
      album: "demo",
      takenUtc: Date.UTC(2025, 5, 14, 10, 0, 0),
      tzOffset: 7200,
      lat: 48.86,
      lon: 2.35,
      comment: "Dovolenka v Paríži",
      place: "Paríž, Francúzsko",
      bg: "#3a5f8a",
      label: "1 · landscape",
      w: 1024,
      h: 768,
    },
    {
      id: "demo-2",
      album: "demo",
      takenUtc: Date.UTC(2024, 11, 24, 16, 30, 0),
      tzOffset: 3600,
      lat: null,
      lon: null,
      comment: "Vianoce u babičky",
      place: null,
      bg: "#6b3a4a",
      label: "2 · comment only",
      w: 1024,
      h: 768,
    },
    {
      id: "demo-3",
      album: "demo",
      takenUtc: Date.UTC(2025, 7, 2, 9, 15, 0),
      tzOffset: 7200,
      lat: 49.2,
      lon: 16.6,
      comment: null,
      place: "Brno, Česko",
      bg: "#2f6b4f",
      label: "3 · place only",
      w: 576,
      h: 768,
    },
    {
      id: "demo-4",
      album: "demo",
      takenUtc: Date.UTC(2023, 2, 8, 12, 0, 0),
      tzOffset: 3600,
      lat: null,
      lon: null,
      comment: null,
      place: null,
      bg: "#4a4a55",
      label: "4 · date only",
      w: 1024,
      h: 768,
    },
  ];

  function seed(idb, image) {
    var chain = Promise.resolve();
    var i;
    for (i = 0; i < DEMO_ITEMS.length; i++) {
      (function (item) {
        chain = chain
          .then(function () {
            return image.makePlaceholderBlob(item.w, item.h, item.bg, item.label);
          })
          .then(function (blob) {
            return idb.putPhoto(item.id, blob).then(function () {
              return idb.putMeta({
                id: item.id,
                album: item.album,
                takenUtc: item.takenUtc,
                tzOffset: item.tzOffset,
                lat: item.lat,
                lon: item.lon,
                w: item.w,
                h: item.h,
                postId: item.comment ? "demo-post-" + item.id : null,
                geoCell: item.lat != null ? PS.geo.cellKey(item.lat, item.lon) : null,
                fingerprint: "demo",
                place: item.place || null,
              });
            });
          })
          .then(function () {
            if (!item.comment) return null;
            return idb.putPost({ postId: "demo-post-" + item.id, comment: item.comment });
          })
          .then(function () {
            if (!item.place || item.lat == null) return null;
            return idb.putGeo(PS.geo.cellKey(item.lat, item.lon), item.place);
          });
      })(DEMO_ITEMS[i]);
    }
    return chain.then(function () {
      return DEMO_ITEMS.map(function (it) {
        return it.id;
      });
    });
  }

  function isDemo() {
    return /[?&]demo=1(?:&|$)/.test(global.location && global.location.search ? global.location.search : "");
  }

  global.PS = global.PS || {};
  global.PS.demo = {
    isDemo: isDemo,
    seed: seed,
    ITEMS: DEMO_ITEMS,
  };
})(typeof window !== "undefined" ? window : global);
