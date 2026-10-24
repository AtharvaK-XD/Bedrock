<p align="center">
  <img src="./public/logo.png" alt="Bedrock Logo" width="72" height="72" />
</p>

<h1 align="center">Bedrock</h1>

<p align="center">
  <strong>The Frontier Prompt Engineering Workstation & Visual AI Orchestration Platform</strong>
</p>

<p align="center">
  Synthesize, refine, branch, benchmark, and deploy enterprise-grade system prompts across frontier LLMs with real-time telemetry, interactive clarifying questions, visual DAG orchestration, and multi-IDE rule generation.
</p>

<p align="center">
  <a href="https://github.com/Bedrockxai/Bedrock/releases/latest"><img src="https://img.shields.io/github/v/release/Bedrockxai/Bedrock?color=10b981&label=Release&style=flat-square" alt="Latest Release" /></a>
  <a href="https://github.com/Bedrockxai/Bedrock/blob/main/LICENSE"><img src="https://img.shields.io/badge/License-MIT-3b82f6?style=flat-square" alt="License: MIT" /></a>
  <img src="https://img.shields.io/badge/Node.js-20.x%20%7C%2022.x-339933?style=flat-square&logo=node.js&logoColor=white" alt="Node.js 20+" />
  <img src="https://img.shields.io/badge/TypeScript-6.0-3178c6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/React-19.2-61dafb?style=flat-square&logo=react&logoColor=black" alt="React 19" />
  <img src="https://img.shields.io/badge/Electron-43.3-47848F?style=flat-square&logo=electron&logoColor=white" alt="Electron 43" />
  <img src="https://img.shields.io/badge/Tauri-2.11-24C8DB?style=flat-square&logo=tauri&logoColor=white" alt="Tauri 2.11" />
  <img src="https://img.shields.io/badge/PostgreSQL-Neon_Serverless-00e599?style=flat-square&logo=postgresql&logoColor=white" alt="Neon PostgreSQL" />
</p>

<p align="center">
  <a href="https://github.com/Bedrockxai/Bedrock/releases/latest"><strong>Downloads</strong></a> &bull;
  <a href="#workstation-gallery"><strong>Workstation</strong></a> &bull;
  <a href="#core-capabilities"><strong>Capabilities</strong></a> &bull;
  <a href="#workspaces"><strong>Workspaces</strong></a> &bull;
  <a href="#supported-models--providers"><strong>Models</strong></a> &bull;
  <a href="#blueprint-library--exporters"><strong>Exporters</strong></a> &bull;
  <a href="#architecture"><strong>Architecture</strong></a> &bull;
  <a href="#security--production-hardening"><strong>Security</strong></a> &bull;
  <a href="#getting-started"><strong>Quick Start</strong></a> &bull;
  <a href="#api-reference"><strong>API</strong></a>
</p>

---

## Overview

**Bedrock** is a specialized prompt engineering workstation and visual AI orchestration engine designed for software engineers, AI architects, and development teams. Available as a native cross-platform desktop application (macOS Universal and Windows x64) and an edge-ready web application, Bedrock provides a structured, high-throughput environment to synthesize, refine, orchestrate, and benchmark prompts across frontier AI providers.

Bedrock replaces brittle, unstructured text prompts with formal, hardened specifications:
- **Clarifying Question Synthesis**: Eliminates scope ambiguity before generation by analyzing briefs with deep reasoning models and extracting targeted questions.
- **Production-Ready System Prompts**: Compiles strict XML boundaries, parameter contracts, TypeScript interfaces, and negative constraint matrices.
- **Visual DAG Branching Canvas**: Graph-based node orchestration (`@xyflow/react`) for multi-step prompt chaining, conditional routing, and merge operations.
- **Parallel Multi-Model Benchmarking**: Dispatches identical prompts simultaneously across competing frontier models to benchmark latency, token cost, and adherence.
- **15 Universal Export Targets**: Generates ready-to-use configurations for Cursor (`.cursorrules`), Claude Code (`CLAUDE.md`), Windsurf (`.windsurfrules`), GitHub Copilot, Vercel AI SDK, OpenAI SDK, Anthropic SDK, and raw JSON payloads.
- **Comprehensive Settings & Inference Controls**: Custom inference parameters, token budget governors, 5 visual themes, and local Ollama model integration.

---

## Workstation Gallery

