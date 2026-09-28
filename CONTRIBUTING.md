# Contributing to Bedrock

Thank you for your interest in contributing to Bedrock! As an open-source prompt engineering workstation and orchestration platform, we welcome contributions ranging from bug fixes and documentation to new features and execution graph nodes.

---

## Code of Conduct

We are committed to providing a friendly, safe, and welcoming environment for all contributors. Please treat everyone with respect, give constructive feedback, and maintain professional communication across issues, discussions, and pull requests.

---

## Development Setup

### 1. Prerequisites
- **Node.js**: `v20.x` or later
- **npm**: `v10.x` or later
- **Git**

### 2. Fork and Clone
Fork the repository to your own GitHub account, then clone it locally:

```bash
git clone https://github.com/<your-username>/Bedrock.git
cd Bedrock
```

Add the official repository as `upstream`:
```bash
git remote add upstream https://github.com/Bedrockxai/Bedrock.git
```

### 3. Install Dependencies
```bash
npm install
```

If you plan to work on backend server components:
```bash
cd server
npm install
cd ..
```

### 4. Environment Variables
Copy the example environment configuration:
```bash
cp .env.example .env
```
Populate any local API keys (Gemini, Groq, OpenAI, Clerk) needed for testing. **Never commit real keys or secrets.**

### 5. Running Bedrock Locally
Start the frontend development server:
```bash
npm run dev
```

---

## Git Workflow & Branch Instructions

To prevent merge conflicts and maintain a clean git history, please follow these guidelines:

### 1. Create a Descriptive Branch
Always branch off the latest `upstream/main`:
```bash
git checkout main
git fetch upstream
git rebase upstream/main
git checkout -b <type>/<short-description>
```

Branch naming conventions:
- `feat/add-groq-model-benchmark` (New feature)
- `fix/api-key-modal-overflow` (Bug fix)
- `perf/graph-rendering-fps` (Performance optimization)
- `docs/clarify-installation-steps` (Documentation)
- `refactor/clean-up-auth-hooks` (Code cleanup)

### 2. Commit Message Guidelines
We follow standard Conventional Commits:
```bash
git commit -m "feat(generator): add support for Claude 3.5 Sonnet temperature slider"
git commit -m "fix(desktop): resolve electron window resize flicker on Windows"
```

### 3. Pre-PR Quality Checks (Mandatory)
Before opening a Pull Request, ensure all automated verification scripts pass locally:

```bash
# 1. Verify no API keys, tokens, or credentials are leaked
npm run scan:secrets

# 2. Run linter
npm run lint

# 3. Verify TypeScript compiles without errors
npm run build
```

---

## Keeping Your Branch in Sync & Resolving Conflicts

If `main` has advanced while you were working on your feature:

```bash
# Fetch latest commits from upstream
git fetch upstream main

# Rebase your feature branch on top of upstream main
git rebase upstream/main

# If conflicts occur, resolve them in your editor, stage them, and continue:
git add <conflicted-file>
git rebase --continue

# Push the rebased commits to your fork
git push origin <your-branch-name> --force-with-lease
```

---

## Submitting a Pull Request

1. Push your branch to your GitHub fork:
   ```bash
   git push origin feat/your-feature-name
   ```
2. Open a Pull Request against `Bedrockxai:main`.
3. Complete the Pull Request template checklist.
4. An automated CI/CD workflow will run to validate your code (`scan:secrets`, `lint`, and `build`).
5. A maintainer will review your pull request.

---

## Security Vulnerabilities

If you discover a sensitive security vulnerability or credential leak, please **do not open a public issue**. Instead, report it privately to the maintainers at `bedrockofficialpage@gmail.com`.
