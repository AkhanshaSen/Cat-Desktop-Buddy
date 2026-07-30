/**
 * Launch Cat 2 (transparent video clips variant).
 */
const { spawn } = require('child_process');
const path = require('path');

const electronPath = require('electron');
const env = { ...process.env, MEOW_VARIANT: 'cat2' };
delete env.ELECTRON_RUN_AS_NODE;

const child = spawn(electronPath, [path.join(__dirname, '..'), '--cat2'], {
  stdio: 'inherit',
  env,
  shell: process.platform === 'win32',
});

child.on('close', (code) => process.exit(code ?? 0));