| Prompt Synthesis Wizard (`⌘2`) | DAG Branching Canvas (`⌘3`) |
| :---: | :---: |
| <img src="./public/screenshots/03_generator_wizard.png" width="460" alt="Prompt Synthesis Wizard" /> | <img src="./public/screenshots/04_branching_canvas.png" width="460" alt="DAG Branching Canvas" /> |

| Multi-Model Benchmark Arena (`⌘4`) | Telemetry & Observability HUD (`⌘1`) |
| :---: | :---: |
| <img src="./public/screenshots/05_arena_benchmark.png" width="460" alt="Multi-Model Benchmark Arena" /> | <img src="./public/screenshots/02_dashboard_hud.png" width="460" alt="Telemetry Dashboard HUD" /> |

| Prompt Blueprint Library (`⌘5`) | Historical Execution Archive (`⌘6`) |
| :---: | :---: |
| <img src="./public/screenshots/06_prompt_library.png" width="460" alt="Prompt Blueprint Library" /> | <img src="./public/screenshots/07_history_archive.png" width="460" alt="Historical Execution Archive" /> |

---

## Core Capabilities

- **Enterprise System Prompt Synthesis**: Generates battle-tested system instructions, XML delimiter boundaries, TypeScript schemas, and negative constraint matrices from brief descriptions.
- **Scope Ambiguity Elimination**: Analyzes prompts in real time to generate 3 to 5 targeted clarifying questions, ensuring requirements are locked down before final compilation.
- **Visual DAG Flow Orchestration**: Full graph execution canvas (`@xyflow/react`) supporting prompt nodes, router/condition nodes, evaluator nodes, and merge nodes with cycle detection.
- **Dual-Model Parallel Arena**: Side-by-side comparative benchmarking across competing models measuring latency (TTFT / P99), token economics, adherence scoring, and diff inspection.
- **Multi-IDE & SDK Exporters**: One-click generation for Cursor (`.cursorrules`), Claude Code CLI (`CLAUDE.md`), Windsurf (`.windsurfrules`), GitHub Copilot, Vercel AI SDK, OpenAI SDK, Anthropic SDK, and LangChain.
- **Real-Time Observability & Telemetry**: Live monitoring of inference operations, token consumption, P99 latency, SLA reliability, execution traces, and a 52-week activity heatmap.
- **Custom Model Inference & Token Budgeting**: Configurable inference temperatures, top_p, stream speeds, hard token budget limits, cost warnings, and multi-currency tracking (USD, EUR, GBP, JPY, INR).
- **Local AI & Air-Gapped Workflows**: First-class support for local open-weights models through Ollama (`llama3.2`, `qwen2.5-coder`, `deepseek-r1`).
- **Defense-in-Depth Security**: Delimiter isolation shields (`### USER INPUT BEGIN ###`), regex injection heuristics, Upstash Redis sliding-window rate limiters, and automated secret scanning.

---

## Workspaces

Bedrock organizes the prompt engineering lifecycle into dedicated, distraction-free workstation views:

### 1. Dashboard & Telemetry HUD (`/app` &bull; `⌘1`)
- **Telemetry HUD**: Real-time counters for total inferences, token consumption, P99 latency, and SLA uptime.
- **52-Week Activity Heatmap**: Interactive GitHub-style visual heatmap tracking daily prompt engineering volume and active streaks.
- **Execution Stream & Traces**: Live telemetry feed detailing model dispatch records, token burn rates, and latency watermarks.
- **Quick Action Matrix**: Instant shortcuts to trigger synthesis, spawn DAG branches, or initiate model benchmarks.

### 2. Prompt Generator & Synthesis Engine (`/app/generator` &bull; `⌘2`)
- **Archetype Matrix**: 7 production archetypes (Coding Agent, Image Generation, Video Generation, Full-Stack Architecture, CLI & Microservice, Freelance SOW, Hackathon MVP).
- **Clarifying Question Synthesis**: Deep reasoning engine generates 3 to 5 tailored clarifying questions to eliminate ambiguities before compiling.
- **Live Output Compiler**: Real-time syntax-highlighted Markdown preview with XML delimiter boundaries, typed schema contracts, and negative rules.
- **Interactive History Sidebar**: Instant navigation to earlier prompts and version rollbacks.

### 3. Visual DAG Branching Canvas (`/app/branching` &bull; `⌘3`)
- **Graph Orchestration**: Node-based prompt chaining built on `@xyflow/react`.
- **Specialized Node Archetypes**: Prompt nodes, router nodes, evaluator nodes, and merge nodes.
- **Non-Linear Workflows**: Chain complex multi-agent prompts, route responses based on condition checks, and merge outputs.
- **Execution Engine**: Real-time step-by-step graph traversal with visual progress indicators and cycle detection.

