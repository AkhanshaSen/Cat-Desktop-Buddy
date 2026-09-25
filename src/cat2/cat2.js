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
  const scratchStopPrompt = document.getElementById('scratch-stop-prompt');
  const scratchStopBtn = document.getElementById('scratch-stop-btn');
  const quickStopScratchBtn = document.getElementById('quick-stop-scratch');
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
  const CAT2_ACTIVITY_LOG = true;
  const cat2LogSessionStart = Date.now();

  function cat2Snapshot() {
    return {
      playing: catEl?.dataset?.playing || '',
      begging: catEl?.dataset?.begging === 'true',
      clip: typeof Cat2Player !== 'undefined' ? Cat2Player.getCurrentKey?.() : null,
      transitioning: Cat2Player?.isTransitioning?.() ?? false,
      busy: isBusy,
      animLock,
      eating: isEating,
      sleeping: isSleeping,
      walking: isWalking,
      petting: typeof isPettingNow === 'function' ? isPettingNow() : isPetting,
      foodChoice: feedState?.isAwaitingChoice?.() ?? false,
      feedPhase: feedState?.getPhase?.() ?? 'idle',
      foodFlow: feedState?.isFlowActive?.() ?? false,
      postMeal: postMealPhase,
      foodMood,
      focus: isFocusMode,
    };
  }

  function cat2ActivityLog(event, activity, details = {}) {
    if (!CAT2_ACTIVITY_LOG || !CLIP_FLOW_MODE) return;
    const name = String(event || '');
    const tag = /error|fail/.test(name) ? '[ERROR]'
      : /interrupt|skip|none|retry|idle-tick/.test(name) ? '[DELAYED]'
      : '[CORRECT]';
    const bits = Object.entries(details || {})
      .filter(([key, value]) => value != null && value !== '' && key !== 'options' && key !== 'state')
      .slice(0, 3)
      .map(([key, value]) => `${key} ${value}`);
    const elapsed = Math.round((Date.now() - cat2LogSessionStart) / 1000);
    console.log(`${tag} Syrax ${activity || 'cat'}: ${name}${bits.length ? ` · ${bits.join(' · ')}` : ''} · ${elapsed}s`);
  }

  const feedState = Cat2State.createFeedStateMachine(catEl, (event, activity, details) => {
    cat2ActivityLog(event, activity, details);
  });

  const FEED_INTERVAL_OPTIONS = [2, 5, 10, 15, 30];
  const FEED_INTERVAL_DEFAULT_MS = 5 * 60 * 1000;
  const ACTIVITY_HISTORY_SIZE = 5;
  /** Sleep / grumpy need extra spacing — they were repeating back-to-back. */
  const MOOD_ACTIVITY_COOLDOWN_MS = 2 * 60 * 1000;
  const MOOD_ACTIVITY_RECENT_LOOKBACK = 3;
  const IDLE_ACTIVITY_OPTIONS = [
    'butterfly', 'walk', 'sleep', 'meow', 'roll', 'groom', 'earpurr',
    'grumpy', 'woolball', 'jump', 'scratch',
  ];
  const PLAYFUL_ACTIVITY_OPTIONS = IDLE_ACTIVITY_OPTIONS.filter(
    (o) => o !== 'sleep' && o !== 'grumpy'
  );
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
    jump: [
      { text: '*boing* Too much energy~ must jump!', expression: 'excited' },
      { text: 'Gravity? Never heard of her. ✨', expression: 'excited' },
      { text: '*hop hop hop* Spring-loaded loaf!', expression: 'happy' },
      { text: 'Watch this— …okay one more jump.', expression: 'excited' },
      { text: 'Zoomies activated~ 🐾', expression: 'excited' },
      { text: '*lands perfectly* Nailed it. Obviously.', expression: 'happy' },
      { text: 'The floor is lava. I am winning.', expression: 'love' },
      { text: 'Bounce mode: ON. Brain mode: OFF.', expression: 'excited' },
    ],
    scratch: [
      { text: '*scr scratch scratch* The couch is mine now~', expression: 'excited' },
      { text: 'Sharpening the claws. Very important work.', expression: 'thinking' },
      { text: '*rrrrrip* Oops. …No regrets.', expression: 'happy' },
      { text: 'This furniture exists for my paws. 🛋️', expression: 'excited' },
      { text: '*vicious kneading* Feel the power!', expression: 'excited' },
      { text: 'Human, look away. Professional scratching in progress.', expression: 'happy' },
      { text: 'The armrest called me. I answered.', expression: 'thinking' },
      { text: '*scratch scratch* Art installation: Claw Marks.', expression: 'happy' },
    ],
    scratchStop: [
      { text: 'Fine… but the sofa needed texture.', expression: 'sad' },
      { text: '*licks paw innocently* I wasn\'t doing anything.', expression: 'thinking' },
      { text: 'Mrow! I was almost finished!', expression: 'sad' },
      { text: 'Okay okay… for now. 😾', expression: 'sad' },
      { text: 'You\'re no fun, human.', expression: 'sad' },
      { text: '*one last scratch* …done. Happy?', expression: 'thinking' },
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
  let dragPending = false;
  let dragStart = { x: 0, y: 0 };
  let hasMoved = false;
  let isSleeping = false;
  let isEating = false;
  let isBusy = false;
  let isWalking = false;
  let walkTimeout = null;
  let foodMood = null;        // 'good' | 'grumpy' | null
  let foodMoodTimeout = null;
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
  let jumpEndedListener = null;
  let scratchEndedListener = null;
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
  let recentActivityHistory = [];
  let lastActivityStartedAt = {};
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

  /** Cat 2 — ask for food on a user-configured interval. */

  /* ── Food preferences (learned over time) ── */

  const ctx = {
    catEl, catFigure, catContainer, foodBowl, nomFloat, foodChoice,
    hungerMeter, hungerMeterFill, activityProps, scratchStopPrompt,
    quickStopScratchBtn, petHearts, feedState, CLIP_FLOW_MODE,
    BOWL_COOLDOWN_MS, BOWL_COOLDOWN_KEY, FOOD_PREFS_KEY,
    FEED_INTERVAL_OPTIONS, FEED_INTERVAL_DEFAULT_MS, FOOD_BEG_DIALOG,
    FOOD_REACTIONS, CAT2_DIALOGUES, ACTIVITY_SNAP_OPTS,
    IDLE_ACTIVITY_OPTIONS, PLAYFUL_ACTIVITY_OPTIONS,
    MOOD_ACTIVITY_COOLDOWN_MS, MOOD_ACTIVITY_RECENT_LOOKBACK,
    ACTIVITY_HISTORY_SIZE, IDLE_ACTIVITIES,
    CURSOR_AWAY_GRUMPY_MS, CURSOR_NEAR_PAD_PX, foodPrefs,
  };

  function bindCtxState(key, getter, setter) {
    Object.defineProperty(ctx, key, { get: getter, set: setter, enumerable: true });
  }

  bindCtxState('isFocusMode', () => isFocusMode, (v) => { isFocusMode = v; });
  bindCtxState('isSleeping', () => isSleeping, (v) => { isSleeping = v; });
  bindCtxState('isEating', () => isEating, (v) => { isEating = v; });
  bindCtxState('isBusy', () => isBusy, (v) => { isBusy = v; });
  bindCtxState('isWalking', () => isWalking, (v) => { isWalking = v; });
  bindCtxState('isPetting', () => isPetting, (v) => { isPetting = v; });
  bindCtxState('animLock', () => animLock, (v) => { animLock = v; });
  bindCtxState('breakAlertActive', () => breakAlertActive, (v) => { breakAlertActive = v; });
  bindCtxState('walkThenSleep', () => walkThenSleep, (v) => { walkThenSleep = v; });
  bindCtxState('foodMood', () => foodMood, (v) => { foodMood = v; });
  bindCtxState('postMealPhase', () => postMealPhase, (v) => { postMealPhase = v; });
  bindCtxState('postMealMeta', () => postMealMeta, (v) => { postMealMeta = v; });
  bindCtxState('postMealCooldownUntil', () => postMealCooldownUntil, (v) => { postMealCooldownUntil = v; });
  bindCtxState('postMealHeartInterval', () => postMealHeartInterval, (v) => { postMealHeartInterval = v; });
  bindCtxState('petSession', () => petSession, (v) => { petSession = v; });
  bindCtxState('lastRandomActivity', () => lastRandomActivity, (v) => { lastRandomActivity = v; });
  bindCtxState('lastActivityStartedAt', () => lastActivityStartedAt, () => {});
  bindCtxState('recentActivityHistory', () => recentActivityHistory, () => {});
  bindCtxState('lastCursorNearAt', () => lastCursorNearAt, (v) => { lastCursorNearAt = v; });
  bindCtxState('mouseX', () => mouseX, (v) => { mouseX = v; });
  bindCtxState('mouseY', () => mouseY, (v) => { mouseY = v; });
  bindCtxState('cursorAwayCheckInterval', () => cursorAwayCheckInterval, (v) => { cursorAwayCheckInterval = v; });
  bindCtxState('clipMovementStarted', () => clipMovementStarted, (v) => { clipMovementStarted = v; });
  bindCtxState('clipMovementKey', () => clipMovementKey, (v) => { clipMovementKey = v; });
  bindCtxState('clipMoveRaf', () => clipMoveRaf, (v) => { clipMoveRaf = v; });
  bindCtxState('walkPlacement', () => walkPlacement, (v) => { walkPlacement = v; });
  bindCtxState('butterflyPlacement', () => butterflyPlacement, (v) => { butterflyPlacement = v; });
  bindCtxState('walkTimeout', () => walkTimeout, (v) => { walkTimeout = v; });
  bindCtxState('sleepTimeout', () => sleepTimeout, (v) => { sleepTimeout = v; });
  bindCtxState('activityTimeout', () => activityTimeout, (v) => { activityTimeout = v; });
  bindCtxState('activityWatchdog', () => activityWatchdog, (v) => { activityWatchdog = v; });
  bindCtxState('walkEndedListener', () => walkEndedListener, (v) => { walkEndedListener = v; });
  bindCtxState('butterflyEndedListener', () => butterflyEndedListener, (v) => { butterflyEndedListener = v; });
  bindCtxState('meowEndedListener', () => meowEndedListener, (v) => { meowEndedListener = v; });
  bindCtxState('rollEndedListener', () => rollEndedListener, (v) => { rollEndedListener = v; });
  bindCtxState('groomEndedListener', () => groomEndedListener, (v) => { groomEndedListener = v; });
  bindCtxState('earPurrEndedListener', () => earPurrEndedListener, (v) => { earPurrEndedListener = v; });
  bindCtxState('grumpyEndedListener', () => grumpyEndedListener, (v) => { grumpyEndedListener = v; });
  bindCtxState('woolballEndedListener', () => woolballEndedListener, (v) => { woolballEndedListener = v; });
  bindCtxState('jumpEndedListener', () => jumpEndedListener, (v) => { jumpEndedListener = v; });
  bindCtxState('scratchEndedListener', () => scratchEndedListener, (v) => { scratchEndedListener = v; });
  bindCtxState('petEndedListener', () => petEndedListener, (v) => { petEndedListener = v; });
  bindCtxState('hungerMeterRaf', () => hungerMeterRaf, (v) => { hungerMeterRaf = v; });
  bindCtxState('feedScheduleTimeout', () => feedScheduleTimeout, (v) => { feedScheduleTimeout = v; });
  bindCtxState('feedPromptRetryTimeout', () => feedPromptRetryTimeout, (v) => { feedPromptRetryTimeout = v; });
  bindCtxState('foodChoiceTimeout', () => foodChoiceTimeout, (v) => { foodChoiceTimeout = v; });
  bindCtxState('eatTimeout', () => eatTimeout, (v) => { eatTimeout = v; });
  bindCtxState('bowlCooldownUntil', () => bowlCooldownUntil, (v) => { bowlCooldownUntil = v; });
  bindCtxState('hungerCycleStartAt', () => hungerCycleStartAt, (v) => { hungerCycleStartAt = v; });
  bindCtxState('hungerCycleDurationMs', () => hungerCycleDurationMs, (v) => { hungerCycleDurationMs = v; });
  bindCtxState('lastWalkDir', () => lastWalkDir, (v) => { lastWalkDir = v; });
  bindCtxState('idleLoopInterval', () => idleLoopInterval, (v) => { idleLoopInterval = v; });
  bindCtxState('foodMoodTimeout', () => foodMoodTimeout, (v) => { foodMoodTimeout = v; });
  bindCtxState('bowlCooldownTimeout', () => bowlCooldownTimeout, (v) => { bowlCooldownTimeout = v; });
  bindCtxState('lastPetTime', () => lastPetTime, (v) => { lastPetTime = v; });
  Object.defineProperty(ctx, 'foodPrefs', { get: () => foodPrefs });

  function getCatMouthCenter() {
    const layer = document.querySelector('.cat2-video-layer') || catFigure;
    const rect = layer.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height * 0.72 };
  }

  function wireCat2Modules() {
    ctx.getSettings = getSettings;
    ctx.getFeedIntervalMs = getFeedIntervalMs;
    ctx.isReducedMotion = isReducedMotion;
    ctx.isChatOpen = isChatOpen;
    ctx.setExpression = setExpression;
    ctx.setPose = setPose;
    ctx.syncVideoClip = syncVideoClip;
    ctx.snapVideoClip = snapVideoClip;
    ctx.syncPetClip = syncPetClip;
    ctx.clearActivityWatchdog = clearActivityWatchdog;
    ctx.armActivityWatchdog = armActivityWatchdog;
    ctx.showSpeech = showSpeech;
    ctx.hideSpeech = hideSpeech;
    ctx.sayDialogue = sayDialogue;
    ctx.pickDialogue = pickDialogue;
    ctx.playAnimation = playAnimation;
    ctx.cat2ActivityLog = cat2ActivityLog;
    ctx.spawnHeartsAtCat = spawnHeartsAtCat;
    ctx.detachPetListener = detachPetListener;
    ctx.finishPet = finishPet;
    ctx.getCatMouthCenter = getCatMouthCenter;
    ctx.scheduleEyeUpdate = scheduleEyeUpdate;

    Object.assign(ctx, Cat2Feed.create(ctx));
    Object.assign(ctx, Cat2Sleep.create(ctx));
    Object.assign(ctx, Cat2Activities.create(ctx));
  }


  function isReducedMotion() {

    return document.body.dataset.reducedMotion === 'true' ||
      window.meowSettings?.reducedMotion;
  }

  function getFeedIntervalMs() {
    const mins = getSettings().feedIntervalMinutes;
    if (FEED_INTERVAL_OPTIONS.includes(mins)) return mins * 60 * 1000;
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

  function behaviorNow() {
    const settings = getSettings();
    return window.MeowProductivityLogic?.resolveCatBehavior?.({
      focusMode: !!settings.focusMode || isFocusMode,
      focusSession: !!settings.focusSession || !!window.MeowProductivity?.isFocusSessionActive?.(),
      patrolMode: !!settings.patrolMode,
      chattyLevel: settings.chattyLevel,
    }) || {
      mode: 'loaf',
      patrol: false,
      intervalMs: 12000,
      act: 0.42,
      walk: 0.12,
      play: 0.48,
      speech: 0.28,
    };
  }

  function getIdleIntervalMs() {
    const ms = behaviorNow().intervalMs || 12000;
    if (window.meowBatterySaver) return Math.max(18000, ms * 2);
    return ms;
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
    cat2ActivityLog('watchdog-arm', clipKey, { timeoutMs: ms });
    activityWatchdog = setTimeout(() => {
      activityWatchdog = null;
      cat2ActivityLog('watchdog-fire', clipKey);
      onTimeout();
    }, ms);
  }

  function recoverFromStateMismatch() {
    stateMismatchSince = 0;
    cat2ActivityLog('recover', 'state-mismatch');
    const expected = Cat2Clips.forState(catEl.dataset);
    if (expected === 'idle' && !postMealPhase && !isEating && !isWalking && !isPettingNow()) {
      isBusy = false;
      animLock = false;
      if (!feedState.isFlowActive()) feedState.reset('recover');
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

  function detachPetListener() {
    if (!petEndedListener) return;
    window.removeEventListener('cat2:clip-ended', petEndedListener);
    petEndedListener = null;
  }

  function finishPet() {
    cat2ActivityLog('end', 'pet');
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
      cat2ActivityLog('restart', 'pet');
    } else {
      syncPetClip();
      cat2ActivityLog('start', 'pet', { trigger: 'head-pet' });
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

  /* ── Window movement synced to walk / butterfly clips ── */
  let clipMoveRaf = null;
  let clipMovementStarted = false;
  let clipMovementKey = null;
  let walkEndedListener = null;
  let lastWalkDir = 1;
  let walkPlacement = null;
  let butterflyPlacement = null;

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

  function logSyraxSays(text) {
    const line = String(text || '').replace(/\s+/g, ' ').trim().slice(0, 80);
    if (!line) return;
    window.meowAPI?.log?.('Syrax says', line);
  }

  function showSpeech(text, duration = 4000) {
    if (isSleeping) {
      window.meowAPI?.log?.('Syrax silent', 'sleeping');
      return;
    }
    if (CLIP_FLOW_MODE && feedState.isAwaitingChoice()) {
      window.meowAPI?.log?.('Syrax silent', 'feed prompt open');
      return;
    }
    logSyraxSays(text);
    speechText.textContent = text;
    speechBubble.classList.remove('hidden');
    if (speechTimeout) clearTimeout(speechTimeout);
    speechTimeout = null;
    if (duration > 0) {
      speechTimeout = setTimeout(() => speechBubble.classList.add('hidden'), duration);
    }
  }

  function hideSpeech() {
    if (catEl.dataset.taskPraise === 'true') return;
    speechBubble.classList.remove('task-reaction');
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

  function startIdleBehaviorLoop() {
    if (idleLoopInterval) clearInterval(idleLoopInterval);

    const tick = () => {
      const behavior = behaviorNow();
      if (behavior.mode === 'focus') return;
      if (window.MeowProductivity?.shouldSuppressIdle?.()) return;
      if ((isChatOpen() && !behavior.patrol) || isSleeping || isEating || breakAlertActive || feedState.isAwaitingChoice() || feedState.isFlowActive()) return;

      if (CLIP_FLOW_MODE) {
        if (isAnimating()) return;
        if (Cat2Player.getCurrentKey() !== 'idle') return;
        if (catEl.dataset.begging === 'true' || feedState.isAwaitingChoice() || feedState.isFlowActive()) return;
        const settings = getSettings();
        if (foodMood && Math.random() < behavior.speech) {
          sayDialogue(foodMood === 'good' ? 'goodMood' : 'grumpyMood', 3500);
          return;
        }
        if (Math.random() > behavior.act) return;
        if (behavior.patrol && Math.random() < behavior.walk) {
          startWalk({ patrol: true });
          return;
        }
        if (Math.random() < behavior.play) {
          pickRandomClipActivity();
          return;
        }
        if (Math.random() < behavior.speech) {
          sayDialogue(settings.chattyLevel === 'quiet' ? 'greetings' : 'click', 2500);
        }
        return;
      }

      const settings = getSettings();
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
      const patrol = !!settings.patrolMode || window.MeowProductivity?.isPatrolModeActive?.();

      if (level === 'quiet' && !patrol) {
        if (!isBusy && !animLock && roll < 0.25) {
          startRandomActivity();
        } else if (!isBusy && !animLock && roll < 0.4) {
          goToSleep(15000 + Math.random() * 10000);
        } else if (!isBusy && roll < 0.55) {
          playRandomAnimation();
        }
        return;
      }

      if (patrol) {
        if (!isBusy && !animLock && roll < 0.55) {
          startWalk();
        } else if (!isBusy && !animLock && roll < 0.8) {
          startRandomActivity();
        } else if (!isBusy && roll < 0.92) {
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
    if (!isChatOpen()) {
      if (window.MeowProductivity?.applyWindowSize) window.MeowProductivity.applyWindowSize();
      else window.meowAPI?.resizeWindow(220, COMPACT_H, false);
    }
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

  wireCat2Modules();
  ({
    loadBowlCooldown, clearFeedSchedule, scheduleFeedRequest, updateFeedIntervalDuration,
    resumeFeedSchedule, onFeedCycleComplete,
    begForFood, hideFeedPrompt, showFeedPrompt, acceptFood, declineFoodAndWalk,
    cancelBegging, showFoodChoice, hideFoodChoice, feedCat, stopEating, goToEat,
    refreshFeedPromptAfterChat, tryShowFeedPrompt, ensureFeedPromptVisible,
    loadFoodPrefs, updateFoodStars, isBowlOnCooldown, resetBowlPosition,
    hungerMeterFull,
    checkBowlNearCat, completePostMealSequence,
    stopWalk, startWalk, goToSleepClip, wakeUp, goToSleep,
    onWalkClipVisible, onButterflyClipVisible, ensureWalkMovementStarted, stopClipMovement,
    isAnimating, canDoActivity, isPettingNow, stopActivity, startRandomActivity,
    startButterflyChase, finishButterflyChase, stopScratchActivity,
    pickRandomClipActivity, startCursorAwayWatch, noteCursorProximity,
    recordActivityStart, canPickActivity,
  } = ctx);

  let taskPraiseRestoreTimer = null;

  function showTaskSpeech(text, duration = 3500) {
    if (isSleeping) wakeUp({ quiet: true });
    speechText.textContent = text;
    speechBubble.classList.add('task-reaction');
    speechBubble.classList.remove('hidden');
    catEl.dataset.taskPraise = 'true';
    logSyraxSays(text);
    if (speechTimeout) clearTimeout(speechTimeout);
    speechTimeout = setTimeout(() => {
      speechTimeout = null;
      catEl.dataset.taskPraise = '';
      speechBubble.classList.remove('task-reaction');
      speechBubble.classList.add('hidden');
    }, duration);
  }

  function reactToTask(payload) {
    if (!payload?.text) return;
    if (taskPraiseRestoreTimer) clearTimeout(taskPraiseRestoreTimer);
    const duration = payload.duration || 3500;
    const restoreFeed = feedState.isAwaitingChoice() || catEl.classList.contains('feed-prompt-open');
    if (restoreFeed) hideFeedPrompt();
    if (isSleeping) wakeUp({ quiet: true });
    setExpression(payload.allDone ? 'excited' : (payload.expression || 'love'));
    showTaskSpeech(payload.text, duration);
    if (payload.allDone) bounce();
    else wiggle();
    const napMs = Number(payload.napRemainingMs) || 0;
    taskPraiseRestoreTimer = setTimeout(() => {
      taskPraiseRestoreTimer = null;
      if (restoreFeed && (feedState.isHungry() || catEl.dataset.begging === 'true')) {
        showFeedPrompt();
      }
      const focusOn = !!window.MeowProductivity?.isFocusSessionActive?.();
      if (!payload.resumeNap || !focusOn || napMs <= duration + 800) return;
      const left = napMs - duration - 400;
      if (left < 1500) return;
      if (goToSleepClip) goToSleepClip(left, { force: true });
      else goToSleep(left, { force: true });
    }, duration + 400);
  }

  function endWindowDrag() {
    catContainer.removeEventListener('pointermove', onWindowPointerMove);
    if (isDraggingWindow) {
      isDraggingWindow = false;
      window.meowAPI?.dragEnd?.();
    }
    dragPending = false;
  }

  function onWindowPointerMove(e) {
    if (!dragPending && !isDraggingWindow) return;
    const dx = e.screenX - dragStart.x;
    const dy = e.screenY - dragStart.y;
    if (!isDraggingWindow && (Math.abs(dx) > 3 || Math.abs(dy) > 3)) {
      isDraggingWindow = true;
      hasMoved = true;
      window.meowAPI?.dragBegin?.();
      try { catContainer.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
    }
    if (!isDraggingWindow || !window.meowAPI) return;
    window.meowAPI.dragWindow(Math.round(dx), Math.round(dy));
    dragStart = { x: e.screenX, y: e.screenY };
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
    endWindowDrag();
  });

  window.addEventListener('blur', endWindowDrag);

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
        e.target.closest('.focus-badge') || e.target.closest('.pet-zone') ||
        e.target.closest('.scratch-stop-prompt') || e.target.closest('.scratch-stop-btn') ||
        e.target.closest('#notes-panel') || e.target.closest('#productivity-hub') ||
        e.target.closest('#pinned-tasks-widget') ||
        e.target.closest('#focus-session-modal') || e.target.closest('#focus-timer-widget') ||
        e.target.closest('#water-chase-bubble')) return;
    if (hasMoved) return;
    e.stopPropagation();
    if (e.shiftKey || e.altKey) {
      if (window.MeowChat?.isDocked?.()) {
        window.dispatchEvent(new CustomEvent('meow:click'));
        return;
      }
      window.meowAPI?.log?.('cat shift/alt click → open focus');
      window.meowAPI?.broadcast?.('hub:open', { tab: 'focus' });
      window.dispatchEvent(new CustomEvent('meow:open-focus-session'));
      return;
    }
    if (catEl.dataset.playing === 'scratch') {
      stopScratchActivity({ source: 'cat-click' });
      window.dispatchEvent(new CustomEvent('meow:click'));
      return;
    }
    if (isPettingNow()) {
      window.dispatchEvent(new CustomEvent('meow:click'));
      return;
    }
    // Wake from sleep, then still open/toggle the panel (do not swallow the click)
    if (wakeUp()) {
      window.dispatchEvent(new CustomEvent('meow:click'));
      return;
    }
    if (isEating) {
      stopEating();
      showSpeech(pickDialogue('feedInterrupt').text, 2000);
      return;
    }
    if (!feedState.isAwaitingChoice() && catEl.dataset.begging !== 'true') {
      stopWalk();
      stopActivity();
    }
    if (CLIP_FLOW_MODE && canDoActivity() && !feedState.isAwaitingChoice() && catEl.dataset.begging !== 'true') {
      sayDialogue('click', 2500);
    } else if (!CLIP_FLOW_MODE) {
      bounce();
    }
    window.dispatchEvent(new CustomEvent('meow:click'));
  });

  catFigure.addEventListener('dblclick', (e) => {
    if (e.target.closest('#food-bowl') || e.target.closest('.quit-x') || e.target.closest('.pet-zone')) return;
    e.stopPropagation();
    e.preventDefault();
    // Rapid clicks while chat is docked must not open Focus (browser fires dblclick).
    if (window.MeowChat?.isDocked?.()) return;
    window.meowAPI?.log?.('cat dblclick → open focus');
    window.meowAPI?.broadcast?.('hub:open', { tab: 'focus' });
    window.dispatchEvent(new CustomEvent('meow:open-focus-session'));
  });

  catContainer.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    if (e.target.closest('.quit-x') || e.target.closest('.focus-badge') ||
        e.target.closest('.chat-panel') || e.target.closest('#food-bowl') ||
        e.target.closest('.pet-zone') || e.target.closest('#food-choice') ||
        e.target.closest('.food-opt') || e.target.closest('.scratch-stop-prompt') ||
        e.target.closest('.scratch-stop-btn') ||
        e.target.closest('#notes-panel') || e.target.closest('#productivity-hub') ||
        e.target.closest('#pinned-tasks-widget') ||
        e.target.closest('#focus-session-modal') || e.target.closest('#focus-timer-widget') ||
        e.target.closest('#focus-countdown-bar') || e.target.closest('#water-chase-bubble')) return;
    closeContextMenu();
    dragPending = true;
    hasMoved = false;
    dragStart = { x: e.screenX, y: e.screenY };
    catContainer.addEventListener('pointermove', onWindowPointerMove);
  });

  catContainer.addEventListener('pointerup', (e) => {
    try { catContainer.releasePointerCapture(e.pointerId); } catch (_) { /* ignore */ }
    endWindowDrag();
  });

  catContainer.addEventListener('pointercancel', (e) => {
    try { catContainer.releasePointerCapture(e.pointerId); } catch (_) { /* ignore */ }
    endWindowDrag();
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

  scratchStopBtn?.addEventListener('mousedown', (e) => e.stopPropagation());
  scratchStopBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    stopScratchActivity({ source: 'stop-button' });
  });

  quickStopScratchBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    stopScratchActivity({ source: 'chat-quick' });
  });

  window.addEventListener('meow:chat-send', (e) => {
    const text = (e.detail?.text || '').trim().toLowerCase();
    if (!text || catEl.dataset.playing !== 'scratch') return;
    if (/stop\s+(scratching|scratch)|don'?t\s+scratch|no\s+scratching/.test(text)) {
      stopScratchActivity({ source: 'chat-type' });
    }
  });

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
    if (key === 'focusMode' || key === 'focusSession' || key === 'all') {
      const quiet = !!(settings.focusMode || settings.focusSession);
      setFocusMode(quiet);
      if (quiet) clearFeedSchedule();
      else resumeFeedSchedule();
    }
    if ((key === 'reducedMotion' || key === 'all') && typeof settings.reducedMotion === 'boolean') {
      Cat2Player.setReducedMotion(settings.reducedMotion);
      if (!settings.reducedMotion && catEl.dataset.begging === 'true') {
        Cat2Player.forceRecover?.();
        if (!feedState.isAwaitingChoice()) tryShowFeedPrompt();
        else {
          foodChoice?.classList.remove('hidden');
          catEl.classList.add('feed-prompt-open');
        }
      }
    }
    if ((key === 'catSounds' || key === 'all') && typeof settings.catSounds === 'boolean') {
      Cat2Player.setSoundsEnabled?.(settings.catSounds);
    }
    if (key === 'chattyLevel' || key === 'patrolMode' || key === 'focusSession' || key === 'all') {
      restartIdleLoop();
    }
    if (key === 'patrolMode' && settings.patrolMode && !settings.focusMode && !settings.focusSession) {
      if (isSleeping) wakeUp({ quiet: true });
      stopActivity({ force: true });
      startWalk({ patrol: true });
    }
    if (key === 'feedIntervalMinutes') {
      updateFeedIntervalDuration(getFeedIntervalMs());
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
  cat2ActivityLog('init', 'cat2', { activityLog: CAT2_ACTIVITY_LOG });

  window.addEventListener('cat2:clip-changed', (ev) => {
    cat2ActivityLog('clip-changed', ev.detail?.key ?? '?');
    if (ev.detail?.key === 'walk' && catEl.dataset.waterChase !== 'true') {
      requestAnimationFrame(() => ensureWalkMovementStarted());
    }
  });
  window.addEventListener('cat2:clip-ended', (ev) => {
    cat2ActivityLog('clip-ended', ev.detail?.key ?? '?');
  });
  function onHungryClip() {
    const begging = feedState.isHungry() || catEl.dataset.begging === 'true';
    if (!begging) return;
    if (feedState.isAwaitingChoice() || hungerMeterFull()) {
      showFeedPrompt();
      return;
    }
    cancelBegging();
  }

  window.addEventListener('cat2:clip-visible', (ev) => {
    cat2ActivityLog('clip-visible', ev.detail?.key ?? '?');
    if (ev.detail?.key === 'hungry') onHungryClip();
    if (ev.detail?.key === 'walk') onWalkClipVisible();
    if (ev.detail?.key === 'butterfly') onButterflyClipVisible();
    if (isWalking && ev.detail?.key !== 'walk') stopWalkMovement();
    if (catEl.dataset.playing === 'butterfly' && ev.detail?.key !== 'butterfly') {
      stopClipMovement();
      catEl.classList.remove('walking-left', 'walking-right');
    }
  });

  window.addEventListener('cat2:clip-loop', (ev) => {
    cat2ActivityLog('clip-loop', ev.detail?.key ?? '?');
    if (ev.detail?.key === 'hungry') onHungryClip();
  });

  let waterChaseWalk = false;

  function applyWaterChaseFacing(dir) {
    catEl.classList.remove('walking-left', 'walking-right');
    catEl.classList.add(dir === -1 ? 'walking-left' : 'walking-right');
  }

  function ensureWaterChaseWalkClip() {
    if (!waterChaseWalk) return;
    catEl.dataset.walking = 'true';
    const clip = Cat2Clips.get('walk');
    const moveStart = clip?.moveStart ?? 0.04;
    if (Cat2Player.getCurrentKey() !== 'walk') {
      Cat2Player.switchClip('walk', { crossfade: false, force: true });
    } else {
      Cat2Player.seekActiveClip?.(moveStart);
    }
  }

  window.addEventListener('meow:water-chase', (ev) => {
    const active = !!ev.detail?.active;
    if (active) {
      waterChaseWalk = true;
      catEl.dataset.waterChase = 'true';
      stopWalk({ skipSync: true });
      stopActivity?.();
      stopClipMovement?.();
      applyWaterChaseFacing(1);
      if (CLIP_FLOW_MODE) ensureWaterChaseWalkClip();
    } else if (waterChaseWalk) {
      waterChaseWalk = false;
      delete catEl.dataset.waterChase;
      delete catEl.dataset.walking;
      stopWalk();
    }
  });

  window.addEventListener('meow:water-chase-face', (ev) => {
    if (!waterChaseWalk) return;
    const dir = ev.detail?.dir === -1 ? -1 : 1;
    applyWaterChaseFacing(dir);
  });

  window.addEventListener('cat2:clip-ended', (ev) => {
    if (waterChaseWalk && ev.detail?.key === 'walk') {
      ensureWaterChaseWalkClip();
    }
  });

  window.addEventListener('meow:focus-session', (ev) => {
    if (ev.detail?.active) return;
    if (isSleeping) wakeUp();
  });

  Cat2Player.init(cat2VideoA, cat2VideoB, cat2CanvasA, cat2CanvasB, catEl);
  Cat2Player.setReducedMotion(!!initialSettings.reducedMotion);
  Cat2Player.setSoundsEnabled?.(!!initialSettings.catSounds);
  Cat2Player.preloadClip?.('pet');
  Cat2Player.preloadClip?.('idle');

  if (CLIP_FLOW_MODE) {
    Cat2Player.switchClip('idle', { crossfade: false, force: true });
    scheduleFeedRequest(getFeedIntervalMs());
    setTimeout(() => {
      if (!catEl.dataset.begging && !feedState.isAwaitingChoice() && canDoActivity()) {
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
    showSpeech, showTaskSpeech, hideSpeech, blink, wakeUp, stopEating, goToSleep,
    reactToTask,
    playAnimation, playRandomAnimation, triggerBreakAlert,
    stopActivity, startRandomActivity, stopWalk, startWalk, begForFood,
    startButterflyChase, petHead, goToSleepClip, pickRandomClipActivity,
    showFoodChoice, hideFoodChoice, setFocusMode, snoozeBreak,
    isPetting: isPettingNow,
    isAwaitingFoodChoice: () => feedState.isAwaitingChoice(),
    isFeedBegging: () => feedState.isBegging(),
    refreshFeedPromptAfterChat,
    stopScratch: () => stopScratchActivity({ source: 'api' }),
    cat2ActivityLog,
    cat2Snapshot,
  };
})();
