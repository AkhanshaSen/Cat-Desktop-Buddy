/**
 * Generate placeholder transparent WebM clips for Cat 2 development.
 * Replace files in assets/cat2/ with your own 10–20s cat clips.
 *
 * Usage: node scripts/generate-cat2-placeholders.js
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const OUT_DIR = path.join(__dirname, '..', 'assets', 'cat2');

const CLIPS = [
  { name: 'idle', duration: 15 },
  { name: 'sleep', duration: 15 },
  { name: 'eat', duration: 12 },
  { name: 'love', duration: 12 },
  { name: 'excited', duration: 12 },
  { name: 'thinking', duration: 15 },
  { name: 'sad', duration: 12 },
  { name: 'sleepy', duration: 12 },
  { name: 'walk', duration: 14 },
  { name: 'laptop', duration: 16 },
  { name: 'read', duration: 16 },
  { name: 'phone', duration: 14 },
  { name: 'coffee', duration: 14 },
  { name: 'notebook', duration: 16 },
  { name: 'game', duration: 14 },
  { name: 'react', duration: 3 },
  { name: 'bounce', duration: 2 },
  { name: 'wiggle', duration: 2 },
  { name: 'stretch', duration: 3 },
  { name: 'purr', duration: 3 },
  { name: 'yawn', duration: 3 },
  { name: 'alert', duration: 2 },
  { name: 'hop', duration: 2 },
];

function runFfmpeg(name, duration) {
  const out = path.join(OUT_DIR, `${name}.webm`);
  const vf = [
    'format=yuva420p',
    'drawbox=x=20:y=40:w=80:h=70:color=0xC8A0FF@0.55:t=fill',
    'drawbox=x=35:y=20:w=50:h=35:color=0xC8A0FF@0.55:t=fill',
  ].join(',');

  const args = [
    '-y',
    '-f', 'lavfi',
    '-i', `color=c=0x00000000:s=120x128:d=${duration}`,
    '-vf', vf,
    '-c:v', 'libvpx-vp9',
    '-pix_fmt', 'yuva420p',
    '-an',
    out,
  ];

  const result = spawnSync('ffmpeg', args, { stdio: 'pipe', encoding: 'utf8' });
  if (result.status !== 0) {
    console.error(`Failed ${name}:`, result.stderr?.slice(-300));
    return false;
  }
  console.log(`  ✓ ${name}.webm (${duration}s)`);
  return true;
}

function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  console.log('Generating Cat 2 placeholder clips →', OUT_DIR);
  let ok = 0;
  CLIPS.forEach(({ name, duration }) => {
    if (runFfmpeg(name, duration)) ok += 1;
  });
  console.log(`\nDone: ${ok}/${CLIPS.length} clips. Swap in your transparent cat videos when ready.`);
}

main();
