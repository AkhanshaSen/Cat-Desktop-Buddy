/**
 * Cat 2 controller — transparent video clips, same behaviour as Cat 1.
 */
(() => {
  const catEl = document.getElementById('cat');
  const catFigure = document.getElementById('cat-figure');
  const catContainer = document.getElementById('cat-container');
  const cat2VideoA = document.getElementById('cat2-video-a');
  const cat2VideoB = document.getElementById('cat2-video-b');
  const cat2CanvasA = document.getElementById('cat2-canvas-a');
  const cat2CanvasB = document.getElementById('cat2-canvas-b');
  const speechBubble = document.getElementById('speech-bubble');
  const speechText = document.getElementById('speech-text');
  const zzzBubble = document.querySelector('.zzz-bubble');
  const foodBowl = document.getElementById('food-bowl');
  const nomFloat = document.querySelector('.nom-float');
  const activityProps = document.getElementById('activity-props');
  const foodChoice = document.getElementById('food-choice');
  const quitBtn = document.getElementById('quit-btn');
  const contextMenu = document.getElementById('context-menu');
  const petZoneHead = document.getElementById('pet-zone-head');
  const petHearts = document.getElementById('pet-hearts');
  const hungerMeter = document.getElementById('hunger-meter');
  const hungerMeterFill = document.getElementById('hunger-meter-fill');

  const BOWL_COOLDOWN_MS = 20 * 60 * 1000; // legacy Cat 1 bowl cooldown
  const BOWL_COOLDOWN_KEY = 'meowBowlCooldownUntil';
  const FOOD_PREFS_KEY = 'meowFoodPrefs';
  const COMPACT_H = 460;
  const BREAK_ALERT_H = 460;

  /** Cat 2 — idle / hungry / eat clip flow only */
  const CLIP_FLOW_MODE = true;
  const FEED_INTERVAL_DEFAULT_MS = 5 * 60 * 1000;
  const PET_SNAP_OPTS = { immediate: true, crossfade: false, pauseMs: 0 };
  const ACTIVITY_SNAP_OPTS = PET_SNAP_OPTS;
  const FOOD_BEG_DIALOG = 'Please feed me';
  const WALK_DECLINE_DIALOG = 'Let me go for a walk then';
  const CURSOR_AWAY_GRUMPY_MS = 20 * 1000;
  const CURSOR_NEAR_PAD_PX = 80;

  /** Cat 2 speech lines — { text, expression? } or plain strings. */
  const CAT2_DIALOGUES = {
    greetings: [
      { text: 'Mrow~ 🐾 I\'m here on your desktop!', expression: 'happy' },
      { text: '*stretches* Good to see you, human~', expression: 'happy' },
      { text: 'Purr... comfy spot. Hi hi! 😺', expression: 'love' },
      { text: '*tail swish* Ready for a cozy day together~', expression: 'happy' },
      { text: 'Meow! I claimed this corner of your screen.', expression: 'excited' },
      { text: '*slow blink* That means I trust you~ 💕', expression: 'love' },
      { text: 'Reporting for loaf duty~ 🐱', expression: 'happy' },
      { text: '*yawn* Oh! You\'re here. Perfect timing~', expression: 'sleepy' },
    ],
    idle: [
      { text: '*tail flick* …thinking about snacks.', expression: 'thinking' },
      { text: 'Mrow? Just vibing~', expression: 'happy' },
      { text: '*stares at wall* …interesting wall.', expression: 'thinking' },
      { text: 'Purr purr purr…', expression: 'love' },
      { text: '*kneads air* Soft day. Soft paws.', expression: 'happy' },
      { text: 'Do you hear that? …No? Just me then.', expression: 'thinking' },
      { text: '*ear twitch* Something moved. Maybe.', expression: 'excited' },
      { text: 'I could nap. Or zoom. Or both.', expression: 'sleepy' },
      { text: '*grooms paw* Must stay presentable~', expression: 'happy' },
      { text: 'Sunbeam status: pending. 🌤️', expression: 'thinking' },
      { text: '*loaf mode engaged* Maximum coziness.', expression: 'happy' },
      { text: 'Whisker update: all systems go.', expression: 'excited' },
      { text: 'Mrow. Life is pretty okay today~', expression: 'happy' },
      { text: '*watches dust float* Entertainment secured.', expression: 'thinking' },
      { text: 'If I fits, I sits. I fits.', expression: 'love' },
      { text: '*tiny mrow* …did you need something?', expression: 'happy' },
      { text: 'Brain empty. Heart full. 🐾', expression: 'love' },
      { text: '*sniff sniff* Smells like a good day~', expression: 'happy' },
      { text: 'Reminder: you\'re doing fine, human.', expression: 'love' },
      { text: '*blinks slowly* Take a breath with me~', expression: 'sleepy' },
      { text: 'I\'ve been practicing my loaf. Nailed it.', expression: 'happy' },
      { text: '*tail curl* Cozy levels: maximum.', expression: 'love' },
      { text: 'Meow fact: I am very round today.', expression: 'happy' },
      { text: '*yawn* Not sleepy. Just… resting my eyes.', expression: 'sleepy' },
    ],
    click: [
      { text: 'Mrow! That tickles~ 🐾', expression: 'happy' },
      { text: '*purrs* Hello hello!', expression: 'love' },
      { text: 'Yes? I was busy loafing.', expression: 'thinking' },
      { text: '*head boop* Hi human~', expression: 'love' },
      { text: 'Petting detected. Purr engine: ON.', expression: 'happy' },
      { text: 'Mrow mrow! Need something?', expression: 'excited' },
      { text: '*rolls over* Fine, you may admire me.', expression: 'love' },
      { text: 'Oh! I like the attention~ 💕', expression: 'happy' },
      { text: '*squint* Is it treat o\'clock?', expression: 'thinking' },
      { text: 'You clicked the cat. Bold choice.', expression: 'excited' },
      { text: '*paw tap* I acknowledge you.', expression: 'happy' },
      { text: 'Mrow~ Chat with me anytime!', expression: 'love' },
    ],
    pet: [
      { text: 'Purr purr~ 💕', expression: 'love' },
      { text: 'Mrow! That feels nice~', expression: 'love' },
      { text: '*happy purr*', expression: 'love' },
      { text: 'More pets please!', expression: 'happy' },
      { text: '*nuzzles* Best human ever~', expression: 'love' },
      { text: 'Purrrrrrr~', expression: 'love' },
      { text: '*melts* Keep going~', expression: 'love' },
      { text: 'Head scritches = unlocked 😻', expression: 'happy' },
      { text: '*eyes close* Perfect spot…', expression: 'love' },
      { text: 'Mrow~ I love you, human.', expression: 'love' },
    ],
    butterfly: [
      { text: '*pounce* A butterfly! 🦋', expression: 'excited' },
      { text: 'BUTTERFLY!! Wait come back!! 🦋', expression: 'excited' },
      { text: '*wiggle butt* …launch in 3… 2…', expression: 'excited' },
      { text: 'Pretty wings! Mine now! (maybe)', expression: 'happy' },
      { text: '*leap* Gotcha— …nope. Again!', expression: 'excited' },
      { text: 'Flutter friend spotted~ 🦋', expression: 'excited' },
      { text: '*chase chase* This is my sport!', expression: 'happy' },
      { text: 'So floaty. So catchable. (Probably not.)', expression: 'thinking' },
    ],
    walkPatrol: [
      { text: 'Patrol time~ 🐾', expression: 'happy' },
      { text: '*sniff sniff* Exploring!', expression: 'excited' },
      { text: 'Just going for a little walk~', expression: 'happy' },
      { text: 'Adventure mode: ON 🐾', expression: 'excited' },
      { text: '*strut* The corridor is mine.', expression: 'happy' },
      { text: 'Gotta check the perimeter~', expression: 'thinking' },
    ],
    walkDecline: [
      { text: 'Let me go for a walk then', expression: 'sad' },
      { text: 'Fine… I\'ll go for a walk instead.', expression: 'sad' },
      { text: 'No food? Walk it is, then~', expression: 'thinking' },
      { text: '*sigh* A walk might cheer me up.', expression: 'sad' },
    ],
    walkArrive: [
      { text: '*sniff* Interesting spot~', expression: 'thinking' },
      { text: 'Ah, good spot. 😌', expression: 'happy' },
      { text: '*looks around* Nice view from here~', expression: 'happy' },
      { text: 'Patrol complete. Very professional.', expression: 'happy' },
      { text: '*sits* This corner checks out.', expression: 'thinking' },
      { text: 'Made it~ Worth the stroll. 🐾', expression: 'love' },
    ],
    wake: [
      { text: '*yawn* Mrow… nice nap~', expression: 'sleepy' },
      { text: '*stretch* Where am I? Oh, hi~', expression: 'happy' },
      { text: 'Mmm… five more minutes… okay I\'m up.', expression: 'sleepy' },
      { text: '*rubs eyes* Nap complete. Purrfect.', expression: 'happy' },
      { text: 'Wha— oh. Hello again, human~', expression: 'sleepy' },
    ],
    afterNap: [
      { text: '*stretch* Good nap~', expression: 'happy' },
      { text: 'Dreamed about fish. And you. Mostly fish.', expression: 'thinking' },
      { text: '*big yawn* Refreshed and ready to loaf.', expression: 'happy' },
    ],
    feedInterrupt: [
      'Mrow? More food later~',
      'Okay okay, I\'ll wait for dinner~',
      '*licks paw* To be continued…',
      'Fine! But I\'ll remember this. 😾',
    ],
    goodMood: [
      { text: '*happy purring* 💕', expression: 'love' },
      { text: 'Life is purrfect~ 😻', expression: 'happy' },
      { text: 'Full tummy, happy kitty~', expression: 'love' },
      { text: '*does a little spin*', expression: 'excited' },
      { text: 'Everything is wonderful! ✨', expression: 'excited' },
      { text: 'Best human award goes to… you!', expression: 'love' },
      { text: '*rolls* Too happy to sit still~', expression: 'excited' },
      { text: 'Mrow! Today is a good day~', expression: 'happy' },
    ],
    grumpyMood: [
      { text: 'Hmph. 😾', expression: 'sad' },
      { text: 'Don\'t talk to me.', expression: 'sad' },
      { text: '*sulks in corner*', expression: 'sad' },
      { text: 'Still grumpy about that meal…', expression: 'sad' },
      { text: 'Mrow. Leave me alone. 😒', expression: 'sad' },
      { text: '*tail thump* Not in the mood.', expression: 'sad' },
      { text: 'I\'m fine. (I am not fine.)', expression: 'thinking' },
    ],
    grumpy: [
      { text: 'You ignored my slow blink. That means I love you, human.', expression: 'sad' },
      { text: 'Been staring at that screen for hours. I exist too, you know.', expression: 'sad' },
      { text: 'You walked past the treat jar. On purpose. I saw.', expression: 'thinking' },
      { text: 'Closed the door mid-pet. Who does that?!', expression: 'sad' },
      { text: 'Ate something crunchy without sharing. Unacceptable.', expression: 'sad' },
    ],
    woolball: [
      { text: '*bat bat* Wool ball! 🧶', expression: 'excited' },
      { text: 'Mine mine mine~ round fuzzy prey!', expression: 'excited' },
      { text: '*pounce* Gotcha! …nope, it rolled away.', expression: 'happy' },
      { text: 'This yarn ball understands me.', expression: 'love' },
      { text: '*bunny kick* Take that, wool!', expression: 'excited' },
      { text: 'Professional wool-ball hunter on duty~ 🐾', expression: 'happy' },
      { text: '*chase chase* Come back here, fuzzy sphere!', expression: 'excited' },
      { text: 'Best toy ever. Don\'t touch my ball.', expression: 'happy' },
    ],
    eatStart: [
      { text: 'Yay! Food time~ 😋', expression: 'happy' },
      { text: '*nom nom nom* Finally!', expression: 'happy' },
      { text: 'Mrow! You\'re the best human~', expression: 'love' },
      { text: '*dives into bowl* Worth the wait!', expression: 'excited' },
      { text: 'This is exactly what I needed~', expression: 'love' },
    ],
  };

  function pickDialogue(category) {
    const pool = CAT2_DIALOGUES[category];
    if (!pool?.length) return { text: 'Mrow~', expression: 'happy' };
    const item = pool[Math.floor(Math.random() * pool.length)];
    if (typeof item === 'string') return { text: item, expression: 'happy' };
    return { text: item.text, expression: item.expression || 'happy' };
  }

  function sayDialogue(category, duration = 3500) {
    const line = pickDialogue(category);
    setExpression(line.expression);
    showSpeech(line.text, duration);
  }

  let speechTimeout = null;
  let isDraggingWindow = false;
  let dragStart = { x: 0, y: 0 };
  let hasMoved = false;
  let isSleeping = false;
  let isEating = false;
  let isBusy = false;
  let isWalking = false;
  let walkTimeout = null;
  let foodMood = null;        // 'good' | 'grumpy' | null
  let foodMoodTimeout = null;
  let awaitingFoodChoice = false;
  let foodFlowActive = false;
  let foodChoiceTimeout = null;
  let feedScheduleTimeout = null;
  let feedPromptRetryTimeout = null;
  let hungerCycleStartAt = 0;
  let hungerCycleDurationMs = FEED_INTERVAL_DEFAULT_MS;
  let hungerMeterRaf = null;
  let walkThenSleep = false;
  let butterflyEndedListener = null;
  let meowEndedListener = null;
  let rollEndedListener = null;
  let groomEndedListener = null;
  let earPurrEndedListener = null;
  let grumpyEndedListener = null;
  let woolballEndedListener = null;
  let petEndedListener = null;
  let petSession = 0;
  let isPetting = false;
  let lastPetTime = 0;
  let isFocusMode = false;
  let foodPrefs = { plain: 0, fishy: 0 };
  let eyeThrottle = 0;
  let idleLoopInterval = null;
  let sleepTimeout = null;
  let lastRandomActivity = null;
  let postMealCooldownUntil = 0;
  let postMealPhase = null;
  let postMealMeta = null;
  let postMealHeartInterval = null;
  let eatTimeout = null;
  let activityTimeout = null;
  let activityWatchdog = null;
  let stateMismatchSince = 0;
  let bowlCooldownTimeout = null;
  let animLock = false;
  let mouseX = window.innerWidth / 2;
  let mouseY = window.innerHeight / 2;
  let eyeLoopId = null;
  let bowlCooldownUntil = 0;
  let lastCursorNearAt = Date.now();
  let cursorAwayCheckInterval = null;

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

  const FOOD_REACTIONS = {
    plain: {
      like: [
        'Mmm, simple and yummy~ 😋', '*happy munch munch*', 'Just what I needed! 🍚',
        'Purrfect meal~', '*satisfied purr*', 'Plain but perfect~ 🍚',
        'Comfort food! My favorite~', '*chews happily* Simple tastes best.',
        'Yay, exactly what I wanted!', '*rubs against bowl*',
      ],
      dislike: [
        '...boring. I wanted fish. 😒', '*sniffs and walks away*',
        'Mrow. Fine. I guess. 😾', '*eats reluctantly*', 'You call THIS food? 😤',
        '*one bite* …meh.', 'Where\'s the fish, human?',
        'I suppose this will do… 😒', '*stares at bowl* Really?',
      ],
    },
    fishy: {
      like: [
        'FISH!! BEST DAY EVER!! 🐟💕', '*ecstatic purring*',
        'Mroooow!! I LOVE YOU!! 🐟🐟', 'FISHY!!! YES!!! 😻',
        '*rolls in joy* Fish fish fish!!', 'Tuna vibes~ Perfect!! 🐟',
        '*happy dance* FISHY FISHY FISHY!', 'My whiskers are tingling~ 🐟',
        'You understand me. Fish. Now. Always.', '*nom nom nom* BLISS.',
      ],
      dislike: [
        'Ewww too fishy today! 😾', '*dramatic spit* BLECH.',
        'Not in the mood for fish… 😒', '*pushes bowl away grumpily*',
        'I wanted plain today! 😤', '*sniff* …pass.',
        'Fish can wait. My mood cannot.', 'Maybe tomorrow for fish~ 😾',
      ],
    },
  };

  const GOOD_MOOD_LINES = CAT2_DIALOGUES.goodMood.map((l) => l.text);
  const GRUMPY_MOOD_LINES = CAT2_DIALOGUES.grumpyMood.map((l) => l.text);

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
    if (CLIP_FLOW_MODE) {
      bowlCooldownUntil = 0;
      localStorage.removeItem(BOWL_COOLDOWN_KEY);
      return;
    }
    const stored = localStorage.getItem(BOWL_COOLDOWN_KEY);
    bowlCooldownUntil = stored ? parseInt(stored, 10) : 0;
    updateBowlVisibility();
  }

  function clearFeedScheduleTimeout() {
    if (feedScheduleTimeout) clearTimeout(feedScheduleTimeout);
    feedScheduleTimeout = null;
  }

  function clearFeedSchedule() {
    clearFeedScheduleTimeout();
    stopHungerMeterLoop();
    hungerMeter?.classList.add('hidden');
  }

  function hungerMeterColor(progress) {
    const p = Math.max(0, Math.min(1, progress));
    let hue;
    if (p < 0.55) {
      hue = 128 - (p / 0.55) * 38;
    } else if (p < 0.82) {
      hue = 90 - ((p - 0.55) / 0.27) * 58;
    } else {
      hue = 32 - ((p - 0.82) / 0.18) * 32;
    }
    const light = 44 + p * 8;
    return `hsl(${hue}, 76%, ${light}%)`;
  }

  function getHungerProgress() {
    if (catEl.dataset.begging === 'true' || awaitingFoodChoice ||
        foodFlowActive || isEating || postMealPhase) {
      return 1;
    }
    if (!hungerCycleStartAt || !hungerCycleDurationMs) return 0;
    return Math.min(1, (Date.now() - hungerCycleStartAt) / hungerCycleDurationMs);
  }

  function updateHungerMeter() {
    if (!CLIP_FLOW_MODE || !hungerMeterFill) return;

    if (getSettings().focusMode || isFocusMode) {
      hungerMeter?.classList.add('hidden');
      return;
    }

    hungerMeter?.classList.remove('hidden');
    const progress = getHungerProgress();
    hungerMeterFill.style.height = `${progress * 100}%`;
    hungerMeterFill.style.backgroundColor = hungerMeterColor(progress);
    hungerMeter?.setAttribute('aria-valuenow', String(Math.round(progress * 100)));
  }

  function stopHungerMeterLoop() {
    if (hungerMeterRaf) {
      cancelAnimationFrame(hungerMeterRaf);
      hungerMeterRaf = null;
    }
  }

  function startHungerMeterLoop() {
    stopHungerMeterLoop();
    const tick = () => {
      updateHungerMeter();
      hungerMeterRaf = requestAnimationFrame(tick);
    };
    hungerMeterRaf = requestAnimationFrame(tick);
  }

  function startHungerMeterCycle(durationMs = getFeedIntervalMs()) {
    hungerCycleStartAt = Date.now();
    hungerCycleDurationMs = Math.max(1000, durationMs);
    startHungerMeterLoop();
    updateHungerMeter();
  }

  function clearFeedPromptTimers() {
    if (feedPromptRetryTimeout) clearTimeout(feedPromptRetryTimeout);
    feedPromptRetryTimeout = null;
    if (foodChoiceTimeout) clearTimeout(foodChoiceTimeout);
    foodChoiceTimeout = null;
  }

  function tryShowFeedPrompt() {
    if (catEl.dataset.begging !== 'true') return false;
    if (awaitingFoodChoice) return true;
    if (isEating || isSleeping) return false;

    awaitingFoodChoice = true;
    foodFlowActive = true;
    hideSpeech();
    foodChoice?.classList.remove('hidden');
    catEl.classList.add('feed-prompt-open');
    setExpression('sad');
    return true;
  }

  function scheduleFeedPromptRetry() {
    if (feedPromptRetryTimeout) clearTimeout(feedPromptRetryTimeout);
    if (catEl.dataset.begging !== 'true' || awaitingFoodChoice) return;
    feedPromptRetryTimeout = setTimeout(() => {
      feedPromptRetryTimeout = null;
      if (tryShowFeedPrompt()) return;
      scheduleFeedPromptRetry();
    }, 1000);
  }

  /** Cat 2 — ask for food on a user-configured interval. */
  function scheduleFeedRequest(delayMs = getFeedIntervalMs()) {
    if (!CLIP_FLOW_MODE) return;
    clearFeedScheduleTimeout();
    startHungerMeterCycle(delayMs);

    const tryBeg = () => {
      feedScheduleTimeout = null;
      if (getSettings().focusMode || isFocusMode) {
        feedScheduleTimeout = setTimeout(tryBeg, 2000);
        return;
      }
      if (isEating) {
        feedScheduleTimeout = setTimeout(tryBeg, 1000);
        return;
      }
      if (awaitingFoodChoice) {
        feedScheduleTimeout = setTimeout(tryBeg, 2000);
        return;
      }
      if (catEl.dataset.begging === 'true') {
        tryShowFeedPrompt();
        scheduleFeedPromptRetry();
        feedScheduleTimeout = setTimeout(tryBeg, 2000);
        return;
      }
      if (foodFlowActive) {
        foodFlowActive = false;
      }
      if (!canDoActivity() || Cat2Player.isTransitioning?.()) {
        feedScheduleTimeout = setTimeout(tryBeg, 500);
        return;
      }
      if (Cat2Player.getCurrentKey() !== 'idle') {
        feedScheduleTimeout = setTimeout(tryBeg, 500);
        return;
      }
      begForFood();
    };

    feedScheduleTimeout = setTimeout(tryBeg, delayMs);
  }

  function onFeedCycleComplete() {
    if (!CLIP_FLOW_MODE) return;
    scheduleFeedRequest(getFeedIntervalMs());
  }

  function saveBowlCooldown() {
    localStorage.setItem(BOWL_COOLDOWN_KEY, String(bowlCooldownUntil));
  }

  function isBowlOnCooldown() {
    return Date.now() < bowlCooldownUntil;
  }

  function startBowlCooldown() {
    hideFoodBowl();
    if (bowlCooldownTimeout) clearTimeout(bowlCooldownTimeout);
    if (CLIP_FLOW_MODE) return;

    bowlCooldownUntil = Date.now() + BOWL_COOLDOWN_MS;
    saveBowlCooldown();
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
    if (CLIP_FLOW_MODE) return;
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

  /* ── Food preferences (learned over time) ── */
  function loadFoodPrefs() {
    try {
      const raw = localStorage.getItem(FOOD_PREFS_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (typeof saved.plain === 'number') foodPrefs.plain = Math.max(-5, Math.min(5, saved.plain));
      if (typeof saved.fishy === 'number') foodPrefs.fishy = Math.max(-5, Math.min(5, saved.fishy));
    } catch (_) { /* ignore */ }
  }

  function saveFoodPrefs() {
    localStorage.setItem(FOOD_PREFS_KEY, JSON.stringify(foodPrefs));
  }

  function getLikeChance(foodType) {
    const pref = foodPrefs[foodType] || 0;
    return Math.max(0.05, Math.min(0.95, 0.5 + pref / 10));
  }

  function updateFoodPref(foodType, liked) {
    if (!foodPrefs[foodType] && foodPrefs[foodType] !== 0) return;
    foodPrefs[foodType] = Math.max(-5, Math.min(5, foodPrefs[foodType] + (liked ? 1 : -1)));
    saveFoodPrefs();
  }

  function updateFoodStars() {
    foodChoice?.querySelectorAll('.food-opt').forEach((btn) => {
      const type = btn.dataset.food;
      const star = btn.querySelector('.food-star');
      if (!star) return;
      const show = (foodPrefs[type] || 0) >= 3;
      star.classList.toggle('hidden', !show);
    });
  }

  function isReducedMotion() {
    return document.body.dataset.reducedMotion === 'true' ||
      window.meowSettings?.reducedMotion;
  }

  function getFeedIntervalMs() {
    const mins = getSettings().feedIntervalMinutes;
    if ([5, 10, 15, 30].includes(mins)) return mins * 60 * 1000;
    return FEED_INTERVAL_DEFAULT_MS;
  }

  function getSettings() {
    return window.MeowSettings?.get?.() || window.meowSettings || {
      focusMode: isFocusMode,
      chattyLevel: 'normal',
      reducedMotion: false,
      snoozeDuration: 30,
      feedIntervalMinutes: 5,
      catSounds: true,
    };
  }

  function setFocusMode(value) {
    isFocusMode = !!value;
    document.getElementById('focus-badge')?.classList.toggle('hidden', !isFocusMode);
  }

  function getIdleIntervalMs() {
    const level = getSettings().chattyLevel;
    if (window.meowBatterySaver) return Math.max(18000, getChattyInterval(level) * 2);
    return getChattyInterval(level);
  }

  function getChattyInterval(level) {
    if (level === 'quiet') return 25000;
    if (level === 'chatty') return 7000;
    return 9000;
  }

  /* ── Video clip sync (Cat 2) ── */
  function syncVideoClip(opts = {}) {
    Cat2Player.syncFromState(opts);
  }

  /** Instant clip cut — no crossfade overlap (idle activities, pet, return to idle). */
  function snapVideoClip(opts = {}) {
    catEl.classList.add('activity-snap');
    syncVideoClip({ ...ACTIVITY_SNAP_OPTS, ...opts });
    requestAnimationFrame(() => catEl.classList.remove('activity-snap'));
  }

  function syncPetClip() {
    snapVideoClip();
  }

  function clearActivityWatchdog() {
    if (activityWatchdog) {
      clearTimeout(activityWatchdog);
      activityWatchdog = null;
    }
  }

  function armActivityWatchdog(clipKey, onTimeout, extraMs = 900) {
    clearActivityWatchdog();
    const ms = Cat2Clips.getDurationMs(clipKey) + extraMs;
    activityWatchdog = setTimeout(() => {
      activityWatchdog = null;
      onTimeout();
    }, ms);
  }

  function recoverFromStateMismatch() {
    stateMismatchSince = 0;
    const expected = Cat2Clips.forState(catEl.dataset);
    if (expected === 'idle' && !postMealPhase && !isEating && !isWalking && !isPettingNow()) {
      isBusy = false;
      animLock = false;
      if (!awaitingFoodChoice && catEl.dataset.begging !== 'true') foodFlowActive = false;
    }
    Cat2Player.forceRecover?.();
    snapVideoClip({ force: true });
  }

  function startStateSyncWatchdog() {
    setInterval(() => {
      if (isReducedMotion()) return;
      if (Cat2Player.isTransitioning?.()) {
        stateMismatchSince = 0;
        return;
      }

      const expected = Cat2Clips.forState(catEl.dataset);
      const current = Cat2Player.getCurrentKey();
      if (current === expected) {
        stateMismatchSince = 0;
        return;
      }

      if (!stateMismatchSince) stateMismatchSince = Date.now();
      else if (Date.now() - stateMismatchSince >= 1400) recoverFromStateMismatch();
    }, 500);
  }

  function scheduleEyeUpdate() { /* no eye tracking on video cat */ }

  function resetEyes() { /* noop */ }

  function setExpression(name, opts = {}) {
    if (!EXPRESSIONS.includes(name)) return;
    catEl.dataset.expression = name;
    if (opts.skipSync) return;
    if (!isSleeping && !isEating && !isPetting && catEl.dataset.activity === 'none') {
      syncVideoClip();
    }
  }

  function setPose(name, opts = {}) {
    if (!POSES.includes(name)) return;
    catEl.dataset.pose = name;
    isSleeping = name === 'sleep';
    isEating = name === 'eat';

    if (isSleeping) {
      setExpression('sleepy', { skipSync: true });
      zzzBubble?.classList.remove('hidden');
      resetBowlPosition();
      if (opts.skipSync) return;
      if (CLIP_FLOW_MODE) {
        snapVideoClip();
      } else {
        Cat2Player.switchClip('sleep', { crossfade: true });
      }
    } else if (isEating) {
      nomFloat?.classList.add('show');
      if (opts.skipSync) return;
      if (CLIP_FLOW_MODE) {
        snapVideoClip();
      } else {
        Cat2Player.switchClip('eat', { crossfade: true });
      }
    } else {
      zzzBubble?.classList.add('hidden');
      nomFloat?.classList.remove('show');
      catEl.dataset.sleeping = '';
      if (catEl.dataset.expression === 'sleepy') setExpression('happy');
      if (opts.skipSync) return;
      if (CLIP_FLOW_MODE) {
        snapVideoClip();
      } else {
        syncVideoClip();
      }
    }
  }

  function playAnimation(name, duration) {
    if (CLIP_FLOW_MODE) return;
    if (!ANIMATIONS.includes(name)) return;
    Cat2Player.playOneShot(name, duration || 600);
  }

  function playRandomAnimation() {
    if (CLIP_FLOW_MODE) return null;
    const name = ANIMATIONS[Math.floor(Math.random() * ANIMATIONS.length)];
    playAnimation(name);
    return name;
  }

  function bounce() { playAnimation('bounce', 550); }
  function wiggle() { playAnimation('wiggle', 450); }

  /* ── Idle activities (cat's own business) ── */
  function isAnimating() {
    return isWalking || isEating || isSleeping || isPetting || animLock || isBusy ||
      foodFlowActive || postMealPhase ||
      catEl.dataset.begging === 'true' || awaitingFoodChoice ||
      catEl.dataset.playing === 'butterfly' || catEl.dataset.playing === 'pet' ||
      catEl.dataset.playing === 'meow' ||
      catEl.dataset.playing === 'roll' ||
      catEl.dataset.playing === 'groom' ||
      catEl.dataset.playing === 'earpurr' ||
      catEl.dataset.playing === 'grumpy' ||
      catEl.dataset.playing === 'woolball' ||
      Cat2Player.isTransitioning?.();
  }

  function canDoActivity() {
    return !isChatOpen() && !isAnimating() && !isSleeping &&
      !breakAlertActive && !isFocusMode && !getSettings().focusMode;
  }

  function isPettingNow() {
    return isPetting || catEl.dataset.playing === 'pet';
  }

  function stopActivity({ force = false } = {}) {
    if (activityTimeout) clearTimeout(activityTimeout);
    activityTimeout = null;
    if (!force && isPettingNow()) return;
    if (catEl.dataset.playing === 'butterfly') {
      finishButterflyChase();
      return;
    }
    if (catEl.dataset.playing === 'meow') {
      finishMeow();
      return;
    }
    if (catEl.dataset.playing === 'roll') {
      finishRoll();
      return;
    }
    if (catEl.dataset.playing === 'groom') {
      finishGroom();
      return;
    }
    if (catEl.dataset.playing === 'earpurr') {
      finishEarPurr();
      return;
    }
    if (catEl.dataset.playing === 'grumpy') {
      finishGrumpy();
      return;
    }
    if (catEl.dataset.playing === 'woolball') {
      finishWoolball();
      return;
    }
    if (catEl.dataset.playing === 'pet') {
      finishPet();
      return;
    }
    isBusy = false;
    if (!isSleeping && !isEating) animLock = false;
    catEl.dataset.activity = 'none';
    activityProps?.classList.add('hidden');
    if (isSleeping || isEating) return;
    if (catEl.dataset.expression !== 'love') {
      setExpression('happy');
    }
    syncVideoClip();
  }

  function startActivity(activity) {
    if (CLIP_FLOW_MODE) return;
    if (!canDoActivity()) return;
    stopActivity();

    isBusy = true;
    animLock = true;
    catEl.dataset.activity = activity.id;
    setExpression(activity.expression);
    hideSpeech();
    Cat2Player.switchClip(activity.id, { crossfade: true });

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
    if (CLIP_FLOW_MODE) {
      startButterflyChase();
      return;
    }
    const act = IDLE_ACTIVITIES[Math.floor(Math.random() * IDLE_ACTIVITIES.length)];
    startActivity(act);
  }

  function detachButterflyListener() {
    if (!butterflyEndedListener) return;
    window.removeEventListener('cat2:clip-ended', butterflyEndedListener);
    butterflyEndedListener = null;
  }

  function finishButterflyChase() {
    detachButterflyListener();
    clearActivityWatchdog();
    stopClipMovement();
    catEl.classList.remove('walking-left', 'walking-right');
    catEl.dataset.playing = '';
    isBusy = false;
    animLock = false;
    setExpression('happy');
    snapVideoClip();
  }

  async function startButterflyChase() {
    if (!canDoActivity()) return false;
    if (catEl.dataset.begging === 'true' || awaitingFoodChoice) return false;
    if (isPettingNow()) return false;
    if (Cat2Player.getCurrentKey() !== 'idle') return false;
    if (catEl.dataset.playing === 'butterfly') return false;
    if (Cat2Player.isTransitioning?.()) return false;

    stopClipMovement();

    butterflyPlacement = await window.meowAPI?.getWindowPlacement?.() ?? null;
    const dir = pickHorizontalDirection(butterflyPlacement);
    lastWalkDir = dir;

    isBusy = true;
    animLock = true;
    catEl.dataset.playing = 'butterfly';
    applyWalkFacing(dir);
    setExpression('excited');
    hideSpeech();
    sayDialogue('butterfly', 3500);
    snapVideoClip();

    detachButterflyListener();
    butterflyEndedListener = (ev) => {
      if (ev.detail?.key !== 'butterfly') return;
      finishButterflyChase();
    };
    window.addEventListener('cat2:clip-ended', butterflyEndedListener);
    armActivityWatchdog('butterfly', finishButterflyChase);
    return true;
  }

  function detachMeowListener() {
    if (!meowEndedListener) return;
    window.removeEventListener('cat2:clip-ended', meowEndedListener);
    meowEndedListener = null;
  }

  function finishMeow() {
    detachMeowListener();
    clearActivityWatchdog();
    catEl.dataset.playing = '';
    isBusy = false;
    animLock = false;
    setExpression('happy', { skipSync: true });
    snapVideoClip();
  }

  function startMeowActivity() {
    if (!canDoActivity()) return false;
    if (catEl.dataset.begging === 'true' || awaitingFoodChoice) return false;
    if (isPettingNow()) return false;
    if (Cat2Player.getCurrentKey() !== 'idle') return false;
    if (catEl.dataset.playing === 'meow') return false;
    if (Cat2Player.isTransitioning?.()) return false;

    isBusy = true;
    animLock = true;
    catEl.dataset.playing = 'meow';
    setExpression('happy', { skipSync: true });
    hideSpeech();
    snapVideoClip();

    detachMeowListener();
    meowEndedListener = (ev) => {
      if (ev.detail?.key !== 'meow') return;
      finishMeow();
    };
    window.addEventListener('cat2:clip-ended', meowEndedListener);
    armActivityWatchdog('meow', () => {
      if (postMealPhase === 'meow') completePostMealSequence();
      else finishMeow();
    });
    return true;
  }

  function detachRollListener() {
    if (!rollEndedListener) return;
    window.removeEventListener('cat2:clip-ended', rollEndedListener);
    rollEndedListener = null;
  }

  function finishRoll() {
    detachRollListener();
    clearActivityWatchdog();
    catEl.dataset.playing = '';
    isBusy = false;
    animLock = false;
    setExpression('happy', { skipSync: true });
    snapVideoClip();
  }

  function startRollActivity() {
    if (!canDoActivity()) return false;
    if (catEl.dataset.begging === 'true' || awaitingFoodChoice) return false;
    if (isPettingNow()) return false;
    if (Cat2Player.getCurrentKey() !== 'idle') return false;
    if (catEl.dataset.playing === 'roll') return false;
    if (Cat2Player.isTransitioning?.()) return false;

    isBusy = true;
    animLock = true;
    catEl.dataset.playing = 'roll';
    setExpression('love', { skipSync: true });
    hideSpeech();
    snapVideoClip();

    detachRollListener();
    rollEndedListener = (ev) => {
      if (ev.detail?.key !== 'roll') return;
      finishRoll();
    };
    window.addEventListener('cat2:clip-ended', rollEndedListener);
    armActivityWatchdog('roll', finishRoll);
    return true;
  }

  function detachGroomListener() {
    if (!groomEndedListener) return;
    window.removeEventListener('cat2:clip-ended', groomEndedListener);
    groomEndedListener = null;
  }

  function finishGroom() {
    detachGroomListener();
    clearActivityWatchdog();
    catEl.dataset.playing = '';
    isBusy = false;
    animLock = false;
    setExpression('happy', { skipSync: true });
    snapVideoClip();
  }

  function startGroomActivity() {
    if (!canDoActivity()) return false;
    if (catEl.dataset.begging === 'true' || awaitingFoodChoice) return false;
    if (isPettingNow()) return false;
    if (Cat2Player.getCurrentKey() !== 'idle') return false;
    if (catEl.dataset.playing === 'groom') return false;
    if (Cat2Player.isTransitioning?.()) return false;

    isBusy = true;
    animLock = true;
    catEl.dataset.playing = 'groom';
    setExpression('happy', { skipSync: true });
    hideSpeech();
    snapVideoClip();

    detachGroomListener();
    groomEndedListener = (ev) => {
      if (ev.detail?.key !== 'groom') return;
      finishGroom();
    };
    window.addEventListener('cat2:clip-ended', groomEndedListener);
    armActivityWatchdog('groom', finishGroom);
    return true;
  }

  function detachEarPurrListener() {
    if (!earPurrEndedListener) return;
    window.removeEventListener('cat2:clip-ended', earPurrEndedListener);
    earPurrEndedListener = null;
  }

  function finishEarPurr() {
    detachEarPurrListener();
    clearActivityWatchdog();
    catEl.dataset.playing = '';
    isBusy = false;
    animLock = false;
    setExpression('happy', { skipSync: true });
    snapVideoClip();
  }

  function startEarPurrActivity() {
    if (!canDoActivity()) return false;
    if (catEl.dataset.begging === 'true' || awaitingFoodChoice) return false;
    if (isPettingNow()) return false;
    if (Cat2Player.getCurrentKey() !== 'idle') return false;
    if (catEl.dataset.playing === 'earpurr') return false;
    if (Cat2Player.isTransitioning?.()) return false;

    isBusy = true;
    animLock = true;
    catEl.dataset.playing = 'earpurr';
    setExpression('love', { skipSync: true });
    hideSpeech();
    snapVideoClip();

    detachEarPurrListener();
    earPurrEndedListener = (ev) => {
      if (ev.detail?.key !== 'earpurr') return;
      finishEarPurr();
    };
    window.addEventListener('cat2:clip-ended', earPurrEndedListener);
    armActivityWatchdog('earpurr', finishEarPurr);
    return true;
  }

  function detachGrumpyListener() {
    if (!grumpyEndedListener) return;
    window.removeEventListener('cat2:clip-ended', grumpyEndedListener);
    grumpyEndedListener = null;
  }

  function finishGrumpy() {
    detachGrumpyListener();
    clearActivityWatchdog();
    catEl.dataset.playing = '';
    isBusy = false;
    animLock = false;
    setExpression('happy', { skipSync: true });
    snapVideoClip();
    if (isCursorNearCat()) lastCursorNearAt = Date.now();
  }

  function startGrumpyActivity() {
    if (!canDoActivity()) return false;
    if (catEl.dataset.begging === 'true' || awaitingFoodChoice) return false;
    if (isPettingNow()) return false;
    if (Cat2Player.getCurrentKey() !== 'idle') return false;
    if (catEl.dataset.playing === 'grumpy') return false;
    if (Cat2Player.isTransitioning?.()) return false;

    isBusy = true;
    animLock = true;
    catEl.dataset.playing = 'grumpy';
    setExpression('sad', { skipSync: true });
    sayDialogue('grumpy', 4500);
    snapVideoClip();

    detachGrumpyListener();
    grumpyEndedListener = (ev) => {
      if (ev.detail?.key !== 'grumpy') return;
      finishGrumpy();
    };
    window.addEventListener('cat2:clip-ended', grumpyEndedListener);
    armActivityWatchdog('grumpy', finishGrumpy);
    return true;
  }

  function detachWoolballListener() {
    if (!woolballEndedListener) return;
    window.removeEventListener('cat2:clip-ended', woolballEndedListener);
    woolballEndedListener = null;
  }

  function finishWoolball() {
    detachWoolballListener();
    clearActivityWatchdog();
    catEl.dataset.playing = '';
    isBusy = false;
    animLock = false;
    setExpression('happy', { skipSync: true });
    snapVideoClip();
  }

  function startWoolballActivity() {
    if (!canDoActivity()) return false;
    if (catEl.dataset.begging === 'true' || awaitingFoodChoice) return false;
    if (isPettingNow()) return false;
    if (Cat2Player.getCurrentKey() !== 'idle') return false;
    if (catEl.dataset.playing === 'woolball') return false;
    if (Cat2Player.isTransitioning?.()) return false;

    isBusy = true;
    animLock = true;
    catEl.dataset.playing = 'woolball';
    setExpression('excited', { skipSync: true });
    sayDialogue('woolball', 5500);
    snapVideoClip();

    detachWoolballListener();
    woolballEndedListener = (ev) => {
      if (ev.detail?.key !== 'woolball') return;
      finishWoolball();
    };
    window.addEventListener('cat2:clip-ended', woolballEndedListener);
    armActivityWatchdog('woolball', finishWoolball);
    return true;
  }

  function isCursorNearCat() {
    const el = catFigure || catEl;
    if (!el) return false;
    const rect = el.getBoundingClientRect();
    const pad = CURSOR_NEAR_PAD_PX;
    return mouseX >= rect.left - pad &&
      mouseX <= rect.right + pad &&
      mouseY >= rect.top - pad &&
      mouseY <= rect.bottom + pad;
  }

  function noteCursorProximity() {
    if (isCursorNearCat()) lastCursorNearAt = Date.now();
  }

  function checkCursorAwayGrumpy() {
    if (!CLIP_FLOW_MODE) return;
    const settings = getSettings();
    if (settings.focusMode || isFocusMode) return;
    if (isChatOpen() || isSleeping || isEating || breakAlertActive ||
        awaitingFoodChoice || foodFlowActive) return;
    if (isAnimating()) return;
    if (Cat2Player.getCurrentKey() !== 'idle') return;
    if (catEl.dataset.begging === 'true') return;
    if (catEl.dataset.playing === 'grumpy') return;
    if (Date.now() - lastCursorNearAt < CURSOR_AWAY_GRUMPY_MS) return;

    if (startGrumpyActivity()) {
      lastCursorNearAt = Date.now();
      lastRandomActivity = 'grumpy';
    }
  }

  function startCursorAwayWatch() {
    if (cursorAwayCheckInterval) clearInterval(cursorAwayCheckInterval);
    noteCursorProximity();
    cursorAwayCheckInterval = setInterval(checkCursorAwayGrumpy, 2000);
  }

  function detachPetListener() {
    if (!petEndedListener) return;
    window.removeEventListener('cat2:clip-ended', petEndedListener);
    petEndedListener = null;
  }

  function finishPet() {
    detachPetListener();
    clearActivityWatchdog();
    isPetting = false;
    catEl.dataset.playing = '';
    setExpression('happy', { skipSync: true });
    syncPetClip();
    isBusy = false;
    animLock = false;
  }

  function spawnHeart(x, y) {
    if (isReducedMotion() || !petHearts) return;
    const heart = document.createElement('span');
    heart.className = 'pet-heart';
    heart.textContent = ['💕', '💖', '💗', '✨', '🩷', '😻'][Math.floor(Math.random() * 6)];
    const rect = catContainer.getBoundingClientRect();
    heart.style.left = `${x - rect.left + (Math.random() - 0.5) * 24}px`;
    heart.style.top = `${y - rect.top - 10 + (Math.random() - 0.5) * 16}px`;
    petHearts.appendChild(heart);
    setTimeout(() => heart.remove(), 1200);
  }

  function getCatHeartAnchor() {
    const layer = document.querySelector('.cat2-video-layer') || catFigure;
    const rect = layer.getBoundingClientRect();
    return {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height * 0.34,
    };
  }

  function spawnHeartsAtCat(count = 3) {
    const anchor = getCatHeartAnchor();
    for (let i = 0; i < count; i += 1) {
      setTimeout(() => {
        spawnHeart(
          anchor.x + (Math.random() - 0.5) * 36,
          anchor.y + (Math.random() - 0.5) * 24
        );
      }, i * 180);
    }
  }

  function clearPostMealHearts() {
    if (postMealHeartInterval) {
      clearInterval(postMealHeartInterval);
      postMealHeartInterval = null;
    }
  }

  function startPostMealPetPhase() {
    postMealPhase = 'pet';
    isPetting = true;
    isBusy = true;
    animLock = true;
    foodFlowActive = true;
    catEl.dataset.playing = 'pet';
    setExpression('love', { skipSync: true });
    Cat2Player.cancelPending?.();
    Cat2Player.preloadClip?.('pet');
    syncPetClip();
    spawnHeartsAtCat(4);
    postMealHeartInterval = setInterval(() => spawnHeartsAtCat(2), 850);

    detachPetListener();
    const session = ++petSession;
    petEndedListener = (ev) => {
      if (ev.detail?.key !== 'pet') return;
      if (session !== petSession) return;
      if (postMealPhase !== 'pet') return;
      clearPostMealHearts();
      detachPetListener();
      isPetting = false;
      catEl.dataset.playing = '';
      startPostMealMeowPhase();
    };
    window.addEventListener('cat2:clip-ended', petEndedListener);
    armActivityWatchdog('pet', () => {
      clearPostMealHearts();
      detachPetListener();
      isPetting = false;
      catEl.dataset.playing = '';
      startPostMealMeowPhase();
    });
  }

  function startPostMealMeowPhase() {
    if (postMealPhase === 'meow') return;
    postMealPhase = 'meow';
    isBusy = true;
    animLock = true;
    foodFlowActive = true;
    catEl.dataset.playing = 'meow';
    setExpression('happy', { skipSync: true });
    Cat2Player.cancelPending?.();
    snapVideoClip();

    detachMeowListener();
    meowEndedListener = (ev) => {
      if (ev.detail?.key !== 'meow') return;
      if (postMealPhase !== 'meow') return;
      completePostMealSequence();
    };
    window.addEventListener('cat2:clip-ended', meowEndedListener);
    armActivityWatchdog('meow', completePostMealSequence);
  }

  function completePostMealSequence() {
    if (!postMealPhase) return;
    clearActivityWatchdog();
    clearPostMealHearts();
    detachMeowListener();
    postMealPhase = null;
    catEl.dataset.playing = '';
    isBusy = false;
    animLock = false;
    foodFlowActive = false;

    const meta = postMealMeta;
    postMealMeta = null;

    startBowlCooldown();
    postMealCooldownUntil = Date.now() + 90000;
    lastRandomActivity = 'meow';

    if (meta) {
      applyFoodMood(meta.liked ? 'good' : 'grumpy');
      showSpeech(meta.reaction, 5000);
    }

    setExpression('happy', { skipSync: true });
    snapVideoClip();
    onFeedCycleComplete();
  }

  function petHead(e) {
    if (postMealPhase) return;
    if (isSleeping) { wakeUp(); return; }
    if (isEating) return;

    stopWalk();
    if (catEl.dataset.playing === 'butterfly') finishButterflyChase();

    spawnHeart(e.clientX, e.clientY);

    const now = Date.now();
    if (now - lastPetTime > 1800) {
      sayDialogue('pet', 2500);
      lastPetTime = now;
    }

    const alreadyPetting = isPetting || catEl.dataset.playing === 'pet';
    const session = ++petSession;

    isPetting = true;
    isBusy = true;
    animLock = true;
    catEl.dataset.playing = 'pet';
    setExpression('love', { skipSync: true });
    Cat2Player.cancelPending?.();
    Cat2Player.preloadClip?.('pet');

    if (alreadyPetting || Cat2Player.getCurrentKey() === 'pet') {
      Cat2Player.restartActiveClip();
    } else {
      syncPetClip();
    }

    detachPetListener();
    petEndedListener = (ev) => {
      if (ev.detail?.key !== 'pet') return;
      if (session !== petSession) return;
      finishPet();
    };
    window.addEventListener('cat2:clip-ended', petEndedListener);
    armActivityWatchdog('pet', () => {
      if (session !== petSession) return;
      finishPet();
    });
  }

  function setupPetZone(zone, handler) {
    if (!zone) return;
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

  function begForFood() {
    if (!canDoActivity()) return false;
    if (!CLIP_FLOW_MODE && isBowlOnCooldown()) return false;
    if (catEl.dataset.begging === 'true') {
      scheduleFeedPromptRetry();
      return false;
    }
    if (Cat2Player.getCurrentKey() !== 'idle') return false;

    catEl.dataset.begging = 'true';
    setExpression('sad');
    snapVideoClip();
    if (!tryShowFeedPrompt()) scheduleFeedPromptRetry();
    return true;
  }

  function hideFeedPrompt() {
    awaitingFoodChoice = false;
    foodChoice?.classList.add('hidden');
    catEl.classList.remove('feed-prompt-open');
    if (!isEating && !foodFlowActive) {
      foodFlowActive = false;
    }
  }

  function showFeedPrompt() {
    if (tryShowFeedPrompt()) return;
    scheduleFeedPromptRetry();
  }

  function acceptFood() {
    if (catEl.dataset.begging !== 'true' || isEating) return;
    foodFlowActive = true;
    animLock = true;
    if (sleepTimeout) clearTimeout(sleepTimeout);
    catEl.dataset.sleeping = '';
    clearFeedPromptTimers();
    hideFeedPrompt();
    feedCat();
  }

  function declineFoodAndWalk() {
    if (!awaitingFoodChoice || catEl.dataset.begging !== 'true') return;
    foodFlowActive = true;
    animLock = true;
    clearFeedPromptTimers();
    hideFeedPrompt();
    catEl.dataset.begging = '';
    walkThenSleep = true;
    hideSpeech();
    onFeedCycleComplete();
    sayDialogue('walkDecline', 3500);

    setTimeout(async () => {
      if (!walkThenSleep) return;
      hideSpeech();
      await startWalk({ afterDecline: true });
    }, 3200);
  }

  function cancelBegging({ syncClip = true } = {}) {
    catEl.dataset.begging = '';
    foodFlowActive = false;
    clearFeedPromptTimers();
    hideFeedPrompt();
    hideSpeech();
    if (syncClip) syncVideoClip();
  }

  /* ── Window movement synced to walk / butterfly clips ── */
  let clipMoveRaf = null;
  let clipMovementStarted = false;
  let clipMovementKey = null;
  let walkEndedListener = null;
  let lastWalkDir = 1;
  let walkPlacement = null;
  let butterflyPlacement = null;

  function pickHorizontalDirection(placement) {
    if (placement?.nearRight && !placement?.nearLeft) return -1;
    if (placement?.nearLeft && !placement?.nearRight) return 1;
    if (lastWalkDir) return -lastWalkDir;
    return Math.random() < 0.5 ? -1 : 1;
  }

  function maxHorizontalDistance(dir, placement) {
    const fallback = 260 + Math.random() * 120;
    if (!placement?.workArea) return fallback;
    const margin = 20;
    const { x, width, workArea } = placement;
    const room = dir > 0
      ? workArea.x + workArea.width - (x + width) - margin
      : x - workArea.x - margin;
    if (room <= 40) return 0;
    return Math.min(fallback, room);
  }

  function applyWalkFacing(dir) {
    catEl.classList.remove('walking-left', 'walking-right');
    catEl.classList.add(dir === -1 ? 'walking-left' : 'walking-right');
  }

  function stopClipMovement() {
    clipMovementStarted = false;
    clipMovementKey = null;
    if (clipMoveRaf) {
      cancelAnimationFrame(clipMoveRaf);
      clipMoveRaf = null;
    }
  }

  function stopWalkMovement() {
    stopClipMovement();
  }

  function startSyncedClipMovement(clipKey, dir, opts = {}) {
    if (clipMovementStarted) return;
    const clip = Cat2Clips.get(clipKey);
    const moveStart = opts.moveStart ?? clip.moveStart ?? 0;
    const moveEnd = opts.moveEnd ?? clip.moveEnd ?? 1;
    const distance = opts.totalDistance ?? (320 + Math.random() * 180);
    if (distance <= 0) return;

    clipMovementStarted = true;
    clipMovementKey = clipKey;
    let appliedPx = 0;

    const tick = () => {
      if (!clipMovementStarted || clipMovementKey !== clipKey) {
        stopClipMovement();
        return;
      }

      const playback = Cat2Player.getPlaybackState?.();
      if (!playback || playback.key !== clipKey || playback.paused) {
        clipMoveRaf = requestAnimationFrame(tick);
        return;
      }

      const rawProgress = playback.currentTime / playback.duration;
      if (rawProgress >= moveEnd) {
        stopClipMovement();
        return;
      }
      if (rawProgress < moveStart) {
        clipMoveRaf = requestAnimationFrame(tick);
        return;
      }

      const progress = Math.min(1, (rawProgress - moveStart) / (moveEnd - moveStart));
      const targetPx = progress * distance * dir;
      const rawDelta = targetPx - appliedPx;
      if (Math.abs(rawDelta) >= 0.5) {
        const step = Math.round(rawDelta);
        appliedPx += step;
        window.meowAPI?.dragWindow(step, 0);
      }

      clipMoveRaf = requestAnimationFrame(tick);
    };

    clipMoveRaf = requestAnimationFrame(tick);
  }

  function startWalkMovement(dir) {
    startSyncedClipMovement('walk', dir, {
      totalDistance: maxHorizontalDistance(dir, walkPlacement),
    });
  }

  function startButterflyMovement(dir) {
    const distance = maxHorizontalDistance(dir, butterflyPlacement);
    startSyncedClipMovement('butterfly', dir, {
      totalDistance: distance > 0 ? distance : 160,
    });
  }

  function detachWalkEndedListener() {
    if (!walkEndedListener) return;
    window.removeEventListener('cat2:clip-ended', walkEndedListener);
    walkEndedListener = null;
  }

  function stopWalk({ skipSync = false } = {}) {
    if (walkTimeout) { clearTimeout(walkTimeout); walkTimeout = null; }
    clearActivityWatchdog();
    stopWalkMovement();
    detachWalkEndedListener();
    isWalking = false;
    catEl.dataset.walking = '';
    catEl.classList.remove('walking-left', 'walking-right');
    if (!isSleeping && !isEating) animLock = false;
    isBusy = false;
    if (skipSync) return;
    if (CLIP_FLOW_MODE) {
      snapVideoClip();
    } else {
      syncVideoClip();
    }
  }

  function finishWalk() {
    stopWalkMovement();
    if (!isWalking) return;
    stopWalk();
    if (walkThenSleep) {
      goToSleepAfterWalk();
      return;
    }
    if (!isChatOpen()) sayDialogue('walkArrive', 2500);
  }

  function goToSleepAfterWalk() {
    walkThenSleep = false;
    stopWalkMovement();
    catEl.classList.remove('walking-left', 'walking-right');
    isBusy = false;
    animLock = false;
    goToSleepClip(undefined, { force: true });
  }

  function goToSleepClip(duration, { force = false } = {}) {
    if (!CLIP_FLOW_MODE) {
      goToSleep(duration);
      return true;
    }
    if (isSleeping) return false;
    if (foodFlowActive || isEating || catEl.dataset.begging === 'true') return false;
    if (!force && Date.now() < postMealCooldownUntil) return false;
    if (!force && !canDoActivity()) return false;
    if (!force && Cat2Player.getCurrentKey() !== 'idle') return false;
    if (!force && Cat2Player.isTransitioning?.()) return false;

    stopActivity();
    catEl.dataset.sleeping = 'true';
    animLock = true;
    isBusy = true;
    hideSpeech();
    setPose('sleep');
    lastRandomActivity = 'sleep';

    const sleepMs = duration || Cat2Clips.getDurationMs('sleep');

    if (sleepTimeout) clearTimeout(sleepTimeout);
    sleepTimeout = setTimeout(() => {
      wakeFromSleepFlow();
    }, sleepMs);
    return true;
  }

  function wakeFromSleepFlow() {
    if (!isSleeping) return;
    if (sleepTimeout) clearTimeout(sleepTimeout);
    catEl.dataset.sleeping = '';
    isBusy = false;
    animLock = false;
    foodFlowActive = false;
    setPose('loaf', { skipSync: true });
    setExpression('happy', { skipSync: true });
    Cat2Player.cancelPending?.();
    snapVideoClip();
    sayDialogue('wake', 3000);
  }

  function onWalkClipVisible() {
    if (!isWalking || Cat2Player.getCurrentKey() !== 'walk') return;
    if (clipMovementStarted) return;

    const dir = catEl.classList.contains('walking-left') ? -1 : 1;
    startWalkMovement(dir);
  }

  function onButterflyClipVisible() {
    if (catEl.dataset.playing !== 'butterfly') return;
    if (Cat2Player.getCurrentKey() !== 'butterfly') return;
    if (clipMovementStarted) return;

    const dir = catEl.classList.contains('walking-left') ? -1 : 1;
    startButterflyMovement(dir);
  }

  async function startWalk({ afterDecline = false } = {}) {
    if (isWalking) return false;
    if (!afterDecline) {
      if (!canDoActivity()) return false;
      if (Cat2Player.getCurrentKey() !== 'idle') return false;
      if (Cat2Player.isTransitioning?.()) return false;
    }

    walkPlacement = await window.meowAPI?.getWindowPlacement?.() ?? null;
    const dir = pickHorizontalDirection(walkPlacement);
    lastWalkDir = dir;

    stopWalk({ skipSync: afterDecline });

    isWalking = true;
    isBusy = true;
    animLock = true;
    foodFlowActive = false;
    catEl.dataset.walking = 'true';
    applyWalkFacing(dir);

    if (!afterDecline) sayDialogue('walkPatrol', 3500);
    setExpression('happy');
    if (afterDecline) snapVideoClip();
    else syncVideoClip();

    detachWalkEndedListener();
    walkEndedListener = (ev) => {
      if (ev.detail?.key !== 'walk') return;
      stopWalkMovement();
      if (walkTimeout) clearTimeout(walkTimeout);
      walkTimeout = null;
      finishWalk();
    };
    window.addEventListener('cat2:clip-ended', walkEndedListener);
    armActivityWatchdog('walk', () => {
      stopWalkMovement();
      if (walkTimeout) clearTimeout(walkTimeout);
      walkTimeout = null;
      finishWalk();
    });
    return true;
  }
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
    const layer = document.querySelector('.cat2-video-layer') || catFigure;
    const rect = layer.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height * 0.72 };
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

  /* ── Food prompt (Yes / No) ── */
  function showFoodChoice() {
    if (CLIP_FLOW_MODE) {
      showFeedPrompt();
      return;
    }
    if (isBowlOnCooldown() || isSleeping || isEating || isChatOpen()) return;
    awaitingFoodChoice = true;
    if (!CLIP_FLOW_MODE) hideSpeech();
    else showSpeech(FOOD_BEG_DIALOG, 0);
    updateFoodStars();
    foodChoice?.classList.remove('hidden');
    setExpression('excited');

    if (foodChoiceTimeout) clearTimeout(foodChoiceTimeout);
    foodChoiceTimeout = setTimeout(() => {
      foodChoiceTimeout = null;
      if (awaitingFoodChoice) hideFoodChoice();
    }, 14000);
  }

  function hideFoodChoice() {
    if (CLIP_FLOW_MODE) return;
    awaitingFoodChoice = false;
    if (foodChoiceTimeout) clearTimeout(foodChoiceTimeout);
    foodChoiceTimeout = null;
    foodChoice?.classList.add('hidden');
    if (CLIP_FLOW_MODE) {
      cancelBegging();
    } else {
      catEl.dataset.begging = '';
      syncVideoClip();
    }
  }

  function applyFoodMood(mood) {
    foodMood = mood;
    catEl.dataset.mood = mood;
    if (foodMoodTimeout) clearTimeout(foodMoodTimeout);
    foodMoodTimeout = setTimeout(() => {
      foodMood = null;
      catEl.dataset.mood = '';
      if (!isSleeping && !isEating) setExpression('happy');
    }, 5 * 60 * 1000);
  }

  function feedCat(foodType) {
    if (isSleeping || isEating) return;
    if (CLIP_FLOW_MODE && catEl.dataset.begging !== 'true' && !foodType) return;
    if (!CLIP_FLOW_MODE && isBowlOnCooldown()) return;

    foodFlowActive = true;
    animLock = true;
    if (sleepTimeout) clearTimeout(sleepTimeout);
    catEl.dataset.sleeping = '';
    Cat2Player.cancelPending?.();

    let eatEndedListener = null;

    const finishEating = () => {
      if (!isEating) return;
      if (eatEndedListener) {
        window.removeEventListener('cat2:clip-ended', eatEndedListener);
        eatEndedListener = null;
      }
      if (eatTimeout) clearTimeout(eatTimeout);
      eatTimeout = null;
      isEating = false;
      catEl.dataset.begging = '';
      catEl.dataset.sleeping = '';
      nomFloat?.classList.remove('show');
      resetBowlPosition();
      setPose('loaf', { skipSync: true });

      const type = foodType || (Math.random() < 0.5 ? 'plain' : 'fishy');
      const liked = Math.random() < getLikeChance(type);
      updateFoodPref(type, liked);
      updateFoodStars();

      const lines = FOOD_REACTIONS[type][liked ? 'like' : 'dislike'];
      const reaction = lines[Math.floor(Math.random() * lines.length)];
      postMealMeta = { type, liked, reaction };

      if (CLIP_FLOW_MODE) {
        hideSpeech();
        startPostMealPetPhase();
        return;
      }

      stopEating();
      applyFoodMood(liked ? 'good' : 'grumpy');
      if (!CLIP_FLOW_MODE) {
        if (liked) {
          setExpression('excited');
          playAnimation('bounce', 550);
          setTimeout(() => playAnimation('wiggle', 450), 600);
        } else {
          setExpression('sad');
          playAnimation('shake', 400);
          setTimeout(() => playAnimation('shakeHead', 400), 500);
        }
      }
      showSpeech(reaction, 5000);
      onFeedCycleComplete();
    };

    const armEatTimeout = () => {
      if (eatTimeout) clearTimeout(eatTimeout);
      const eatMs = Cat2Clips.getDurationMs('eat');
      eatTimeout = setTimeout(finishEating, eatMs + 900);
    };

    eatEndedListener = (ev) => {
      if (ev.detail?.key !== 'eat') return;
      finishEating();
    };
    window.addEventListener('cat2:clip-ended', eatEndedListener);
    armEatTimeout();

    const onEatVisible = (ev) => {
      if (ev.detail?.key !== 'eat' || !isEating) return;
      window.removeEventListener('cat2:clip-visible', onEatVisible);
      armEatTimeout();
    };
    window.addEventListener('cat2:clip-visible', onEatVisible);

    if (CLIP_FLOW_MODE) {
      catEl.dataset.begging = '';
      hideFeedPrompt();
    } else {
      catEl.dataset.begging = '';
      hideFoodChoice();
    }
    resetBowlPosition();
    hideSpeech();
    setPose('eat');
    setExpression('happy', { skipSync: true });
    stopActivity();
    sayDialogue('eatStart', 2800);

    if (CLIP_FLOW_MODE && Cat2Player.getCurrentKey() === 'eat') {
      armEatTimeout();
    }
  }

  function stopEating() {
    if (eatTimeout) clearTimeout(eatTimeout);
    isEating = false;
    animLock = false;
    foodFlowActive = false;
    catEl.dataset.begging = '';
    catEl.dataset.sleeping = '';
    nomFloat?.classList.remove('show');
    resetBowlPosition();
    setPose('loaf');
    if (CLIP_FLOW_MODE) {
      setExpression('happy', { skipSync: true });
      snapVideoClip();
    } else {
      setExpression('happy');
    }
  }

  function wakeUp() {
    if (!isSleeping) return false;
    if (CLIP_FLOW_MODE) {
      wakeFromSleepFlow();
    } else {
      if (sleepTimeout) clearTimeout(sleepTimeout);
      catEl.dataset.sleeping = '';
      animLock = false;
      setPose('loaf');
      setExpression('happy');
      playAnimation('yawn', 900);
      sayDialogue('wake', 3000);
    }
    scheduleEyeUpdate();
    return true;
  }

  function goToSleep(duration = 20000) {
    if (CLIP_FLOW_MODE) return;
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
    begForFood();
  }

  function blink() {
    if (isSleeping || isEating || isBusy) return;
    Cat2Player.playOneShot('react', 150);
  }

  function startBlinkLoop() {
    const schedule = () => {
      setTimeout(() => {
        if (!isSleeping && !isEating && !isBusy) blink();
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
    speechTimeout = null;
    if (duration > 0) {
      speechTimeout = setTimeout(() => speechBubble.classList.add('hidden'), duration);
    }
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
    return !document.getElementById('chat-panel')?.classList.contains('hidden');
  }

  function shuffledActivityOptions() {
    let options = ['butterfly', 'walk', 'sleep', 'meow', 'roll', 'groom', 'earpurr', 'grumpy', 'woolball'];
    if (lastRandomActivity === 'sleep' || Date.now() < postMealCooldownUntil) {
      options = options.filter((o) => o !== 'sleep');
    }
    if (lastRandomActivity === 'meow') {
      options = options.filter((o) => o !== 'meow');
    }
    if (lastRandomActivity === 'roll') {
      options = options.filter((o) => o !== 'roll');
    }
    if (lastRandomActivity === 'groom') {
      options = options.filter((o) => o !== 'groom');
    }
    if (lastRandomActivity === 'earpurr') {
      options = options.filter((o) => o !== 'earpurr');
    }
    if (lastRandomActivity === 'grumpy') {
      options = options.filter((o) => o !== 'grumpy');
    }
    if (lastRandomActivity === 'woolball') {
      options = options.filter((o) => o !== 'woolball');
    }
    for (let i = options.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [options[i], options[j]] = [options[j], options[i]];
    }
    return options;
  }

  async function pickRandomClipActivity() {
    if (!canDoActivity()) return false;
    if (foodFlowActive || isEating) return false;
    if (Cat2Player.getCurrentKey() !== 'idle') return false;
    if (catEl.dataset.begging === 'true' || awaitingFoodChoice) return false;
    if (Cat2Player.isTransitioning?.()) return false;

    for (const choice of shuffledActivityOptions()) {
      let started = false;
      if (choice === 'butterfly') started = await startButterflyChase();
      else if (choice === 'walk') started = await startWalk();
      else if (choice === 'meow') started = startMeowActivity();
      else if (choice === 'roll') started = startRollActivity();
      else if (choice === 'groom') started = startGroomActivity();
      else if (choice === 'earpurr') started = startEarPurrActivity();
      else if (choice === 'grumpy') started = startGrumpyActivity();
      else if (choice === 'woolball') started = startWoolballActivity();
      else started = goToSleepClip();

      if (started) {
        lastRandomActivity = choice;
        return true;
      }
    }
    return false;
  }

  function startIdleBehaviorLoop() {
    if (idleLoopInterval) clearInterval(idleLoopInterval);

    const tick = () => {
      const settings = getSettings();
      if (settings.focusMode || isFocusMode) return;
      if (isChatOpen() || isSleeping || isEating || breakAlertActive || awaitingFoodChoice || foodFlowActive) return;

      if (CLIP_FLOW_MODE) {
        if (isAnimating()) return;
        if (Cat2Player.getCurrentKey() !== 'idle') return;
        if (catEl.dataset.begging === 'true' || awaitingFoodChoice || foodFlowActive) return;
        const level = settings.chattyLevel || 'normal';
        if (foodMood && Math.random() < (level === 'quiet' ? 0.12 : 0.22)) {
          sayDialogue(foodMood === 'good' ? 'goodMood' : 'grumpyMood', 3500);
          return;
        }
        const activityChance = level === 'quiet' ? 0.28 : level === 'chatty' ? 0.82 : 0.55;
        if (Math.random() > activityChance) return;
        pickRandomClipActivity();
        return;
      }

      const level = settings.chattyLevel || 'normal';

      /* Mood speech overrides normal behaviour sometimes */
      if (foodMood && Math.random() < (level === 'quiet' ? 0.15 : 0.35)) {
        const lines = foodMood === 'good' ? GOOD_MOOD_LINES : GRUMPY_MOOD_LINES;
        showSpeech(lines[Math.floor(Math.random() * lines.length)], 3500);
        if (foodMood === 'good') { setExpression('excited'); playAnimation('wiggle', 400); }
        else { setExpression('sad'); }
        return;
      }

      const roll = Math.random();

      if (level === 'quiet') {
        if (!isBusy && !animLock && roll < 0.25) {
          startRandomActivity();
        } else if (!isBusy && !animLock && roll < 0.4) {
          goToSleep(15000 + Math.random() * 10000);
        } else if (!isBusy && roll < 0.55) {
          playRandomAnimation();
        }
        return;
      }

      const begCap = level === 'chatty' ? 0.58 : 0.55;
      const eatCap = level === 'chatty' ? 0.64 : 0.61;
      const sleepCap = level === 'chatty' ? 0.7 : 0.67;
      const animCap = level === 'chatty' ? 0.85 : 0.78;
      const quipCap = level === 'chatty' ? 0.8 : 0.72;

      if (!isBusy && !animLock && roll < 0.35) {
        startRandomActivity();
      } else if (!isBusy && !animLock && roll < 0.47) {
        startWalk();
      } else if (!isBusy && !animLock && roll < begCap && !isBowlOnCooldown()) {
        begForFood();
      } else if (!isBusy && !animLock && roll < eatCap) {
        goToEat();
      } else if (!isBusy && !animLock && roll < sleepCap) {
        goToSleep(15000 + Math.random() * 10000);
      } else if (!isBusy && roll < animCap) {
        playRandomAnimation();
        if (roll < quipCap) {
          const quip = MeowPersonality.getIdleQuip();
          setExpression(quip.expression);
          showSpeech(quip.text, 3500);
        }
      }
    };

    idleLoopInterval = setInterval(tick, getIdleIntervalMs());
  }

  function restartIdleLoop() {
    startIdleBehaviorLoop();
  }

  /* ── Break reminder (2h continuous work) ── */
  function spawnBreakSparkle() {
    if (isReducedMotion()) return;
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
    if (!isChatOpen()) window.meowAPI?.resizeWindow(220, COMPACT_H, false);
  }

  function buddyStack() {
    return document.getElementById('buddy-stack');
  }

  function triggerBreakAlert({ hours, minutes, gentle }) {
    if (breakAlertActive) return;

    if (CLIP_FLOW_MODE) {
      breakAlertActive = true;
      if (isSleeping && !isPettingNow()) wakeUp();
      const h = hours || 2;
      const m = minutes || 0;
      const msgFn = BREAK_MESSAGES[Math.floor(Math.random() * BREAK_MESSAGES.length)];
      const msg = msgFn(h, m);
      const softMode = !!gentle || isReducedMotion();
      hideSpeech();
      setExpression('thinking', { skipSync: true });
      showSpeech(msg, softMode ? 9000 : 14000);
      setTimeout(() => {
        breakAlertActive = false;
        if (!isSleeping && !isEating && !isPettingNow()) setExpression('happy');
      }, softMode ? 10000 : 15000);
      return;
    }

    breakAlertActive = true;

    if (isSleeping) wakeUp();
    if (isEating) stopEating();
    hideFoodChoice();
    stopWalk();
    stopActivity({ force: true });

    hideSpeech();
    setExpression('excited');

    const h = hours || 2;
    const m = minutes || 0;
    const msgFn = BREAK_MESSAGES[Math.floor(Math.random() * BREAK_MESSAGES.length)];
    const msg = msgFn(h, m);
    const softMode = !!gentle || isReducedMotion();

    const breakAlert = document.getElementById('break-alert');
    const breakText = document.getElementById('break-alert-text');
    if (breakText) breakText.textContent = msg;
    breakAlert?.classList.remove('hidden');

    showSpeech(msg, softMode ? 8000 : 14000);
    window.meowAPI?.resizeWindow(220, BREAK_ALERT_H, false);

    if (!softMode) {
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
    } else {
      playAnimation('alert', 500);
    }

    setTimeout(() => {
      if (breakAlertActive) stopBreakAlert();
    }, softMode ? 12000 : 20000);
  }

  function snoozeBreak(mins) {
    stopBreakAlert();
    const duration = mins || getSettings().snoozeDuration || 30;
    window.meowAPI?.snoozeBreakReminder?.(duration);
    showSpeech(`Okay~ Snoozed ${duration} min. 😴`, 3000);
    playAnimation('yawn', 700);
  }

  /* ── Event listeners ── */
  window.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
    noteCursorProximity();
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
      window.meowAPI.dragWindow(Math.round(dx), Math.round(dy));
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

  catFigure.addEventListener('click', (e) => {
    if (e.target.closest('#food-bowl') || e.target.closest('.quit-x') ||
        e.target.closest('.focus-badge') || e.target.closest('.pet-zone')) return;
    if (hasMoved) return;
    e.stopPropagation();
    if (isPettingNow()) {
      window.dispatchEvent(new CustomEvent('meow:click'));
      return;
    }
    if (wakeUp()) return;
    if (isEating) {
      stopEating();
      showSpeech(pickDialogue('feedInterrupt').text, 2000);
      return;
    }
    stopWalk();
    stopActivity();
    if (CLIP_FLOW_MODE && canDoActivity() && !awaitingFoodChoice && catEl.dataset.begging !== 'true') {
      sayDialogue('click', 2500);
    } else if (!CLIP_FLOW_MODE) {
      bounce();
    }
    window.dispatchEvent(new CustomEvent('meow:click'));
  });

  catContainer.addEventListener('mousedown', (e) => {
    if (e.target.closest('.quit-x') || e.target.closest('.focus-badge') ||
        e.target.closest('.chat-panel') || e.target.closest('#food-bowl') ||
        e.target.closest('.pet-zone') || e.target.closest('#food-choice') ||
        e.target.closest('.food-opt')) return;
    closeContextMenu();
    isDraggingWindow = true;
    hasMoved = false;
    dragStart = { x: e.screenX, y: e.screenY };
  });

  quitBtn.addEventListener('mousedown', (e) => e.stopPropagation());
  quitBtn.addEventListener('click', (e) => { e.stopPropagation(); quitMeow(); });

  const focusBadge = document.getElementById('focus-badge');
  focusBadge?.addEventListener('mousedown', (e) => e.stopPropagation());
  focusBadge?.addEventListener('click', (e) => {
    e.stopPropagation();
    window.MeowSettings?.setFocusMode?.(false);
  });

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

  foodChoice?.addEventListener('mousedown', (e) => e.stopPropagation());

  foodChoice?.querySelectorAll('.food-opt').forEach((btn) => {
    btn.addEventListener('mousedown', (e) => e.stopPropagation());
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (btn.dataset.feed === 'yes') acceptFood();
      else if (btn.dataset.feed === 'no') declineFoodAndWalk();
      else if (btn.dataset.food) {
        hideFoodChoice();
        feedCat(btn.dataset.food);
      }
    });
  });

  document.getElementById('break-dismiss')?.addEventListener('click', (e) => {
    e.stopPropagation();
    stopBreakAlert();
    showSpeech('Good human~ Rest soon, okay? 💕', 3000);
    playAnimation('purr', 700);
  });

  document.querySelectorAll('.break-snooze').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      snoozeBreak(Number(btn.dataset.mins));
    });
  });

  window.addEventListener('meow:settings', (e) => {
    const settings = e.detail?.settings;
    if (!settings) return;
    const key = e.detail?.key;
    if (typeof settings.focusMode === 'boolean') {
      setFocusMode(settings.focusMode);
      if (settings.focusMode) {
        clearFeedSchedule();
      } else if (!awaitingFoodChoice && catEl.dataset.begging !== 'true') {
        scheduleFeedRequest(getFeedIntervalMs());
      }
    }
    if (typeof settings.reducedMotion === 'boolean') {
      Cat2Player.setReducedMotion(settings.reducedMotion);
      if (!settings.reducedMotion && catEl.dataset.begging === 'true') {
        Cat2Player.forceRecover?.();
        if (!awaitingFoodChoice) tryShowFeedPrompt();
        else {
          foodChoice?.classList.remove('hidden');
          catEl.classList.add('feed-prompt-open');
        }
      }
    }
    if (typeof settings.catSounds === 'boolean') {
      Cat2Player.setSoundsEnabled?.(settings.catSounds);
    }
    if (key === 'chattyLevel' || key === 'all') restartIdleLoop();
    if ((key === 'feedIntervalMinutes' || key === 'all') &&
        !awaitingFoodChoice && catEl.dataset.begging !== 'true') {
      scheduleFeedRequest(getFeedIntervalMs());
    }
  });

  if (window.meowAPI?.onBreakReminder) {
    window.meowAPI.onBreakReminder(triggerBreakAlert);
  }

  if (window.meowAPI?.onBatterySaver) {
    window.meowAPI.onBatterySaver((onBattery) => {
      window.meowBatterySaver = !!onBattery;
      restartIdleLoop();
    });
  }

  document.addEventListener('fullscreenchange', () => {
    window.meowAPI?.setFullscreenHint?.(!!document.fullscreenElement);
  });

  setupPetZone(petZoneHead, petHead);

  loadBowlCooldown();
  loadFoodPrefs();
  updateFoodStars();

  const initialSettings = getSettings();
  setFocusMode(!!initialSettings.focusMode);

  catEl.classList.add('cat2-mode');

  window.addEventListener('cat2:clip-visible', (ev) => {
    if (ev.detail?.key === 'hungry') showFeedPrompt();
    if (ev.detail?.key === 'walk') onWalkClipVisible();
    if (ev.detail?.key === 'butterfly') onButterflyClipVisible();
    if (isWalking && ev.detail?.key !== 'walk') stopWalkMovement();
    if (catEl.dataset.playing === 'butterfly' && ev.detail?.key !== 'butterfly') {
      stopClipMovement();
      catEl.classList.remove('walking-left', 'walking-right');
    }
  });

  window.addEventListener('cat2:clip-loop', (ev) => {
    if (ev.detail?.key === 'hungry') showFeedPrompt();
  });

  Cat2Player.init(cat2VideoA, cat2VideoB, cat2CanvasA, cat2CanvasB, catEl);
  Cat2Player.setReducedMotion(!!initialSettings.reducedMotion);
  Cat2Player.setSoundsEnabled?.(initialSettings.catSounds !== false);
  Cat2Player.preloadClip?.('pet');
  Cat2Player.preloadClip?.('idle');

  if (CLIP_FLOW_MODE) {
    Cat2Player.switchClip('idle', { crossfade: false, force: true });
    scheduleFeedRequest(getFeedIntervalMs());
    setTimeout(() => {
      if (!catEl.dataset.begging && !awaitingFoodChoice && canDoActivity()) {
        sayDialogue('greetings', 4500);
      }
    }, 800);
  } else {
    setTimeout(() => {
      const greeting = MeowPersonality.getGreeting();
      setExpression(greeting.expression);
      showSpeech(greeting.text, 5000);
    }, 1200);

    setTimeout(() => {
      if (!isFocusMode && !getSettings().focusMode) startRandomActivity();
    }, 18000);

    startBlinkLoop();
  }

  startIdleBehaviorLoop();
  startCursorAwayWatch();
  startStateSyncWatchdog();

  window.MeowCat = {
    setExpression, setPose, bounce, wiggle,
    showSpeech, hideSpeech, blink, wakeUp, stopEating,
    playAnimation, playRandomAnimation, triggerBreakAlert,
    stopActivity, startRandomActivity, stopWalk, startWalk, begForFood,
    startButterflyChase, petHead, goToSleepClip, pickRandomClipActivity,
    showFoodChoice, hideFoodChoice, setFocusMode, snoozeBreak,
    isPetting: isPettingNow,
    isAwaitingFoodChoice: () => awaitingFoodChoice,
  };
})();
