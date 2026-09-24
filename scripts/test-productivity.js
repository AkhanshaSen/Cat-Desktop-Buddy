/**
 * Unit tests for productivity pure helpers (no Electron).
 * Run: npm run test:productivity
 */
const assert = require('assert');
const path = require('path');
const Logic = require(path.join(__dirname, '..', 'src', 'productivity-logic.js'));

let passed = 0;
function check(name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
    process.exitCode = 1;
  }
}

console.log('productivity-logic');

check('todayKey formats YYYY-MM-DD', () => {
  assert.strictEqual(Logic.todayKey(new Date('2026-03-15T12:00:00')), '2026-03-15');
});

check('normalizeTaskStore migrates legacy items to today', () => {
  const store = Logic.normalizeTaskStore(
    { date: '2026-09-24', items: [{ id: 'a', text: 'Buy milk', done: false }], notesPinned: true },
    new Date('2026-09-24T10:00:00')
  );
  assert.strictEqual(store.today.date, '2026-09-24');
  assert.strictEqual(store.today.items.length, 1);
  assert.strictEqual(store.today.items[0].text, 'Buy milk');
  assert.strictEqual(store.tomorrow.items.length, 0);
  assert.strictEqual(store.notesPinned, true);
});

check('normalizeTaskStore resets today on new day', () => {
  const store = Logic.normalizeTaskStore(
    {
      today: { date: '2020-01-01', items: [{ id: 'a', text: 'old', done: false }] },
      tomorrow: { date: '2020-01-02', items: [] },
      notesPinned: true,
    },
    new Date('2026-09-24T10:00:00')
  );
  assert.strictEqual(store.today.date, '2026-09-24');
  assert.strictEqual(store.today.items.length, 0);
  assert.strictEqual(store.notesPinned, true);
});

check('normalizeTaskStore promotes tomorrow on rollover', () => {
  const store = Logic.normalizeTaskStore(
    {
      today: { date: '2026-09-23', items: [{ id: 'old', text: 'yesterday', done: false }] },
      tomorrow: { date: '2026-09-24', items: [{ id: 'b', text: 'was tomorrow', done: false }] },
      notesPinned: false,
    },
    new Date('2026-09-24T10:00:00')
  );
  assert.strictEqual(store.today.items.length, 1);
  assert.strictEqual(store.today.items[0].text, 'was tomorrow');
  assert.strictEqual(store.tomorrow.items.length, 0);
  assert.strictEqual(store.tomorrow.date, '2026-09-25');
});

check('remainingMs clamps at zero', () => {
  assert.strictEqual(Logic.remainingMs(1000, 2000), 0);
  assert.strictEqual(Logic.remainingMs(5000, 2000), 3000);
});

check('formatCountdown pads seconds', () => {
  assert.strictEqual(Logic.formatCountdown(0), '0:00');
  assert.strictEqual(Logic.formatCountdown(45000), '0:45');
  assert.strictEqual(Logic.formatCountdown(45 * 60 * 1000), '45:00');
  assert.strictEqual(Logic.formatCountdown(90 * 1000), '1:30');
});

check('isWaterOverdue when never drank', () => {
  assert.strictEqual(Logic.isWaterOverdue(0, 45, Date.now()), true);
});

check('isWaterOverdue respects interval', () => {
  const now = 1_000_000;
  assert.strictEqual(Logic.isWaterOverdue(now - 10 * 60 * 1000, 45, now), false);
  assert.strictEqual(Logic.isWaterOverdue(now - 50 * 60 * 1000, 45, now), true);
});

check('isWaterOverdue supports 10s test preset', () => {
  const now = 1_000_000;
  assert.strictEqual(Logic.waterIntervalMs('10s'), 10000);
  assert.strictEqual(Logic.isWaterOverdue(now - 5000, '10s', now), false);
  assert.strictEqual(Logic.isWaterOverdue(now - 11000, '10s', now), true);
});

check('isWaterOverdue respects snooze', () => {
  const now = 1_000_000;
  assert.strictEqual(Logic.isWaterOverdue(0, 45, now, now + 5000), false);
  assert.strictEqual(Logic.isWaterOverdue(0, 45, now, now - 1), true);
});

check('snoozeWaterUntil adds 10 minutes', () => {
  const now = 1_000_000;
  assert.strictEqual(Logic.snoozeWaterUntil(now), now + Logic.WATER_SNOOZE_MS);
});

check('isCursorInsideWindow detects inside/outside', () => {
  const placement = { x: 100, y: 100, width: 200, height: 200 };
  assert.strictEqual(Logic.isCursorInsideWindow({ x: 150, y: 150 }, placement, 0), true);
  assert.strictEqual(Logic.isCursorInsideWindow({ x: 50, y: 150 }, placement, 0), false);
  assert.strictEqual(Logic.isCursorInsideWindow({ x: 95, y: 150 }, placement, 12), true);
});

check('catChaseAnchorScreen uses cat rect inside window', () => {
  const placement = { x: 100, y: 200, width: 480, height: 560 };
  const catRect = { left: 150, top: 400, width: 180, height: 120 };
  const anchor = Logic.catChaseAnchorScreen(placement, catRect);
  assert.strictEqual(anchor.x, 100 + 150 + 90);
  assert.strictEqual(anchor.y, 200 + 400 + 60);
});

check('isCursorNearChaseTarget ignores large window upper area', () => {
  const placement = { x: 0, y: 0, width: 480, height: 560 };
  const catAnchor = { x: 240, y: 500 };
  // Cursor in upper transparent panel area — inside window but far from cat
  assert.strictEqual(
    Logic.isCursorInsideWindow({ x: 240, y: 80 }, placement, 14),
    true
  );
  assert.strictEqual(
    Logic.isCursorNearChaseTarget({ x: 240, y: 80 }, catAnchor, 52),
    false
  );
  assert.strictEqual(
    Logic.isCursorNearChaseTarget({ x: 245, y: 510 }, catAnchor, 52),
    true
  );
});

