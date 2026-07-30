# Cat 2 clips

Drop processed **MP4** clips here. Transparency is handled at runtime via canvas chromakey in `src/cat2/cat2-player.js`.

## Active clips

| File | Used for |
|------|----------|
| `idle.mp4` | Default idle / loaf (loop) |
| `hungry.mp4` | Begging for food (loop) |
| `eat.mp4` | Eating (one-shot) |
| `walk.mp4` | Window patrol (one-shot) |
| `butterfly.mp4` | Chasing butterfly (one-shot) |
| `pet.mp4` | Head petted (one-shot) |
| `meow.mp4` | Idle meowing with audio (one-shot, ~10s) |
| `roll.mp4` | Rolling on back cutely, silent (one-shot, ~5s) |
| `groom.mp4` | Scratching and grooming, silent (one-shot, ~5s) |
| `earpurr.mp4` | Purring and scratching ears, silent (one-shot, ~5s) |
| `grumpy.mp4` | Grumpy at human, silent (one-shot, ~5s) |
| `woolball.mp4` | Playing with wool ball, silent (one-shot, ~10s) |
| `jump.mp4` | Playful jumping, silent (one-shot, ~10s) |
| `scratch.mp4` | Scratching furniture, silent (one-shot, ~10s) |
| `sleep.mp4` | Sleeping — first 3s trimmed from source (loop) |

## Process from source videos

```bash
node scripts/process-cat2-food-clips.js
```

Sources are read from `~/Downloads/` when present, otherwise existing files in this folder.

## Launch

```bash
npm run start:cat2
```
