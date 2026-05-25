import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendDir = path.join(__dirname, 'backend');
const uvicornArgs = ['-m', 'uvicorn', 'main:app', '--host', '0.0.0.0', '--port', '8000', '--reload'];
const commandCandidates = process.platform === 'win32'
  ? ['python', 'py']
  : ['python3', 'python'];

function runBackend(index = 0) {
  const command = commandCandidates[index];
  if (!command) {
    console.error('Unable to find Python. Start FastAPI manually from the backend directory with `python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload`.');
    process.exit(1);
  }

  console.log(`[start-sonar] Launching FastAPI on http://localhost:8000 via \`${command}\`.`);
  const child = spawn(command, uvicornArgs, {
    cwd: backendDir,
    stdio: 'inherit',
  });

  child.on('error', (error) => {
    if (error.code === 'ENOENT') {
      runBackend(index + 1);
      return;
    }

    console.error(`[start-sonar] Failed to launch FastAPI: ${error.message}`);
    process.exit(1);
  });

  child.on('exit', (code) => {
    process.exit(code ?? 0);
  });
}

runBackend();
