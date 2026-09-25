/**
 * Productivity UI — Syrax hub (Tasks / Remind / Focus), water chase, focus timer.
 * Depends on MeowProductivityLogic, MeowCat, MeowSettings, meowAPI.
 */
(() => {
  const Logic = window.MeowProductivityLogic;
  if (!Logic) {
    console.error('[Meow] productivity-logic.js must load before productivity.js');
    return;
  }

  const TASKS_KEY = 'meowSessionTasks';
  const WATER_KEY = 'meowWater';
  const PROD_SETTINGS_KEY = 'meowProductivitySettings';

  const isOverlay = () =>
    !!window.MEOW_PANEL_OVERLAY
    || document.body?.classList?.contains('panel-overlay-root')
    || /index-panels\.html/i.test(String(location?.href || ''));

  const CAT_W = 220;
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

  const $ = (id) => document.getElementById(id);

  function onClick(id, fn, { prevent = false } = {}) {
    $(id)?.addEventListener('click', (e) => {
      if (prevent) e.preventDefault();
      e.stopPropagation();
      fn(e);
    }, prevent);
  }

  function onBroadcast(map) {
    window.meowAPI?.onBroadcast?.((channel, payload) => {
      meowLog('broadcast recv', channel, payload ?? '');
      map[channel]?.(payload);
    });
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
    pinnedTasksVisible: false,
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
  let waterSnoozeTimer = null;
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
  let panelDrag = null;
  let focusSpringAudio = null;

  function taskStorage() {
    return window.sessionStorage;
  }

  function loadJson(key, fallback) {
    try {
      const store = key === TASKS_KEY ? taskStorage() : localStorage;
      const raw = store.getItem(key);
      if (!raw) return fallback;
      return JSON.parse(raw);
    } catch (_) {
      return fallback;
    }
  }

  function saveJson(key, value) {
    const store = key === TASKS_KEY ? taskStorage() : localStorage;
    store.setItem(key, JSON.stringify(value));
  }

  function loadAll() {
    try { localStorage.removeItem('meowTasks'); } catch (_) { /* old persistent list */ }
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
      pinnedTasksVisible: typeof p?.pinnedTasksVisible === 'boolean'
        ? p.pinnedTasksVisible
        : migratedPin,
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
    const settings = getSettings();
    const focusQuiet = !!settings.focusMode || !!settings.focusSession || !!focusSession;
    return !!settings.patrolMode && !focusQuiet;
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
    return !!prodPrefs.tasksWidgetPinned && prodPrefs.pinnedTasksVisible !== false;
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
    meowLog('task added', trimmed);
  }

  function focusNapRemainingMs() {
    if (!focusSession) return 0;
    if (focusSession.paused) return focusSession.remainingAtPause || 0;
    return Logic.remainingMs(focusSession.endsAt);
  }

  let pinnedPraiseTimer = null;

  function showPinnedPraise(text, duration) {
    const el = document.getElementById('pinned-task-praise');
    if (!el) return;
    el.textContent = text;
    el.classList.remove('hidden');
    if (pinnedPraiseTimer) clearTimeout(pinnedPraiseTimer);
    pinnedPraiseTimer = setTimeout(() => {
      pinnedPraiseTimer = null;
      el.classList.add('hidden');
    }, duration);
  }

  function announceTaskReaction(text, { allDone = false, expression = 'love', duration = 3500 } = {}) {
    const payload = {
      text,
      duration,
      allDone: !!allDone,
      expression: allDone ? 'excited' : expression,
      resumeNap: !!focusSession,
      napRemainingMs: focusNapRemainingMs(),
    };
    meowLog('Syrax says', String(text).slice(0, 80));
    showPinnedPraise(text, duration);
    if (isOverlay()) {
      broadcast('cat:task-reaction', payload);
      return;
    }
    window.MeowCat?.reactToTask?.(payload);
  }

  function reactTaskDone(taskText, remainingUnchecked) {
    const line = Logic.pickTaskDoneLine({ taskText, remainingUnchecked });
    meowLog('taskDoneReaction', { remainingUnchecked });
    announceTaskReaction(line, { allDone: false, expression: 'love', duration: 3500 });
  }

  function toggleTask(id) {
    taskStore = Logic.normalizeTaskStore(taskStore);
    const todayUncheckedBefore = uncheckedCount('today');
    for (const bucket of [taskStore.today, taskStore.tomorrow]) {
      const item = bucket.items.find((t) => t.id === id);
      if (item) {
        const markingDone = !item.done;
        item.done = !item.done;
        const isToday = bucket === taskStore.today;
        meowLog(markingDone ? 'task ticked off' : 'task ticked on', `${isToday ? 'today' : 'tomorrow'}: ${item.text}`);
        saveTasks();
        renderAllTasks();
        if (markingDone && isToday) {
          const remaining = uncheckedCount('today');
          if (remaining === 0) celebrateTodayIfComplete(todayUncheckedBefore);
          else reactTaskDone(item.text, remaining);
        } else if (!markingDone) {
          meowLog('no dialog', 'task opened again');
        } else {
          meowLog('no dialog', 'tomorrow tasks stay quiet');
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
    const line = Logic.pickAllTasksDoneLine({ count: items.length });
    announceTaskReaction(line, { allDone: true, expression: 'excited', duration: 4500 });
  }

  function removeTask(id) {
    taskStore = Logic.normalizeTaskStore(taskStore);
    const removed = [...taskStore.today.items, ...taskStore.tomorrow.items].find((t) => t.id === id);
    taskStore.today.items = taskStore.today.items.filter((t) => t.id !== id);
    taskStore.tomorrow.items = taskStore.tomorrow.items.filter((t) => t.id !== id);
    meowLog('task removed', removed?.text || id);
    saveTasks();
    renderAllTasks();
  }

  function setTasksWidgetPinned(pinned) {
    prodPrefs.tasksWidgetPinned = !!pinned;
    taskStore.notesPinned = false;
    if (pinned) {
      prodPrefs.pinnedTasksVisible = true;
      inheritPanelPosition('hub', 'pinned', { offsetIfBothVisible: hubOpen() });
    } else {
      prodPrefs.pinnedTasksVisible = false;
    }
    saveTasks();
    saveProdPrefs();
    syncHubVisibility();
    renderAllTasks();
    refreshPanelFloats();
  }

  function setPinnedTasksVisible(visible) {
    if (!prodPrefs.tasksWidgetPinned) return;
    prodPrefs.pinnedTasksVisible = !!visible;
    saveProdPrefs();
    syncHubVisibility();
    renderAllTasks();
    refreshPanelFloats();
  }

  function showFullHubFromPinned() {
    inheritPanelPosition('pinned', 'hub', { offsetIfBothVisible: pinnedWidgetOpen() });
    openHub('tasks');
    refreshPanelFloats();
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
    const showPinned = pinnedWidgetOpen();
    meowLog('syncHubVisibility', { showHub, showPinned });
    hub?.classList.toggle('hidden', !showHub);
    pinned?.classList.toggle('hidden', !showPinned);
    stack?.classList.toggle('notes-open', !!(showHub || showPinned));
    stack?.classList.toggle('hub-open', !!showHub);
    stack?.classList.toggle('pinned-tasks-open', !!showPinned);
    stack?.classList.toggle('hub-chat-open', showHub && isChatOpen());
    syncPinControls();
    if (showHub) setHubTab(prodPrefs.activeTab);
    if (showPinned) renderAllTasks();
    syncStackLayout();
    broadcast('hub:visibility', { showHub, showPinned });
  }

  function syncPinControls() {
    const pinned = !!prodPrefs.tasksWidgetPinned;
    const visible = prodPrefs.pinnedTasksVisible !== false;
    const pinTodayBtn = $('hub-pin-today-btn');
    if (pinTodayBtn) {
      pinTodayBtn.classList.toggle('active', pinned);
      pinTodayBtn.setAttribute('aria-pressed', pinned ? 'true' : 'false');
      pinTodayBtn.textContent = pinned ? 'unpin today' : 'pin today';
      pinTodayBtn.title = pinned
        ? 'Remove the today card'
        : 'Show today card at this panel’s position';
    }
    const visBtn = $('hub-today-visible-btn');
    if (visBtn) {
      visBtn.classList.toggle('hidden', !pinned);
      visBtn.classList.toggle('active', pinned && visible);
      visBtn.setAttribute('aria-pressed', visible ? 'true' : 'false');
      visBtn.textContent = visible ? 'hide today card' : 'show today card';
    }
  }

  function makeTaskRow(item, { allowCheck = false } = {}) {
    const row = document.createElement('div');
    row.className = `hub-task-item${item.done ? ' done' : ''}`;

    const check = document.createElement(allowCheck ? 'button' : 'span');
    check.className = 'hub-task-check';
    if (!allowCheck) check.classList.add('hub-task-check-static');
    check.textContent = item.done ? '✓' : '';
    if (allowCheck) {
      check.type = 'button';
      check.title = item.done ? 'Mark incomplete' : 'Mark done';
      check.addEventListener('click', (e) => {
        e.stopPropagation();
        meowLog('task circle pressed', item.text);
        toggleTask(item.id);
      });
    } else {
      check.title = 'Add tasks here. Check them off on the today card.';
    }

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

  function renderTaskList(listEl, items, emptyEl, emptyText, allowCheck) {
    if (!listEl) return;
    listEl.innerHTML = '';
    const { active, finished } = Logic.partitionTasks(items);
    if (items.length === 0) {
      emptyEl?.classList.remove('hidden');
      if (emptyEl) emptyEl.textContent = emptyText;
      return;
    }
    emptyEl?.classList.add('hidden');
    active.forEach((item) => listEl.appendChild(makeTaskRow(item, { allowCheck })));
    if (finished.length > 0) {
      const heading = document.createElement('div');
      heading.className = 'hub-finished-heading';
      heading.textContent = 'Finished';
      listEl.appendChild(heading);
      finished.forEach((item) => listEl.appendChild(makeTaskRow(item, { allowCheck })));
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

  const TASK_VIEWS = [
    {
      listId: 'hub-task-list',
      emptyId: 'hub-task-empty',
      progressId: 'hub-task-progress',
      fillId: 'hub-progress-fill',
      enabled: () => true,
      getItems: () => activeDayItems(),
      emptyText: () => (prodPrefs.taskDay === 'tomorrow'
        ? 'nothing for tomorrow yet 🌙'
        : "no tasks yet! what's on your plate? 🍽️"),
      allowCheck: false,
    },
    {
      listId: 'pinned-task-list',
      emptyId: 'pinned-task-empty',
      progressId: 'pinned-task-progress',
      fillId: 'pinned-progress-fill',
      enabled: pinnedWidgetOpen,
      getItems: () => taskStore.today.items,
      emptyText: () => "no tasks yet — open Syrax's panel to add some",
      allowCheck: true,
    },
  ];

  function renderTaskView(view) {
    const items = view.getItems();
    updateProgressUi(view.progressId, view.fillId, items);
    renderTaskList($(view.listId), items, $(view.emptyId), view.emptyText(), view.allowCheck);
  }

  function renderAllTasks() {
    taskStore = Logic.normalizeTaskStore(taskStore);
    TASK_VIEWS.filter((view) => view.enabled()).forEach(renderTaskView);
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
    window.MeowSettings?.setFocusSessionActive?.(true);

    focusSession = {
      endsAt: Date.now() + durationMs,
      durationMs,
      remainingAtPause: null,
      paused: false,
      napActive: false,
    };

    showFocusTimerWidget();
    updateFocusCountdownUi();
    applyWindowSize();
    startFocusNap(durationMs);
    startFocusRain();

    say(`Focus ${mins}m — Syrax will nap beside you~ 😴`, 3500);

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

    window.MeowSettings?.setFocusSessionActive?.(false);

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
    if (waterState.enabled) {
      waterState.lastDrinkAt = Date.now();
      waterState.snoozeUntil = 0;
      clearWaterSnoozeTimer();
      stopWaterChase({ silent: true });
      meowLog('water armed', String(waterState.intervalMinutes));
    } else {
      clearWaterSnoozeTimer();
      stopWaterChase({ silent: true });
    }
    saveWater();
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
      clearWaterSnoozeTimer();
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

  function clearWaterSnoozeTimer() {
    if (waterSnoozeTimer) clearTimeout(waterSnoozeTimer);
    waterSnoozeTimer = null;
  }

  function armWaterSnoozeTimer() {
    clearWaterSnoozeTimer();
    const wait = Math.max(0, (waterState.snoozeUntil || 0) - Date.now());
    if (!waterState.snoozeUntil || wait <= 0) return;
    meowLog('water snoozed', `${Math.round(wait / 1000)}s`);
    waterSnoozeTimer = setTimeout(() => {
      waterSnoozeTimer = null;
      waterState.snoozeUntil = 0;
      saveWater();
      meowLog('water snooze ended');
      if (!waterState.enabled) return;
      if (focusSession || isChatOpen() || isBreakActive() || chaseActive) {
        waterState.snoozeUntil = Date.now() + 15000;
        saveWater();
        armWaterSnoozeTimer();
        return;
      }
      startWaterChase();
    }, wait);
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
    clearWaterSnoozeTimer();
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
    armWaterSnoozeTimer();
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
    armWaterSnoozeTimer();
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

  function panelElForKey(key) {
    if (key === 'hub') return document.getElementById('productivity-hub');
    if (key === 'pinned') return document.getElementById('pinned-tasks-widget');
    return null;
  }

  function getPanelScreenPosition(key, panelEl) {
    const panel = panelEl || panelElForKey(key);
    if (panel && !panel.classList.contains('hidden')) {
      const left = parseFloat(panel.style.left);
      const top = parseFloat(panel.style.top);
      if (Number.isFinite(left) && Number.isFinite(top)) return { x: left, y: top };
    }
    const saved = prodPrefs.screenPositions?.[key];
    if (Number.isFinite(Number(saved?.x)) && Number.isFinite(Number(saved?.y))) {
      return { x: Number(saved.x), y: Number(saved.y) };
    }
    return null;
  }

  /** Copy one panel's screen position onto another, nudging if both stay visible. */
  function inheritPanelPosition(fromKey, toKey, opts = {}) {
    const fromEl = panelElForKey(fromKey);
    const toEl = panelElForKey(toKey);
    const from = getPanelScreenPosition(fromKey, fromEl);
    if (!from) return;
    const work = overlayBoundsCache || {
      width: window.innerWidth || 1280,
      height: window.innerHeight || 800,
    };
    const toSize = {
      width: toEl?.offsetWidth || (toKey === 'pinned' ? 220 : 220),
      height: toEl?.offsetHeight || (toKey === 'pinned' ? 180 : 240),
    };
    const fromSize = {
      width: fromEl?.offsetWidth || 220,
      height: fromEl?.offsetHeight || 200,
    };
    const next = Logic.resolveInheritPosition(from, toSize, fromSize, work, {
      offsetIfBothVisible: !!opts.offsetIfBothVisible,
    });
    if (!prodPrefs.screenPositions) prodPrefs.screenPositions = {};
    prodPrefs.screenPositions[toKey] = { x: next.x, y: next.y };
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
    document.getElementById('notes-panel')?.remove();
    document.getElementById('focus-session-modal')?.remove();
    if (!document.getElementById('productivity-hub')) {
      meowLog('overlay markup missing from index-panels.html');
    }
  }

  function bindUi() {
    $('hub-task-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const input = $('hub-task-input');
      addTask(input?.value);
      if (input) input.value = '';
      input?.focus();
    });

    const clicks = {
      'hub-pin-today-btn': () => setTasksWidgetPinned(!prodPrefs.tasksWidgetPinned),
      'hub-today-visible-btn': () => setPinnedTasksVisible(prodPrefs.pinnedTasksVisible === false),
      'pinned-open-hub-btn': showFullHubFromPinned,
      'pinned-close-btn': () => setTasksWidgetPinned(false),
      'hub-close-btn': () => setNotesVisible(false),
      'hub-chat-btn': () => {
        meowLog('hub chat btn → chat:open');
        broadcast('chat:open', { tab: 'chat' });
      },
      'hub-settings-btn': () => {
        meowLog('hub settings btn → chat:open settings');
        broadcast('chat:open', { tab: 'settings' });
      },
      'hub-focus-start': () => startFocusSession({
        minutes: Number($('hub-focus-duration')?.value) || prodPrefs.focusMinutes,
      }),
      'focus-cancel-btn': cancelFocusSession,
      'focus-timer-pause': pauseFocusSession,
      'focus-timer-end': cancelFocusSession,
      'focus-timer-hub-btn': () => openHub('tasks'),
    };
    Object.entries(clicks).forEach(([id, fn]) => {
      onClick(id, fn, { prevent: id === 'hub-focus-start' || id === 'focus-cancel-btn' });
    });

    $('hub-water-toggle')?.addEventListener('change', (e) => {
      e.stopPropagation();
      setWaterEnabled(e.target.checked);
    });
    $('hub-focus-duration')?.addEventListener('change', (e) => {
      e.stopPropagation();
      prodPrefs.focusMinutes = Logic.normalizeFocusMinutes(e.target.value, true);
      saveProdPrefs();
    });
    $('hub-focus-rain')?.addEventListener('change', (e) => {
      e.stopPropagation();
      prodPrefs.focusRain = !!e.target.checked;
      saveProdPrefs();
    });

    $('buddy-stack')?.addEventListener('click', (e) => {
      const tab = e.target.closest?.('.hub-tab');
      if (tab) { e.stopPropagation(); setHubTab(tab.dataset.tab); return; }
      const day = e.target.closest?.('.hub-day-btn');
      if (day) { e.stopPropagation(); setTaskDay(day.dataset.day); return; }
      const water = e.target.closest?.('.water-interval-btn');
      if (water) { e.stopPropagation(); setWaterInterval(water.dataset.mins); return; }
      const size = e.target.closest?.('.focus-size-btn');
      if (size) { e.stopPropagation(); setFocusTimerSize(size.dataset.size); }
    });

    [
      ['hub-drag-handle', 'hub'],
      ['focus-timer-drag', 'timer'],
      ['pinned-drag-handle', 'pinned'],
    ].forEach(([id, key]) => bindPanelDrag($(id), key));

    window.addEventListener('meow:open-focus-session', () => openHub('focus'));
    window.addEventListener('meow:toggle-notes', () => toggleHub());
    window.addEventListener('meow:open-hub', (ev) => openHub(ev.detail?.tab || 'tasks'));

    onBroadcast({
      'hub:toggle': () => toggleHub(),
      'hub:open': (payload) => openHub(payload?.tab || 'tasks'),
      'water:ack': () => acknowledgeWater(),
      'water:snooze': () => snoozeWater(),
      'water:chase-pause': (payload) => { chasePaused = !!payload?.paused; },
      'focus:end-from-toggle': () => {
        window.MeowSettings?.setFocusSessionActive?.(false, { forceOff: true });
        cancelFocusSession();
      },
    });
    window.addEventListener('meow:end-focus-session', () => cancelFocusSession());

    const dragSel = '.hub-drag-handle, .focus-timer-drag, .pinned-drag-handle';
    const stopPanel = (e) => {
      if (e.target.closest(dragSel)) return;
      e.stopPropagation();
    };
    ['productivity-hub', 'pinned-tasks-widget', 'focus-countdown-bar', 'focus-timer-widget']
      .forEach((id) => {
        ['pointerdown', 'mousedown'].forEach((type) => $(id)?.addEventListener(type, stopPanel));
      });
  }

  function productivityApi(impl) {
    const noop = () => {};
    return {
      init: impl.init,
      shouldSuppressIdle: impl.shouldSuppressIdle,
      isFocusSessionActive: impl.isFocusSessionActive,
      isWaterChaseActive: impl.isWaterChaseActive,
      isPatrolModeActive,
      openFocusModal: impl.openFocusModal,
      closeFocusModal: impl.closeFocusModal || noop,
      openHub: impl.openHub,
      toggleHub: impl.toggleHub,
      toggleNotesPanel: impl.toggleNotesPanel || impl.toggleHub,
      setNotesVisible: impl.setNotesVisible,
      setTasksWidgetPinned: impl.setTasksWidgetPinned || noop,
      getTaskStore: impl.getTaskStore,
      getWaterState: impl.getWaterState,
      setWaterEnabled: impl.setWaterEnabled || noop,
      setWaterInterval: impl.setWaterInterval || noop,
      syncWaterSettingsUi: impl.syncWaterSettingsUi || noop,
      acknowledgeWater: impl.acknowledgeWater,
      snoozeWater: impl.snoozeWater,
      startFocusSession: impl.startFocusSession,
      cancelFocusSession: impl.cancelFocusSession || noop,
      pauseFocusSession: impl.pauseFocusSession || noop,
      applyWindowSize: impl.applyWindowSize,
      syncStackLayout: impl.syncStackLayout || noop,
    };
  }

  function initCatRole() {
    let remoteChase = false;
    let remoteFocus = false;
    window.meowAPI?.onBroadcast?.((channel, payload) => {
      if (channel === 'water-chase') remoteChase = !!payload?.active;
      if (channel === 'focus-session') remoteFocus = !!payload?.active;
    });
    applyWindowSize();
    window.MeowProductivity = productivityApi({
      init: initCatRole,
      shouldSuppressIdle: () => !!(remoteChase || remoteFocus),
      isFocusSessionActive: () => remoteFocus,
      isWaterChaseActive: () => remoteChase,
      openFocusModal: () => broadcast('hub:open', { tab: 'focus' }),
      openHub: (tab) => broadcast('hub:open', { tab: tab || 'tasks' }),
      toggleHub: () => broadcast('hub:toggle'),
      setNotesVisible: (v) => broadcast(v ? 'hub:open' : 'hub:toggle', { tab: 'tasks' }),
      getTaskStore: () => Logic.normalizeTaskStore(loadJson(TASKS_KEY, null)),
      getWaterState: () => ({ ...DEFAULT_WATER }),
      acknowledgeWater: () => broadcast('water:ack'),
      snoozeWater: () => broadcast('water:snooze'),
      startFocusSession: () => broadcast('hub:open', { tab: 'focus' }),
      applyWindowSize,
    });
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

  window.MeowProductivity = productivityApi({
    init,
    shouldSuppressIdle,
    isFocusSessionActive,
    isWaterChaseActive,
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
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
