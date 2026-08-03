# AI Meow 🐱

A floating cute cat desktop buddy for **macOS and Windows**. Meow lives on your screen, makes adorable expressions, and chats with you about your day — motivating you when you need it.

![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Windows-blue)

**Repo:** [github.com/AkhanshaSen/Cat-Desktop-Buddy](https://github.com/AkhanshaSen/Cat-Desktop-Buddy)

## Features

- **Full mini cat** — animated SVG with expressions, eye tracking, and 58+ animations
- **Little agent** — ask Meow to open apps ("open notepad", "open the camera", "open the calculator") and it launches them on macOS or Windows
- **Chat dialog** — talk about your day, get motivation, or something cute
- **Look tab** — change coat color and accessories (hat, bow, scarf, flower, glasses)
- **Food system** — drag bowl to feed; choose Plain or Fishy; learns your preferences over time
- **Idle life** — laptop, reading, phone, coffee, notebook, gaming, walking, napping
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

| OS | File |
|----|------|
| **Windows** | Double-click `Start Meow.bat` |
| **macOS** | Double-click `Start Meow.command` |

- **First run** installs dependencies automatically (`npm install`) — may take a minute.
- **Later runs** start Meow immediately.
- On macOS, if the system blocks the file: right-click → **Open**, or run once: `chmod +x "Start Meow.command"`

### Terminal (optional)

```bash
npm install   # first time only
npm start
npm run stop  # if cats won't disappear
```

## Meow the little agent

Meow can open and close apps for you. Just type a request in the chat, like:

- "open notepad" / "pull up something to write in"
- "open the camera" (Photo Booth on macOS, Camera on Windows)
- "open the calculator", "open the browser", "what time is it?"
- "close notepad", "quit the calculator", "exit terminal"
- "what can you do?" — Meow lists everything it knows

Meow maps each request to the matching app on your OS (for example, TextEdit on macOS or Notepad on Windows). Opening uses `open -a` (macOS) or `start` (Windows); closing quits the app gracefully via AppleScript (macOS) or `taskkill` (Windows). Only a fixed allowlist of common apps can be opened or closed — Meow never runs arbitrary commands.

### Common commands are free and offline

The most frequent "open X" commands are recognized on-device, so they work instantly with **no account and no cost**.

### Optional: natural language via OpenAI

For fuzzier phrasing ("open whatever I use to jot things down"), you can add an OpenAI API key in the **Settings** tab (⚙):

1. Get a key from [platform.openai.com](https://platform.openai.com/api-keys).
2. Open Meow → Settings → paste the key under **OpenAI API key** → **Save**.

The key is stored locally in the app's user-data folder and is used only from the app's main process — it is never sent anywhere except OpenAI. Usage of the OpenAI API is billed by OpenAI (the default `gpt-4o-mini` model is inexpensive). You can turn the whole feature off with the **Let Meow do tasks** toggle.

## Windows compatibility

AI Meow is built for **Windows as a first-class platform**, not macOS-only:

| Feature | Windows behavior |
|---------|------------------|
| Launch scripts | Cross-platform `npm start` / `Start Meow.bat` |
| Transparent window | Enabled with Windows-safe frame settings |
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

### Mac → Windows (or Mac → Mac)

**You cannot send a Mac build to a Windows friend.** Installers are OS-specific:

| You build on | Friend needs | Send them |
|--------------|--------------|-----------|
| **Mac** | Mac | `AI Meow-x.x.x.dmg` from `npm run dist:mac` |
| **Mac** | Windows | ❌ Mac `.dmg` / `.app` will **not** run on Windows |
| **Windows** | Windows | `AI Meow Setup x.x.x.exe` from `npm run dist:win` |
| **Windows** | Mac | ❌ Windows `.exe` will **not** run on Mac |

**Yes — you can build on your device and send the file** (Google Drive, Dropbox, etc.), as long as it matches their OS. Your friend double-clicks the installer; no Node.js required.

**If you only have a Mac but friends use Windows**, you need one of:
- A Windows PC (or VM) to run `npm run dist:win`
- **GitHub Actions** to build Windows automatically on every release (free for public repos)

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

## Chat examples

- "Hi Meow!" — friendly greeting
- "My day was really good!" — happy response
- "I'm feeling stressed" — gentle encouragement
- "I need motivation" — pep talk
- "Tell me something cute" — adorable cat facts

## Project structure

```
Cat-Desktop-Buddy/
├── Start Meow.bat       # Windows one-click launch
├── Start Meow.command   # macOS one-click launch
├── launcher-main.js     # Packaged app: cat picker entry
├── main.js
├── preload.js
├── preload-launcher.js
├── scripts/
│   ├── start.js
│   └── stop.js
├── src/
│   ├── index.html
│   ├── styles.css
│   ├── cat.js
│   ├── chat.js
│   ├── settings.js
│   ├── appearance.js
│   └── personality.js
└── package.json
```

## Tips

- Meow starts in the bottom-right corner of your screen
- Drag empty space around the cat to move the window
- Drag the food bowl to the cat's mouth to feed
- Open chat → **✨ Look** for coat/accessories · **⚙** for Focus Mode & settings

---

Made with 💕 and purrs.

- Developed By Akhansha_Sen with Cursor