### 4. Multi-Model Benchmark Arena (`/app/tester` &bull; `⌘4`)
- **Head-to-Head Testing**: Run identical prompts simultaneously through two competing frontier models.
- **Side-by-Side Comparison**: Direct diff inspection and response evaluation.
- **Comparative Telemetry**: Side-by-side time-to-first-token (TTFT), total response latency, token consumption, and cost estimates.
- **Adherence Grading**: Automated evaluation against negative constraints, structure compliance, and edge cases.

### 5. Blueprint Library (`/app/library` &bull; `⌘5`)
- **Curated Prompt Templates**: Production-grade prompt blueprints across engineering, system design, creative workflows, and APIs.
- **Custom User Catalog**: Save, categorize, tag, and search custom prompt templates.
- **Instant Interpolation**: Quick variable replacement (`{{variable}}`) and direct one-click handoff to the Generator or Tester.

### 6. Historical Execution Archive (`/app/history` &bull; `⌘6`)
- **Persistent Trace Storage**: Comprehensive historical log of all compiled prompts, models used, latency metrics, and token counts.
- **One-Click Restoration**: Reopen any historical run directly into the Generator workspace with full context preserved.
- **Advanced Filtering**: Filter records by archetype, model provider, keyword, or date range.

### 7. Settings & Configuration Suite (`/app/settings`)
- **Model & Inference Settings**: Configure default model, temperature (0.0–2.0), max tokens, top_p, streaming speed (instant, smooth, typewriter), and custom global system prompt directives.
- **Token & Budget Management**: Session and weekly token limits, alert thresholds, hard-stop enforcement, BPE vs. heuristic estimation, and multi-currency tracking (USD, EUR, GBP, JPY, INR).
- **Appearance & Themes**: 5 themes (Onyx Dark, Midnight Slate, Cyber Emerald, Solar Amber, Cyberpunk Neon), typography scaling, font ligatures, and glassmorphism blur depth.
- **Developer Persona**: Customizable default developer profile and instruction set.
- **API Key Vault**: Client-side AES/SHA-256 encrypted local storage for Gemini, Groq, OpenRouter, Perplexity, Mistral, Hugging Face, Cohere, and xAI keys.
- **Local AI (Ollama)**: Seamless connection to locally running Ollama instances (`http://localhost:11434`).
- **Auto-Updater**: Automatic update checking, background downloading, and seamless installation for desktop distributions.

---

## Workstation Platforms

Bedrock is distributed as both a native desktop application and a web application with complete feature parity.

- **Desktop Application (`Electron / Tauri`)**:
  - Dedicated left-hand workstation **`Sidebar`** (`Sidebar.tsx`)
  - Full-height workstation canvas (`h-screen w-screen overflow-hidden`)
  - Global navigation shortcuts (`⌘1`–`⌘6` / `Ctrl+1`–`Ctrl+6`)
  - Context isolation, zero remote module leaks, and disabled production DevTools
  - Native auto-updater with background downloads
- **Web Application**:
  - Floating Aceternity **`Topbar`** (`Topbar.tsx`) navigation island
  - Smooth-scrolling responsive page layouts
  - Edge-ready serverless deployment on Vercel
- **Parity Invariant**: All workspaces, AI models, archetypes, exporters, settings, and telemetry are 100% identical across desktop and web.

### Official Installers

