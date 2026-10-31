import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const repos = ['AtharvaK-XD/Bedrock', 'Bedrockxai/Bedrock'];

console.log('==> Fetching GitHub credentials...');
const credInput = 'protocol=https\nhost=github.com\n';
const credOutput = execSync('git credential fill', { input: credInput }).toString();
const tokenMatch = credOutput.match(/password=(.*)/);
if (!tokenMatch) {
  throw new Error('Failed to retrieve GitHub token from git credentials.');
}
const token = tokenMatch[1].trim();
const env = { ...process.env, GH_TOKEN: token };

const winReleaseNotes = `# Bedrock v1.4.1 - Desktop Auth Handshake Fix & Session Recovery

This release resolves the external browser authentication loop on desktop workstations, ensuring seamless sign-in with Google and GitHub:

## Highlights

### 🔐 Desktop Authentication Handshake Fix
- **Loopback Handoff Persistence**: Preserves OAuth handshake credentials (nonce, loopback port, and auth strategy) across external provider redirects in dual session and local storage.
- **Automatic Return Resolution**: Resolves the desktop auth loop where external browser redirects stripped URL hash fragments (\`#/browser-auth-callback\`), automatically resuming the handshake when landing on loopback root.
- **Direct Protocol & Loopback Dispatch**: Ensures the desktop app receives the verified Clerk session token immediately via loopback HTTP POST and \`bedrock://auth-complete\` deep links.
- **Desktop Sign-In Ticket Server Ready**: Backed by server-side Clerk sign-in ticket validation for persistent authenticated sessions.

### 🛡️ Enterprise Stability (from v1.4.0)
- Hardware SafeStorage DPAPI encryption for tokens and API keys
- Electron production fuses and sandboxed workflow execution
- Race-proof quota tracking and 503 engine busy retry budgets
- Crash-proof React 19 hook lifecycles and app-wide error boundaries

---

### Downloads (Windows x64)
- **Primary Installer**: \`Bedrock-Setup-1.4.1.exe\` (or \`Bedrock-Setup.exe\`)
- **Direct Installer**: \`Bedrock Setup 1.4.1.exe\`
- **Delta Update Blockmap**: \`latest.yml\` & \`*.blockmap\`
`;

const macReleaseNotes = `# Bedrock v1.4.1 - macOS Desktop Workstation

Dedicated macOS release for Bedrock Prompt Engineering Workstation with external browser sign-in recovery and enterprise security.
Native universal build supporting Apple Silicon (M1/M2/M3/M4) and Intel Macs with hardware Keychain credential security, loopback OAuth handoff resilience, and synchronized prompt engineering workspaces.

### Downloads (macOS Universal)
- **macOS Disk Image (Installer)**: \`Bedrock-Mac.dmg\`
- **macOS Application Archive**: \`Bedrock-Mac.zip\`

---

### First Launch Instructions (Ad-hoc Distribution)
Because this build is distributed directly without a paid Apple developer certificate:
1. Open \`Bedrock-Mac.dmg\` and drag \`Bedrock\` to your \`/Applications\` folder.
2. **Right-click** (or Control-click) \`Bedrock.app\` in Applications and click **Open**.
3. Click **Open** on the confirmation dialog.
*(Or run in Terminal: \`xattr -cr /Applications/Bedrock.app\`)*
`;

function getUploadedAssets(repo, tag, env) {
  try {
    const listJson = execSync(`gh release view ${tag} --repo ${repo} --json assets`, { env, stdio: 'pipe' }).toString();
    const assets = JSON.parse(listJson).assets || [];
    const map = new Map();
    for (const a of assets) {
      map.set(a.name, a.size);
    }
    return map;
  } catch {
    return new Map();
  }
}

