# AI Meow 🐱

A floating cute cat desktop buddy for **macOS and Windows**. Meow lives on your screen, makes adorable expressions, and chats with you about your day — motivating you when you need it.

![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Windows-blue)

**Repo:** [github.com/AkhanshaSen/Cat-Desktop-Buddy](https://github.com/AkhanshaSen/Cat-Desktop-Buddy)

## Features

- **Full mini cat** — animated SVG with expressions, eye tracking, and 58+ animations
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
├── main.js
├── preload.js
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
