# Bedrock

Bedrock is an enterprise-grade prompt engineering workstation and orchestration platform. Available as a cross-platform desktop application and full-stack cloud service, Bedrock bridges the gap between raw LLM APIs and structured prompt architecture through automated synthesis, interactive dual-panel refinement, visual node-based execution graphs, parallel multi-model benchmarking, real-time telemetry, and a hardened production backend.

---

## Architecture Overview

```
┌────────────────────────────────────────────────────────┐
│               BEDROCK PRESENTATION LAYER               │
│   React 19 + TypeScript + Vite + Tailwind CSS + GSAP   │
└───────────┬────────────────────────────────┬───────────┘
            │                                │
            ▼                                ▼
┌───────────────────────────┐    ┌───────────────────────────┐
│   NATIVE DESKTOP CLIENT   │    │    CLOUD & SERVERLESS     │
│    Tauri 2.0 / Electron   │    │   Vercel / Node.js API    │
├───────────────────────────┤    ├───────────────────────────┤
│ • OS Security Sandboxing  │    │ • Clerk Auth & OAuth SSO  │
│ • Zero DevTools Tampering │    │ • Multi-Model AI Proxy    │
│ • Native Auto-Updater     │    │ • Anti-Prompt Injection   │
│ • GPU Physics Acceleration│    │ • Razorpay Webhook Engine │
└───────────────────────────┘    │ • Sliding Rate Limiters   │
                                 └─────────────┬─────────────┘
                                               │
            ┌──────────────────────────────────┤
            │                                  │
            ▼                                  ▼
┌───────────────────────────┐    ┌───────────────────────────┐
│    AI PROVIDER MATRIX     │    │  PERSISTENCE & TELEMETRY  │
├───────────────────────────┤    ├───────────────────────────┤
│ • Google Gemini (2.5 Pro) │    │ • Neon Serverless Postgres│
│ • Groq (Llama 3.3 / 8B)   │    │ • Real-time Traces & HUD  │
│ • OpenRouter & HuggingFace│    │ • Dynamic Activity Heatmap│
│ • Multi-Key Round Robin   │    │ • PostHog & Sentry Tracing│
└───────────────────────────┘    └───────────────────────────┘
```

---

## Core Capabilities

### 1. System Prompt Synthesis Engine
- **Target Archetypes**: Tailor generation logic for specific deployment targets: autonomous coding agents, freelancer technical briefs, hackathon prototypes, and structured enterprise specifications.
- **Dynamic Question Synthesis**: Analyzes project briefs in real-time, calling LLM backends to generate 3 to 5 targeted clarifying questions to eliminate ambiguities before prompt compilation.
- **Structured Output Generation**: Synthesizes responses into production-ready system instructions, XML delimiter boundaries, few-shot examples, and architectural constraints.

### 2. Interactive Refinement & Resizable Canvas
- **Dual-Panel Workspace**: Side-by-side prompt composition and real-time generation output built on `react-resizable-panels`.
- **Constraint Thresholds**: Enforces strict layout boundaries (minimum 30% panel width, maximum 70% panel width) to prevent UI squishing across varying screen dimensions.
- **Iterative Feedback Loop**: Submit targeted feedback to dynamically refine system personas, few-shot examples, and edge case handling with visual diff comparisons.
- **Export & Portability**: Instant one-click copy, JSON schema export, and direct handoff to the Branching Canvas or Multi-Model Tester.

### 3. Visual Branching Canvas
- **Graph Topologies**: Powered by `@xyflow/react`, enabling non-linear prompt experimentation, conversational branching, and pipeline chaining.
- **Node Taxonomy**:
  - **System Persona**: Configures underlying system context, boundaries, and behavioral constraints.
  - **User Prompt**: Primary user input instructions and variable injection targets.
  - **AI Output**: Captures generation outputs for validation and downstream chaining.
  - **Data Context**: Supplies document embeddings, raw text snippets, or structured key-value variables.
  - **Condition / Router**: Evaluates output content to route flow paths dynamically.
  - **Code Script**: Executes transformations and custom formatting logic between nodes.
  - **Merge**: Combines multiple branch outputs into a unified input payload.
  - **Evaluation**: Performs rubric-based scoring and quality grading on generation results.
