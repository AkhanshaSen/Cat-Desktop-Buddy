/**
 * Chat panel — attached to the cat window (not the detached overlay).
 */
(() => {
  const chatPanel = document.getElementById('chat-panel');
  if (!chatPanel) return;
  // Only run in the cat pet window
  if (window.MEOW_PANEL_OVERLAY || document.body?.classList?.contains('panel-overlay-root')) return;

  const chatMessages = document.getElementById('chat-messages');
  const chatInput = document.getElementById('chat-input');
  const sendBtn = document.getElementById('send-btn');
  const closeChat = document.getElementById('close-chat');
  const openHubPanelBtn = document.getElementById('open-hub-panel-btn');
  const PROD_SETTINGS_KEY = 'meowProductivitySettings';
  const quickBtns = document.querySelectorAll('.quick-btn');
  const tabChat = document.getElementById('tab-chat');
  const tabLook = document.getElementById('tab-look');
  const tabSettings = document.getElementById('tab-settings');
  const lookPanel = document.getElementById('look-panel');
  const settingsPanel = document.getElementById('settings-panel');
  const chatBody = document.getElementById('chat-body');

  let isOpen = false;
  /** Chat opened from hub — cat click toggles until user hits × */
  let chatDocked = false;
  let greeted = false;
  let activeTab = 'chat';
  let historyRestored = false;
  let hubPanelVisible = false;

  function readHubPanelVisibleFromStorage() {
    try {
      const p = JSON.parse(localStorage.getItem(PROD_SETTINGS_KEY) || '{}');
      return !!(p?.notesVisible || (p?.tasksWidgetPinned && p?.pinnedTasksVisible !== false));
    } catch (_) {
      return false;
    }
  }

  function syncOpenHubPanelBtn() {
    if (!openHubPanelBtn) return;
    const show = isOpen && !hubPanelVisible;
    openHubPanelBtn.classList.toggle('hidden', !show);
  }

  const CHAT_HISTORY_KEY = 'meowChatHistory';
  const MAX_HISTORY = 20;
  const isCat2 = () => !!document.getElementById('cat2-canvas-a') ||
    document.getElementById('cat')?.classList.contains('cat2-mode');
  const CAT2_WINDOW_H = 460;
  const COMPACT_H = isCat2() ? CAT2_WINDOW_H : 240;
  const CHAT_H = isCat2() ? CAT2_WINDOW_H : 442;
  const LOOK_H = 344;
  const SETTINGS_H = isCat2() ? CAT2_WINDOW_H : 520;

  function syncLayout(height) {
    const h = height || (isOpen
      ? (activeTab === 'look' ? LOOK_H : activeTab === 'settings' ? SETTINGS_H : CHAT_H)
      : COMPACT_H);
    if (window.MeowProductivity?.applyWindowSize) {
      // Cat-role applyWindowSize reads chat open state
      window.MeowProductivity.applyWindowSize();
    } else {
      window.meowAPI?.resizeWindow?.(220, isCat2() ? CAT2_WINDOW_H : h, !isCat2());
    }
  }

  function catExpr(expr) {
    window.MeowCat?.setExpression?.(expr);
  }

  function chatStore() {
    return window.sessionStorage;
  }

  function loadChatHistory() {
    try {
      localStorage.removeItem(CHAT_HISTORY_KEY);
      const raw = chatStore().getItem(CHAT_HISTORY_KEY);
      if (!raw) return [];
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr.slice(-MAX_HISTORY) : [];
    } catch (_) {
      return [];
    }
  }

  function saveChatHistory(role, text) {
    const hist = loadChatHistory();
    hist.push({ role, text, ts: Date.now() });
    chatStore().setItem(CHAT_HISTORY_KEY, JSON.stringify(hist.slice(-MAX_HISTORY)));
  }

  function switchTab(tab) {
    activeTab = tab;
    tabChat?.classList.toggle('active', tab === 'chat');
    tabLook?.classList.toggle('active', tab === 'look');
    tabSettings?.classList.toggle('active', tab === 'settings');
    lookPanel?.classList.toggle('hidden', tab !== 'look');
    settingsPanel?.classList.toggle('hidden', tab !== 'settings');
    chatBody?.classList.toggle('hidden', tab !== 'chat');
    if (tab === 'chat') chatInput?.focus();
    syncLayout();
  }

  function restoreSessionMessages() {
    if (historyRestored) return;
    historyRestored = true;
    const hist = loadChatHistory();
    if (hist.length === 0) return;
    const recent = hist.slice(-5);
    const sep = document.createElement('div');
    sep.className = 'msg-session-sep';
    sep.textContent = '— last session —';
    chatMessages.appendChild(sep);
    recent.forEach((m) => {
      const div = document.createElement('div');
      div.className = `msg ${m.role}`;
      div.textContent = m.text;
      chatMessages.appendChild(div);
    });
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  function openChat(tab = 'chat', { dock = true } = {}) {
    window.meowAPI?.log?.('openChat (cat-attached)', tab);
    isOpen = true;
    if (dock) chatDocked = true;
    chatPanel.classList.remove('hidden');
    window.MeowCat?.hideSpeech?.();
    const petting = window.MeowCat?.isPetting?.();
    const feedPending = window.MeowCat?.isAwaitingFoodChoice?.() ||
      document.getElementById('cat')?.dataset.begging === 'true';
    if (!petting && window.MeowCat) {
      window.MeowCat.wakeUp?.();
      if (!feedPending) window.MeowCat.stopEating?.();
      window.MeowCat.stopWalk?.();
      if (!feedPending) window.MeowCat.stopActivity?.();
    }
    if (!feedPending) window.MeowCat?.hideFoodChoice?.();
    if (feedPending) {
      document.getElementById('food-choice')?.classList.add('hidden');
      document.getElementById('cat')?.classList.remove('feed-prompt-open');
    }
    switchTab(tab === 'settings' ? 'settings' : tab === 'look' ? 'look' : 'chat');
    hubPanelVisible = readHubPanelVisibleFromStorage();
    syncOpenHubPanelBtn();
    syncLayout();

    if (!greeted && tab !== 'settings') {
      greeted = true;
      restoreSessionMessages();
      addMessage('meow', "Hi friend! 🐱 How's your day going? I'm all ears!", false);
      if (!petting) catExpr('happy');
    }
  }

  function closeChatPanel({ dismiss = false } = {}) {
    window.meowAPI?.log?.('closeChat (cat-attached)', { dismiss });
    isOpen = false;
    if (dismiss) chatDocked = false;
    chatPanel.classList.add('hidden');
    syncOpenHubPanelBtn();
    syncLayout(COMPACT_H);
    const feedPending = window.MeowCat?.isAwaitingFoodChoice?.() ||
      window.MeowCat?.isFeedBegging?.() ||
      document.getElementById('cat')?.dataset.begging === 'true';
    if (feedPending) window.MeowCat?.refreshFeedPromptAfterChat?.();
  }

  function addMessage(role, text, persist = true) {
    const div = document.createElement('div');
    div.className = `msg ${role}`;
    div.textContent = text;
    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    if (persist) saveChatHistory(role, text);
    return div;
  }

  function addTypingIndicator() {
    const div = document.createElement('div');
    div.className = 'msg meow typing';
    div.textContent = '...';
    div.id = 'typing-indicator';
    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  function removeTypingIndicator() {
    document.getElementById('typing-indicator')?.remove();
  }

  function renderResponse(response, fromAgent) {
    removeTypingIndicator();
    addMessage('meow', response.text);
    catExpr(response.expression || 'happy');
    if (fromAgent) {
      if (response.actionTaken) window.MeowCat?.bounce?.();
    } else if (response.sentiment === 'good' || response.sentiment === 'motivate') {
      window.MeowCat?.wiggle?.();
    } else if (response.sentiment === 'love' || response.sentiment === 'cute') {
      window.MeowCat?.bounce?.();
    }
  }

  async function typeAndRespond(userText) {
    addMessage('user', userText);
    chatInput.value = '';
    catExpr('thinking');
    window.MeowCat?.blink?.();
    addTypingIndicator();

    const minDelay = new Promise((r) => setTimeout(r, 400 + Math.random() * 400));
    let agentResponse = null;
    if (window.meowAPI?.agentChat) {
      try {
        const history = loadChatHistory().slice(-6);
        agentResponse = await window.meowAPI.agentChat(userText, history);
      } catch (err) {
        console.error('Meow agent error:', err);
      }
    }
    await minDelay;

    try {
      if (agentResponse && agentResponse.text) {
        renderResponse(agentResponse, true);
      } else if (window.MeowPersonality?.respond) {
        renderResponse(window.MeowPersonality.respond(userText), false);
      } else {
        removeTypingIndicator();
        addMessage('meow', '*confused meow* Try again? 🐾');
      }
    } catch (err) {
      console.error('Meow response error:', err);
      removeTypingIndicator();
      addMessage('meow', '*confused meow* My brain hiccuped! Try again? 🐾');
      catExpr('sad');
    }
  }

  function sendMessage() {
    const text = chatInput?.value?.trim();
    if (!text) return;
    window.dispatchEvent(new CustomEvent('meow:chat-send', { detail: { text } }));
    typeAndRespond(text);
  }

  tabChat?.addEventListener('click', (e) => { e.stopPropagation(); switchTab('chat'); });
  tabLook?.addEventListener('click', (e) => { e.stopPropagation(); switchTab('look'); });
  tabSettings?.addEventListener('click', (e) => { e.stopPropagation(); switchTab('settings'); });
  sendBtn?.addEventListener('click', (e) => { e.stopPropagation(); sendMessage(); });
  chatInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') sendMessage();
    e.stopPropagation();
  });
  openHubPanelBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    window.meowAPI?.log?.('chat header → hub:open');
    window.meowAPI?.broadcast?.('hub:open', { tab: 'tasks' });
  });

  window.addEventListener('meow:hub-visibility', (ev) => {
    hubPanelVisible = !!(ev.detail?.showHub || ev.detail?.showPinned);
    syncOpenHubPanelBtn();
  });

  closeChat?.addEventListener('click', (e) => {
    e.stopPropagation();
    closeChatPanel({ dismiss: true });
    catExpr('happy');
    window.MeowCat?.showSpeech?.('Mrow! Come back anytime~ 🐾', 3000);
  });

  function toggleChatPanel() {
    if (isOpen) closeChatPanel({ dismiss: false });
    else openChat(activeTab, { dock: true });
  }

  quickBtns.forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (btn.dataset.action === 'stop-scratch') return;
      const prompt = btn.dataset.prompt;
      if (!prompt) return;
      if (prompt === 'How was your day?') {
        typeAndRespond("Hey Meow, how should I tell you about my day?");
        setTimeout(() => {
          addMessage('meow', "Just tell meow however you feel! Good, okay, bad — I'm here for all of it~ ☀️");
        }, 1200);
      } else if (prompt === 'I need motivation') {
        typeAndRespond('I need some motivation please');
      } else if (prompt === 'Tell me something cute') {
        typeAndRespond('Tell me something cute!');
      } else {
        typeAndRespond(prompt);
      }
    });
  });

  document.getElementById('quick-tasks-btn')?.addEventListener('click', (e) => {
    e.stopPropagation();
    closeChatPanel();
    window.meowAPI?.broadcast?.('hub:open', { tab: 'tasks' });
  });

  document.getElementById('quick-focus-btn')?.addEventListener('click', (e) => {
    e.stopPropagation();
    closeChatPanel();
    window.meowAPI?.broadcast?.('hub:open', { tab: 'focus' });
  });

  window.addEventListener('meow:open-chat', (ev) => {
    openChat(ev.detail?.tab || 'chat');
  });

  window.MeowChat = {
    open: openChat,
    close: closeChatPanel,
    toggle: toggleChatPanel,
    isOpen: () => isOpen,
    isDocked: () => chatDocked,
  };
})();
