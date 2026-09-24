/**
 * Productivity UI — Polen-style hub (Tasks / Remind / Focus), water chase, focus timer.
 * Depends on MeowProductivityLogic, MeowCat, MeowSettings, meowAPI.
 */
(() => {
  const Logic = window.MeowProductivityLogic;
  if (!Logic) {
    console.error('[Meow] productivity-logic.js must load before productivity.js');
    return;
  }

  const TASKS_KEY = 'meowTasks';
  const WATER_KEY = 'meowWater';
  const PROD_SETTINGS_KEY = 'meowProductivitySettings';

  const isOverlay = () =>
    !!window.MEOW_PANEL_OVERLAY
    || document.body?.classList?.contains('panel-overlay-root')
    || /index-panels\.html/i.test(String(location?.href || ''));

  const isCat2 = () =>
    isOverlay()
      ? true /* panels shell is shared; cat2 sizing only matters for cat window */
      : (!!document.getElementById('cat2-canvas-a') ||
        document.getElementById('cat')?.classList.contains('cat2-mode'));

  const CAT_W = 220;
  const HUB_W = 240;
  const CAT1_H = 240;
  const CAT2_H = 460;
  const FOCUS_SPRING_SRC = '../assets/sounds/focus-spring.mp3';

  function meowLog(...args) {
    try {
      window.meowAPI?.log?.(...args);
    } catch (_) {
      console.log('[Meow]', ...args);
    }
  }

  const DEFAULT_WATER = {
    enabled: true,
    intervalMinutes: 45,
    lastDrinkAt: 0,
    snoozeUntil: 0,
  };

  const DEFAULT_PROD = {
    notesVisible: false,
    activeTab: 'tasks',
    taskDay: 'today',
    focusTimerSize: 'M',
    tasksWidgetPinned: false,
    focusRain: false,
    focusMinutes: 25,
    screenPositions: {
      hub: { x: null, y: null },
      pinned: { x: null, y: null },
      timer: { x: null, y: null },
      chat: { x: null, y: null },
    },
  };

  let taskStore = Logic.normalizeTaskStore(null);
  let waterState = { ...DEFAULT_WATER };
  let prodPrefs = { ...DEFAULT_PROD };

  let focusSession = null;
  let focusTickTimer = null;
  let waterTickTimer = null;
  let chaseActive = false;
  let chaseRaf = null;
  let chasePaused = false;
  let chaseLastPlacementSync = 0;
  let chaseLastTick = 0;
  let chaseCursor = null;
  let chaseCursorSmooth = null;
  let chasePlacement = null;
  let chaseCursorFetchInFlight = false;
  let chaseMotion = { velX: 0, velY: 0, fracX: 0, fracY: 0, lastFaceDir: 1 };

  const CHASE_OPTS = {
    maxSpeed: 34,
    steer: 0.44,
    damping: 0.8,
    arrive: 6,
    nearRadius: 52,
    cursorSmoothAlpha: 0.42,
    placementResyncMs: 250,
  };
  let taskNudgeTimer = null;
  let quietAutoEnabled = false;
  let panelDrag = null;
  let focusSpringAudio = null;

  function loadJson(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      return JSON.parse(raw);
    } catch (_) {
      return fallback;
    }
  }

  function saveJson(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function loadAll() {
    taskStore = Logic.normalizeTaskStore(loadJson(TASKS_KEY, null));
    const w = loadJson(WATER_KEY, null);
    waterState = {
      enabled: typeof w?.enabled === 'boolean' ? w.enabled : DEFAULT_WATER.enabled,
      intervalMinutes: Logic.normalizeWaterIntervalId(w?.intervalMinutes),
      lastDrinkAt: Number.isFinite(w?.lastDrinkAt) && w.lastDrinkAt > 0
        ? w.lastDrinkAt
        : Date.now(),
      snoozeUntil: Number.isFinite(w?.snoozeUntil) ? w.snoozeUntil : 0,
    };
    const p = loadJson(PROD_SETTINGS_KEY, null);
    const migratedPin = !!(p?.tasksWidgetPinned ?? taskStore.notesPinned);
    prodPrefs = {
      notesVisible: !!(p?.notesVisible),
      activeTab: ['tasks', 'remind', 'focus'].includes(p?.activeTab) ? p.activeTab : 'tasks',
      taskDay: p?.taskDay === 'tomorrow' ? 'tomorrow' : 'today',
      focusTimerSize: Logic.normalizeFocusTimerSize(p?.focusTimerSize),
      tasksWidgetPinned: migratedPin,
      focusRain: !!p?.focusRain,
      focusMinutes: Logic.normalizeFocusMinutes(p?.focusMinutes ?? 25, true),
      screenPositions: Logic.normalizeScreenPositions(p || {}, DEFAULT_PROD.screenPositions),
    };
    if (migratedPin && taskStore.notesPinned) {
      taskStore.notesPinned = false;
    }
    saveTasks();
    saveWater();
    saveProdPrefs();
  }

  function saveTasks() {
    saveJson(TASKS_KEY, taskStore);
  }

  function saveWater() {
    saveJson(WATER_KEY, waterState);
  }

  function saveProdPrefs() {
    saveJson(PROD_SETTINGS_KEY, prodPrefs);
  }

  function getSettings() {
    return window.MeowSettings?.get?.() || {};
  }

  function isChatOpen() {
    // Chat lives on the cat window — overlay has no #chat-panel.
    // Missing panel must mean "closed", otherwise !undefined is always true
    // and water reminders never fire.
    const panel = document.getElementById('chat-panel');
    if (!panel) return false;
    return !panel.classList.contains('hidden');
  }

  function isBreakActive() {
    if (isOverlay()) return false;
    return !document.getElementById('break-alert')?.classList.contains('hidden');
  }

  function isPatrolModeActive() {
    return !!getSettings().patrolMode && !getSettings().focusMode;
  }

  function shouldSuppressIdle() {
    return !!(focusSession || chaseActive);
  }

  function isFocusSessionActive() {
    return !!focusSession;
  }

  function isWaterChaseActive() {
    return !!chaseActive;
  }

  function compactHeight() {
    // Cat window only — overlay does not resize
    const catEl = document.getElementById('cat');
    const cat2 = !!document.getElementById('cat2-canvas-a') ||
      catEl?.classList.contains('cat2-mode');
    return cat2 ? CAT2_H : CAT1_H;
  }

  function hubOpen() {
    return !!prodPrefs.notesVisible;
  }

  function pinnedWidgetOpen() {
    return !!prodPrefs.tasksWidgetPinned;
  }

  function desiredWindowSize() {
    return { width: CAT_W, height: compactHeight() };
  }

  function syncStackLayout() {
    if (!isOverlay()) {
      applyWindowSize();
      return;
    }
    const stack = document.getElementById('buddy-stack');
    stack?.classList.toggle('hub-chat-open', hubOpen() && isChatOpen());
    requestAnimationFrame(refreshPanelFloats);
  }

  function refreshPanelFloats() {
    if (!isOverlay()) return;
    const hub = document.getElementById('productivity-hub');
    const pinned = document.getElementById('pinned-tasks-widget');
    const timer = document.getElementById('focus-timer-widget');
    if (hub && !hub.classList.contains('hidden')) applyPanelFloat(hub, 'hub');
    if (pinned && !pinned.classList.contains('hidden')) applyPanelFloat(pinned, 'pinned');
    if (timer && !timer.classList.contains('hidden')) applyPanelFloat(timer, 'timer');
  }

  let overlayBoundsCache = null;
  let overlayBoundsFetchedAt = 0;

  async function fetchOverlayBounds() {
    const now = Date.now();
    if (overlayBoundsCache && now - overlayBoundsFetchedAt < 2000) {
      return overlayBoundsCache;
    }
    try {
      const b = await window.meowAPI?.getOverlayBounds?.();
      if (b) {
        overlayBoundsCache = b;
        overlayBoundsFetchedAt = now;
        return b;
      }
    } catch (_) { /* ignore */ }
    return overlayBoundsCache || {
      x: 0,
      y: 0,
      width: window.innerWidth || 1280,
      height: window.innerHeight || 800,
    };
  }

  function applyWindowSize() {
    if (isOverlay()) return;
    const chatOpen = !document.getElementById('chat-panel')?.classList.contains('hidden');
    const cat2 = !!document.getElementById('cat2-canvas-a')
      || document.getElementById('cat')?.classList.contains('cat2-mode');
    if (cat2) {
      // Chat stacks above the cat inside the fixed Cat2 window
      window.meowAPI?.resizeWindow?.(CAT_W, CAT2_H, false);
      return;
    }
    const h = chatOpen ? 442 : CAT1_H;
    window.meowAPI?.resizeWindow?.(CAT_W, h, true);
  }

  function broadcast(channel, payload) {
    window.meowAPI?.broadcast?.(channel, payload);
  }

  function say(text, duration = 3500) {
    if (isOverlay()) {
      broadcast('cat:say', { text, duration });
      return;
    }
    window.MeowCat?.showSpeech?.(text, duration);
  }

  function hideSpeech() {
    if (isOverlay()) {
      broadcast('cat:hide-speech');
      return;
    }
    window.MeowCat?.hideSpeech?.();
  }

  function catSetExpression(expr) {
    if (isOverlay()) {
      broadcast('cat:expression', { expr });
      return;
    }
    window.MeowCat?.setExpression?.(expr);
  }

  function catSleep(ms) {
    if (isOverlay()) {
      broadcast('cat:sleep', { ms });
      return;
    }
    if (window.MeowCat?.goToSleepClip) {
      window.MeowCat.goToSleepClip(ms, { force: true });
    } else {
      window.MeowCat?.goToSleep?.(ms);
    }
  }

  /* ── Tasks (today / tomorrow) ── */

  function activeDayItems() {
    taskStore = Logic.normalizeTaskStore(taskStore);
    return prodPrefs.taskDay === 'tomorrow' ? taskStore.tomorrow.items : taskStore.today.items;
  }

  function uncheckedCount(day) {
    taskStore = Logic.normalizeTaskStore(taskStore);
    const items = day === 'tomorrow' ? taskStore.tomorrow.items : taskStore.today.items;
    return items.filter((t) => !t.done).length;
  }

  function addTask(text, day) {
    const trimmed = String(text || '').trim().slice(0, 120);
    if (!trimmed) return;
    taskStore = Logic.normalizeTaskStore(taskStore);
    const bucket = (day || prodPrefs.taskDay) === 'tomorrow' ? taskStore.tomorrow : taskStore.today;
    bucket.items.push({
      id: `t-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      text: trimmed,
      done: false,
    });
    saveTasks();
    renderAllTasks();
  }

  function toggleTask(id) {
    taskStore = Logic.normalizeTaskStore(taskStore);
    const todayUncheckedBefore = uncheckedCount('today');
    for (const bucket of [taskStore.today, taskStore.tomorrow]) {
      const item = bucket.items.find((t) => t.id === id);
      if (item) {
        const markingDone = !item.done;
        item.done = !item.done;
        saveTasks();
        renderAllTasks();
        if (markingDone && bucket === taskStore.today) {
          celebrateTodayIfComplete(todayUncheckedBefore);
        }
        return;
      }
    }
  }

  /** When the last today task is checked off, cat congratulates. */
  function celebrateTodayIfComplete(uncheckedBefore) {
    const items = taskStore.today?.items || [];
    if (!items.length || uncheckedBefore <= 0) return;
    if (items.some((t) => !t.done)) return;
    meowLog('celebrateTodayComplete', { count: items.length });
    const lines = [
      `All ${items.length} done! You're amazing~ 🎉`,
      "Today's list is clear! High five! 🐾✨",
      'Everything checked off! Proud of you~ 🌟',
      'Finished the whole list! Treat yourself~ 💕',
    ];
    say(lines[Math.floor(Math.random() * lines.length)], 4500);
    catSetExpression('excited');
    broadcast('cat:celebrate');
  }

  function removeTask(id) {
    taskStore = Logic.normalizeTaskStore(taskStore);
    taskStore.today.items = taskStore.today.items.filter((t) => t.id !== id);
    taskStore.tomorrow.items = taskStore.tomorrow.items.filter((t) => t.id !== id);
    saveTasks();
    renderAllTasks();
  }

  function setTasksWidgetPinned(pinned) {
    prodPrefs.tasksWidgetPinned = !!pinned;
    taskStore.notesPinned = false;
    // Pin = detach: close the full panel so only the mini widget remains
    if (pinned) {
      prodPrefs.notesVisible = false;
    }
    saveTasks();
    saveProdPrefs();
    syncHubVisibility();
    renderPinnedTasks();
  }

  function setNotesVisible(visible) {
    meowLog('setNotesVisible', !!visible);
    prodPrefs.notesVisible = !!visible;
    saveProdPrefs();
    syncHubVisibility();
  }

  function toggleHub() {
    meowLog('toggleHub', { wasOpen: hubOpen() });
    if (hubOpen()) {
      setNotesVisible(false);
    } else {
      openHub(prodPrefs.activeTab || 'tasks');
    }
  }

  function toggleNotesPanel() {
    toggleHub();
  }

  function openHub(tab) {
    meowLog('openHub', tab || prodPrefs.activeTab);
    prodPrefs.notesVisible = true;
    if (tab) prodPrefs.activeTab = tab;
    saveProdPrefs();
    syncHubVisibility();
    setHubTab(prodPrefs.activeTab);
  }

  function setHubTab(tab) {
    if (!['tasks', 'remind', 'focus'].includes(tab)) tab = 'tasks';
    meowLog('setHubTab', tab);
    prodPrefs.activeTab = tab;
    saveProdPrefs();
    document.querySelectorAll('.hub-tab').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.tab === tab);
    });
    document.querySelectorAll('.hub-pane').forEach((pane) => {
      pane.classList.toggle('hidden', pane.dataset.pane !== tab);
    });
    if (tab === 'remind') syncWaterSettingsUi();
    if (tab === 'focus') syncFocusPaneUi();
  }

  function setTaskDay(day) {
    prodPrefs.taskDay = day === 'tomorrow' ? 'tomorrow' : 'today';
    saveProdPrefs();
    document.querySelectorAll('.hub-day-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.day === prodPrefs.taskDay);
    });
    renderAllTasks();
  }

  function syncHubVisibility() {
    const hub = document.getElementById('productivity-hub');
    const pinned = document.getElementById('pinned-tasks-widget');
    const stack = document.getElementById('buddy-stack');
    const showHub = hubOpen();
    // Pinned mini-widget only while hub is closed (avoids duplicate task lists)
    const showPinned = pinnedWidgetOpen() && !showHub;
    meowLog('syncHubVisibility', { showHub, showPinned });
    hub?.classList.toggle('hidden', !showHub);
    pinned?.classList.toggle('hidden', !showPinned);
    stack?.classList.toggle('notes-open', !!(showHub || showPinned));
    stack?.classList.toggle('hub-open', !!showHub);
    stack?.classList.toggle('pinned-tasks-open', !!showPinned);
    stack?.classList.toggle('hub-chat-open', showHub && isChatOpen());
    const pinTodayBtn = document.getElementById('hub-pin-today-btn');
    if (pinTodayBtn) {
      pinTodayBtn.classList.toggle('active', !!prodPrefs.tasksWidgetPinned);
      pinTodayBtn.setAttribute('aria-pressed', prodPrefs.tasksWidgetPinned ? 'true' : 'false');
      pinTodayBtn.textContent = prodPrefs.tasksWidgetPinned ? 'unpin today' : 'pin today';
    }
    if (showHub) setHubTab(prodPrefs.activeTab);
    if (showPinned) renderPinnedTasks();
    syncStackLayout();
    broadcast('hub:visibility', { showHub, showPinned });
  }

  function makeTaskRow(item) {
    const row = document.createElement('div');
    row.className = `hub-task-item${item.done ? ' done' : ''}`;

    const check = document.createElement('button');
    check.type = 'button';
    check.className = 'hub-task-check';
    check.title = item.done ? 'Mark incomplete' : 'Mark done';
    check.textContent = item.done ? '✓' : '';
    check.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleTask(item.id);
    });

    const label = document.createElement('span');
    label.className = 'hub-task-text';
    label.textContent = item.text;

    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'hub-task-del';
    del.title = 'Remove';
    del.textContent = '×';
    del.addEventListener('click', (e) => {
      e.stopPropagation();
      removeTask(item.id);
    });

    row.appendChild(check);
    row.appendChild(label);
    row.appendChild(del);
    return row;
  }

  function renderTaskList(listEl, items, emptyEl, emptyText) {
    if (!listEl) return;
    listEl.innerHTML = '';
    const { active, finished } = Logic.partitionTasks(items);
    if (items.length === 0) {
      emptyEl?.classList.remove('hidden');
      if (emptyEl) emptyEl.textContent = emptyText;
      return;
    }
    emptyEl?.classList.add('hidden');
    active.forEach((item) => listEl.appendChild(makeTaskRow(item)));
    if (finished.length > 0) {
      const heading = document.createElement('div');
      heading.className = 'hub-finished-heading';
      heading.textContent = 'Finished';
      listEl.appendChild(heading);
      finished.forEach((item) => listEl.appendChild(makeTaskRow(item)));
    }
  }

  function updateProgressUi(progressId, fillId, items) {
    const progress = document.getElementById(progressId);
    const barFill = document.getElementById(fillId);
    const done = items.filter((t) => t.done).length;
    const total = items.length;
    if (progress) progress.textContent = `${done}/${total} done`;
    if (barFill) {
      barFill.style.width = total ? `${Math.round((done / total) * 100)}%` : '0%';
    }
  }

  function renderTasks() {
    taskStore = Logic.normalizeTaskStore(taskStore);
    const items = activeDayItems();
    updateProgressUi('hub-task-progress', 'hub-progress-fill', items);
    renderTaskList(
      document.getElementById('hub-task-list'),
      items,
      document.getElementById('hub-task-empty'),
      prodPrefs.taskDay === 'tomorrow'
        ? 'nothing for tomorrow yet 🌙'
        : "no tasks yet! what's on your plate? 🍽️"
    );
  }

  function renderPinnedTasks() {
    if (!pinnedWidgetOpen()) return;
    taskStore = Logic.normalizeTaskStore(taskStore);
    const items = taskStore.today.items;
    updateProgressUi('pinned-task-progress', 'pinned-progress-fill', items);
    renderTaskList(
      document.getElementById('pinned-task-list'),
      items,
      document.getElementById('pinned-task-empty'),
      "no tasks yet — open Polen's panel to add some"
    );
  }

  function renderAllTasks() {
    renderTasks();
    renderPinnedTasks();
  }

  /* ── Focus session ── */

  function openFocusModal() {
    openHub('focus');
  }

  function closeFocusModal() {
    /* hub focus pane stays; no separate modal */
  }

  function syncFocusPaneUi() {
    const select = document.getElementById('hub-focus-duration');
    if (select) select.value = String(prodPrefs.focusMinutes);
    const rain = document.getElementById('hub-focus-rain');
    if (rain) rain.checked = !!prodPrefs.focusRain;
  }

  function startFocusRain() {
    stopFocusRain();
    if (!prodPrefs.focusRain) return;
    try {
      const audio = new Audio(FOCUS_SPRING_SRC);
      audio.loop = true;
      audio.volume = 0.28;
      focusSpringAudio = audio;
      audio.play().catch(() => {});
    } catch (_) { /* optional */ }
  }

  function stopFocusRain() {
    if (!focusSpringAudio) return;
    try {
      focusSpringAudio.pause();
      focusSpringAudio.removeAttribute('src');
      focusSpringAudio.load();
    } catch (_) { /* ignore */ }
    focusSpringAudio = null;
  }

  function startFocusNap(durationMs) {
    focusSession.napActive = true;
    catSleep(durationMs + 5000);
  }

  function startFocusSession({ minutes } = {}) {
    if (focusSession) return;
    meowLog('startFocusSession', { minutes: minutes ?? prodPrefs.focusMinutes });
    const mins = Logic.normalizeFocusMinutes(
      minutes ?? prodPrefs.focusMinutes,
      false
    );
    prodPrefs.focusMinutes = Logic.FOCUS_UI_DURATIONS_MIN.includes(mins)
      ? mins
      : Logic.normalizeFocusMinutes(mins, true);
    saveProdPrefs();
    if (chaseActive) stopWaterChase({ silent: true });

    const durationMs = mins * 60 * 1000;
    const quietWasOn = !!getSettings().focusMode;
    quietAutoEnabled = false;
    if (!quietWasOn && window.MeowSettings?.setFocusMode) {
      window.MeowSettings.setFocusMode(true);
      quietAutoEnabled = true;
    }

    focusSession = {
      endsAt: Date.now() + durationMs,
      durationMs,
      remainingAtPause: null,
      paused: false,
      quietWasOn,
      napActive: false,
    };

    showFocusTimerWidget();
    updateFocusCountdownUi();
    applyWindowSize();
    startFocusNap(durationMs);
    startFocusRain();

    say(`Focus ${mins}m — Polen will nap beside you~ 😴`, 3500);

    if (focusTickTimer) clearInterval(focusTickTimer);
    focusTickTimer = setInterval(tickFocusSession, 250);
    window.dispatchEvent(new CustomEvent('meow:focus-session', { detail: { active: true } }));
    broadcast('focus-session', { active: true });
  }

  function tickFocusSession() {
    if (!focusSession || focusSession.paused) return;
    const left = Logic.remainingMs(focusSession.endsAt);
    updateFocusCountdownUi();
    if (left <= 0) endFocusSession({ completed: true });
  }

  function updateFocusCountdownUi() {
    if (!focusSession) return;
    const ms = focusSession.paused
      ? (focusSession.remainingAtPause || 0)
      : Logic.remainingMs(focusSession.endsAt);
    const text = Logic.formatCountdown(ms);
    const el = document.getElementById('focus-timer-text');
    if (el) el.textContent = text;
    const bar = document.getElementById('focus-countdown-text');
    if (bar) bar.textContent = text;

    const ring = document.getElementById('focus-timer-ring');
    if (ring && focusSession.durationMs) {
      const frac = Math.max(0, Math.min(1, ms / focusSession.durationMs));
      ring.style.setProperty('--focus-progress', String(frac));
    }

    const pauseBtn = document.getElementById('focus-timer-pause');
    if (pauseBtn) pauseBtn.textContent = focusSession.paused ? 'resume' : 'pause';
  }

  function pauseFocusSession() {
    if (!focusSession) return;
    if (focusSession.paused) {
      focusSession.endsAt = Date.now() + (focusSession.remainingAtPause || 0);
      focusSession.paused = false;
      focusSession.remainingAtPause = null;
      if (prodPrefs.focusRain) startFocusRain();
    } else {
      focusSession.remainingAtPause = Logic.remainingMs(focusSession.endsAt);
      focusSession.paused = true;
      stopFocusRain();
    }
    updateFocusCountdownUi();
  }

  function endFocusSession({ completed, cancelled } = {}) {
    if (!focusSession) return;
    meowLog('endFocusSession', { completed: !!completed, cancelled: !!cancelled });
    if (focusTickTimer) {
      clearInterval(focusTickTimer);
      focusTickTimer = null;
    }
    const wasNap = focusSession.napActive;
    focusSession = null;
    hideFocusTimerWidget();
    document.getElementById('focus-countdown-bar')?.classList.add('hidden');
    stopFocusRain();

    if (wasNap) {
      if (isOverlay()) broadcast('cat:wake');
      else window.MeowCat?.wakeUp?.();
    }

    if (quietAutoEnabled && window.MeowSettings?.setFocusMode) {
      window.MeowSettings.setFocusMode(false);
    }
    quietAutoEnabled = false;

    applyWindowSize();
    window.dispatchEvent(new CustomEvent('meow:focus-session', { detail: { active: false } }));
    broadcast('focus-session', { active: false });

    if (completed) {
      say('Focus done! Great work — stretch those paws~ 🌟', 4000);
      catSetExpression('excited');
      if (!isOverlay()) window.MeowCat?.bounce?.();
    } else if (cancelled) {
      say('Focus cancelled — rest is okay too~', 2500);
    }
  }

  function cancelFocusSession() {
    endFocusSession({ cancelled: true });
  }

  function setFocusTimerSize(size) {
    prodPrefs.focusTimerSize = Logic.normalizeFocusTimerSize(size);
    saveProdPrefs();
    const widget = document.getElementById('focus-timer-widget');
    if (widget) {
      widget.classList.remove('size-S', 'size-M', 'size-L');
      widget.classList.add(`size-${prodPrefs.focusTimerSize}`);
    }
    document.querySelectorAll('.focus-size-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.size === prodPrefs.focusTimerSize);
    });
  }

  function showFocusTimerWidget() {
    const widget = document.getElementById('focus-timer-widget');
    widget?.classList.remove('hidden');
    setFocusTimerSize(prodPrefs.focusTimerSize);
    syncStackLayout();
  }

  function hideFocusTimerWidget() {
    document.getElementById('focus-timer-widget')?.classList.add('hidden');
    syncStackLayout();
  }

  /* ── Water reminder / chase ── */

  function setWaterEnabled(enabled) {
    waterState.enabled = !!enabled;
    saveWater();
    if (!waterState.enabled) stopWaterChase({ silent: true });
    syncWaterSettingsUi();
  }

  function setWaterInterval(mins) {
    const next = Logic.normalizeWaterIntervalId(mins);
    const changed = String(next) !== String(waterState.intervalMinutes);
    waterState.intervalMinutes = next;
    // Start the new countdown from now (so 10s means ~10s after pick).
    if (changed) {
      waterState.lastDrinkAt = Date.now();
      waterState.snoozeUntil = 0;
    }
    saveWater();
    syncWaterSettingsUi();
  }

  function syncWaterSettingsUi() {
    document.querySelectorAll('#hub-water-toggle').forEach((toggle) => {
      if (toggle) toggle.checked = waterState.enabled;
    });
    document.querySelectorAll('.water-interval-btn').forEach((btn) => {
      const id = Logic.normalizeWaterIntervalId(btn.dataset.mins);
      btn.classList.toggle('active', String(id) === String(waterState.intervalMinutes));
    });
  }

  function tickWaterReminder() {
    if (!waterState.enabled) return;
    // Chat only blocks water when it's open in this window (cat role).
    if (focusSession || isChatOpen() || isBreakActive()) return;
    if (chaseActive) return;
    if (Logic.isWaterOverdue(
      waterState.lastDrinkAt,
      waterState.intervalMinutes,
      Date.now(),
      waterState.snoozeUntil
    )) {
      meowLog('water overdue → chase', { interval: waterState.intervalMinutes });
      startWaterChase();
    }
  }

  function stopChaseLoop() {
    if (chaseRaf) {
      cancelAnimationFrame(chaseRaf);
      chaseRaf = null;
    }
    chaseActive = false;
    chasePaused = false;
    chaseCursor = null;
    chaseCursorSmooth = null;
    chasePlacement = null;
    chaseLastTick = 0;
    chaseLastPlacementSync = 0;
    chaseCursorFetchInFlight = false;
    chaseMotion = { velX: 0, velY: 0, fracX: 0, fracY: 0, lastFaceDir: 1 };
  }

  function dispatchChaseFacing(dir) {
    const d = dir === -1 ? -1 : 1;
    if (chaseMotion.lastFaceDir === d) return;
    chaseMotion.lastFaceDir = d;
    window.dispatchEvent(new CustomEvent('meow:water-chase-face', { detail: { dir: d } }));
    broadcast('water-chase-face', { dir: d });
  }

  function blendChaseCursor(raw) {
    if (!raw) return;
    chaseCursor = raw;
    if (!chaseCursorSmooth) {
      chaseCursorSmooth = { x: raw.x, y: raw.y };
      return;
    }
    const a = CHASE_OPTS.cursorSmoothAlpha;
    chaseCursorSmooth = {
      x: chaseCursorSmooth.x + (raw.x - chaseCursorSmooth.x) * a,
      y: chaseCursorSmooth.y + (raw.y - chaseCursorSmooth.y) * a,
    };
  }

  async function refreshChaseCursor() {
    if (chaseCursorFetchInFlight) return;
    chaseCursorFetchInFlight = true;
    try {
      const cursor = await window.meowAPI?.getCursorPoint?.();
      if (cursor) blendChaseCursor(cursor);
    } catch (_) { /* ignore */ }
    chaseCursorFetchInFlight = false;
  }

  async function resyncChasePlacement() {
    try {
      const placement = await window.meowAPI?.getWindowPlacement?.();
      if (!placement) return;
      if (!chasePlacement) {
        chasePlacement = placement;
        return;
      }
      // Keep optimistic x/y unless main drifted (edge clamp / size change)
      const drift = Math.hypot(
        placement.x - chasePlacement.x,
        placement.y - chasePlacement.y
      );
      const sizeChanged =
        placement.width !== chasePlacement.width
        || placement.height !== chasePlacement.height;
      chasePlacement = {
        ...placement,
        x: drift > 24 || sizeChanged ? placement.x : chasePlacement.x,
        y: drift > 24 || sizeChanged ? placement.y : chasePlacement.y,
      };
    } catch (_) { /* ignore */ }
  }

  function chaseTick(nowTs) {
    if (!chaseActive) return;
    chaseRaf = requestAnimationFrame(chaseTick);

    if (focusSession || isChatOpen()) return;

    if (chasePaused) return;

    const now = typeof nowTs === 'number' ? nowTs : performance.now();
    const dtMs = chaseLastTick ? now - chaseLastTick : 16.67;
    chaseLastTick = now;

    void refreshChaseCursor();
    if (now - chaseLastPlacementSync >= CHASE_OPTS.placementResyncMs || !chasePlacement) {
      chaseLastPlacementSync = now;
      void resyncChasePlacement();
    }

    const target = chaseCursorSmooth || chaseCursor;
    if (!target || !chasePlacement) return;

    const catEl = document.getElementById('cat-container');
    const catRect = catEl?.getBoundingClientRect?.();
    // Overlay has no cat DOM — assume cat sits in the lower portion of the compact window
    const fallbackRect = {
      left: 10,
      top: Math.max(0, (chasePlacement.height || 240) - 160),
      width: Math.max(80, (chasePlacement.width || 220) - 20),
      height: 140,
    };
    const anchor = Logic.catChaseAnchorScreen(chasePlacement, catRect || fallbackRect);
    if (!anchor) return;

    if (Logic.isCursorNearChaseTarget(target, anchor, CHASE_OPTS.nearRadius)) {
      chaseMotion.velX *= 0.7;
      chaseMotion.velY *= 0.7;
      return;
    }

    const step = Logic.chaseSmoothStep(
      anchor.x,
      anchor.y,
      target.x,
      target.y,
      chaseMotion,
      {
        maxSpeed: CHASE_OPTS.maxSpeed,
        steer: CHASE_OPTS.steer,
        damping: CHASE_OPTS.damping,
        arrive: CHASE_OPTS.arrive,
        dtMs,
      }
    );
    chaseMotion.velX = step.velX;
    chaseMotion.velY = step.velY;
    chaseMotion.fracX = step.fracX;
    chaseMotion.fracY = step.fracY;

    if (step.dx || step.dy) {
      window.meowAPI?.dragWindow?.(step.dx, step.dy);
      chasePlacement = {
        ...chasePlacement,
        x: chasePlacement.x + step.dx,
        y: chasePlacement.y + step.dy,
      };
    }

    if (Math.abs(target.x - anchor.x) > 12) {
      dispatchChaseFacing(target.x >= anchor.x ? 1 : -1);
    }
  }

  function startWaterChase() {
    if (chaseActive || focusSession) return;
    meowLog('startWaterChase');
    hideSpeech();
    catSetExpression('alert');

    chaseActive = true;
    chasePaused = false;
    chaseLastTick = 0;
    chaseLastPlacementSync = 0;
    chaseCursor = null;
    chaseCursorSmooth = null;
    chaseMotion = { velX: 0, velY: 0, fracX: 0, fracY: 0, lastFaceDir: 1 };
    chaseRaf = requestAnimationFrame(chaseTick);
    void resyncChasePlacement();
    void refreshChaseCursor();

    window.dispatchEvent(new CustomEvent('meow:water-chase', { detail: { active: true } }));
    broadcast('water-chase', { active: true });
  }

  function stopWaterChase({ silent } = {}) {
    meowLog('stopWaterChase', { silent: !!silent });
    stopChaseLoop();
    window.dispatchEvent(new CustomEvent('meow:water-chase', { detail: { active: false } }));
    broadcast('water-chase', { active: false });
    if (!silent) { /* payoff speech handled separately */ }
  }

  function acknowledgeWater() {
    stopChaseLoop();
    waterState.lastDrinkAt = Date.now();
    waterState.snoozeUntil = 0;
    saveWater();
    stopWaterChase({ silent: true });
    playWaterPayoff();
  }

  function snoozeWater() {
    stopChaseLoop();
    waterState.snoozeUntil = Logic.snoozeWaterUntil();
    saveWater();
    stopWaterChase({ silent: true });
    say('Okay — remind me in 10 minutes~ 💧', 2800);
    catSetExpression('happy');
  }

  function playWaterPayoff() {
    say('Nice! Hydrated human detected. 💧✨', 4000);
    catSetExpression('happy');
    if (!isOverlay()) {
      window.MeowCat?.bounce?.();
      const props = document.getElementById('activity-props');
      if (props && !document.getElementById('cat2-canvas-a')) {
        props.classList.remove('hidden');
        props.innerHTML = `
          <div class="water-payoff" aria-hidden="true">
            <svg viewBox="0 0 48 40" width="48" height="40" xmlns="http://www.w3.org/2000/svg">
              <rect x="4" y="28" width="40" height="8" rx="2" fill="#c8b8a8"/>
              <rect x="18" y="10" width="12" height="20" rx="2" fill="#a8d8ff" opacity="0.85"/>
              <rect x="18" y="8" width="12" height="4" rx="1" fill="#88c0e8"/>
              <ellipse cx="24" cy="18" rx="4" ry="3" fill="#e8f6ff" opacity="0.7"/>
            </svg>
          </div>`;
        setTimeout(() => {
          props.classList.add('hidden');
          props.innerHTML = '';
        }, 2800);
      }
      const catSoundsOn = getSettings().catSounds !== false
        && window.Cat2Player?.areSoundsEnabled?.() !== false;
      if (catSoundsOn) {
        window.MeowCat?.playAnimation?.('meow', 1200);
        try {
          window.Cat2Player?.playOneShot?.('meow');
        } catch (_) { /* optional */ }
      }
    }
  }

  /* ── Task idle nudges ── */

  function tickTaskNudge() {
    if (focusSession || chaseActive) return;
    if (getSettings().focusMode) return;
    if (isChatOpen() || isBreakActive()) return;
    const level = getSettings().chattyLevel || 'normal';
    if (level === 'quiet' && Math.random() > 0.25) return;

    const count = uncheckedCount('today');
    if (count <= 0) return;
    if (!hubOpen() && Math.random() > 0.35) return;

    const line = Logic.pickTaskNudge(new Date().getHours(), count);
    if (line) say(line, 3500);
  }

  function startBackgroundTimers() {
    if (waterTickTimer) clearInterval(waterTickTimer);
    if (taskNudgeTimer) clearInterval(taskNudgeTimer);
    waterTickTimer = setInterval(tickWaterReminder, 2000);
    taskNudgeTimer = setInterval(tickTaskNudge, 90000);
    setTimeout(tickWaterReminder, 3000);
    setTimeout(tickTaskNudge, 45000);
  }

  function defaultPanelAnchor(panel, key, work) {
    const w = panel.offsetWidth || 220;
    const h = panel.offsetHeight || 160;
    const areaW = work?.width || window.innerWidth || 1280;
    const areaH = work?.height || window.innerHeight || 800;
    // Mid-screen so the hub isn't stranded in the far top-left corner
    if (key === 'timer') {
      return { left: Math.max(24, areaW / 2 - w / 2), top: Math.max(24, Math.round(areaH * 0.28)), w, h };
    }
    if (key === 'chat') {
      return { left: Math.max(24, Math.round(areaW * 0.55)), top: Math.max(24, Math.round(areaH * 0.28)), w, h };
    }
    return {
      left: Math.max(24, Math.round(areaW * 0.38 - w / 2)),
      top: Math.max(24, Math.round(areaH * 0.28)),
      w,
      h,
    };
  }

  function applyPanelFloat(panel, key) {
    if (!isOverlay() || !panel || panel.classList.contains('hidden')) return;
    panel.classList.add('float-panel', 'overlay-float-panel');
    const work = overlayBoundsCache || {
      width: window.innerWidth,
      height: window.innerHeight,
    };
    const anchor = defaultPanelAnchor(panel, key, work);
    const saved = prodPrefs.screenPositions?.[key];
    // Treat legacy top-left defaults (40,80) as unset so we use mid-screen anchor
    const legacyDefault = Number(saved?.x) === 40 && Number(saved?.y) === 80;
    let left = Number.isFinite(saved?.x) && !legacyDefault ? saved.x : anchor.left;
    let top = Number.isFinite(saved?.y) && !legacyDefault ? saved.y : anchor.top;
    const clamped = Logic.clampScreenPosition(
      { x: left, y: top },
      { width: anchor.w, height: anchor.h },
      work
    );
    panel.style.left = `${clamped.x}px`;
    panel.style.top = `${clamped.y}px`;
    if (!prodPrefs.screenPositions) prodPrefs.screenPositions = {};
    prodPrefs.screenPositions[key] = { x: clamped.x, y: clamped.y };
  }

  /** Drag handle moves the panel across the primary work-area overlay. */
  function bindPanelDrag(handle, floatKey) {
    if (!handle || !floatKey || !isOverlay()) return;
    const panel = handle.closest(
      '.productivity-hub, .pinned-tasks-widget, .focus-timer-widget'
    );
    if (!panel) return;
    handle.title = 'Drag panel on desktop';

    handle.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      e.stopPropagation();
      e.preventDefault();
      const startLeft = parseFloat(panel.style.left) || 0;
      const startTop = parseFloat(panel.style.top) || 0;
      panelDrag = {
        floatKey,
        startX: e.clientX,
        startY: e.clientY,
        baseX: startLeft,
        baseY: startTop,
      };
      window.meowAPI?.setIgnoreMouseEvents?.(false);
      try { handle.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }

      const onMove = (ev) => {
        if (!panelDrag || panelDrag.floatKey !== floatKey) return;
        const dx = ev.clientX - panelDrag.startX;
        const dy = ev.clientY - panelDrag.startY;
        if (!prodPrefs.screenPositions) prodPrefs.screenPositions = {};
        prodPrefs.screenPositions[floatKey] = {
          x: panelDrag.baseX + dx,
          y: panelDrag.baseY + dy,
        };
        applyPanelFloat(panel, floatKey);
      };
      const onUp = () => {
        if (panelDrag?.floatKey === floatKey) saveProdPrefs();
        panelDrag = null;
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('pointercancel', onUp);
      };
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointercancel', onUp);
    });
  }

  /* ── DOM build & bind ── */

  function ensureMarkup() {
    if (!isOverlay()) return;
    const stack = document.getElementById('buddy-stack');
    if (!stack) return;

    // Remove legacy notes panel if present (replaced by hub)
    document.getElementById('notes-panel')?.remove();
    document.getElementById('focus-session-modal')?.remove();

    const catContainer = null; // overlay has no cat; panels append to stack

    if (!document.getElementById('productivity-hub')) {
      const hub = document.createElement('div');
      hub.id = 'productivity-hub';
      hub.className = 'productivity-hub hidden';
      hub.innerHTML = `
        <div class="hub-drag-handle" id="hub-drag-handle">:: drag me</div>
        <div class="hub-header">
          <span class="hub-title">Polen's panel</span>
          <div class="hub-header-actions">
            <button type="button" id="hub-chat-btn" class="hub-icon-btn" title="Open chat">💬</button>
            <button type="button" id="hub-settings-btn" class="hub-icon-btn" title="Settings">⚙</button>
            <button type="button" id="hub-close-btn" class="hub-icon-btn" title="Close">×</button>
          </div>
        </div>
        <div class="hub-tabs" role="tablist">
          <button type="button" class="hub-tab active" data-tab="tasks">Tasks</button>
          <button type="button" class="hub-tab" data-tab="remind">Remind</button>
          <button type="button" class="hub-tab" data-tab="focus">Focus</button>
        </div>

        <div class="hub-pane" data-pane="tasks">
          <div class="hub-day-row">
            <button type="button" class="hub-day-btn active" data-day="today">today</button>
            <button type="button" class="hub-day-btn" data-day="tomorrow">tomorrow</button>
          </div>
          <div class="hub-progress-row">
            <span id="hub-task-progress" class="hub-task-progress">0/0 done</span>
            <div class="hub-progress-track"><div id="hub-progress-fill" class="hub-progress-fill"></div></div>
          </div>
          <form id="hub-task-form" class="hub-task-form">
            <input id="hub-task-input" type="text" maxlength="120" placeholder="add a task..." autocomplete="off" />
            <button type="submit" class="hub-add-btn" title="Add">+</button>
          </form>
          <div id="hub-task-list" class="hub-task-list"></div>
          <p id="hub-task-empty" class="hub-task-empty">no tasks yet! what's on your plate? 🍽️</p>
          <button type="button" id="hub-pin-today-btn" class="hub-pin-today-btn" aria-pressed="false">pin today</button>
        </div>

        <div class="hub-pane hidden" data-pane="remind">
          <div class="hub-remind-row">
            <span class="hub-remind-label">Water reminders</span>
            <label class="toggle">
              <input type="checkbox" id="hub-water-toggle" />
              <span class="toggle-slider"></span>
            </label>
          </div>
          <p class="hub-hint">Cat chases your cursor until you tap "I drank water"</p>
          <span class="hub-remind-label">Remind every</span>
          <div class="segmented hub-water-intervals" id="hub-water-intervals"></div>
        </div>

        <div class="hub-pane hidden" data-pane="focus">
          <div class="hub-focus-hero">🧘</div>
          <p class="hub-focus-title">ready to focus?</p>
          <p class="hub-hint">Polen will quietly keep you company while you work</p>
          <label class="hub-focus-duration-label" for="hub-focus-duration">Duration</label>
          <select id="hub-focus-duration" class="hub-focus-duration"></select>
          <label class="hub-focus-rain-label">
            <input type="checkbox" id="hub-focus-rain" />
            <span>Sound of spring</span>
          </label>
          <button type="button" id="hub-focus-start" class="hub-focus-start">start</button>
        </div>
        <div class="hub-tail"></div>
      `;
      stack.appendChild(hub);

      const intervals = document.getElementById('hub-water-intervals');
      (Logic.WATER_INTERVAL_PRESETS || []).forEach((p) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'water-interval-btn';
        btn.dataset.mins = p.id;
        btn.textContent = p.label;
        intervals?.appendChild(btn);
      });

      const durationSelect = document.getElementById('hub-focus-duration');
      (Logic.FOCUS_UI_DURATIONS_MIN || []).forEach((m) => {
        const opt = document.createElement('option');
        opt.value = String(m);
        opt.textContent = `${m} minutes`;
        durationSelect?.appendChild(opt);
      });
    }

    if (!document.getElementById('pinned-tasks-widget')) {
      const pin = document.createElement('div');
      pin.id = 'pinned-tasks-widget';
      pin.className = 'pinned-tasks-widget hidden';
      pin.innerHTML = `
        <div class="pinned-drag-handle" id="pinned-drag-handle" title="Drag pet on desktop">:: drag me</div>
        <div class="pinned-header">
          <span class="pinned-title">today with Polen</span>
          <button type="button" id="pinned-close-btn" class="hub-icon-btn" title="Unpin">×</button>
        </div>
        <div class="hub-progress-row">
          <span id="pinned-task-progress" class="hub-task-progress">0/0 done</span>
          <div class="hub-progress-track"><div id="pinned-progress-fill" class="hub-progress-fill"></div></div>
        </div>
        <div id="pinned-task-list" class="hub-task-list pinned-task-list"></div>
        <p id="pinned-task-empty" class="hub-task-empty">no tasks yet</p>
      `;
      stack.appendChild(pin);
    }

    if (!document.getElementById('focus-countdown-bar')) {
      const bar = document.createElement('div');
      bar.id = 'focus-countdown-bar';
      bar.className = 'focus-countdown-bar hidden';
      bar.innerHTML = `
        <span class="focus-countdown-label">Focus</span>
        <span id="focus-countdown-text" class="focus-countdown-text">0:00</span>
        <button type="button" id="focus-cancel-btn" class="focus-cancel-btn" title="Cancel">×</button>
      `;
      stack.insertBefore(bar, stack.firstChild);
    }

    if (!document.getElementById('focus-timer-widget')) {
      const widget = document.createElement('div');
      widget.id = 'focus-timer-widget';
      widget.className = 'focus-timer-widget size-M hidden';
      widget.innerHTML = `
        <div class="focus-timer-toolbar">
          <span class="focus-timer-drag" id="focus-timer-drag">:: drag me</span>
          <div class="focus-timer-sizes">
            <button type="button" class="focus-size-btn" data-size="S">S</button>
            <button type="button" class="focus-size-btn active" data-size="M">M</button>
            <button type="button" class="focus-size-btn" data-size="L">L</button>
          </div>
        </div>
        <p class="focus-timer-status">Polen is keeping it quiet.</p>
        <div class="focus-timer-circle">
          <div id="focus-timer-ring" class="focus-timer-ring"></div>
          <span id="focus-timer-text" class="focus-timer-text">0:00</span>
        </div>
        <div class="focus-timer-actions">
          <button type="button" id="focus-timer-pause" class="focus-timer-btn">pause</button>
          <button type="button" id="focus-timer-end" class="focus-timer-btn focus-timer-end">end</button>
        </div>
      `;
      stack.appendChild(widget);
    }

    /* Water chase UI lives on the cat window (index-cat2.html), not the overlay */
  }

  function bindUi() {
    document.getElementById('hub-task-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const input = document.getElementById('hub-task-input');
      addTask(input?.value);
      if (input) input.value = '';
      input?.focus();
    });

    document.getElementById('hub-pin-today-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      setTasksWidgetPinned(!prodPrefs.tasksWidgetPinned);
    });

    document.getElementById('pinned-close-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      setTasksWidgetPinned(false);
    });

    document.getElementById('hub-close-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      setNotesVisible(false);
    });

    document.getElementById('hub-chat-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      meowLog('hub chat btn → chat:open');
      broadcast('chat:open', { tab: 'chat' });
    });

    document.getElementById('hub-settings-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      meowLog('hub settings btn → chat:open settings');
      broadcast('chat:open', { tab: 'settings' });
    });

    document.querySelectorAll('.hub-tab').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        setHubTab(btn.dataset.tab);
      });
    });

    document.querySelectorAll('.hub-day-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        setTaskDay(btn.dataset.day);
      });
    });

    document.getElementById('hub-water-toggle')?.addEventListener('change', (e) => {
      e.stopPropagation();
      setWaterEnabled(e.target.checked);
    });

    document.querySelectorAll('.water-interval-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        setWaterInterval(btn.dataset.mins);
      });
    });

    document.getElementById('hub-focus-duration')?.addEventListener('change', (e) => {
      e.stopPropagation();
      prodPrefs.focusMinutes = Logic.normalizeFocusMinutes(e.target.value, true);
      saveProdPrefs();
    });

    document.getElementById('hub-focus-rain')?.addEventListener('change', (e) => {
      e.stopPropagation();
      prodPrefs.focusRain = !!e.target.checked;
      saveProdPrefs();
    });

    document.getElementById('hub-focus-start')?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const select = document.getElementById('hub-focus-duration');
      startFocusSession({
        minutes: Number(select?.value) || prodPrefs.focusMinutes,
      });
    }, true);

    document.getElementById('focus-cancel-btn')?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      cancelFocusSession();
    }, true);

    document.getElementById('focus-timer-pause')?.addEventListener('click', (e) => {
      e.stopPropagation();
      pauseFocusSession();
    });

    document.getElementById('focus-timer-end')?.addEventListener('click', (e) => {
      e.stopPropagation();
      cancelFocusSession();
    });

    document.querySelectorAll('.focus-size-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        setFocusTimerSize(btn.dataset.size);
      });
    });

    bindPanelDrag(document.getElementById('hub-drag-handle'), 'hub');
    bindPanelDrag(document.getElementById('focus-timer-drag'), 'timer');
    bindPanelDrag(document.getElementById('pinned-drag-handle'), 'pinned');

    window.addEventListener('meow:open-focus-session', () => openHub('focus'));
    window.addEventListener('meow:toggle-notes', () => toggleHub());
    window.addEventListener('meow:open-hub', (ev) => openHub(ev.detail?.tab || 'tasks'));

    window.meowAPI?.onBroadcast?.((channel, payload) => {
      meowLog('broadcast recv', channel, payload ?? '');
      if (channel === 'hub:toggle') toggleHub();
      else if (channel === 'hub:open') openHub(payload?.tab || 'tasks');
      else if (channel === 'water:ack') acknowledgeWater();
      else if (channel === 'water:snooze') snoozeWater();
      else if (channel === 'water:chase-pause') {
        chasePaused = !!payload?.paused;
      }
      // chat:open is handled on the cat window only
    });

    [
      'productivity-hub',
      'pinned-tasks-widget',
      'focus-countdown-bar',
      'focus-timer-widget',
    ].forEach((id) => {
      document.getElementById(id)?.addEventListener('pointerdown', (e) => {
        if (e.target.closest('.hub-drag-handle, .focus-timer-drag, .pinned-drag-handle')) return;
        e.stopPropagation();
      });
      document.getElementById(id)?.addEventListener('mousedown', (e) => {
        if (e.target.closest('.hub-drag-handle, .focus-timer-drag, .pinned-drag-handle')) return;
        e.stopPropagation();
      });
    });
  }

  function injectSettingsWaterControls() {
    /* water also lives in hub Remind tab; settings still sync via syncWaterSettingsUi */
  }

  function initCatRole() {
    let remoteChase = false;
    let remoteFocus = false;
    window.meowAPI?.onBroadcast?.((channel, payload) => {
      if (channel === 'water-chase') remoteChase = !!payload?.active;
      if (channel === 'focus-session') remoteFocus = !!payload?.active;
    });
    applyWindowSize();
    window.MeowProductivity = {
      init: initCatRole,
      shouldSuppressIdle: () => !!(remoteChase || remoteFocus),
      isFocusSessionActive: () => remoteFocus,
      isWaterChaseActive: () => remoteChase,
      isPatrolModeActive,
      openFocusModal: () => broadcast('hub:open', { tab: 'focus' }),
      closeFocusModal: () => {},
      openHub: (tab) => broadcast('hub:open', { tab: tab || 'tasks' }),
      toggleHub: () => broadcast('hub:toggle'),
      toggleNotesPanel: () => broadcast('hub:toggle'),
      setNotesVisible: (v) => broadcast(v ? 'hub:open' : 'hub:toggle', { tab: 'tasks' }),
      setTasksWidgetPinned: () => {},
      getTaskStore: () => Logic.normalizeTaskStore(loadJson(TASKS_KEY, null)),
      getWaterState: () => ({ ...DEFAULT_WATER }),
      setWaterEnabled: () => {},
      setWaterInterval: () => {},
      syncWaterSettingsUi: () => {},
      acknowledgeWater: () => broadcast('water:ack'),
      snoozeWater: () => broadcast('water:snooze'),
      startFocusSession: () => broadcast('hub:open', { tab: 'focus' }),
      cancelFocusSession: () => {},
      pauseFocusSession: () => {},
      applyWindowSize,
      syncStackLayout: () => {},
    };
  }

  function init() {
    if (!isOverlay()) {
      meowLog('init cat-role (compact pet window)');
      initCatRole();
      return;
    }
    meowLog('init overlay (panels)');
    loadAll();
    // Never auto-open hub on launch — only after cat click / explicit open
    if (prodPrefs.notesVisible) {
      meowLog('clearing persisted notesVisible so hub stays hidden until cat click');
      prodPrefs.notesVisible = false;
      saveProdPrefs();
    }
    void fetchOverlayBounds();
    ensureMarkup();
    bindUi();
    injectSettingsWaterControls();
    syncHubVisibility();
    syncWaterSettingsUi();
    syncFocusPaneUi();
    renderAllTasks();
    setTaskDay(prodPrefs.taskDay);
    startBackgroundTimers();
    requestAnimationFrame(refreshPanelFloats);

    setInterval(() => {
      const next = Logic.normalizeTaskStore(taskStore);
      const changed =
        next.today.date !== taskStore.today?.date ||
        next.tomorrow.date !== taskStore.tomorrow?.date;
      if (changed) {
        taskStore = next;
        saveTasks();
        renderAllTasks();
      }
    }, 60 * 1000);
  }

  window.MeowProductivity = {
    init,
    shouldSuppressIdle,
    isFocusSessionActive,
    isWaterChaseActive,
    isPatrolModeActive,
    openFocusModal,
    closeFocusModal,
    openHub,
    toggleHub,
    toggleNotesPanel,
    setNotesVisible,
    setTasksWidgetPinned,
    getTaskStore: () => Logic.normalizeTaskStore(taskStore),
    getWaterState: () => ({ ...waterState }),
    setWaterEnabled,
    setWaterInterval,
    syncWaterSettingsUi,
    acknowledgeWater,
    snoozeWater,
    startFocusSession,
    cancelFocusSession,
    pauseFocusSession,
    applyWindowSize,
    syncStackLayout,
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
