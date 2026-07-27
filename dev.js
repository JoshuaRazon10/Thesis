const { spawn } = require('child_process');
const path = require('path');

function runService(name, dir, command, args) {
  console.log(`Starting ${name}...`);
  // On Windows, npm commands need to run via shell
  const isWindows = process.platform === 'win32';
  const cmd = isWindows ? 'cmd.exe' : command;
  const cmdArgs = isWindows ? ['/c', command, ...args] : args;

  const child = spawn(cmd, cmdArgs, {
    cwd: path.resolve(__dirname, dir),
    stdio: 'pipe'
  });

  child.stdout.on('data', (data) => {
    const lines = data.toString().trim().split('\n');
    lines.forEach(line => {
      if (line) console.log(`[${name}] ${line}`);
    });
  });

  child.stderr.on('data', (data) => {
    const lines = data.toString().trim().split('\n');
    lines.forEach(line => {
      if (line) console.error(`[${name}] ${line}`);
    });
  });

  child.on('close', (code) => {
    console.log(`[${name}] process exited with code ${code}`);
    process.exit(code || 0);
  });

  return child;
}

const backend = runService('Backend', 'backend', 'npm', ['run', 'dev']);
const frontend = runService('Frontend', 'frontend', 'npm', ['run', 'dev']);

// Ensure child processes are killed when the main process is terminated
const cleanup = () => {
  console.log('\nShutting down services...');
  try { backend.kill(); } catch (e) {}
  try { frontend.kill(); } catch (e) {}
  process.exit(0);
};

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
