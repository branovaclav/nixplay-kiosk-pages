/* Resize to frame + optional 3×3 unsharp mask → JPEG blob. ES5 / canvas. */
(function (global) {
  "use strict";

  var MAX_W = 1024;
  var MAX_H = 768;
  var PORTRAIT_W = 576;

  function loadImageFromBlob(blob) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(blob);
      var img = new Image();
      img.onload = function () {
        URL.revokeObjectURL(url);
        resolve(img);
      };
      img.onerror = function () {
        URL.revokeObjectURL(url);
        reject(new Error("img"));
      };
      img.src = url;
    });
  }

  function fitSize(srcW, srcH) {
    var maxW = srcH > srcW ? PORTRAIT_W : MAX_W;
    var maxH = MAX_H;
    var scale = Math.min(maxW / srcW, maxH / srcH, 1);
    return {
      w: Math.max(1, Math.round(srcW * scale)),
      h: Math.max(1, Math.round(srcH * scale)),
    };
  }

  function getImageData(canvas) {
    return canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height);
  }

  /** Separable [1 2 1]/4 blur then out = px + amount*(px − blur). */
  function unsharpMask(imageData, amount) {
    if (!amount) return imageData;
    var w = imageData.width;
    var h = imageData.height;
    var src = imageData.data;
    var tmp = new Uint8ClampedArray(src.length);
    var out = new Uint8ClampedArray(src.length);
    var x, y, i, c, sum;

    function idx(xx, yy) {
      return (yy * w + xx) * 4;
    }

    // Horizontal
    for (y = 0; y < h; y++) {
      for (x = 0; x < w; x++) {
        for (c = 0; c < 3; c++) {
          sum =
            src[idx(Math.max(0, x - 1), y) + c] +
            2 * src[idx(x, y) + c] +
            src[idx(Math.min(w - 1, x + 1), y) + c];
          tmp[idx(x, y) + c] = (sum / 4 + 0.5) | 0;
        }
        tmp[idx(x, y) + 3] = src[idx(x, y) + 3];
      }
    }
    // Vertical + USM
    for (y = 0; y < h; y++) {
      for (x = 0; x < w; x++) {
        i = idx(x, y);
        for (c = 0; c < 3; c++) {
          sum =
            tmp[idx(x, Math.max(0, y - 1)) + c] +
            2 * tmp[i + c] +
            tmp[idx(x, Math.min(h - 1, y + 1)) + c];
          var blur = sum / 4;
          var v = src[i + c] + amount * (src[i + c] - blur);
          if (v < 0) v = 0;
          if (v > 255) v = 255;
          out[i + c] = (v + 0.5) | 0;
        }
        out[i + 3] = src[i + 3];
      }
    }
    return new ImageData(out, w, h);
  }

  function canvasToJpegBlob(canvas, quality) {
    return new Promise(function (resolve, reject) {
      if (canvas.toBlob) {
        canvas.toBlob(
          function (b) {
            if (b) resolve(b);
            else reject(new Error("toBlob"));
          },
          "image/jpeg",
          quality
        );
        return;
      }
      // Fallback dataURL
      try {
        var data = canvas.toDataURL("image/jpeg", quality);
        var bin = atob(data.split(",")[1]);
        var arr = new Uint8Array(bin.length);
        var i;
        for (i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
        resolve(new Blob([arr], { type: "image/jpeg" }));
      } catch (e) {
        reject(e);
      }
    });
  }

  /**
   * @param {Blob} blob source JPEG
   * @param {number} sharpenAmount 0 = off, default 0.3
   * @returns {Promise<{blob: Blob, w: number, h: number}>}
   */
  function processForFrame(blob, sharpenAmount) {
    var amount = sharpenAmount == null ? 0.3 : Number(sharpenAmount);
    return loadImageFromBlob(blob).then(function (img) {
      var size = fitSize(img.naturalWidth || img.width, img.naturalHeight || img.height);
      var canvas = document.createElement("canvas");
      canvas.width = size.w;
      canvas.height = size.h;
      var ctx = canvas.getContext("2d");
      if (ctx.imageSmoothingEnabled != null) ctx.imageSmoothingEnabled = true;
      if (ctx.imageSmoothingQuality) ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, 0, 0, size.w, size.h);
      if (amount > 0) {
        var id = getImageData(canvas);
        // ImageData ctor with Uint8ClampedArray — Chromium 81 OK
        var sharpened = unsharpMask(id, amount);
        ctx.putImageData(sharpened, 0, 0);
      }
      return canvasToJpegBlob(canvas, 0.9).then(function (out) {
        return { blob: out, w: size.w, h: size.h };
      });
    });
  }

  /** Synthetic demo JPEG as Blob (coloured rect + label). */
  function makePlaceholderBlob(w, h, bg, label) {
    var canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    var ctx = canvas.getContext("2d");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.font = "bold 36px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label || "", w / 2, h / 2);
    return canvasToJpegBlob(canvas, 0.9);
  }

  global.PS = global.PS || {};
  global.PS.image = {
    processForFrame: processForFrame,
    fitSize: fitSize,
    makePlaceholderBlob: makePlaceholderBlob,
    unsharpMask: unsharpMask,
  };
})(typeof window !== "undefined" ? window : global);
