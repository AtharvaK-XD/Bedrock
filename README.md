# Bedrock

Bedrock is an enterprise-grade prompt engineering workstation and orchestration platform. Available as a cross-platform desktop application and full-stack web service, Bedrock bridges the gap between raw LLM APIs and structured prompt architecture through automated synthesis, visual node-based execution graphs, parallel multi-model benchmarking, and a hardened production backend.

---

## Architecture Overview

```
                                    ┌────────────────────────────────────────────────────────┐
                                    │               BEDROCK PRESENTATION LAYER               │
                                    │    React 19 + TypeScript + Vite + Tailwind CSS + GSAP  │
                                    └───────────────────┬────────────────────────────────────┘
                                                        │
                         ┌──────────────────────────────┴──────────────────────────────┐
                         ▼                                                             ▼
       ┌───────────────────────────────────┐                         ┌───────────────────────────────────┐
       │      NATIVE DESKTOP RUNTIME       │                         │     HARDENED EXPRESS 5 API        │
       │     Tauri 2.0 / Electron Core     │                         │        Node.js + TypeScript       │
       ├───────────────────────────────────┤                         ├───────────────────────────────────┤
       │ • Operating System Sandboxing     │                         │ • Multi-Provider AI Proxy Layer   │
       │ • Zero DevTools / Debug Tampering │                         │ • Anti-Prompt Injection Engine    │
       │ • Native Process & Auto-Updater   │                         │ • Argon2 + JWT HttpOnly Auth      │
       │ • Hardware-Accelerated Physics    │                         │ • Razorpay Webhook Signatures     │
       └───────────────────────────────────┘                         │ • Sliding-Window Rate Limiters    │
                                                                     │ • Prisma ORM (SQLite / Postgres)  │
                                                                     └─────────────────┬─────────────────┘
                                                                                       │
                                         ┌─────────────────────────────────────────────┴─────────────────┐
                                         ▼                                                               ▼
                       ┌───────────────────────────────────┐                           ┌───────────────────────────────────┐
                       │        AI PROVIDER MATRIX         │                           │        PERSISTENCE & AUDIT        │
                       ├───────────────────────────────────┤                           ├───────────────────────────────────┤
                       │ • Groq (Llama 3.1 70B / 8B)       │                           │ • Prisma ORM (SQLite / Neon PG)   │
                       │ • OpenRouter (Gemma, Mistral, ...)│                           │ • In-Memory TTL Query Cache       │
                       │ • Google Gemini (2.5 Pro / Flash) │                           │ • Execution Traces & Metrics      │
                       │ • Hugging Face Serverless         │                           │ • Tamper-Evident Security Logs    │
                       └───────────────────────────────────┘                           └───────────────────────────────────┘
```

---

## Core Capabilities

### 1. System Prompt Synthesis Engine
- **Target Archetypes**: Tailor generation logic for specific deployment targets: autonomous coding agents, freelancer technical briefs, hackathon prototypes, and structured enterprise specifications.
- **Dynamic Question Synthesis**: Analyzes project briefs in real-time, calling LLM backends to generate 3 to 5 targeted clarifying questions to eliminate ambiguities before prompt compilation.
- **Structured Output Generation**: Synthesizes responses into production-ready system instructions, XML delimiter boundaries, few-shot examples, and architectural constraints.

### 2. Visual Branching Canvas
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

### 3. Multi-Model Prompt Benchmark Console
- **Parallel Dual Execution**: Dispatches identical prompt configurations across two distinct model providers simultaneously to benchmark variance, latency, formatting compliance, and token efficiency.
- **Supported Model Providers**:
  - **Google Gemini**: Gemini 2.5 Pro, Gemini 2.5 Flash
  - **Groq**: Llama 3.1 70B Versatile, Llama 3.1 8B Instant
  - **OpenRouter**: Llama 3.1 8B, Gemma 2 9B, Mistral 7B, Phi-3 Mini, Nvidia Nemotron 70B
  - **Hugging Face Serverless**: Mistral 7B Instruct, Qwen 2.5 72B, Meta Llama 3 8B, Zephyr 7B
- **Configuration Controls**: Independent adjustment of system instructions, temperature, token limits, and target credentials per model instance.

