# Bedrock

Bedrock is a state-of-the-art **Prompt Engineering Application** designed to automate and enhance your most ambitious work. Built as a high-performance desktop application using Tauri and React, it offers advanced tools for prompt creation, testing, branching, and management.

## 🌟 Key Features

* **Generator**: Craft and refine prompts with intelligent suggestions and real-time generation.
* **Branching Chat**: Explore different conversational paths and variations from a single prompt node, making A/B testing prompts effortless.
* **Prompt Tester**: Rigorously test and evaluate prompt performance before deployment.
* **Library**: Save, organize, and manage your personal context and prompt collections.
* **Premium UI/UX**: Enjoy a sleek, modern, and dark-themed interface with buttery-smooth animations powered by GSAP, Framer Motion, and Lenis smooth scrolling.
* **Desktop Native**: Built on Tauri for a lightweight, secure, and native desktop experience on Windows, Mac, and Linux.

## 🚀 Tech Stack

Bedrock is built with cutting-edge web technologies to ensure a fast, responsive, and beautiful user experience:

* **Framework**: React 19 + Vite
* **Desktop Runtime**: Tauri 2.0
* **Styling**: Tailwind CSS + Lucide React (Icons)
* **Animations**: Framer Motion & GSAP
* **Smooth Scrolling**: Lenis
* **State & Data**: React Query & React Hook Form
* **UI Effects**: Advanced Hardware-Accelerated CSS 3D Transforms (for ultra-realistic UI physics)

## 🛠️ Getting Started

### Prerequisites

* Node.js (v18 or higher recommended)
* Rust (for Tauri development)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/AtharvaK-XD/Bedrock.git
   cd Bedrock
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Run the development server**
   ```bash
   # Starts the Vite dev server and the Tauri desktop app window
   npm run tauri dev
   ```

### Building for Production

To build the executable for your current operating system:

```bash
npm run build
npm run tauri build
```
The compiled binaries will be available in the `src-tauri/target/release/bundle/` directory.

## 📦 Scripts

* `npm run dev`: Start the web-only Vite development server.
* `npm run tauri dev`: Start the full Tauri desktop development environment.
* `npm run build`: Compile TypeScript and build the web assets.
* `npm run preview`: Preview the production web build locally.
* `npm run lint`: Run Oxlint to catch code quality issues.

## 🎨 Design Philosophy

Bedrock prioritizes an ultra-premium aesthetic. You will find meticulously crafted glassmorphism, dynamic 3D folding animations, and buttery-smooth page transitions designed to make prompt engineering feel less like a chore and more like a creative experience.
