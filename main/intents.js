/**
 * Offline intent matcher for the Meow agent.
 *
 * Recognizes common "open X" style commands without needing an LLM, so the
 * most frequent tasks stay instant and free to run. Returns a resolved intent
 * { type, actionId } / { type: 'time' } / { type: 'url', url } or null when no
 * task is detected (the caller then falls back to the LLM or personality chat).
 */

// Synonyms mapped to app registry ids. Order matters: longer/more specific
// phrases are matched before generic single words.
const APP_ALIASES = [
  { id: 'notepad', words: ['notepad', 'text editor', 'textedit', 'text edit', 'something to write', 'write something', 'write in', 'write notes', 'note pad'] },
  { id: 'notes', words: ['notes app', 'notes'] },
  { id: 'camera', words: ['camera', 'photobooth', 'photo booth', 'webcam', 'selfie'] },
  { id: 'calculator', words: ['calculator', 'calc'] },
  { id: 'terminal', words: ['terminal', 'command prompt', 'command line', 'shell', 'console'] },
  { id: 'finder', words: ['finder', 'file browser', 'file explorer', 'explorer', 'my files'] },
  { id: 'photos', words: ['photos', 'photo library', 'gallery', 'pictures'] },
  { id: 'calendar', words: ['calendar', 'my schedule', 'agenda'] },
  { id: 'mail', words: ['mail', 'email', 'e-mail', 'inbox'] },
  { id: 'settings', words: ['system settings', 'system preferences', 'settings app', 'control panel'] },
  { id: 'music', words: ['music', 'spotify', 'itunes', 'play music'] },
  { id: 'browser', words: ['browser', 'web browser', 'chrome', 'safari', 'internet'] },
];

const OPEN_VERBS = /\b(open|launch|start|run|fire up|pull up|bring up|show me|load|boot up|go to)\b/i;
const CLOSE_VERBS = /\b(close|quit|exit|kill|shut down|shutdown|shut|terminate|end)\b/i;
const TIME_PATTERN = /\b(what(?:'s| is)? the )?(time|clock)\b|what time is it|current time|today'?s date|what(?:'s| is)? the date|what day is it/i;
const HELP_PATTERN = /(what|which).*(can you do|do you know|can i ask|are your (commands|abilities)|can you help)|list (of )?(your )?commands|list (of )?things you can|(your )?commands|what can you (help|do)|how can you help|what are you capable|show me what you can/i;

function matchIntent(rawText) {
  const text = (rawText || '').toLowerCase().trim();
  if (!text) return null;

  if (HELP_PATTERN.test(text)) {
    return { type: 'help' };
  }

  if (TIME_PATTERN.test(text)) {
    return { type: 'time' };
  }

  const hasOpenVerb = OPEN_VERBS.test(text);
  const hasCloseVerb = CLOSE_VERBS.test(text);

  for (const { id, words } of APP_ALIASES) {
    for (const word of words) {
      if (text.includes(word)) {
        // Generic single-word app names (e.g. "notes", "music") require an
        // explicit verb to avoid false positives in casual chat. Strong
        // phrases like "photo booth" or "text editor" can match on their own.
        const isStrongPhrase = word.includes(' ') || word.length > 8;
        if (hasCloseVerb) {
          return { type: 'close', actionId: id };
        }
        if (hasOpenVerb || isStrongPhrase) {
          return { type: 'app', actionId: id };
        }
      }
    }
  }

  return null;
}

module.exports = { matchIntent, APP_ALIASES };
