/**
 * Chat panel — dialog with Meow personality engine
 */
(() => {
  const chatPanel = document.getElementById('chat-panel');
  const chatMessages = document.getElementById('chat-messages');
  const chatInput = document.getElementById('chat-input');
  const sendBtn = document.getElementById('send-btn');
  const closeChat = document.getElementById('close-chat');
  const quickBtns = document.querySelectorAll('.quick-btn');
  const tabChat = document.getElementById('tab-chat');
  const tabLook = document.getElementById('tab-look');
  const lookPanel = document.getElementById('look-panel');
  const chatBody = document.getElementById('chat-body');

  let isOpen = false;
  let greeted = false;
  let activeTab = 'chat';

  const COMPACT_SIZE = { width: 220, height: 240 };
  const CHAT_SIZE   = { width: 220, height: 442 };
  const LOOK_SIZE   = { width: 220, height: 344 };

  function resizeWindow(size, anchorBottom = false) {
    if (window.meowAPI?.resizeWindow) {
      window.meowAPI.resizeWindow(size.width, size.height, anchorBottom);
    }
  }

  function switchTab(tab) {
    activeTab = tab;
    tabChat.classList.toggle('active', tab === 'chat');
    tabLook.classList.toggle('active', tab === 'look');
    lookPanel.classList.toggle('hidden', tab !== 'look');
    chatBody.classList.toggle('hidden', tab !== 'chat');
    if (tab === 'look') {
      resizeWindow(LOOK_SIZE, true);
    } else {
      resizeWindow(CHAT_SIZE, true);
      chatInput.focus();
    }
  }

  function openChat() {
    isOpen = true;
    chatPanel.classList.remove('hidden');
    window.MeowCat.hideSpeech();
    if (window.MeowCat.wakeUp) window.MeowCat.wakeUp();
    if (window.MeowCat.stopEating) window.MeowCat.stopEating();
    if (window.MeowCat.stopWalk) window.MeowCat.stopWalk();
    if (window.MeowCat.stopActivity) window.MeowCat.stopActivity();
    if (window.MeowCat.hideFoodChoice) window.MeowCat.hideFoodChoice();
    switchTab('chat');

    if (!greeted) {
      greeted = true;
      addMessage('meow', "Hi friend! 🐱 How's your day going? I'm all ears!");
      window.MeowCat.setExpression('happy');
    }
  }

  function closeChatPanel() {
    isOpen = false;
    chatPanel.classList.add('hidden');
    resizeWindow(COMPACT_SIZE, true);
  }

  function addMessage(role, text) {
    const div = document.createElement('div');
    div.className = `msg ${role}`;
    div.textContent = text;
    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;
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
    const el = document.getElementById('typing-indicator');
    if (el) el.remove();
  }

  function typeAndRespond(userText) {
    addMessage('user', userText);
    chatInput.value = '';

    window.MeowCat.setExpression('thinking');
    window.MeowCat.blink();
    addTypingIndicator();

    setTimeout(() => {
      removeTypingIndicator();
      try {
        const response = MeowPersonality.respond(userText);
        addMessage('meow', response.text);
        window.MeowCat.setExpression(response.expression);

        if (response.sentiment === 'good' || response.sentiment === 'motivate') {
          window.MeowCat.wiggle();
        } else if (response.sentiment === 'love' || response.sentiment === 'cute') {
          window.MeowCat.bounce();
        }
      } catch (err) {
        console.error('Meow response error:', err);
        addMessage('meow', "*confused meow* My brain hiccuped! Try again? 🐾");
        window.MeowCat.setExpression('sad');
      }
    }, 400 + Math.random() * 600);
  }

  function sendMessage() {
    const text = chatInput.value.trim();
    if (!text) return;
    typeAndRespond(text);
  }

  tabChat.addEventListener('click', (e) => { e.stopPropagation(); switchTab('chat'); });
  tabLook.addEventListener('click', (e) => { e.stopPropagation(); switchTab('look'); });

  sendBtn.addEventListener('click', sendMessage);

  chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') sendMessage();
    e.stopPropagation();
  });

  closeChat.addEventListener('click', (e) => {
    e.stopPropagation();
    closeChatPanel();
    window.MeowCat.setExpression('happy');
    window.MeowCat.showSpeech('Mrow! Come back anytime~ 🐾', 3000);
  });

  quickBtns.forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const prompt = btn.dataset.prompt;
      if (prompt === 'How was your day?') {
        typeAndRespond("Hey Meow, how should I tell you about my day?");
        setTimeout(() => {
          addMessage('meow', "Just tell meow however you feel! Good, okay, bad — I'm here for all of it~ ☀️");
        }, 1200);
      } else if (prompt === 'I need motivation') {
        typeAndRespond("I need some motivation please");
      } else if (prompt === 'Tell me something cute') {
        typeAndRespond("Tell me something cute!");
      }
    });
  });

  window.addEventListener('meow:click', () => {
    if (isOpen) {
      closeChatPanel();
    } else {
      openChat();
    }
  });

  document.addEventListener('click', (e) => {
    if (!isOpen) return;
    if (!chatPanel.contains(e.target) && !document.getElementById('cat-container').contains(e.target)) {
      closeChatPanel();
    }
  });
})();