check('chaseStepToward returns larger steps when far', () => {
  const near = Logic.chaseStepToward(0, 0, 20, 0, { maxStep: 64, minStep: 6 });
  const far = Logic.chaseStepToward(0, 0, 400, 0, { maxStep: 64, minStep: 6 });
  assert.ok(Math.abs(far.dx) > Math.abs(near.dx));
  assert.ok(Math.abs(far.dx) <= 64);
});

check('chaseSmoothStep moves toward target over frames', () => {
  let motion = {};
  let x = 0;
  for (let i = 0; i < 40; i += 1) {
    const step = Logic.chaseSmoothStep(x, 0, 200, 0, motion, { maxSpeed: 18 });
    motion = step;
    x += step.dx;
  }
  assert.ok(x > 80);
});

check('chaseSmoothStep with dtMs scales motion by frame time', () => {
  const stepSmall = Logic.chaseSmoothStep(0, 0, 400, 0, {}, {
    maxSpeed: 32,
    steer: 1,
    damping: 0,
    dtMs: 8,
  });
  const stepLarge = Logic.chaseSmoothStep(0, 0, 400, 0, {}, {
    maxSpeed: 32,
    steer: 1,
    damping: 0,
    dtMs: 32,
  });
  assert.ok(Math.abs(stepLarge.dx) > Math.abs(stepSmall.dx));
  let motion = {};
  let x = 0;
  for (let i = 0; i < 30; i += 1) {
    const step = Logic.chaseSmoothStep(x, 0, 250, 0, motion, {
      maxSpeed: 32,
      dtMs: 16.67,
    });
    motion = step;
    x += step.dx;
  }
  assert.ok(x > 180);
  assert.ok(x <= 250);
});

check('WATER_INTERVAL_PRESETS includes 10s', () => {
  assert.ok(Logic.WATER_INTERVAL_PRESETS.some((p) => p.id === '10s' && p.label === '10s'));
});

check('pickTaskNudge null when no unchecked', () => {
  assert.strictEqual(Logic.pickTaskNudge(9, 0), null);
});

check('pickTaskNudge returns morning line', () => {
  const line = Logic.pickTaskNudge(9, 2);
  assert.ok(typeof line === 'string' && line.length > 0);
});

check('clampStepToward caps step length', () => {
  const step = Logic.clampStepToward(0, 0, 100, 0, 28);
  assert.strictEqual(step.dx, 28);
  assert.strictEqual(step.dy, 0);
});

check('FOCUS_DURATIONS_MIN includes 45', () => {
  assert.ok(Logic.FOCUS_DURATIONS_MIN.includes(45));
});

check('FOCUS_UI_DURATIONS_MIN is 10–60 range', () => {
  assert.deepStrictEqual(Logic.FOCUS_UI_DURATIONS_MIN, [10, 15, 20, 25, 30, 45, 60]);
  assert.ok(Logic.FOCUS_DURATIONS_MIN.includes(10));
  assert.ok(Logic.FOCUS_DURATIONS_MIN.includes(1));
});

check('normalizeFocusMinutes defaults and validates', () => {
  assert.strictEqual(Logic.normalizeFocusMinutes(25, true), 25);
  assert.strictEqual(Logic.normalizeFocusMinutes(10, true), 10);
  assert.strictEqual(Logic.normalizeFocusMinutes(1, false), 1);
  assert.strictEqual(Logic.normalizeFocusMinutes(1, true), 25);
  assert.strictEqual(Logic.normalizeFocusMinutes(99, true), 25);
});

check('partitionTasks splits active and finished', () => {
  const parts = Logic.partitionTasks([
    { id: 'a', text: 'one', done: false },
    { id: 'b', text: 'two', done: true },
    { id: 'c', text: 'three', done: false },
  ]);
  assert.strictEqual(parts.active.length, 2);
  assert.strictEqual(parts.finished.length, 1);
  assert.strictEqual(parts.finished[0].id, 'b');
});

check('normalizeFocusTimerSize defaults to M', () => {
  assert.strictEqual(Logic.normalizeFocusTimerSize('L'), 'L');
  assert.strictEqual(Logic.normalizeFocusTimerSize('nope'), 'M');
});

check('clampScreenPosition keeps panel inside work area', () => {
  const c = Logic.clampScreenPosition(
    { x: -40, y: 9000 },
    { width: 220, height: 200 },
    { width: 1000, height: 800 },
    8
  );
  assert.strictEqual(c.x, 8);
  assert.ok(c.y <= 800 - 200 - 8);
});

check('normalizeScreenPositions migrates floats to absolute', () => {
  const pos = Logic.normalizeScreenPositions(
    { floats: { hub: { x: 10, y: 20 } } },
    { hub: { x: 40, y: 80 } }
  );
  assert.strictEqual(pos.hub.x, 50);
  assert.strictEqual(pos.hub.y, 100);
  assert.ok(pos.timer);
});

check('normalizeScreenPositions prefers screenPositions', () => {
  const pos = Logic.normalizeScreenPositions(
    {
      floats: { hub: { x: 99, y: 99 } },
      screenPositions: { hub: { x: 12, y: 34 } },
    },
    { hub: { x: 0, y: 0 } }
  );
  assert.strictEqual(pos.hub.x, 12);
  assert.strictEqual(pos.hub.y, 34);
});

if (!process.exitCode) {
  console.log(`\n${passed} checks passed.`);
}
