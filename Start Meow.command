#!/bin/bash
cd "$(dirname "$0")"

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is required. Install from https://nodejs.org then try again."
  read -r -p "Press Enter to close..."
  exit 1
fi

if [ ! -d "node_modules/electron" ]; then
  echo "Installing dependencies (first run only)..."
  npm install || {
    echo "Install failed."
    read -r -p "Press Enter to close..."
    exit 1
  }
fi

echo "Starting AI Meow..."
npm start
