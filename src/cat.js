/**
 * Cat controller — SVG cat, animations, eye tracking, petting, drag-to-feed
 */
(() => {
  const catEl = document.getElementById('cat');
  const catFigure = document.getElementById('cat-figure');
  const catContainer = document.getElementById('cat-container');
  const petZoneHead = document.getElementById('pet-zone-head');
  const petHearts = document.getElementById('pet-hearts');
  const catLoafView = document.getElementById('cat-svg-loaf');
  const speechBubble = document.getElementById('speech-bubble');
  const speechText = document.getElementById('speech-text');
  const zzzBubble = document.querySelector('.zzz-bubble');
  const foodBowl = document.getElementById('food-bowl');
  const nomFloat = document.querySelector('.nom-float');
  const activityProps = document.getElementById('activity-props');
  const foodChoice = document.getElementById('food-choice');
  const quitBtn = document.getElementById('quit-btn');
  const contextMenu = document.getElementById('context-menu');

  const BOWL_COOLDOWN_MS = 20 * 60 * 1000; // 20 minutes
  const BOWL_COOLDOWN_KEY = 'meowBowlCooldownUntil';
  const COMPACT_H = 240;
  const BREAK_ALERT_H = 327;

  let speechTimeout = null;
  let isDraggingWindow = false;
  let dragStart = { x: 0, y: 0 };
  let hasMoved = false;
  let isSleeping = false;
  let isEating = false;
  let isPetting = false;
  let isBusy = false;
  let isWalking = false;
  let walkInterval = null;
  let foodMood = null;        // 'good' | 'grumpy' | null
  let foodMoodTimeout = null;
  let awaitingFoodChoice = false;
  let sleepTimeout = null;
  let eatTimeout = null;
  let activityTimeout = null;
  let bowlCooldownTimeout = null;
  let animLock = false;
  let mouseX = window.innerWidth / 2;
  let mouseY = window.innerHeight / 2;
  let eyeLoopId = null;
  let lastPetTime = 0;
  let bowlCooldownUntil = 0;

  let bowlDragging = false;
  let bowlOffset = { x: 0, y: 0 };
  let bowlHome = { x: 0, y: 0 };

  const EXPRESSIONS = ['happy', 'love', 'excited', 'thinking', 'sleepy', 'sad'];
  const POSES = ['loaf', 'sleep', 'eat'];

  const ANIMATIONS = [
    'bounce', 'wiggle', 'stretch', 'tailWag', 'purr', 'shake', 'hop', 'spin',
    'knead', 'yawn', 'headTiltL', 'headTiltR', 'earTwitch', 'pawWave', 'roll',
    'pounce', 'sneak', 'alert', 'curious', 'startled', 'shy', 'proud', 'dizzy',
    'sneeze', 'cleanPaw', 'groom', 'tailFlick', 'sideLook', 'nod', 'shakeHead',
    'lean', 'crouch', 'peek', 'surprised', 'angry', 'laugh', 'shiver', 'warm',
    'stretchUp', 'stretchDown', 'buttWiggle', 'jump', 'land', 'float', 'pulse',
    'jiggle', 'sway', 'twist', 'squish', 'inflate', 'tippy', 'wobble', 'zoom',
    'slide', 'flip', 'rock', 'twitch', 'sniff', 'lick', 'stretchSide', 'arch',
  ];

  const HEAD_PET_LINES = [
    'Purr purr~ 💕', 'Mrow! That feels nice~', '*happy purr*', 'More pets please!',
    '*nuzzles*', 'Best human ever~', 'Purrrrrrr~',
  ];

  const HINTS = [
    '💬 Click me → chat',
    '💕 Tap my head → purrs',
    '🍽️ Drag bowl → feed me',
    '✋ Drag space → move me',
    '👆 Right-click → hide',
    '× near ear → quit',
    '⏰ 2 hrs work → break nudge',
    '🐟 Bowl cooldown: 20 min',
    '👀 Eyes follow cursor',
    '👗 Chat → change my look',
    '💻 I do my own thing~',
  ];

  const FOOD_BEG_LINES = [
    'Mrow… I\'m hungry 🐟', 'Feed me pleeease? 🥺',
    '*stares at bowl* …hungry…', 'Is it snack time yet?! 🍗',
    'Food. Now. Please. 😿', '*paw pats bowl* Feed me~',
    'Mroooow… belly empty 😾',
  ];

  const FOOD_REACTIONS = {
    plain: {
      like: [
        'Mmm, simple and yummy~ 😋', '*happy munch munch*', 'Just what I needed! 🍚',
        'Purrfect meal~', '*satisfied purr*',
      ],
      dislike: [
        '...boring. I wanted fish. 😒', '*sniffs and walks away*',
        'Mrow. Fine. I guess. 😾', '*eats reluctantly*', 'You call THIS food? 😤',
      ],
    },
    fishy: {
      like: [
        'FISH!! BEST DAY EVER!! 🐟💕', '*ecstatic purring*',
        'Mroooow!! I LOVE YOU!! 🐟🐟', 'FISHY!!! YES!!! 😻',
        '*rolls in joy* Fish fish fish!!',
      ],
      dislike: [
        'Ewww too fishy today! 😾', '*dramatic spit* BLECH.',
        'Not in the mood for fish… 😒', '*pushes bowl away grumpily*',
        'I wanted plain today! 😤',
      ],
    },
  };

  const GOOD_MOOD_LINES = [
    '*happy purring* 💕', 'Life is purrfect~ 😻', 'Full tummy, happy kitty~',
    '*does a little spin*', 'Everything is wonderful! ✨',
  ];

  const GRUMPY_MOOD_LINES = [
    'Hmph. 😾', 'Don\'t talk to me.', '*sulks in corner*',
    'Still grumpy about that meal…', 'Mrow. Leave me alone. 😒',
  ];

  const IDLE_ACTIVITIES = [
    {
      id: 'laptop',
      minMs: 14000, maxMs: 24000,
      expression: 'thinking',
      lines: ['*tap tap* Working hard~ 💻', 'Sending meow-mails…', 'Busy cat, do not disturb!'],
    },
    {
      id: 'read',
      minMs: 12000, maxMs: 20000,
      expression: 'happy',
      lines: ['*turns page* Good book~ 📖', 'This story is purrfect!', 'Shhh, reading~'],
    },
    {
      id: 'phone',
      minMs: 10000, maxMs: 18000,
      expression: 'excited',
      lines: ['*scroll scroll* Ooh! 👀', 'Texting my cat friends~', 'One sec, on my phone!'],
    },
    {
      id: 'coffee',
      minMs: 8000, maxMs: 14000,
      expression: 'happy',
      lines: ['*sip sip* Ahh~ ☕', 'Coffee break~', 'Warm and cozy…'],
    },
    {
      id: 'notebook',
      minMs: 12000, maxMs: 22000,
      expression: 'thinking',
      lines: ['*scribble* Important notes~ 📝', 'Writing my memoir…', 'Genius ideas only!'],
    },
    {
      id: 'game',
      minMs: 10000, maxMs: 18000,
      expression: 'excited',
      lines: ['*button mash* Almost got it! 🎮', 'High score incoming~', 'Just one more level!'],
    },
  ];

  const BREAK_MESSAGES = [
    (h, m) => `Hey! ${h}h ${m}m of non-stop work~ Stretch & hydrate! 🧘💧`,
    (h, m) => `MROW! You've been going ${h}h ${m}m straight! Rest your eyes~ 👀💕`,
    (h, m) => `${h}h ${m}m already?! Take a mini break — pet me after! 🐾`,
    (h, m) => `Break time!! ${h}h ${m}m is a lot~ Stand up & wiggle like me! 💃`,
    (h, m) => `Human!! ${h}h ${m}m of work — even cats nap. You should too~ 😺`,
  ];

  let breakAlertActive = false;
  let breakAnimInterval = null;
  let breakGlowInterval = null;

  /* ── Food bowl cooldown ── */
  function loadBowlCooldown() {
    const stored = localStorage.getItem(BOWL_COOLDOWN_KEY);
    bowlCooldownUntil = stored ? parseInt(stored, 10) : 0;
    updateBowlVisibility();
  }

  function saveBowlCooldown() {
    localStorage.setItem(BOWL_COOLDOWN_KEY, String(bowlCooldownUntil));
  }

  function isBowlOnCooldown() {
    return Date.now() < bowlCooldownUntil;
  }

  function startBowlCooldown() {
    bowlCooldownUntil = Date.now() + BOWL_COOLDOWN_MS;
    saveBowlCooldown();
    hideFoodBowl();
    if (bowlCooldownTimeout) clearTimeout(bowlCooldownTimeout);
    const remaining = bowlCooldownUntil - Date.now();
    bowlCooldownTimeout = setTimeout(() => {
      bowlCooldownUntil = 0;
      localStorage.removeItem(BOWL_COOLDOWN_KEY);
      showFoodBowl();
    }, remaining);
  }

  function hideFoodBowl() {
    foodBowl.classList.add('hidden', 'on-cooldown');
    resetBowlPosition();
  }

  function showFoodBowl() {
    if (isBowlOnCooldown()) return;
    foodBowl.classList.remove('hidden', 'on-cooldown');
  }

  function updateBowlVisibility() {
    if (isBowlOnCooldown()) {
      hideFoodBowl();
      const remaining = bowlCooldownUntil - Date.now();
      if (remaining > 0) {
        if (bowlCooldownTimeout) clearTimeout(bowlCooldownTimeout);
        bowlCooldownTimeout = setTimeout(() => {
          bowlCooldownUntil = 0;
          localStorage.removeItem(BOWL_COOLDOWN_KEY);
          showFoodBowl();
        }, remaining);
      }
    } else {
      showFoodBowl();
    }
  }

  /* ── Eye tracking ── */
  function eyesShouldReset() {
    if (isSleeping || isEating) return true;
    const expr = catEl.dataset.expression;
    return ['sleepy', 'love'].includes(expr) || catEl.classList.contains('blinking');
  }

  function updateEyeTracking() {
    if (eyesShouldReset()) return;

    const svg = catLoafView;
    if (!svg || catLoafView.classList.contains('hidden')) return;
    const svgRect = svg.getBoundingClientRect();
    const scaleX = svgRect.width / 120;
    const scaleY = svgRect.height / 128;
    const maxMove = 4.8;

    catLoafView.querySelectorAll('.eye-group').forEach((eye) => {
      const cx = parseFloat(eye.dataset.cx);
      const cy = parseFloat(eye.dataset.cy);
      const eyeScreenX = svgRect.left + cx * scaleX;
      const eyeScreenY = svgRect.top + cy * scaleY;

      const dx = mouseX - eyeScreenX;
      const dy = mouseY - eyeScreenY;
      const dist = Math.hypot(dx, dy) || 1;
      const reach = Math.min(dist / 35, 1);
      const lookX = (dx / dist) * maxMove * reach;
      const lookY = (dy / dist) * maxMove * reach;

      const pupil = eye.querySelector('.eye-pupil');
      const shine = eye.querySelector('.eye-shine');
      if (pupil) pupil.setAttribute('transform', `translate(${lookX}, ${lookY})`);
      if (shine) shine.setAttribute('transform', `translate(${lookX}, ${lookY})`);
    });
  }

  function stopEyeLoop() {
    if (eyeLoopId) {
      cancelAnimationFrame(eyeLoopId);
      eyeLoopId = null;
    }
  }

  /* Continuous loop — never self-terminates so eyes always respond to cursor */
  function eyeTrackingLoop() {
    if (eyesShouldReset()) {
      resetEyes();
    } else {
      updateEyeTracking();
    }
    eyeLoopId = requestAnimationFrame(eyeTrackingLoop);
  }

  function scheduleEyeUpdate() {
    if (eyeLoopId) return;
    eyeTrackingLoop();
  }

  function resetEyes() {
    stopEyeLoop();
    catLoafView?.querySelectorAll('.eye-pupil, .eye-shine').forEach((el) => {
      el.removeAttribute('transform');
    });
  }

  function setExpression(name) {
    if (!EXPRESSIONS.includes(name)) return;
    catEl.dataset.expression = name;
  }

  function setPose(name) {
    if (!POSES.includes(name)) return;
    catEl.dataset.pose = name;
    isSleeping = name === 'sleep';
    isEating = name === 'eat';

    if (isSleeping) {
      setExpression('sleepy');
      zzzBubble?.classList.remove('hidden');
      resetBowlPosition();
    } else if (isEating) {
      nomFloat?.classList.add('show');
    } else {
      zzzBubble?.classList.add('hidden');
      nomFloat?.classList.remove('show');
      if (catEl.dataset.expression === 'sleepy') setExpression('happy');
    }
  }

  function playAnimation(name, duration) {
    if (!ANIMATIONS.includes(name)) return;
    const cls = `anim-${name}`;
    const ms = duration || 600;
    catEl.classList.remove(...ANIMATIONS.map((a) => `anim-${a}`));
    void catEl.offsetWidth;
    catEl.classList.add(cls);
    setTimeout(() => catEl.classList.remove(cls), ms);
  }

  function playRandomAnimation() {
    const name = ANIMATIONS[Math.floor(Math.random() * ANIMATIONS.length)];
    playAnimation(name);
    return name;
  }

  function bounce() { playAnimation('bounce', 550); }
  function wiggle() { playAnimation('wiggle', 450); }

  /* ── Idle activities (cat's own business) ── */
  function canDoActivity() {
    return !isChatOpen() && !animLock && !isSleeping && !isEating &&
      !isPetting && !breakAlertActive && !isBusy;
  }

  function stopActivity() {
    if (activityTimeout) clearTimeout(activityTimeout);
    activityTimeout = null;
    isBusy = false;
    if (!isSleeping && !isEating) animLock = false;
    catEl.dataset.activity = 'none';
    activityProps?.classList.add('hidden');
    if (!isSleeping && !isEating && !isPetting && catEl.dataset.expression !== 'love') {
      setExpression('happy');
    }
    scheduleEyeUpdate();
  }

  function startActivity(activity) {
    if (!canDoActivity()) return;
    stopActivity();

    isBusy = true;
    animLock = true;
    catEl.dataset.activity = activity.id;
    activityProps?.classList.remove('hidden');
    setExpression(activity.expression);
    hideSpeech();

    const line = activity.lines[Math.floor(Math.random() * activity.lines.length)];
    showSpeech(line, 4500);

    const duration = activity.minMs + Math.random() * (activity.maxMs - activity.minMs);
    activityTimeout = setTimeout(() => {
      stopActivity();
      if (!isChatOpen() && Math.random() < 0.35) {
        showSpeech('*stretch* Back to loaf mode~', 2500);
        playAnimation('stretch', 700);
      }
    }, duration);
  }

  function startRandomActivity() {
    const act = IDLE_ACTIVITIES[Math.floor(Math.random() * IDLE_ACTIVITIES.length)];
    startActivity(act);
  }

  /* ── Food begging ── */
  function begForFood() {
    if (!canDoActivity() || isBowlOnCooldown()) return;
    setExpression('sad');
    playAnimation('lean', 500);
    const line = FOOD_BEG_LINES[Math.floor(Math.random() * FOOD_BEG_LINES.length)];
    showSpeech(line, 3000);
    setTimeout(() => {
      if (!isSleeping && !isEating && !isChatOpen()) showFoodChoice();
    }, 1200);
  }

  /* ── Window walk ── */
  function stopWalk() {
    if (walkInterval) { clearInterval(walkInterval); walkInterval = null; }
    isWalking = false;
    catEl.classList.remove('walking-left', 'walking-right');
    if (!isSleeping && !isEating) animLock = false;
    isBusy = false;
    scheduleEyeUpdate();
  }

  function startWalk() {
    if (!canDoActivity()) return;
    stopWalk();

    isWalking = true;
    isBusy = true;
    animLock = true;

    const goLeft = Math.random() < 0.5;
    const dir = goLeft ? -1 : 1;
    catEl.classList.add(goLeft ? 'walking-left' : 'walking-right');

    const speechIdx = Math.floor(Math.random() * 3);
    const walkSpeech = [
      'Patrol time~ 🐾', '*sniff sniff* exploring!', 'Just going for a walk~',
    ][speechIdx];
    showSpeech(walkSpeech, 3000);
    setExpression('curious' in window ? 'happy' : 'happy');

    const stepPx = 2;
    const stepMs = 60;
    const walkDuration = 4000 + Math.random() * 4000;

    walkInterval = setInterval(() => {
      if (isChatOpen() || isSleeping || isEating || isPetting || breakAlertActive) {
        stopWalk();
        return;
      }
      window.meowAPI?.dragWindow(dir * stepPx, 0);
    }, stepMs);

    setTimeout(() => {
      stopWalk();
      if (!isChatOpen()) {
        const arrived = ['*sniff* interesting spot~', 'Ah, good spot. 😌', '*looks around*'];
        showSpeech(arrived[Math.floor(Math.random() * arrived.length)], 2500);
        playAnimation('sniff', 500);
        setTimeout(() => playAnimation('headTiltL', 450), 600);
      }
    }, walkDuration);
  }

  /* ── Petting ── */
  function spawnHeart(x, y) {
    const heart = document.createElement('span');
    heart.className = 'pet-heart';
    heart.textContent = ['💕', '💖', '💗', '✨', '🩷', '😻'][Math.floor(Math.random() * 6)];
    const rect = catContainer.getBoundingClientRect();
    heart.style.left = `${x - rect.left + (Math.random() - 0.5) * 24}px`;
    heart.style.top = `${y - rect.top - 10 + (Math.random() - 0.5) * 16}px`;
    petHearts.appendChild(heart);
    setTimeout(() => heart.remove(), 1200);
  }

  function petHead(e) {
    if (isSleeping) { wakeUp(); return; }
    if (isEating) return;
    hideFoodChoice();
    stopWalk();
    stopActivity();

    isPetting = true;
    const now = Date.now();
    setExpression('love');
    playAnimation('purr', 900);
    setTimeout(() => playAnimation('headTiltL', 450), 300);
    spawnHeart(e.clientX, e.clientY);

    if (now - lastPetTime > 2500) {
      showSpeech(HEAD_PET_LINES[Math.floor(Math.random() * HEAD_PET_LINES.length)], 2500);
      lastPetTime = now;
    }

    setTimeout(() => {
      isPetting = false;
      if (catEl.dataset.expression === 'love') setExpression('happy');
      scheduleEyeUpdate();
    }, 800);
  }

  /* ── Food bowl drag-to-feed ── */
  function resetBowlPosition() {
    foodBowl.style.position = '';
    foodBowl.style.left = '';
    foodBowl.style.top = '';
    foodBowl.style.transform = '';
    foodBowl.classList.remove('dragging', 'near-cat');
  }

  function getBowlCenter() {
    const rect = foodBowl.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  }

  function getCatMouthCenter() {
    const svg = catLoafView;
    const rect = svg.getBoundingClientRect();
    const scaleX = rect.width / 120;
    const scaleY = rect.height / 128;
    return { x: rect.left + 60 * scaleX, y: rect.top + 72 * scaleY };
  }

  function checkBowlNearCat() {
    const bowl = getBowlCenter();
    const mouth = getCatMouthCenter();
    const dist = Math.hypot(bowl.x - mouth.x, bowl.y - mouth.y);
    if (dist < 45) {
      foodBowl.classList.add('near-cat');
      return true;
    }
    foodBowl.classList.remove('near-cat');
    return false;
  }

  /* ── Food choice ── */
  function showFoodChoice() {
    if (isBowlOnCooldown() || isSleeping || isEating || isChatOpen()) return;
    awaitingFoodChoice = true;
    hideSpeech();
    foodChoice?.classList.remove('hidden');
    setExpression('excited');
  }

  function hideFoodChoice() {
    awaitingFoodChoice = false;
    foodChoice?.classList.add('hidden');
  }

  function applyFoodMood(mood) {
    foodMood = mood;
    catEl.dataset.mood = mood;
    if (foodMoodTimeout) clearTimeout(foodMoodTimeout);
    foodMoodTimeout = setTimeout(() => {
      foodMood = null;
      catEl.dataset.mood = '';
      if (!isSleeping && !isEating && !isPetting) setExpression('happy');
    }, 5 * 60 * 1000);
  }

  function feedCat(foodType) {
    if (isSleeping || isEating || animLock || isBowlOnCooldown()) return;
    hideFoodChoice();
    stopActivity();
    animLock = true;
    resetBowlPosition();
    setPose('eat');
    setExpression('happy');
    hideSpeech();
    playAnimation('nom', 400);

    eatTimeout = setTimeout(() => {
      stopEating();
      startBowlCooldown();

      const liked = Math.random() < 0.5;
      const type = foodType || (Math.random() < 0.5 ? 'plain' : 'fishy');
      const lines = FOOD_REACTIONS[type][liked ? 'like' : 'dislike'];
      const reaction = lines[Math.floor(Math.random() * lines.length)];

      applyFoodMood(liked ? 'good' : 'grumpy');

      if (liked) {
        setExpression('excited');
        playAnimation('bounce', 550);
        setTimeout(() => playAnimation('wiggle', 450), 600);
      } else {
        setExpression('sad');
        playAnimation('shake', 400);
        setTimeout(() => playAnimation('shakeHead', 400), 500);
      }
      showSpeech(reaction, 5000);
    }, 5000);
  }

  function stopEating() {
    if (eatTimeout) clearTimeout(eatTimeout);
    isEating = false;
    animLock = false;
    setPose('loaf');
    setExpression('happy');
    nomFloat?.classList.remove('show');
    resetBowlPosition();
  }

  function wakeUp() {
    if (!isSleeping) return false;
    if (sleepTimeout) clearTimeout(sleepTimeout);
    animLock = false;
    setPose('loaf');
    setExpression('happy');
    playAnimation('yawn', 900);
    showSpeech('*yawn* Mrow... nice nap~', 3000);
    scheduleEyeUpdate();
    return true;
  }

  function goToSleep(duration = 20000) {
    if (isSleeping || isEating || animLock || isChatOpen()) return;
    stopActivity();
    animLock = true;
    setPose('sleep');
    hideSpeech();
    sleepTimeout = setTimeout(() => {
      setPose('loaf');
      setExpression('happy');
      animLock = false;
      showSpeech('*stretch* Good nap~', 2500);
      playAnimation('stretch', 800);
      scheduleEyeUpdate();
    }, duration);
  }

  function goToEat() {
    if (isSleeping || isEating || animLock || isChatOpen() || isBowlOnCooldown()) return;
    stopActivity();
    showSpeech('Snack time~ 🐟', 2000);
    setTimeout(() => showFoodChoice(), 800);
  }

  function blink() {
    if (isSleeping || isEating || isPetting || isBusy) return;
    catEl.classList.add('blinking');
    setTimeout(() => {
      catEl.classList.remove('blinking');
      scheduleEyeUpdate();
    }, 150);
  }

  function startBlinkLoop() {
    const schedule = () => {
      setTimeout(() => {
        if (!isSleeping && !isEating && !isPetting && !isBusy) blink();
        schedule();
      }, 2500 + Math.random() * 4000);
    };
    schedule();
  }

  function showSpeech(text, duration = 4000) {
    if (isSleeping) return;
    speechText.textContent = text;
    speechBubble.classList.remove('hidden');
    if (speechTimeout) clearTimeout(speechTimeout);
    speechTimeout = setTimeout(() => speechBubble.classList.add('hidden'), duration);
  }

  function hideSpeech() {
    speechBubble.classList.add('hidden');
    if (speechTimeout) clearTimeout(speechTimeout);
  }

  function hideMeow() {
    hideSpeech();
    closeContextMenu();
    window.meowAPI?.hideWindow();
  }

  function quitMeow() {
    closeContextMenu();
    window.meowAPI?.quitApp();
  }

  function openContextMenu(x, y) {
    contextMenu.classList.remove('hidden');
    contextMenu.style.left = `${x}px`;
    contextMenu.style.top = `${y}px`;
  }

  function closeContextMenu() {
    contextMenu.classList.add('hidden');
  }

  function isChatOpen() {
    return !document.getElementById('chat-panel').classList.contains('hidden');
  }

  function startHintRotation() {
    const hintEl = document.getElementById('hint-text');
    if (!hintEl) return;
    let idx = 0;
    hintEl.textContent = HINTS[0];
    setInterval(() => {
      if (isChatOpen()) return;
      hintEl.classList.add('fade');
      setTimeout(() => {
        idx = (idx + 1) % HINTS.length;
        hintEl.textContent = HINTS[idx];
        hintEl.classList.remove('fade');
      }, 350);
    }, 4500);
  }

  function startIdleBehaviorLoop() {
    setInterval(() => {
      if (isChatOpen() || isSleeping || isEating || isPetting || breakAlertActive || awaitingFoodChoice) return;

      /* Mood speech overrides normal behaviour sometimes */
      if (foodMood && Math.random() < 0.35) {
        const lines = foodMood === 'good' ? GOOD_MOOD_LINES : GRUMPY_MOOD_LINES;
        showSpeech(lines[Math.floor(Math.random() * lines.length)], 3500);
        if (foodMood === 'good') { setExpression('excited'); playAnimation('wiggle', 400); }
        else { setExpression('sad'); }
        return;
      }

      const roll = Math.random();

      if (!isBusy && !animLock && roll < 0.35) {
        startRandomActivity();
      } else if (!isBusy && !animLock && roll < 0.47) {
        startWalk();
      } else if (!isBusy && !animLock && roll < 0.55 && !isBowlOnCooldown()) {
        begForFood();
      } else if (!isBusy && !animLock && roll < 0.61) {
        goToEat();
      } else if (!isBusy && !animLock && roll < 0.67) {
        goToSleep(15000 + Math.random() * 10000);
      } else if (!isBusy && roll < 0.78) {
        playRandomAnimation();
        if (roll < 0.72) {
          const quip = MeowPersonality.getIdleQuip();
          setExpression(quip.expression);
          showSpeech(quip.text, 3500);
        }
      }
    }, 9000);
  }

  function setupPetZone(zone, handler) {
    let startX = 0;
    let startY = 0;

    zone.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      e.preventDefault();
      isDraggingWindow = false;
      hasMoved = false;
      startX = e.clientX;
      startY = e.clientY;
    });

    zone.addEventListener('mouseup', (e) => {
      e.stopPropagation();
      const dist = Math.hypot(e.clientX - startX, e.clientY - startY);
      if (dist < 12) handler(e);
    });
  }

  /* ── Break reminder (2h continuous work) ── */
  function spawnBreakSparkle() {
    const rect = catContainer.getBoundingClientRect();
    const sparkle = document.createElement('span');
    sparkle.className = 'break-sparkle';
    sparkle.textContent = ['✨', '⭐', '💫', '🌟'][Math.floor(Math.random() * 4)];
    sparkle.style.left = `${20 + Math.random() * (rect.width - 40)}px`;
    sparkle.style.top = `${10 + Math.random() * 60}px`;
    catContainer.appendChild(sparkle);
    setTimeout(() => sparkle.remove(), 1500);
  }

  function stopBreakAlert() {
    breakAlertActive = false;
    if (breakAnimInterval) { clearInterval(breakAnimInterval); breakAnimInterval = null; }
    if (breakGlowInterval) { clearInterval(breakGlowInterval); breakGlowInterval = null; }
    document.getElementById('break-alert')?.classList.add('hidden');
    catContainer.classList.remove('break-alert-active');
    buddyStack()?.classList.remove('break-glow');
    window.meowAPI?.dismissBreakReminder();
    if (catEl.dataset.expression === 'excited') setExpression('happy');
    if (!isChatOpen()) window.meowAPI?.resizeWindow(220, COMPACT_H, true);
  }

  function buddyStack() {
    return document.getElementById('buddy-stack');
  }

  function triggerBreakAlert({ hours, minutes }) {
    if (breakAlertActive) return;
    breakAlertActive = true;

    if (isSleeping) wakeUp();
    if (isEating) stopEating();
    hideFoodChoice();
    stopWalk();
    stopActivity();

    hideSpeech();
    setExpression('excited');

    const h = hours || 2;
    const m = minutes || 0;
    const msgFn = BREAK_MESSAGES[Math.floor(Math.random() * BREAK_MESSAGES.length)];
    const msg = msgFn(h, m);

    const breakAlert = document.getElementById('break-alert');
    const breakText = document.getElementById('break-alert-text');
    if (breakText) breakText.textContent = msg;
    breakAlert?.classList.remove('hidden');

    showSpeech(msg, 14000);
    window.meowAPI?.resizeWindow(220, BREAK_ALERT_H, true);
    catContainer.classList.add('break-alert-active');
    buddyStack()?.classList.add('break-glow');

    const attentionAnims = ['alert', 'hop', 'bounce', 'wiggle', 'jump', 'pawWave', 'headTiltL', 'headTiltR'];
    let animIdx = 0;
    playAnimation(attentionAnims[0], 500);

    breakAnimInterval = setInterval(() => {
      animIdx += 1;
      playAnimation(attentionAnims[animIdx % attentionAnims.length], 550);
      if (animIdx % 2 === 0) spawnBreakSparkle();
      spawnHeart(
        catContainer.getBoundingClientRect().left + 40 + Math.random() * 40,
        catContainer.getBoundingClientRect().top + 20
      );
    }, 750);

    breakGlowInterval = setInterval(() => spawnBreakSparkle(), 400);

    setTimeout(() => {
      if (breakAlertActive) stopBreakAlert();
    }, 20000);
  }

  /* ── Event listeners ── */
  window.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
    scheduleEyeUpdate();

    if (bowlDragging) {
      const scene = document.querySelector('.cat-scene');
      const sceneRect = scene.getBoundingClientRect();
      foodBowl.style.left = `${e.clientX - sceneRect.left - bowlOffset.x}px`;
      foodBowl.style.top = `${e.clientY - sceneRect.top - bowlOffset.y}px`;
      checkBowlNearCat();
      return;
    }

    if (!isDraggingWindow) return;
    const dx = e.screenX - dragStart.x;
    const dy = e.screenY - dragStart.y;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) hasMoved = true;
    if (hasMoved && window.meowAPI) {
      window.meowAPI.dragWindow(dx, dy);
      dragStart = { x: e.screenX, y: e.screenY };
    }
  });

  window.addEventListener('mouseup', () => {
    if (bowlDragging) {
      bowlDragging = false;
      foodBowl.classList.remove('dragging');
      if (checkBowlNearCat() && !isBowlOnCooldown()) {
        showFoodChoice();
      } else {
        resetBowlPosition();
      }
      return;
    }
    isDraggingWindow = false;
  });

  foodBowl.addEventListener('mousedown', (e) => {
    e.stopPropagation();
    e.preventDefault();
    if (isSleeping || isBowlOnCooldown()) return;
    bowlDragging = true;
    foodBowl.classList.add('dragging');
    const scene = document.querySelector('.cat-scene');
    const sceneRect = scene.getBoundingClientRect();
    const rect = foodBowl.getBoundingClientRect();
    foodBowl.style.position = 'absolute';
    foodBowl.style.left = `${rect.left - sceneRect.left}px`;
    foodBowl.style.top = `${rect.top - sceneRect.top}px`;
    bowlOffset = { x: e.clientX - rect.left, y: e.clientY - rect.top };
  });

  setupPetZone(petZoneHead, petHead);

  catFigure.addEventListener('click', (e) => {
    if (e.target.closest('.pet-zone') || e.target.closest('#food-bowl') || e.target.closest('.quit-x')) return;
    if (hasMoved) return;
    e.stopPropagation();
    if (wakeUp()) return;
    if (isEating) {
      stopEating();
      showSpeech('Mrow? More food later~', 2000);
      return;
    }
    stopWalk();
    stopActivity();
    bounce();
    window.dispatchEvent(new CustomEvent('meow:click'));
  });

  catContainer.addEventListener('mousedown', (e) => {
    if (e.target.closest('.quit-x') || e.target.closest('.chat-panel') ||
        e.target.closest('#food-bowl') || e.target.closest('.pet-zone')) return;
    closeContextMenu();
    isDraggingWindow = true;
    hasMoved = false;
    dragStart = { x: e.screenX, y: e.screenY };
  });

  quitBtn.addEventListener('mousedown', (e) => e.stopPropagation());
  quitBtn.addEventListener('click', (e) => { e.stopPropagation(); quitMeow(); });

  catContainer.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    e.stopPropagation();
    openContextMenu(e.clientX, e.clientY);
  });

  contextMenu.querySelectorAll('button').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (btn.dataset.action === 'hide') hideMeow();
      if (btn.dataset.action === 'quit') quitMeow();
    });
  });

  document.addEventListener('click', () => closeContextMenu());

  foodChoice?.querySelectorAll('.food-opt').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const foodType = btn.dataset.food;
      hideFoodChoice();
      feedCat(foodType);
    });
  });

  document.getElementById('break-dismiss')?.addEventListener('click', (e) => {
    e.stopPropagation();
    stopBreakAlert();
    showSpeech('Good human~ Rest soon, okay? 💕', 3000);
    playAnimation('purr', 700);
  });

  if (window.meowAPI?.onBreakReminder) {
    window.meowAPI.onBreakReminder(triggerBreakAlert);
  }

  loadBowlCooldown();

  setTimeout(() => {
    const greeting = MeowPersonality.getGreeting();
    setExpression(greeting.expression);
    showSpeech(greeting.text, 5000);
  }, 1200);

  setTimeout(() => startRandomActivity(), 18000);

  startBlinkLoop();
  startIdleBehaviorLoop();
  startHintRotation();
  scheduleEyeUpdate();

  window.MeowCat = {
    setExpression, setPose, bounce, wiggle,
    showSpeech, hideSpeech, blink, wakeUp, stopEating,
    playAnimation, playRandomAnimation, triggerBreakAlert,
    stopActivity, startRandomActivity, stopWalk, startWalk, begForFood,
    showFoodChoice, hideFoodChoice,
  };
})();
