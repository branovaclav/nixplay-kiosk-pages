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
      comment: "Jesenné prázdniny v Paríži, Francúzsko",
      place: "Paríž, Francúzsko",
      bg: "#ffffff",
      label: "",
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
      bg: "#ffffff",
      label: "",
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
      bg: "#ffffff",
      label: "",
      w: 1024,
      h: 768,
    },
    {
      id: "demo-4",
      album: "demo",
      takenUtc: Date.UTC(2023, 2, 8, 12, 0, 0),
      tzOffset: 3600,
      lat: 48.14,
      lon: 17.11,
      comment: "Jarná prechádzka",
      place: "Bratislava, Slovensko",
      bg: "sky",
      label: "",
      w: 1024,
      h: 768,
    },
  ];

  function makeSkyBlob(image) {
    // Bright overexposed-sky look via canvas gradient (still synthetic).
    var canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = 768;
    var ctx = canvas.getContext("2d");
    var g = ctx.createLinearGradient(0, 0, 0, 768);
    g.addColorStop(0, "#c8e8ff");
    g.addColorStop(0.45, "#eef7ff");
    g.addColorStop(0.7, "#f7fbf4");
    g.addColorStop(1, "#d8e0c8");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 1024, 768);
    // soft sun glare
    var rg = ctx.createRadialGradient(780, 120, 10, 780, 120, 280);
    rg.addColorStop(0, "rgba(255,255,255,0.95)");
    rg.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = rg;
    ctx.fillRect(0, 0, 1024, 768);
    return new Promise(function (resolve, reject) {
      if (canvas.toBlob) {
        canvas.toBlob(
          function (b) {
            if (b) resolve(b);
            else reject(new Error("toBlob"));
          },
          "image/jpeg",
          0.92
        );
      } else {
        image.makePlaceholderBlob(1024, 768, "#e8f4ff", "").then(resolve, reject);
      }
    });
  }

  function seed(idb, image) {
    var chain = Promise.resolve();
    var i;
    for (i = 0; i < DEMO_ITEMS.length; i++) {
      (function (item) {
        chain = chain
          .then(function () {
            if (item.bg === "sky") return makeSkyBlob(image);
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
    return /[?&]demo=1(?:&|$)/.test(
      global.location && global.location.search ? global.location.search : ""
    );
  }

  global.PS = global.PS || {};
  global.PS.demo = {
    isDemo: isDemo,
    seed: seed,
    ITEMS: DEMO_ITEMS,
  };
})(typeof window !== "undefined" ? window : global);
