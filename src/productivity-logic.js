/**
 * Pure productivity helpers (tasks day rollover, focus timer math, water overdue).
 * Works in browser (window.MeowProductivityLogic) and Node (module.exports).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.MeowProductivityLogic = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /** Includes 1m for tests/dev; UI picker uses FOCUS_UI_DURATIONS_MIN. */
  const FOCUS_DURATIONS_MIN = [1, 10, 15, 20, 25, 30, 45, 60, 90];
  /** Polen Focus tab picker (10–60 minutes). */
  const FOCUS_UI_DURATIONS_MIN = [10, 15, 20, 25, 30, 45, 60];
  const FOCUS_TIMER_SIZES = ['S', 'M', 'L'];
  const WATER_SNOOZE_MS = 10 * 60 * 1000;
  /** Presets: 10s is for local testing; others are production remind intervals. */
  const WATER_INTERVAL_PRESETS = [
    { id: '10s', label: '10s', ms: 10 * 1000 },
    { id: '30', label: '30m', ms: 30 * 60 * 1000 },
    { id: '45', label: '45m', ms: 45 * 60 * 1000 },
    { id: '60', label: '60m', ms: 60 * 60 * 1000 },
  ];
  const WATER_INTERVALS_MIN = WATER_INTERVAL_PRESETS.map((p) =>
    p.id === '10s' ? '10s' : Number(p.id)
  );

  function normalizeWaterIntervalId(value) {
    if (value === '10s' || value === 0) return '10s';
    const n = Number(value);
    if (n === 30 || n === 45 || n === 60) return n;
    return 45;
  }

  function waterIntervalMs(intervalId) {
    const id = normalizeWaterIntervalId(intervalId);
    const preset = WATER_INTERVAL_PRESETS.find((p) => p.id === String(id));
    return preset ? preset.ms : 45 * 60 * 1000;
  }

  function todayKey(date = new Date()) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  function addDaysKey(dateKey, days) {
    const [y, m, d] = String(dateKey).split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    dt.setDate(dt.getDate() + days);
    return todayKey(dt);
  }

  function normalizeItems(rawItems) {
    if (!Array.isArray(rawItems)) return [];
    return rawItems
      .filter((t) => t && typeof t.text === 'string' && t.text.trim())
      .map((t) => ({
        id: String(t.id || `t-${Math.random().toString(36).slice(2, 9)}`),
        text: String(t.text).trim().slice(0, 120),
        done: !!t.done,
      }));
  }

  /**
   * Task store with today / tomorrow buckets.
   * Migrates legacy `{ date, items, notesPinned }` into `{ today, tomorrow, notesPinned }`.
   */
  function normalizeTaskStore(raw, now = new Date()) {
    const today = todayKey(now);
    const tomorrowKey = addDaysKey(today, 1);
    const empty = {
      today: { date: today, items: [] },
      tomorrow: { date: tomorrowKey, items: [] },
      notesPinned: false,
    };
    if (!raw || typeof raw !== 'object') return empty;

    const notesPinned = !!raw.notesPinned;

    // Legacy single-day shape
    if (raw.items && !raw.today) {
      if (raw.date === today) {
        return {
          today: { date: today, items: normalizeItems(raw.items) },
          tomorrow: { date: tomorrowKey, items: [] },
          notesPinned,
        };
      }
      return { ...empty, notesPinned };
    }

    let todayItems = normalizeItems(raw.today?.items);
    let tomorrowItems = normalizeItems(raw.tomorrow?.items);
    const rawTodayDate = raw.today?.date;
    const rawTomorrowDate = raw.tomorrow?.date;

    // Day rollover: promote tomorrow → today if tomorrow was scheduled for today
    if (rawTodayDate !== today) {
      if (rawTomorrowDate === today) {
        todayItems = tomorrowItems;
      } else {
        todayItems = [];
      }
      tomorrowItems = [];
    } else if (rawTomorrowDate && rawTomorrowDate !== tomorrowKey) {
      tomorrowItems = [];
    }

    return {
      today: { date: today, items: todayItems },
      tomorrow: { date: tomorrowKey, items: tomorrowItems },
      notesPinned,
    };
  }

  function dayItems(store, day) {
    const s = normalizeTaskStore(store);
    return day === 'tomorrow' ? s.tomorrow.items : s.today.items;
  }

  /** Split list into active (unchecked) then finished (checked). */
  function partitionTasks(items) {
    const list = Array.isArray(items) ? items : [];
    return {
      active: list.filter((t) => !t.done),
      finished: list.filter((t) => t.done),
    };
  }

  function normalizeFocusMinutes(mins, uiOnly = false) {
    const n = Number(mins);
    const pool = uiOnly ? FOCUS_UI_DURATIONS_MIN : FOCUS_DURATIONS_MIN;
    return pool.includes(n) ? n : 25;
  }

  function remainingMs(endsAt, now = Date.now()) {
    if (!Number.isFinite(endsAt)) return 0;
    return Math.max(0, endsAt - now);
  }

  function formatCountdown(ms) {
    const totalSec = Math.max(0, Math.ceil(ms / 1000));
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${mins}:${String(secs).padStart(2, '0')}`;
  }

  function isWaterOverdue(lastDrinkAt, intervalId, now = Date.now(), snoozeUntil = 0) {
    if (Number.isFinite(snoozeUntil) && snoozeUntil > now) return false;
    const ms = waterIntervalMs(intervalId);
    if (!Number.isFinite(lastDrinkAt) || lastDrinkAt <= 0) return true;
    return now - lastDrinkAt >= ms;
  }

  function snoozeWaterUntil(now = Date.now(), snoozeMs = WATER_SNOOZE_MS) {
    return now + snoozeMs;
  }

  /** True when cursor is inside window bounds (with margin). */
  function isCursorInsideWindow(cursor, placement, margin = 12) {
    if (!cursor || !placement) return false;
    const left = placement.x - margin;
    const top = placement.y - margin;
    const right = placement.x + placement.width + margin;
    const bottom = placement.y + placement.height + margin;
    return cursor.x >= left && cursor.x <= right && cursor.y >= top && cursor.y <= bottom;
  }

  /**
   * Screen-space center of the cat within the Electron window.
   * catRectInWindow: { left, top, width, height } relative to the window (e.g. getBoundingClientRect).
   */
  function catChaseAnchorScreen(placement, catRectInWindow) {
    if (!placement) return null;
    const left = Number(catRectInWindow?.left) || 0;
    const top = Number(catRectInWindow?.top) || 0;
    const w = Number(catRectInWindow?.width) || 0;
    const h = Number(catRectInWindow?.height) || 0;
    return {
      x: placement.x + left + w / 2,
      y: placement.y + top + h / 2,
    };
  }

  /** True when cursor is within radiusPx of the chase anchor (cat), not the whole window. */
  function isCursorNearChaseTarget(cursor, anchor, radiusPx = 48) {
    if (!cursor || !anchor) return false;
    const r = Number(radiusPx) || 48;
    return Math.hypot(cursor.x - anchor.x, cursor.y - anchor.y) <= r;
  }

  /**
   * Distance-based chase step (farther = larger step, capped).
   * minStep when far enough to move; maxStep hard cap.
   */
  function chaseStepToward(fromX, fromY, toX, toY, opts = {}) {
    const maxStep = opts.maxStep ?? 64;
    const minStep = opts.minStep ?? 8;
    const dx = toX - fromX;
    const dy = toY - fromY;
    const dist = Math.hypot(dx, dy);
    if (dist < minStep) return { dx: 0, dy: 0, dist };
    const step = Math.min(maxStep, Math.max(minStep, dist * 0.22));
    return { ...clampStepToward(fromX, fromY, toX, toY, step), dist };
  }

  /**
   * Smoothed per-frame chase (for requestAnimationFrame); keeps sub-pixel remainder.
   * opts.dtMs scales motion to real frame time (clamped 8–32ms, baseline 16.67ms).
   */
  function chaseSmoothStep(fromX, fromY, toX, toY, motion = {}, opts = {}) {
    const maxSpeed = opts.maxSpeed ?? 32;
    const damping = opts.damping ?? 0.82;
    const steer = opts.steer ?? 0.42;
    const arrive = opts.arrive ?? 5;
    const rawDt = Number(opts.dtMs);
    const dtMs = Number.isFinite(rawDt) ? Math.min(32, Math.max(8, rawDt)) : 16.67;
    const dtScale = dtMs / 16.67;
    let velX = motion.velX ?? 0;
    let velY = motion.velY ?? 0;
    let fracX = motion.fracX ?? 0;
    let fracY = motion.fracY ?? 0;

    const dx = toX - fromX;
    const dy = toY - fromY;
    const dist = Math.hypot(dx, dy);
    if (dist < arrive) {
      velX *= damping;
      velY *= damping;
      if (Math.hypot(velX, velY) < 0.4) {
        velX = 0;
        velY = 0;
      }
      return { dx: 0, dy: 0, velX, velY, fracX, fracY, dist };
    }

    const desiredSpeed = Math.min(maxSpeed, Math.max(dist * 0.35, arrive));
    const desiredVx = (dx / dist) * desiredSpeed;
    const desiredVy = (dy / dist) * desiredSpeed;
    velX = velX * damping + desiredVx * steer;
    velY = velY * damping + desiredVy * steer;
    const speed = Math.hypot(velX, velY);
    const speedCap = Math.min(maxSpeed, Math.max(desiredSpeed, dist * 0.5));
    if (speed > speedCap) {
      velX = (velX / speed) * speedCap;
      velY = (velY / speed) * speedCap;
    }

    let totalX = velX * dtScale + fracX;
    let totalY = velY * dtScale + fracY;
    const moveMag = Math.hypot(totalX, totalY);
    if (moveMag > dist) {
      const s = dist / moveMag;
      totalX *= s;
      totalY *= s;
    }
    const stepX = Math.trunc(totalX);
    const stepY = Math.trunc(totalY);
    fracX = totalX - stepX;
    fracY = totalY - stepY;

    return { dx: stepX, dy: stepY, velX, velY, fracX, fracY, dist };
  }

  function pickTaskNudge(hour, uncheckedCount) {
    const morning = [
      "Don't let your morning slip~",
      'Time to get moving on today\'s list!',
      'Morning paws say: one tiny task?',
    ];
    const afternoon = [
      'Still a few to-dos waiting~',
      'Quick nudge: check your Today list!',
      'Time to get moving!',
    ];
    const evening = [
      'Evening check-in — any leftover tasks?',
      'Wrap one more item before rest?',
      'Your list still has a few paw-prints~',
    ];
    let pool = afternoon;
    if (hour < 12) pool = morning;
    else if (hour >= 18) pool = evening;
    if (uncheckedCount <= 0) return null;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  function clampStepToward(fromX, fromY, toX, toY, maxStep) {
    const dx = toX - fromX;
    const dy = toY - fromY;
    const dist = Math.hypot(dx, dy);
    if (dist <= maxStep || dist === 0) return { dx: Math.round(dx), dy: Math.round(dy) };
    const scale = maxStep / dist;
    return { dx: Math.round(dx * scale), dy: Math.round(dy * scale) };
  }

  function normalizeFocusTimerSize(size) {
    const s = String(size || 'M').toUpperCase();
    return FOCUS_TIMER_SIZES.includes(s) ? s : 'M';
  }

  /** Clamp panel top-left into work-area client coords (0..width-h, 0..height-w). */
  function clampScreenPosition(pos, panelSize, workSize, margin = 8) {
    const w = Math.max(40, Number(panelSize?.width) || 220);
    const h = Math.max(40, Number(panelSize?.height) || 160);
    const areaW = Math.max(w, Number(workSize?.width) || 800);
    const areaH = Math.max(h, Number(workSize?.height) || 600);
    const m = Number(margin) || 0;
    const x = Number(pos?.x);
    const y = Number(pos?.y);
    return {
      x: Math.max(m, Math.min(Number.isFinite(x) ? x : m, areaW - w - m)),
      y: Math.max(m, Math.min(Number.isFinite(y) ? y : m, areaH - h - m)),
    };
  }

  /**
   * Prefer screenPositions; migrate legacy floats offsets into absolute coords
   * using optional seed { x, y } (e.g. default hub placement).
   */
  function normalizeScreenPositions(raw, seed = {}) {
    const keys = ['hub', 'pinned', 'timer', 'chat'];
    const out = {};
    keys.forEach((key) => {
      const sp = raw?.screenPositions?.[key];
      if (sp && Number.isFinite(Number(sp.x)) && Number.isFinite(Number(sp.y))) {
        out[key] = { x: Number(sp.x), y: Number(sp.y) };
        return;
      }
      const fl = raw?.floats?.[key];
      const sx = Number(seed?.[key]?.x);
      const sy = Number(seed?.[key]?.y);
      const baseX = Number.isFinite(sx) ? sx : 24;
      const baseY = Number.isFinite(sy) ? sy : 24;
      out[key] = {
        x: baseX + (Number(fl?.x) || 0),
        y: baseY + (Number(fl?.y) || 0),
      };
    });
    return out;
  }

  return {
    FOCUS_DURATIONS_MIN,
    FOCUS_UI_DURATIONS_MIN,
    FOCUS_TIMER_SIZES,
    WATER_INTERVALS_MIN,
    WATER_INTERVAL_PRESETS,
    WATER_SNOOZE_MS,
    normalizeWaterIntervalId,
    waterIntervalMs,
    todayKey,
    addDaysKey,
    normalizeTaskStore,
    dayItems,
    partitionTasks,
    normalizeFocusMinutes,
    remainingMs,
    formatCountdown,
    isWaterOverdue,
    snoozeWaterUntil,
    isCursorInsideWindow,
    catChaseAnchorScreen,
    isCursorNearChaseTarget,
    chaseStepToward,
    chaseSmoothStep,
    pickTaskNudge,
    clampStepToward,
    normalizeFocusTimerSize,
    clampScreenPosition,
    normalizeScreenPositions,
  };
});
