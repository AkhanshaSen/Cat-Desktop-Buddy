/**
 * Cross-platform stop script — kills AI Meow Electron instances.
 */
const { execSync } = require('child_process');

function run(cmd) {
  try {
    execSync(cmd, { stdio: 'ignore', shell: true });
  } catch {
    /* process may already be gone */
  }
}

if (process.platform === 'win32') {
  run(
    'powershell -NoProfile -Command "' +
      "Get-CimInstance Win32_Process -Filter \\\"Name='electron.exe'\\\" | " +
      "Where-Object { $_.CommandLine -match 'AI Meow|Cat-Desktop-Buddy|ai-meow' } | " +
      'ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }' +
      '"'
  );
} else {
  run("pkill -f 'electron.*AI Meow' 2>/dev/null; pkill -f 'Electron.*AI Meow' 2>/dev/null; pkill -f 'Electron Helper.*AI Meow' 2>/dev/null; true");
}
