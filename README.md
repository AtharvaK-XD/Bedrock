<p align="center">
  <img src="./public/logo.png" alt="Bedrock Logo" width="64" height="64" />
</p>

<h1 align="center">Bedrock</h1>

<p align="center">
  Prompt engineering workstation and visual AI orchestration platform.
</p>

<p align="center">
  <a href="https://github.com/Bedrockxai/Bedrock/releases/latest"><strong>Downloads</strong></a> &bull;
  <a href="#features"><strong>Features</strong></a> &bull;
  <a href="#workstation-platforms"><strong>Platforms</strong></a> &bull;
  <a href="#architecture"><strong>Architecture</strong></a> &bull;
  <a href="#getting-started"><strong>Quick Start</strong></a> &bull;
  <a href="#api-reference"><strong>API</strong></a>
</p>

---

## Overview

Bedrock is a prompt engineering workstation and visual AI orchestration platform. Available as a cross-platform desktop application (macOS and Windows) and a web application, it provides a structured environment to synthesize, refine, orchestrate, and benchmark prompts across frontier AI providers.

Bedrock replaces unstructured text prompts with formal specifications: dynamic clarifying questionnaires, visual node-based execution DAGs, dual-model benchmarking, real-time token and latency telemetry, and one-click export into 15 IDE and SDK formats.

---

## Workstation

| Prompt Synthesis & Refinement | DAG Branching Canvas |
| :---: | :---: |
| <img src="./public/screenshots/03_generator_wizard.png" width="460" alt="Prompt Synthesis" /> | <img src="./public/screenshots/04_branching_canvas.png" width="460" alt="DAG Branching Canvas" /> |

| Multi-Model Benchmark Arena | Telemetry & Observability HUD |
| :---: | :---: |
| <img src="./public/screenshots/05_arena_benchmark.png" width="460" alt="Benchmark Arena" /> | <img src="./public/screenshots/02_dashboard_hud.png" width="460" alt="Telemetry Dashboard" /> |

---

## Features

- **System Prompt Synthesis**: Generates production-ready system instructions, XML delimiter boundaries, TypeScript interfaces, and negative constraint matrices from project briefs.
- **Clarifying Question Synthesis**: Analyzes briefs in real time to generate 3 to 5 targeted questions that eliminate scope ambiguity before compilation.
- **Visual DAG Branching Canvas**: Graph-based node orchestration (`@xyflow/react`) for non-linear prompt chaining, condition routing, merge nodes, and automated evaluations.
- **Parallel Multi-Model Benchmarking**: Dispatches identical prompt configurations across two frontier models simultaneously to benchmark latency, token cost, and adherence.
- **Blueprint Library & Exporters**: 15 one-click export targets including Cursor (`.cursorrules`), Claude Code (`CLAUDE.md`), Windsurf (`.windsurfrules`), Vercel AI SDK, OpenAI SDK, Anthropic SDK, and raw JSON schemas.
- **Real-Time Telemetry & HUD**: Live monitoring of inference counts, token usage, P99 latency, SLA reliability, execution traces, and a 52-week activity heatmap.
- **Defense-in-Depth Security**: Delimiter isolation shields, adversarial injection defense suites, Upstash Redis sliding-window rate limiters, and automated secret scanning.

---

## Workstation Platforms

Bedrock maintains complete feature parity between the desktop client and web application.

- **Desktop Application (`Electron / Tauri`)**: Left-hand sidebar layout, full-height viewport (`h-screen w-screen`), global keyboard shortcuts (`⌘1`–`⌘6`), and sandboxed execution.
- **Web Application**: Floating navigation header with responsive scrolling layouts.
- **Parity**: Identical workspaces, AI models, prompt archetypes, exporters, and telemetry across both distributions.

### Official Installers

