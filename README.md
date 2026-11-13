# Bedrock

Universal prompt engineering studio, visual orchestration canvas, and multi-model benchmarking environment.

[Website](https://bedrockxai.com) | [Releases](https://github.com/Bedrockxai/Bedrock/releases/latest) | [Documentation](#table-of-contents)

---

## Table of Contents

- [Overview](#overview)
- [Workstation vs. Web Architecture](#workstation-vs-web-architecture)
- [Core Workspaces](#core-workspaces)
  - [1. Telemetry Dashboard](#1-telemetry-dashboard)
  - [2. Prompt Generator and Refinement Studio](#2-prompt-generator-and-refinement-studio)
  - [3. Visual Branching Canvas (DAG v2)](#3-visual-branching-canvas-dag-v2)
  - [4. Multi-Model Benchmark Arena](#4-multi-model-benchmark-arena)
  - [5. Prompt Blueprint Library](#5-prompt-blueprint-library)
  - [6. Execution History and Trace Archive](#6-execution-history-and-trace-archive)
- [Universal Dynamic BYOK Model Discovery](#universal-dynamic-byok-model-discovery)
- [15 Production Export Targets](#15-production-export-targets)
- [System Architecture and Data Flow](#system-architecture-and-data-flow)
- [Security and Resilience Architecture](#security-and-resilience-architecture)
- [Desktop Releases and Installation](#desktop-releases-and-installation)
- [Getting Started and Local Development](#getting-started-and-local-development)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Environment Configuration](#environment-configuration)
  - [Database Initialization](#database-initialization)
  - [Running Development](#running-development)
  - [Compiling and Packaging](#compiling-and-packaging)
- [Testing and Verification](#testing-and-verification)
- [Project Directory Layout](#project-directory-layout)
- [License](#license)

---

## Overview

Bedrock is an engineering-grade workstation designed to develop, evaluate, and deploy structured system prompts and multi-model AI reasoning workflows.

Modern software systems require prompt assets that are deterministic, structurally bounded, verified against diverse model architectures, and version-controlled alongside application source code. Bedrock provides the complete tooling required for this lifecycle:

1. **Synthesize**: Convert high-level requirements into hardened, XML-bounded prompt blueprints via structured interactive scoping interviews.
2. **Orchestrate**: Build non-linear reasoning pipelines, condition routers, context stores, and sandboxed code execution in an infinite visual DAG canvas.
3. **Benchmark**: Evaluate prompts side-by-side across frontier providers to compare time-to-first-token (TTFT), token throughput, reasoning adherence, and semantic diffs.
4. **Deploy**: Export prompts directly into 15 standard formats, including IDE context files (`.cursorrules`, `CLAUDE.md`, `.windsurfrules`) and framework SDK integrations (Vercel AI SDK, LangChain, OpenAI, Anthropic, Google Gen AI).

---

## Workstation vs. Web Architecture

Bedrock provides two distinct targets sharing 100% feature parity across prompt synthesis, workflows, arena benchmarking, and export capabilities:

| Dimension | Desktop Workstation (`isDesktopApp() === true`) | Web Application (`isDesktopApp() === false`) |
| :--- | :--- | :--- |
| **Runtime Container** | Native Electron 43 (Windows & macOS) | Modern evergreen browsers (Chrome, Edge, Safari, Firefox) |
| **Navigation & Layout** | Fixed left-hand Sidebar with full-height workstation views (`h-screen overflow-hidden`) | Floating glassmorphism Topbar island with scrolling page views |
| **Keyboard Navigation** | Global desktop hotkeys `Ctrl+1` through `Ctrl+6` (`Cmd+1`–`Cmd+6`) | Standard browser keyboard navigation and tab shortcuts |
| **Model Credentials** | 100% BYOK autonomy: user provides API keys directly; credentials never leave device | Managed server-side AI proxy routes (`/api/ai/*`) |
| **Credential Storage** | Hardware-backed encryption via Windows DPAPI and macOS Keychain | Zero client key storage; keys reside on server runtime only |
| **Offline Inference** | Direct loopback connection to local Ollama runtime (`http://127.0.0.1:11434`) | Cloud and API model execution |
| **File System Access** | Direct 1-click export to local repository folders with native dialog confirmation | Browser file downloads (`.zip`, `.md`, `.rules`) |
| **Billing & Quota** | 100% free to use: zero token limits, no plan gating, and no subscription concepts | Tiered service: Free tier quota, Pro ($20/mo), and Ultimate ($50/mo) |

---

## Core Workspaces

### 1. Telemetry Dashboard
The operational control room for throughput monitoring and health observability.
- **KPI Metrics**: Real-time tracking of total prompt compilations, input/output token usage, average latency, and 99.9% availability status.
- **Network Topology Visualizer**: Live interactive node graph displaying routing connectivity and circuit status across LLM providers.
- **Activity Calendar**: 52-week contribution heatmap charting prompt iteration frequency throughout the year.
- **Recent Artifacts Feed**: Instant-jump list to inspect, copy, or resume editing recent prompts.

### 2. Prompt Generator and Refinement Studio
The core studio turning raw functional requirements into structured production prompts.
- **Target Deployment Archetypes**: Pre-configured archetypes for:
  - Coding Assistant Rulebooks (`.cursorrules`, `CLAUDE.md`, `.windsurfrules`, GitHub Copilot)
  - Full-Stack Architecture Blueprints (REST/tRPC endpoints, SQL migrations, error envelopes)
  - Terminal CLI Tool Directives (POSIX flags, exit codes, streaming patterns)
  - Technical Specifications and Scope of Work documents
- **Scoping Interview**: Analyzes initial ideas and dynamically asks 3–4 clarifying questions covering database design, authentication models, and edge-case handling.
- **Dual-Pane Refinement Studio**:
  - *Left Pane*: Conversational modification studio for targeted prompt adjustments.
  - *Right Pane*: Structured editor with section folding, line numbering, and copy controls.

### 3. Visual Branching Canvas (DAG v2)
Graph-based visual pipeline orchestration powered by `@xyflow/react`.
- **Specialized Node Architecture**:
  1. `Persona Node`: Enforces immutable role identity and system behavior boundaries.
  2. `Prompt Node`: Ingests dynamic inputs, variables, and task directives.
  3. `Data Store Node`: Supplies contextual documents, API schemas, and JSON payloads.
  4. `Condition Router Node`: Directs execution branches based on regex patterns or classifications.
  5. `Code Script Node`: Runs isolated JavaScript in a sandboxed execution context with a 5-second watchdog timer.
  6. `Terminal Node`: Captures and formats final synthesized outputs.
  7. `Evaluator Node`: Tests outputs against rubric assertions.
  8. `Merge Node`: Unifies parallel execution branches into a consolidated payload.
- **Execution Engine**: Topological DAG sorting, real-time node animation, single-step execution mode, rule builder, pipeline validation diagnostics, and version history snapshots.

### 4. Multi-Model Benchmark Arena
Comparative evaluation engine executing identical prompts across frontier LLMs in parallel.
- **Concurrent Dispatch**: Simultaneous execution across two competing models.
- **Telemetry Analysis**:
  - Time to First Token (TTFT) responsiveness measurement.
  - Token generation throughput rates.
  - Comparative token utilization efficiency.
- **Visual Diff Engine**: Word-level diff visualizer highlighting structural differences, formatting variance, and prompt adherence.

### 5. Prompt Blueprint Library
Curated collection of 50+ battle-tested prompt blueprints covering software engineering, architecture, database design, and cloud security.
- **Tactile Card Interface**: Interactive blueprint cards featuring hover-tilt effects and smooth selection physics.
- **Categorization**: Multi-criteria taxonomy filtering across Frontend, Backend, DevOps, Data, Security, and Product domains.
- **1-Click Forking**: Instant cloning into the Refinement Studio or Branching Canvas.

### 6. Execution History and Trace Archive
Centralized log of prompt generation iterations, workflow runs, and arena benchmark traces.
- **Search and Filtering**: Instant full-text search across titles, prompt content, model targets, and tags.
- **Snapshot Comparison**: Side-by-side diffing between revisions with single-click restore capabilities.
- **Cloud Synchronization**: Background synchronization with Neon PostgreSQL for persistent state across devices.

---

## Universal Dynamic BYOK Model Discovery

Bedrock v1.4.9 operates without hardcoded model lists. In Desktop Workstation mode, supplying API keys dynamically interrogates live provider endpoints:

- **Google Gemini**: Direct query against `/v1beta/models` using `x-goog-api-key` header authentication.
- **Groq**: Queries current low-latency LPUs including Llama 3.3, Mixtral, and DeepSeek-R1 Distill.
- **OpenRouter**: Comprehensive querying of hundreds of frontier models and open-weight checkpoints.
- **Anthropic, OpenAI, Mistral, xAI, Perplexity**: Native discovery and parameter validation.
- **Ollama**: Connects to local `http://127.0.0.1:11434/api/tags` to discover pulled GGUF models.

All discovered models dispatch directly to their native upstream provider endpoints with zero parameter translation or silent model substitution.

---

## 15 Production Export Targets

Bedrock transforms prompts into deployment-ready artifacts across development stacks:

| Category | Target / Format | Description |
| :--- | :--- | :--- |
| **IDE Rulebooks** | `.cursorrules` | Project-level rule definition for Cursor AI |
| | `CLAUDE.md` | Context and instruction file for Claude Code |
| | `.windsurfrules` | Configuration file for Windsurf IDE |
| | `.github/copilot-instructions.md` | Repository-level instructions for GitHub Copilot |
| | `system.prompt` | Standard plain-text system prompt file |
| **Framework SDKs** | Vercel AI SDK | Route handler implementation (`streamText`) |
| | OpenAI SDK (TypeScript) | Typed client configuration for TypeScript |
| | OpenAI SDK (Python) | Async client configuration for Python |
| | Anthropic SDK (TypeScript) | Native Anthropic SDK client configuration |
| | Anthropic SDK (Python) | Async Python Anthropic configuration |
| | Google Gen AI (TypeScript) | `@google/genai` client setup |
| | Google Gen AI (Python) | `google-generativeai` package setup |
| | LangChain (Python) | `ChatPromptTemplate` pipeline definition |
| **Structured Formats** | JSON Schema | Validated JSON Schema representation with strict constraints |
| | Raw XML Directives | Clean XML block boundary tags (`<system>`, `<context>`, `<rules>`) |

---

## System Architecture and Data Flow

```mermaid
flowchart TD
    subgraph Client ["Client Presentation Layer"]
        Desktop["Desktop Workstation (Electron 43)\n- Sidebar navigation (Cmd+1 - Cmd+6)\n- Hardware DPAPI / Keychain Keystore\n- Direct BYOK Model Execution"]
        Web["Web Application (React 19)\n- Floating Topbar navigation\n- Clerk Authentication\n- Serverless AI Proxy Gateway"]
    end

    subgraph Gateway ["Serverless Gateway (Vercel)"]
        WAF["Security Filter & Rate Limiter\n(Upstash Redis, IPv6 /64 tracking)"]
        Auth["Auth Verifier\n(RS256 JWT, Azp Check, Issuer Allowlist)"]
        Router["Resilient AI Router\n(15s DB Timeout, 50s Request Deadline, Failover Chains)"]
    end

    subgraph Data ["Data & Telemetry"]
        Neon[("Neon PostgreSQL\n- Advisory-locked quota checks\n- Automated retention purge\n- 0001-0021 migrations")]
        Redis[("Upstash Redis\n- Rate limiting fallback\n- Circuit breaker tracking")]
    end

    subgraph Providers ["AI Providers"]
        P_Google["Google Gemini"]
        P_Groq["Groq LPUs"]
        P_OpenRouter["OpenRouter Frontier Models"]
        P_Direct["OpenAI / Anthropic / xAI / Perplexity"]
        P_Local["Local Ollama (127.0.0.1:11434)"]
    end

    Desktop -- "Direct BYOK Inference" --> Providers
    Desktop -- "Local Offline" --> P_Local
    Desktop -- "Sync Workspaces" --> Gateway

    Web -- "Authenticated Requests" --> Gateway
    Gateway --> WAF --> Auth --> Router
    Router <--> Redis
    Router <--> Neon
    Router -- "Managed Inference" --> Providers
```

---

## Security and Resilience Architecture

Bedrock is built with security controls enforced across operating system, network, and database layers:

1. **Hardware-Backed Credential Encryption**:
   - Desktop API keys are encrypted at rest via Windows DPAPI (`CryptProtectData`) on Windows and Keychain Services on macOS.
   - Keys are never written to disk unencrypted, never stored in browser storage, and never sent to Bedrock servers.
2. **Database Timeout Resilience**:
   - Neon PostgreSQL queries enforce a strict 15-second timeout (`DB_QUERY_TIMEOUT_MS`) with automatic abort signals.
   - Database connection stalls trigger a clean `503 DATABASE_TIMEOUT` with a `Retry-After: 5` header, avoiding 504 gateway timeouts.
3. **Request Arrival AI Deadlines**:
   - The 50-second serverless execution deadline is calculated from initial HTTP request arrival, ensuring authentication and database cold-starts do not exceed Vercel's 60-second limit.
4. **Asynchronous Telemetry Logging**:
   - Execution traces and usage metrics are recorded post-response via `@vercel/functions` `waitUntil`, removing database write latency from user responses.
5. **Sandboxed Code Execution**:
   - Branching Canvas Code Nodes run inside an isolated virtual iframe sandbox with strict Origin isolation and a 5,000ms watchdog timer.
6. **Input Boundary Enforcement**:
   - User inputs are wrapped within explicit XML delimiter blocks.
   - Inputs are scanned for zero-width Unicode characters (`\u200B`–`\u200D`, `\uFEFF`) and prompt injection patterns.
7. **Identity Verification & Session Safety**:
   - RSA-SHA256 (`RS256`) cryptographic signature verification for Clerk JWT tokens.
   - Strict `azp` validation against configured origin allowlists.
   - Safe redirect URL validation preventing open-redirect vulnerabilities.
8. **Automated Secret Leak Scanning**:
   - Pre-commit and CI secret scanning inspecting 18+ high-entropy credential patterns across the repository.

---

## Desktop Releases and Installation

Official release binaries are available on GitHub Releases:

### Windows (10 / 11 64-bit)
- **Installer**: `Bedrock Setup 1.4.9.exe` (NSIS Installer)
- **Direct Download**: [Download for Windows](https://github.com/Bedrockxai/Bedrock/releases/latest/download/Bedrock-Setup.exe)
- Includes customizable installation paths, desktop and start menu shortcuts, and automatic updates via `latest.yml`.

### macOS (Apple Silicon & Intel Universal)
- **Disk Image**: `Bedrock-Mac.dmg`
- **ZIP Package**: `Bedrock-Mac.zip`
- Includes native drag-and-drop `/Applications` installer for both Apple Silicon (M1/M2/M3/M4) and Intel architectures.

---

## Getting Started and Local Development

### Prerequisites
- Node.js 20.x or higher (LTS recommended)
- npm 10.x or higher
- Neon PostgreSQL project
- Clerk authentication credentials
- Local Ollama runtime (optional, for offline models)

### Installation
```bash
git clone https://github.com/Bedrockxai/Bedrock.git
cd Bedrock
npm install
```

### Environment Configuration
Create a `.env.local` file in the root directory:

```env
# Client Authentication (Clerk)
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
CLERK_ISSUER=https://...clerk.accounts.dev

# Database (Neon Serverless PostgreSQL)
DATABASE_URL="postgresql://neondb_owner:password@ep-...-pooler.us-east-1.aws.neon.tech/bedrock?sslmode=require"
DATABASE_URL_UNPOOLED="postgresql://neondb_owner:password@ep-...us-east-1.aws.neon.tech/bedrock?sslmode=require"

# Rate Limiting (Upstash Redis)
UPSTASH_REDIS_REST_URL="https://...upstash.io"
UPSTASH_REDIS_REST_TOKEN="..."

# Cloud AI Provider Keys (Server-side Only)
GEMINI_API_KEY=your_gemini_key
GROQ_API_KEY=your_groq_key
OPENROUTER_API_KEY=your_openrouter_key
```

### Database Initialization
Apply database migrations to your Neon PostgreSQL instance:

```bash
node db/migrate.mjs status
node db/migrate.mjs up --yes
```

### Running Development
```bash
# Start web application on http://localhost:5173
npm run dev

# Start Electron desktop application in development mode
npm run electron:start
```

### Compiling and Packaging
```bash
# Build production web bundle to dist/
npm run build

# Package Windows NSIS installer to release/
npm run electron:build

# Package macOS DMG installer
npm run electron:build:mac
```

---

## Testing and Verification

Bedrock maintains a comprehensive test suite across security boundaries, API endpoints, and client logic:

```bash
# Run unit and client test suites
npx vitest run

# Run security, authentication, and isolation test suite
npx vitest run tests/security/

# Run API endpoint and resilience test suite
npx vitest run api/

# Scan repository for hardcoded secrets and credentials
npm run scan:secrets

# Run static analysis linter
npm run lint
```

---

## Project Directory Layout

```
Bedrock/
├── api/                    # Serverless backend API routes (Vercel)
│   ├── _lib/               # Backend modules (auth, security, rate limiting, db)
│   ├── ai/                 # AI proxy endpoints (synthesize, refine, test, questions)
│   ├── billing/            # Razorpay order generation and webhook verification
│   ├── prompts/            # User prompt CRUD and ownership-safe storage
│   ├── workflows/          # Branching DAG persistence and share links
│   └── traces/             # Execution telemetry and metrics aggregation
├── db/                     # PostgreSQL database migrations
│   ├── migrations/         # Numbered SQL migration files (0001 to 0021)
│   └── migrate.mjs         # Migration runner
├── dist-electron/          # Electron main process and preload bridge
│   ├── main.js             # Window management, DPAPI handlers, CSP configuration
│   └── preload.cjs         # Sandboxed IPC bridge
├── public/                 # Static branding, logos, and preview media
├── release/                # Packaged desktop installer distribution binaries
├── scripts/                # Automated secret scanners and release utilities
├── src/                    # Frontend source code (React 19 + TypeScript)
│   ├── components/         # UI components, modals, and canvas nodes
│   │   ├── branching/      # DAG canvas nodes and edge renderers
│   │   ├── layout/         # Sidebar, Topbar, and ErrorBoundary
│   │   └── ui/             # Reusable UI controls and dialogs
│   ├── lib/                # Client utilities, state, and API helpers
│   │   ├── callLLM.ts      # LLM inference dispatcher
│   │   ├── platform.ts     # Desktop vs. Web runtime detection
│   │   └── subscriptionTiers.ts # Model entitlements and node limits
│   └── pages/              # Primary workspace views (Dashboard, Wizard, Result, etc.)
├── tests/                  # Security, sandbox, and integration test suites
├── package.json            # Dependencies, scripts, and build metadata
└── vercel.json             # Deployment headers, serverless configuration, and CSP
```

---

## License

Distributed under the MIT License. See [LICENSE](LICENSE) for full details.
