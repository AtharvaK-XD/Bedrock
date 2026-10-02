# Obsidian Vault Documentation Sync Rule

Whenever any architectural, feature, UI/UX, API route, database model, security control, or release change is made in Bedrock, the agent must automatically synchronize and update the corresponding Obsidian notes in the user's vault via the `obsidian` MCP server:

1. `Bedrock.md` (Master Hub linked to `[[Projects]]` and `[[Atharva]]`)
2. `Bedrock - Architecture & Tech Stack.md` (Links ONLY to `[[Bedrock]]`)
3. `Bedrock - Core Capabilities & Workspaces.md` (Links ONLY to `[[Bedrock]]`)
4. `Bedrock - Security & Production Hardening.md` (Links ONLY to `[[Bedrock]]`)
5. `Bedrock - Telemetry & Database Models.md` (Links ONLY to `[[Bedrock]]`)
6. `Bedrock - API & Serverless Reference.md` (Links ONLY to `[[Bedrock]]`)
7. `Bedrock - Releases & DevOps.md` (Links ONLY to `[[Bedrock]]`)

### Graph Isolation Rule
All sub-notes (2 through 7) must strictly and exclusively link back to `[[Bedrock]]`. Do NOT link them to `Projects`, `Atharva`, each other, or other external notes in the vault, maintaining a clean star cluster in Obsidian's graph view.
