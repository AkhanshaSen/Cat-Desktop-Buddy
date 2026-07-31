/**
 * Cat 2 feed flow — hunger meter, prompts, eating, post-meal.
 */
(() => {
  'use strict';

  function create(ctx) {
    const {
      catEl, foodChoice, foodBowl, nomFloat, hungerMeter, hungerMeterFill,
      feedState, CLIP_FLOW_MODE,
      BOWL_COOLDOWN_MS, BOWL_COOLDOWN_KEY, FOOD_PREFS_KEY,
      FEED_INTERVAL_OPTIONS, FEED_INTERVAL_DEFAULT_MS, FOOD_BEG_DIALOG,
      FOOD_REACTIONS,
    } = ctx;

    function clearFeedScheduleTimeout() {
      if (ctx.feedScheduleTimeout) clearTimeout(ctx.feedScheduleTimeout);
      ctx.feedScheduleTimeout = null;
    }

    function stopHungerMeterLoop() {
      if (ctx.hungerMeterRaf) {
        cancelAnimationFrame(ctx.hungerMeterRaf);
        ctx.hungerMeterRaf = null;
      }
    }

    function hungerMeterColor(progress) {
      const p = Math.max(0, Math.min(1, progress));
      let hue;
      if (p < 0.55) hue = 128 - (p / 0.55) * 38;
      else if (p < 0.82) hue = 90 - ((p - 0.55) / 0.27) * 58;
      else hue = 32 - ((p - 0.82) / 0.18) * 32;
      return `hsl(${hue}, 76%, ${44 + p * 8}%)`;
    }

    function getHungerProgress() {
      if (feedState.isBegging() || feedState.isFlowActive() ||
          ctx.isEating || ctx.postMealPhase) {
        return 1;
      }
      if (!ctx.hungerCycleStartAt || !ctx.hungerCycleDurationMs) return 0;
      return Math.min(1, (Date.now() - ctx.hungerCycleStartAt) / ctx.hungerCycleDurationMs);
    }

    function updateHungerMeter() {
      if (!CLIP_FLOW_MODE || !hungerMeterFill) return;
      if (ctx.getSettings().focusMode || ctx.isFocusMode) {
        hungerMeter?.classList.add('hidden');
        return;
      }
      hungerMeter?.classList.remove('hidden');
      const progress = getHungerProgress();
      hungerMeterFill.style.height = `${progress * 100}%`;
      hungerMeterFill.style.backgroundColor = hungerMeterColor(progress);
      hungerMeter?.setAttribute('aria-valuenow', String(Math.round(progress * 100)));
    }

    function startHungerMeterLoop() {
      stopHungerMeterLoop();
      const tick = () => {
        updateHungerMeter();
        ctx.hungerMeterRaf = requestAnimationFrame(tick);
      };
      ctx.hungerMeterRaf = requestAnimationFrame(tick);
    }

    function startHungerMeterCycle(durationMs = ctx.getFeedIntervalMs()) {
      ctx.hungerCycleStartAt = Date.now();
      ctx.hungerCycleDurationMs = Math.max(1000, durationMs);
      startHungerMeterLoop();
      updateHungerMeter();
    }

    function clearFeedSchedule() {
      clearFeedScheduleTimeout();
      stopHungerMeterLoop();
      hungerMeter?.classList.add('hidden');
    }

    function clearFeedPromptTimers() {
      if (ctx.feedPromptRetryTimeout) clearTimeout(ctx.feedPromptRetryTimeout);
      ctx.feedPromptRetryTimeout = null;
      if (ctx.foodChoiceTimeout) clearTimeout(ctx.foodChoiceTimeout);
      ctx.foodChoiceTimeout = null;
    }

    function hideFeedPrompt() {
      if (feedState.isAwaitingChoice()) ctx.cat2ActivityLog('feed-prompt', 'hide');
      feedState.closePrompt();
      foodChoice?.classList.add('hidden');
      catEl.classList.remove('feed-prompt-open');
    }

    function tryShowFeedPrompt() {
      if (catEl.dataset.begging !== 'true' && !feedState.isHungry()) return false;
      if (feedState.isAwaitingChoice()) return true;
      if (ctx.isEating || ctx.isSleeping) return false;

      feedState.openPrompt();
      ctx.hideSpeech();
      foodChoice?.classList.remove('hidden');
      catEl.classList.add('feed-prompt-open');
      ctx.setExpression('sad');
      ctx.cat2ActivityLog('feed-prompt', 'show');
      return true;
    }

    function ensureFeedPromptVisible() {
      if (!CLIP_FLOW_MODE) return false;
      if (ctx.isEating || ctx.isSleeping) return false;

      const uiVisible = foodChoice && !foodChoice.classList.contains('hidden');
      if (catEl.dataset.begging !== 'true' && !feedState.isAwaitingChoice() && !uiVisible) {
        return false;
      }

      if (catEl.dataset.begging !== 'true') {
        feedState.enterHungry();
        ctx.snapVideoClip();
      }

      feedState.openPrompt();
      ctx.hideSpeech();
      foodChoice?.classList.remove('hidden');
      catEl.classList.add('feed-prompt-open');
      ctx.setExpression('sad');
      return true;
    }

    function refreshFeedPromptAfterChat() {
      requestAnimationFrame(() => {
        if (!ensureFeedPromptVisible()) return;
        scheduleFeedPromptRetry();
      });
      return true;
    }

    function scheduleFeedPromptRetry() {
      if (ctx.feedPromptRetryTimeout) clearTimeout(ctx.feedPromptRetryTimeout);
      if (catEl.dataset.begging !== 'true' || feedState.isAwaitingChoice()) return;
      ctx.feedPromptRetryTimeout = setTimeout(() => {
        ctx.feedPromptRetryTimeout = null;
        if (tryShowFeedPrompt()) return;
        scheduleFeedPromptRetry();
      }, 1000);
    }

    function showFeedPrompt() {
      if (tryShowFeedPrompt()) return;
      scheduleFeedPromptRetry();
    }

    function onFeedCycleComplete() {
      if (!CLIP_FLOW_MODE) return;
      scheduleFeedRequest(ctx.getFeedIntervalMs());
    }

    function runFeedScheduleTick() {
      ctx.feedScheduleTimeout = null;
      if (ctx.getSettings().focusMode || ctx.isFocusMode) {
        rescheduleFeedTimeout(2000);
        return;
      }
      if (ctx.isEating) {
        rescheduleFeedTimeout(1000);
        return;
      }
      if (feedState.isAwaitingChoice()) {
        rescheduleFeedTimeout(2000);
        return;
      }
      if (catEl.dataset.begging === 'true' || feedState.isHungry()) {
        tryShowFeedPrompt();
        scheduleFeedPromptRetry();
        rescheduleFeedTimeout(2000);
        return;
      }
      if (feedState.isFlowActive()) {
        feedState.clearStaleFlow();
      }
      if (!ctx.canDoActivity() || Cat2Player.isTransitioning?.()) {
        rescheduleFeedTimeout(500);
        return;
      }
      if (Cat2Player.getCurrentKey() !== 'idle') {
        rescheduleFeedTimeout(500);
        return;
      }
      begForFood();
    }

    function rescheduleFeedTimeout(delayMs) {
      clearFeedScheduleTimeout();
      ctx.feedScheduleTimeout = setTimeout(runFeedScheduleTick, Math.max(0, delayMs));
    }

    function getRemainingFeedMs() {
      if (!ctx.hungerCycleStartAt || !ctx.hungerCycleDurationMs) {
        return ctx.getFeedIntervalMs();
      }
      return Math.max(0, ctx.hungerCycleDurationMs - (Date.now() - ctx.hungerCycleStartAt));
    }

    /** Fresh cycle — after a meal or first launch. Resets the hunger bar. */
    function scheduleFeedRequest(delayMs = ctx.getFeedIntervalMs()) {
      if (!CLIP_FLOW_MODE) return;
      startHungerMeterCycle(delayMs);
      rescheduleFeedTimeout(delayMs);
    }

    /** Change interval only — keeps current hunger progress. */
    function updateFeedIntervalDuration(durationMs = ctx.getFeedIntervalMs()) {
      if (!CLIP_FLOW_MODE) return;
      const next = Math.max(1000, durationMs);
      if (!ctx.hungerCycleStartAt) {
        scheduleFeedRequest(next);
        return;
      }
      ctx.hungerCycleDurationMs = next;
      if (!ctx.getSettings().focusMode && !ctx.isFocusMode) {
        startHungerMeterLoop();
        updateHungerMeter();
      }
      rescheduleFeedTimeout(getRemainingFeedMs());
    }

    /** Resume after focus mode — keeps current hunger progress. */
    function resumeFeedSchedule() {
      if (!CLIP_FLOW_MODE) return;
      if (ctx.getSettings().focusMode || ctx.isFocusMode) return;
      if (!ctx.hungerCycleStartAt) {
        scheduleFeedRequest(ctx.getFeedIntervalMs());
        return;
      }
      startHungerMeterLoop();
      updateHungerMeter();
      rescheduleFeedTimeout(getRemainingFeedMs());
    }

    function loadBowlCooldown() {
      if (CLIP_FLOW_MODE) {
        ctx.bowlCooldownUntil = 0;
        localStorage.removeItem(BOWL_COOLDOWN_KEY);
        return;
      }
      const stored = localStorage.getItem(BOWL_COOLDOWN_KEY);
      ctx.bowlCooldownUntil = stored ? parseInt(stored, 10) : 0;
      updateBowlVisibility();
    }

    function saveBowlCooldown() {
      localStorage.setItem(BOWL_COOLDOWN_KEY, String(ctx.bowlCooldownUntil));
    }

    function isBowlOnCooldown() {
      return Date.now() < ctx.bowlCooldownUntil;
    }

    function resetBowlPosition() {
      foodBowl.style.position = '';
      foodBowl.style.left = '';
      foodBowl.style.top = '';
      foodBowl.style.transform = '';
      foodBowl.classList.remove('dragging', 'near-cat');
    }

    function hideFoodBowl() {
      foodBowl.classList.add('hidden', 'on-cooldown');
      resetBowlPosition();
    }

    function showFoodBowl() {
      if (CLIP_FLOW_MODE) return;
      if (isBowlOnCooldown()) return;
      foodBowl.classList.remove('hidden', 'on-cooldown');
    }

    function startBowlCooldown() {
      hideFoodBowl();
      if (ctx.bowlCooldownTimeout) clearTimeout(ctx.bowlCooldownTimeout);
      if (CLIP_FLOW_MODE) return;

      ctx.bowlCooldownUntil = Date.now() + BOWL_COOLDOWN_MS;
      saveBowlCooldown();
      const remaining = ctx.bowlCooldownUntil - Date.now();
      ctx.bowlCooldownTimeout = setTimeout(() => {
        ctx.bowlCooldownUntil = 0;
        localStorage.removeItem(BOWL_COOLDOWN_KEY);
        showFoodBowl();
      }, remaining);
    }

    function updateBowlVisibility() {
      if (isBowlOnCooldown()) {
        hideFoodBowl();
        const remaining = ctx.bowlCooldownUntil - Date.now();
        if (remaining > 0) {
          if (ctx.bowlCooldownTimeout) clearTimeout(ctx.bowlCooldownTimeout);
          ctx.bowlCooldownTimeout = setTimeout(() => {
            ctx.bowlCooldownUntil = 0;
            localStorage.removeItem(BOWL_COOLDOWN_KEY);
            showFoodBowl();
          }, remaining);
        }
      } else {
        showFoodBowl();
      }
    }

    function loadFoodPrefs() {
      try {
        const raw = localStorage.getItem(FOOD_PREFS_KEY);
        if (!raw) return;
        const saved = JSON.parse(raw);
        if (typeof saved.plain === 'number') {
          ctx.foodPrefs.plain = Math.max(-5, Math.min(5, saved.plain));
        }
        if (typeof saved.fishy === 'number') {
          ctx.foodPrefs.fishy = Math.max(-5, Math.min(5, saved.fishy));
        }
      } catch (_) { /* ignore */ }
    }

    function saveFoodPrefs() {
      localStorage.setItem(FOOD_PREFS_KEY, JSON.stringify(ctx.foodPrefs));
    }

    function getLikeChance(foodType) {
      const pref = ctx.foodPrefs[foodType] || 0;
      return Math.max(0.05, Math.min(0.95, 0.5 + pref / 10));
    }

    function updateFoodPref(foodType, liked) {
      if (!ctx.foodPrefs[foodType] && ctx.foodPrefs[foodType] !== 0) return;
      ctx.foodPrefs[foodType] = Math.max(-5, Math.min(5, ctx.foodPrefs[foodType] + (liked ? 1 : -1)));
      saveFoodPrefs();
    }

    function updateFoodStars() {
      foodChoice?.querySelectorAll('.food-opt').forEach((btn) => {
        const type = btn.dataset.food;
        const star = btn.querySelector('.food-star');
        if (!star) return;
        star.classList.toggle('hidden', (ctx.foodPrefs[type] || 0) < 3);
      });
    }

    function applyFoodMood(mood) {
      ctx.foodMood = mood;
      catEl.dataset.mood = mood;
      if (ctx.foodMoodTimeout) clearTimeout(ctx.foodMoodTimeout);
      ctx.foodMoodTimeout = setTimeout(() => {
        ctx.foodMood = null;
        catEl.dataset.mood = '';
        if (!ctx.isSleeping && !ctx.isEating) ctx.setExpression('happy');
      }, 5 * 60 * 1000);
    }

    function begForFood() {
      if (!ctx.canDoActivity()) return false;
      if (!CLIP_FLOW_MODE && isBowlOnCooldown()) return false;
      if (catEl.dataset.begging === 'true' || feedState.isHungry()) {
        scheduleFeedPromptRetry();
        return false;
      }
      if (Cat2Player.getCurrentKey() !== 'idle') return false;

      feedState.enterHungry();
      ctx.setExpression('sad');
      ctx.snapVideoClip();
      ctx.cat2ActivityLog('start', 'feed-beg');
      if (!tryShowFeedPrompt()) scheduleFeedPromptRetry();
      return true;
    }

    function acceptFood() {
      if (ctx.isEating) return;
      if (!feedState.canAcceptOrDecline()) return;
      if (catEl.dataset.begging !== 'true') feedState.enterHungry();
      ctx.cat2ActivityLog('feed-choice', 'yes');
      feedState.startResolving();
      ctx.animLock = true;
      if (ctx.sleepTimeout) clearTimeout(ctx.sleepTimeout);
      catEl.dataset.sleeping = '';
      clearFeedPromptTimers();
      hideFeedPrompt();
      feedCat();
    }

    function declineFoodAndWalk() {
      if (!feedState.canAcceptOrDecline()) return;
      if (catEl.dataset.begging !== 'true') feedState.enterHungry();
      ctx.cat2ActivityLog('feed-choice', 'no');
      feedState.startResolving();
      ctx.animLock = true;
      clearFeedPromptTimers();
      hideFeedPrompt();
      catEl.dataset.begging = '';
      ctx.walkThenSleep = true;
      ctx.hideSpeech();
      onFeedCycleComplete();
      ctx.sayDialogue('walkDecline', 3500);

      setTimeout(async () => {
        if (!ctx.walkThenSleep) return;
        ctx.hideSpeech();
        await ctx.startWalk({ afterDecline: true });
      }, 3200);
    }

    function cancelBegging({ syncClip = true } = {}) {
      feedState.cancelBegging();
      clearFeedPromptTimers();
      hideFeedPrompt();
      ctx.hideSpeech();
      if (syncClip) ctx.syncVideoClip();
    }

    function showFoodChoice() {
      if (CLIP_FLOW_MODE) {
        showFeedPrompt();
        return;
      }
      if (isBowlOnCooldown() || ctx.isSleeping || ctx.isEating || ctx.isChatOpen()) return;
      feedState.openPrompt();
      if (!CLIP_FLOW_MODE) ctx.hideSpeech();
      else ctx.showSpeech(FOOD_BEG_DIALOG, 0);
      updateFoodStars();
      foodChoice?.classList.remove('hidden');
      ctx.setExpression('excited');

      if (ctx.foodChoiceTimeout) clearTimeout(ctx.foodChoiceTimeout);
      ctx.foodChoiceTimeout = setTimeout(() => {
        ctx.foodChoiceTimeout = null;
        if (feedState.isAwaitingChoice()) hideFoodChoice();
      }, 14000);
    }

    function hideFoodChoice() {
      if (CLIP_FLOW_MODE) {
        hideFeedPrompt();
        return;
      }
      feedState.closePrompt();
      if (ctx.foodChoiceTimeout) clearTimeout(ctx.foodChoiceTimeout);
      ctx.foodChoiceTimeout = null;
      foodChoice?.classList.add('hidden');
      if (CLIP_FLOW_MODE) {
        cancelBegging();
      } else {
        catEl.dataset.begging = '';
        ctx.syncVideoClip();
      }
    }

    function clearPostMealHearts() {
      if (ctx.postMealHeartInterval) {
        clearInterval(ctx.postMealHeartInterval);
        ctx.postMealHeartInterval = null;
      }
    }

    function startPostMealPetPhase() {
      ctx.cat2ActivityLog('start', 'pet', { trigger: 'post-meal' });
      ctx.postMealPhase = 'pet';
      feedState.startPostMeal();
      ctx.isPetting = true;
      ctx.isBusy = true;
      ctx.animLock = true;
      catEl.dataset.playing = 'pet';
      ctx.setExpression('love', { skipSync: true });
      Cat2Player.cancelPending?.();
      Cat2Player.preloadClip?.('pet');
      ctx.syncPetClip();
      ctx.spawnHeartsAtCat(4);
      ctx.postMealHeartInterval = setInterval(() => ctx.spawnHeartsAtCat(2), 850);

      ctx.detachPetListener();
      const session = ++ctx.petSession;
      ctx.petEndedListener = (ev) => {
        if (ev.detail?.key !== 'pet') return;
        if (session !== ctx.petSession) return;
        if (ctx.postMealPhase !== 'pet') return;
        clearPostMealHearts();
        ctx.detachPetListener();
        ctx.isPetting = false;
        catEl.dataset.playing = '';
        startPostMealMeowPhase();
      };
      window.addEventListener('cat2:clip-ended', ctx.petEndedListener);
      ctx.armActivityWatchdog('pet', () => {
        clearPostMealHearts();
        ctx.detachPetListener();
        ctx.isPetting = false;
        catEl.dataset.playing = '';
        startPostMealMeowPhase();
      });
    }

    function startPostMealMeowPhase() {
      if (ctx.postMealPhase === 'meow') return;
      ctx.cat2ActivityLog('start', 'meow', { trigger: 'post-meal' });
      ctx.postMealPhase = 'meow';
      ctx.isBusy = true;
      ctx.animLock = true;
      catEl.dataset.playing = 'meow';
      ctx.setExpression('happy', { skipSync: true });
      Cat2Player.cancelPending?.();
      ctx.snapVideoClip();

      ctx.detachMeowListener();
      ctx.meowEndedListener = (ev) => {
        if (ev.detail?.key !== 'meow') return;
        if (ctx.postMealPhase !== 'meow') return;
        completePostMealSequence();
      };
      window.addEventListener('cat2:clip-ended', ctx.meowEndedListener);
      ctx.armActivityWatchdog('meow', completePostMealSequence);
    }

    function completePostMealSequence() {
      if (!ctx.postMealPhase) return;
      ctx.cat2ActivityLog('end', 'post-meal', { phase: ctx.postMealPhase });
      ctx.clearActivityWatchdog();
      clearPostMealHearts();
      ctx.detachMeowListener();
      ctx.postMealPhase = null;
      catEl.dataset.playing = '';
      ctx.isBusy = false;
      ctx.animLock = false;
      feedState.reset('post-meal-complete');

      const meta = ctx.postMealMeta;
      ctx.postMealMeta = null;

      startBowlCooldown();
      ctx.postMealCooldownUntil = Date.now() + 90000;
      ctx.recordActivityStart('meow');

      if (meta) {
        applyFoodMood(meta.liked ? 'good' : 'grumpy');
        ctx.showSpeech(meta.reaction, 5000);
      }

      ctx.setExpression('happy', { skipSync: true });
      ctx.snapVideoClip();
      onFeedCycleComplete();
    }

    function feedCat(foodType) {
      if (ctx.isSleeping || ctx.isEating) return;
      if (CLIP_FLOW_MODE && catEl.dataset.begging !== 'true' && !foodType) return;
      if (!CLIP_FLOW_MODE && isBowlOnCooldown()) return;

      feedState.startResolving();
      ctx.animLock = true;
      ctx.cat2ActivityLog('start', 'eat', { foodType: foodType || 'scheduled' });
      if (ctx.sleepTimeout) clearTimeout(ctx.sleepTimeout);
      catEl.dataset.sleeping = '';
      Cat2Player.cancelPending?.();

      let eatEndedListener = null;

      const finishEating = () => {
        if (!ctx.isEating) return;
        ctx.cat2ActivityLog('end', 'eat');
        if (eatEndedListener) {
          window.removeEventListener('cat2:clip-ended', eatEndedListener);
          eatEndedListener = null;
        }
        if (ctx.eatTimeout) clearTimeout(ctx.eatTimeout);
        ctx.eatTimeout = null;
        ctx.isEating = false;
        catEl.dataset.begging = '';
        catEl.dataset.sleeping = '';
        nomFloat?.classList.remove('show');
        resetBowlPosition();
        ctx.setPose('loaf', { skipSync: true });

        const type = foodType || (Math.random() < 0.5 ? 'plain' : 'fishy');
        const liked = Math.random() < getLikeChance(type);
        updateFoodPref(type, liked);
        updateFoodStars();

        const lines = FOOD_REACTIONS[type][liked ? 'like' : 'dislike'];
        ctx.postMealMeta = { type, liked, reaction: lines[Math.floor(Math.random() * lines.length)] };

        if (CLIP_FLOW_MODE) {
          ctx.hideSpeech();
          feedState.startPostMeal();
          startPostMealPetPhase();
          return;
        }

        stopEating();
        applyFoodMood(liked ? 'good' : 'grumpy');
        if (!CLIP_FLOW_MODE) {
          if (liked) {
            ctx.setExpression('excited');
            ctx.playAnimation('bounce', 550);
            setTimeout(() => ctx.playAnimation('wiggle', 450), 600);
          } else {
            ctx.setExpression('sad');
            ctx.playAnimation('shake', 400);
            setTimeout(() => ctx.playAnimation('shakeHead', 400), 500);
          }
        }
        ctx.showSpeech(ctx.postMealMeta.reaction, 5000);
        ctx.postMealMeta = null;
        onFeedCycleComplete();
      };

      const armEatTimeout = () => {
        if (ctx.eatTimeout) clearTimeout(ctx.eatTimeout);
        ctx.eatTimeout = setTimeout(finishEating, Cat2Clips.getDurationMs('eat') + 900);
      };

      eatEndedListener = (ev) => {
        if (ev.detail?.key !== 'eat') return;
        finishEating();
      };
      window.addEventListener('cat2:clip-ended', eatEndedListener);
      armEatTimeout();

      const onEatVisible = (ev) => {
        if (ev.detail?.key !== 'eat' || !ctx.isEating) return;
        window.removeEventListener('cat2:clip-visible', onEatVisible);
        armEatTimeout();
      };
      window.addEventListener('cat2:clip-visible', onEatVisible);

      feedState.startEating();
      hideFeedPrompt();
      resetBowlPosition();
      ctx.hideSpeech();
      ctx.setPose('eat');
      ctx.setExpression('happy', { skipSync: true });
      ctx.stopActivity();
      ctx.sayDialogue('eatStart', 2800);

      if (CLIP_FLOW_MODE && Cat2Player.getCurrentKey() === 'eat') {
        armEatTimeout();
      }
    }

    function stopEating() {
      if (!ctx.isEating) return;
      if (ctx.eatTimeout) clearTimeout(ctx.eatTimeout);
      ctx.isEating = false;
      ctx.animLock = false;
      feedState.reset('stop-eating');
      catEl.dataset.begging = '';
      catEl.dataset.sleeping = '';
      nomFloat?.classList.remove('show');
      resetBowlPosition();
      ctx.setPose('loaf');
      if (CLIP_FLOW_MODE) {
        ctx.setExpression('happy', { skipSync: true });
        ctx.snapVideoClip();
      } else {
        ctx.setExpression('happy');
      }
    }

    function goToEat() {
      if (ctx.isSleeping || ctx.isEating || ctx.animLock || ctx.isChatOpen() || isBowlOnCooldown()) {
        return;
      }
      begForFood();
    }

    function getBowlCenter() {
      const rect = foodBowl.getBoundingClientRect();
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    }

    function checkBowlNearCat() {
      const bowl = getBowlCenter();
      const mouth = ctx.getCatMouthCenter();
      const dist = Math.hypot(bowl.x - mouth.x, bowl.y - mouth.y);
      if (dist < 45) {
        foodBowl.classList.add('near-cat');
        return true;
      }
      foodBowl.classList.remove('near-cat');
      return false;
    }

    return {
      clearFeedScheduleTimeout,
      clearFeedSchedule,
      hungerMeterColor,
      getHungerProgress,
      updateHungerMeter,
      stopHungerMeterLoop,
      startHungerMeterLoop,
      startHungerMeterCycle,
      clearFeedPromptTimers,
      tryShowFeedPrompt,
      ensureFeedPromptVisible,
      refreshFeedPromptAfterChat,
      scheduleFeedPromptRetry,
      showFeedPrompt,
      onFeedCycleComplete,
      scheduleFeedRequest,
      updateFeedIntervalDuration,
      resumeFeedSchedule,
      getRemainingFeedMs,
      loadBowlCooldown,
      saveBowlCooldown,
      isBowlOnCooldown,
      startBowlCooldown,
      hideFoodBowl,
      showFoodBowl,
      updateBowlVisibility,
      loadFoodPrefs,
      saveFoodPrefs,
      getLikeChance,
      updateFoodPref,
      updateFoodStars,
      applyFoodMood,
      begForFood,
      hideFeedPrompt,
      acceptFood,
      declineFoodAndWalk,
      cancelBegging,
      showFoodChoice,
      hideFoodChoice,
      startPostMealPetPhase,
      startPostMealMeowPhase,
      completePostMealSequence,
      feedCat,
      stopEating,
      goToEat,
      resetBowlPosition,
      getBowlCenter,
      checkBowlNearCat,
      isAwaitingFoodChoice: () => feedState.isAwaitingChoice(),
      isFeedFlowActive: () => feedState.isFlowActive(),
    };
  }

  window.Cat2Feed = { create };
})();
