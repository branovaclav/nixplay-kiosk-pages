/* Shuffle bag: every id shown once per cycle; new ids join the remaining bag. ES5. */
(function (global) {
  "use strict";

  function ShuffleBag(ids, remaining) {
    this._all = ids ? ids.slice() : [];
    this._bag = remaining && remaining.length ? remaining.slice() : this._all.slice();
    this._shuffleInPlace(this._bag);
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
  };

  ShuffleBag.prototype.next = function () {
    if (!this._bag.length) {
      this._bag = this._all.slice();
      this._shuffleInPlace(this._bag);
    }
    return this._bag.length ? this._bag.shift() : null;
  };

  ShuffleBag.prototype.peekRemaining = function () {
    return this._bag.slice();
  };

  ShuffleBag.prototype.toState = function () {
    return { remaining: this._bag.slice(), all: this._all.slice() };
  };

  ShuffleBag.fromState = function (state) {
    var bag = new ShuffleBag(state && state.all ? state.all : [], state && state.remaining);
    return bag;
  };

  global.PS = global.PS || {};
  global.PS.ShuffleBag = ShuffleBag;
})(typeof window !== "undefined" ? window : global);
