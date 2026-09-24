/**
 * Cat 2 sleep and walk — nap clips, patrol walk, decline-food walk→sleep.
 */
(() => {
  'use strict';

  function create(ctx) {
    const { catEl, CLIP_FLOW_MODE, feedState } = ctx;
    const Walk = () => window.MeowWalkPlacement;

    function pickHorizontalDirection(placement) {
      const helper = Walk();
      if (helper) return helper.pickHorizontalDirection(placement, ctx.lastWalkDir);
      if (placement?.nearRight && !placement?.nearLeft) return -1;
      if (placement?.nearLeft && !placement?.nearRight) return 1;
      if (ctx.lastWalkDir) return -ctx.lastWalkDir;
      return Math.random() < 0.5 ? -1 : 1;
    }

    function walkDistanceFallback() {
      return 380 + Math.random() * 140;
    }

    function maxHorizontalDistance(dir, placement) {
      const helper = Walk();
      if (helper) {
        return helper.maxHorizontalDistance(dir, placement, {
          fallback: walkDistanceFallback(),
        });
      }
      const fallback = walkDistanceFallback();
      if (!placement?.workArea) return fallback;
      const margin = 20;
      const { x, width, workArea } = placement;
      const room = dir > 0
        ? workArea.x + workArea.width - (x + width) - margin
        : x - workArea.x - margin;
      if (room <= 40) return 0;
      return Math.min(fallback, room);
    }

    function applyWalkFacing(dir) {
      catEl.classList.remove('walking-left', 'walking-right');
      catEl.classList.add(dir === -1 ? 'walking-left' : 'walking-right');
    }

    function stopClipMovement() {
      ctx.clipMovementStarted = false;
      ctx.clipMovementKey = null;
      ctx.clipMovementDir = null;
      if (ctx.clipMoveRaf) {
        cancelAnimationFrame(ctx.clipMoveRaf);
        ctx.clipMoveRaf = null;
      }
    }

    function stopWalkMovement() {
      stopClipMovement();
      ctx.walkReversedOnce = false;
    }

    function startSyncedClipMovement(clipKey, dir, opts = {}) {
      if (ctx.clipMovementStarted) return;
      const clip = Cat2Clips.get(clipKey);
      const moveStart = opts.moveStart ?? clip.moveStart ?? 0;
      const moveEnd = opts.moveEnd ?? clip.moveEnd ?? 1;
      const distance = opts.totalDistance ?? (400 + Math.random() * 160);
      if (distance <= 0) return;

      const allowReverse = !!opts.allowReverse;
      ctx.clipMovementStarted = true;
      ctx.clipMovementKey = clipKey;
      ctx.clipMovementDir = dir;
      let appliedPx = 0;
      let lastEdgeCheckAt = 0;
      let reversing = false;

      const tick = () => {
        if (!ctx.clipMovementStarted || ctx.clipMovementKey !== clipKey) {
          stopClipMovement();
          return;
        }

        const playback = Cat2Player.getPlaybackState?.();
        if (!playback || playback.key !== clipKey || playback.paused) {
          ctx.clipMoveRaf = requestAnimationFrame(tick);
          return;
        }

        const rawProgress = playback.currentTime / playback.duration;
        if (rawProgress >= moveEnd) {
          // End walk when movement window ends — avoid "walking in place" anim tail
          stopClipMovement();
          if (clipKey === 'walk' && ctx.isWalking) {
            if (ctx.walkTimeout) { clearTimeout(ctx.walkTimeout); ctx.walkTimeout = null; }
            finishWalk();
          }
          return;
        }
        if (rawProgress < moveStart) {
          ctx.clipMoveRaf = requestAnimationFrame(tick);
          return;
        }

        const now = Date.now();
        if (allowReverse && !ctx.walkReversedOnce && !reversing && now - lastEdgeCheckAt > 250) {
          lastEdgeCheckAt = now;
          const helper = Walk();
          window.meowAPI?.getWindowPlacement?.().then((placement) => {
            if (!placement || !helper) return;
            if (!ctx.clipMovementStarted || ctx.clipMovementKey !== clipKey) return;
            if (ctx.walkReversedOnce || reversing) return;
            const currentDir = ctx.clipMovementDir;
            if (!helper.isBlockedHorizontally(placement, currentDir)) return;

            reversing = true;
            ctx.walkReversedOnce = true;
            const remaining = Math.max(120, distance - Math.abs(appliedPx));
            const nextDir = helper.flipDirection(currentDir);
            stopClipMovement();
            ctx.lastWalkDir = nextDir;
            applyWalkFacing(nextDir);
            ctx.walkPlacement = placement;
            // Rewind to full move window so reverse travel still syncs to the clip
            const clipMoveStart = clip.moveStart ?? 0;
            Cat2Player.seekActiveClip?.(clipMoveStart);
            startSyncedClipMovement(clipKey, nextDir, {
              totalDistance: remaining,
              allowReverse: false,
              moveStart: clipMoveStart,
              moveEnd: clip.moveEnd ?? moveEnd,
            });
          }).catch(() => {});
        }

        if (reversing || !ctx.clipMovementStarted || ctx.clipMovementKey !== clipKey) {
          return;
        }

        const progress = Math.min(1, (rawProgress - moveStart) / (moveEnd - moveStart));
        const targetPx = progress * distance * dir;
        const rawDelta = targetPx - appliedPx;
        if (Math.abs(rawDelta) >= 0.5) {
          const step = Math.round(rawDelta);
          appliedPx += step;
          window.meowAPI?.dragWindow(step, 0);
        }

        if (ctx.clipMovementStarted && ctx.clipMovementKey === clipKey && !reversing) {
          ctx.clipMoveRaf = requestAnimationFrame(tick);
        }
      };

      ctx.clipMoveRaf = requestAnimationFrame(tick);
    }

    function startWalkMovement(dir) {
      let walkDir = dir;
      let distance = maxHorizontalDistance(walkDir, ctx.walkPlacement);
      if (distance <= 0) {
        walkDir = Walk()?.flipDirection(walkDir) ?? -walkDir;
        applyWalkFacing(walkDir);
        ctx.lastWalkDir = walkDir;
        distance = maxHorizontalDistance(walkDir, ctx.walkPlacement);
      }
      if (distance <= 0) return;
      ctx.walkReversedOnce = false;
      startSyncedClipMovement('walk', walkDir, {
        totalDistance: distance,
        allowReverse: true,
      });
    }

    function startButterflyMovement(dir) {
      let flyDir = dir;
      let distance = maxHorizontalDistance(flyDir, ctx.butterflyPlacement);
      if (distance <= 0) {
        flyDir = Walk()?.flipDirection(flyDir) ?? -flyDir;
        applyWalkFacing(flyDir);
        distance = maxHorizontalDistance(flyDir, ctx.butterflyPlacement);
      }
      startSyncedClipMovement('butterfly', flyDir, {
        totalDistance: distance > 0 ? distance : 160,
        allowReverse: false,
      });
    }

    function detachWalkEndedListener() {
      if (!ctx.walkEndedListener) return;
      window.removeEventListener('cat2:clip-ended', ctx.walkEndedListener);
      ctx.walkEndedListener = null;
    }

    function stopWalk({ skipSync = false } = {}) {
      if (ctx.walkTimeout) { clearTimeout(ctx.walkTimeout); ctx.walkTimeout = null; }
      ctx.clearActivityWatchdog();
      stopWalkMovement();
      detachWalkEndedListener();
      ctx.isWalking = false;
      catEl.dataset.walking = '';
      catEl.classList.remove('walking-left', 'walking-right');
      if (!ctx.isSleeping && !ctx.isEating) ctx.animLock = false;
      ctx.isBusy = false;
      if (skipSync) return;
      if (CLIP_FLOW_MODE) ctx.snapVideoClip();
      else ctx.syncVideoClip();
    }

    function finishWalk() {
      ctx.cat2ActivityLog('end', 'walk', { walkThenSleep: ctx.walkThenSleep });
      stopWalkMovement();
      if (!ctx.isWalking) return;
      stopWalk();
      if (ctx.walkThenSleep) {
        goToSleepAfterWalk();
        return;
      }
      if (!ctx.isChatOpen()) ctx.sayDialogue('walkArrive', 2500);
    }

    function goToSleepAfterWalk() {
      ctx.walkThenSleep = false;
      stopWalkMovement();
      catEl.classList.remove('walking-left', 'walking-right');
      ctx.isBusy = false;
      ctx.animLock = false;
      goToSleepClip(undefined, { force: true });
    }

    function goToSleepClip(duration, { force = false } = {}) {
      if (!CLIP_FLOW_MODE) {
        goToSleep(duration, { force });
        return true;
      }
      if (ctx.isSleeping && !force) return false;
      if (!force && (feedState.isFlowActive() || ctx.isEating || feedState.isBegging())) return false;
      if (force) {
        if (ctx.isEating) ctx.stopEating?.();
        feedState.reset?.('focus-nap');
        if (ctx.sleepTimeout) clearTimeout(ctx.sleepTimeout);
      }
      if (!force && Date.now() < ctx.postMealCooldownUntil) return false;
      if (!force && !ctx.canPickActivity('sleep')) return false;
      if (!force && !ctx.canDoActivity()) return false;
      if (!force && Cat2Player.getCurrentKey() !== 'idle') return false;
      if (!force && Cat2Player.isTransitioning?.()) return false;

      ctx.stopActivity();
      catEl.dataset.sleeping = 'true';
      ctx.animLock = true;
      ctx.isBusy = true;
      ctx.hideSpeech();
      ctx.setPose('sleep');
      ctx.recordActivityStart('sleep');

      const sleepMs = duration || Cat2Clips.getDurationMs('sleep');
      if (ctx.sleepTimeout) clearTimeout(ctx.sleepTimeout);
      ctx.sleepTimeout = setTimeout(() => wakeFromSleepFlow(), sleepMs);
      ctx.cat2ActivityLog('start', 'sleep', { durationMs: sleepMs, force });
      return true;
    }

    function wakeFromSleepFlow() {
      if (!ctx.isSleeping) return;
      ctx.cat2ActivityLog('end', 'sleep');
      if (ctx.sleepTimeout) clearTimeout(ctx.sleepTimeout);
      catEl.dataset.sleeping = '';
      ctx.isBusy = false;
      ctx.animLock = false;
      feedState.reset('wake-from-sleep');
      ctx.setPose('loaf', { skipSync: true });
      ctx.setExpression('happy', { skipSync: true });
      Cat2Player.cancelPending?.();
      ctx.snapVideoClip();
      ctx.sayDialogue('wake', 3000);
    }

    function wakeUp() {
      if (!ctx.isSleeping) return false;
      ctx.cat2ActivityLog('interrupt', 'sleep', { trigger: 'wakeUp' });
      if (CLIP_FLOW_MODE) {
        wakeFromSleepFlow();
      } else {
        if (ctx.sleepTimeout) clearTimeout(ctx.sleepTimeout);
        catEl.dataset.sleeping = '';
        ctx.animLock = false;
        ctx.setPose('loaf');
        ctx.setExpression('happy');
        ctx.playAnimation('yawn', 900);
        ctx.sayDialogue('wake', 3000);
      }
      ctx.scheduleEyeUpdate();
      return true;
    }

    function goToSleep(duration = 20000, { force = false } = {}) {
      if (CLIP_FLOW_MODE) return;
      if (!force && (ctx.isSleeping || ctx.isEating || ctx.animLock || ctx.isChatOpen())) return;
      if (force) {
        if (ctx.isEating) ctx.stopEating?.();
        ctx.stopActivity();
        if (ctx.sleepTimeout) clearTimeout(ctx.sleepTimeout);
      } else {
        ctx.stopActivity();
      }
      ctx.animLock = true;
      ctx.setPose('sleep');
      ctx.hideSpeech();
      ctx.sleepTimeout = setTimeout(() => {
        ctx.setPose('loaf');
        ctx.setExpression('happy');
        ctx.animLock = false;
        ctx.showSpeech('*stretch* Good nap~', 2500);
        ctx.playAnimation('stretch', 800);
        ctx.scheduleEyeUpdate();
      }, duration);
    }

    function onWalkClipVisible() {
      if (catEl.dataset.waterChase === 'true') return;
      if (!ctx.isWalking || Cat2Player.getCurrentKey() !== 'walk') return;
      if (ctx.clipMovementStarted) return;
      const dir = catEl.classList.contains('walking-left') ? -1 : 1;
      startWalkMovement(dir);
    }

    /** Fallback when clip-visible is missed (e.g. same-key restart races). */
    function ensureWalkMovementStarted() {
      if (catEl.dataset.waterChase === 'true') return;
      if (!ctx.isWalking || ctx.clipMovementStarted) return;
      if (Cat2Player.getCurrentKey() !== 'walk') return;
      const dir = catEl.classList.contains('walking-left') ? -1 : 1;
      startWalkMovement(dir);
    }

    function onButterflyClipVisible() {
      if (catEl.dataset.playing !== 'butterfly') return;
      if (Cat2Player.getCurrentKey() !== 'butterfly') return;
      if (ctx.clipMovementStarted) return;
      const dir = catEl.classList.contains('walking-left') ? -1 : 1;
      startButterflyMovement(dir);
    }

    async function startWalk({ afterDecline = false, afterMeal = false } = {}) {
      if (ctx.isWalking) return false;
      const forceStart = afterDecline || afterMeal;
      if (!forceStart) {
        if (!ctx.canDoActivity()) return false;
        if (Cat2Player.getCurrentKey() !== 'idle') return false;
        if (Cat2Player.isTransitioning?.()) return false;
      }
      if (afterMeal) {
        if (ctx.isChatOpen()) return false;
        if (ctx.breakAlertActive) return false;
        if (window.MeowProductivity?.shouldSuppressIdle?.()) return false;
      }

      ctx.walkPlacement = await window.meowAPI?.getWindowPlacement?.() ?? null;
      const dir = pickHorizontalDirection(ctx.walkPlacement);
      ctx.lastWalkDir = dir;
      ctx.walkReversedOnce = false;

      stopWalk({ skipSync: true });
      stopWalkMovement();

      ctx.isWalking = true;
      ctx.isBusy = true;
      ctx.animLock = true;
      feedState.reset('start-walk');
      catEl.dataset.walking = 'true';
      applyWalkFacing(dir);

      if (afterMeal) {
        ctx.showSpeech?.('*stretch* little stroll~', 2800);
      } else if (!afterDecline) {
        ctx.sayDialogue('walkPatrol', 3500);
      }
      ctx.setExpression('happy');
      // Force a fresh walk clip so every walk gets clip-visible + movement sync
      if (CLIP_FLOW_MODE) {
        Cat2Player.switchClip('walk', { crossfade: false, force: true });
      } else if (forceStart) {
        ctx.snapVideoClip();
      } else {
        ctx.syncVideoClip();
      }

      detachWalkEndedListener();
      ctx.walkEndedListener = (ev) => {
        if (ev.detail?.key !== 'walk') return;
        stopWalkMovement();
        if (ctx.walkTimeout) clearTimeout(ctx.walkTimeout);
        ctx.walkTimeout = null;
        finishWalk();
      };
      window.addEventListener('cat2:clip-ended', ctx.walkEndedListener);
      ctx.armActivityWatchdog('walk', () => {
        stopWalkMovement();
        if (ctx.walkTimeout) clearTimeout(ctx.walkTimeout);
        ctx.walkTimeout = null;
        finishWalk();
      });
      // Safety: if clip-visible was missed, start movement on next frames
      requestAnimationFrame(() => {
        ensureWalkMovementStarted();
        setTimeout(ensureWalkMovementStarted, 120);
      });
      ctx.cat2ActivityLog('start', 'walk', { afterDecline, afterMeal, dir });
      return true;
    }

    return {
      pickHorizontalDirection,
      maxHorizontalDistance,
      applyWalkFacing,
      stopClipMovement,
      stopWalkMovement,
      startSyncedClipMovement,
      startWalkMovement,
      startButterflyMovement,
      detachWalkEndedListener,
      stopWalk,
      finishWalk,
      goToSleepAfterWalk,
      goToSleepClip,
      wakeFromSleepFlow,
      wakeUp,
      goToSleep,
      onWalkClipVisible,
      onButterflyClipVisible,
      ensureWalkMovementStarted,
      startWalk,
    };
  }

  window.Cat2Sleep = { create };
})();
