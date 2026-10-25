# Bedrock

Bedrock is a prompt engineering workstation and visual AI orchestration platform. It provides a structured environment to synthesize, refine, branch, benchmark, and deploy system prompts across frontier LLMs and local runtimes.

Available as a native cross-platform desktop application (macOS and Windows) and a responsive web application.

---

## Features

- **Prompt Synthesis & Clarification**: Generates production-grade system prompts with XML boundaries, typed schemas, and negative constraints. Analyzes briefs to generate targeted clarifying questions before compilation.
- **Visual DAG Canvas**: Graph-based node orchestration (`@xyflow/react`) for prompt chaining, conditional routing, evaluator nodes, and multi-agent workflows.
- **Multi-Model Benchmark Arena**: Parallel, head-to-head evaluation across frontier models measuring latency (TTFT), token consumption, adherence, and output diffs.
- **Universal Exporters**: Instant export to Cursor (`.cursorrules`), Claude Code (`CLAUDE.md`), Windsurf (`.windsurfrules`), GitHub Copilot, Vercel AI SDK, OpenAI, Anthropic, Google Gen AI, and LangChain.
- **Local & Offline Inference**: Native integration with Ollama for air-gapped, local model execution.
- **Observability & Telemetry**: Real-time tracking of token usage, latency percentiles, execution traces, and historical prompts.
- **Production Hardened**: Layer-7 rate limiting, delimiter isolation shields against prompt injection, and automated secret scanning.

---

## Workspaces

| Workspace | Route | Description |
| :--- | :--- | :--- |
| **Dashboard** | `/app` | Real-time telemetry, activity metrics, and execution stream. |
| **Generator** | `/app/generator` | Prompt synthesis engine with clarifying questions and live preview. |
| **Branching** | `/app/branching` | Visual DAG canvas for complex, multi-step prompt flows. |
| **Arena** | `/app/tester` | Parallel benchmarking and comparative model evaluation. |
| **Library** | `/app/library` | Curated blueprints and custom prompt template catalog. |
| **History** | `/app/history` | Execution archive with full trace logs and one-click rollback. |
| **Settings** | `/app/settings` | Model inference parameters, token budget governors, and local Ollama config. |

---

## Supported Providers & Models

- **Google DeepMind**: Gemini 2.5 Flash, Gemini 3.5 Flash Lite, Gemini 3.8 Flash
- **Groq**: Llama 3.3 70B, Llama 3.1 8B, DeepSeek R1 Distill 70B, Mixtral 8x7B
- **OpenRouter**: DeepSeek V3, DeepSeek R1, Claude 3.7 Sonnet, GPT-4o, Mistral Large
- **Perplexity**: Sonar Pro, Sonar Reasoning Pro, Sonar
- **Mistral AI**: Mistral Large 2, Codestral, Mixtral 8x22B
- **Cohere & xAI**: Command R+, Grok 3, Grok 2
- **Ollama (Local)**: Llama 3.2, Qwen 2.5 Coder, DeepSeek R1

---

## Export Targets

Bedrock exports compiled prompts directly into target project configurations:

- **IDE Directives**: `.cursorrules`, `CLAUDE.md`, `.windsurfrules`, `.github/copilot-instructions.md`
- **Framework SDKs**: Vercel AI SDK (`route.ts`), OpenAI SDK (Python/TS), Anthropic SDK (Python/TS), Google Gen AI (Python/TS), LangChain (Python)
- **Raw Payloads**: cURL commands, JSON payloads, Markdown with YAML frontmatter

---

## Getting Started

### Prerequisites

- Node.js 20+
- npm 10+
- [Neon](https://neon.tech/) Serverless PostgreSQL
- [Clerk](https://clerk.com/) account (authentication)

### Installation

```bash
git clone https://github.com/Bedrockxai/Bedrock.git
cd Bedrock
npm install
```

### Environment Setup

Create a `.env.local` file in the project root:

```env
# Authentication (Clerk)
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...

# Database (Neon PostgreSQL)
DATABASE_URL="postgresql://user:pass@ep-xxx-pooler.us-east-2.aws.neon.tech/bedrock?sslmode=require"
DATABASE_URL_UNPOOLED="postgresql://user:pass@ep-xxx.us-east-2.aws.neon.tech/bedrock?sslmode=require"

# AI Provider API Keys (optional if provided in-app)
VITE_GEMINI_API_KEY=your_key
VITE_GROQ_API_KEY=your_key
VITE_OPENROUTER_API_KEY=your_key
VITE_PERPLEXITY_API_KEY=your_key

# Rate Limiting (Upstash Redis)
UPSTASH_REDIS_REST_URL="https://...upstash.io"
UPSTASH_REDIS_REST_TOKEN="..."
```

### Database Initialization

```bash
cd server
npx prisma db push
npx prisma generate
cd ..
```

### Development

```bash
# Web application (http://localhost:5173)
npm run dev

# Electron desktop app
npm run electron:start

# Tauri desktop app
npm run tauri dev
```

### Build

```bash
# Web production build
npm run build

# Windows installer (NSIS .exe)
npm run electron:build

# macOS package (.dmg / .zip)
npm run electron:build:mac
```

---

## Testing & Quality Assurance

```bash
npm run test:eval        # Prompt quality evaluation suite
npm run test:injection   # Prompt injection defense tests
npm run test:attacks     # Security attack & boundary suite
npm run scan:secrets     # Secret leak detection scanner
npm run lint             # Static code analysis (oxlint)
```

---

## License

MIT License. See [LICENSE](LICENSE) for details.
