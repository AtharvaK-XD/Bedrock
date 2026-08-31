# Bedrock

Bedrock is a specialized prompt engineering workstation and orchestration platform packaged as a cross-platform desktop application. Built on Tauri 2.0, React 19, and TypeScript, Bedrock provides tools for requirements extraction, automated prompt synthesis, visual node-based execution graphs, and parallel multi-model benchmarking.

---

## Overview

Modern software teams, prompt engineers, and AI developers require structured workflows to draft, test, branch, and optimize prompts across diverse large language models. Bedrock bridges the gap between raw LLM APIs and structured prompt architecture through four core operational pillars:

1. **System Prompt Synthesis**: Interactive, persona-driven requirement elicitation and automated prompt compilation.
2. **Visual Flow Orchestration**: Node-based canvas for chaining prompts, conditional routing, data injection, and automated evaluation.
3. **Multi-Model Benchmarking**: Side-by-side prompt execution and diff evaluation across heterogeneous providers.
4. **Prompt Asset Management**: Local persistence and categorization for templates, system personas, and test configurations.

---

## Core Capabilities

### 1. Prompt Generation Engine
- **Target Archetypes**: Tailor generation logic for specific deployment contexts, including autonomous coding agents, freelancer technical briefs, hackathon prototypes, and no-code application specifications.
- **Dynamic Question Synthesis**: Automatically analyzes initial project ideas and queries the LLM backend to generate 3 to 5 targeted clarifying questions (single select, multi-select, or free-text) to resolve domain ambiguities.
- **Structured Output Compilation**: Synthesizes responses into production-ready system prompts, requirements documentation, and architecture recommendations.
- **Iterative Refinement**: In-place modification workflows with feedback tracking, diff generation, and change summaries.

### 2. Visual Branching Canvas
- **Graph Topologies**: Powered by `@xyflow/react`, enabling non-linear prompt experimentation, conversational branching, and pipeline design.
- **Node Taxonomy**:
  - **System Persona**: Configures underlying system context, boundaries, and behavioral constraints.
  - **User Prompt**: Primary user input instructions and variable injection targets.
  - **AI Output**: Captures generation outputs for validation and downstream chaining.
  - **Data Context**: Supplies document embeddings, raw text snippets, or structured key-value variables.
  - **Condition / Router**: Evaluates output content to route flow paths dynamically.
  - **Code Script**: Executes transformations and custom formatting logic between nodes.
  - **Merge**: Combines multiple branch outputs into a unified input payload.
  - **Evaluation**: Performs rubric-based scoring and quality grading on generation results.
- **Execution States**: Real-time status indicators (idle, running, success, error) with execution controls.

### 3. Multi-Model Prompt Tester
- **Parallel Execution**: Dispatches identical prompt configurations across two distinct model providers simultaneously to evaluate variance, formatting fidelity, and latency.
- **Supported Model Providers**:
  - **Google Gemini**: Gemini 2.5 Pro, Gemini 2.5 Flash
  - **Groq**: Llama 3.1 70B Versatile, Llama 3.1 8B Instant
  - **OpenRouter**: Llama 3.1 8B, Gemma 2 9B, Mistral 7B, Phi-3 Mini, Nvidia Nemotron 70B
  - **Hugging Face Serverless**: Mistral 7B Instruct, Qwen 2.5 72B, Meta Llama 3 8B, Zephyr 7B
  - **OpenAI / ChatGPT**: GPT-4o, GPT-4 Turbo, GPT-3.5 Turbo
- **Configuration Controls**: Independent adjustment of system instructions, temperature, token limits, and target credentials per model instance.

### 4. Native Desktop Experience
- **Tauri 2.0 Foundation**: Minimal memory footprint, native window decorations, and operating system sandboxing via Rust.
- **Seamless Auto-Updater**: Native update checks and self-updating binary delivery through `@tauri-apps/plugin-updater`.
- **UI Architecture**: Glassmorphism and hardware-accelerated transitions utilizing Tailwind CSS, Framer Motion, GSAP ScrollTrigger, and Lenis smooth scrolling.

---

## Architecture and Technology Stack

