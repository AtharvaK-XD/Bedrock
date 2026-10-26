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

const headers = {
  Authorization: `Bearer ${token}`,
  'User-Agent': 'Bedrock-Publisher',
  Accept: 'application/vnd.github.v3+json',
};

async function githubFetch(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: {
      ...headers,
      ...(options.headers || {}),
    },
  });
  return res;
}

const winReleaseNotes = `# Bedrock v1.3.1 - Desktop Workstation & Cloud Synchronization Engine

This major release upgrades Bedrock Desktop Workstation with full cloud-state synchronization, Bring-Your-Own-Key (BYOK) per-model enforcement, GitHub release update monitoring, and unified UI styling.

## Highlights
- **Cloud & Account Synchronization**: Seamless two-way data syncing between Bedrock Web and Desktop. When you sign in with your Google account, your active subscription plan (e.g. Ultimate Plan), usage limits, and prompt history immediately sync across web and desktop without downloading the app again or signing in repeatedly.
- **Strict Per-Model BYOK Key Enforcement**: In the desktop app, every model and agent provider requires your own API key. If a model's key hasn't been added, an immediate guided modal prompts you to enter the API key directly or open Settings.
- **Transparent Model Logos**: Removed legacy bounding boxes around model badges in the app, matching the clean aesthetic of the web app.
- **GitHub Release Update Detection**: Integrated update notification banner in the top-right corner that checks GitHub releases and notifies you when a newer version is available.
- **Unified Workstation Settings**: Synchronized 8-tab settings suite with model parameters, token budgets, appearance tokens, local vault controls, and app update management.
- **Preserved Desktop Workstation Layout**: Desktop app retains its high-efficiency left-hand Sidebar with global ⌘1–⌘6 shortcuts, while the website retains its floating Topbar navigation island.

---

### Downloads
- **Windows Installer**: \`Bedrock-Setup-1.3.1.exe\` (or \`Bedrock-Setup.exe\`)
`;

const macReleaseNotes = `# Bedrock v1.3.1 - macOS Desktop Workstation

Dedicated macOS release for Bedrock Prompt Engineering Workstation.
Native universal build supporting Apple Silicon (M1/M2/M3/M4) and Intel Macs with two-way Cloud Data Sync, Bring-Your-Own-Key (BYOK) Model Security, Multi-Target Blueprint Exporters, and DAG Branching Canvas.

### Downloads
- **macOS Disk Image (Installer)**: \`Bedrock-Mac.dmg\`
- **macOS Application Archive**: \`Bedrock-Mac.zip\`

---

### First Launch Instructions (Ad-hoc Unsigned Build)
Because this build is distributed directly without a paid Apple certificate:
1. Open \`Bedrock-Mac.dmg\` and drag \`Bedrock\` to your \`/Applications\` folder.
2. **Right-click** (or Control-click) \`Bedrock.app\` in Applications and click **Open**.
3. Click **Open** on the confirmation prompt.
*(Or in Terminal, run: \`xattr -cr /Applications/Bedrock.app\`)*
`;

async function uploadAsset(repo, releaseId, filePath, assetName, contentType) {
  if (!fs.existsSync(filePath)) {
    console.warn(`  [Warning] Asset not found at ${filePath}, skipping.`);
    return;
  }

  // Check if asset already exists (GitHub replaces spaces with dots in filenames)
  const relRes = await githubFetch(`https://api.github.com/repos/${repo}/releases/${releaseId}`);
  const releaseData = await relRes.json();
  const normalize = (s) => (s || '').replace(/\s+/g, '.').toLowerCase();
  if (releaseData.assets) {
    for (const existing of releaseData.assets) {
      if (existing.name === assetName || normalize(existing.name) === normalize(assetName)) {
        console.log(`  Deleting existing asset ${existing.name} (ID: ${existing.id})...`);
        await githubFetch(`https://api.github.com/repos/${repo}/releases/assets/${existing.id}`, {
          method: 'DELETE',
        });
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
  }

  const fileStats = fs.statSync(filePath);
  const sizeMB = (fileStats.size / (1024 * 1024)).toFixed(2);
  console.log(`  ==> Uploading ${assetName} (${sizeMB} MB)...`);

  const fileData = fs.readFileSync(filePath);
  const uploadUrl = `https://uploads.github.com/repos/${repo}/releases/${releaseId}/assets?name=${encodeURIComponent(assetName)}`;

  const uploadRes = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': contentType,
      'Content-Length': fileStats.size.toString(),
      'User-Agent': 'Bedrock-Publisher',
      Accept: 'application/vnd.github.v3+json',
    },
    body: fileData,
  });

  if (!uploadRes.ok) {
    const errText = await uploadRes.text();
    throw new Error(`Failed to upload ${assetName}: ${uploadRes.status} ${errText}`);
  }
  console.log(`      ✓ ${assetName} uploaded successfully.`);
}

