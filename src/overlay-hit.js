/**
 * Click-through for transparent overlay / cat windows.
 * Overlay: ignore mouse by default; capture over interactive UI.
 * Cat window: never ignore — compact pet must always receive clicks.
 */
(() => {
  const IS_OVERLAY = !!window.MEOW_PANEL_OVERLAY
    || document.body?.classList?.contains('panel-overlay-root')
    || /index-panels\.html/i.test(String(location?.href || ''));

  const HIT_SELECTORS = [
    '.productivity-hub',
    '.pinned-tasks-widget',
    '.focus-timer-widget',
    '.chat-panel',
    '.water-chase-bubble',
    '.break-alert',
    '#cat',
    '#cat-container',
    '#speech-bubble',
    '#food-choice',
    '#scratch-stop-prompt',
    '#food-bowl',
    '#quit-btn',
    '#focus-badge',
    '#pet-zone-head',
    '.context-menu',
    '.hub-drag-handle',
    '.focus-timer-drag',
    '.pinned-drag-handle',
  ].join(',');

  let ignoring = true;
  let forceCapture = false;
  let lastSent = true;
  let rafPending = false;

  function isInteractiveTarget(el) {
    if (!el || el === document.documentElement || el === document.body) return false;
    if (el.closest?.(HIT_SELECTORS)) return true;
    if (el.closest?.('input, textarea, select, button, a, label, [role="button"]')) return true;
    return false;
  }

  function setIgnore(next) {
    // Cat pet window must always receive clicks
    if (!IS_OVERLAY) next = false;
    if (next === lastSent) return;
    lastSent = next;
    ignoring = next;
    window.meowAPI?.setIgnoreMouseEvents?.(next);
  }

  function refreshFromPoint(x, y) {
    if (!IS_OVERLAY) {
      setIgnore(false);
      return;
    }
    if (forceCapture || document.activeElement?.matches?.('input, textarea, select')) {
      setIgnore(false);
      return;
    }
    const stack = document.elementsFromPoint(x, y);
    const hit = stack.some((el) => isInteractiveTarget(el));
    setIgnore(!hit);
  }

  function onPointerMove(e) {
    if (!IS_OVERLAY) return;
    if (rafPending) return;
    rafPending = true;
    const { clientX, clientY } = e;
    requestAnimationFrame(() => {
      rafPending = false;
      refreshFromPoint(clientX, clientY);
    });
  }

  function onPointerDown(e) {
    if (!IS_OVERLAY) return;
    if (isInteractiveTarget(e.target)) {
      forceCapture = true;
      setIgnore(false);
    }
  }

  function onPointerUp() {
    if (!IS_OVERLAY) return;
    forceCapture = false;
    const ev = window.__meowLastPointer;
    if (ev) refreshFromPoint(ev.x, ev.y);
    else setIgnore(true);
  }

  function trackPointer(e) {
    window.__meowLastPointer = { x: e.clientX, y: e.clientY };
  }

  function init() {
    if (!window.meowAPI?.setIgnoreMouseEvents) return;
    window.meowAPI?.log?.('overlay-hit init', { isOverlay: IS_OVERLAY });
    setIgnore(IS_OVERLAY); // overlay starts pass-through; cat stays clickable
    if (!IS_OVERLAY) return;

    window.addEventListener('pointermove', (e) => {
      trackPointer(e);
      onPointerMove(e);
    }, true);
    window.addEventListener('pointerdown', onPointerDown, true);
    window.addEventListener('pointerup', onPointerUp, true);
    window.addEventListener('pointercancel', onPointerUp, true);
    window.addEventListener('blur', () => {
      forceCapture = false;
      setIgnore(true);
    });
    document.addEventListener('focusin', (e) => {
      if (e.target?.matches?.('input, textarea, select')) setIgnore(false);
    });
    document.addEventListener('focusout', () => {
      setTimeout(() => {
        if (!document.activeElement?.matches?.('input, textarea, select')) {
          const p = window.__meowLastPointer;
          if (p) refreshFromPoint(p.x, p.y);
          else setIgnore(true);
        }
      }, 0);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.MeowOverlayHit = { refreshFromPoint, setIgnore };
})();