- **Execution States**: Real-time visual status indicators (idle, running, success, error) with per-node execution controls.

### 4. Multi-Model Prompt Benchmark Console
- **Parallel Dual Execution**: Dispatches identical prompt configurations across two distinct model providers simultaneously to benchmark variance, latency, formatting compliance, and token efficiency.
- **Supported Model Providers**:
  - **Google Gemini**: Gemini 2.5 Pro, Gemini 2.5 Flash
  - **Groq**: Llama 3.3 70B Versatile, Llama 3.1 8B Instant
  - **OpenRouter**: Llama 3.1 8B, Gemma 2 9B, Mistral 7B, Phi-3 Mini, Nvidia Nemotron 70B
  - **Hugging Face Serverless**: Mistral 7B Instruct, Qwen 2.5 72B, Meta Llama 3 8B, Zephyr 7B
- **Configuration Controls**: Independent adjustment of system instructions, temperature, token limits, and target credentials per model instance.

### 5. Identity, Authentication & Profile Management
- **Clerk Authentication**: Enterprise authentication powered by `@clerk/react` supporting email/password and single sign-on.
- **Multi-Provider OAuth SSO**: Seamless one-click authentication with GitHub and Google OAuth via dedicated popup windows.
- **Self-Service Password Reset**: Interactive in-app forgot password flow utilizing Clerk email verification OTP codes with automated session cleanup.
- **Neon DB User Sync**: Automatically syncs Clerk user identity, avatars, real display names, and billing tiers to the cloud PostgreSQL database.
- **Zero-Data Isolation for New Signups**: Each new user account receives a clean slate with personal prompt history and telemetry isolated in the database.

### 6. Real-Time Telemetry HUD & Execution Traces
- **Live Metrics Dashboard**: Real-time HUD tracking Total Inferences, Token Consumption, Average Latency, P99 Latency, and SLA Reliability percentage.
- **Execution Traces Feed**: Real-time stream of all LLM inference operations recorded with model target, token usage, latency (ms), timestamp, and status.
- **2D Network Topology**: Interactive canvas visualization (`NetworkTopology2D`) mapping real-time data flows between the client, API gateway, AI models, and database.
- **Prompt Activity Heatmap**: 52-week GitHub-style contribution calendar displaying daily prompt engineering activity calculated directly from user database records.

### 7. Luxury Glassmorphic Design System
- **Custom Model Selector**: Handcrafted frosted-glass dropdown in Settings replacing default OS `<select>` elements with glowing provider badges and smooth animations.
- **Dark Mode Aesthetic**: Custom HSL color palettes, subtle mesh gradients, and interactive hover effects.
- **Cinematic Transitions**: Silky smooth scrolling powered by Lenis and hardware-accelerated animations via GSAP and Framer Motion.

### 8. Cloud-Native Serverless & Express Architecture
- **Vercel Serverless (`api/`)**: Production edge-compatible serverless functions for prompt synthesis, refinement, traces, billing, and user management.
- **Express 5 API (`server/`)**: High-performance local and self-hosted REST backend built with TypeScript and NodeNext ESM.
- **Neon Serverless PostgreSQL**: High-performance cloud database with connection pooling (`DATABASE_URL`) and direct access (`DIRECT_URL`) for zero-maintenance auto-scaling.
- **Observability Suite**: Sentry React SDK for exception monitoring and PostHog for telemetry and user session replays.

---

## Production Security & Hardening

Bedrock implements defense-in-depth across the client, network, application, and database tiers:

| Security Vector | Implementation Detail |
| :--- | :--- |
| **Prompt Injection Defense** | Server-side adversarial regex heuristics, delimiter escape sanitizer (`### USER INPUT BEGIN ###`), and automated regression tests (`npm run test:injection`). |
| **Authentication & Identity** | Clerk enterprise authentication, multi-provider OAuth (GitHub/Google), self-service OTP verification, and Argon2 + JWT HttpOnly cookie fallback. |
| **Database Encryption & Isolation** | Neon Serverless PostgreSQL with SSL/TLS encryption, parameterized SQL queries, foreign key cascades, and per-user data tenancy. |
| **API Key Cryptography** | User API keys are prefixed with `bdk_live_`, masked in UI responses, and stored exclusively as SHA-256 cryptographic hashes. |
| **Rate Limiting & DDoS Shield** | Layer-7 tiered sliding-window rate limiters: General endpoints (300 req / 15 min), Auth routes (15 req / 15 min), and Webhook endpoints. |
| **Desktop Lockdown** | Electron & Tauri runtimes enforce context isolation, disable `nodeIntegration`, block remote modules, and lock out DevTools / debugger shortcuts in production builds. |
| **HTTP Security Headers** | Helmet-enforced Content Security Policy (CSP), HTTP Strict Transport Security (HSTS), and HTTP Parameter Pollution (`hpp`) protection. |
| **CORS Policy** | Strict origin whitelisting supporting desktop custom protocols (`tauri://localhost`, `electron://localhost`) and official domains. |
| **Input Validation** | All requests are validated at the gateway using strict Zod schemas with JSON payload size caps (2MB limit). |
| **Automated Secret Scanning** | Continuous CI scanning across 790+ files (`npm run scan:secrets`) to prevent credentials, private keys, or API tokens from being committed. |
| **Observability & Error Auditing** | Integrated Sentry error tracing and PostHog analytics for immediate visibility into production anomalies. |

---

## Directory Structure

```
Bedrock/
├── api/                         # Vercel Serverless API functions
│   ├── _lib/                    # Serverless shared utilities (auth, db, security, ai proxy)
│   ├── ai/                      # AI synthesis, question generation, refinement, testing
│   ├── billing/                 # Razorpay order creation and payment verification
│   ├── prompts/                 # User prompt CRUD and persistence
│   ├── traces/                  # Execution traces and telemetry aggregation
│   ├── user/                    # User profile management and sync
│   ├── workflows/               # Canvas workflow graph persistence
│   └── health.ts                # Liveness and readiness probes
├── docs/                        # Compliance, legal, and operational documentation
│   ├── DATA_RETENTION_POLICY.md # Data lifecycle, export, and deletion policies
│   ├── INCIDENT_RESPONSE.md     # Security incident escalation and containment playbook
│   ├── PRIVACY_POLICY.md        # GDPR, CCPA, and DPDP-compliant privacy policy
│   └── TERMS_OF_SERVICE.md      # Platform usage terms and SLA specifications
├── public/                      # Static branding assets and application icons
├── scripts/
│   ├── scan-secrets.js          # Automated pre-commit and CI credential leak scanner
│   └── release.js               # Automated GitHub release tag and artifact publisher
├── server/                      # Hardened Express 5 backend (standalone / self-hosted)
│   ├── prisma/                  # Prisma ORM schema and migrations (PostgreSQL / SQLite)
│   ├── src/
│   │   ├── middleware/          # Security headers, auth verification, rate limiters
│   │   ├── routes/              # Modular API endpoints (ai, auth, billing, health, prompts)
│   │   ├── services/            # AI provider proxy, TTL cache, metrics collection
│   │   ├── config.ts            # Environment validation and security configuration
│   │   ├── db.ts                # Prisma client singleton and security audit logger
│   │   └── index.ts             # Server entry point and graceful shutdown hooks
│   ├── tests/
│   │   ├── prompt-injection-runner.ts # 4-vector adversarial prompt injection test suite
│   │   └── security-attack-suite.ts   # Rate-limiting, XSS, and payload fuzz testing
│   ├── .env.example             # Server environment template
│   └── package.json             # Server dependencies and scripts
├── src/                         # Frontend application (React 19 + TypeScript + Vite)
│   ├── components/
│   │   ├── auth/                # Clerk authentication cards, OTP reset, and modal triggers
│   │   ├── dashboard/           # Real-time telemetry HUD and 2D network topology graph
│   │   ├── generator/           # History sidebar, clarifying questions, and prompt input
│   │   ├── landing/             # Hero section, feature matrices, and interactive previews
│   │   ├── layout/              # Sidebar navigation, Topbar, and star field background
│   │   ├── profile/             # PromptActivityHeatmap and user statistics
│   │   └── ui/                  # Frosted-glass dropdowns, badges, buttons, and modals
│   ├── lib/                     # API adapters, telemetry engine, updater hooks, auth helpers
│   ├── pages/                   # Application views (Wizard, Canvas, Tester, Dashboard, Profile, Settings, etc.)
│   ├── App.tsx                  # Root layout, routing, Lenis smooth scroll, and theme provider
│   └── index.css                # Global design system tokens and Tailwind CSS rules
├── src-tauri/                   # Rust native desktop runtime (Tauri 2.0)
│   ├── capabilities/            # OS permissions and sandboxing manifests
│   └── tauri.conf.json          # Desktop packaging and bundle configuration
├── .github/
│   └── workflows/
│       ├── release.yml          # Automated multi-platform desktop release builder
│       └── security.yml         # Continuous secret scanning, dependency audit, and build check
├── vite.config.ts               # Vite configuration with API reverse proxies
└── package.json                 # Project scripts and dependencies
```

