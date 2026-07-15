# AI Meow 🐱

A floating cute cat desktop buddy for **macOS and Windows**. Meow lives on your screen, makes adorable expressions, and chats with you about your day — motivating you when you need it.

![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Windows-blue)

## Features

- **Full mini cat** — animated SVG with expressions, eye tracking, and 58+ animations
- **Chat dialog** — talk about your day, get motivation, or something cute
- **Look tab** — change coat color and accessories (hat, bow, scarf, flower, glasses)
- **Food system** — drag bowl to feed; choose Plain or Fishy; random like/dislike + 5-min mood
- **Idle life** — laptop, reading, phone, coffee, notebook, gaming, walking, napping
- **Break reminder** — after 2 hours of continuous work, Meow nudges you to rest
- **System tray** — hide/show or quit from the menu bar (macOS) or notification area (Windows)

## Quick start

### macOS & Windows

```bash
# Install dependencies
npm install

# Launch Meow!
npm start

# Stop ALL Meow instances (if cats won't disappear)
npm run stop
```

**Requirements:** Node.js 18+

## How to hide or quit

| Action | Result |
|--------|--------|
| **×** beside cat's ear | Quit AI Meow |
| **Right-click cat** | Hide or Quit menu |
| **Tray icon** | macOS: click to show/hide · Windows: right-click menu · double-click to toggle |
| **`npm run stop`** | Force-kills every running instance |

> **Stuck with an old cat?** Run `npm run stop` once, then `npm start` again.

## Platform notes

| | macOS | Windows |
|---|--------|---------|
| **Tray** | Menu bar (top-right) | Notification area (system tray) |
| **Show/hide** | Click tray icon | Right-click tray → Show/Hide, or double-click tray |
| **Break alert** | Window nudge | Window nudge + taskbar flash |
| **Dock** | Hidden while running | N/A |

## Chat examples

- "Hi Meow!" — friendly greeting
- "My day was really good!" — happy response
- "I'm feeling stressed" — gentle encouragement
- "I need motivation" — pep talk
- "Tell me something cute" — adorable cat facts

## Project structure

```
AI Meow/
├── main.js          # Electron main process (window, tray, drag)
├── preload.js       # Secure bridge to renderer
├── scripts/
│   ├── start.js     # Cross-platform launcher
│   └── stop.js      # Cross-platform stop script
├── src/
│   ├── index.html   # UI layout
│   ├── styles.css   # Cat design + animations
│   ├── cat.js       # Cat behavior & idle loop
│   ├── chat.js      # Chat / Look tabs
│   ├── appearance.js
│   └── personality.js
└── package.json
```

## Tips

- Meow starts in the bottom-right corner of your screen
- Drag empty space around the cat to move the window
- Drag the food bowl to the cat's mouth to feed
- Open chat → **✨ Look** tab to customize appearance

---

Made with 💕 and purrs.