### 4. Enterprise Production Backend (`server/`)
- **Express 5 + TypeScript ESM**: High-performance REST API built with NodeNext module resolution.
- **Prisma ORM**: Strongly-typed database layer with support for local SQLite development and serverless Neon PostgreSQL production deployments.
- **Multi-Provider AI Proxy**: Shields API keys on the server side, handles round-robin key pooling across provider accounts, and implements automatic fallbacks upon rate limiting.
- **In-Memory TTL Cache & Queue**: Deduplicates identical prompt synthesis queries and buffers concurrent inference requests.
- **Razorpay Payments & Webhooks**: Handles subscription lifecycle, automatic quota allocations, and cryptographically verified webhook signatures (`X-Razorpay-Signature`).

---

## Production Security & Hardening

Bedrock implements defense-in-depth across the client, network, application, and database tiers:

| Security Vector | Implementation Detail |
| :--- | :--- |
| **Prompt Injection Defense** | Server-side adversarial regex heuristics, delimiter escape sanitizer (`### USER INPUT BEGIN ###`), and automated regression tests (`npm run test:injection`). |
| **Authentication & Sessions** | Argon2 password hashing, JWTs stored in `HttpOnly`, `SameSite=Strict`, `Secure` cookies with 7-day expiration and automatic account lockout after 5 consecutive failures. |
| **API Key Cryptography** | User API keys are prefixed with `bdk_live_`, masked in UI responses, and stored exclusively as SHA-256 cryptographic hashes. |
| **Rate Limiting & DDoS Shield** | Layer-7 tiered sliding-window rate limiters: General endpoints (300 req / 15 min), Auth routes (15 req / 15 min), and Webhook endpoints. |
| **Desktop Lockdown** | Electron & Tauri runtimes enforce context isolation, disable `nodeIntegration`, block remote modules, and lock out DevTools / debugger shortcuts in production builds. |
| **HTTP Security Headers** | Helmet-enforced Content Security Policy (CSP), HTTP Strict Transport Security (HSTS), and HTTP Parameter Pollution (`hpp`) protection. |
| **CORS Policy** | Strict origin whitelisting supporting desktop custom protocols (`tauri://localhost`, `electron://localhost`) and official domains. |
| **Input Validation** | All requests are validated at the gateway using strict Zod schemas with JSON payload size caps (2MB limit). |
| **Automated Secret Scanning** | Continuous CI scanning across 790+ files (`npm run scan:secrets`) to prevent credentials, private keys, or API tokens from being committed. |

---

## Directory Structure

```
Bedrock/
├── docs/                        # Compliance, legal, and operational documentation
│   ├── DATA_RETENTION_POLICY.md # Data lifecycle, export, and deletion policies
│   ├── INCIDENT_RESPONSE.md     # Security incident escalation and containment playbook
│   ├── PRIVACY_POLICY.md        # GDPR, CCPA, and DPDP-compliant privacy policy
│   └── TERMS_OF_SERVICE.md      # Platform usage terms and SLA specifications
├── public/                      # Static branding assets and application icons
├── scripts/
│   └── scan-secrets.js          # Automated pre-commit and CI credential leak scanner
├── server/                      # Hardened Express 5 production backend
│   ├── prisma/                  # Prisma ORM schema and migrations (SQLite / PostgreSQL)
│   ├── src/
│   │   ├── middleware/          # Security headers, auth verification, rate limiters, error handling
│   │   ├── routes/              # Modular API endpoints (ai, auth, billing, health, prompts, workflows)
│   │   ├── services/            # AI provider proxy, TTL cache, metrics collection, queues
│   │   ├── config.ts            # Environment validation and security configuration
│   │   ├── db.ts                # Prisma client singleton and security audit logger
│   │   └── index.ts             # Server entry point and graceful shutdown hooks
│   ├── tests/
│   │   └── prompt-injection-runner.ts # Automated 4-vector adversarial prompt injection test suite
│   ├── .env.example             # Server environment template
│   └── package.json             # Server dependencies and scripts
├── src/                         # Frontend application (React 19 + TypeScript)
│   ├── components/              # UI primitives, canvas nodes, and auth modals
│   ├── lib/                     # Client API adapters, mock handlers, and updater hooks
│   ├── pages/                   # Application views (Wizard, Canvas, Tester, Billing, Settings)
│   ├── App.tsx                  # Root layout, routing, and Lenis smooth scroll
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

## API Endpoints Reference (`server/`)

### Authentication (`/api/auth`)
- `POST /api/auth/register` — Registers a user account with Argon2 password hashing.
- `POST /api/auth/login` — Authenticates user, enforces lockout counters, and sets secure JWT cookie.
- `POST /api/auth/logout` — Invalidates user session and clears authentication cookies.
- `GET  /api/auth/me` — Retrieves authenticated user profile and subscription status.

### AI Proxy & Inference (`/api/ai`)
- `POST /api/ai/generate` — Dispatches prompt generation through server proxy with prompt injection sanitization.
- `POST /api/ai/test` — Benchmarks prompts across dual model providers simultaneously.
- `POST /api/ai/refine` — Iteratively improves existing system prompts based on user feedback.
- `GET  /api/ai/models` — Lists available LLM providers, active models, and operational status.

### Workflows & Canvas (`/api/workflows`)
- `GET  /api/workflows` — Lists all visual workflow graphs for the authenticated user.
- `POST /api/workflows` — Saves a new visual node graph topology.
- `PUT  /api/workflows/:id` — Updates node configurations, connections, and metadata.
- `POST /api/workflows/:id/execute` — Triggers server-side sequential/parallel execution of a node graph.

### Billing & Razorpay (`/api/billing`)
- `POST /api/billing/create-order` — Creates a Razorpay subscription payment order.
- `POST /api/billing/webhook` — Verifies HMAC-SHA256 signature and provisions plan quotas.
- `GET  /api/billing/invoices` — Retrieves payment receipts and transaction history.

### Observability & Health (`/api/health`)
- `GET /health` — Liveness probe (returns 200 OK with server uptime).
- `GET /health/ready` — Readiness probe (checks active database connectivity).
- `GET /health/metrics` — Returns memory usage, active connections, and request latency stats.

---

## Getting Started

### 1. Prerequisites
- **Node.js**: `v20.0.0` or higher (LTS recommended).
- **npm**: `v10.0.0` or higher.
- **Rust Toolchain**: Optional, required only for native Tauri desktop packaging ([rustup.rs](https://rustup.rs/)).

### 2. Installation
Clone the repository and install both frontend and backend dependencies:

```bash
# Clone the repository
git clone https://github.com/AtharvaK-XD/Bedrock.git
cd Bedrock