```
Bedrock Desktop Architecture
├── Frontend Presentation Layer (React 19 + TypeScript + Vite)
│   ├── Routing & Layouts (React Router DOM, AppLayout, PageTransitions)
│   ├── Canvas Engine (@xyflow/react)
│   ├── Motion & Smooth Physics (GSAP, ScrollTrigger, Lenis, Framer Motion)
│   └── Form & State Management (TanStack React Query, React Hook Form, Zod)
├── API Proxy & Integration Layer
│   ├── Google Gemini API (Direct & Vite Reverse Proxy)
│   ├── Groq API (High-throughput inference)
│   ├── OpenRouter & Hugging Face Serverless Endpoints
│   └── Offline / Mock Fallbacks (mockApi.ts)
└── Native Runtime Layer (Tauri 2.0 / Rust)
    ├── Window & Process Management (@tauri-apps/plugin-process)
    ├── Native Updater (@tauri-apps/plugin-updater)
    └── OS Target Bundlers (Windows NSIS/MSI, macOS DMG/App, Linux AppImage/Deb)
```

### Component Breakdown

| Layer | Technologies |
| :--- | :--- |
| **Desktop Runtime** | Tauri 2.0 (Rust), Tauri Process & Updater Plugins |
| **Frontend Framework** | React 19, TypeScript 6.0, Vite 8.2 |
| **Styling & Icons** | Tailwind CSS 3.4, Lucide React, React Resizable Panels |
| **Graph / Flow Engine** | `@xyflow/react` 12.x |
| **Animations & Scroll** | GSAP 3.15, Framer Motion 12.x, Lenis 1.3 |
| **State & Networking** | TanStack React Query 5.x, React Hook Form 7.x, Zod 3.x |
| **3D Rendering** | Three.js, React Three Fiber, React Three Drei |
| **Quality & Linters** | Oxlint, TypeScript Compiler (`tsc -b`) |

---

## Directory Structure

```
Bedrock/
├── public/                 # Static public assets and application icons
├── src/
│   ├── assets/             # Bundled visual assets and styles
│   ├── components/
│   │   ├── auth/           # Authentication and credential modals
│   │   ├── landing/        # Marketing and landing page components
│   │   ├── layout/         # Shell layout, navigation bar, and page wrappers
│   │   ├── ui/             # Reusable primitives (buttons, inputs, rich selectors)
│   │   └── workspace/      # Canvas panels, node drawers, and inspector widgets
│   ├── lib/
│   │   ├── api.ts          # LLM provider clients, prompt synthesis, and test runners
│   │   ├── mockApi.ts      # Offline mock client for local UI testing
│   │   ├── updater.ts      # Tauri native update checker integration
│   │   └── utils.ts        # Class merging and utility helpers
│   ├── pages/
│   │   ├── Billing.tsx     # Account tiers and subscription management
│   │   ├── BranchingChat.tsx # Graph-based prompt chaining and canvas workspace
│   │   ├── Dashboard.tsx   # Workspace hub, recent runs, and quick actions
│   │   ├── Landing.tsx     # Web entrypoint and product showcase
│   │   ├── Library.tsx     # Saved prompt templates and persona database
│   │   ├── Pricing.tsx     # Tier comparison matrix
│   │   ├── PromptTester.tsx# Dual-model parallel prompt benchmark console
│   │   ├── Result.tsx      # Synthesis review, markdown preview, and refinement
│   │   ├── Settings.tsx    # API key configuration, preferences, and telemetry
│   │   └── Wizard.tsx      # Step-by-step prompt synthesis generator
│   ├── App.tsx             # Root router, query client, and Lenis integration
│   ├── index.css           # Global design system tokens and Tailwind directives
│   └── main.tsx            # React application entry point
├── src-tauri/
│   ├── capabilities/       # Tauri permissions and security manifests
│   ├── icons/              # Multi-resolution application icons
│   ├── src/                # Rust backend entry point and command handlers
│   ├── Cargo.toml          # Rust dependencies and crate definitions
│   └── tauri.conf.json     # Tauri runtime and bundle packaging configuration
├── vite.config.ts          # Vite configuration with API reverse proxies
├── tailwind.config.js      # Design tokens, color palettes, and typography rules
└── package.json            # Project dependencies and script declarations
```

---

## Prerequisites

Ensure the following tools are installed on your host system before configuring the development environment:

1. **Node.js**: `v18.0.0` or later (LTS recommended).
2. **Package Manager**: `npm` (bundled with Node.js), `pnpm`, or `yarn`.
3. **Rust Toolchain** (Required for Tauri desktop builds):
   - Install Rust via [rustup.rs](https://rustup.rs/):
     ```bash
     curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
     ```
4. **Platform-Specific Dependencies**:
   - **Windows**: Microsoft Visual Studio C++ Build Tools or Visual Studio Community with the "Desktop development with C++" workload installed, plus the WebView2 Runtime.
   - **macOS**: Xcode Command Line Tools (`xcode-select --install`).
   - **Linux**: Standard build tools and WebKitGTK libraries:
     ```bash
     sudo apt update && sudo apt install -y libwebkit2gtk-4.1-dev build-essential curl wget file libssl-dev libayatana-appindicator3-dev librsvg2-dev
     ```

---

## Environment Configuration

Bedrock communicates with LLM providers either through local API proxy routes during development or direct endpoints in native builds.

Create a `.env.local` file in the root directory:

```env
# Google Gemini API Key (Used for question generation and prompt synthesis)
VITE_GEMINI_API_KEY=your_gemini_api_key_here

# Groq API Key (Used for high-speed Llama inference)
VITE_GROQ_API_KEY=your_groq_api_key_here

# OpenRouter API Key (Used for multi-model open-source routing)
VITE_OPENROUTER_API_KEY=your_openrouter_api_key_here

# Hugging Face User Access Token (Used for serverless inference endpoints)
VITE_HUGGINGFACE_API_KEY=your_huggingface_api_token_here
```

### Environment Variable Reference

| Variable Name | Required | Purpose |
| :--- | :--- | :--- |
| `VITE_GEMINI_API_KEY` | Optional | Powers the primary wizard generation and refinement workflows via `gemini-2.5-flash` / `gemini-2.5-pro`. |
| `VITE_GROQ_API_KEY` | Optional | Enables low-latency execution for Llama-based benchmarks in the Prompt Tester. |
| `VITE_OPENROUTER_API_KEY` | Optional | Grants access to community models (Gemma, Mistral, Phi-3, Nemotron) in the Tester and Branching Canvas. |
| `VITE_HUGGINGFACE_API_KEY` | Optional | Connects to Hugging Face Serverless Inference API for specialized open models. |

---

## Getting Started

### 1. Clone the Repository

```bash
git clone https://github.com/AtharvaK-XD/Bedrock.git
cd Bedrock
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Run in Development Mode

#### Option A: Web-Only Development
Starts the Vite development server in standard browser mode:
```bash
npm run dev
```
Access the application at `http://localhost:5173`.

#### Option B: Full Tauri Desktop Development
Compiles the Rust bridge and opens the native desktop window:
```bash
npm run tauri dev
```

---

## Building and Packaging

### 1. Type Check and Web Asset Compilation

```bash
npm run build
```
This runs `tsc -b` to enforce TypeScript integrity followed by `vite build` to output production assets to `dist/`.

### 2. Compile Desktop Application (Tauri)

```bash
npm run tauri build
```

Compiled binaries and platform installers will be generated under:
- **Windows**: `src-tauri/target/release/bundle/nsis/` or `msi/`
- **macOS**: `src-tauri/target/release/bundle/dmg/` or `macos/`
- **Linux**: `src-tauri/target/release/bundle/appimage/` or `deb/`

---

## Development Scripts

| Command | Description |
| :--- | :--- |
| `npm run dev` | Starts the Vite development server with hot module replacement (HMR). |
| `npm run tauri dev` | Boots the Tauri desktop client connected to the Vite development server. |
| `npm run build` | Compiles TypeScript types and bundles the frontend application. |
| `npm run preview` | Runs a local static server to preview the compiled `dist/` production assets. |
| `npm run tauri build` | Creates release-optimized desktop binaries and platform installer bundles. |
| `npm run lint` | Runs Oxlint to inspect codebase syntax and ensure high code quality standards. |

---

## Network and Proxy Architecture

During development in browser environments, cross-origin resource sharing (CORS) policies may restrict direct browser-to-LLM API requests. Bedrock handles this seamlessly via Vite's development proxy layer in `vite.config.ts`:

- `/api/gemini/*` -> Proxied to `https://generativelanguage.googleapis.com`
- `/api/groq/*` -> Proxied to `https://api.groq.com`
- `/api/openrouter/*` -> Proxied to `https://openrouter.ai/api`
- `/api/huggingface/*` -> Proxied to `https://api-inference.huggingface.co`

In production desktop runtime environments, requests leverage native network capabilities governed by Tauri's secure permission set (`src-tauri/capabilities/`).

---

## Code Quality and Standards

- **Oxlint Integration**: Bedrock utilizes Oxlint for performant linting without runtime overhead.
- **Strict TypeScript**: Configured with strict type validation to ensure type safety across all graph nodes, model interfaces, and API responses.
