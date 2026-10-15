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

const winReleaseNotes = `# Bedrock v1.2.5 - AI Model Tuning, Sub-Millisecond RAG & Desktop Workstation

This major engineering release decouples Bedrock's domain guardrails, introduces per-model tuning tables to drastically curb randomness and hallucination, embeds a sub-millisecond RAG factual verification engine, and brings full backend API proxying to the native Desktop Workstation.

## Highlights
- **Decoupled Domain Guardrails**: Completely segregated Universal, Coding, Visual Media, Writing, Freelance, and Hackathon synthesis profiles. Visual prompts (Midjourney, FLUX.1, Sora, Runway) are strictly purged of all coding, tech stack, and database contamination.
- **Calibrated Per-Model Tuning Table**: Fine-tuned temperature thresholds (Coding: 0.15–0.20, Freelance: 0.25–0.30, Writing: 0.40–0.45, Visual: 0.65–0.70) with tailored top_p, token budgets, and model-specific system directives across Llama 3.1 8B, Llama 3.3 70B, DeepSeek-R1, Gemini 2.5 Flash, and GPT-4o-mini.
- **Sub-Millisecond RAG Verification Engine**: Integrated low-token (<80 tokens) factual grounding blocks (\`<verified_external_facts>\`) backed by standalone Python semantic verification and dual Node/TypeScript runtime modules. Zero hallucination of deprecated APIs, fake packages, or invalid parameters.
- **Output Quality Validation & Single-Shot Repair Retry**: Automated post-generation AST and lexical analysis catching forbidden terms and invoking a single-shot penalization repair loop before output delivery.
- **Desktop Workstation Backend Proxy & Offline Fallback**: Desktop Electron runtime transparently proxies API generation and telemetry to production serverless infrastructure while seamlessly falling back to client-side tuned LLM dispatch when operating offline.
- **Dual-Account Auto-Updater Sync**: Real-time update discovery, blockmap verification, and background updates synchronized across \`Bedrockxai/Bedrock\` and \`AtharvaK-XD/Bedrock\`.

---

### Downloads
- **Windows Installer**: \`Bedrock-Setup.exe\` (or \`Bedrock-Setup-1.2.5.exe\`)
`;

const macReleaseNotes = `# Bedrock v1.2.5 - macOS Desktop Workstation

Dedicated macOS release for Bedrock Prompt Engineering Workstation.
Native build supporting both Apple Silicon (M1/M2/M3/M4) and Intel Macs with Multi-Target Blueprint Exporters, Interactive Physics Deck, Sub-Millisecond RAG Verification, and Zero-Coding Media Generation.

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

    // 1. Windows Release (v1.2.5)
    let winRelease;
    const winGetRes = await githubFetch(`https://api.github.com/repos/${repo}/releases/tags/v1.2.5`);
    if (winGetRes.ok) {
      winRelease = await winGetRes.json();
      console.log(`Windows Release v1.2.5 exists (ID: ${winRelease.id}).`);
    } else {
      console.log(`Creating Windows release v1.2.5...`);
      const createRes = await githubFetch(`https://api.github.com/repos/${repo}/releases`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tag_name: 'v1.2.5',
          target_commitish: 'main',
          name: 'Bedrock v1.2.5 - Desktop Workstation & AI Model Tuning',
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
      console.log(`Windows release v1.2.5 created successfully (ID: ${winRelease.id}).`);
    }

    const winAssets = [
      { name: 'Bedrock-Setup.exe', path: 'release/Bedrock-Setup.exe', type: 'application/octet-stream' },
      { name: 'Bedrock-Setup-1.2.5.exe', path: 'release/Bedrock-Setup-1.2.5.exe', type: 'application/octet-stream' },
      { name: 'latest.yml', path: 'release/latest.yml', type: 'text/yaml' },
      { name: 'Bedrock-Setup-1.2.5.exe.blockmap', path: 'release/Bedrock-Setup-1.2.5.exe.blockmap', type: 'application/octet-stream' },
    ];

    for (const item of winAssets) {
      await uploadAsset(repo, winRelease.id, item.path, item.name, item.type);
    }

    // 2. macOS Dedicated Release (v1.2.5-mac)
    let macRelease;
    const macGetRes = await githubFetch(`https://api.github.com/repos/${repo}/releases/tags/v1.2.5-mac`);
    if (macGetRes.ok) {
      macRelease = await macGetRes.json();
      console.log(`macOS Release v1.2.5-mac exists (ID: ${macRelease.id}).`);
    } else {
      console.log(`Creating dedicated macOS release v1.2.5-mac...`);
      const createMacRes = await githubFetch(`https://api.github.com/repos/${repo}/releases`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tag_name: 'v1.2.5-mac',
          target_commitish: 'main',
          name: 'Bedrock v1.2.5 - macOS Desktop Workstation',
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
      console.log(`macOS release v1.2.5-mac created successfully (ID: ${macRelease.id}).`);
    }

    const macAssets = [
      { name: 'Bedrock-Mac.dmg', path: 'release/Bedrock-Mac.dmg', type: 'application/octet-stream' },
      { name: 'Bedrock-Mac.zip', path: 'release/Bedrock-Mac.zip', type: 'application/octet-stream' },
    ];

    for (const item of macAssets) {
      await uploadAsset(repo, macRelease.id, item.path, item.name, item.type);
    }

    // 3. Backfill latest.yml to earlier releases for seamless auto-updater
    for (const prevTag of ['v1.2.4', 'v1.2.3', 'v1.2.2', 'v1.2.1']) {
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

  console.log(`\n==> Finished publishing release v1.2.5 to both accounts!`);
}

run().catch((err) => {
  console.error('\n[Error]:', err.message);
  process.exit(1);
});
