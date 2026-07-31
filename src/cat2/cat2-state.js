/**
 * Cat 2 feed flow — single source of truth (enum phases, no scattered booleans).
 */
(() => {
  'use strict';

  /** @enum {string} */
  const FeedPhase = Object.freeze({
    IDLE: 'idle',
    HUNGRY: 'hungry',
    PROMPT_OPEN: 'prompt_open',
    RESOLVING: 'resolving',
    EATING: 'eating',
    POST_MEAL: 'post_meal',
  });

  function createFeedStateMachine(catEl, log) {
    let phase = FeedPhase.IDLE;

    function setPhase(next, reason) {
      if (phase === next) return phase;
      const prev = phase;
      phase = next;
      log?.('feed-state', `${prev} → ${next}`, { reason });
      return prev;
    }

    return {
      FeedPhase,
      getPhase: () => phase,

      enterHungry() {
        setPhase(FeedPhase.HUNGRY, 'enterHungry');
        catEl.dataset.begging = 'true';
      },

      /** Prompt visible — replaces awaitingFoodChoice = true */
      openPrompt() {
        if (phase === FeedPhase.IDLE && catEl.dataset.begging === 'true') {
          setPhase(FeedPhase.HUNGRY, 'openPrompt-resync');
        }
        setPhase(FeedPhase.PROMPT_OPEN, 'openPrompt');
        catEl.dataset.begging = 'true';
        return true;
      },

      /** Hide Yes/No but still hungry — replaces awaitingFoodChoice = false */
      closePrompt() {
        if (phase === FeedPhase.PROMPT_OPEN) {
          setPhase(FeedPhase.HUNGRY, 'closePrompt');
          catEl.dataset.begging = 'true';
        }
      },

      startResolving() {
        setPhase(FeedPhase.RESOLVING, 'startResolving');
      },

      startEating() {
        setPhase(FeedPhase.EATING, 'startEating');
        catEl.dataset.begging = '';
      },

      startPostMeal() {
        setPhase(FeedPhase.POST_MEAL, 'startPostMeal');
        catEl.dataset.begging = '';
      },

      reset(reason = 'reset') {
        setPhase(FeedPhase.IDLE, reason);
        catEl.dataset.begging = '';
      },

      cancelBegging() {
        setPhase(FeedPhase.IDLE, 'cancelBegging');
        catEl.dataset.begging = '';
      },

      /** After scheduled feed timer when prior flow finished */
      clearStaleFlow() {
        if (phase === FeedPhase.RESOLVING || phase === FeedPhase.HUNGRY) {
          setPhase(FeedPhase.IDLE, 'clearStaleFlow');
          catEl.dataset.begging = '';
        }
      },

      resyncFromDom({ promptUiVisible = false } = {}) {
        if (promptUiVisible) {
          setPhase(FeedPhase.PROMPT_OPEN, 'resync-ui');
          catEl.dataset.begging = 'true';
          return;
        }
        if (catEl.dataset.begging === 'true' && phase === FeedPhase.IDLE) {
          setPhase(FeedPhase.HUNGRY, 'resync-dom');
        }
      },

      /** Replaces awaitingFoodChoice */
      isAwaitingChoice: () => phase === FeedPhase.PROMPT_OPEN,

      /** Replaces foodFlowActive */
      isFlowActive: () => phase !== FeedPhase.IDLE,

      isHungry: () => phase === FeedPhase.HUNGRY || phase === FeedPhase.PROMPT_OPEN,

      isBegging: () =>
        phase === FeedPhase.HUNGRY ||
        phase === FeedPhase.PROMPT_OPEN ||
        catEl.dataset.begging === 'true',

      canAcceptOrDecline: () =>
        phase === FeedPhase.PROMPT_OPEN ||
        (catEl.dataset.begging === 'true' && phase !== FeedPhase.IDLE && phase !== FeedPhase.EATING),

      shouldBlockSpeech: () => phase === FeedPhase.PROMPT_OPEN,

      isEatingPhase: () => phase === FeedPhase.EATING,

      isPostMealPhase: () => phase === FeedPhase.POST_MEAL,
    };
  }

  window.Cat2State = { FeedPhase, createFeedStateMachine };
})();
