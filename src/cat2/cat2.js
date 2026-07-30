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

  const BOWL_COOLDOWN_MS = 20 * 60 * 1000; // legacy Cat 1 bowl cooldown
  const BOWL_COOLDOWN_KEY = 'meowBowlCooldownUntil';
  const FOOD_PREFS_KEY = 'meowFoodPrefs';
  const COMPACT_H = 218;
  const BREAK_ALERT_H = 327;

  /** Cat 2 — idle / hungry / eat clip flow only */
  const CLIP_FLOW_MODE = true;
  const FOOD_BEG_DIALOG = 'Please feed me';
  const WALK_DECLINE_DIALOG = 'Let me go for a walk then';

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
  let walkThenSleep = false;
  let butterflyEndedListener = null;
  let petEndedListener = null;
  let isPetting = false;
  let lastPetTime = 0;
  let isFocusMode = false;
  let foodPrefs = { plain: 0, fishy: 0 };
  let eyeThrottle = 0;
  let idleLoopInterval = null;
  let sleepTimeout = null;
  let lastRandomActivity = null;
  let eatTimeout = null;
  let activityTimeout = null;
  let bowlCooldownTimeout = null;
  let animLock = false;
  let mouseX = window.innerWidth / 2;
  let mouseY = window.innerHeight / 2;
  let eyeLoopId = null;
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

  function clearFeedSchedule() {
    if (feedScheduleTimeout) clearTimeout(feedScheduleTimeout);
    feedScheduleTimeout = null;
  }

  /** Cat 2 — ask for food as soon as the cat is idle. */
  function scheduleFeedRequest() {
    if (!CLIP_FLOW_MODE) return;
    clearFeedSchedule();

    const tryBeg = () => {
      feedScheduleTimeout = null;
      if (!canDoActivity() || Cat2Player.isTransitioning?.()) {
        feedScheduleTimeout = setTimeout(tryBeg, 200);
        return;
      }
      if (Cat2Player.getCurrentKey() !== 'idle') {
        feedScheduleTimeout = setTimeout(tryBeg, 200);
        return;
      }
      begForFood();
    };

    feedScheduleTimeout = setTimeout(tryBeg, 0);
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

  function getSettings() {
    return window.MeowSettings?.get?.() || window.meowSettings || {
      focusMode: isFocusMode,
      chattyLevel: 'normal',
      reducedMotion: false,
      snoozeDuration: 30,
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

  function setPose(name) {
    if (!POSES.includes(name)) return;
    catEl.dataset.pose = name;
    isSleeping = name === 'sleep';
    isEating = name === 'eat';

    if (isSleeping) {
      setExpression('sleepy', { skipSync: true });
      zzzBubble?.classList.remove('hidden');
      resetBowlPosition();
      if (CLIP_FLOW_MODE) {
        syncVideoClip({ immediate: true });
      } else {
        Cat2Player.switchClip('sleep', { crossfade: true });
      }
    } else if (isEating) {
      nomFloat?.classList.add('show');
      if (CLIP_FLOW_MODE) {
        syncVideoClip({ immediate: true });
      } else {
        Cat2Player.switchClip('eat', { crossfade: true });
      }
    } else {
      zzzBubble?.classList.add('hidden');
      nomFloat?.classList.remove('show');
      if (catEl.dataset.expression === 'sleepy') setExpression('happy');
      syncVideoClip();
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
      foodFlowActive ||
      catEl.dataset.begging === 'true' || awaitingFoodChoice ||
      catEl.dataset.playing === 'butterfly' || catEl.dataset.playing === 'pet' ||
      Cat2Player.isTransitioning?.();
  }

  function canDoActivity() {
    return !isChatOpen() && !isAnimating() && !isSleeping &&
      !breakAlertActive && !isFocusMode && !getSettings().focusMode;
  }

  function stopActivity() {
    if (activityTimeout) clearTimeout(activityTimeout);
    activityTimeout = null;
    if (catEl.dataset.playing === 'butterfly') {
      finishButterflyChase();
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
    stopClipMovement();
    catEl.classList.remove('walking-left', 'walking-right');
    catEl.dataset.playing = '';
    isBusy = false;
    animLock = false;
    setExpression('happy');
    syncVideoClip({ immediate: true });
  }

  function startButterflyChase() {
    if (!canDoActivity()) return;
    if (catEl.dataset.begging === 'true' || awaitingFoodChoice) return;
    if (isPetting || catEl.dataset.playing === 'pet') return;
    if (Cat2Player.getCurrentKey() !== 'idle') return;
    if (catEl.dataset.playing === 'butterfly') return;

    isBusy = true;
    animLock = true;
    catEl.dataset.playing = 'butterfly';
    catEl.classList.remove('walking-left', 'walking-right');
    catEl.classList.add(Math.random() < 0.5 ? 'walking-left' : 'walking-right');
    setExpression('excited');
    hideSpeech();
    sayDialogue('butterfly', 3500);
    syncVideoClip({ immediate: true });

    detachButterflyListener();
    butterflyEndedListener = (ev) => {
      if (ev.detail?.key !== 'butterfly') return;
      finishButterflyChase();
    };
    window.addEventListener('cat2:clip-ended', butterflyEndedListener);
  }

  function detachPetListener() {
    if (!petEndedListener) return;
    window.removeEventListener('cat2:clip-ended', petEndedListener);
    petEndedListener = null;
  }

  function finishPet() {
    detachPetListener();
    catEl.dataset.playing = '';
    isPetting = false;
    isBusy = false;
    animLock = false;
    setExpression('happy', { skipSync: true });
    syncVideoClip({ immediate: true });
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

  function petHead(e) {
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

    isPetting = true;
    isBusy = true;
    animLock = true;
    catEl.dataset.playing = 'pet';
    setExpression('love', { skipSync: true });

    if (Cat2Player.getCurrentKey() === 'pet' && !Cat2Player.isTransitioning?.()) {
      Cat2Player.restartActiveClip();
    } else {
      syncVideoClip({ immediate: true });
    }

    detachPetListener();
    petEndedListener = (ev) => {
      if (ev.detail?.key !== 'pet') return;
      finishPet();
    };
    window.addEventListener('cat2:clip-ended', petEndedListener);
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
    if (!canDoActivity()) return;
    if (!CLIP_FLOW_MODE && isBowlOnCooldown()) return;
    if (catEl.dataset.begging === 'true') return;
    if (Cat2Player.getCurrentKey() !== 'idle') return;

    catEl.dataset.begging = 'true';
    setExpression('sad');
    syncVideoClip({ immediate: true });
  }

  function hideFeedPrompt() {
    awaitingFoodChoice = false;
    if (foodChoiceTimeout) clearTimeout(foodChoiceTimeout);
    foodChoiceTimeout = null;
    foodChoice?.classList.add('hidden');
    if (!isEating && !foodFlowActive) {
      foodFlowActive = false;
    }
  }

  function showFeedPrompt() {
    if (catEl.dataset.begging !== 'true' || isEating || isSleeping || isChatOpen()) return;
    if (awaitingFoodChoice) return;
    awaitingFoodChoice = true;
    foodFlowActive = true;
    hideSpeech();
    foodChoice?.classList.remove('hidden');
    setExpression('sad');
  }

  function acceptFood() {
    if (catEl.dataset.begging !== 'true' || isEating) return;
    foodFlowActive = true;
    animLock = true;
    if (sleepTimeout) clearTimeout(sleepTimeout);
    catEl.dataset.sleeping = '';
    hideFeedPrompt();
    feedCat();
  }

  function declineFoodAndWalk() {
    if (!awaitingFoodChoice || catEl.dataset.begging !== 'true') return;
    foodFlowActive = true;
    animLock = true;
    hideFeedPrompt();
    catEl.dataset.begging = '';
    walkThenSleep = true;
    hideSpeech();
    sayDialogue('walkDecline', 3500);

    setTimeout(() => {
      if (!walkThenSleep) return;
      hideSpeech();
      startWalk({ afterDecline: true });
    }, 3200);
  }

  function cancelBegging({ syncClip = true } = {}) {
    catEl.dataset.begging = '';
    foodFlowActive = false;
    hideFeedPrompt();
    hideSpeech();
    if (syncClip) syncVideoClip();
  }

  /* ── Window movement synced to walk / butterfly clips ── */
  let clipMoveRaf = null;
  let clipMovementStarted = false;
  let clipMovementKey = null;
  let walkEndedListener = null;

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

  function startSyncedClipMovement(clipKey, dir, totalDistance) {
    if (clipMovementStarted) return;
    clipMovementStarted = true;
    clipMovementKey = clipKey;

    const distance = totalDistance ?? (320 + Math.random() * 180);
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

      const progress = Math.min(1, playback.currentTime / playback.duration);
      const targetPx = progress * distance * dir;
      const rawDelta = targetPx - appliedPx;
      if (Math.abs(rawDelta) >= 0.5) {
        const step = Math.round(rawDelta);
        appliedPx += step;
        window.meowAPI?.dragWindow(step, 0);
      }

      if (progress >= 0.995) {
        stopClipMovement();
        return;
      }

      clipMoveRaf = requestAnimationFrame(tick);
    };

    clipMoveRaf = requestAnimationFrame(tick);
  }

  function startWalkMovement(dir) {
    startSyncedClipMovement('walk', dir);
  }

  function startButterflyMovement(dir) {
    startSyncedClipMovement('butterfly', dir, 260 + Math.random() * 140);
  }

  function detachWalkEndedListener() {
    if (!walkEndedListener) return;
    window.removeEventListener('cat2:clip-ended', walkEndedListener);
    walkEndedListener = null;
  }

  function stopWalk({ skipSync = false } = {}) {
    if (walkTimeout) { clearTimeout(walkTimeout); walkTimeout = null; }
    stopWalkMovement();
    detachWalkEndedListener();
    isWalking = false;
    catEl.dataset.walking = '';
    catEl.classList.remove('walking-left', 'walking-right');
    if (!isSleeping && !isEating) animLock = false;
    isBusy = false;
    if (skipSync) return;
    if (CLIP_FLOW_MODE && (Cat2Player.getCurrentKey() === 'walk' || Cat2Player.isTransitioning?.())) {
      syncVideoClip();
    } else if (!CLIP_FLOW_MODE) {
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
      return;
    }
    if (foodFlowActive || isEating || catEl.dataset.begging === 'true') return;
    if (!force && !canDoActivity()) return;
    if (!force && Cat2Player.getCurrentKey() !== 'idle') return;

    stopActivity();
    catEl.dataset.sleeping = 'true';
    animLock = true;
    isBusy = true;
    hideSpeech();
    setPose('sleep');
    lastRandomActivity = 'sleep';

    const loops = 1 + Math.floor(Math.random() * 2);
    const sleepMs = duration || Cat2Clips.getDurationMs('sleep') * loops;

    if (sleepTimeout) clearTimeout(sleepTimeout);
    sleepTimeout = setTimeout(() => {
      wakeFromSleepFlow();
    }, sleepMs);
  }

  function wakeFromSleepFlow() {
    if (!isSleeping) return;
    if (sleepTimeout) clearTimeout(sleepTimeout);
    catEl.dataset.sleeping = '';
    isBusy = false;
    animLock = false;
    foodFlowActive = false;
    setPose('loaf');
    setExpression('happy');
    syncVideoClip({ immediate: true });
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

  function startWalk({ afterDecline = false } = {}) {
    if (isWalking) return;
    if (!afterDecline) {
      if (!canDoActivity()) return;
      if (Cat2Player.getCurrentKey() !== 'idle') return;
    }
    stopWalk({ skipSync: afterDecline });

    isWalking = true;
    isBusy = true;
    animLock = true;
    foodFlowActive = false;
    catEl.dataset.walking = 'true';

    const goLeft = Math.random() < 0.5;
    catEl.classList.add(goLeft ? 'walking-left' : 'walking-right');

    if (!afterDecline) sayDialogue('walkPatrol', 3500);
    setExpression('happy');
    syncVideoClip(afterDecline ? { immediate: true } : {});

    detachWalkEndedListener();
    walkEndedListener = (ev) => {
      if (ev.detail?.key !== 'walk') return;
      stopWalkMovement();
      if (walkTimeout) clearTimeout(walkTimeout);
      walkTimeout = null;
      finishWalk();
    };
    window.addEventListener('cat2:clip-ended', walkEndedListener);
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
    if (CLIP_FLOW_MODE) {
      hideFeedPrompt();
      return;
    }
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
      stopEating();
      startBowlCooldown();

      const type = foodType || (Math.random() < 0.5 ? 'plain' : 'fishy');
      const liked = Math.random() < getLikeChance(type);
      updateFoodPref(type, liked);
      updateFoodStars();

      const lines = FOOD_REACTIONS[type][liked ? 'like' : 'dislike'];
      const reaction = lines[Math.floor(Math.random() * lines.length)];

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
    };

    const armEatTimeout = () => {
      if (eatTimeout) clearTimeout(eatTimeout);
      const eatMs = Cat2Clips.getDurationMs('eat');
      eatTimeout = setTimeout(finishEating, eatMs + 400);
    };

    eatEndedListener = (ev) => {
      if (ev.detail?.key !== 'eat') return;
      finishEating();
    };
    window.addEventListener('cat2:clip-ended', eatEndedListener);

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
    nomFloat?.classList.remove('show');
    resetBowlPosition();
    setPose('loaf');
    if (CLIP_FLOW_MODE) {
      setExpression('happy', { skipSync: true });
      syncVideoClip({ immediate: true });
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

  function pickRandomClipActivity() {
    if (!canDoActivity()) return false;
    if (foodFlowActive || isEating) return false;
    if (Cat2Player.getCurrentKey() !== 'idle') return false;
    if (catEl.dataset.begging === 'true' || awaitingFoodChoice) return false;

    let options = ['butterfly', 'walk', 'sleep'];
    if (lastRandomActivity === 'sleep') {
      options = options.filter((o) => o !== 'sleep');
    }

    const choice = options[Math.floor(Math.random() * options.length)];
    lastRandomActivity = choice;

    if (choice === 'butterfly') startButterflyChase();
    else if (choice === 'walk') startWalk();
    else goToSleepClip();

    return true;
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
        if (foodMood && Math.random() < 0.22) {
          sayDialogue(foodMood === 'good' ? 'goodMood' : 'grumpyMood', 3500);
          return;
        }
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
    if (!isChatOpen()) window.meowAPI?.resizeWindow(220, COMPACT_H, true);
  }

  function buddyStack() {
    return document.getElementById('buddy-stack');
  }

  function triggerBreakAlert({ hours, minutes, gentle }) {
    if (CLIP_FLOW_MODE) return;
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
    const softMode = !!gentle || isReducedMotion();

    const breakAlert = document.getElementById('break-alert');
    const breakText = document.getElementById('break-alert-text');
    if (breakText) breakText.textContent = msg;
    breakAlert?.classList.remove('hidden');

    showSpeech(msg, softMode ? 8000 : 14000);
    window.meowAPI?.resizeWindow(220, BREAK_ALERT_H, true);

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
        e.target.closest('.pet-zone')) return;
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

  foodChoice?.querySelectorAll('.food-opt').forEach((btn) => {
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
    if (typeof settings.focusMode === 'boolean') setFocusMode(settings.focusMode);
    if (typeof settings.reducedMotion === 'boolean') {
      Cat2Player.setReducedMotion(settings.reducedMotion);
    }
    if (e.detail?.key === 'chattyLevel' || e.detail?.key === 'all') restartIdleLoop();
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
    if (ev.detail?.key === 'hungry' && catEl.dataset.begging === 'true') showFeedPrompt();
  });

  Cat2Player.init(cat2VideoA, cat2VideoB, cat2CanvasA, cat2CanvasB, catEl);
  Cat2Player.setReducedMotion(!!initialSettings.reducedMotion);

  if (CLIP_FLOW_MODE) {
    Cat2Player.switchClip('idle', { crossfade: false, force: true });
    scheduleFeedRequest();
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

  window.MeowCat = {
    setExpression, setPose, bounce, wiggle,
    showSpeech, hideSpeech, blink, wakeUp, stopEating,
    playAnimation, playRandomAnimation, triggerBreakAlert,
    stopActivity, startRandomActivity, stopWalk, startWalk, begForFood,
    startButterflyChase, petHead, goToSleepClip, pickRandomClipActivity,
    showFoodChoice, hideFoodChoice, setFocusMode, snoozeBreak,
  };
})();
