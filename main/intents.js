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
  { id: 'notes', words: ['notes app', 'apple notes'] },
  { id: 'camera', words: ['camera', 'photobooth', 'photo booth', 'webcam', 'selfie', 'take a photo'] },
  { id: 'calculator', words: ['calculator', 'calc', 'do math'] },
  { id: 'terminal', words: ['terminal', 'command prompt', 'command line', 'shell', 'console', 'powershell'] },
  { id: 'downloads', words: ['downloads folder', 'my downloads', 'download folder', 'downloads'] },
  { id: 'finder', words: ['finder', 'file browser', 'file explorer', 'explorer', 'my files', 'files app'] },
  { id: 'photos', words: ['photos', 'photo library', 'gallery', 'pictures', 'my photos'] },
  { id: 'calendar', words: ['calendar', 'my schedule', 'agenda', 'my calendar'] },
  { id: 'mail', words: ['mail', 'email', 'e-mail', 'inbox', 'outlook mail'] },
  { id: 'contacts', words: ['contacts', 'address book', 'people app', 'my contacts'] },
  { id: 'reminders', words: ['reminders', 'to do list', 'todo list', 'my reminders', 'to-do'] },
  { id: 'clock', words: ['clock app', 'alarm clock', 'alarms', 'timer app', 'stopwatch', 'the clock', 'clock'] },
  { id: 'weather', words: ['weather', 'weather app', 'forecast'] },
  { id: 'maps', words: ['maps', 'map app', 'google maps', 'directions'] },
  { id: 'settings', words: ['system settings', 'system preferences', 'settings app', 'control panel', 'preferences'] },
  { id: 'music', words: ['music', 'apple music', 'itunes', 'play music', 'media player'] },
  { id: 'voice_memos', words: ['voice memos', 'voice memo', 'voice recorder', 'sound recorder', 'record audio'] },
  { id: 'screenshot', words: ['screenshot', 'screenshot tool', 'snipping tool', 'screen capture', 'screen shot', 'snip'] },
  { id: 'sticky_notes', words: ['sticky notes', 'stickies', 'sticky note', 'post it notes'] },
  { id: 'paint', words: ['paint', 'mspaint', 'draw app', 'drawing app', 'preview app'] },
  { id: 'task_manager', words: ['task manager', 'activity monitor', 'process manager', 'running processes'] },
  { id: 'store', words: ['app store', 'application store', 'microsoft store', 'mac app store'] },
  { id: 'browser', words: ['browser', 'web browser', 'chrome', 'safari', 'internet'] },
  { id: 'youtube', words: ['youtube', 'you tube', 'youtube.com'] },
  { id: 'wikipedia', words: ['wikipedia', 'wiki', 'wikipedia.org'] },
];

const OPEN_VERBS = /\b(open|launch|start|run|fire up|pull up|bring up|show me|load|boot up|go to|visit|browse)\b/i;
const CLOSE_VERBS = /\b(close|quit|exit|kill|shut down|shutdown|shut|terminate|end)\b/i;
const TIME_PATTERN = /\b(what(?:'s| is)? the )?(time|clock)\b|what time is it|current time|today'?s date|what(?:'s| is)? the date|what day is it/i;
const HELP_PATTERN = /(what|which).*(can you do|do you know|can i ask|are your (commands|abilities)|can you help)|list (of )?(your )?commands|list (of )?things you can|(your )?commands|what can you (help|do)|how can you help|what are you capable|show me what you can/i;

function extractUrl(text) {
  const explicit = text.match(/https?:\/\/[^\s]+/i);
  if (explicit) return explicit[0];

  const domainMatch = text.match(
    /\b(?:open|launch|go to|visit|browse|show me)\s+(?:the\s+)?([a-z0-9][-a-z0-9]*(?:\.[a-z0-9][-a-z0-9]*)+(?:\/[^\s]*)?)/i,
  );
  if (domainMatch) return `https://${domainMatch[1]}`;

  return null;
}

function matchAppAlias(text, { requireVerb = false, hasOpenVerb = false, hasCloseVerb = false } = {}) {
  for (const { id, words } of APP_ALIASES) {
    for (const word of words) {
      if (!text.includes(word)) continue;

      const isStrongPhrase = word.includes(' ') || word.length > 8;
      if (requireVerb && !hasOpenVerb && !hasCloseVerb && !isStrongPhrase) continue;

      if (hasCloseVerb) return { type: 'close', actionId: id };
      if (hasOpenVerb || isStrongPhrase || !requireVerb) {
        return { type: 'app', actionId: id };
      }
    }
  }
  return null;
}

function matchIntent(rawText) {
  const text = (rawText || '').toLowerCase().trim();
  if (!text) return null;

  if (HELP_PATTERN.test(text)) {
    return { type: 'help' };
  }

  const hasOpenVerb = OPEN_VERBS.test(text);
  const hasCloseVerb = CLOSE_VERBS.test(text);

  if (hasOpenVerb || hasCloseVerb) {
    const appIntent = matchAppAlias(text, { requireVerb: true, hasOpenVerb, hasCloseVerb });
    if (appIntent) return appIntent;

    const url = extractUrl(text);
    if (url) return { type: 'url', url };
  }

  if (TIME_PATTERN.test(text)) {
    return { type: 'time' };
  }

  return matchAppAlias(text, { requireVerb: true, hasOpenVerb, hasCloseVerb });
}

module.exports = { matchIntent, APP_ALIASES, extractUrl };
