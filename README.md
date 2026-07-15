# AI Meow 🐱

A floating cute cat desktop buddy for macOS. Meow lives on your screen, makes adorable expressions, and chats with you about your day — motivating you when you need it.

![AI Meow](https://img.shields.io/badge/platform-macOS-blue)

## Features

- **Full mini cat** — head, body, belly, four paws, and a wagging tail
- **Living animations** — idle breathing, tail wag, stretch, kneading, and sleep with floating zzz
- **Click to wake** — tap a sleeping Meow to wake them up
- **Draggable** — grab Meow and place anywhere on screen
- **Cute expressions** — happy, love eyes, excited, thinking, sleepy, surprised
- **Chat dialog** — click Meow to open a chat panel and talk about your day
- **Quick actions** — one-tap buttons for "My day", "Motivate me", and "Something cute"
- **Idle personality** — random purrs and quips when you're working
- **Break reminder** — after 2 hours of continuous work (mouse/keyboard activity), Meow nudges you to rest with cute animations
- **System tray** — hide/show or quit from the menu bar

## Quick start

```bash
# Install dependencies
npm install

# Launch Meow!
npm start

# Stop ALL Meow instances (use this if cats won't disappear)
npm run stop
```

## How to hide or quit

| Action | Result |
|--------|--------|
| **Hide** button (above cat) | Hides Meow — still running in menu bar |
| **Quit** button (above cat) | Fully closes AI Meow |
| **Right-click cat** | Hide or Quit menu |
| **Menu bar pink dot** | Click to show/hide · right-click for Quit |
| **`npm run stop`** | Force-kills every running instance |

> **Stuck with an old cat?** Each time you ran `npm start` without quitting, a **new** cat window opened. The old one stays until you quit it. Run `npm run stop` once to clear them all, then `npm start` again.

## Chat examples

Try saying things like:

- "Hi Meow!" — friendly greeting
- "My day was really good!" — happy response with excited expression
- "I'm feeling stressed" — supportive, gentle encouragement
- "I need motivation" — pep talk from your cat buddy
- "Tell me something cute" — adorable cat facts and love

## Project structure

```
AI Meow/
├── main.js          # Electron main process (window, tray, drag)
├── preload.js       # Secure bridge to renderer
├── src/
│   ├── index.html   # UI layout
│   ├── styles.css   # Cat design + animations
│   ├── cat.js       # Expressions, blinking, dragging
│   ├── chat.js      # Chat panel logic
│   └── personality.js  # Meow's brain & responses
└── package.json
```

## Requirements

- Node.js 18+
- macOS (works best; Electron supports Windows/Linux too)

## Tips

- Meow starts in the bottom-right corner of your screen
- The window is click-through except on the cat and chat panel
- Use the menu bar icon if Meow gets in the way — hide and show anytime

---

Made with 💕 and purrs.
