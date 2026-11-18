/* Shuffle bag: every id shown once per cycle; new ids join the remaining bag. ES5. */
(function (global) {
  "use strict";

  function ShuffleBag(ids, remaining, last) {
    this._all = ids ? ids.slice() : [];
    this._last = arguments.length >= 3 ? last : null;
    this._bag = remaining && remaining.length ? remaining.slice() : this._all.slice();
    this._shuffleInPlace(this._bag);
    this._avoidImmediateRepeat();
  }

  ShuffleBag.prototype._shuffleInPlace = function (arr) {
    var i, j, t;
    for (i = arr.length - 1; i > 0; i--) {
      j = Math.floor(Math.random() * (i + 1));
      t = arr[i];
      arr[i] = arr[j];
      arr[j] = t;
    }
  };

  /** If the next draw would repeat `_last`, swap front with a random later slot. */
  ShuffleBag.prototype._avoidImmediateRepeat = function () {
    if (this._bag.length < 2 || this._last == null) return;
    if (this._bag[0] !== this._last) return;
    var j = 1 + Math.floor(Math.random() * (this._bag.length - 1));
    var t = this._bag[0];
    this._bag[0] = this._bag[j];
    this._bag[j] = t;
  };

  /** Record an id as last-shown (e.g. restored currentId) and fix bag front if needed. */
  ShuffleBag.prototype.setLast = function (id) {
    this._last = id != null ? id : null;
    this._avoidImmediateRepeat();
  };

  /** Replace the universe of ids; keep unseen bag entries that still exist; add new ones. */
  ShuffleBag.prototype.setIds = function (ids) {
    var set = {};
    var i;
    for (i = 0; i < ids.length; i++) set[ids[i]] = true;
    var kept = [];
    for (i = 0; i < this._bag.length; i++) {
      if (set[this._bag[i]]) kept.push(this._bag[i]);
    }
    var known = {};
    for (i = 0; i < this._all.length; i++) known[this._all[i]] = true;
    var added = [];
    for (i = 0; i < ids.length; i++) {
      if (!known[ids[i]]) added.push(ids[i]);
    }
    this._all = ids.slice();
    this._bag = kept.concat(added);
    if (!this._bag.length) {
      this._bag = this._all.slice();
      this._shuffleInPlace(this._bag);
    }
    this._avoidImmediateRepeat();
  };

  ShuffleBag.prototype.next = function () {
    if (!this._bag.length) {
      this._bag = this._all.slice();
      this._shuffleInPlace(this._bag);
      this._avoidImmediateRepeat();
    }
    if (!this._bag.length) return null;
    var id = this._bag.shift();
    this._last = id;
    return id;
  };

  ShuffleBag.prototype.peekRemaining = function () {
    return this._bag.slice();
  };

  ShuffleBag.prototype.toState = function () {
    return { remaining: this._bag.slice(), all: this._all.slice(), last: this._last };
  };

  ShuffleBag.fromState = function (state) {
    var all = state && state.all ? state.all : [];
    var remaining = state && state.remaining;
    var last = state && Object.prototype.hasOwnProperty.call(state, "last") ? state.last : null;
    return new ShuffleBag(all, remaining, last);
  };

  global.PS = global.PS || {};
  global.PS.ShuffleBag = ShuffleBag;
})(typeof window !== "undefined" ? window : global);