async function run() {
  const filesToDuplicate = [
    { src: 'release/Bedrock Setup 1.4.1.exe', dest: 'release/Bedrock-Setup-1.4.1.exe' },
    { src: 'release/Bedrock Setup 1.4.1.exe', dest: 'release/Bedrock-Setup.exe' },
    { src: 'release/Bedrock Setup 1.4.1.exe.blockmap', dest: 'release/Bedrock-Setup-1.4.1.exe.blockmap' },
    { src: 'release/Bedrock Setup 1.4.1.exe.blockmap', dest: 'release/Bedrock-Setup.exe.blockmap' },
  ];

  for (const { src, dest } of filesToDuplicate) {
    if (fs.existsSync(src)) {
      console.log(`Copying ${src} -> ${dest}`);
      fs.copyFileSync(src, dest);
    }
  }

  for (const repo of repos) {
    console.log(`\n========================================================`);
    console.log(`==> Processing releases for repository: ${repo}`);
    console.log(`========================================================`);

    // 1. Create or update Windows release v1.4.1
    let winExists = false;
    try {
      execSync(`gh release view v1.4.1 --repo ${repo}`, { env, stdio: 'pipe' });
      winExists = true;
    } catch {}

    if (winExists) {
      console.log(`Windows release v1.4.1 exists on ${repo}. Updating metadata...`);
      execSync(`gh release edit v1.4.1 --repo ${repo} --title "Bedrock v1.4.1 - Desktop Auth Handshake Fix & Session Recovery" --notes-file - --latest`, {
        env,
        input: winReleaseNotes,
        stdio: ['pipe', 'inherit', 'inherit']
      });
    } else {
      console.log(`Creating Windows release v1.4.1 on ${repo}...`);
      execSync(`gh release create v1.4.1 --repo ${repo} --title "Bedrock v1.4.1 - Desktop Auth Handshake Fix & Session Recovery" --notes-file - --latest`, {
        env,
        input: winReleaseNotes,
        stdio: ['pipe', 'inherit', 'inherit']
      });
    }

    // Upload Windows assets
    console.log(`Uploading Windows assets to ${repo} v1.4.1...`);
    const uploadedWin = getUploadedAssets(repo, 'v1.4.1', env);
    const winAssets = [
      'release/Bedrock-Setup-1.4.1.exe',
      'release/Bedrock-Setup.exe',
      'release/latest.yml',
      'release/Bedrock-Setup-1.4.1.exe.blockmap'
    ];
    for (const asset of winAssets) {
      if (fs.existsSync(asset)) {
        const basename = path.basename(asset);
        const localSize = fs.statSync(asset).size;
        const remoteSize = uploadedWin.get(basename);
        if (remoteSize === localSize) {
          console.log(`  ==> ${basename} already uploaded (${(localSize / (1024 * 1024)).toFixed(2)} MB), skipping.`);
          continue;
        }
        console.log(`  ==> Uploading ${asset} (${(localSize / (1024 * 1024)).toFixed(2)} MB)...`);
        execSync(`gh release upload v1.4.1 "${asset}" --repo ${repo} --clobber`, { env, stdio: 'inherit' });
      }
    }

    // 2. Create or update macOS release v1.4.1-mac
    let macExists = false;
    try {
      execSync(`gh release view v1.4.1-mac --repo ${repo}`, { env, stdio: 'pipe' });
      macExists = true;
    } catch {}

    if (macExists) {
      console.log(`macOS release v1.4.1-mac exists on ${repo}. Updating metadata...`);
      execSync(`gh release edit v1.4.1-mac --repo ${repo} --title "Bedrock v1.4.1 - macOS Desktop Workstation" --notes-file -`, {
        env,
        input: macReleaseNotes,
        stdio: ['pipe', 'inherit', 'inherit']
      });
    } else {
      console.log(`Creating macOS release v1.4.1-mac on ${repo}...`);
      execSync(`gh release create v1.4.1-mac --repo ${repo} --title "Bedrock v1.4.1 - macOS Desktop Workstation" --notes-file -`, {
        env,
        input: macReleaseNotes,
        stdio: ['pipe', 'inherit', 'inherit']
      });
    }

    // Upload macOS assets
    console.log(`Uploading macOS assets to ${repo} v1.4.1-mac...`);
    const uploadedMac = getUploadedAssets(repo, 'v1.4.1-mac', env);
    const macAssets = [
      'release/Bedrock-Mac.dmg',
      'release/Bedrock-Mac.zip'
    ];
    for (const asset of macAssets) {
      if (fs.existsSync(asset)) {
        const basename = path.basename(asset);
        const localSize = fs.statSync(asset).size;
        const remoteSize = uploadedMac.get(basename);
        if (remoteSize === localSize) {
          console.log(`  ==> ${basename} already uploaded (${(localSize / (1024 * 1024)).toFixed(2)} MB), skipping.`);
          continue;
        }
        console.log(`  ==> Uploading ${asset} (${(localSize / (1024 * 1024)).toFixed(2)} MB)...`);
        execSync(`gh release upload v1.4.1-mac "${asset}" --repo ${repo} --clobber`, { env, stdio: 'inherit' });
      }
    }

    // 3. Backfill latest.yml to earlier tags
    for (const prevTag of ['v1.4.0', 'v1.3.1', 'v1.3.0', 'v1.2.5', 'v1.2.4', 'v1.2.3', 'v1.2.2', 'v1.2.1']) {
      try {
        execSync(`gh release upload ${prevTag} "release/latest.yml" --repo ${repo} --clobber`, { env, stdio: 'pipe' });
        console.log(`  Backfilled latest.yml to ${prevTag} on ${repo}`);
      } catch {}
    }

    // Print release assets
    const listJson = execSync(`gh release view v1.4.1 --repo ${repo} --json assets`, { env }).toString();
    const assets = JSON.parse(listJson).assets || [];
    console.log(`\nVerified latest Windows release v1.4.1 on ${repo}:`);
    for (const a of assets) {
      console.log(`  - ${a.name} (${(a.size / (1024 * 1024)).toFixed(2)} MB)`);
    }

    const macListJson = execSync(`gh release view v1.4.1-mac --repo ${repo} --json assets`, { env }).toString();
    const macAssetsList = JSON.parse(macListJson).assets || [];
    console.log(`\nVerified latest macOS release v1.4.1-mac on ${repo}:`);
    for (const a of macAssetsList) {
      console.log(`  - ${a.name} (${(a.size / (1024 * 1024)).toFixed(2)} MB)`);
    }
  }

  console.log(`\n==> Finished publishing release v1.4.1 and v1.4.1-mac to both accounts!`);
}

run().catch((err) => {
  console.error('\n[Error]:', err.message);
  process.exit(1);
});
