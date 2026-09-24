/**
 * Shared horizontal walk helpers — pick direction from screen edges, detect blocks, flip.
 * Works in browser (window.MeowWalkPlacement) and Node (module.exports).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.MeowWalkPlacement = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const DEFAULT_MARGIN = 20;
  const BLOCKED_ROOM_PX = 12;

  function flipDirection(dir) {
    return dir > 0 ? -1 : 1;
  }

  function pickHorizontalDirection(placement, lastDir) {
    if (placement?.nearRight && !placement?.nearLeft) return -1;
    if (placement?.nearLeft && !placement?.nearRight) return 1;
    if (lastDir === 1 || lastDir === -1) return -lastDir;
    return Math.random() < 0.5 ? -1 : 1;
  }

  function roomInDirection(placement, dir, margin = DEFAULT_MARGIN) {
    if (!placement?.workArea) return Infinity;
    const { x, width, workArea } = placement;
    if (dir > 0) {
      return workArea.x + workArea.width - (x + width) - margin;
    }
    return x - workArea.x - margin;
  }

  function isBlockedHorizontally(placement, dir, margin = DEFAULT_MARGIN) {
    if (!placement?.workArea) return false;
    return roomInDirection(placement, dir, margin) <= BLOCKED_ROOM_PX;
  }

  function maxHorizontalDistance(dir, placement, opts = {}) {
    const fallback = opts.fallback ?? (380 + Math.random() * 140);
    const margin = opts.margin ?? DEFAULT_MARGIN;
    const minRoom = opts.minRoom ?? 40;
    if (!placement?.workArea) return fallback;
    const room = roomInDirection(placement, dir, margin);
    if (room <= minRoom) return 0;
    return Math.min(fallback, room);
  }

  return {
    DEFAULT_MARGIN,
    BLOCKED_ROOM_PX,
    flipDirection,
    pickHorizontalDirection,
    roomInDirection,
    isBlockedHorizontally,
    maxHorizontalDistance,
  };
});