---

## API Endpoints Reference

### Serverless Cloud API (`/api/*`)

| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `/api/traces` | `GET` | Fetches recent execution traces and aggregates telemetry metrics (tokens, latency, reliability). |
| `/api/traces` | `POST` | Records a new model inference trace to the database. |
| `/api/traces` | `DELETE` | Clears stored execution traces for the authenticated user. |
| `/api/prompts` | `GET` | Retrieves all saved prompts for the authenticated user. |
| `/api/prompts` | `POST` | Saves or updates a prompt in the user's library. |
| `/api/prompts` | `DELETE` | Removes a saved prompt by ID. |
| `/api/user/profile` | `GET` | Retrieves the authenticated user's profile and plan details. |
| `/api/user/profile` | `POST` | Updates profile metadata, bio, social links, and settings. |
| `/api/ai/synthesize` | `POST` | Generates a structured system prompt using the multi-model proxy. |
| `/api/ai/generate-questions` | `POST` | Generates 3-5 clarifying questions based on a user brief. |
| `/api/ai/refine` | `POST` | Refines an existing prompt based on iterative user feedback. |
| `/api/ai/test` | `POST` | Benchmarks a prompt across dual AI models in parallel. |
| `/api/billing/create-order` | `POST` | Generates a Razorpay payment order for subscription upgrades. |
| `/api/billing/verify-payment` | `POST` | Cryptographically validates payment signature and upgrades user plan. |
| `/api/health` | `GET` | Liveness and database connectivity health probe. |

### Express 5 Backend API (`server/`)

| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `/api/auth/register` | `POST` | Registers account with Argon2 password hashing. |
| `/api/auth/login` | `POST` | Authenticates user, enforces lockout counters, sets JWT cookie. |
| `/api/auth/logout` | `POST` | Invalidates session and clears authentication cookies. |
| `/api/auth/me` | `GET` | Retrieves authenticated user profile and subscription status. |
| `/api/workflows` | `GET` / `POST` | Lists or saves visual node graph canvas workflows. |
| `/api/workflows/:id` | `PUT` / `POST` | Updates or triggers server-side execution of node graphs. |
| `/api/billing/webhook` | `POST` | Verifies Razorpay HMAC-SHA256 signature and provisions quotas. |

---

## Getting Started

