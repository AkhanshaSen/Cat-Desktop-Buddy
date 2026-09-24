/**
 * Unit tests for walk-placement helpers (no Electron).
 * Run: npm run test:walk-placement
 */
const assert = require('assert');
const path = require('path');
const Walk = require(path.join(__dirname, '..', 'src', 'walk-placement.js'));

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

console.log('walk-placement');

check('flipDirection toggles sign', () => {
  assert.strictEqual(Walk.flipDirection(1), -1);
  assert.strictEqual(Walk.flipDirection(-1), 1);
});

check('pickHorizontalDirection near left walks right', () => {
  assert.strictEqual(
    Walk.pickHorizontalDirection({ nearLeft: true, nearRight: false }),
    1
  );
});

check('pickHorizontalDirection near right walks left', () => {
  assert.strictEqual(
    Walk.pickHorizontalDirection({ nearLeft: false, nearRight: true }),
    -1
  );
});

check('pickHorizontalDirection alternates lastDir', () => {
  assert.strictEqual(Walk.pickHorizontalDirection({}, 1), -1);
  assert.strictEqual(Walk.pickHorizontalDirection({}, -1), 1);
});

check('isBlockedHorizontally at right edge when walking right', () => {
  const placement = {
    x: 1800,
    width: 220,
    workArea: { x: 0, y: 0, width: 1920, height: 1080 },
    nearRight: true,
    nearLeft: false,
  };
  assert.strictEqual(Walk.isBlockedHorizontally(placement, 1), true);
  assert.strictEqual(Walk.isBlockedHorizontally(placement, -1), false);
});

check('isBlockedHorizontally at left edge when walking left', () => {
  const placement = {
    x: 10,
    width: 220,
    workArea: { x: 0, y: 0, width: 1920, height: 1080 },
    nearLeft: true,
    nearRight: false,
  };
  assert.strictEqual(Walk.isBlockedHorizontally(placement, -1), true);
  assert.strictEqual(Walk.isBlockedHorizontally(placement, 1), false);
});

check('maxHorizontalDistance returns 0 when blocked', () => {
  const placement = {
    x: 1880,
    width: 220,
    workArea: { x: 0, y: 0, width: 1920, height: 1080 },
  };
  assert.strictEqual(Walk.maxHorizontalDistance(1, placement, { fallback: 300 }), 0);
});

check('maxHorizontalDistance clamps to available room', () => {
  const placement = {
    x: 100,
    width: 220,
    workArea: { x: 0, y: 0, width: 1920, height: 1080 },
  };
  const dist = Walk.maxHorizontalDistance(1, placement, { fallback: 10000 });
  assert.ok(dist > 40);
  assert.ok(dist < 10000);
});

check('maxHorizontalDistance default fallback is in raised range when no placement', () => {
  const a = Walk.maxHorizontalDistance(1, null);
  const b = Walk.maxHorizontalDistance(1, {});
  assert.ok(a >= 380 && a <= 520, `expected 380–520, got ${a}`);
  assert.ok(b >= 380 && b <= 520, `expected 380–520, got ${b}`);
});

if (!process.exitCode) {
  console.log(`\n${passed} checks passed.`);
}
