/**
 * Cat 2 — video clip manifest (idle → hungry → eat → idle).
 */
const Cat2Clips = (() => {
  const BASE = '../assets/clips/cat2';

  const DEFAULT_CLIP = 'idle';

  const CLIPS = {
    idle: {
      src: `${BASE}/idle.mp4`,
      loop: true,
      durationSec: 10,
      version: 2,
      bgMode: 'black',
      label: 'Idle',
    },
    sleep: {
      src: `${BASE}/sleep.mp4`,
      loop: true,
      durationSec: 7,
      version: 1,
      bgMode: 'black',
      label: 'Sleeping',
    },
    hungry: {
      src: `${BASE}/hungry.mp4`,
      loop: true,
      durationSec: 10,
      version: 2,
      bgMode: 'black',
      label: 'Begging for food',
    },
    eat: {
      src: `${BASE}/eat.mp4`,
      loop: false,
      durationSec: 10,
      version: 2,
      bgMode: 'black',
      label: 'Eating',
    },
    walk: {
      src: `${BASE}/walk.mp4`,
      loop: false,
      durationSec: 10,
      version: 1,
      bgMode: 'black',
      label: 'Walking',
    },
    butterfly: {
      src: `${BASE}/butterfly.mp4`,
      loop: false,
      durationSec: 10,
      version: 1,
      bgMode: 'black',
      label: 'Chasing butterfly',
    },
    pet: {
      src: `${BASE}/pet.mp4`,
      loop: false,
      durationSec: 4,
      version: 1,
      bgMode: 'black',
      label: 'Head petted / purr',
    },
  };

  function get(name) {
    return CLIPS[name] || CLIPS[DEFAULT_CLIP];
  }

  function animationFor() {
    return DEFAULT_CLIP;
  }

  function forState(dataset) {
    if (dataset.begging === 'true') return 'hungry';
    if (dataset.pose === 'eat') return 'eat';
    if (dataset.walking === 'true') return 'walk';
    if (dataset.playing === 'butterfly') return 'butterfly';
    if (dataset.playing === 'pet') return 'pet';
    if (dataset.pose === 'sleep' || dataset.sleeping === 'true') return 'sleep';
    return DEFAULT_CLIP;
  }

  function allNames() {
    return Object.keys(CLIPS);
  }

  function getDurationMs(name) {
    const clip = get(name);
    return (clip.durationSec || 10) * 1000;
  }

  return { get, getDurationMs, animationFor, forState, allNames, CLIPS, DEFAULT_CLIP };
})();

window.Cat2Clips = Cat2Clips;
