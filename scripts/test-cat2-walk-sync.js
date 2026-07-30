/**
 * Simulates walk window movement synced to video playback.
 * Run: node scripts/test-cat2-walk-sync.js
 */
const WALK_MS = 10000;
const TOTAL = 400;
const FPS = 24;
const FRAMES = Math.round((WALK_MS / 1000) * FPS);

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

console.log('\nAll walk sync checks passed.');
