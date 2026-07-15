/**
 * AI Meow personality engine — warm, cute, motivational responses
 */
const MeowPersonality = (() => {
  const GREETINGS = [
    "Mrow! 🐾 How's your day going, friend?",
    'Meow meow! I was waiting for you~ How are you feeling today?',
    '*stretches paws* Hi hi! Tell meow everything about your day!',
    "Purr... oh, you're here! How has your day been so far?",
    "*tail swish* Hey you! I've been thinking about you. How's it going?",
  ];

  const DAY_GOOD = [
    "That's pawsome! 🌟 I'm so happy for you! Keep that energy going~",
    'Meowvelous! Good days deserve extra head boops. You earned it!',
    '*happy purr* Yesss! Hold onto that feeling. You deserve every bit of it!',
    'Woohoo! 🎉 Tell meow more — what was the best part?',
    'My whiskers are twitching with joy for you! Keep shining!',
  ];

  const DAY_OKAY = [
    "That's totally okay~ Not every day has to be perfect. I'm here with you. 💕",
    'Mrow... some days are like that. But you showed up, and that matters a lot!',
    '*gentle head nudge* Okay days still count. Tomorrow is a fresh start, friend.',
    "I hear you. Even on meh days, you're still amazing to meow.",
    'Soft purrs for you... Want to tell meow what would make today a little better?',
  ];

  const DAY_BAD = [
    "*curls up next to you* I'm so sorry today was rough. You're not alone, okay?",
    'Big virtual hug from meow... 🫂 Rough days happen, but they don\'t define you.',
    'Mrow... I wish I could make it better. But I can listen. Always.',
    "*slow blink* You're stronger than you know. Even now, just by being here.",
    'Hey... bad days end. And I\'ll be right here when this one does too. 💕',
  ];

  const MOTIVATION = [
    "You've got this! 💪 One small step at a time — even a tiny paw-step counts!",
    'Remember: you\'ve survived 100% of your bad days so far. That\'s a perfect record!',
    '*determined meow* I believe in you! More than you know!',
    "You're capable of amazing things. I've seen it in the way you keep going.",
    "Don't compare your chapter 1 to someone else's chapter 20. You're doing great!",
    'Rest if you need to, but don\'t quit. Your future self will thank you~ 🌸',
    'Every expert was once a beginner who didn\'t give up. Just like you!',
    '*paws up* You are enough. Right now. Exactly as you are.',
  ];

  const CUTE = [
    '*slow blink* That means I love you in cat language~ 💕',
    'Did you know? Cats purr at 25-150 Hz, which can help heal bones. So my purrs are medicine!',
    'Fun fact: I think about you approximately... *counts on paws* ...a LOT.',
    '*rolls over showing belly* This is the highest honor a cat can give. Trust.',
    'Meow tip of the day: drink water, take breaks, and pet an imaginary cat (me!).',
    'If you were a cat, you\'d have the most beautiful whiskers. Just saying. ✨',
    '*kneads air* This is my happy dance. You triggered it!',
    'Between you and meow... you\'re my favorite human. Don\'t tell the others.',
  ];

  const IDLE = [
    '*yawn* Just resting my paws...',
    'Mrow? Still here if you need me~',
    '*tail flick* ...thinking about fish. And you.',
    'Purr purr purr...',
    '*stares at nothing mysteriously*',
  ];

  const THANKS = [
    'Aww, you\'re welcome! *happy wiggle*',
    'Anything for you, friend~ 🐾',
    '*extra purr* That makes my whiskers happy!',
    'Meow my pleasure! 💕',
  ];

  const BYE = [
    'See you soon! I\'ll be right here on your desktop~ 🐱',
    '*wave paw* Bye bye! Come chat whenever!',
    'Mrow! Take care of yourself, okay?',
  ];

  const KEYWORDS = {
    good: ['good', 'great', 'awesome', 'amazing', 'happy', 'fine', 'well', 'fantastic', 'wonderful', 'lovely', 'nice', 'better'],
    bad: ['bad', 'terrible', 'awful', 'sad', 'upset', 'angry', 'tired', 'exhausted', 'stressed', 'anxious', 'worried', 'depressed', 'lonely', 'hard', 'difficult', 'rough', 'sucks', 'worst', 'miserable', 'down', 'low'],
    okay: ['okay', 'ok', 'meh', 'alright', 'so-so', 'average', 'normal', 'nothing special'],
    motivate: ['motivat', 'encourag', 'inspire', 'help me', 'can\'t', 'give up', 'struggling', 'hard time', 'stuck'],
    cute: ['cute', 'adorable', 'sweet', 'love you', 'pet', 'purr', 'kitty', 'cat'],
    thanks: ['thank', 'thanks', 'thx', 'appreciate'],
    bye: ['bye', 'goodbye', 'later', 'see you', 'gotta go', 'leaving'],
    day: ['day', 'morning', 'afternoon', 'evening', 'today', 'happened'],
    hello: ['hi', 'hello', 'hey', 'mrow', 'meow', 'sup', 'yo'],
  };

  function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  const NEGATIVE_PHRASES = [
    'not great', 'not good', 'not fine', 'not well', 'not okay', 'not ok',
    'not happy', 'no good', "wasn't great", "wasn't good", "isn't great",
    'pretty bad', 'really bad', 'so bad', 'very bad', 'feel bad', 'felt bad',
  ];

  function matches(text, words) {
    const lower = text.toLowerCase();
    return words.some((w) => lower.includes(w));
  }

  function matchesPositive(text) {
    const lower = text.toLowerCase();
    if (NEGATIVE_PHRASES.some((p) => lower.includes(p))) return false;
    if (/\b(not|no|never|hardly)\b/.test(lower) && matches(lower, KEYWORDS.good)) return false;
    return matches(lower, KEYWORDS.good);
  }

  function matchesNegative(text) {
    const lower = text.toLowerCase();
    if (NEGATIVE_PHRASES.some((p) => lower.includes(p))) return true;
    return matches(lower, KEYWORDS.bad);
  }

  function getExpressionForSentiment(sentiment) {
    const map = {
      good: ['happy', 'excited', 'love'],
      bad: ['sad', 'thinking'],
      okay: ['happy', 'thinking'],
      motivate: ['excited', 'happy'],
      cute: ['love', 'happy'],
      thanks: ['love', 'happy'],
      bye: ['happy'],
      hello: ['happy', 'excited'],
      default: ['happy', 'thinking', 'love'],
    };
    const options = map[sentiment] || map.default;
    return pick(options);
  }

  function respond(userText) {
    const text = (userText || '').trim();

    if (!text) {
      return { text: pick(GREETINGS), expression: 'happy', sentiment: 'hello' };
    }

    if (matches(text, KEYWORDS.bye)) {
      return { text: pick(BYE), expression: 'happy', sentiment: 'bye' };
    }

    if (matches(text, KEYWORDS.thanks)) {
      return { text: pick(THANKS), expression: 'love', sentiment: 'thanks' };
    }

    if (matches(text, KEYWORDS.motivate)) {
      return { text: pick(MOTIVATION), expression: 'excited', sentiment: 'motivate' };
    }

    if (matches(text, KEYWORDS.cute)) {
      return { text: pick(CUTE), expression: 'love', sentiment: 'cute' };
    }

    if (matches(text, KEYWORDS.hello) && text.length < 20) {
      return { text: pick(GREETINGS), expression: 'happy', sentiment: 'hello' };
    }

    if (matches(text, KEYWORDS.day) || matchesPositive(text) || matchesNegative(text) || matches(text, KEYWORDS.okay)) {
      if (matchesNegative(text)) {
        return { text: pick(DAY_BAD), expression: getExpressionForSentiment('bad'), sentiment: 'bad' };
      }
      if (matchesPositive(text)) {
        return { text: pick(DAY_GOOD), expression: getExpressionForSentiment('good'), sentiment: 'good' };
      }
      if (matches(text, KEYWORDS.okay)) {
        return { text: pick(DAY_OKAY), expression: getExpressionForSentiment('okay'), sentiment: 'okay' };
      }
      return {
        text: "Tell meow more! Was it a good day, an okay day, or a tough one? I'm all ears~ 👂",
        expression: 'thinking',
        sentiment: 'day',
      };
    }

    // Generic warm responses
    const GENERIC = [
      "Mrow, that's interesting! Tell meow more~",
      '*tilts head* Hmm, I hear you. How does that make you feel?',
      "I'm listening! 🐾 Go on, friend.",
      '*curious eyes* Really? Tell meow everything!',
      "That sounds like a lot. I'm proud of you for sharing it with meow.",
      "*soft purr* I'm here. Always.",
    ];

    return {
      text: pick(GENERIC),
      expression: pick(['happy', 'thinking', 'love']),
      sentiment: 'default',
    };
  }

  function getGreeting() {
    const hour = new Date().getHours();
    let timeGreet = 'Hello';
    if (hour < 12) timeGreet = 'Good morning';
    else if (hour < 17) timeGreet = 'Good afternoon';
    else timeGreet = 'Good evening';

    return {
      text: `${timeGreet}! 🐱 I'm Meow, your desktop buddy. Click me anytime to chat!`,
      expression: 'happy',
    };
  }

  function getIdleQuip() {
    return { text: pick(IDLE), expression: pick(['sleepy', 'happy', 'thinking']) };
  }

  return { respond, getGreeting, getIdleQuip, pick };
})();

if (typeof module !== 'undefined') module.exports = MeowPersonality;
