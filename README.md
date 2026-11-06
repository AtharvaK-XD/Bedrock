# Bedrock

<div align="center">

![Bedrock Workstation Banner](public/screenshots/hero-preview.png)

**The Universal AI Orchestration & Prompt Engineering Workstation**

*Synthesize, refine, branch, benchmark, and ship production-grade system prompts across frontier LLMs and air-gapped local runtimes.*

[![Version](https://img.shields.io/badge/version-1.4.6-2C9A8B.svg?style=flat-square)](https://github.com/Bedrockxai/Bedrock/releases/tag/v1.4.6)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20Web-blueviolet.svg?style=flat-square)](https://bedrockxai.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue.svg?style=flat-square)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19.0-61dafb.svg?style=flat-square)](https://react.dev/)
[![Electron](https://img.shields.io/badge/Electron-43.3-47848F.svg?style=flat-square)](https://www.electronjs.org/)
[![Database](https://img.shields.io/badge/Database-Neon%20Postgres-00E599.svg?style=flat-square)](https://neon.tech/)
[![Security](https://img.shields.io/badge/Security-Hardware%20DPAPI%20%7C%20RS256-success.svg?style=flat-square)](#-security--production-hardening)

[**Live Web Application**](https://bedrockxai.com) • [**Download Desktop Workstation (v1.4.6)**](https://github.com/Bedrockxai/Bedrock/releases/latest) • [**Documentation**](#-table-of-contents)

</div>

---

## 📖 Table of Contents

- [Overview](#-overview)
- [Workstation vs. Web Architecture](#-workstation-vs-web-architecture)
- [Core Workspaces](#-core-workspaces)
  - [1. Telemetry Dashboard](#1-telemetry-dashboard-ctrl1--1)
  - [2. Prompt Generator & Refinement Studio](#2-prompt-generator--refinement-studio-ctrl2--2)
  - [3. Visual Branching Canvas (DAG)](#3-visual-branching-canvas-dag-ctrl3--3)
  - [4. Multi-Model Benchmark Arena](#4-multi-model-benchmark-arena-ctrl4--4)
  - [5. Prompt Blueprint Library](#5-prompt-blueprint-library-ctrl5--5)
  - [6. Execution History & Trace Archive](#6-execution-history--trace-archive-ctrl6--6)
- [Universal Dynamic BYOK Model Discovery](#-universal-dynamic-byok-model-discovery)
- [15 Production Export Targets](#-15-production-export-targets)
- [System Architecture & Data Flow](#-system-architecture--data-flow)
- [Security & Production Hardening](#-security--production-hardening)
- [Desktop Releases & Installation](#-desktop-releases--installation)
- [Getting Started & Local Development](#-getting-started--local-development)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Environment Configuration](#environment-configuration)
  - [Database Initialization](#database-initialization)
  - [Running Development](#running-development)
  - [Compiling & Packaging](#compiling--packaging)
- [Testing & Quality Assurance](#-testing--quality-assurance)
- [Project Directory Layout](#-project-directory-layout)
- [Contributing](#-contributing)
- [License](#-license)

---

## 🌟 Overview

**Bedrock** is a developer-grade prompt engineering studio, visual orchestration canvas, and multi-model benchmarking environment. Modern AI software engineering requires far more than casual chat interfaces: prompts must be deterministic, syntactically bounded, structurally constrained, tested across model weights, and version-controlled as production code.

Bedrock unifies the prompt development lifecycle into a single workflow:
1. **Clarify & Synthesize**: Transform ambiguous product briefs into hardened, XML-bounded prompt blueprints via automated scoping interviews.
2. **Branch & Orchestrate**: Connect LLMs, condition routers, data stores, and sandboxed code execution in an infinite visual DAG canvas.
3. **Benchmark in The Arena**: Run identical prompts side-by-side across frontier providers to compare latency (TTFT), token consumption, adherence, and visual diffs.
4. **Deploy Universally**: Compile and export prompts directly into 15 target formats, from IDE rules (`.cursorrules`, `CLAUDE.md`, `.windsurfrules`) to framework SDKs (Vercel AI SDK, LangChain, OpenAI, Anthropic).

---

## ⚖️ Workstation vs. Web Architecture

Bedrock provides two tailored deployment targets that share 100% feature parity across workspaces, prompts, models, and export engines while maintaining strict architectural boundaries:

| Dimension | Desktop Workstation (`isDesktopApp() === true`) | Web Application (`isDesktopApp() === false`) |
| :--- | :--- | :--- |
| **Runtime Container** | Native **Electron 43** (Windows & macOS) | Modern evergreen browsers (Chrome, Edge, Safari, Firefox) |
| **Navigation & Layout** | Permanent left-hand **Sidebar** with full-height canvas (`h-screen overflow-hidden`) | Floating **Aceternity Topbar** navigation island with glassmorphism |
| **Keyboard Navigation** | Global hotkeys `Ctrl+1` through `Ctrl+6` (`⌘1`–`⌘6`) | In-app keyboard navigation and tab shortcuts |
| **API Key Architecture** | **100% BYOK Autonomy**: Users bring their own API keys; keys never touch Bedrock servers | **Managed Server Credentials**: Server-side proxy (`/api/ai/*`) using developer credentials |
| **Credential Storage** | **Hardware Encryption**: Windows DPAPI & macOS Keychain Services (`dist-electron/`) | None: Zero client-side API key storage; keys are strictly server-side |
| **Local Offline LLMs** | Direct native loopback to **Ollama** (`http://127.0.0.1:11434`) | Air-gapped / local inference disabled |
| **Local File I/O** | Direct file system export to local repositories with native confirmation | Standard browser file downloads (`.zip`, `.md`, `.rules`) |
| **Quota & Billing** | Unlimited execution; 0 token quotas or subscription gates | Tiered usage with daily free quotas, Pro, and Ultimate plans |

---

## 🗂️ Core Workspaces

### 1. Telemetry Dashboard (`Ctrl+1` / `⌘1`)
*The central command room for real-time observability, health, and throughput monitoring.*
- **KPI HUD Matrix**: Tracks total prompt generations, cumulative input/output token volume, average end-to-end latency (ms), and 99.9% system SLA reliability.
- **2D Network Topology Visualizer**: Interactive live topology map illustrating client-to-gateway routing and real-time connectivity states across AI providers.
- **52-Week Activity Heatmap**: GitHub-style contribution calendar displaying prompt engineering frequency and testing volume across the entire year.
- **Recent Generations Feed**: Instant-jump list to inspect, copy, or resume editing your ten most recent prompt artifacts.

### 2. Prompt Generator & Refinement Studio (`Ctrl+2` / `⌘2`)
*The primary prompt studio transforming raw requirements into production system prompts.*
- **Target Deployment Archetypes**: Select tailored structures including:
  - *Coding Assistant Rulebooks* (`.cursorrules`, `CLAUDE.md`, `.windsurfrules`, GitHub Copilot)
  - *Full-Stack Architecture Blueprints* (DB schemas, API endpoints, error envelopes, test plans)
  - *CLI Terminal Specifications* (flags, POSIX exit codes, streaming signals)
  - *Freelance Scope of Work (SOW)* (deliverables, acceptance criteria, milestones)
  - *Hackathon 24-Hour MVP* (core flows, out-of-scope boundaries)
- **Scoping Interview**: Analyzes the brief and automatically formulates 3–4 probing questions (database choice, auth model, resilience requirements) with multi-choice and free-text support.
- **Live Streaming Synthesis**: High-speed token streaming rendering XML boundary tags, strict role directives, typed schema definitions, and negative constraints.
- **Dual-Pane Refinement Studio (`Result.tsx`)**:
  - *Left Pane*: Conversational feedback loop allowing surgical modifications in natural language.
  - *Right Pane*: Living document with interactive section folding, line numbers, and syntax highlighting.

### 3. Visual Branching Canvas (DAG) (`Ctrl+3` / `⌘3`)
*Graph-based visual orchestration powered by `@xyflow/react` for multi-step AI reasoning pipelines.*
- **The Eight Specialized Node Types**:
  1. `System Persona Node`: Injects immutable role boundaries and behavioral guardrails.
  2. `User Prompt Node`: Ingests dynamic input variables, briefs, and execution arguments.
  3. `Data Store Node`: Houses context documents, API specifications, and database schemas.
  4. `Condition Router Node`: Evaluates outputs and splits pipelines based on regex or classification branches.
  5. `Code Script Node`: Executes custom JavaScript in an isolated, sandboxed virtual iframe with a strict 5,000ms watchdog timeout.
  6. `Output Terminal Node`: Renders the synthesized response of an upstream pipeline chain.
  7. `Evaluator Node`: Benchmarks responses against deterministic rubric assertions.
  8. `Merge Node`: Aggregates multi-branch parallel reasoning paths into unified payloads.
- **Execution Engine**: Topological DAG sorting, state caching, step-by-step stepping, and full execution run history.

### 4. Multi-Model Benchmark Arena (`Ctrl+4` / `⌘4`)
*Side-by-side comparative evaluation running identical prompts against competing frontier LLMs.*
- **Concurrent Inference**: Parallel dispatch across two or more selected models.
- **Telemetry Benchmarking**:
  - *Time to First Token (TTFT)*: Measures instant responsiveness and time-to-generation.
  - *Throughput (Tokens/Sec)*: Measures sustained streaming generation speeds.
  - *Token Utilization*: Compares prompt vs. completion token efficiency.
- **Visual Diff Highlighting**: Word-by-word diff engine highlighting variance in formatting, verbosity, and directive adherence.

### 5. Prompt Blueprint Library (`Ctrl+5` / `⌘5`)
*A curated catalog of 50+ battle-tested prompt blueprints for engineering, DevOps, architecture, and security.*
- **Interactive 3D Physics Canvas**: Tactile blueprint cards featuring momentum physics, hover tilting, and fluid drag-and-drop.
- **Taxonomy Filtering**: Filter by category (Frontend, Backend, DevOps, Data, Security, Product) and target IDE.
- **1-Click Forking**: Clone any library blueprint straight into the Refinement Studio or Branching Canvas.

### 6. Execution History & Trace Archive (`Ctrl+6` / `⌘6`)
*An immutable archive of all generated prompts, workflow runs, and arena benchmark traces.*
- **Full-Text Elastic Search**: Instant search across titles, prompt content, model targets, and timestamps.
- **Version Rollbacks**: Inspect diffs between historical prompt iterations and restore prior states.
- **Two-Way Cloud Synchronization**: Seamless background sync with Neon PostgreSQL across desktop and web sessions.

---

## ⚡ Universal Dynamic BYOK Model Discovery

Bedrock v1.4.6 eliminates hardcoded model dependencies. When you provide your own API credentials in the Desktop Workstation, Bedrock dynamically interrogates the provider's live discovery endpoints:

```
┌─────────────────────────────────────────────────────────────┐
│                 Bedrock Dynamic Model Engine                │
└──────────────┬──────────────────────────────┬───────────────┘
               │                              │
      Direct API Discovery           Local Discovery
               │                              │
 ┌─────────────┼─────────────┐                │
 ▼             ▼             ▼                ▼
Google       Groq       OpenRouter      Ollama Runtime
Gemini     Endpoints    Model Hub      (127.0.0.1:11434)
(x-goog-     (LPU       (Curated &       (Local Quantized
api-key)  Accelerated) Open Weights)       Inference)
```

- **Live Endpoints**:
  - **Google Gemini**: Dynamic query against `/v1beta/models` using secure `x-goog-api-key` headers.
  - **Groq**: Real-time listing of active ultra-low latency LPUs (Llama 3.3, Mixtral, DeepSeek-R1 Distill).
  - **OpenRouter**: Comprehensive querying of hundreds of frontier and open-weight models.
  - **Mistral, xAI, DeepSeek, Cohere**: Native OpenAI-compatible and Cohere v2 adapters with zero parameter translation errors.
  - **Ollama**: Queries local `http://127.0.0.1:11434/api/tags` to discover locally pulled GGUF models.
- **Exact Dispatching**: Discovered models route directly to their listing provider with zero parameter renaming and zero hidden fallback substitutions.

---

## 📦 15 Production Export Targets

Bedrock transforms prompts into deployment-ready artifacts across developer ecosystems:

| Category | Target / Format | Description |
| :--- | :--- | :--- |
| **IDE Rulebooks** | **`.cursorrules`** | Cursor AI directory-level project rules and context directives |
| | **`CLAUDE.md`** | Anthropic Claude Code project architecture and command directives |
| | **`.windsurfrules`** | Windsurf Codeium IDE rulebook |
| | **`.github/copilot-instructions.md`** | GitHub Copilot repository-level instructions |
| | **`system.prompt`** | Generic IDE and prompt runner instruction file |
| **Framework SDKs** | **Vercel AI SDK** | Next.js / Node.js route handlers (`ai/rsc`, `streamText`) |
| | **OpenAI SDK (TypeScript)** | Strongly-typed TypeScript OpenAI client instantiation |
| | **OpenAI SDK (Python)** | Async Python OpenAI implementation (`chat.completions`) |
| | **Anthropic SDK (TypeScript)** | Native Anthropic SDK client (`messages.stream`) |
| | **Anthropic SDK (Python)** | Async Python Anthropic integration |
| | **Google Gen AI (TypeScript)** | Google `@google/genai` SDK configuration |
| | **Google Gen AI (Python)** | Python `google-generativeai` setup |
| | **LangChain (Python)** | LangChain `ChatPromptTemplate` and pipeline definition |
| **Structured Formats** | **JSON Schema** | Typed JSON with schema properties, required keys, and descriptions |
| | **Raw XML Directives** | Pure XML structural boundaries (`<system>`, `<context>`, `<rules>`) |

---

## 🏗️ System Architecture & Data Flow

```mermaid
flowchart TD
    subgraph Client ["Client Presentation Layer"]
        Desktop["Desktop Workstation (Electron 43)\n• Left Sidebar (⌘1-⌘6)\n• Hardware DPAPI/Keychain Keystore\n• Direct BYOK Model Execution"]
        Web["Web Application (React 19)\n• Floating Topbar Navigation\n• Clerk Auth & Session Management\n• Managed Cloud AI Gateway"]
    end

    subgraph Gateway ["Bedrock Serverless Gateway (Vercel)"]
        WAF["Layer-7 WAF & Threat Shield\n(SQLi, XSS, Path Traversal)"]
        Auth["Zero-Trust Auth Verifier\n(RS256 JWT, Azp Check, Issuer Allowlist)"]
        Limiter["Quota Governor & Rate Limiter\n(Upstash Redis, IPv6 /64 CIDR)"]
        Router["Dynamic AI Router\n(50s Safety Budget, Retry-After: 15s)"]
    end

    subgraph Data ["Persistence & Observability"]
        Neon[("Neon Serverless PostgreSQL\n• Advisory Locked QuotaEvent\n• 7 Concurrently Indexed Tables\n• Auto-Purge Maintenance Cron")]
        Redis[("Upstash Redis Cache\n• Distributed Rate Limits\n• Circuit Breaker States")]
    end

    subgraph Providers ["Global AI Matrix"]
        P_Google["Google Gemini 2.5/3.5/3.8"]
        P_Groq["Groq Cloud LPUs"]
        P_OpenRouter["OpenRouter Frontier Models"]
        P_Direct["Mistral / xAI / Cohere / DeepSeek"]
        P_Local["Local Ollama Runtime (127.0.0.1:11434)"]
    end

    Desktop -- "Direct BYOK Inference" --> Providers
    Desktop -- "Local Offline" --> P_Local
    Desktop -- "Sync Telemetry & Prompts" --> Gateway

    Web -- "Authenticated Requests" --> Gateway
    Gateway --> WAF --> Auth --> Limiter --> Router
    Limiter <--> Redis
    Router <--> Neon
    Router -- "Cloud Proxy Inference" --> Providers
```

---

## 🛡️ Security & Production Hardening

Bedrock implements defense-in-depth across the desktop operating system, network layer, and database:

### 1. Hardware-Level Credential Protection (Desktop BYOK)
- Desktop API keys are encrypted at rest using **Windows DPAPI** (`CryptProtectData`) on PC and **macOS Keychain Services** on Apple Silicon/Intel Macs.
- Keys are never written to disk in plaintext, never saved in `localStorage`, and **never transmitted to Bedrock cloud servers**.
- When exporting workspace backups, an automated credential scrubber removes secret patterns before serialization.

### 2. Sandboxed Code Execution
- Branching Canvas **Code Script Nodes** execute inside an isolated `<iframe sandbox="allow-scripts">` running on an opaque origin.
- The execution sandbox has zero access to parent `window`, DOM, `localStorage`, session cookies, or Electron native IPC.
- A hard **5,000ms watchdog timer** terminates runaway loops or CPU-intensive execution.

### 3. Delimiter Isolation & Injection Defense
- User prompts are encapsulated within strict structural boundary tags (`### USER INPUT BEGIN ###` and `### USER INPUT END ###`).
- Input pipelines run through `assessPromptInjection()`, stripping invisible Unicode zero-width characters (`\u200B`–`\u200D`, `\uFEFF`) and detecting adversarial persona override attempts.
- Verified against an adversarial 22-vector automated attack suite with 0 credential leaks.

### 4. Zero-Trust Identity & Session Security
- Authentication tokens are validated with native Node.js RSA-SHA256 asymmetric cryptographic checks (`RS256`).
- Issuer allowlisting enforces that JWTs originate strictly from configured Clerk instances (`CLERK_ISSUER`).
- **Authorized Party (`azp`) Protection**: Rejects tokens minted for external applications or unvetted domains.
- Tokens enforce mandatory expiration (`exp`) and public key caching with rate-limited cooldowns.

### 5. Automated Secret Scanning & Data Sanitization
- Continuous CI scanner (`scripts/scan-secrets.js`) inspects all files against 18+ high-entropy credential shapes (OpenAI, Anthropic, Google, Groq, Clerk, Hugging Face, GitHub, Upstash, and database connection strings).
- PostHog and Sentry error telemetry automatically run payloads through regex redaction (`scrubText`), ensuring no proprietary prompt data or keys ever appear in crash reports.

---

## 💻 Desktop Releases & Installation

Official installers are signed and published on GitHub Releases:

### Windows (10/11 64-bit)
- **Installer**: `Bedrock Setup 1.4.6.exe` (NSIS Installer)
- Features: Start menu shortcut, desktop icon, customizable installation directory, and automatic background updates via `latest.yml`.
- [Download Windows Installer (v1.4.6)](https://github.com/Bedrockxai/Bedrock/releases/latest)

### macOS (Universal: Apple Silicon & Intel)
- **DMG Package**: `Bedrock-Mac.dmg`
- **ZIP Archive**: `Bedrock-Mac.zip`
- Features: Native Drag-and-Drop `/Applications` installer, Apple Silicon (M1/M2/M3/M4) and Intel (x64) universal binaries.
- [Download macOS Release (v1.4.6)](https://github.com/Bedrockxai/Bedrock/releases/latest)

---

## 🚀 Getting Started & Local Development

### Prerequisites
- **Node.js**: `20.x` or higher (LTS recommended)
- **npm**: `10.x` or higher
- **Neon Database**: Active [Neon PostgreSQL](https://neon.tech/) account & project
- **Clerk Authentication**: [Clerk](https://clerk.com/) application credentials
- **Ollama** *(Optional)*: Installed locally for offline inference (`https://ollama.com`)

### Installation
Clone the repository and install dependencies:

```bash
git clone https://github.com/Bedrockxai/Bedrock.git
cd Bedrock
npm install
```

### Environment Configuration
Create a `.env.local` file in the project root:

```env
# ==========================================
# Client Authentication (Clerk)
# ==========================================
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
CLERK_ISSUER=https://...clerk.accounts.dev

# ==========================================
# Database (Neon Serverless PostgreSQL)
# ==========================================
DATABASE_URL="postgresql://neondb_owner:password@ep-soft-tooth-xxx-pooler.us-east-1.aws.neon.tech/bedrock?sslmode=require"
DATABASE_URL_UNPOOLED="postgresql://neondb_owner:password@ep-soft-tooth-xxx.us-east-1.aws.neon.tech/bedrock?sslmode=require"

# ==========================================
# Rate Limiting & Quota (Upstash Redis)
# ==========================================
UPSTASH_REDIS_REST_URL="https://...upstash.io"
UPSTASH_REDIS_REST_TOKEN="..."

# ==========================================
# Developer Cloud AI Keys (Server-side Only)
# ==========================================
GEMINI_API_KEY=your_gemini_key
GROQ_API_KEY=your_groq_key
OPENROUTER_API_KEY=your_openrouter_key
```

> [!IMPORTANT]
> Never prepend `VITE_` to server AI keys or secret keys. In Bedrock, all sensitive API keys reside strictly on the serverless runtime and are never exposed to the client bundle.

### Database Initialization
Push the Prisma schema to your Neon PostgreSQL instance:

```bash
cd server
npx prisma db push
npx prisma generate
cd ..
```

To run custom SQL migrations with advisory-locked quota tables:
```bash
node db/migrate.mjs status
node db/migrate.mjs up --yes
```

### Running Development
Start the desired runtime environment:

```bash
# 1. Start the web application (Vite on http://localhost:5173)
npm run dev

# 2. Launch the native Electron desktop application in dev mode
npm run electron:start

# 3. Launch Tauri application (optional alternative desktop shell)
npm run tauri dev
```

### Compiling & Packaging
Build production distribution bundles:

```bash
# Compile web client bundle to /dist
npm run build

# Package Windows NSIS executable installer
npm run electron:build

# Package macOS DMG and ZIP distribution packages
npm run electron:build:mac

# Unpackaged directory build (for testing)
npm run electron:pack
```

---

## 🧪 Testing & Quality Assurance

Bedrock enforces comprehensive test coverage across unit logic, serverless routes, security barriers, and prompt evaluation:

```bash
# Run unit & component test suite (Vitest)
npx vitest run

# Run security & authentication isolation tests
npx vitest run tests/security/

# Run dynamic model discovery & routing test suite
npx vitest run src/lib/__tests__/

# Run database schema migration verification tests
npx vitest run tests/db/

# Run the 22-vector automated security attack benchmark
npm run test:attacks

# Run prompt injection defense test runner
npm run test:injection

# Scan codebase for hardcoded secrets & credential leaks
npm run scan:secrets

# Run static analysis linter (Oxlint)
npm run lint
```

---

## 📁 Project Directory Layout

```
Bedrock/
├── api/                        # Serverless backend API routes (Vercel)
│   ├── _lib/                   # Shared backend utilities (auth, security, rateLimiter)
│   ├── ai/                     # AI proxy endpoints (synthesize, refine, test, questions)
│   ├── prompts/                # User prompt CRUD and ownership-safe persistence
│   ├── workflows/              # Branching DAG workflow persistence
│   └── traces/                 # Execution trace logging and SLA aggregations
├── db/                         # PostgreSQL database migrations & scripts
│   ├── migrations/             # Numbered SQL migrations (0001_baseline to 0004_quota)
│   └── migrate.mjs             # Zero-dependency database migration runner
├── dist-electron/              # Electron main process and preload scripts
│   ├── main.js                 # Electron window management, DPAPI, and CSP rules
│   └── preload.cjs             # Hardened IPC bridge (isolated context)
├── public/                     # Static assets, logos, and screenshots
├── scripts/                    # Build, release, and security scanning scripts
│   ├── scan-secrets.js         # 18-pattern automated secret leak scanner
│   └── publish_release.py      # Automated GitHub release publishing utility
├── server/                     # Prisma schema and standalone server utilities
│   └── prisma/schema.prisma    # Primary relational database models
├── src/                        # Presentation layer (React 19 + TypeScript)
│   ├── components/             # Reusable UI widgets, modals, and layouts
│   │   ├── auth/               # Authentication modals and forms
│   │   ├── branching/          # DAG canvas nodes and edge renderers
│   │   ├── generator/          # Prompt wizard and interview forms
│   │   └── layout/             # Sidebar, Topbar, and ErrorBoundary
│   ├── lib/                    # Client state, routing, and inference helpers
│   │   ├── callLLM.ts          # Universal LLM execution dispatcher
│   │   ├── dynamicModelDiscovery.ts  # Universal dynamic provider interrogator
│   │   └── platform.ts         # Desktop vs. Web environment detection
│   ├── pages/                  # Top-level workspace views (Dashboard, Wizard, Result, etc.)
│   ├── App.tsx                 # Lazy-loaded router with error boundary
│   └── main.tsx                # Application entry point with PostHog masking
├── tests/                      # Vitest test suites (security, attack suites, load tests)
├── package.json                # Project dependencies, build scripts, and metadata
└── vercel.json                 # Vercel deployment configuration, headers, and CSP
```

---

## 🤝 Contributing

Contributions to Bedrock are welcome! To contribute:

1. Fork the repository on GitHub.
2. Create a feature branch: `git checkout -b feature/amazing-feature`.
3. Commit your changes following standard conventional commits: `git commit -m 'feat: add amazing feature'`.
4. Ensure all test suites and secret checks pass:
   ```bash
   npm run lint && npm run scan:secrets && npx vitest run
   ```
5. Push to your branch: `git push origin feature/amazing-feature`.
6. Open a clean Pull Request against `main`.

---

## 📄 License

Distributed under the **MIT License**. See [`LICENSE`](LICENSE) for complete terms.

---

<div align="center">

**Built with precision by [Bedrock Inc](https://bedrockxai.com)**  
*Intelligence, shaped by you.*

</div>
