# AI Meow 🐱

A floating cute cat desktop buddy for **macOS and Windows**. Meow lives on your screen, makes adorable expressions, and chats with you about your day — motivating you when you need it.

![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Windows-blue)

**Repo:** [github.com/AkhanshaSen/Cat-Desktop-Buddy](https://github.com/AkhanshaSen/Cat-Desktop-Buddy)

## Features

- **Two cats to choose from** — classic SVG Cat 1, or video-clip Cat 2 with hunger meter, feed prompts, and idle activities
- **Full mini cat** — expressions, eye tracking, and 58+ animations (Cat 1) / video clips (Cat 2)
- **Little agent** — ask Meow to open apps, folders, and websites offline on macOS or Windows (see [commands](#meow-the-little-agent) below)
- **Chat dialog** — talk about your day, get motivation, or something cute
- **Look tab** (Cat 1) — change coat color and accessories (hat, bow, scarf, flower, glasses)
- **Food system** — drag bowl to feed; choose Plain or Fishy; learns your preferences over time
- **Idle life** — laptop, reading, phone, coffee, notebook, gaming, walking, napping, scratching, and more
- **Focus Mode & Settings** — quiet/normal/chatty, reduced motion, break snooze defaults
- **Break reminder** — after 2 hours of continuous work, with 10/30/60 min snooze
- **System tray** — hide/show or quit from the menu bar (macOS) or notification area (Windows)

## Requirements

- **Node.js 18+** ([nodejs.org](https://nodejs.org) — choose the LTS installer)
- Works on **macOS** and **Windows** (same codebase)

## One-click launch (after download)

GitHub cannot open a desktop app from the browser with one click by itself — you need Node.js once, then you can launch Meow with a double-click.

### 1. Get the code

**Option A — Download ZIP**
1. Open [Cat-Desktop-Buddy](https://github.com/AkhanshaSen/Cat-Desktop-Buddy)
2. Click **Code → Download ZIP**
3. Unzip the folder anywhere

**Option B — Clone**
```bash
git clone https://github.com/AkhanshaSen/Cat-Desktop-Buddy.git
cd Cat-Desktop-Buddy
```

### 2. Double-click to start

| OS | Cat 1 | Cat 2 |
|----|-------|-------|
| **Windows** | `Start Meow.bat` | `npm run start:cat2` |
| **macOS** | `Start Meow.command` | `Start Meow 2.command` |

- **First run** installs dependencies automatically (`npm install`) — may take a minute.
- **Later runs** start Meow immediately.
- On macOS, if the system blocks the file: right-click → **Open**, or run once: `chmod +x "Start Meow.command"`

### Terminal (optional)

```bash
npm install        # first time only
npm start          # Cat 1
npm run start:cat2 # Cat 2
npm run stop       # if cats won't disappear
```

## Meow the little agent

Meow can open and close apps for you. **Click the cat** to open chat, then type a request like:

### Open apps

| Say something like… | Opens |
|---------------------|-------|
| "open notepad" / "pull up something to write in" | TextEdit (Mac) · Notepad (Windows) |
| "open the camera" / "take a selfie" | Photo Booth (Mac) · Camera (Windows) |
| "open the calculator" | Calculator |
| "open the terminal" | Terminal (Mac) · Command Prompt (Windows) |
| "open file explorer" / "open my files" | Finder (Mac) · Explorer (Windows) |
| "open my downloads" | Downloads folder |
| "open photos" | Photos |
| "open the calendar" | Calendar |
| "open mail" | Mail |
| "open contacts" | Contacts |
| "open reminders" | Reminders (Mac) · To Do (Windows) |
| "open the clock" | Clock / Alarms |
| "open weather" | Weather |
| "open maps" | Maps |
| "open system settings" | System Settings (Mac) · Settings (Windows) |
| "open music" | Music (Mac) · Media Player (Windows) |
| "open voice memos" | Voice Memos (Mac) · Voice Recorder (Windows) |
| "open screenshot tool" | Screenshot (Mac) · Snipping Tool (Windows) |
| "open sticky notes" | Stickies (Mac) · Sticky Notes (Windows) |
| "open paint" | Preview (Mac) · Paint (Windows) |
| "open task manager" | Activity Monitor (Mac) · Task Manager (Windows) |
| "open the app store" | App Store (Mac) · Microsoft Store (Windows) |
| "open the browser" | Google in your default browser |
| "open youtube" / "open wikipedia" | YouTube / Wikipedia |
| "open google.com" | Any website (http/https) |

### Other commands

- **"what time is it?"** — current time and date
- **"what can you do?"** — list everything Meow knows
- **"close notepad"** / **"quit the calculator"** — close an allowlisted app

Meow maps each request to the matching app on your OS. Opening uses `open -a` (macOS) or `start` (Windows); closing quits the app gracefully via AppleScript (macOS) or `taskkill` (Windows). Only a fixed allowlist of common apps can be opened or closed — Meow never runs arbitrary shell commands.

### Common commands are free and offline

The most frequent "open X" commands are recognized on-device, so they work instantly with **no account and no cost**.

### Optional: natural language via Gemini

For fuzzier phrasing ("open whatever I use to jot things down"), add a **Gemini API key** in the **Settings** tab (⚙):

1. Get a free key from [aistudio.google.com](https://aistudio.google.com).
2. Open Meow → Settings → paste the key under **Gemini API key** → **Save** → **Test Gemini**.

The key is stored locally in the app's user-data folder and is used only from the main process — it is never sent anywhere except Google Gemini. You can turn the whole feature off with the **Let Meow do tasks** toggle.

## Windows compatibility

AI Meow is built for **Windows as a first-class platform**, not macOS-only:

| Feature | Windows behavior |
|---------|------------------|
| Launch scripts | Cross-platform `npm start` / `Start Meow.bat` |
| Transparent window | Frameless window with Windows-specific chrome fixes |
| Drag the cat | Full-screen movement; no stuck/small drag area after repeated moves |
| Tray | Notification area (system tray) — right-click for Show/Hide/Quit, **double-click** to toggle |
| Break alert | Window nudge + taskbar flash |
| Stop script | PowerShell-based process kill via `npm run stop` |

Install Node.js LTS on Windows, then use `Start Meow.bat` or `npm start` from PowerShell / Command Prompt.

## Share with friends (no Node.js required)

You can build a **standalone installer** so friends double-click an `.exe` (Windows) or `.dmg` (macOS) — no Node.js needed.

### Build on your machine

```bash
npm install
npm run dist          # build for your current OS
npm run dist:win      # Windows .exe (run on Windows, or CI)
npm run dist:mac      # macOS .dmg (run on macOS)
```

Output goes to the `dist/` folder.

| Installer | Best for |
|-----------|----------|
| `AI Meow Setup x.x.x.exe` | Windows friends — full NSIS installer |
| `AI Meow x.x.x.exe` | Windows portable — no install step |
| `AI Meow-x.x.x.dmg` | Mac friends |

### Mac → Windows (or Mac → Mac)

**You cannot send a Mac build to a Windows friend.** Installers are OS-specific:

| You build on | Friend needs | Send them |
|--------------|--------------|-----------|
| **Mac** | Mac | `AI Meow-x.x.x.dmg` from `npm run dist:mac` |
| **Mac** | Windows | ❌ Mac `.dmg` / `.app` will **not** run on Windows |
| **Windows** | Windows | `AI Meow Setup x.x.x.exe` from `npm run dist:win` |
| **Windows** | Mac | ❌ Windows `.exe` will **not** run on Mac |

**Yes — you can build on your device and send the file** (Google Drive, Dropbox, etc.), as long as it matches their OS. Your friend double-clicks the installer; no Node.js required.

**If you only have a Mac but friends use Windows**, use **GitHub Actions** — pushes to `main` automatically build Mac and Windows installers (see `.github/workflows/build-desktop.yml`).

### First launch — pick your buddy

The packaged app shows a **chooser screen**:

| Option | What you get |
|--------|----------------|
| **AI Meow** | Classic SVG cat (Cat 1) |
| **AI Meow 2** | Video clip cat (Cat 2) |

The picker appears **every time** the app starts so you can switch cats whenever you like.

### Dev vs packaged

| | Developers (`npm start`) | Friends (installer) |
|---|--------------------------|---------------------|
| Cat 1 | `npm start` | Launcher → AI Meow |
| Cat 2 | `npm run start:cat2` | Launcher → AI Meow 2 |
| Launcher preview | `npm run start:launcher` | Shown automatically |

> **Note:** Unsigned builds may show “Unknown publisher” (Windows) or Gatekeeper warnings (macOS). Friends can still run via “Run anyway” / right-click → Open.

## How to hide or quit

| Action | Result |
|--------|--------|
| **×** beside cat's ear | Quit AI Meow |
| **Right-click cat** | Hide or Quit menu |
| **Tray icon** | macOS: click to show/hide · Windows: right-click menu · double-click to toggle |
| **`npm run stop`** | Force-kills every running instance |

> **Stuck with an old cat?** Run `npm run stop` once, then start again.

## Platform notes

| | macOS | Windows |
|---|--------|---------|
| **Tray** | Menu bar (top-right) | Notification area (system tray) |
| **Show/hide** | Click tray icon | Right-click tray → Show/Hide, or double-click tray |
| **Break alert** | Window nudge | Window nudge + taskbar flash |
| **One-click file** | `Start Meow.command` | `Start Meow.bat` |
| **Dock** | Hidden while running | N/A |

## Settings (chat → ⚙)

- **Focus mode** — pause idle interruptions
- **Chatty level** — Quiet / Normal / Chatty
- **Reduced motion** — fewer animations
- **Break snooze default** — 10 / 30 / 60 min
- **Gemini API key** — optional, for natural-language tasks beyond offline commands

## Chat examples

**Feelings & small talk**
- "Hi Meow!" — friendly greeting
- "My day was really good!" — happy response
- "I'm feeling stressed" — gentle encouragement
- "I need motivation" — pep talk
- "Tell me something cute" — adorable cat facts

**Tasks (offline, no key needed)**
- "open the camera"
- "open maps"
- "open my downloads"
- "what time is it?"
- "what can you do?"

## Development & testing

```bash
npm run test:commands       # loop all offline commands (intent + launcher checks)
npm run test:commands -- --live  # actually open each app on your machine
npm run test:gemini         # test Gemini API connection
npm run test:cat2-walk      # Cat 2 walk sync sanity check
```

Command tests run automatically in CI on both macOS and Windows before installers are built.

## Project structure

```
Cat-Desktop-Buddy/
├── Start Meow.bat / .command      # One-click launch (Cat 1)
├── Start Meow 2.command           # One-click launch (Cat 2, macOS)
├── launcher-main.js               # Packaged app: cat picker entry
├── main.js                        # Electron main process
├── preload.js
├── main/
│   ├── agent.js                   # Chat agent orchestrator
│   ├── actions.js                 # Allowlisted OS app launcher
│   ├── intents.js                 # Offline command matcher
│   └── gemini.js                  # Gemini API client
├── scripts/
│   ├── start.js / start-cat2.js
│   ├── stop.js
│   └── test-commands.js           # Command test loop
└── src/
    ├── index.html                 # Cat 1 shell
    ├── index-cat2.html            # Cat 2 shell
    ├── cat.js                     # Cat 1 behavior
    ├── cat2/                      # Cat 2 modules (feed, sleep, activities, …)
    ├── chat.js
    ├── settings.js
    ├── appearance.js
    └── personality.js
```

## Tips

- Meow starts in the bottom-right corner of your screen
- **Click the cat body** to open/close chat
- **Drag the cat** to move the window (hold and move — a small threshold avoids accidental drags when clicking)
- Drag the food bowl to the cat's mouth to feed
- Open chat → **✨ Look** (Cat 1) for coat/accessories · **⚙** for Focus Mode & settings

---

Made with 💕 and purrs.

- Developed By Akhansha_Sen with Cursor
