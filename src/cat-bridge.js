/**
 * Cat window bridge — relays local events to the panel overlay via IPC broadcast.
 * Runs only in the cat pet window (not the overlay).
 */
(() => {
  const IS_OVERLAY = !!window.MEOW_PANEL_OVERLAY
    || document.body?.classList?.contains('panel-overlay-root')
    || /index-panels\.html/i.test(String(location?.href || ''));
  if (IS_OVERLAY) return;

  // Cat body click: docked chat toggles open/close; otherwise hub on overlay
  window.addEventListener('meow:click', () => {
    if (window.MeowChat?.isDocked?.()) {
      window.meowAPI?.log?.('cat click → chat toggle (docked)');
      window.MeowChat.toggle();
      return;
    }
    window.meowAPI?.log?.('cat click → hub:toggle');
    window.meowAPI?.broadcast?.('hub:toggle');
  });

  function setWaterBubbleVisible(active) {
    const bubble = document.getElementById('water-chase-bubble');
    if (!bubble) return;
    bubble.classList.toggle('hidden', !active);
    if (active) {
      window.MeowCat?.hideSpeech?.();
      const text = document.getElementById('water-chase-text');
      if (text) text.textContent = 'found you. drink water.';
    }
  }

  document.getElementById('water-ack-btn')?.addEventListener('click', (e) => {
    e.stopPropagation();
    setWaterBubbleVisible(false);
    window.meowAPI?.broadcast?.('water:ack');
  });
  document.getElementById('water-snooze-btn')?.addEventListener('click', (e) => {
    e.stopPropagation();
    setWaterBubbleVisible(false);
    window.meowAPI?.broadcast?.('water:snooze');
  });
  const waterBubble = document.getElementById('water-chase-bubble');
  waterBubble?.addEventListener('pointerenter', () => {
    window.meowAPI?.broadcast?.('water:chase-pause', { paused: true });
  });
  waterBubble?.addEventListener('pointerleave', () => {
    window.meowAPI?.broadcast?.('water:chase-pause', { paused: false });
  });

  // Forward water-chase / focus events from overlay into local CustomEvents for cat anim
  window.meowAPI?.onBroadcast?.((channel, payload) => {
    window.meowAPI?.log?.('cat recv', channel, payload ?? '');
    if (channel === 'water-chase') {
      setWaterBubbleVisible(!!payload?.active);
      window.dispatchEvent(new CustomEvent('meow:water-chase', { detail: payload || {} }));
    } else if (channel === 'water-chase-face') {
      window.dispatchEvent(new CustomEvent('meow:water-chase-face', { detail: payload || {} }));
    } else if (channel === 'focus-session') {
      window.dispatchEvent(new CustomEvent('meow:focus-session', { detail: payload || {} }));
    } else if (channel === 'cat:say' && payload?.text) {
      window.MeowCat?.showSpeech?.(payload.text, payload.duration || 3500);
    } else if (channel === 'cat:hide-speech') {
      window.MeowCat?.hideSpeech?.();
    } else if (channel === 'cat:expression' && payload?.expr) {
      window.MeowCat?.setExpression?.(payload.expr);
    } else if (channel === 'cat:sleep' && payload?.ms) {
      if (window.MeowCat?.goToSleepClip) {
        window.MeowCat.goToSleepClip(payload.ms, { force: true });
      } else {
        window.MeowCat?.goToSleep?.(payload.ms);
      }
    } else if (channel === 'cat:wake') {
      window.MeowCat?.wakeUp?.();
    } else if (channel === 'cat:celebrate') {
      window.MeowCat?.wakeUp?.();
      window.MeowCat?.setExpression?.('excited');
      window.MeowCat?.bounce?.();
    } else if (channel === 'chat:open') {
      window.MeowChat?.open?.(payload?.tab || 'chat');
    } else if (channel === 'hub:visibility') {
      window.dispatchEvent(new CustomEvent('meow:hub-visibility', { detail: payload || {} }));
    }
  });
})();
