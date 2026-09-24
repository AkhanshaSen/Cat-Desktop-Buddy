/**
 * Cat 2 — canvas chromakey player (removes baked-in checkerboard from AI clips).
 */
const Cat2Player = (() => {
  let videoA = null;
  let videoB = null;
  let canvasA = null;
  let canvasB = null;
  let ctxA = null;
  let ctxB = null;
  let active = 'a';
  let currentKey = null;
  let oneShotTimer = null;
  let pendingSwitch = null;
  let stateCatEl = null;
  let reducedMotion = false;
  let soundsEnabled = true;
  /** Volume for meow clip audio (0–1). */
  const CLIP_AUDIO_VOLUME = 0.32;
  let rafId = null;

  const LOOP_END_WINDOW = 0.18;
  const TRANSITION_PAUSE_MS = 180;
  const CROSSFADE_MS = 450;

  let transitionTimer = null;
  let crossfadeTimer = null;
  let lastLoopTime = 0;
  let clipEndedDispatched = null;
  let lastPlaybackTime = -1;
  let playbackStalledAt = 0;
  let transitionWatchStarted = 0;
  let crossfadeWatchStarted = 0;

  const ONE_SHOT_END_EPS = 0.12;
  const PLAYBACK_STALL_MS = 1800;
  const TRANSITION_STUCK_MS = 2800;
  const CROSSFADE_STUCK_MS = 2200;

  /** Fixed output stage (displayed at 175×115 via CSS). */
  const OUTPUT_W = 350;
  const OUTPUT_H = 230;
  const CAT_HEIGHT_RATIO = 0.86;
  const CAT_BOTTOM_PAD_RATIO = 0.05;
  const CAT_MAX_WIDTH_RATIO = 0.94;
  const BOUNDS_ALPHA = 28;
  const BOUNDS_STEP = 3;
  /** HD exports (1280×720 etc.) — scale to cat silhouette, not full frame. */
  const HD_BOUNDS_MIN_W = OUTPUT_W * 1.2;
  const HD_BOUNDS_MIN_H = OUTPUT_H * 1.2;

  let keyCanvas = null;
  let keyCtx = null;
  /** Per-clip draw rect locked on first frame (avoids within-clip jitter). */
  const clipPlacement = {};

  function needsBoundsFit(vw, vh) {
    return vw > HD_BOUNDS_MIN_W || vh > HD_BOUNDS_MIN_H;
  }

  function computePlacement(bounds, clipMeta) {
    const fitYOffset = clipMeta?.fitYOffset ?? 0;
    const destFootX = OUTPUT_W / 2;
    const destFootY = OUTPUT_H - (OUTPUT_H * CAT_BOTTOM_PAD_RATIO) + fitYOffset;
    const maxW = OUTPUT_W * CAT_MAX_WIDTH_RATIO;
    const targetH = OUTPUT_H * CAT_HEIGHT_RATIO;
    const scale = Math.min(targetH / bounds.h, maxW / bounds.w);
    const srcFootX = bounds.x + bounds.w / 2;
    const srcFootY = bounds.y + bounds.h;
    return {
      scale,
      drawX: destFootX - srcFootX * scale,
      drawY: destFootY - srcFootY * scale,
    };
  }

  function getPlacement(clipKey, bounds, clipMeta) {
    if (clipPlacement[clipKey]) return clipPlacement[clipKey];
    const placement = computePlacement(bounds, clipMeta);
    clipPlacement[clipKey] = placement;
    return placement;
  }

  function other(which) {
    return which === 'a' ? 'b' : 'a';
  }

  function activeVideo() {
    return active === 'a' ? videoA : videoB;
  }

  function inactiveVideo() {
    return active === 'a' ? videoB : videoA;
  }

  function activeCanvas() {
    return active === 'a' ? canvasA : canvasB;
  }

  /** Colored pixel-art cat pixels (outline, patches, cream fur — not checkerboard). */
  function isCatColor(r, g, b) {
    if (r + g + b < 100) return true;
    if (r > 140 && g > 70 && b < 90 && r > g + 20) return true;
    if (r < 70 && g < 70 && b < 70) return true;
    if (r > 200 && g > 170 && b < 120) return true;
    if (r > 200 && g < 170 && b > 130) return true;
    if (r - b > 8) return true;
    if (r - g > 4 && b < 248) return true;
    return false;
  }

  function isGrayBackground(r, g, b) {
    if (isCatColor(r, g, b)) return false;
    const min = Math.min(r, g, b);
    const max = Math.max(r, g, b);
    const spread = max - min;
    return spread < 30 && min > 50 && max <= 238 && !(min > 205 && spread < 16);
  }

  function isWhiteBackground(r, g, b) {
    if (isCatColor(r, g, b)) return false;
    const min = Math.min(r, g, b);
    const max = Math.max(r, g, b);
    const spread = max - min;
    return min > 205 && spread < 16;
  }

  function isAnyBackground(r, g, b) {
    return isGrayBackground(r, g, b) || isWhiteBackground(r, g, b);
  }

  /** Looser neutral test for compression-noise speckles left over near keyed edges. */
  function isLooseBackground(r, g, b) {
    if (isCatColor(r, g, b)) return false;
    const min = Math.min(r, g, b);
    const max = Math.max(r, g, b);
    const spread = max - min;
    return spread < 42 && min > 35;
  }

  /** Solid black studio matte (some AI exports use this instead of checkerboard). */
  function isBlackBackground(r, g, b) {
    return r < 22 && g < 22 && b < 22;
  }

  /**
   * Protect the full cat silhouette (solid colors + connected white fur), then key
   * every remaining background-colored pixel directly — no edge-connectivity
   * requirement, so enclosed background pockets (between legs, under the tail)
   * and isolated compression-noise speckles are keyed too, not just exterior checkerboard.
   */
  function keyCheckerboardBackground(d, width, height) {
    const total = width * height;
    const protectedMask = new Uint8Array(total);

    for (let idx = 0; idx < total; idx += 1) {
      const i = idx * 4;
      if (isCatColor(d[i], d[i + 1], d[i + 2])) protectedMask[idx] = 1;
    }

    let changed = true;
    while (changed) {
      changed = false;
      for (let idx = 0; idx < total; idx += 1) {
        if (!protectedMask[idx]) continue;
        const x = idx % width;
        const y = (idx / width) | 0;
        if (x > 0) tryProtect(idx - 1, protectedMask, d, () => { changed = true; });
        if (x < width - 1) tryProtect(idx + 1, protectedMask, d, () => { changed = true; });
        if (y > 0) tryProtect(idx - width, protectedMask, d, () => { changed = true; });
        if (y < height - 1) tryProtect(idx + width, protectedMask, d, () => { changed = true; });
      }
    }

    for (let idx = 0; idx < total; idx += 1) {
      if (protectedMask[idx]) continue;
      const i = idx * 4;
      const r = d[i];
      const g = d[i + 1];
      const b = d[i + 2];
      if (isAnyBackground(r, g, b) || isLooseBackground(r, g, b)) d[i + 3] = 0;
    }
  }

  function tryProtect(idx, protectedMask, d, markChanged) {
    if (protectedMask[idx]) return;
    const i = idx * 4;
    const r = d[i];
    const g = d[i + 1];
    const b = d[i + 2];
    if (isCatColor(r, g, b) || isWhiteBackground(r, g, b)) {
      protectedMask[idx] = 1;
      markChanged();
    }
  }

  /**
   * Black-matte clips: the cat's own outline/eyes are also near-black, so we can't
   * classify by color alone. Instead, flood-fill black connected to the frame edges —
   * isolated black outline strokes fully enclosed by fur are never reached and stay opaque.
   */
  function keyBlackBackground(d, width, height) {
    const total = width * height;
    const keyed = new Uint8Array(total);
    const queue = new Int32Array(total);
    let head = 0;
    let tail = 0;

    function seedPush(idx) {
      if (idx < 0 || idx >= total || keyed[idx]) return;
      const i = idx * 4;
      if (!isBlackBackground(d[i], d[i + 1], d[i + 2])) return;
      keyed[idx] = 1;
      queue[tail++] = idx;
    }

    for (let x = 0; x < width; x += 1) {
      seedPush(x);
      seedPush((height - 1) * width + x);
    }
    for (let y = 0; y < height; y += 1) {
      seedPush(y * width);
      seedPush(y * width + (width - 1));
    }

    while (head < tail) {
      const idx = queue[head++];
      const x = idx % width;
      const y = (idx / width) | 0;
      if (x > 0) seedPush(idx - 1);
      if (x < width - 1) seedPush(idx + 1);
      if (y > 0) seedPush(idx - width);
      if (y < height - 1) seedPush(idx + width);
    }

    for (let idx = 0; idx < total; idx += 1) {
      if (keyed[idx]) d[idx * 4 + 3] = 0;
    }
  }

  function ensureKeyCanvas(w, h) {
    if (!keyCanvas) {
      keyCanvas = document.createElement('canvas');
      keyCtx = keyCanvas.getContext('2d', { willReadFrequently: true });
    }
    if (keyCanvas.width !== w || keyCanvas.height !== h) {
      keyCanvas.width = w;
      keyCanvas.height = h;
    }
    return keyCtx;
  }

  function findOpaqueBounds(data, width, height) {
    let minX = width;
    let minY = height;
    let maxX = -1;
    let maxY = -1;
    const step = BOUNDS_STEP;

    for (let y = 0; y < height; y += step) {
      for (let x = 0; x < width; x += step) {
        const alpha = data[(y * width + x) * 4 + 3];
        if (alpha <= BOUNDS_ALPHA) continue;
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }

    if (maxX < minX || maxY < minY) return null;

    minX = Math.max(0, minX - step);
    minY = Math.max(0, minY - step);
    maxX = Math.min(width - 1, maxX + step);
    maxY = Math.min(height - 1, maxY + step);

    return {
      x: minX,
      y: minY,
      w: maxX - minX + 1,
      h: maxY - minY + 1,
    };
  }

  function renderFrame(video, canvas, ctx, clipMeta) {
    if (!video || !canvas || !ctx || video.readyState < 2) return;
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    if (!vw || !vh) return;

    const keyCtxLocal = ensureKeyCanvas(vw, vh);
    keyCtxLocal.clearRect(0, 0, vw, vh);
    keyCtxLocal.drawImage(video, 0, 0, vw, vh);

    const frame = keyCtxLocal.getImageData(0, 0, vw, vh);
    const bgMode = clipMeta?.bgMode;
    if (bgMode === 'black') {
      keyBlackBackground(frame.data, vw, vh);
    } else {
      keyCheckerboardBackground(frame.data, vw, vh);
    }
    keyCtxLocal.putImageData(frame, 0, 0);

    if (canvas.width !== OUTPUT_W || canvas.height !== OUTPUT_H) {
      canvas.width = OUTPUT_W;
      canvas.height = OUTPUT_H;
    }
    ctx.clearRect(0, 0, OUTPUT_W, OUTPUT_H);

    if (needsBoundsFit(vw, vh)) {
      const bounds = findOpaqueBounds(frame.data, vw, vh);
      if (bounds) {
        const clipKey = video.dataset.clipKey || currentKey || 'idle';
        const placement = getPlacement(clipKey, bounds, clipMeta);
        ctx.drawImage(
          keyCanvas, 0, 0, vw, vh,
          placement.drawX, placement.drawY, vw * placement.scale, vh * placement.scale
        );
        return;
      }
    }

    const scale = Math.min(OUTPUT_W / vw, OUTPUT_H / vh);
    const dw = vw * scale;
    const dh = vh * scale;
    const dx = (OUTPUT_W - dw) / 2;
    const dy = (OUTPUT_H - dh) / 2;
    ctx.drawImage(keyCanvas, 0, 0, vw, vh, dx, dy, dw, dh);
  }

  function renderVisible() {
    const aVis = canvasA?.classList.contains('cat2-video-visible');
    const bVis = canvasB?.classList.contains('cat2-video-visible');
    const crossfading = !!(crossfadeTimer ||
      canvasA?.classList.contains('cat2-crossfade-top') ||
      canvasB?.classList.contains('cat2-crossfade-top'));
    if (aVis && bVis && !crossfading) settleSingleCanvas();

    if (canvasA?.classList.contains('cat2-video-visible')) {
      renderFrame(videoA, canvasA, ctxA, Cat2Clips.get(videoA.dataset.clipKey));
    }
    if (canvasB?.classList.contains('cat2-video-visible')) {
      renderFrame(videoB, canvasB, ctxB, Cat2Clips.get(videoB.dataset.clipKey));
    }
  }

  function dispatchClipEnded(key) {
    if (clipEndedDispatched === key) return;
    clipEndedDispatched = key;
    muteAllVideos();
    window.dispatchEvent(new CustomEvent('cat2:clip-ended', { detail: { key } }));
  }

  function checkOneShotEnded() {
    const video = activeVideo();
    if (!video || video.readyState < 2) return;
    const clip = Cat2Clips.get(currentKey);
    if (clip?.loop) return;
    const dur = video.duration;
    if (!dur || !Number.isFinite(dur)) return;
    if (video.ended || video.currentTime >= dur - ONE_SHOT_END_EPS) {
      dispatchClipEnded(currentKey);
    }
  }

  function ensurePlayback() {
    if (reducedMotion) return;
    const video = activeVideo();
    if (!video || video.readyState < 2) return;

    ensureOneCanvasVisible();

    const clip = Cat2Clips.get(currentKey);
    const dur = video.duration;
    const atEnd = !clip?.loop && dur && Number.isFinite(dur) &&
      (video.ended || video.currentTime >= dur - ONE_SHOT_END_EPS);
    if (atEnd) return;

    if (video.paused) {
      applyAudioForClip(video, currentKey);
      video.play().catch(() => {});
      return;
    }

    const t = video.currentTime;
    const now = performance.now();
    if (Math.abs(t - lastPlaybackTime) < 0.001) {
      if (!playbackStalledAt) playbackStalledAt = now;
      else if (now - playbackStalledAt >= PLAYBACK_STALL_MS) {
        playbackStalledAt = now;
        if (t > 0.05) video.currentTime = Math.max(0, t - 0.04);
        video.play().catch(() => {});
      }
    } else {
      lastPlaybackTime = t;
      playbackStalledAt = 0;
    }
  }

  function checkStuckTransition() {
    const now = performance.now();
    if (transitionTimer && transitionWatchStarted &&
        now - transitionWatchStarted >= TRANSITION_STUCK_MS) {
      clearTransitionTimer();
      transitionWatchStarted = 0;
      if (pendingSwitch) flushPendingSwitch();
      else {
        settleSingleCanvas();
        ensurePlayback();
      }
    }
    if (crossfadeTimer && crossfadeWatchStarted &&
        now - crossfadeWatchStarted >= CROSSFADE_STUCK_MS) {
      clearCrossfadeTimer();
      crossfadeWatchStarted = 0;
      settleSingleCanvas();
      ensurePlayback();
    }
  }

  function forceRecover() {
    cancelPending();
    clearCrossfadeTimer();
    transitionWatchStarted = 0;
    crossfadeWatchStarted = 0;
    clipEndedDispatched = null;
    lastPlaybackTime = -1;
    playbackStalledAt = 0;
    settleSingleCanvas();
    ensureOneCanvasVisible();
    ensurePlayback();
    renderVisible();
  }

  function startRenderLoop() {
    if (rafId) return;
    const loop = () => {
      renderVisible();
      checkPendingSwitch();
      checkClipLoop();
      checkOneShotEnded();
      ensurePlayback();
      checkStuckTransition();
      rafId = requestAnimationFrame(loop);
    };
    rafId = requestAnimationFrame(loop);
  }

  function stopRenderLoop() {
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  }

  function clearCrossfadeTimer() {
    if (crossfadeTimer) {
      clearTimeout(crossfadeTimer);
      crossfadeTimer = null;
    }
    crossfadeWatchStarted = 0;
    settleSingleCanvas();
    ensureOneCanvasVisible();
  }

  function clearTransitionTimer() {
    if (transitionTimer) {
      clearTimeout(transitionTimer);
      transitionTimer = null;
    }
    transitionWatchStarted = 0;
  }

  function dispatchClipVisible(key) {
    window.dispatchEvent(new CustomEvent('cat2:clip-visible', { detail: { key } }));
  }

  function dispatchClipChanged(key) {
    window.dispatchEvent(new CustomEvent('cat2:clip-changed', { detail: { key } }));
  }

  function scheduleTransition(key, opts = {}) {
    clearTransitionTimer();
    transitionWatchStarted = performance.now();
    const crossfade = opts.crossfade !== false;
    const pauseMs = opts.pauseMs ?? 0;

    const run = () => {
      transitionTimer = null;
      transitionWatchStarted = 0;
      switchClip(key, { crossfade, force: true, crossfadeMs: opts.crossfadeMs });
    };

    if (pauseMs <= 0) {
      run();
      return;
    }

    const video = activeVideo();
    if (video && !video.paused && video.readyState >= 2 && !crossfade) {
      video.pause();
    }

    transitionTimer = setTimeout(run, pauseMs);
  }

  function checkClipLoop() {
    const video = activeVideo();
    if (!video || video.readyState < 2) return;
    const clip = Cat2Clips.get(currentKey);
    if (!clip?.loop) return;

    const t = video.currentTime;
    if (t < 0.12 && lastLoopTime > 0.4) {
      window.dispatchEvent(new CustomEvent('cat2:clip-loop', { detail: { key: currentKey } }));
    }
    lastLoopTime = t;
  }

  function checkPendingSwitch() {
    if (!pendingSwitch || transitionTimer) return;
    const video = activeVideo();
    if (!video || video.readyState < 2) return;

    const clip = Cat2Clips.get(currentKey);
    const dur = video.duration;
    if (!clip?.loop || !dur || !Number.isFinite(dur)) return;

    if (video.currentTime >= dur - LOOP_END_WINDOW) {
      const pending = pendingSwitch;
      pendingSwitch = null;
      scheduleTransition(pending.key, pending.opts);
    }
  }

  function flushPendingSwitch() {
    if (!pendingSwitch) return;
    const pending = pendingSwitch;
    pendingSwitch = null;
    scheduleTransition(pending.key, pending.opts);
  }

  function cancelPending() {
    pendingSwitch = null;
    clearTransitionTimer();
    clearCrossfadeTimer();
    settleSingleCanvas();
  }

  function getCurrentKey() {
    return currentKey;
  }

  function isTransitioning() {
    return !!(pendingSwitch || transitionTimer || crossfadeTimer);
  }

  /**
   * Queue a clip change at the next loop boundary, or crossfade immediately.
   */
  function queueClip(key, { immediate = false, crossfade = true, force = false, pauseMs, crossfadeMs } = {}) {
    if (currentKey === key && !pendingSwitch && !transitionTimer && !crossfadeTimer) return;

    if (immediate) {
      cancelPending();
      scheduleTransition(key, { crossfade, pauseMs, crossfadeMs });
      return;
    }

    const clip = Cat2Clips.get(currentKey);
    const video = activeVideo();
    if (!clip?.loop || !video?.duration || !Number.isFinite(video.duration)) {
      scheduleTransition(key, { crossfade, pauseMs, crossfadeMs });
      return;
    }

    pendingSwitch = { key, opts: { crossfade, pauseMs, crossfadeMs } };

    if (video.currentTime >= video.duration - LOOP_END_WINDOW) {
      flushPendingSwitch();
    }
  }

  function init(videoElA, videoElB, canvasElA, canvasElB, catEl) {
    videoA = videoElA;
    videoB = videoElB;
    canvasA = canvasElA;
    canvasB = canvasElB;
    ctxA = canvasA.getContext('2d', { willReadFrequently: true });
    ctxB = canvasB.getContext('2d', { willReadFrequently: true });
    stateCatEl = catEl;

    [videoA, videoB].forEach((v) => {
      v.muted = true;
      v.playsInline = true;
      v.setAttribute('playsinline', '');
      v.setAttribute('webkit-playsinline', '');
      v.classList.remove('cat2-video-visible');
      v.addEventListener('ended', onVideoEnded);
    });

    canvasA.classList.add('cat2-video-visible');
    startRenderLoop();
    switchClip(Cat2Clips.forState(catEl?.dataset || {}), { crossfade: false });

    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) forceRecover();
    });
  }

  function onVideoEnded(e) {
    const video = e.target;
    if (video !== activeVideo()) return;
    if (oneShotTimer) {
      clearTimeout(oneShotTimer);
      oneShotTimer = null;
    }
    const key = currentKey;
    const clip = Cat2Clips.get(key);
    if (!clip?.loop) {
      dispatchClipEnded(key);
      return;
    }
    muteAllVideos();
    syncFromState();
  }

  function shouldPlayClipAudio(key) {
    const clip = Cat2Clips.get(key);
    return !!(clip?.hasAudio && soundsEnabled && !reducedMotion);
  }

  function applyAudioForClip(video, key) {
    if (!video) return;
    const audible = shouldPlayClipAudio(key);
    video.muted = !audible;
    video.volume = audible ? CLIP_AUDIO_VOLUME : 0;
  }

  function muteAllVideos() {
    [videoA, videoB].forEach((v) => {
      if (v) {
        v.muted = true;
        v.volume = 0;
      }
    });
  }

  function syncActiveAudio() {
    muteAllVideos();
    applyAudioForClip(activeVideo(), currentKey);
  }

  function setSoundsEnabled(on) {
    soundsEnabled = !!on;
    syncActiveAudio();
  }

  function setReducedMotion(on) {
    reducedMotion = !!on;
    if (reducedMotion) {
      muteAllVideos();
      activeVideo()?.pause();
      renderVisible();
    } else {
      syncActiveAudio();
      activeVideo()?.play().catch(() => {});
    }
  }

  function loadInto(video, key) {
    const clip = Cat2Clips.get(key);
    const src = clip.version ? `${clip.src}?v=${clip.version}` : clip.src;
    if (video.dataset.clipKey === key && video.dataset.clipSrc === src) return clip;
    video.dataset.clipKey = key;
    video.dataset.clipSrc = src;
    video.src = src;
    video.loop = !!clip.loop;
    video.muted = true;
    video.volume = 0;
    video.load();
    return clip;
  }

  function setCanvasVisible(canvas, visible) {
    canvas?.classList.toggle('cat2-video-visible', visible);
  }

  function ctxForCanvas(canvas) {
    if (canvas === canvasA) return ctxA;
    if (canvas === canvasB) return ctxB;
    return null;
  }

  function videoForCanvas(canvas) {
    if (canvas === canvasA) return videoA;
    if (canvas === canvasB) return videoB;
    return null;
  }

  function hasVisiblePixels(canvas, ctx) {
    if (!canvas || !ctx || !canvas.width || !canvas.height) return false;
    const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const step = Math.max(4, ((width * height) / 400) | 0) * 4;
    for (let i = 3; i < data.length; i += step) {
      if (data[i] > 24) return true;
    }
    return false;
  }

  function ensureOneCanvasVisible() {
    const aVis = canvasA?.classList.contains('cat2-video-visible');
    const bVis = canvasB?.classList.contains('cat2-video-visible');
    if (!aVis && !bVis) setCanvasVisible(activeCanvas(), true);
  }

  /** Hide the inactive buffer so two clips never stack on screen. */
  function settleSingleCanvas() {
    const keep = activeCanvas();
    const drop = active === 'a' ? canvasB : canvasA;
    setCanvasVisible(drop, false);
    setCanvasVisible(keep, true);
    canvasA?.classList.remove('cat2-crossfade-top');
    canvasB?.classList.remove('cat2-crossfade-top');
  }

  function completeCrossfade(currC, nextC, nextV, then, fadeMs = CROSSFADE_MS) {
    crossfadeWatchStarted = performance.now();
    const nextCtx = ctxForCanvas(nextC);
    const nextClip = Cat2Clips.get(nextV.dataset.clipKey);
    const fadeStart = performance.now();
    const maxWaitMs = fadeMs + 700;

    const tryFinish = () => {
      renderFrame(nextV, nextC, nextCtx, nextClip);
      const elapsed = performance.now() - fadeStart;
      const fadeDone = elapsed >= fadeMs;
      const hasPixels = hasVisiblePixels(nextC, nextCtx);

      if (hasPixels && fadeDone) {
        crossfadeTimer = null;
        crossfadeWatchStarted = 0;
        setCanvasVisible(currC, false);
        nextC.classList.remove('cat2-crossfade-top');
        then();
        return;
      }

      if (elapsed >= maxWaitMs) {
        crossfadeTimer = null;
        crossfadeWatchStarted = 0;
        if (hasPixels) {
          setCanvasVisible(currC, false);
          nextC.classList.remove('cat2-crossfade-top');
        } else {
          setCanvasVisible(nextC, false);
          nextC.classList.remove('cat2-crossfade-top');
          active = currC === canvasA ? 'a' : 'b';
          const kept = videoForCanvas(currC);
          if (kept?.dataset?.clipKey) currentKey = kept.dataset.clipKey;
          ensureOneCanvasVisible();
        }
        then();
        return;
      }

      crossfadeTimer = setTimeout(tryFinish, 24);
    };

    tryFinish();
  }

  function waitForVisibleFrame(video, canvas, then, maxWaitMs = 400) {
    const ctx = ctxForCanvas(canvas);
    const clipMeta = Cat2Clips.get(video.dataset.clipKey);
    const start = performance.now();
    const tick = () => {
      renderFrame(video, canvas, ctx, clipMeta);
      if (hasVisiblePixels(canvas, ctx) || performance.now() - start >= maxWaitMs) {
        then();
        return;
      }
      setTimeout(tick, 24);
    };
    tick();
  }

  function restartActiveClip() {
    cancelPending();
    clearCrossfadeTimer();
    const video = activeVideo();
    if (!video || video.readyState < 2) return false;
    if (oneShotTimer) {
      clearTimeout(oneShotTimer);
      oneShotTimer = null;
    }
    video.currentTime = 0;
    lastLoopTime = 0;
    clipEndedDispatched = null;
    lastPlaybackTime = -1;
    playbackStalledAt = 0;
    if (!reducedMotion) {
      applyAudioForClip(video, currentKey);
      const playPromise = video.play();
      if (playPromise?.catch) playPromise.catch(() => {});
    } else {
      applyAudioForClip(video, currentKey);
    }
    renderVisible();
    settleSingleCanvas();
    dispatchClipVisible(currentKey);
    return true;
  }

  function preloadClip(key) {
    if (!videoA || !videoB) return;
    loadInto(inactiveVideo(), key);
  }

  function switchClip(key, { crossfade = true, force = false, crossfadeMs } = {}) {
    const fadeMs = crossfadeMs ?? CROSSFADE_MS;
    if (!videoA || !videoB) return;
    if (currentKey === key) {
      if (!force) return;
      restartActiveClip();
      return;
    }

    cancelPending();
    clearCrossfadeTimer();

    if (oneShotTimer) {
      clearTimeout(oneShotTimer);
      oneShotTimer = null;
    }

    if (currentKey !== key) clipEndedDispatched = null;
    currentKey = key;
    const clip = Cat2Clips.get(key);
    const nextV = inactiveVideo();
    const nextC = active === 'a' ? canvasB : canvasA;
    const currC = active === 'a' ? canvasA : canvasB;

    loadInto(nextV, key);

    const announceVisible = () => {
      const key = nextV.dataset.clipKey;
      if (key === 'walk' || key === 'butterfly') {
        nextV.currentTime = 0;
        lastLoopTime = 0;
        if (!reducedMotion) {
          const playPromise = nextV.play();
          if (playPromise?.catch) playPromise.catch(() => {});
        }
        renderFrame(nextV, nextC, ctxForCanvas(nextC), Cat2Clips.get(key));
      }
      dispatchClipVisible(key);
    };

    const startNext = () => {
      nextV.currentTime = 0;
      lastLoopTime = 0;
      applyAudioForClip(nextV, key);
      if (videoA && videoB) {
        const otherV = nextV === videoA ? videoB : videoA;
        otherV.muted = true;
        otherV.volume = 0;
      }

      if (!reducedMotion) {
        const playPromise = nextV.play();
        if (playPromise?.catch) playPromise.catch(() => {});
      }

      if (crossfade) {
        nextC.classList.add('cat2-crossfade-top');
        setCanvasVisible(nextC, true);
        setCanvasVisible(currC, true);
      } else {
        setCanvasVisible(currC, false);
        setCanvasVisible(nextC, true);
        canvasA?.classList.remove('cat2-crossfade-top');
        canvasB?.classList.remove('cat2-crossfade-top');
      }

      active = other(active);
      if (!crossfade) settleSingleCanvas();
      renderVisible();
      dispatchClipChanged(key);

      if (clip.loop) {
        if (crossfade) {
          const nextCtx = ctxForCanvas(nextC);
          const nextClip = Cat2Clips.get(nextV.dataset.clipKey);
          renderFrame(nextV, nextC, nextCtx, nextClip);
          if (hasVisiblePixels(nextC, nextCtx)) {
            completeCrossfade(currC, nextC, nextV, announceVisible, fadeMs);
          } else {
            waitForVisibleFrame(nextV, nextC, () => {
              completeCrossfade(currC, nextC, nextV, announceVisible, fadeMs);
            });
          }
        } else {
          announceVisible();
        }
      } else {
        if (!crossfade) {
          announceVisible();
        } else {
          let announced = false;
          const finishCrossfade = (then) => {
            completeCrossfade(currC, nextC, nextV, then, fadeMs);
          };
          const forceFinish = () => {
            if (announced) return;
            announced = true;
            nextV.removeEventListener('timeupdate', onTime);
            nextV.removeEventListener('playing', onPlaying);
            clearTimeout(fallbackTimer);
            finishCrossfade(announceVisible);
          };
          const fire = () => {
            if (announced) return;
            if (nextV.readyState < 2 || nextV.currentTime <= 0) return;
            renderFrame(nextV, nextC, ctxForCanvas(nextC), Cat2Clips.get(nextV.dataset.clipKey));
            if (!hasVisiblePixels(nextC, ctxForCanvas(nextC))) return;
            forceFinish();
          };
          const onTime = () => fire();
          const onPlaying = () => fire();
          const fallbackTimer = setTimeout(forceFinish, 900);
          nextV.addEventListener('playing', onPlaying, { once: true });
          nextV.addEventListener('timeupdate', onTime);
          if (!nextV.paused && nextV.currentTime > 0) fire();
        }
      }
    };

    if (nextV.readyState >= 2) {
      startNext();
    } else {
      nextV.addEventListener('canplay', startNext, { once: true });
    }
  }

  function playOneShot(animName, durationMs = 600) {
    if (!soundsEnabled && Cat2Clips.animationFor(animName) === 'meow') {
      return;
    }
    const key = Cat2Clips.animationFor(animName);
    switchClip(key, { crossfade: true });

    if (oneShotTimer) clearTimeout(oneShotTimer);
    oneShotTimer = setTimeout(() => {
      oneShotTimer = null;
      syncFromState();
    }, durationMs || 800);
  }

  function syncFromState(opts = {}) {
    if (!stateCatEl) return;
    const next = Cat2Clips.forState(stateCatEl.dataset);
    const fromOneShot = currentKey === 'eat' || currentKey === 'walk' || currentKey === 'butterfly' || currentKey === 'pet' || currentKey === 'meow' || currentKey === 'roll' || currentKey === 'groom' || currentKey === 'earpurr' || currentKey === 'grumpy' || currentKey === 'woolball' || currentKey === 'jump' || currentKey === 'scratch';
    const immediate = opts.immediate ?? fromOneShot;
    const crossfade = opts.crossfade ?? !immediate;
    const pauseMs = opts.pauseMs ?? 0;

    queueClip(next, {
      immediate,
      crossfade,
      pauseMs,
      crossfadeMs: opts.crossfadeMs,
      force: opts.force ?? immediate,
    });
  }

  function getPlaybackState() {
    const video = activeVideo();
    if (!video || video.readyState < 2) return null;
    const duration = video.duration;
    if (!duration || !Number.isFinite(duration)) return null;
    return {
      key: currentKey,
      currentTime: video.currentTime,
      duration,
      paused: video.paused,
    };
  }

  /** Seek active clip to a 0–1 progress fraction (used for walk edge reverse). */
  function seekActiveClip(progress) {
    const video = activeVideo();
    if (!video || video.readyState < 2) return false;
    const duration = video.duration;
    if (!duration || !Number.isFinite(duration)) return false;
    const p = Math.max(0, Math.min(0.98, Number(progress) || 0));
    clipEndedDispatched = null;
    lastPlaybackTime = -1;
    playbackStalledAt = 0;
    video.currentTime = p * duration;
    if (!reducedMotion && video.paused) {
      const playPromise = video.play();
      if (playPromise?.catch) playPromise.catch(() => {});
    }
    renderVisible();
    return true;
  }

  function bindStateElement(catEl) {
    stateCatEl = catEl;
  }

  return {
    init,
    switchClip,
    queueClip,
    cancelPending,
    preloadClip,
    getCurrentKey,
    getPlaybackState,
    seekActiveClip,
    isTransitioning,
    restartActiveClip,
    playOneShot,
    syncFromState,
    bindStateElement,
    setReducedMotion,
    setSoundsEnabled,
    areSoundsEnabled: () => soundsEnabled,
    stopRenderLoop,
    forceRecover,
  };
})();

window.Cat2Player = Cat2Player;
