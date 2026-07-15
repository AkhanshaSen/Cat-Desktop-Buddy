/**
 * Meow settings — focus mode, chatty level, reduced motion, break snooze
 */
(() => {
  const STORAGE_KEY = 'meowSettings';

  const DEFAULTS = {
    focusMode: false,
    chattyLevel: 'normal', // quiet | normal | chatty
    reducedMotion: false,
    snoozeDuration: 30, // minutes: 10 | 30 | 60
  };

  let current = { ...DEFAULTS };

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (typeof saved.focusMode === 'boolean') current.focusMode = saved.focusMode;
      if (['quiet', 'normal', 'chatty'].includes(saved.chattyLevel)) {
        current.chattyLevel = saved.chattyLevel;
      }
      if (typeof saved.reducedMotion === 'boolean') current.reducedMotion = saved.reducedMotion;
      if ([10, 30, 60].includes(saved.snoozeDuration)) {
        current.snoozeDuration = saved.snoozeDuration;
      }
    } catch (_) { /* ignore */ }
  }

  function save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
  }

  function get() {
    return { ...current };
  }

  function applyVisuals() {
    document.body.dataset.reducedMotion = current.reducedMotion ? 'true' : '';
    if (!current.reducedMotion) delete document.body.dataset.reducedMotion;

    const focusBadge = document.getElementById('focus-badge');
    if (focusBadge) {
      focusBadge.classList.toggle('hidden', !current.focusMode);
    }

    window.meowSettings = get();
  }

  function notifyChange(key) {
    applyVisuals();
    window.dispatchEvent(new CustomEvent('meow:settings', { detail: { key, settings: get() } }));

    if (key === 'snoozeDuration' || key === 'all') {
      window.meowAPI?.updateSettings?.({
        snoozeDuration: current.snoozeDuration,
      });
    }
  }

  function setFocusMode(value) {
    current.focusMode = !!value;
    save();
    notifyChange('focusMode');
    window.MeowCat?.setFocusMode?.(current.focusMode);
    if (current.focusMode) {
      window.MeowCat?.showSpeech?.('Focus mode on — quiet paws~ 🌙', 2500);
    } else {
      window.MeowCat?.showSpeech?.('Focus off — I can chat again! 🐾', 2500);
    }
    syncUI();
  }

  function setChattyLevel(level) {
    if (!['quiet', 'normal', 'chatty'].includes(level)) return;
    current.chattyLevel = level;
    save();
    notifyChange('chattyLevel');
    syncUI();
  }

  function setReducedMotion(value) {
    current.reducedMotion = !!value;
    save();
    notifyChange('reducedMotion');
    syncUI();
  }

  function setSnoozeDuration(mins) {
    if (![10, 30, 60].includes(mins)) return;
    current.snoozeDuration = mins;
    save();
    notifyChange('snoozeDuration');
    syncUI();
  }

  function syncUI() {
    const panel = document.getElementById('settings-panel');
    if (!panel) return;

    const focusToggle = panel.querySelector('#setting-focus');
    if (focusToggle) focusToggle.checked = current.focusMode;

    const motionToggle = panel.querySelector('#setting-motion');
    if (motionToggle) motionToggle.checked = current.reducedMotion;

    panel.querySelectorAll('.chatty-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.level === current.chattyLevel);
    });

    panel.querySelectorAll('.snooze-pref-btn').forEach((btn) => {
      btn.classList.toggle('active', Number(btn.dataset.mins) === current.snoozeDuration);
    });
  }

  function buildUI() {
    const panel = document.getElementById('settings-panel');
    if (!panel) return;

    panel.innerHTML = `
      <div class="settings-row">
        <label class="settings-label" for="setting-focus">Focus mode</label>
        <label class="toggle">
          <input type="checkbox" id="setting-focus" ${current.focusMode ? 'checked' : ''} />
          <span class="toggle-slider"></span>
        </label>
      </div>
      <p class="settings-hint">Pauses idle interruptions while you work</p>

      <div class="settings-row settings-col">
        <span class="settings-label">Chatty level</span>
        <div class="segmented">
          <button type="button" class="chatty-btn${current.chattyLevel === 'quiet' ? ' active' : ''}" data-level="quiet">Quiet</button>
          <button type="button" class="chatty-btn${current.chattyLevel === 'normal' ? ' active' : ''}" data-level="normal">Normal</button>
          <button type="button" class="chatty-btn${current.chattyLevel === 'chatty' ? ' active' : ''}" data-level="chatty">Chatty</button>
        </div>
      </div>

      <div class="settings-row">
        <label class="settings-label" for="setting-motion">Reduced motion</label>
        <label class="toggle">
          <input type="checkbox" id="setting-motion" ${current.reducedMotion ? 'checked' : ''} />
          <span class="toggle-slider"></span>
        </label>
      </div>
      <p class="settings-hint">Fewer animations &amp; no sparkle bursts</p>

      <div class="settings-row settings-col">
        <span class="settings-label">Break snooze default</span>
        <div class="segmented">
          <button type="button" class="snooze-pref-btn${current.snoozeDuration === 10 ? ' active' : ''}" data-mins="10">10m</button>
          <button type="button" class="snooze-pref-btn${current.snoozeDuration === 30 ? ' active' : ''}" data-mins="30">30m</button>
          <button type="button" class="snooze-pref-btn${current.snoozeDuration === 60 ? ' active' : ''}" data-mins="60">60m</button>
        </div>
      </div>
    `;

    panel.querySelector('#setting-focus')?.addEventListener('change', (e) => {
      e.stopPropagation();
      setFocusMode(e.target.checked);
    });

    panel.querySelector('#setting-motion')?.addEventListener('change', (e) => {
      e.stopPropagation();
      setReducedMotion(e.target.checked);
    });

    panel.querySelectorAll('.chatty-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        setChattyLevel(btn.dataset.level);
      });
    });

    panel.querySelectorAll('.snooze-pref-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        setSnoozeDuration(Number(btn.dataset.mins));
      });
    });
  }

  function init() {
    load();
    applyVisuals();
    buildUI();
    notifyChange('all');
  }

  window.MeowSettings = {
    get,
    load,
    setFocusMode,
    setChattyLevel,
    setReducedMotion,
    setSnoozeDuration,
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
