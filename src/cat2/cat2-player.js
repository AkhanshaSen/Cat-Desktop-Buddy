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
  let rafId = null;

  const LOOP_END_WINDOW = 0.18;
  const TRANSITION_PAUSE_MS = 180;
  const CROSSFADE_MS = 450;

  let transitionTimer = null;
  let crossfadeTimer = null;
  let lastLoopTime = 0;

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

  function renderFrame(video, canvas, ctx, bgMode) {
    if (!video || !canvas || !ctx || video.readyState < 2) return;
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    if (!vw || !vh) return;

    if (canvas.width !== vw || canvas.height !== vh) {
      canvas.width = vw;
      canvas.height = vh;
    }

    ctx.clearRect(0, 0, vw, vh);
    ctx.drawImage(video, 0, 0, vw, vh);

    const frame = ctx.getImageData(0, 0, vw, vh);
    if (bgMode === 'black') {
      keyBlackBackground(frame.data, vw, vh);
    } else {
      keyCheckerboardBackground(frame.data, vw, vh);
    }
    ctx.putImageData(frame, 0, 0);
  }

  function renderVisible() {
    if (canvasA?.classList.contains('cat2-video-visible')) {
      renderFrame(videoA, canvasA, ctxA, Cat2Clips.get(videoA.dataset.clipKey)?.bgMode);
    }
    if (canvasB?.classList.contains('cat2-video-visible')) {
      renderFrame(videoB, canvasB, ctxB, Cat2Clips.get(videoB.dataset.clipKey)?.bgMode);
    }
  }

  function startRenderLoop() {
    if (rafId) return;
    const loop = () => {
      renderVisible();
      checkPendingSwitch();
      checkClipLoop();
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
    ensureOneCanvasVisible();
  }

  function clearTransitionTimer() {
    if (transitionTimer) {
      clearTimeout(transitionTimer);
      transitionTimer = null;
    }
  }

  function dispatchClipVisible(key) {
    window.dispatchEvent(new CustomEvent('cat2:clip-visible', { detail: { key } }));
  }

  function dispatchClipChanged(key) {
    window.dispatchEvent(new CustomEvent('cat2:clip-changed', { detail: { key } }));
  }

  function scheduleTransition(key, opts = {}) {
    clearTransitionTimer();
    const crossfade = opts.crossfade !== false;
    const pauseMs = opts.pauseMs ?? (crossfade ? 0 : TRANSITION_PAUSE_MS);

    const run = () => {
      transitionTimer = null;
      switchClip(key, { crossfade, force: true });
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
  function queueClip(key, { immediate = false, crossfade = true, force = false, pauseMs } = {}) {
    if (!force && currentKey === key && !pendingSwitch && !transitionTimer) return;

    if (immediate) {
      cancelPending();
      scheduleTransition(key, { crossfade, pauseMs });
      return;
    }

    const clip = Cat2Clips.get(currentKey);
    const video = activeVideo();
    if (!clip?.loop || !video?.duration || !Number.isFinite(video.duration)) {
      scheduleTransition(key, { crossfade, pauseMs });
      return;
    }

    pendingSwitch = { key, opts: { crossfade, pauseMs } };

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
  }

  function onVideoEnded(e) {
    const video = e.target;
    if (video !== activeVideo()) return;
    if (oneShotTimer) {
      clearTimeout(oneShotTimer);
      oneShotTimer = null;
    }
    if (currentKey === 'eat' || currentKey === 'walk' || currentKey === 'butterfly' || currentKey === 'pet') {
      window.dispatchEvent(new CustomEvent('cat2:clip-ended', { detail: { key: currentKey } }));
      return;
    }
    syncFromState();
  }

  function setReducedMotion(on) {
    reducedMotion = !!on;
    if (reducedMotion) {
      activeVideo()?.pause();
      renderVisible();
    } else {
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

  function completeCrossfade(currC, nextC, nextV, then) {
    const nextCtx = ctxForCanvas(nextC);
    const bgMode = Cat2Clips.get(nextV.dataset.clipKey)?.bgMode;
    const fadeStart = performance.now();
    const maxWaitMs = 1800;

    const tryFinish = () => {
      renderFrame(nextV, nextC, nextCtx, bgMode);
      const elapsed = performance.now() - fadeStart;
      const fadeDone = elapsed >= CROSSFADE_MS;
      const hasPixels = hasVisiblePixels(nextC, nextCtx);

      if (hasPixels && fadeDone) {
        crossfadeTimer = null;
        setCanvasVisible(currC, false);
        nextC.classList.remove('cat2-crossfade-top');
        then();
        return;
      }

      if (elapsed >= maxWaitMs) {
        crossfadeTimer = null;
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

  function restartActiveClip() {
    const video = activeVideo();
    if (!video || video.readyState < 2) return false;
    if (oneShotTimer) {
      clearTimeout(oneShotTimer);
      oneShotTimer = null;
    }
    video.currentTime = 0;
    lastLoopTime = 0;
    if (!reducedMotion) {
      const playPromise = video.play();
      if (playPromise?.catch) playPromise.catch(() => {});
    }
    renderVisible();
    dispatchClipVisible(currentKey);
    return true;
  }

  function switchClip(key, { crossfade = true, force = false } = {}) {
    if (!videoA || !videoB) return;
    if (!force && currentKey === key) return;

    cancelPending();
    clearCrossfadeTimer();

    if (oneShotTimer) {
      clearTimeout(oneShotTimer);
      oneShotTimer = null;
    }

    currentKey = key;
    const clip = Cat2Clips.get(key);
    const nextV = inactiveVideo();
    const nextC = active === 'a' ? canvasB : canvasA;
    const currC = active === 'a' ? canvasA : canvasB;

    loadInto(nextV, key);

    const announceVisible = () => dispatchClipVisible(key);

    const startNext = () => {
      nextV.currentTime = 0;
      lastLoopTime = 0;

      if (!reducedMotion) {
        const playPromise = nextV.play();
        if (playPromise?.catch) playPromise.catch(() => {});
      }

      if (crossfade) {
        nextC.classList.add('cat2-crossfade-top');
        setCanvasVisible(nextC, true);
        setCanvasVisible(currC, true);
      } else {
        setCanvasVisible(canvasA, nextC === canvasA);
        setCanvasVisible(canvasB, nextC === canvasB);
      }

      active = other(active);
      renderVisible();
      dispatchClipChanged(key);

      if (clip.loop) {
        if (crossfade) {
          completeCrossfade(currC, nextC, nextV, announceVisible);
        } else {
          announceVisible();
        }
      } else {
        let announced = false;
        const finishCrossfade = (then) => {
          if (crossfade) {
            completeCrossfade(currC, nextC, nextV, then);
          } else {
            setCanvasVisible(currC, false);
            nextC.classList.remove('cat2-crossfade-top');
            then();
          }
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
          renderFrame(nextV, nextC, ctxForCanvas(nextC), Cat2Clips.get(nextV.dataset.clipKey)?.bgMode);
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
    };

    if (nextV.readyState >= 2) {
      startNext();
    } else {
      nextV.addEventListener('canplay', startNext, { once: true });
    }
  }

  function playOneShot(animName, durationMs = 600) {
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
    const fromOneShot = currentKey === 'eat' || currentKey === 'walk' || currentKey === 'butterfly' || currentKey === 'pet';
    const immediate = opts.immediate ?? fromOneShot;
    const crossfade = opts.crossfade ?? true;
    const pauseMs = opts.pauseMs ?? 0;

    queueClip(next, {
      immediate,
      crossfade,
      pauseMs,
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

  function bindStateElement(catEl) {
    stateCatEl = catEl;
  }

  return {
    init,
    switchClip,
    queueClip,
    cancelPending,
    getCurrentKey,
    getPlaybackState,
    isTransitioning,
    restartActiveClip,
    playOneShot,
    syncFromState,
    bindStateElement,
    setReducedMotion,
    stopRenderLoop,
  };
})();

window.Cat2Player = Cat2Player;