# Install frontend dependencies
npm install

# Install backend dependencies
cd server
npm install
cd ..
```

### 3. Environment Setup

#### Frontend Configuration (`.env.local` in root)
```env
# Optional client-side API keys for direct browser development
VITE_GEMINI_API_KEY=your_gemini_api_key
VITE_GROQ_API_KEY=your_groq_api_key
VITE_OPENROUTER_API_KEY=your_openrouter_api_key
VITE_HUGGINGFACE_API_KEY=your_huggingface_api_key
```

#### Backend Configuration (`server/.env`)
Copy the example template:
```bash
cp server/.env.example server/.env
```
Fill in your configuration:
```env
DATABASE_URL="file:./dev.db"
PORT=3000
NODE_ENV=development
JWT_SECRET=your_secure_random_jwt_secret

# AI Provider Keys (Server-side proxy)
GROQ_API_KEY=your_groq_api_key
OPENROUTER_API_KEY=your_openrouter_api_key
GEMINI_API_KEY=your_gemini_api_key

# Razorpay (Optional - for billing)
RAZORPAY_KEY_ID=rzp_test_xxx
RAZORPAY_KEY_SECRET=your_razorpay_secret
RAZORPAY_WEBHOOK_SECRET=your_webhook_secret
```

### 4. Database Setup
Initialize the SQLite database schema via Prisma:

```bash
cd server
npx prisma db push
npx prisma generate
cd ..
```

---

## Running Bedrock

### Run Backend API
```bash
cd server
npm run dev
```
The backend API boots on `http://localhost:3000`.

### Run Frontend Web App
In a separate terminal:
```bash
npm run dev
```
Access the application in your browser at `http://localhost:5173`.

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
| `npm run build` | Validates TypeScript type compliance (`tsc -b`) and compiles production web assets. |
| `npm run lint` | Runs Oxlint across the frontend codebase for high-performance static analysis. |
| `npm run tauri build` | Packages release-optimized native desktop installers (`.msi`, `.dmg`, `.AppImage`). |

---

## Compliance & Legal Policies

All policies governing user data protection, retention schedules, and incident protocols are located in the [`docs/`](./docs) directory:
- [Privacy Policy](./docs/PRIVACY_POLICY.md)
- [Data Retention & Deletion Policy](./docs/DATA_RETENTION_POLICY.md)
- [Security Incident Response Playbook](./docs/INCIDENT_RESPONSE.md)
- [Terms of Service](./docs/TERMS_OF_SERVICE.md)

---

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.
