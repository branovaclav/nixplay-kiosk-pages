/* Minimal ES5 binary-plist reader for CloudKit *Enc fields (locationEnc, etc.).
   Enough for dictionaries of numbers / strings / data / arrays / bools / dates.
   Spec: Apple Binary Property List. */
(function (global) {
  "use strict";

  function u8(buf, i) {
    return buf[i] & 0xff;
  }

  function readUint(buf, offset, size) {
    var v = 0;
    var i;
    for (i = 0; i < size; i++) v = (v << 8) | u8(buf, offset + i);
    // JS bitwise is 32-bit signed; for size>3 use multiplication
    if (size > 4) {
      v = 0;
      for (i = 0; i < size; i++) v = v * 256 + u8(buf, offset + i);
    }
    return v;
  }

  function readSizedInt(buf, offset, size) {
    if (size === 0) return 0;
    if (size === 1) return u8(buf, offset);
    if (size === 2) return (u8(buf, offset) << 8) | u8(buf, offset + 1);
    if (size === 4) {
      return (
        ((u8(buf, offset) << 24) >>> 0) +
        (u8(buf, offset + 1) << 16) +
        (u8(buf, offset + 2) << 8) +
        u8(buf, offset + 3)
      );
    }
    return readUint(buf, offset, size);
  }

  function decodeUtf8(bytes) {
    var out = "";
    var i = 0;
    while (i < bytes.length) {
      var c = bytes[i++];
      if (c < 0x80) out += String.fromCharCode(c);
      else if (c < 0xe0) {
        out += String.fromCharCode(((c & 0x1f) << 6) | (bytes[i++] & 0x3f));
      } else if (c < 0xf0) {
        out += String.fromCharCode(
          ((c & 0x0f) << 12) | ((bytes[i++] & 0x3f) << 6) | (bytes[i++] & 0x3f)
        );
      } else {
        var cp =
          ((c & 0x07) << 18) |
          ((bytes[i++] & 0x3f) << 12) |
          ((bytes[i++] & 0x3f) << 6) |
          (bytes[i++] & 0x3f);
        cp -= 0x10000;
        out += String.fromCharCode(0xd800 + (cp >> 10), 0xdc00 + (cp & 0x3ff));
      }
    }
    return out;
  }

  function parseBplist(buf) {
    if (!buf || buf.length < 40) throw new Error("bplist: too short");
    var magic = String.fromCharCode(buf[0], buf[1], buf[2], buf[3], buf[4], buf[5]);
    if (magic !== "bplist") throw new Error("bplist: bad magic");

    var trailer = buf.length - 32;
    var offsetSize = u8(buf, trailer + 6);
    var objectRefSize = u8(buf, trailer + 7);
    var numObjects = readUint(buf, trailer + 8, 8);
    var topObject = readUint(buf, trailer + 16, 8);
    var offsetTableOffset = readUint(buf, trailer + 24, 8);

    function objectOffset(idx) {
      return readUint(buf, offsetTableOffset + idx * offsetSize, offsetSize);
    }

    function readRef(at) {
      return readSizedInt(buf, at, objectRefSize);
    }

    function parseObject(idx) {
      var off = objectOffset(idx);
      var marker = u8(buf, off);
      var type = marker >> 4;
      var info = marker & 0x0f;
      var len = info;
      var p = off + 1;

      if (type !== 0x0 && info === 0x0f) {
        var intMarker = u8(buf, p);
        p++;
        var intSize = 1 << (intMarker & 0x0f);
        len = readSizedInt(buf, p, intSize);
        p += intSize;
      }

      var i;
      var arr;
      var ref;

      switch (type) {
        case 0x0: // null/bool
          if (info === 0x0) return null;
          if (info === 0x8) return false;
          if (info === 0x9) return true;
          return null;
        case 0x1: // int
          return readSizedInt(buf, p, 1 << info);
        case 0x2: // real
          if (info === 2) {
            // float32 — rare; skip via DataView if available
            if (typeof DataView !== "undefined") {
              return new DataView(buf.buffer, buf.byteOffset + p, 4).getFloat32(0);
            }
            return 0;
          }
          if (info === 3) {
            if (typeof DataView !== "undefined") {
              return new DataView(buf.buffer, buf.byteOffset + p, 8).getFloat64(0);
            }
            return 0;
          }
          return 0;
        case 0x3: // date
          if (typeof DataView !== "undefined") {
            var secs = new DataView(buf.buffer, buf.byteOffset + p, 8).getFloat64(0);
            // Apple epoch 2001-01-01
            return new Date((secs + 978307200) * 1000);
          }
          return null;
        case 0x4: // data
          return buf.subarray(p, p + len);
        case 0x5: // ASCII string
          arr = [];
          for (i = 0; i < len; i++) arr.push(u8(buf, p + i));
          return decodeUtf8(arr);
        case 0x6: // UTF-16 BE
          arr = [];
          for (i = 0; i < len; i++) {
            arr.push((u8(buf, p + i * 2) << 8) | u8(buf, p + i * 2 + 1));
          }
          return String.fromCharCode.apply(null, arr);
        case 0xa: // array
          arr = [];
          for (i = 0; i < len; i++) {
            ref = readRef(p + i * objectRefSize);
            arr.push(parseObject(ref));
          }
          return arr;
        case 0xd: // dict
          var keys = [];
          var vals = [];
          for (i = 0; i < len; i++) {
            keys.push(readRef(p + i * objectRefSize));
          }
          for (i = 0; i < len; i++) {
            vals.push(readRef(p + len * objectRefSize + i * objectRefSize));
          }
          var obj = {};
          for (i = 0; i < len; i++) {
            obj[parseObject(keys[i])] = parseObject(vals[i]);
          }
          return obj;
        default:
          return null;
      }
    }

    return parseObject(topObject);
  }

  function b64ToUint8(b64) {
    var bin = atob(b64);
    var out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  /** Parse CloudKit locationEnc → {lat, lon} or null. */
  function parseLocationEnc(b64) {
    if (!b64) return null;
    try {
      var root = parseBplist(b64ToUint8(b64));
      if (!root || typeof root !== "object") return null;
      var lat = root.lat != null ? root.lat : root.latitude;
      var lon = root.lon != null ? root.lon : root.longitude;
      if (typeof lat !== "number" || typeof lon !== "number") return null;
      if (!isFinite(lat) || !isFinite(lon)) return null;
      return { lat: lat, lon: lon };
    } catch (e) {
      return null;
    }
  }

  global.PS = global.PS || {};
  global.PS.bplist = {
    parse: parseBplist,
    parseLocationEnc: parseLocationEnc,
    b64ToUint8: b64ToUint8,
  };
})(typeof window !== "undefined" ? window : global);
