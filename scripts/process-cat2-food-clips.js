/**
 * Process Cat 2 video clips — crop + encode for canvas chromakey playback.
 * Transparency is handled at runtime in cat2-player.js.
 *
 * Usage: node scripts/process-cat2-food-clips.js
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const OUT_DIR = path.join(__dirname, '..', 'assets', 'clips', 'cat2');

const CLIPS = [
  {
    name: 'idle',
    candidates: [
      path.join(process.env.HOME, 'Downloads', 'awesome_generate_another_sec (2).mp4'),
      path.join(OUT_DIR, 'idle.mp4'),
    ],
    vf: 'scale=480:-2,crop=380:250:85:5',
  },
  {
    name: 'sleep',
    candidates: [
      path.join(process.env.HOME, 'Downloads', 'awesome_generate_another_sec (2).mp4'),
      path.join(OUT_DIR, 'idle.mp4'),
    ],
    vf: 'scale=480:-2,crop=380:250:85:5',
    ss: 3,
  },
  {
    name: 'hungry',
    candidates: [
      path.join(process.env.HOME, 'Downloads', 'awesome_generate_another_sec (1).mp4'),
      path.join(OUT_DIR, 'hungry.mp4'),
    ],
    vf: 'scale=480:-2,crop=380:250:85:5',
  },
  {
    name: 'eat',
    candidates: [
      path.join(process.env.HOME, 'Downloads', 'generate_each_aimation_in_sepa (2).mp4'),
      path.join(OUT_DIR, 'eat.mp4'),
    ],
    vf: 'scale=480:-2,crop=380:250:85:10',
  },
  {
    name: 'walk',
    candidates: [
      path.join(process.env.HOME, 'Downloads', 'generate_sec_clip_walking.mp4'),
      path.join(OUT_DIR, 'walk.mp4'),
    ],
    vf: 'scale=480:-2,crop=380:250:85:5',
  },
  {
    name: 'butterfly',
    candidates: [
      path.join(process.env.HOME, 'Downloads', 'generate_sec_clip_the_ca.mp4'),
      path.join(OUT_DIR, 'butterfly.mp4'),
    ],
    vf: 'scale=480:-2,crop=380:250:85:5',
  },
  {
    name: 'pet',
    candidates: [
      path.join(process.env.HOME, 'Downloads', 'generate_exactly_sec_clip_.mp4'),
      path.join(OUT_DIR, 'pet.mp4'),
    ],
    vf: 'scale=480:-2,crop=380:250:85:5',
  },
];

function findSource(candidates) {
  return candidates.find((p) => fs.existsSync(p));
}

function processClip({ name, candidates, vf, ss = 0 }) {
  const input = findSource(candidates);
  if (!input) {
    console.error(`Missing source for ${name}`);
    return false;
  }
  const out = path.join(OUT_DIR, `${name}.mp4`);
  console.log(`Processing ${name} ← ${input}${ss ? ` (skip ${ss}s)` : ''}`);

  const args = ['-y'];
  if (ss > 0) args.push('-ss', String(ss));
  args.push(
    '-i', input,
    '-vf', vf,
    '-c:v', 'libx264',
    '-pix_fmt', 'yuv420p',
    '-movflags', '+faststart',
    '-an',
    out,
  );

  const result = spawnSync('ffmpeg', args, { encoding: 'utf8' });

  if (result.status !== 0) {
    console.error(result.stderr?.slice(-400));
    return false;
  }
  console.log(`  ✓ ${path.basename(out)}`);
  return true;
}

function main() {
  let ok = 0;
  CLIPS.forEach((clip) => {
    if (processClip(clip)) ok += 1;
  });
  console.log(`\nDone: ${ok}/${CLIPS.length} cropped clips.`);
}

main();