async function run() {
  // Normalize filenames in release directory
  const filesToDuplicate = [
    { src: 'release/Bedrock Setup 1.3.1.exe', dest: 'release/Bedrock-Setup-1.3.1.exe' },
    { src: 'release/Bedrock Setup 1.3.1.exe', dest: 'release/Bedrock-Setup.exe' },
    { src: 'release/Bedrock Setup 1.3.1.exe.blockmap', dest: 'release/Bedrock-Setup-1.3.1.exe.blockmap' },
    { src: 'release/Bedrock Setup 1.3.1.exe.blockmap', dest: 'release/Bedrock-Setup.exe.blockmap' },
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

    // 1. Windows Release (v1.3.1)
    let winRelease;
    const winGetRes = await githubFetch(`https://api.github.com/repos/${repo}/releases/tags/v1.3.1`);
    if (winGetRes.ok) {
      winRelease = await winGetRes.json();
      console.log(`Windows Release v1.3.1 exists (ID: ${winRelease.id}). Updating details...`);
      await githubFetch(`https://api.github.com/repos/${repo}/releases/${winRelease.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Bedrock v1.3.1 - Desktop Workstation & Cloud Synchronization',
          body: winReleaseNotes,
          make_latest: 'true',
        }),
      });
    } else {
      console.log(`Creating Windows release v1.3.1...`);
      const createRes = await githubFetch(`https://api.github.com/repos/${repo}/releases`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tag_name: 'v1.3.1',
          target_commitish: 'main',
          name: 'Bedrock v1.3.1 - Desktop Workstation & Cloud Synchronization',
          body: winReleaseNotes,
          draft: false,
          prerelease: false,
          make_latest: 'true',
        }),
      });

      if (!createRes.ok) {
        const err = await createRes.text();
        throw new Error(`Failed to create Windows release: ${createRes.status} ${err}`);
      }
      winRelease = await createRes.json();
      console.log(`Windows release v1.3.1 created successfully (ID: ${winRelease.id}).`);
    }

    const winAssets = [
      { name: 'Bedrock-Setup.exe', path: 'release/Bedrock-Setup.exe', type: 'application/octet-stream' },
      { name: 'Bedrock-Setup-1.3.1.exe', path: 'release/Bedrock-Setup-1.3.1.exe', type: 'application/octet-stream' },
      { name: 'Bedrock Setup 1.3.1.exe', path: 'release/Bedrock Setup 1.3.1.exe', type: 'application/octet-stream' },
      { name: 'latest.yml', path: 'release/latest.yml', type: 'text/yaml' },
      { name: 'Bedrock-Setup-1.3.1.exe.blockmap', path: 'release/Bedrock-Setup-1.3.1.exe.blockmap', type: 'application/octet-stream' },
      { name: 'Bedrock Setup 1.3.1.exe.blockmap', path: 'release/Bedrock Setup 1.3.1.exe.blockmap', type: 'application/octet-stream' },
    ];

    for (const item of winAssets) {
      await uploadAsset(repo, winRelease.id, item.path, item.name, item.type);
    }

    // 2. macOS Dedicated Release (v1.3.1-mac)
    let macRelease;
    const macGetRes = await githubFetch(`https://api.github.com/repos/${repo}/releases/tags/v1.3.1-mac`);
    if (macGetRes.ok) {
      macRelease = await macGetRes.json();
      console.log(`macOS Release v1.3.1-mac exists (ID: ${macRelease.id}). Updating details...`);
      await githubFetch(`https://api.github.com/repos/${repo}/releases/${macRelease.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Bedrock v1.3.1 - macOS Desktop Workstation',
          body: macReleaseNotes,
          make_latest: 'false',
        }),
      });
    } else {
      console.log(`Creating dedicated macOS release v1.3.1-mac...`);
      const createMacRes = await githubFetch(`https://api.github.com/repos/${repo}/releases`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tag_name: 'v1.3.1-mac',
          target_commitish: 'main',
          name: 'Bedrock v1.3.1 - macOS Desktop Workstation',
          body: macReleaseNotes,
          draft: false,
          prerelease: false,
          make_latest: 'false',
        }),
      });

      if (!createMacRes.ok) {
        const err = await createMacRes.text();
        throw new Error(`Failed to create macOS release: ${createMacRes.status} ${err}`);
      }
      macRelease = await createMacRes.json();
      console.log(`macOS release v1.3.1-mac created successfully (ID: ${macRelease.id}).`);
    }

    const macAssets = [
      { name: 'Bedrock-Mac.dmg', path: 'release/Bedrock-Mac.dmg', type: 'application/octet-stream' },
      { name: 'Bedrock-Mac.zip', path: 'release/Bedrock-Mac.zip', type: 'application/octet-stream' },
    ];

    for (const item of macAssets) {
      await uploadAsset(repo, macRelease.id, item.path, item.name, item.type);
    }

    // 3. Backfill latest.yml to earlier releases for seamless auto-updater detection
    for (const prevTag of ['v1.3.0', 'v1.2.5', 'v1.2.4', 'v1.2.3', 'v1.2.2', 'v1.2.1']) {
      try {
        const prevRes = await githubFetch(`https://api.github.com/repos/${repo}/releases/tags/${prevTag}`);
        if (prevRes.ok) {
          const prevRelease = await prevRes.json();
          console.log(`Ensuring latest.yml exists on ${prevTag} for auto-updater migration...`);
          await uploadAsset(repo, prevRelease.id, 'release/latest.yml', 'latest.yml', 'text/yaml');
        }
      } catch (err) {
        console.warn(`Could not backfill ${prevTag} on ${repo} (${err.message})`);
      }
    }

    // Verify latest release
    const latestRes = await githubFetch(`https://api.github.com/repos/${repo}/releases/latest`);
    if (latestRes.ok) {
      const latest = await latestRes.json();
      console.log(`\nVerified latest release on ${repo}: ${latest.tag_name} (${latest.name})`);
      for (const a of latest.assets || []) {
        console.log(`  - ${a.name} (${(a.size / (1024 * 1024)).toFixed(2)} MB)`);
      }
    }
  }

  console.log(`\n==> Finished publishing release v1.3.1 to both accounts!`);
}

run().catch((err) => {
  console.error('\n[Error]:', err.message);
  process.exit(1);
});
