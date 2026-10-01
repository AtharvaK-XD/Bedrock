import { spawnSync, execSync } from 'child_process';
import { existsSync } from 'fs';
import path from 'path';

function findK6Binary() {
  // 1. Try standard command in PATH
  try {
    execSync('k6 version', { stdio: 'ignore' });
    return 'k6';
  } catch {
    // Continue
  }

  // 2. Check standard Windows installation paths
  const standardPaths = [
    'C:\\Program Files\\k6\\k6.exe',
    'C:\\Program Files (x86)\\k6\\k6.exe',
    path.join(process.env.LOCALAPPDATA || '', 'Programs', 'k6', 'k6.exe'),
  ];

  for (const p of standardPaths) {
    if (existsSync(p)) {
      return `"${p}"`;
    }
  }

  throw new Error('k6 executable not found. Please install k6 or restart your terminal.');
}

const args = process.argv.slice(2);
const k6Bin = findK6Binary();

console.log(`🚀 [k6 Runner] Executing: ${k6Bin} ${args.join(' ')}`);

const result = spawnSync(k6Bin, args, {
  stdio: 'inherit',
  shell: true,
});

process.exit(result.status ?? 0);