| Platform | Installer | Architecture | Details |
| :--- | :--- | :--- | :--- |
| **Windows** | [Bedrock-Setup-1.2.4.exe](https://github.com/Bedrockxai/Bedrock/releases/latest) | `x64` | NSIS installer, Win32 PE icon, auto-updater |
| **macOS** | [Bedrock-Mac.dmg](https://github.com/Bedrockxai/Bedrock/releases/latest) / [ZIP](https://github.com/Bedrockxai/Bedrock/releases/latest) | Universal (`arm64` + `x64`) | Apple Silicon and Intel universal package |
| **Web** | Self-hosted or Cloud | Modern Browsers | Edge-ready serverless deployment |

---

## Target Archetypes

| Archetype | Compilation Specification |
| :--- | :--- |
| **Coding Agent** | `.cursorrules` / `CLAUDE.md` with XML tags, strict negative constraints, TypeScript contracts, and definition of done |
| **Image Generation** | Parameterized blocks for Midjourney v6, FLUX.1, and DALL-E 3 with aspect ratio, lens, and negative directives |
| **Video Generation** | Timeline storyboards, camera motion choreography, environment cues, and physics specs for Runway Gen-3 and Sora |
| **Full-Stack System** | End-to-end architecture specifications, system topologies, API contracts, and relational database schemas |
| **CLI & Microservices** | Command flags, I/O pipeline specs (stdin/stdout/stderr), POSIX exit codes, and automated test scripts |
| **Freelance & SOW** | Scopes of work, deliverables prioritization, responsive specs, and out-of-scope boundaries |
| **Hackathon & MVP** | 24-hour sprint milestones, core path vs. stretch goals, demo flow scripts, and judging rubrics |

---

## Architecture

```mermaid
graph TD
    Client["Presentation Layer<br/>React 19 &bull; TypeScript &bull; Vite &bull; Tailwind CSS"]
    Desktop["Desktop Runtime<br/>Electron &bull; Tauri 2.0"]
    Gateway["Cloud Gateway<br/>Vercel Serverless &bull; Express 5"]
    AI["AI Gateway<br/>Gemini &bull; Groq &bull; OpenRouter &bull; Hugging Face"]
    Data["Persistence & Auth<br/>Neon PostgreSQL &bull; Clerk Auth &bull; Upstash Redis"]

    Client --> Desktop
    Client --> Gateway
    Gateway --> AI
    Gateway --> Data
```

---

## Security & Hardening

| Vector | Implementation |
| :--- | :--- |
| **Prompt Injection Defense** | Server-side regex heuristics, delimiter escape sanitizer (`### USER INPUT BEGIN ###`), and automated injection test suites (`npm run test:injection`). |
| **Authentication & Identity** | Clerk enterprise authentication, headless OAuth SSO (GitHub/Google), and self-service OTP verification. |
| **Database Encryption** | Neon Serverless PostgreSQL with SSL/TLS encryption, parameterized queries, and strict multi-tenant tenant isolation. |
| **API Key Security** | Keys prefixed with `bdk_live_`, masked in UI responses, and stored exclusively as SHA-256 cryptographic hashes. |
| **Rate Limiting** | Layer-7 Upstash Redis sliding-window rate limiters on general, authentication, and webhook routes. |
| **Desktop Lockdown** | Context isolation, disabled `nodeIntegration`, blocked remote modules, and disabled DevTools in production. |
| **Secret Scanning** | Automated CI scanning across repository files (`npm run scan:secrets`) to prevent credential or token exposure. |

---

## Getting Started

### Prerequisites

- Node.js 20.0.0 or higher
- [Neon](https://neon.tech/) account (Serverless PostgreSQL)
- [Clerk](https://clerk.com/) account (Authentication)

### Installation

```bash
git clone https://github.com/Bedrockxai/Bedrock.git
cd Bedrock
npm install
```

### Environment Setup

Create `.env.local` in the project root:

```env
# Clerk Authentication
VITE_CLERK_PUBLISHABLE_KEY=pk_test_xxx
CLERK_SECRET_KEY=sk_test_xxx

# Neon Serverless PostgreSQL
DATABASE_URL="postgresql://user:pass@ep-xxx-pooler.us-east-2.aws.neon.tech/bedrock?sslmode=require"
DATABASE_URL_UNPOOLED="postgresql://user:pass@ep-xxx.us-east-2.aws.neon.tech/bedrock?sslmode=require"

# AI Provider API Keys
VITE_GEMINI_API_KEY=your_gemini_api_key
VITE_GROQ_API_KEY=your_groq_api_key
VITE_OPENROUTER_API_KEY=your_openrouter_api_key
VITE_HUGGINGFACE_API_KEY=your_huggingface_api_key
```

### Database Synchronization

```bash
cd server
npx prisma db push
npx prisma generate
cd ..
```

### Running Locally

```bash
# Web application (http://localhost:5173)
npm run dev

# Electron desktop workstation (development)
npm run electron:start

# Build production Windows installer (NSIS)
npm run electron:build

# Build production macOS package (DMG / ZIP)
npm run electron:build:mac
```

---

## API Reference

### Cloud Serverless API (`/api/*`)

| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `/api/ai/synthesize` | `POST` | Synthesize structured system prompts via multi-model proxy |
| `/api/ai/generate-questions` | `POST` | Generate 3 to 5 clarifying questions from brief |
| `/api/ai/refine` | `POST` | Refine existing prompt with targeted user feedback |
| `/api/ai/test` | `POST` | Parallel benchmark prompt across dual models |
| `/api/prompts` | `GET` / `POST` / `DELETE` | Manage saved prompts library |
| `/api/traces` | `GET` / `POST` / `DELETE` | Access telemetry and execution metrics |
| `/api/user/profile` | `GET` / `POST` | Retrieve and update user profile data |
| `/api/billing/create-order` | `POST` | Create Razorpay order for subscription plans |
| `/api/billing/verify-payment` | `POST` | Verify Razorpay payment signature |
| `/api/health` | `GET` | Service and database connectivity health probe |

---

## Quality Assurance & Testing

| Command | Description |
| :--- | :--- |
| `npm run scan:secrets` | Scans all repository files for accidental secret or key leaks |
| `npm run test:injection` | Executes automated adversarial prompt injection attack suites |
| `npm run test:attacks` | Runs security attack suites for rate limiting and payload fuzzing |
| `npm run test:k6:load` | Benchmarks multi-provider AI proxy load balancing and failover latency |
| `npm run build` | Validates TypeScript compliance (`tsc -b`) and builds web bundle |
| `npm run lint` | Runs Oxlint across the codebase for fast static analysis |

---

## Documentation & Compliance

Operational and legal policies are located in [`docs/`](./docs):

- [Privacy Policy](./docs/PRIVACY_POLICY.md)
- [Terms of Service](./docs/TERMS_OF_SERVICE.md)
- [Data Retention & Deletion Policy](./docs/DATA_RETENTION_POLICY.md)
- [Incident Response Playbook](./docs/INCIDENT_RESPONSE.md)

---

## License

Distributed under the MIT License. See [LICENSE](LICENSE) for details.
