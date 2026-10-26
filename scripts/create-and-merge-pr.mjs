import { execSync } from 'child_process';

const repos = ['AtharvaK-XD/Bedrock', 'Bedrockxai/Bedrock'];

console.log('==> Fetching GitHub credentials for PR automation...');
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
  'Content-Type': 'application/json',
};

async function createAndMergePR(repo) {
  console.log(`\n========================================================`);
  console.log(`==> Processing PR for repository: ${repo}`);
  console.log(`========================================================`);

  // 1. Create Pull Request from testing into main
  const prTitle = 'Release v1.3.1: Desktop Cloud Sync, Per-Model BYOK Enforcer & Borderless Badges';
  const prBody = `## Bedrock v1.3.1 Release

### Highlights:
- **Two-Way Cloud & Account State Synchronization**: Signing in with Google on Desktop immediately syncs active subscription tier (e.g. Ultimate Plan), token limits, and prompt history between Web and Desktop without re-downloading or re-authenticating.
- **Strict Per-Model BYOK Enforcer**: In desktop workstation, models strictly require user-added API keys. Unconfigured models trigger a contextual \`ApiKeyPromptModal\` directly upon selection.
- **Transparent Model Logos**: Removed legacy rectangular boxes around model badges in the app, matching the clean web aesthetic.
- **In-App GitHub Release Update Checker**: Top-right update banner queries GitHub releases across both repos and notifies the developer when a newer version is released.
- **Synchronized 8-Tab Workstation Settings**: Updated Desktop App Settings page to the full 8-tab preference workstation.
- **Layout Invariant**: Desktop strictly maintains dedicated left-hand \`Sidebar.tsx\`; Website strictly maintains floating Aceternity \`Topbar.tsx\`.
`;

  console.log(`Creating Pull Request on ${repo} (head: testing, base: main)...`);
  const prRes = await fetch(`https://api.github.com/repos/${repo}/pulls`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      title: prTitle,
      head: 'testing',
      base: 'main',
      body: prBody,
    }),
  });

  let prData;
  if (prRes.ok) {
    prData = await prRes.json();
    console.log(`✓ Pull Request #${prData.number} created successfully: ${prData.html_url}`);
  } else {
    const errText = await prRes.text();
    // Check if PR already exists
    if (errText.includes('A pull request already exists')) {
      console.log(`PR already exists for ${repo}, fetching open PRs...`);
      const listRes = await fetch(`https://api.github.com/repos/${repo}/pulls?head=${repo.split('/')[0]}:testing&base=main`, { headers });
      const prs = await listRes.json();
      if (prs && prs.length > 0) {
        prData = prs[0];
        console.log(`Found existing open PR #${prData.number}: ${prData.html_url}`);
      } else {
        throw new Error(`PR exists but could not be located on ${repo}: ${errText}`);
      }
    } else {
      throw new Error(`Failed to create PR on ${repo}: ${prRes.status} ${errText}`);
    }
  }

  // 2. Merge Pull Request into main
  console.log(`Merging Pull Request #${prData.number} into main on ${repo}...`);
  const mergeRes = await fetch(`https://api.github.com/repos/${repo}/pulls/${prData.number}/merge`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({
      commit_title: `Merge pull request #${prData.number} from testing (v1.3.1)`,
      commit_message: prTitle,
      merge_method: 'merge',
    }),
  });

  if (mergeRes.ok) {
    const mergeData = await mergeRes.json();
    console.log(`✓ Pull Request #${prData.number} successfully merged! (SHA: ${mergeData.sha})`);
  } else {
    const mergeErr = await mergeRes.text();
    throw new Error(`Failed to merge PR #${prData.number} on ${repo}: ${mergeRes.status} ${mergeErr}`);
  }
}

async function run() {
  for (const repo of repos) {
    await createAndMergePR(repo);
  }
  console.log('\n==> All Pull Requests successfully created and merged on both accounts!');
}

run().catch((err) => {
  console.error('\n[Error]:', err.message);
  process.exit(1);
});
