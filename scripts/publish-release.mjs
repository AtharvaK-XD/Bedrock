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

const winReleaseNotes = `# Bedrock v1.2.4 Desktop Workstation

This release restores the dedicated Desktop Workstation Sidebar navigation layout with instant ⌘1–⌘6 workspace switching, introduces strict Zero-Coding / Zero-Tech-Stack Image & Video Generation synthesis directives, and refreshes the unified Landing Page.

## Highlights
- **Dedicated Desktop Sidebar Layout**: Restored native desktop \`Sidebar\` navigation for the Electron workstation app with instant ⌘1–⌘6 global shortcuts, live API key status indicator, and full-height viewports, while preserving the floating Aceternity \`Topbar\` for the web application.
- **Image & Video Generation Archetypes**: Added Image Generation (\`IMG\`) and Video Generation (\`VIDEO\`) targets to the Prompt Wizard with strict anti-hallucination guardrails and zero-coding directives for Midjourney v6.1, FLUX.1, DALL-E 3, SDXL, Runway Gen-3 Alpha, Sora, and Luma Dream Machine.
- **Landing Page Refresh**: Updated copy highlighting all 10 AI frontier providers, visual DAG branching canvas, tactile physics deck with 5% to 300% zoom, and 15 multi-target code & config exporters.
- **10 Frontier AI Providers**: Full multi-model support across Claude 3.7 Sonnet, OpenAI GPT-4o, Gemini 2.5 Flash, DeepSeek-R1, Meta LLaMA 3.3, Mistral Large, Cohere Command R+, Microsoft Copilot, Nvidia, and Hugging Face with authentic transparent brand assets.
- **Auto-Updater Synchronization**: Native \`latest.yml\` manifests and SHA-512 blockmaps for background update verification and one-click upgrades.

---

### Downloads
- **Windows Installer**: \`Bedrock-Setup.exe\` (or \`Bedrock-Setup-1.2.4.exe\`)
`;

const macReleaseNotes = `# Bedrock v1.2.4 - macOS Desktop Workstation

Dedicated macOS release for Bedrock Prompt Engineering Workstation.
Native build supporting both Apple Silicon (M1/M2/M3/M4) and Intel Macs with Multi-Target Blueprint Exporters, Interactive Physics Deck, and Zero-Coding Media Generation.

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

  // Check if asset already exists
  const relRes = await githubFetch(`https://api.github.com/repos/${repo}/releases/${releaseId}`);
  const releaseData = await relRes.json();
  if (releaseData.assets) {
    for (const existing of releaseData.assets) {
      if (existing.name === assetName) {
        console.log(`  Deleting existing asset ${assetName} (ID: ${existing.id})...`);
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
  for (const repo of repos) {
    console.log(`\n========================================================`);
    console.log(`==> Processing releases for repository: ${repo}`);
    console.log(`========================================================`);

    // 1. Windows Release (v1.2.4)
    let winRelease;
    const winGetRes = await githubFetch(`https://api.github.com/repos/${repo}/releases/tags/v1.2.4`);
    if (winGetRes.ok) {
      winRelease = await winGetRes.json();
      console.log(`Windows Release v1.2.4 exists (ID: ${winRelease.id}).`);
    } else {
      console.log(`Creating Windows release v1.2.4...`);
      const createRes = await githubFetch(`https://api.github.com/repos/${repo}/releases`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tag_name: 'v1.2.4',
          target_commitish: 'main',
          name: 'Bedrock v1.2.4 - Desktop Workstation',
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
      console.log(`Windows release v1.2.4 created successfully (ID: ${winRelease.id}).`);
    }

    const winAssets = [
      { name: 'Bedrock-Setup.exe', path: 'release/Bedrock-Setup.exe', type: 'application/octet-stream' },
      { name: 'Bedrock-Setup-1.2.4.exe', path: 'release/Bedrock-Setup-1.2.4.exe', type: 'application/octet-stream' },
      { name: 'latest.yml', path: 'release/latest.yml', type: 'text/yaml' },
      { name: 'Bedrock-Setup-1.2.4.exe.blockmap', path: 'release/Bedrock-Setup-1.2.4.exe.blockmap', type: 'application/octet-stream' },
    ];

    for (const item of winAssets) {
      await uploadAsset(repo, winRelease.id, item.path, item.name, item.type);
    }

    // 2. macOS Dedicated Release (v1.2.4-mac)
    let macRelease;
    const macGetRes = await githubFetch(`https://api.github.com/repos/${repo}/releases/tags/v1.2.4-mac`);
    if (macGetRes.ok) {
      macRelease = await macGetRes.json();
      console.log(`macOS Release v1.2.4-mac exists (ID: ${macRelease.id}).`);
    } else {
      console.log(`Creating dedicated macOS release v1.2.4-mac...`);
      const createMacRes = await githubFetch(`https://api.github.com/repos/${repo}/releases`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tag_name: 'v1.2.4-mac',
          target_commitish: 'main',
          name: 'Bedrock v1.2.4 - macOS Desktop Workstation',
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
      console.log(`macOS release v1.2.4-mac created successfully (ID: ${macRelease.id}).`);
    }

    const macAssets = [
      { name: 'Bedrock-Mac.dmg', path: 'release/Bedrock-Mac.dmg', type: 'application/octet-stream' },
      { name: 'Bedrock-Mac.zip', path: 'release/Bedrock-Mac.zip', type: 'application/octet-stream' },
    ];

    for (const item of macAssets) {
      await uploadAsset(repo, macRelease.id, item.path, item.name, item.type);
    }

    // 3. Backfill latest.yml to earlier releases for seamless auto-updater
    for (const prevTag of ['v1.2.3', 'v1.2.2', 'v1.2.1']) {
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

  console.log(`\n==> Finished publishing release v1.2.4 to both accounts!`);
}

run().catch((err) => {
  console.error('\n[Error]:', err.message);
  process.exit(1);
});