### 1. Prerequisites
- **Node.js**: `v20.0.0` or higher (LTS recommended).
- **npm**: `v10.0.0` or higher.
- **Neon Account**: Free serverless PostgreSQL database ([neon.tech](https://neon.tech/)).
- **Clerk Account**: Free authentication provider ([clerk.com](https://clerk.com/)).
- **Rust Toolchain**: Optional, required only for native Tauri desktop packaging ([rustup.rs](https://rustup.rs/)).

### 2. Installation
Clone the repository and install dependencies:

```bash
# Clone the repository
git clone https://github.com/AtharvaK-XD/Bedrock.git
cd Bedrock

# Install frontend and serverless dependencies
npm install

# Install standalone server dependencies (optional)
cd server
npm install
cd ..
```

### 3. Environment Setup

#### Frontend & Serverless Configuration (`.env.local` in root)
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

# Observability (Optional)
VITE_POSTHOG_KEY=your_posthog_key
VITE_POSTHOG_HOST=https://us.i.posthog.com
VITE_SENTRY_DSN=your_sentry_dsn

# Payments (Optional)
VITE_RAZORPAY_KEY_ID=rzp_test_xxx
RAZORPAY_KEY_SECRET=your_razorpay_secret
```

#### Standalone Server Configuration (`server/.env`)
```bash
cp server/.env.example server/.env
```
Fill in your configuration:
```env
DATABASE_URL="postgresql://user:pass@ep-xxx-pooler.us-east-2.aws.neon.tech/bedrock?sslmode=require"
DIRECT_URL="postgresql://user:pass@ep-xxx.us-east-2.aws.neon.tech/bedrock?sslmode=require"
PORT=3000
NODE_ENV=development
JWT_SECRET=your_secure_random_jwt_secret

# AI Provider Keys
GROQ_API_KEY=your_groq_api_key
OPENROUTER_API_KEY=your_openrouter_api_key
GEMINI_API_KEY=your_gemini_api_key

# Razorpay
RAZORPAY_KEY_ID=rzp_test_xxx
RAZORPAY_KEY_SECRET=your_razorpay_secret
RAZORPAY_WEBHOOK_SECRET=your_webhook_secret
```

### 4. Database Setup
Synchronize the PostgreSQL schema via Prisma:

```bash
cd server
npx prisma db push
npx prisma generate
cd ..
```

---

## Running Bedrock

### Run Web Application (with Vercel Serverless / Vite)
```bash
npm run dev
```
Access the application in your browser at `http://localhost:5173`.

### Run Standalone Express 5 Backend (Optional)
```bash
cd server
npm run dev
```
The backend API boots on `http://localhost:3000`.

### Run Native Desktop Client (Tauri)
```bash
npm run tauri dev
```

---

## Testing & Quality Assurance

| Command | Purpose |
| :--- | :--- |
| `npm run scan:secrets` | Scans all repository files for accidental secret or API key leaks. |
| `npm run test:injection` | Executes automated adversarial prompt injection attack suites against the backend parser. |
| `npm run test:attacks` | Runs security attack suites covering rate limiting, XSS, and payload fuzz testing. |
| `npm run build` | Validates TypeScript type compliance (`tsc -b`) and compiles production web assets. |
| `npm run lint` | Runs Oxlint across the frontend codebase for high-performance static analysis. |
| `npm run tauri build` | Packages release-optimized native desktop installers (`.msi`, `.dmg`, `.AppImage`). |

---

## Compliance & Legal Policies

All policies governing user data protection, retention schedules, and incident protocols are accessible in the app (`/privacy`, `/terms`) and documented in [`docs/`](./docs):
- [Privacy Policy](./docs/PRIVACY_POLICY.md)
- [Terms of Service](./docs/TERMS_OF_SERVICE.md)
- [Data Retention & Deletion Policy](./docs/DATA_RETENTION_POLICY.md)
- [Security Incident Response Playbook](./docs/INCIDENT_RESPONSE.md)

---

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.
