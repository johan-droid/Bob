const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

function runPython(command) {
  const result = spawnSync(command, ['-m', 'backend.pr_health_scanner'], {
    cwd: process.cwd(),
    env: process.env,
    stdio: 'inherit',
  });

  if (result.error && result.error.code === 'ENOENT') {
    return null;
  }

  if (result.error) {
    console.error(`Failed to launch ${command}:`, result.error);
    return 1;
  }

  return result.status ?? 1;
}

const localPython = process.platform === 'win32'
  ? path.join(process.cwd(), '.venv', 'Scripts', 'python.exe')
  : path.join(process.cwd(), '.venv', 'bin', 'python');
const candidates = [
  process.env.PYTHON,
  fs.existsSync(localPython) ? localPython : null,
  process.platform === 'win32' ? 'python' : 'python3',
  process.platform === 'win32' ? 'py' : 'python',
].filter(Boolean);

let status = null;
for (const candidate of candidates) {
  status = runPython(candidate);
  if (status !== null) break;
}

if (status === null) {
  console.error('Python is required to run the PR health scanner.');
  process.exit(1);
}

process.exit(status);
