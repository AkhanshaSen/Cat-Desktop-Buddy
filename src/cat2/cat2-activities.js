/**
 * Cat 2 idle clip activities — butterfly, meow, roll, scratch, picker, etc.
 */
(() => {
  'use strict';

  function create(ctx) {
    const {
      catEl, catFigure, activityProps, scratchStopPrompt, quickStopScratchBtn,
      CLIP_FLOW_MODE, CURSOR_AWAY_GRUMPY_MS, CURSOR_NEAR_PAD_PX,
      IDLE_ACTIVITY_OPTIONS, PLAYFUL_ACTIVITY_OPTIONS,
      MOOD_ACTIVITY_COOLDOWN_MS, MOOD_ACTIVITY_RECENT_LOOKBACK,
      ACTIVITY_HISTORY_SIZE, IDLE_ACTIVITIES, feedState,
    } = ctx;

    function isFeedBlocking() {
      return feedState.isBegging() || feedState.isAwaitingChoice();
    }

    function isAnimating() {
      return ctx.isWalking || ctx.isEating || ctx.isSleeping || ctx.isPetting || ctx.animLock ||
        ctx.isBusy || feedState.isFlowActive() || ctx.postMealPhase ||
        isFeedBlocking() ||
        catEl.dataset.playing === 'butterfly' || catEl.dataset.playing === 'pet' ||
        catEl.dataset.playing === 'meow' || catEl.dataset.playing === 'roll' ||
        catEl.dataset.playing === 'groom' || catEl.dataset.playing === 'earpurr' ||
        catEl.dataset.playing === 'grumpy' || catEl.dataset.playing === 'woolball' ||
        catEl.dataset.playing === 'jump' || catEl.dataset.playing === 'scratch' ||
        Cat2Player.isTransitioning?.();
    }

    function canDoActivity() {
      return !ctx.isChatOpen() && !isAnimating() && !ctx.isSleeping &&
        !ctx.breakAlertActive && !ctx.isFocusMode && !ctx.getSettings().focusMode &&
        !window.MeowProductivity?.shouldSuppressIdle?.();
    }

    function isPettingNow() {
      return ctx.isPetting || catEl.dataset.playing === 'pet';
    }

    function isMoodActivity(type) {
      return type === 'sleep' || type === 'grumpy';
    }

    function recordActivityStart(type) {
      if (!type) return;
      ctx.lastRandomActivity = type;
      ctx.lastActivityStartedAt[type] = Date.now();
      ctx.recentActivityHistory.push(type);
      while (ctx.recentActivityHistory.length > ACTIVITY_HISTORY_SIZE) {
        ctx.recentActivityHistory.shift();
      }
    }

    function wasRecentActivity(type, lookback = 1) {
      if (!type) return false;
      return ctx.recentActivityHistory.slice(-lookback).includes(type);
    }

    function canPickActivity(type) {
      if (!type) return false;
      if (type === 'sleep' && Date.now() < ctx.postMealCooldownUntil) return false;
      if (type === ctx.lastRandomActivity) return false;

      if (isMoodActivity(type)) {
        const lastAt = ctx.lastActivityStartedAt[type];
        if (lastAt && Date.now() - lastAt < MOOD_ACTIVITY_COOLDOWN_MS) return false;
        if (wasRecentActivity(type, MOOD_ACTIVITY_RECENT_LOOKBACK)) return false;
        const paired = type === 'sleep' ? 'grumpy' : 'sleep';
        if (ctx.lastRandomActivity === paired) return false;
        if (wasRecentActivity(paired, 2)) return false;
        return true;
      }
      return true;
    }

    function shuffledActivityOptions() {
      let options = IDLE_ACTIVITY_OPTIONS.filter((o) => canPickActivity(o));
      if (!options.length) {
        options = PLAYFUL_ACTIVITY_OPTIONS.filter((o) => o !== ctx.lastRandomActivity);
      }
      if (!options.length) options = [...PLAYFUL_ACTIVITY_OPTIONS];
      for (let i = options.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [options[i], options[j]] = [options[j], options[i]];
      }
      return options;
    }

    function stopActivity({ force = false } = {}) {
      if (ctx.activityTimeout) clearTimeout(ctx.activityTimeout);
      ctx.activityTimeout = null;
      if (!force && isPettingNow()) return;
      const playing = catEl.dataset.playing;
      if (playing) ctx.cat2ActivityLog('interrupt', playing, { force });
      if (catEl.dataset.playing === 'butterfly') { finishButterflyChase(); return; }
      if (catEl.dataset.playing === 'meow') { finishMeow(); return; }
      if (catEl.dataset.playing === 'roll') { finishRoll(); return; }
      if (catEl.dataset.playing === 'groom') { finishGroom(); return; }
      if (catEl.dataset.playing === 'earpurr') { finishEarPurr(); return; }
      if (catEl.dataset.playing === 'grumpy') { finishGrumpy(); return; }
      if (catEl.dataset.playing === 'woolball') { finishWoolball(); return; }
      if (catEl.dataset.playing === 'jump') { finishJump(); return; }
      if (catEl.dataset.playing === 'scratch') {
        stopScratchActivity({ source: 'stopActivity' });
        return;
      }
      if (catEl.dataset.playing === 'pet') { ctx.finishPet(); return; }
      ctx.isBusy = false;
      if (!ctx.isSleeping && !ctx.isEating) ctx.animLock = false;
      catEl.dataset.activity = 'none';
      activityProps?.classList.add('hidden');
      if (ctx.isSleeping || ctx.isEating) return;
      if (catEl.dataset.expression !== 'love') ctx.setExpression('happy');
      ctx.syncVideoClip();
    }

    function startActivity(activity) {
      if (CLIP_FLOW_MODE) return;
      if (!canDoActivity()) return;
      stopActivity();
      ctx.isBusy = true;
      ctx.animLock = true;
      catEl.dataset.activity = activity.id;
      ctx.setExpression(activity.expression);
      ctx.hideSpeech();
      Cat2Player.switchClip(activity.id, { crossfade: true });
      const line = activity.lines[Math.floor(Math.random() * activity.lines.length)];
      ctx.showSpeech(line, 4500);
      const duration = activity.minMs + Math.random() * (activity.maxMs - activity.minMs);
      ctx.activityTimeout = setTimeout(() => {
        stopActivity();
        if (!ctx.isChatOpen() && Math.random() < 0.35) {
          ctx.showSpeech('*stretch* Back to loaf mode~', 2500);
          ctx.playAnimation('stretch', 700);
        }
      }, duration);
    }

    function startRandomActivity() {
      if (CLIP_FLOW_MODE) {
        startButterflyChase();
        return;
      }
      const act = IDLE_ACTIVITIES[Math.floor(Math.random() * IDLE_ACTIVITIES.length)];
      startActivity(act);
    }

    function detachButterflyListener() {
      if (!ctx.butterflyEndedListener) return;
      window.removeEventListener('cat2:clip-ended', ctx.butterflyEndedListener);
      ctx.butterflyEndedListener = null;
    }

    function finishButterflyChase() {
      ctx.cat2ActivityLog('end', 'butterfly');
      detachButterflyListener();
      ctx.clearActivityWatchdog();
      ctx.stopClipMovement();
      catEl.classList.remove('walking-left', 'walking-right');
      catEl.dataset.playing = '';
      ctx.isBusy = false;
      ctx.animLock = false;
      ctx.setExpression('happy');
      ctx.snapVideoClip();
    }

    async function startButterflyChase() {
      if (!canDoActivity()) return false;
      if (isFeedBlocking()) return false;
      if (isPettingNow()) return false;
      if (Cat2Player.getCurrentKey() !== 'idle') return false;
      if (catEl.dataset.playing === 'butterfly') return false;
      if (Cat2Player.isTransitioning?.()) return false;

      ctx.stopClipMovement();
      ctx.butterflyPlacement = await window.meowAPI?.getWindowPlacement?.() ?? null;
      const dir = ctx.pickHorizontalDirection(ctx.butterflyPlacement);
      ctx.lastWalkDir = dir;

      ctx.isBusy = true;
      ctx.animLock = true;
      catEl.dataset.playing = 'butterfly';
      ctx.applyWalkFacing(dir);
      ctx.setExpression('excited');
      ctx.hideSpeech();
      ctx.sayDialogue('butterfly', 3500);
      ctx.snapVideoClip();

      detachButterflyListener();
      ctx.butterflyEndedListener = (ev) => {
        if (ev.detail?.key !== 'butterfly') return;
        finishButterflyChase();
      };
      window.addEventListener('cat2:clip-ended', ctx.butterflyEndedListener);
      ctx.armActivityWatchdog('butterfly', finishButterflyChase);
      ctx.cat2ActivityLog('start', 'butterfly');
      return true;
    }

    function detachMeowListener() {
      if (!ctx.meowEndedListener) return;
      window.removeEventListener('cat2:clip-ended', ctx.meowEndedListener);
      ctx.meowEndedListener = null;
    }

    function finishMeow() {
      ctx.cat2ActivityLog('end', 'meow');
      detachMeowListener();
      ctx.clearActivityWatchdog();
      catEl.dataset.playing = '';
      ctx.isBusy = false;
      ctx.animLock = false;
      ctx.setExpression('happy', { skipSync: true });
      ctx.snapVideoClip();
    }

    function startMeowActivity() {
      if (!canDoActivity()) return false;
      if (isFeedBlocking()) return false;
      if (isPettingNow()) return false;
      if (Cat2Player.getCurrentKey() !== 'idle') return false;
      if (catEl.dataset.playing === 'meow') return false;
      if (Cat2Player.isTransitioning?.()) return false;

      ctx.isBusy = true;
      ctx.animLock = true;
      catEl.dataset.playing = 'meow';
      ctx.setExpression('happy', { skipSync: true });
      ctx.hideSpeech();
      ctx.snapVideoClip();

      detachMeowListener();
      ctx.meowEndedListener = (ev) => {
        if (ev.detail?.key !== 'meow') return;
        finishMeow();
      };
      window.addEventListener('cat2:clip-ended', ctx.meowEndedListener);
      ctx.armActivityWatchdog('meow', () => {
        if (ctx.postMealPhase === 'meow') ctx.completePostMealSequence();
        else finishMeow();
      });
      ctx.cat2ActivityLog('start', 'meow', { postMeal: ctx.postMealPhase === 'meow' });
      return true;
    }

    function detachRollListener() {
      if (!ctx.rollEndedListener) return;
      window.removeEventListener('cat2:clip-ended', ctx.rollEndedListener);
      ctx.rollEndedListener = null;
    }

    function finishRoll() {
      ctx.cat2ActivityLog('end', 'roll');
      detachRollListener();
      ctx.clearActivityWatchdog();
      catEl.dataset.playing = '';
      ctx.isBusy = false;
      ctx.animLock = false;
      ctx.setExpression('happy', { skipSync: true });
      ctx.snapVideoClip();
    }

    function startRollActivity() {
      if (!canDoActivity() || isFeedBlocking() || isPettingNow()) return false;
      if (Cat2Player.getCurrentKey() !== 'idle' || catEl.dataset.playing === 'roll') return false;
      if (Cat2Player.isTransitioning?.()) return false;

      ctx.isBusy = true;
      ctx.animLock = true;
      catEl.dataset.playing = 'roll';
      ctx.setExpression('love', { skipSync: true });
      ctx.hideSpeech();
      ctx.snapVideoClip();
      detachRollListener();
      ctx.rollEndedListener = (ev) => { if (ev.detail?.key === 'roll') finishRoll(); };
      window.addEventListener('cat2:clip-ended', ctx.rollEndedListener);
      ctx.armActivityWatchdog('roll', finishRoll);
      ctx.cat2ActivityLog('start', 'roll');
      return true;
    }

    function detachGroomListener() {
      if (!ctx.groomEndedListener) return;
      window.removeEventListener('cat2:clip-ended', ctx.groomEndedListener);
      ctx.groomEndedListener = null;
    }

    function finishGroom() {
      ctx.cat2ActivityLog('end', 'groom');
      detachGroomListener();
      ctx.clearActivityWatchdog();
      catEl.dataset.playing = '';
      ctx.isBusy = false;
      ctx.animLock = false;
      ctx.setExpression('happy', { skipSync: true });
      ctx.snapVideoClip();
    }

    function startGroomActivity() {
      if (!canDoActivity() || isFeedBlocking() || isPettingNow()) return false;
      if (Cat2Player.getCurrentKey() !== 'idle' || catEl.dataset.playing === 'groom') return false;
      if (Cat2Player.isTransitioning?.()) return false;

      ctx.isBusy = true;
      ctx.animLock = true;
      catEl.dataset.playing = 'groom';
      ctx.setExpression('happy', { skipSync: true });
      ctx.hideSpeech();
      ctx.snapVideoClip();
      detachGroomListener();
      ctx.groomEndedListener = (ev) => { if (ev.detail?.key === 'groom') finishGroom(); };
      window.addEventListener('cat2:clip-ended', ctx.groomEndedListener);
      ctx.armActivityWatchdog('groom', finishGroom);
      ctx.cat2ActivityLog('start', 'groom');
      return true;
    }

    function detachEarPurrListener() {
      if (!ctx.earPurrEndedListener) return;
      window.removeEventListener('cat2:clip-ended', ctx.earPurrEndedListener);
      ctx.earPurrEndedListener = null;
    }

    function finishEarPurr() {
      ctx.cat2ActivityLog('end', 'earpurr');
      detachEarPurrListener();
      ctx.clearActivityWatchdog();
      catEl.dataset.playing = '';
      ctx.isBusy = false;
      ctx.animLock = false;
      ctx.setExpression('happy', { skipSync: true });
      ctx.snapVideoClip();
    }

    function startEarPurrActivity() {
      if (!canDoActivity() || isFeedBlocking() || isPettingNow()) return false;
      if (Cat2Player.getCurrentKey() !== 'idle' || catEl.dataset.playing === 'earpurr') return false;
      if (Cat2Player.isTransitioning?.()) return false;

      ctx.isBusy = true;
      ctx.animLock = true;
      catEl.dataset.playing = 'earpurr';
      ctx.setExpression('love', { skipSync: true });
      ctx.hideSpeech();
      ctx.snapVideoClip();
      detachEarPurrListener();
      ctx.earPurrEndedListener = (ev) => { if (ev.detail?.key === 'earpurr') finishEarPurr(); };
      window.addEventListener('cat2:clip-ended', ctx.earPurrEndedListener);
      ctx.armActivityWatchdog('earpurr', finishEarPurr);
      ctx.cat2ActivityLog('start', 'earpurr');
      return true;
    }

    function detachGrumpyListener() {
      if (!ctx.grumpyEndedListener) return;
      window.removeEventListener('cat2:clip-ended', ctx.grumpyEndedListener);
      ctx.grumpyEndedListener = null;
    }

    function finishGrumpy() {
      ctx.cat2ActivityLog('end', 'grumpy');
      detachGrumpyListener();
      ctx.clearActivityWatchdog();
      catEl.dataset.playing = '';
      ctx.isBusy = false;
      ctx.animLock = false;
      ctx.setExpression('happy', { skipSync: true });
      ctx.snapVideoClip();
      if (isCursorNearCat()) ctx.lastCursorNearAt = Date.now();
    }

    function startGrumpyActivity(opts = {}) {
      if (!canDoActivity() || isFeedBlocking() || isPettingNow()) return false;
      if (Cat2Player.getCurrentKey() !== 'idle' || catEl.dataset.playing === 'grumpy') return false;
      if (Cat2Player.isTransitioning?.()) return false;

      ctx.isBusy = true;
      ctx.animLock = true;
      catEl.dataset.playing = 'grumpy';
      ctx.setExpression('sad', { skipSync: true });
      ctx.sayDialogue('grumpy', 4500);
      ctx.snapVideoClip();
      detachGrumpyListener();
      ctx.grumpyEndedListener = (ev) => { if (ev.detail?.key === 'grumpy') finishGrumpy(); };
      window.addEventListener('cat2:clip-ended', ctx.grumpyEndedListener);
      ctx.armActivityWatchdog('grumpy', finishGrumpy);
      ctx.cat2ActivityLog('start', 'grumpy', { trigger: opts.trigger || 'idle', ...opts });
      return true;
    }

    function detachWoolballListener() {
      if (!ctx.woolballEndedListener) return;
      window.removeEventListener('cat2:clip-ended', ctx.woolballEndedListener);
      ctx.woolballEndedListener = null;
    }

    function finishWoolball() {
      ctx.cat2ActivityLog('end', 'woolball');
      detachWoolballListener();
      ctx.clearActivityWatchdog();
      catEl.dataset.playing = '';
      ctx.isBusy = false;
      ctx.animLock = false;
      ctx.setExpression('happy', { skipSync: true });
      ctx.snapVideoClip();
    }

    function startWoolballActivity() {
      if (!canDoActivity() || isFeedBlocking() || isPettingNow()) return false;
      if (Cat2Player.getCurrentKey() !== 'idle' || catEl.dataset.playing === 'woolball') return false;
      if (Cat2Player.isTransitioning?.()) return false;

      ctx.isBusy = true;
      ctx.animLock = true;
      catEl.dataset.playing = 'woolball';
      ctx.setExpression('excited', { skipSync: true });
      ctx.sayDialogue('woolball', 5500);
      ctx.snapVideoClip();
      detachWoolballListener();
      ctx.woolballEndedListener = (ev) => { if (ev.detail?.key === 'woolball') finishWoolball(); };
      window.addEventListener('cat2:clip-ended', ctx.woolballEndedListener);
      ctx.armActivityWatchdog('woolball', finishWoolball);
      ctx.cat2ActivityLog('start', 'woolball');
      return true;
    }

    function detachJumpListener() {
      if (!ctx.jumpEndedListener) return;
      window.removeEventListener('cat2:clip-ended', ctx.jumpEndedListener);
      ctx.jumpEndedListener = null;
    }

    function finishJump() {
      ctx.cat2ActivityLog('end', 'jump');
      detachJumpListener();
      ctx.clearActivityWatchdog();
      catEl.dataset.playing = '';
      ctx.isBusy = false;
      ctx.animLock = false;
      ctx.setExpression('happy', { skipSync: true });
      ctx.snapVideoClip();
    }

    function startJumpActivity() {
      if (!canDoActivity() || isFeedBlocking() || isPettingNow()) return false;
      if (Cat2Player.getCurrentKey() !== 'idle' || catEl.dataset.playing === 'jump') return false;
      if (Cat2Player.isTransitioning?.()) return false;

      ctx.isBusy = true;
      ctx.animLock = true;
      catEl.dataset.playing = 'jump';
      ctx.setExpression('excited', { skipSync: true });
      ctx.sayDialogue('jump', 5500);
      ctx.snapVideoClip();
      detachJumpListener();
      ctx.jumpEndedListener = (ev) => { if (ev.detail?.key === 'jump') finishJump(); };
      window.addEventListener('cat2:clip-ended', ctx.jumpEndedListener);
      ctx.armActivityWatchdog('jump', finishJump);
      ctx.cat2ActivityLog('start', 'jump');
      return true;
    }

    function showScratchStopPrompt() {
      scratchStopPrompt?.classList.remove('hidden');
      quickStopScratchBtn?.classList.remove('hidden');
      catEl.classList.add('scratch-active');
    }

    function hideScratchStopPrompt() {
      scratchStopPrompt?.classList.add('hidden');
      quickStopScratchBtn?.classList.add('hidden');
      catEl.classList.remove('scratch-active');
      const quip = document.getElementById('scratch-quip');
      if (quip) quip.textContent = '';
    }

    function detachScratchListener() {
      if (!ctx.scratchEndedListener) return;
      window.removeEventListener('cat2:clip-ended', ctx.scratchEndedListener);
      ctx.scratchEndedListener = null;
    }

    function finishScratch() {
      ctx.cat2ActivityLog('end', 'scratch');
      detachScratchListener();
      ctx.clearActivityWatchdog();
      hideScratchStopPrompt();
      catEl.dataset.playing = '';
      ctx.isBusy = false;
      ctx.animLock = false;
      ctx.setExpression('happy', { skipSync: true });
      ctx.snapVideoClip();
    }

    function stopScratchActivity({ source = 'unknown' } = {}) {
      if (catEl.dataset.playing !== 'scratch') return false;
      ctx.cat2ActivityLog('interrupt', 'scratch', { source });
      finishScratch();
      ctx.sayDialogue('scratchStop', 4500);
      return true;
    }

    function startScratchActivity() {
      if (!canDoActivity() || isFeedBlocking() || isPettingNow()) return false;
      if (Cat2Player.getCurrentKey() !== 'idle' || catEl.dataset.playing === 'scratch') return false;
      if (Cat2Player.isTransitioning?.()) return false;

      ctx.isBusy = true;
      ctx.animLock = true;
      catEl.dataset.playing = 'scratch';
      const scratchLine = ctx.pickDialogue?.('scratch') || { text: 'Mrow~', expression: 'excited' };
      ctx.setExpression(scratchLine.expression || 'excited', { skipSync: true });
      const quip = document.getElementById('scratch-quip');
      if (quip) quip.textContent = scratchLine.text;
      ctx.hideSpeech?.();
      showScratchStopPrompt();
      ctx.snapVideoClip();
      detachScratchListener();
      ctx.scratchEndedListener = (ev) => { if (ev.detail?.key === 'scratch') finishScratch(); };
      window.addEventListener('cat2:clip-ended', ctx.scratchEndedListener);
      ctx.armActivityWatchdog('scratch', finishScratch);
      ctx.cat2ActivityLog('start', 'scratch');
      return true;
    }

    function isCursorNearCat() {
      const el = catFigure || catEl;
      if (!el) return false;
      const rect = el.getBoundingClientRect();
      const pad = CURSOR_NEAR_PAD_PX;
      return ctx.mouseX >= rect.left - pad && ctx.mouseX <= rect.right + pad &&
        ctx.mouseY >= rect.top - pad && ctx.mouseY <= rect.bottom + pad;
    }

    function noteCursorProximity() {
      if (isCursorNearCat()) ctx.lastCursorNearAt = Date.now();
    }

    function checkCursorAwayGrumpy() {
      if (!CLIP_FLOW_MODE) return;
      const settings = ctx.getSettings();
      if (settings.focusMode || ctx.isFocusMode) return;
      if (ctx.isChatOpen() || ctx.isSleeping || ctx.isEating || ctx.breakAlertActive ||
          feedState.isAwaitingChoice() || feedState.isFlowActive()) return;
      if (isAnimating()) return;
      if (Cat2Player.getCurrentKey() !== 'idle') return;
      if (feedState.isBegging()) return;
      if (catEl.dataset.playing === 'grumpy') return;
      if (!canPickActivity('grumpy')) return;
      if (Date.now() - ctx.lastCursorNearAt < CURSOR_AWAY_GRUMPY_MS) return;

      const awayMs = Date.now() - ctx.lastCursorNearAt;
      if (startGrumpyActivity({ trigger: 'cursor-away', awayMs })) {
        ctx.lastCursorNearAt = Date.now();
        recordActivityStart('grumpy');
      }
    }

    function startCursorAwayWatch() {
      if (ctx.cursorAwayCheckInterval) clearInterval(ctx.cursorAwayCheckInterval);
      noteCursorProximity();
      ctx.cursorAwayCheckInterval = setInterval(checkCursorAwayGrumpy, 2000);
    }

    async function pickRandomClipActivity() {
      if (!canDoActivity()) return false;
      if (feedState.isFlowActive() || ctx.isEating) return false;
      if (Cat2Player.getCurrentKey() !== 'idle') return false;
      if (isFeedBlocking()) return false;
      if (Cat2Player.isTransitioning?.()) return false;

      const options = shuffledActivityOptions();
      ctx.cat2ActivityLog('idle-tick', 'pick-random', { options });

      for (const choice of options) {
        let started = false;
        if (choice === 'butterfly') started = await startButterflyChase();
        else if (choice === 'walk') started = await ctx.startWalk();
        else if (choice === 'meow') started = startMeowActivity();
        else if (choice === 'roll') started = startRollActivity();
        else if (choice === 'groom') started = startGroomActivity();
        else if (choice === 'earpurr') started = startEarPurrActivity();
        else if (choice === 'grumpy') started = canPickActivity('grumpy') && startGrumpyActivity();
        else if (choice === 'woolball') started = startWoolballActivity();
        else if (choice === 'jump') started = startJumpActivity();
        else if (choice === 'scratch') started = startScratchActivity();
        else if (choice === 'sleep') started = canPickActivity('sleep') && ctx.goToSleepClip();
        else started = false;

        if (started) {
          recordActivityStart(choice);
          ctx.cat2ActivityLog('idle-pick', choice, { started: true });
          return true;
        }
        ctx.cat2ActivityLog('idle-pick', choice, { started: false });
      }
      ctx.cat2ActivityLog('idle-pick', 'none', { reason: 'all-skipped' });
      return false;
    }

    return {
      isAnimating,
      canDoActivity,
      isPettingNow,
      isMoodActivity,
      recordActivityStart,
      wasRecentActivity,
      canPickActivity,
      shuffledActivityOptions,
      stopActivity,
      startActivity,
      startRandomActivity,
      detachButterflyListener,
      finishButterflyChase,
      startButterflyChase,
      detachMeowListener,
      finishMeow,
      startMeowActivity,
      detachRollListener,
      finishRoll,
      startRollActivity,
      detachGroomListener,
      finishGroom,
      startGroomActivity,
      detachEarPurrListener,
      finishEarPurr,
      startEarPurrActivity,
      detachGrumpyListener,
      finishGrumpy,
      startGrumpyActivity,
      detachWoolballListener,
      finishWoolball,
      startWoolballActivity,
      detachJumpListener,
      finishJump,
      startJumpActivity,
      showScratchStopPrompt,
      hideScratchStopPrompt,
      detachScratchListener,
      finishScratch,
      stopScratchActivity,
      startScratchActivity,
      isCursorNearCat,
      noteCursorProximity,
      checkCursorAwayGrumpy,
      startCursorAwayWatch,
      pickRandomClipActivity,
    };
  }

  window.Cat2Activities = { create };
})();
