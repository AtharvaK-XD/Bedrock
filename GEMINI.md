# Bedrock Engineering & Obsidian Vault Synchronization Directives

## 1. Automated Obsidian Vault Documentation Sync
Whenever any change is made to this codebase—including new features, UI/UX changes, API endpoints, database schema updates, security controls, or version releases—the agent MUST automatically sync and update the corresponding Obsidian notes in the user's vault via the `obsidian` MCP server:

### Note Mapping Architecture
- **Master Hub**: `Bedrock.md` (Linked to `[[Projects]]` and `[[Atharva]]`)
- **Sub-Nodes (Pure Star Topology)**:
  - `[[Bedrock - Architecture & Tech Stack]]`
  - `[[Bedrock - Core Capabilities & Workspaces]]`
  - `[[Bedrock - Security & Production Hardening]]`
  - `[[Bedrock - Telemetry & Database Models]]`
  - `[[Bedrock - API & Serverless Reference]]`
  - `[[Bedrock - Releases & DevOps]]`

### Graph Topology Invariant (STRICT)
- **Zero Cross-Links on Sub-Nodes**: All satellite sub-notes must ONLY connect to `[[Bedrock]]`.
- **No External Links on Sub-Nodes**: Sub-notes must NEVER link directly to `[[Projects]]`, `[[Atharva]]`, each other, or other external notes in the vault. This guarantees that in Obsidian's Graph View, the sub-nodes orbit strictly and exclusively around `Bedrock` as a clean star cluster.

## 2. Sync Trigger Protocol
- **After Code Modifications**: Before concluding any task that adds or alters functionality, call the `obsidian` MCP tool (`vault_write` or `vault_patch`) to reflect the modifications in the relevant note.
- **Link Integrity**: Keep `Bedrock.md` as the single bridge between the project ecosystem and its internal architectural sub-nodes.

## 3. Workstation Layout Invariant (STRICT)
- **Desktop Application vs. Website Navigation**:
  - **Desktop App (`isDesktopApp() === true`)**: MUST ALWAYS use the dedicated left-hand **`Sidebar`** (`Sidebar.tsx`) with full-height workstation views (`h-screen w-screen overflow-hidden`) and global `⌘1`–`⌘6` keyboard shortcuts.
  - **Website (`isDesktopApp() === false`)**: MUST ALWAYS use the floating Aceternity **`Topbar`** (`Topbar.tsx`) navigation island with scrolling page views.
  - **Feature Parity Invariant**: Apart from this single Desktop Sidebar vs. Website Topbar layout difference, ALL features, workspaces (Dashboard, Generator, Branching, Tester, Library, History), AI models/providers, brand logos, settings, prompt directives, and options between the Desktop App and Website MUST be 100% identical at all times.

