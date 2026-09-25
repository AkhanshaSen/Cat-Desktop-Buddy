/**
 * Meow settings — focus mode, chatty level, reduced motion, break snooze
 */
(() => {
  const STORAGE_KEY = 'meowSettings';

  const isCat2 = () => !!document.getElementById('cat2-canvas-a') ||
    document.getElementById('cat')?.classList.contains('cat2-mode');

  const FEED_INTERVAL_OPTIONS = [2, 5, 10, 15, 30];

  const DEFAULTS = {
    focusMode: false,
    patrolMode: false, // wander/play; no scheduled feed prompts
    chattyLevel: 'normal', // quiet | normal | chatty
    reducedMotion: false,
    snoozeDuration: 30, // minutes: 10 | 30 | 60
    feedIntervalMinutes: 5, // Cat 2: 2 | 5 | 10 | 15 | 30
    catSounds: true, // Cat 2: meow clip audio
  };

  let current = { ...DEFAULTS, focusSession: false };
  let applyingRemote = false;

  // Load persisted values before other scripts read MeowSettings.get()
  load();

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (typeof saved.focusMode === 'boolean') current.focusMode = saved.focusMode;
      if (typeof saved.patrolMode === 'boolean') current.patrolMode = saved.patrolMode;
      if (['quiet', 'normal', 'chatty'].includes(saved.chattyLevel)) {
        current.chattyLevel = saved.chattyLevel;
      }
      if (typeof saved.reducedMotion === 'boolean') current.reducedMotion = saved.reducedMotion;
      if ([10, 30, 60].includes(saved.snoozeDuration)) {
        current.snoozeDuration = saved.snoozeDuration;
      }
      if (FEED_INTERVAL_OPTIONS.includes(saved.feedIntervalMinutes)) {
        current.feedIntervalMinutes = saved.feedIntervalMinutes;
      }
      if (typeof saved.catSounds === 'boolean') {
        current.catSounds = saved.catSounds;
      }
    } catch (_) { /* ignore */ }
  }

  function save() {
    const persisted = { ...current };
    delete persisted.focusSession;
    delete persisted.focusModeFromSession;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(persisted));
  }

  function isFocusLocked() {
    return !!(current.focusMode || current.focusSession);
  }

  function publishModes() {
    if (applyingRemote) return;
    window.meowAPI?.broadcast?.('settings:modes', {
      focusMode: !!current.focusMode,
      patrolMode: !!current.patrolMode && !isFocusLocked(),
      focusSession: !!current.focusSession,
      chattyLevel: current.chattyLevel,
    });
  }

  function get() {
    return { ...current };
  }

  function applyVisuals() {
    document.body.dataset.reducedMotion = current.reducedMotion ? 'true' : '';
    if (!current.reducedMotion) delete document.body.dataset.reducedMotion;

    const focusBadge = document.getElementById('focus-badge');
    if (focusBadge) {
      focusBadge.classList.toggle('hidden', !(current.focusMode || current.focusSession));
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

  function applyQuietToCat() {
    window.MeowCat?.setFocusMode?.(isFocusLocked());
  }

  function applyFocusLink(active) {
    const next = window.MeowProductivityLogic?.nextFocusLink?.(current, active) || {
      focusMode: !!active || !!current.focusMode,
      focusSession: !!active,
      focusModeFromSession: !!active && !current.focusMode,
    };
    current.focusMode = next.focusMode;
    current.focusSession = next.focusSession;
    current.focusModeFromSession = next.focusModeFromSession;
    if (current.focusMode || current.focusSession) current.patrolMode = false;
  }

  function setFocusMode(value, opts = {}) {
    if (!value && current.focusSession && !opts.fromSession) {
      current.focusMode = false;
      current.focusSession = false;
      current.focusModeFromSession = false;
      save();
      notifyChange('focusMode');
      notifyChange('focusSession');
      applyQuietToCat();
      syncUI();
      publishModes();
      window.meowAPI?.broadcast?.('focus:end-from-toggle');
      window.dispatchEvent(new CustomEvent('meow:end-focus-session'));
      return;
    }
    current.focusMode = !!value;
    if (current.focusMode) {
      current.patrolMode = false;
      current.focusModeFromSession = false;
    }
    save();
    notifyChange('focusMode');
    notifyChange('patrolMode');
    applyQuietToCat();
    if (!opts.silent) {
      if (current.focusMode) {
        window.MeowCat?.showSpeech?.('Focus mode — quiet paws. Patrol stays off~ 🌙', 2800);
      } else if (!current.focusSession) {
        window.MeowCat?.showSpeech?.('Focus off — I can wander again if you want~ 🐾', 2500);
      }
    }
    syncUI();
    publishModes();
  }

  function setPatrolMode(value, opts = {}) {
    if (value && isFocusLocked()) {
      current.patrolMode = false;
      save();
      notifyChange('patrolMode');
      syncUI();
      publishModes();
      if (!opts.silent) {
        window.MeowCat?.showSpeech?.('Syrax is focusing — patrol stays off~', 2800);
      }
      return;
    }
    current.patrolMode = !!value;
    if (current.patrolMode) current.focusMode = false;
    save();
    notifyChange('patrolMode');
    notifyChange('focusMode');
    applyQuietToCat();
    if (!opts.silent) {
      if (current.patrolMode) {
        window.MeowCat?.showSpeech?.('Patrol on — I\'ll roam and play~ 🐾', 2500);
      } else {
        window.MeowCat?.showSpeech?.('Patrol off — back to a cozy loaf~', 2500);
      }
    }
    syncUI();
    publishModes();
  }

  /** Focus timer on or off. The Focus mode switch follows the timer. */
  function setFocusSessionActive(active, opts = {}) {
    if (!active && opts.forceOff) {
      current.focusMode = false;
      current.focusSession = false;
      current.focusModeFromSession = false;
    } else {
      applyFocusLink(!!active);
    }
    save();
    notifyChange('focusSession');
    notifyChange('focusMode');
    notifyChange('patrolMode');
    applyQuietToCat();
    syncUI();
    publishModes();
  }

  function applyRemoteModes(payload) {
    if (!payload || applyingRemote) return;
    applyingRemote = true;
    if (typeof payload.focusSession === 'boolean') current.focusSession = payload.focusSession;
    if (typeof payload.focusMode === 'boolean') current.focusMode = payload.focusMode;
    if (isFocusLocked()) current.patrolMode = false;
    else if (typeof payload.patrolMode === 'boolean') current.patrolMode = payload.patrolMode;
    if (['quiet', 'normal', 'chatty'].includes(payload.chattyLevel)) {
      current.chattyLevel = payload.chattyLevel;
    }
    save();
    applyQuietToCat();
    notifyChange('all');
    syncUI();
    applyingRemote = false;
  }

  function setChattyLevel(level) {
    if (!['quiet', 'normal', 'chatty'].includes(level)) return;
    current.chattyLevel = level;
    save();
    notifyChange('chattyLevel');
    syncUI();
    publishModes();
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

  function setFeedIntervalMinutes(mins) {
    if (!FEED_INTERVAL_OPTIONS.includes(mins)) return;
    current.feedIntervalMinutes = mins;
    save();
    notifyChange('feedIntervalMinutes');
    syncUI();
  }

  function setCatSounds(value) {
    current.catSounds = !!value;
    save();
    notifyChange('catSounds');
    syncUI();
  }

  function syncUI() {
    const panel = document.getElementById('settings-panel');
    if (!panel) return;

    const focusToggle = panel.querySelector('#setting-focus');
    if (focusToggle) focusToggle.checked = !!(current.focusMode || current.focusSession);
    const focusHint = panel.querySelector('#focus-settings-hint');
    if (focusHint) {
      focusHint.textContent = current.focusSession
        ? 'On with the focus timer. Turn this off to end the timer.'
        : 'Quiet company. No walks, play, or feed reminders. A focus timer turns this on too.';
    }

    const locked = isFocusLocked();
    const patrolRow = panel.querySelector('#patrol-settings-row');
    patrolRow?.classList.toggle('is-locked', locked);
    const patrolToggle = panel.querySelector('#setting-patrol');
    if (patrolToggle) {
      patrolToggle.checked = locked ? false : current.patrolMode;
      patrolToggle.setAttribute('aria-disabled', locked ? 'true' : 'false');
    }
    const patrolHint = panel.querySelector('#patrol-settings-hint');
    if (patrolHint) {
      patrolHint.textContent = locked
        ? 'Off while Focus mode or a focus timer is on. Syrax stays quiet until that ends.'
        : 'Roam and play across the desktop. No feed reminders. Cannot turn on during Focus.';
    }

    const motionToggle = panel.querySelector('#setting-motion');
    if (motionToggle) motionToggle.checked = current.reducedMotion;

    const soundsToggle = panel.querySelector('#setting-sounds');
    if (soundsToggle) soundsToggle.checked = current.catSounds;

    panel.querySelectorAll('.chatty-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.level === current.chattyLevel);
    });

    panel.querySelectorAll('.snooze-pref-btn').forEach((btn) => {
      btn.classList.toggle('active', Number(btn.dataset.mins) === current.snoozeDuration);
    });

    panel.querySelectorAll('.feed-interval-btn').forEach((btn) => {
      btn.classList.toggle('active', Number(btn.dataset.mins) === current.feedIntervalMinutes);
    });

    window.MeowProductivity?.syncWaterSettingsUi?.();
  }

  function bindCommonSettings(panel) {
    panel.querySelector('#setting-focus')?.addEventListener('change', (e) => {
      e.stopPropagation();
      setFocusMode(e.target.checked);
    });

    panel.querySelector('#setting-patrol')?.addEventListener('change', (e) => {
      e.stopPropagation();
      setPatrolMode(e.target.checked);
    });

    panel.querySelector('#patrol-settings-row')?.addEventListener('pointerdown', (e) => {
      if (!isFocusLocked()) return;
      e.preventDefault();
      e.stopPropagation();
      syncUI();
      window.MeowCat?.showSpeech?.('Syrax is focusing — patrol stays off~', 2800);
    }, true);

    panel.querySelector('#setting-motion')?.addEventListener('change', (e) => {
      e.stopPropagation();
      setReducedMotion(e.target.checked);
    });

    panel.querySelector('#setting-sounds')?.addEventListener('change', (e) => {
      e.stopPropagation();
      setCatSounds(e.target.checked);
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

    panel.querySelectorAll('.feed-interval-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        setFeedIntervalMinutes(Number(btn.dataset.mins));
      });
    });

  }

  function bindAgentSettings(panel) {
    const agentToggle = panel.querySelector('#setting-agent');
    agentToggle?.addEventListener('change', (e) => {
      e.stopPropagation();
      setAgentConfig({ agentEnabled: e.target.checked });
    });

    const keyInput = panel.querySelector('#setting-agent-key');
    keyInput?.addEventListener('keydown', (e) => e.stopPropagation());

    panel.querySelector('#setting-agent-save')?.addEventListener('click', (e) => {
      e.stopPropagation();
      const value = keyInput?.value.trim();
      if (!value) return;
      setAgentConfig({ apiKey: value }, true);
      keyInput.value = '';
    });

    panel.querySelector('#agent-test-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      testGeminiConnection();
    });
  }

  function buildUI() {
    const panel = document.getElementById('settings-panel');
    if (!panel) return;

    if (isCat2()) {
      panel.innerHTML = `
      <p class="settings-section-title">Cat behaviour</p>

      <div class="settings-row">
        <label class="settings-label" for="setting-focus">Focus mode</label>
        <label class="toggle">
          <input type="checkbox" id="setting-focus" ${current.focusMode ? 'checked' : ''} />
          <span class="toggle-slider"></span>
        </label>
      </div>
      <p class="settings-hint" id="focus-settings-hint">Quiet company. No walks, play, or feed reminders. A focus timer turns this on too.</p>

      <div class="settings-row" id="patrol-settings-row">
        <label class="settings-label" for="setting-patrol">Patrol mode</label>
        <label class="toggle">
          <input type="checkbox" id="setting-patrol" ${current.patrolMode && !current.focusMode ? 'checked' : ''} />
          <span class="toggle-slider"></span>
        </label>
      </div>
      <p class="settings-hint" id="patrol-settings-hint">Roam and play across the desktop. No feed reminders. Cannot turn on during Focus.</p>

      <div class="settings-row settings-col">
        <span class="settings-label">Activity level</span>
        <div class="segmented">
          <button type="button" class="chatty-btn${current.chattyLevel === 'quiet' ? ' active' : ''}" data-level="quiet">Quiet</button>
          <button type="button" class="chatty-btn${current.chattyLevel === 'normal' ? ' active' : ''}" data-level="normal">Normal</button>
          <button type="button" class="chatty-btn${current.chattyLevel === 'chatty' ? ' active' : ''}" data-level="chatty">Chatty</button>
        </div>
      </div>
      <p class="settings-hint">Quiet is rare and brief. Normal mixes loaf, walks, and comments. Chatty is frequent. In Patrol, this sets how often Syrax roams.</p>

      <div class="settings-row settings-col">
        <span class="settings-label">Feed me reminder</span>
        <div class="segmented">
          <button type="button" class="feed-interval-btn${current.feedIntervalMinutes === 2 ? ' active' : ''}" data-mins="2">2m</button>
          <button type="button" class="feed-interval-btn${current.feedIntervalMinutes === 5 ? ' active' : ''}" data-mins="5">5m</button>
          <button type="button" class="feed-interval-btn${current.feedIntervalMinutes === 10 ? ' active' : ''}" data-mins="10">10m</button>
          <button type="button" class="feed-interval-btn${current.feedIntervalMinutes === 15 ? ' active' : ''}" data-mins="15">15m</button>
          <button type="button" class="feed-interval-btn${current.feedIntervalMinutes === 30 ? ' active' : ''}" data-mins="30">30m</button>
        </div>
      </div>
      <p class="settings-hint">How long between &ldquo;Please feed me&rdquo; prompts (2&ndash;30 min, after you tap Yes or No)</p>

      <div class="settings-row">
        <label class="settings-label" for="setting-sounds">Cat sounds</label>
        <label class="toggle">
          <input type="checkbox" id="setting-sounds" ${current.catSounds ? 'checked' : ''} />
          <span class="toggle-slider"></span>
        </label>
      </div>
      <p class="settings-hint">Meow sounds during idle mewing animations</p>

      <div class="settings-row">
        <label class="settings-label" for="setting-motion">Reduced motion</label>
        <label class="toggle">
          <input type="checkbox" id="setting-motion" ${current.reducedMotion ? 'checked' : ''} />
          <span class="toggle-slider"></span>
        </label>
      </div>
      <p class="settings-hint">Pauses video clips &mdash; I hold still instead of looping animations</p>

      <div class="settings-row settings-col">
        <span class="settings-label">Break snooze default</span>
        <div class="segmented">
          <button type="button" class="snooze-pref-btn${current.snoozeDuration === 10 ? ' active' : ''}" data-mins="10">10m</button>
          <button type="button" class="snooze-pref-btn${current.snoozeDuration === 30 ? ' active' : ''}" data-mins="30">30m</button>
          <button type="button" class="snooze-pref-btn${current.snoozeDuration === 60 ? ' active' : ''}" data-mins="60">60m</button>
        </div>
      </div>
      <p class="settings-hint">Default snooze after the 2-hour work break speech bubble</p>

      <div class="settings-divider"></div>
      <p class="settings-section-title">Chat &amp; tasks</p>
      <p class="settings-hint">Water reminders: Syrax&rsquo;s panel &rarr; Remind tab</p>
      `;
    } else {
      panel.innerHTML = `
      <div class="settings-row">
        <label class="settings-label" for="setting-focus">Focus mode</label>
        <label class="toggle">
          <input type="checkbox" id="setting-focus" ${current.focusMode ? 'checked' : ''} />
          <span class="toggle-slider"></span>
        </label>
      </div>
      <p class="settings-hint" id="focus-settings-hint">Quiet company. No walks or idle play. A focus timer turns this on too.</p>

      <div class="settings-row" id="patrol-settings-row">
        <label class="settings-label" for="setting-patrol">Patrol mode</label>
        <label class="toggle">
          <input type="checkbox" id="setting-patrol" ${current.patrolMode && !current.focusMode ? 'checked' : ''} />
          <span class="toggle-slider"></span>
        </label>
      </div>
      <p class="settings-hint" id="patrol-settings-hint">Roam and play across the desktop. Cannot turn on during Focus.</p>

      <div class="settings-row settings-col">
        <span class="settings-label">Activity level</span>
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

      <div class="settings-divider"></div>
      <p class="settings-hint">Quiet is rare. Normal is a mix. Chatty is frequent play and comments. In Patrol, this sets how often Syrax roams.</p>
      <p class="settings-hint">Water reminders: Syrax&rsquo;s panel &rarr; Remind tab</p>
      `;
    }

    panel.innerHTML += `

      <div class="settings-row">
        <label class="settings-label" for="setting-agent">Let Meow do tasks</label>
        <label class="toggle">
          <input type="checkbox" id="setting-agent" />
          <span class="toggle-slider"></span>
        </label>
      </div>
      <p class="settings-hint">Ask me to open apps like "open notepad", "open the camera", "open maps", or "open google.com"</p>

      <div class="settings-row settings-col">
        <span class="settings-label">Gemini API key <span class="settings-optional">(optional)</span></span>
        <div class="agent-key-row">
          <input type="password" id="setting-agent-key" class="agent-key-input" placeholder="AIza..." autocomplete="off" spellcheck="false" />
          <button type="button" id="setting-agent-save" class="agent-key-save">Save</button>
        </div>
      </div>
      <p class="settings-hint">Common commands work offline for free. Add a Gemini key for natural chat and requests like "pull up something to write in".</p>
      <div class="settings-row">
        <button type="button" id="agent-test-btn" class="agent-key-save">Test Gemini</button>
      </div>
      <p id="agent-status" class="agent-status"></p>
    `;

    bindCommonSettings(panel);
    bindAgentSettings(panel);
    refreshAgentStatus();
    window.MeowProductivity?.syncWaterSettingsUi?.();
  }

  function setAgentConfig(partial, retest = false) {
    window.meowAPI?.setAgentConfig?.(partial).then(() => {
      if (retest) return testGeminiConnection();
      return window.meowAPI?.getAgentConfig?.();
    }).then(applyAgentStatus).catch(() => {});
  }

  async function testGeminiConnection() {
    const status = document.querySelector('#agent-status');
    if (status) status.textContent = 'Testing Gemini… looping models…';

    try {
      const health = await window.meowAPI?.testGemini?.();
      const cfg = await window.meowAPI?.getAgentConfig?.();
      applyAgentStatus(cfg, health);
    } catch (_) {
      if (status) status.textContent = 'Test failed — try again.';
    }
  }

  function refreshAgentStatus() {
    window.meowAPI?.getAgentConfig?.().then(applyAgentStatus).catch(() => {});
  }

  function applyAgentStatus(cfg, healthOverride) {
    if (!cfg) return;
    const panel = document.getElementById('settings-panel');
    if (!panel) return;

    const toggle = panel.querySelector('#setting-agent');
    if (toggle) toggle.checked = !!cfg.agentEnabled;

    const health = healthOverride || cfg.geminiHealth;
    const status = panel.querySelector('#agent-status');
    if (status) {
      if (!cfg.agentEnabled) {
        status.textContent = 'Tasks off — I\'ll just chat.';
      } else if (!cfg.hasApiKey) {
        status.textContent = 'Offline mode — common commands work now.';
      } else if (health?.ok) {
        status.textContent = `Gemini connected (${health.model || cfg.model}). ✨`;
      } else if (health?.reason === 'quota') {
        status.textContent = 'Key saved, but free quota is used up — wait and tap Test Gemini again. ⏳';
      } else if (health?.reason === 'auth') {
        status.textContent = 'Gemini key rejected — paste a new one from aistudio.google.com. 🔑';
      } else if (health?.reason === 'network') {
        status.textContent = 'Couldn\'t reach Gemini — check your internet. 🌐';
      } else if (health?.message) {
        status.textContent = `Gemini issue: ${health.message.slice(0, 80)}`;
      } else {
        status.textContent = 'Key saved — tap Test Gemini to check connection.';
      }
    }
  }

  function init() {
    applyVisuals();
    buildUI();
    notifyChange('all');
  }

  window.meowAPI?.onBroadcast?.((channel, payload) => {
    if (channel === 'settings:modes') applyRemoteModes(payload);
  });

  window.MeowSettings = {
    get,
    load,
    isFocusLocked,
    setFocusMode,
    setPatrolMode,
    setFocusSessionActive,
    setChattyLevel,
    setReducedMotion,
    setSnoozeDuration,
    setFeedIntervalMinutes,
    setCatSounds,
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
