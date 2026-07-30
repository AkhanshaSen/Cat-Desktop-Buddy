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