| Platform | Package | Architecture | Distribution |
| :--- | :--- | :--- | :--- |
| **Windows** | [Bedrock-Setup-1.2.5.exe](https://github.com/Bedrockxai/Bedrock/releases/latest) | `x64` | NSIS installer, Win32 PE icon, background auto-updater |
| **macOS** | [Bedrock-Mac.dmg](https://github.com/Bedrockxai/Bedrock/releases/latest) / [ZIP](https://github.com/Bedrockxai/Bedrock/releases/latest) | Universal (`arm64` + `x64`) | Apple Silicon and Intel universal dmg / zip package |
| **Web** | Self-hosted or Cloud | Modern Browsers | Edge-ready serverless deployment (Vercel / Node 20+) |

---

## Target Archetypes

| Archetype | Output Specification |
| :--- | :--- |
| **Coding Agent** | `.cursorrules` / `CLAUDE.md` with XML system tags, strict negative constraints, TypeScript contracts, and definition of done |
| **Image Generation** | Parameterized prompts for Midjourney v6, FLUX.1, and DALL-E 3 with aspect ratio, camera lens, lighting, and negative directives |
| **Video Generation** | Timeline storyboards, camera motion choreography, physics parameters, and environment cues for Runway Gen-3 and Sora |
| **Full-Stack System** | Architecture blueprints, system topologies, REST/tRPC API contracts, and relational PostgreSQL/Prisma database schemas |
| **CLI & Microservices** | Command flags, I/O pipeline specs (stdin/stdout/stderr), POSIX exit codes, and automated test scripts |
| **Freelance & SOW** | Scopes of work, deliverables prioritization, milestone schedules, and out-of-scope contractual boundaries |
| **Hackathon & MVP** | 24-hour sprint milestones, core path vs. stretch goals, demo flow scripts, and judging rubrics |

---

## Supported Models & Providers

Bedrock connects to cloud frontier models and local offline runtimes:

| Provider | Supported Models | Primary Specialty |
| :--- | :--- | :--- |
| **Google DeepMind** | Gemini 3.5 Flash Lite &bull; Gemini 3.8 Flash &bull; Gemini Flash Latest &bull; Gemini 2.5 Flash | High-speed prompt synthesis & complex multimodal reasoning |
| **Perplexity AI** | Sonar Pro &bull; Sonar Reasoning Pro &bull; Sonar &bull; Sonar Huge | Live web grounding, real-time citations & search synthesis |
| **Groq** | Llama 3.3 70B Versatile &bull; Llama 3.1 8B Instant &bull; DeepSeek R1 Distill 70B &bull; Mixtral 8x7B | Ultra-low latency LPU inference & instant completions |
| **OpenRouter** | DeepSeek V3 &bull; DeepSeek R1 &bull; Claude 3.7 Sonnet &bull; GPT-4o &bull; Mistral Large &bull; Qwen 2.5 | Frontier reasoning, code generation & multi-model fallback |
| **Mistral AI** | Mistral Large 2 &bull; Codestral &bull; Mixtral 8x22B | Specialized code generation & open European frontier models |
| **Cohere & Microsoft** | Command R+ &bull; Copilot Pro | Enterprise RAG, search connectors & document grounding |
| **xAI** | Grok 3 &bull; Grok 2 &bull; Grok Beta | Frontier reasoning & real-time knowledge synthesis |
| **Ollama (Local)** | Llama 3.2 &bull; Qwen 2.5 Coder &bull; DeepSeek R1 | 100% private, offline, air-gapped local model inference |

---

## Blueprint Library & Exporters

Bedrock provides one-click exports into 15 IDE rules, SDK clients, and raw API payloads:

### 1. IDE & Agent Directives
- **Cursor Rules** (`.cursorrules`): System rules, architecture constraints, and composer boundaries for Cursor IDE.
- **Claude Code CLI** (`CLAUDE.md`): Project memory and instructions file for Anthropic's `claude` CLI agent.
- **Windsurf Cascade** (`.windsurfrules`): Workspace rule specifications for Codeium Windsurf Cascade.
- **GitHub Copilot** (`.github/copilot-instructions.md`): Repository-level instruction specs for Copilot Chat.

### 2. Modern AI SDKs
- **Vercel AI SDK** (`route.ts`): Ready-to-run streaming endpoint with `streamText()` for Next.js and Node.js.
- **OpenAI SDK (Python)** (`openai_agent.py`): Official Python client implementation with system prompt.
- **OpenAI SDK (TypeScript)** (`openai-agent.ts`): Typed Node.js OpenAI client with completions handler.
- **Anthropic SDK (Python)** (`claude_agent.py`): Python client with top-level system parameter.
- **Anthropic SDK (TypeScript)** (`claude-agent.ts`): Typed `@anthropic-ai/sdk` client with message handler.
- **Google Gen AI (Python)** (`gemini_agent.py`): Modern `google-genai` client with `GenerateContentConfig`.
- **Google Gen AI (TypeScript)** (`gemini-agent.ts`): Typed `@google/genai` client with `systemInstruction`.
- **LangChain (Python)** (`langchain_chain.py`): Runnable LCEL chain using `ChatPromptTemplate` and `ChatOpenAI`.

### 3. Direct APIs & Payloads
- **cURL Command** (`curl-request.sh`): Direct HTTP POST command with JSON payload.
- **Raw JSON Payload** (`payload.json`): Standard OpenAI-compatible JSON messages payload.
- **Raw Markdown** (`system-prompt.md`): Formatted markdown document with YAML frontmatter.

---

## Architecture

```mermaid
graph TD
    subgraph ClientLayer["Presentation Layer (React 19 &bull; TypeScript &bull; Vite)"]
        UI["Tailwind CSS 3.4 &bull; Framer Motion &bull; GSAP"]
        Workspaces["Workstations: Dashboard &bull; Generator &bull; Branching &bull; Tester &bull; Library &bull; History &bull; Settings"]
        DAG["DAG Graph Canvas (@xyflow/react)"]
    end

    subgraph NativeLayer["Desktop Runtimes"]
        Electron["Electron 43 (Context Isolation &bull; NSIS Windows)"]
        Tauri["Tauri 2.11 (Rust Core &bull; Universal macOS DMG)"]
    end

    subgraph GatewayLayer["Cloud Gateway & Serverless API (/api/*)"]
        ExpressGateway["Vercel Serverless &bull; Express 5 Edge Engine"]
        RateLimiter["Upstash Redis Sliding-Window Rate Limiter"]
        InjectionShield["Delimiter Isolation & Prompt Injection Sanitizer"]
    end

    subgraph AILayer["AI Orchestration & Multi-Provider Proxy"]
        GoogleAI["Google DeepMind (Gemini 3.5 Flash Lite &bull; 3.8 Flash)"]
        PerplexityAI["Perplexity (Sonar Pro &bull; Sonar Reasoning)"]
        GroqAI["Groq (Llama 3.3 70B &bull; DeepSeek R1 Distill)"]
        OpenRouterAI["OpenRouter (DeepSeek R1 &bull; Claude 3.7 &bull; GPT-4o)"]
        LocalOllama["Ollama Local Gateway (Llama 3.2 &bull; Qwen 2.5 Coder)"]
    end

    subgraph PersistenceLayer["Data & Security"]
        NeonDB["Neon Serverless PostgreSQL (Prisma ORM &bull; Connection Pooler)"]
        ClerkAuth["Clerk Identity & Headless OAuth SSO"]
        TelemetryHub["Langfuse Traces &bull; PostHog Analytics &bull; Sentry"]
    end

    ClientLayer --> NativeLayer
    ClientLayer --> GatewayLayer
    GatewayLayer --> RateLimiter
    GatewayLayer --> InjectionShield
    GatewayLayer --> AILayer
    GatewayLayer --> PersistenceLayer
```

---

## Security & Production Hardening

Bedrock implements defense-in-depth security across every layer of the workstation:

| Security Vector | Implementation Detail |
| :--- | :--- |
| **Prompt Injection Defense** | Server-side regex heuristics, delimiter escape sanitizer (`### USER INPUT BEGIN ###`), and automated injection attack suites (`npm run test:injection`). |
| **Authentication & Identity** | Clerk enterprise authentication, headless OAuth SSO (GitHub / Google), and self-service OTP verification. |
| **Database Encryption** | Neon Serverless PostgreSQL with SSL/TLS encryption, parameterized queries, and strict multi-tenant data isolation. |
| **API Key Vault** | Keys prefixed with `bdk_live_`, masked in UI responses, and stored exclusively as SHA-256 cryptographic hashes or client-side encrypted storage. |
| **Layer-7 Rate Limiting** | Upstash Redis sliding-window rate limiters protecting inference endpoints, authentication routes, and telemetry ingests. |
| **Desktop Sandbox Lockdown** | Strict context isolation, disabled `nodeIntegration`, blocked remote modules, and production DevTools lockdown. |
| **Secret Leak Prevention** | Automated CI scanning across all repository files (`npm run scan:secrets`) to detect accidental credential or key leaks. |

---

## Getting Started

### Prerequisites

- **Node.js**: `20.0.0` or higher
- **Package Manager**: `npm` (v10+)
- **Database**: [Neon](https://neon.tech/) Serverless PostgreSQL account
- **Authentication**: [Clerk](https://clerk.com/) account

### Installation

Clone the repository and install dependencies:

```bash
git clone https://github.com/Bedrockxai/Bedrock.git
cd Bedrock
npm install
```

### Environment Configuration

Create a `.env.local` file in the root directory:

```env
# Clerk Authentication
VITE_CLERK_PUBLISHABLE_KEY=pk_test_xxx
CLERK_SECRET_KEY=sk_test_xxx

# Neon Serverless PostgreSQL
DATABASE_URL="postgresql://user:pass@ep-xxx-pooler.us-east-2.aws.neon.tech/bedrock?sslmode=require"
DATABASE_URL_UNPOOLED="postgresql://user:pass@ep-xxx.us-east-2.aws.neon.tech/bedrock?sslmode=require"

# AI Provider API Keys (Optional if configuring via Settings UI)
VITE_GEMINI_API_KEY=your_gemini_api_key
VITE_GROQ_API_KEY=your_groq_api_key
VITE_OPENROUTER_API_KEY=your_openrouter_api_key
VITE_PERPLEXITY_API_KEY=your_perplexity_api_key
VITE_HUGGINGFACE_API_KEY=your_huggingface_api_key

# Upstash Redis Rate Limiting (Serverless)
UPSTASH_REDIS_REST_URL="https://xxx.upstash.io"
UPSTASH_REDIS_REST_TOKEN="xxx"
```

### Database Synchronization

Initialize the database schema via Prisma:

```bash
cd server
npx prisma db push
npx prisma generate
cd ..
```

### Running Locally

```bash
# 1. Launch Web Application (http://localhost:5173)
npm run dev

# 2. Launch Electron Desktop Workstation (Development)
npm run electron:start

# 3. Launch Tauri Desktop Workstation (Development)
npm run tauri dev

# 4. Build Production Windows Installer (NSIS .exe)
npm run electron:build

# 5. Build Production macOS Universal Package (.dmg / .zip)
npm run electron:build:mac
```

---

## API Reference

### Cloud Serverless Endpoints (`/api/*`)

| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `/api/ai/synthesize` | `POST` | Synthesize structured system prompts via multi-model proxy |
| `/api/ai/generate-questions` | `POST` | Generate 3 to 5 targeted clarifying questions from project brief |
| `/api/ai/refine` | `POST` | Refine existing prompt specification with user feedback |
| `/api/ai/test` | `POST` | Parallel benchmark prompt across dual frontier models |
| `/api/prompts` | `GET` / `POST` / `DELETE` | Manage saved prompts in the user blueprint library |
| `/api/traces` | `GET` / `POST` / `DELETE` | Retrieve and ingest real-time telemetry execution traces |
| `/api/user/profile` | `GET` / `POST` | Retrieve and synchronize user profile and preferences |
| `/api/billing/create-order` | `POST` | Initialize Razorpay subscription order |
| `/api/billing/verify-payment` | `POST` | Cryptographically verify Razorpay payment signature |
| `/api/health` | `GET` | Health probe reporting service and database status |

---

## Quality Assurance & Testing

Bedrock includes a comprehensive test suite for security, quality evaluation, and performance benchmarking:

| Command | Description |
| :--- | :--- |
| `npm run test:eval` | Executes prompt quality evaluation harness against baseline prompts |
| `npm run test:injection` | Runs automated adversarial prompt injection attack suites against the compiler |
| `npm run test:attacks` | Executes security attack suites for rate limiting, payload fuzzing, and boundary traversal |
| `npm run test:k6:load` | Benchmarks multi-provider AI proxy load balancing, failover, and latency |
| `npm run test:k6:ratelimit`| Validates Upstash Redis rate limiting under concurrent load |
| `npm run test:k6:wizard` | Load tests clarifying question generation and prompt synthesis workflows |
| `npm run scan:secrets` | Scans all repository files for accidental secret, token, or key exposures |
| `npm run lint` | Runs Oxlint across the codebase for ultra-fast static analysis |
| `npm run build` | Validates TypeScript compliance (`tsc -b`) and builds production web bundle |

---

## Documentation & Compliance

Operational, architectural, and legal documentation is available in [`docs/`](./docs):

- [Privacy Policy](./docs/PRIVACY_POLICY.md)
- [Terms of Service](./docs/TERMS_OF_SERVICE.md)
- [Data Retention & Deletion Policy](./docs/DATA_RETENTION_POLICY.md)
- [Incident Response Playbook](./docs/INCIDENT_RESPONSE.md)

---

## Contributing

Contributions to Bedrock are welcome. Please ensure that all pull requests:
1. Pass type checking (`npm run build`) and linting (`npm run lint`).
2. Pass the secret scanning check (`npm run scan:secrets`).
3. Adhere to the strict desktop sidebar vs. web topbar navigation invariant defined in the design system.

---

## License

Distributed under the MIT License. See [LICENSE](LICENSE) for details.
