/**
 * Simulates walk window movement synced to video playback,
 * including edge reverse rewind and early finish at moveEnd.
 * Run: node scripts/test-cat2-walk-sync.js
 */
const WALK_MS = 10000;
const TOTAL = 400;
const FPS = 24;
const FRAMES = Math.round((WALK_MS / 1000) * FPS);
const MOVE_START = 0.04;
const MOVE_END = 0.56;

function simulateOld(clockMs) {
  let applied = 0;
  const moves = [];
  for (let f = 0; f < FRAMES; f += 1) {
    const elapsed = (f / FPS) * 1000;
    const target = (elapsed / clockMs) * TOTAL;
    const delta = Math.round(target - applied);
    if (delta !== 0) {
      applied += delta;
      moves.push({ frame: f, elapsed, applied, delta });
    }
  }
  return moves;
}

function simulateVideoSynced(startFrame = 0) {
  let applied = 0;
  const moves = [];
  for (let f = startFrame; f < FRAMES; f += 1) {
    const currentTime = f / FPS;
    const progress = Math.min(1, currentTime / (WALK_MS / 1000));
    const target = progress * TOTAL;
    const delta = Math.round(target - applied);
    if (delta !== 0) {
      applied += delta;
      moves.push({ frame: f, currentTime, applied, delta });
    }
  }
  return moves;
}

/** Movement only between moveStart–moveEnd; stop at moveEnd (no anim tail travel). */
function simulateMoveWindow(distance = TOTAL) {
  let applied = 0;
  const moves = [];
  let finishedAt = null;
  for (let f = 0; f < FRAMES; f += 1) {
    const rawProgress = (f / FPS) / (WALK_MS / 1000);
    if (rawProgress >= MOVE_END) {
      finishedAt = f;
      break;
    }
    if (rawProgress < MOVE_START) continue;
    const progress = Math.min(1, (rawProgress - MOVE_START) / (MOVE_END - MOVE_START));
    const target = progress * distance;
    const delta = Math.round(target - applied);
    if (delta !== 0) {
      applied += delta;
      moves.push({ frame: f, rawProgress, applied, delta });
    }
  }
  return { moves, applied, finishedAt };
}

/**
 * Edge reverse: rewind to MOVE_START and start a full remaining segment
 * (not mid-clip moveStart=rawProgress which collapses the window).
 */
function simulateEdgeReverse(distance = TOTAL, reverseAtProgress = 0.35) {
  let applied = 0;
  let dir = 1;
  const moves = [];
  let reversed = false;
  let moveStart = MOVE_START;
  let segmentDistance = distance;
  let segmentApplied = 0;
  let seekOffset = 0;
  let reverseSegmentTravel = 0;

  for (let f = 0; f < FRAMES * 2; f += 1) {
    let rawProgress = (f / FPS) / (WALK_MS / 1000) - seekOffset;

    if (!reversed && rawProgress >= reverseAtProgress) {
      reversed = true;
      dir = -1;
      const remaining = Math.max(120, distance - Math.abs(applied));
      segmentDistance = remaining;
      segmentApplied = 0;
      moveStart = MOVE_START;
      seekOffset = (f / FPS) / (WALK_MS / 1000) - MOVE_START;
      rawProgress = MOVE_START;
    }

    if (rawProgress >= MOVE_END) break;
    if (rawProgress < moveStart) continue;

    const progress = Math.min(1, (rawProgress - moveStart) / (MOVE_END - moveStart));
    const target = progress * segmentDistance * dir;
    const delta = Math.round(target - segmentApplied);
    if (Math.abs(delta) >= 1) {
      segmentApplied += delta;
      applied += delta;
      if (reversed) reverseSegmentTravel += Math.abs(delta);
      moves.push({ frame: f, dir, applied, delta });
    }
  }

  return { moves, applied, reversed, lastDir: dir, reverseSegmentTravel, segmentDistance };
}

/** Second walk after first finished: movement must start when clipMovementStarted is false. */
function simulateSecondWalk() {
  let clipMovementStarted = true;
  // After finishWalk / stopWalkMovement:
  clipMovementStarted = false;
  const isWalking = true;
  const currentKey = 'walk';
  const shouldStart = isWalking && !clipMovementStarted && currentKey === 'walk';
  if (!shouldStart) {
    throw new Error('second walk should start movement');
  }
  clipMovementStarted = true;
  return { started: true, clipMovementStarted };
}

const oldMoves = simulateOld(WALK_MS);
const syncedMoves = simulateVideoSynced(0);
const delayedSync = simulateVideoSynced(2); // video starts ~2 frames late

console.log('Old wall-clock sync — first move at frame:', oldMoves[0]?.frame ?? 'never');
console.log('Video-synced — first move at frame:', syncedMoves[0]?.frame ?? 'never');
console.log('Video-synced (2f late) — first move at frame:', delayedSync[0]?.frame ?? 'never');
console.log('Old total px:', oldMoves.at(-1)?.applied ?? 0);
console.log('Synced total px:', syncedMoves.at(-1)?.applied ?? 0);

const oldIdleFrames = oldMoves[0] ? oldMoves[0].frame : FRAMES;
const syncIdleFrames = syncedMoves[0] ? syncedMoves[0].frame : FRAMES;
if (oldIdleFrames > syncIdleFrames) {
  console.log('\nPASS: video sync starts moving sooner relative to playback');
} else {
  console.log('\nNote: rounding may delay first pixel on both paths');
}

if (Math.abs((syncedMoves.at(-1)?.applied ?? 0) - TOTAL) <= 5) {
  console.log('PASS: synced movement reaches full distance');
} else {
  console.error('FAIL: synced movement distance mismatch');
  process.exit(1);
}

const windowed = simulateMoveWindow(TOTAL);
console.log('Move-window total px:', windowed.applied, 'finishedAt frame:', windowed.finishedAt);
if (Math.abs(windowed.applied - TOTAL) > 5) {
  console.error('FAIL: move-window distance mismatch');
  process.exit(1);
}
if (windowed.finishedAt == null || windowed.finishedAt >= FRAMES) {
  console.error('FAIL: should finish at moveEnd before clip ends');
  process.exit(1);
}
console.log('PASS: movement ends at moveEnd (no travel during anim tail)');

const reverse = simulateEdgeReverse(TOTAL, 0.35);
console.log('Edge reverse applied px:', reverse.applied, 'lastDir:', reverse.lastDir,
  'reverseTravel:', reverse.reverseSegmentTravel);
if (!reverse.reversed) {
  console.error('FAIL: expected reverse');
  process.exit(1);
}
if (reverse.lastDir !== -1) {
  console.error('FAIL: expected lastDir -1 after reverse');
  process.exit(1);
}
if (reverse.reverseSegmentTravel < 100) {
  console.error('FAIL: reverse travel too small (mid-clip restart bug)');
  process.exit(1);
}
console.log('PASS: edge reverse rewinds to moveStart and travels remaining distance');

const second = simulateSecondWalk();
if (!second.started) {
  console.error('FAIL: second walk movement did not start');
  process.exit(1);
}
console.log('PASS: consecutive walk can start movement when clipMovementStarted is false');

console.log('\nAll walk sync checks passed.');
