# Bedrock Intro v4: Frame-by-Frame Motion, Layout & Visual Correction Spec

**Target Composition**: 1920×1080 @ 60 fps (3600 frames = 60.0 seconds)  
**Aesthetic Contract**: Near-black background (`#05080a`), mint-green accent (`#10b981`), mono cards, bold sans-serif headlines (`Inter`), zero browser default fonts.  
**Strict Layout Contract**:
- Eyebrow: `y: 56–88`, 22 px mono mint
- Headline: `y: 100–180`, 64 px bold sans-serif
- Diagram Zone: `y: 230–830`, `x: 160–1760`
- Pill Band: `y: 850–900` (Independent fixed layer, never scaled)
- Caption Zone: `y: 940–1030`, 40 px, max 2 lines
- Progress Rail: `x: 1884–1888`, `y: 120–960`, 3 px mint

---

## 1. Executive Summary of Audit Findings

A frame-by-frame visual audit across 33 timestamps extracted from `public/bedrock-intro.mp4` identified 14 distinct visual, typographic, layout, and synchronization defects.

| # | Scene / Time | Defect Category | Frame / Timestamp | Severity | Root Cause & Exact Fix |
|---|---|---|---|---|---|
| **E1** | Global Chrome | Visual Glitch | All scenes (past f45) | **CRITICAL** | **Unmasked Shine Pass**: Skewed grey trapezoid box floats statically at `x: 300–1400, y: 100–160`. `shineProgress` in `SceneChrome` freezes at 200% with no fade. Mask to text or fade opacity to 0 after f40. |
| **E2** | Global Chrome | Typography | Scenes 2, 7, 10 | Medium | **KeyWord Underline Matcher Bug**: `keyWord.includes()` on single words fails when `keyWord` is multi-word (e.g., `"compiler rigor"`). Match against keyword token array. |
| **E3** | Scene 1 (0–5.6s) | State / Timing | 3.5s – 5.0s (f210–300) | Medium | **Error Spike Cutoff**: Error red state disappears prematurely at frame 300 before W2 flick at f306. Extend error red state and shake until card flick. |
| **E4** | Scene 3 (10–11.8s)| Layout / Duplicate | 11.0s – 11.33s (f660–680)| **HIGH** | **Double Headline Collision**: `SceneChrome` renders "BEDROCK WORKSTATION" at the top while central resolving wordmark also renders in center. Set `hideHeadline={true}`. Tagline `<20px` resized to 22px. |
| **E5** | Scene 5 (13.3–17.5s)| Layout / Collision | 14.5s – 17.5s (f870–1050)| **CRITICAL** | **Pill & Caption Overlap**: Throughput pill inside scaled cluster collides directly with bottom caption at f990. Left Claude card clipped on edge. Missing space in `BENCH 99.2%LATENCY 195ms`. |
| **E6** | Scene 6 (17.5–20.5s)| Typography / Layout| 18.5s (f1110) | Medium | **Telemetry List Collision & Typo**: Right cluster list text collides with `CLUSTER` header. Chip says `Qwen 2.5` instead of spec-mandated `Qwen 3`. |
| **E7** | Scene 7 (20.5–22.0s)| 3D Transform | 21.0s (f1260) | **HIGH** | **Mirrored Backwards Text**: 3D 180° card flip reveals mirrored reverse text without `backface-visibility: hidden` or backface component. Missing crack lock icon. |
| **E8** | Scene 8 (22.0–23.8s)| Motion / Visual | 22.5s – 23.5s (f1350) | Medium | **Missing Cursor & Blob Residue**: Ghost cursor missing from Scene 8. Teal blur residue instead of sharp scanning laser light. Missing scroll thumb. |
| **E9** | Scene 9/10 (23.8–32s)| Contrast / Layout | 25.0s – 31.5s (f1500–1890)| **HIGH** | **XML Clipping & Inspector Overlap**: XML closing tag `<anti_hallucination>` clipped on card edge. Low contrast red/grey text. Inspector panel cuts off `LIVE VALIDA` and covers half the card. |
| **E10**| Scene 11/12 (32–43s)| Text / Motion | 33.5s – 40.0s (f2010–2400)| Medium | **Log Text Overlap & Static Column**: Line 2 in DAG log has double-exposed overlapping text. S6 log column is static instead of scrolling. Latency chip lacks macro focus. |
| **E11**| Scene 13 (43.3–47s)| Sync / Layout | 43.3s (f2598) | **CRITICAL** | **Missing Headline & No Collision**: Headline "Frontier head-to-head." is completely absent on the 43.3s audio hit. Cards are 400px apart instead of slamming together. |
| **E12**| Scene 14 (47–51.9s)| Text / Cursor | 48.0s – 51.5s (f2880–3090)| **HIGH** | **Cursor Overlapping Text & Typo**: Chip says `+1 MORE` instead of `+3 MORE`. Ghost cursor directly occludes the word `Promptfoo`. 3D cylinder backface text is backwards. |
| **E13**| Scene 15/16 (52–55.3s)| Typography / Duplicate| 52.0s – 53.75s (f3120–3225)| **CRITICAL** | **Serif Font & Duplicate Caption**: "Stop guessing." and "Start engineering." rendered in Times New Roman browser default serif font. Bottom caption redundantly duplicates headline. |
| **E14**| Scene 17 (55.3–60s)| Typography / Geometry| 55.28s – 58.5s (f3317–3510)| **HIGH** | **Serif Wordmark, Off-Center Shockwave, Clipped Box**: "Bedrock" has serif font. Shockwave ring centered at y:400 (280px above logo). Command card pushed off screen bottom. |

---

## 2. Frame-by-Frame Detailed Specifications & Code Fixes

### 2.1 Global Chrome (`SceneChrome.tsx`)
1. **Fix Shine Pass Glitch (E1)**:
   - Change `shineProgress`:
     ```tsx
     const shineOpacity = interpolate(frame, [25, 30, 40, 45], [0, 0.4, 0.4, 0], {
       extrapolateLeft: 'clamp',
       extrapolateRight: 'clamp',
     });
     ```
   - Add `opacity: shineOpacity` to the shine pass `div`, so it only exists during frames 25–45 and is completely invisible outside that window.
2. **Fix KeyWord Underline Matcher (E2)**:
   - Update `isKey`:
     ```tsx
     const cleanKeyTokens = keyWord ? keyWord.toLowerCase().replace(/[.?]/g, '').split(' ') : [];
     const cleanWord = word.toLowerCase().replace(/[.?]/g, '');
     const isKey = cleanKeyTokens.includes(cleanWord);
     ```

---

### 2.2 Scene 1 & 2 (`Scene1ProblemAndGenesis.tsx`)
1. **Error Spike State & Alignment (E3 / User Override)**:
   - Extend `isError`:
     ```tsx
     const isError = s1Frame >= 240 && s1Frame <= 306;
     ```
   - Keep the red border, red text glow, and `SCHEMA_COLLAPSE_DETECTED` badge active right until the `W2` flick dismiss fires at frame 306.
   - **Orthogonal 90° Card Alignment**: Removed `dutchTilt` from `CameraRig` in Scene 1 so the `brittle_prompt.ts` card and headline sit 100% straight and level at a 90° orthogonal angle without any rotational tilt, matching all other cards in the video.
2. **Double Headline & Pacing in Scene 3 (E4 / 0:10–0:13 Pacing Fix)**:
   - Pass `hideHeadline={true}` to `SceneChrome` in Scene 3.
   - Set tagline font size to `22px` with `fontFamily: "'Inter', sans-serif"` and `color: '#10b981'`.
   - **Calibrated Decryption (0:10 Pacing)**: Accelerated wordmark scramble decryption from 66 frames down to 22 frames (`[0, 22]`), and tagline fade-in over `[8, 24]`. "BEDROCK WORKSTATION" is now 100% resolved and legible by frame 622 (10.36s), giving the viewer ~1.0 second of crystal-clear brand readability prior to Hit 1 (frame 680 / 11.33s).
   - **Gentle Scene 3 Exit**: Replaced the abrupt 14-frame exponential collapse (`z10Fly` 1.0 -> 0.55) with a smooth ease `s3ExitScale` (`[88, 108] -> [1.0, 0.94]`) and soft crossfade `s3ExitOpacity` (`[98, 108] -> [1.0, 0.0]`), creating an organic handoff into Act 2.
   - **Scene 4 "Meet Bedrock." Focus (0:11.8–0:13.3)**:
     - Gave the central Bedrock CORE engine disc dedicated presence during frames 0–50 with spring entrance and glowing orbital ring.
     - Delayed spoke branching to frames 50–76 and hero cards to frames 68–96 so they cascade into place right as the narration transitions into Scene 5 ("The premier engineering workstation.").
     - Gated the telemetry pill row to `!isScene4` so empty `0 t/s` counters do not clutter "Meet Bedrock.".
     - Routed spoke lines to the outer perimeter bounding box of each card (`edgeX`, `edgeY`) to ensure lines never penetrate inside card text.
3. **Compiler Scanline Removal (0:06 Card)**:
   - Removed the moving horizontal green scanline (`height: 2px`, `linear-gradient` with glowing box shadow) and `s2ScanlineY` from `bedrock-compiler.rs` card in Scene 2, keeping the compiler code card clean and unobscured.
4. **Audio-Caption Word-for-Word Transcription Sync (0:00–0:10)**:
   - **Root Cause**: Old draft captions ("Engineering AI prompts isn't guesswork anymore...", "It is software architecture.", "But today, prompts decay...") were hardcoded, completely mismatched from the actual audio voiceover in `act1_genesis.mp3`.
   - **Fix**: Synchronized captions word-for-word against `act1_genesis.vtt`:
     - `0.0s – 3.2s` (f0–192): `"The modern software landscape is a labyrinth."`
     - `3.2s – 7.64s` (f192–458): `"We chain prompts, we wrangle context, we pray for coherence."` (actively displayed across 6–7s as the voice concludes *"we pray for coherence."*)
     - `7.64s – 10.0s` (f458–600): `"The result? Fragile abstractions built on shifting sands."`
   - Added `captionStartFrame` and `captionEndFrame` props to `SceneChrome` to calibrate per-word progressive lighting in exact lockstep with ChristopherNeural's voice delivery.

---

### 2.3 Scene 5, 6 & 7 (`Scene2FrontierMatrix.tsx`)
1. **Pill Row Collision with Caption (E5)**:
   - Extract the Throughput/Cost pill row OUTSIDE the scaled cluster container.
   - Anchor pill at fixed `top: 860px` (or `bottom: 160px`), with caption at `top: 940px`. Clearance is guaranteed at all zoom levels.
2. **Spacing in Card Values (E5)**:
   - Change card metric lines from `BENCH {bench}%LATENCY {latency}ms` to:
     ```tsx
     <span>BENCH {bench}%</span>
     <span style={{ margin: '0 8px', opacity: 0.3 }}>|</span>
     <span style={{ color: COLORS.mint }}>LATENCY {latency}ms</span>
     ```
3. **Claude Card Left Margin (E5)**:
   - In hub geometry, shift Claude card center from `x: 465` to `x: 485` (occupies `x: 315–655`) to prevent clipping into the 120px margin.
4. **Scene 6 Cluster List & Satellite Chips Removed (0:19 / User Override)**:
   - Completely removed the redundant right-edge `CLUSTER` vertical scrolling list card (`x: 1650px`) that overlapped with the Global Progress Rail (`x: 1884px`).
   - Removed the 5 satellite chip boxes (`Qwen 3`, `Llama 3 70B`, `Nemotron 4`, `Mistral 8x22B`, `Command R+`) floating on the inner ring around CORE.
   - The scene now cleanly features the central Core badge, 5 hero model cards with energy packet spokes, and the model counter chip (`MODELS: 10 / 10`) with zero visual clutter.
5. **Scene 7 3D Card Flip (E7)**:
   - In `W7` card flip, set `backfaceVisibility: 'hidden'` on the front card.
   - Render a matching backface card rotated `rotateY(180deg)` showing the switched runtime target so no text is ever mirrored backwards.
   - Render the cracking lock icon SVG beside the headline.

---

### 2.4 Scene 8 (`Scene2FrontierMatrix.tsx`)
1. **Ghost Cursor (E8)**:
   - Add `GhostCursor` with waypoints across the observability cards (`Gemini` -> `DeepSeek` -> `Throughput`).
2. **Clean Scan Light (E8)**:
   - Replace the fuzzy teal blob with a vertical 2px mint laser beam (`height: 260px`, `boxShadow: '0 0 16px #10b981'`) sweeping smoothly across the cards from `x: 100` to `x: 1820`.
3. **Scroll Stabilization (User Override)**:
   - Eliminated the periodic `translateY(-${(s8Frame * 3) % 90}px)` loop that caused log lines to jump and collide over the `● LIVE STREAMING TELEMETRY` header.
   - Text lines and scrollbar thumb are now perfectly stationary, crisp, and readable.

---

### 2.5 Scene 9 & 10 (`Scene3PromptCompiler.tsx`)
1. **XML Text Contrast, Sizing & Single-Line Footer (E9)**:
   - Widened `directive.xml` card to `680px` (occupies `x: 1060–1740` at rest).
   - Calibrated mono font size to `18px` with line height `1.65` so all closing XML tags and quotes fit completely on single lines without wrapping or touching the right border.
   - Fixed footer pass chips (`[PASS 1: SCHEMA ✓]`, `[PASS 2: LOGIC ✓]`, `[PASS 3: HARMONY ✓]`) with `justifyContent: 'space-between'` and `fontSize: 17px` to eliminate the wrapped `✓]` character artifact.
2. **Symmetrical Dual Architecture Studio (Redesign / User Override)**:
   - Completely scrapped the awkward `W8` slide-over drawer panel that overlapped code and collided with the Global Progress Rail.
   - Implemented a pristine, symmetrical dual-workstation layout:
     - **Left Panel (`x: 160–940`, width 780px)**: The compiled `directive.xml` with line numbers, glowing mint zero-coding guardrails, and schema pass status.
     - **Right Panel (`x: 980–1760`, width 780px)**: Dedicated **Schema & Archetype Inspector** with an Archetype Target card, live 4-pass reasoning telemetry rows (`Pass 1` through `Pass 4`), and a production determinism banner.
   - Guaranteed **124px of clear margin** before the Global Progress Rail (`x: 1884`), eliminating all rail collisions, overlays, or awkward translation shifts.

---

### 2.6 Scene 11 & 12 (`Scene4DAGBranching.tsx`)
1. **DAG Log Overlapping Lines (E10)**:
   - Fix DAG log box line rendering with explicit `gap: 8px`, `display: flex`, `flexDirection: column` to eliminate text collision.
2. **Active S6 Upward Log Scroll (E10)**:
   - Animate `translateY` on the log lines container over time (`-24px` per second).
3. **Removal of Sudden Macro Zoom on Latency Chip (User Override)**:
   - Completely removed the abrupt `Z7` `1.0 -> 1.5` scale animation on the `PRUNING LATENCY: 0.8 ms` badge.
   - The chip now remains stationary at standard scale with clean styling, preventing any sudden distortion or jarring movement.

---

### 2.7 Scene 13 & 14 (`Scene5ArenaAndFrameworks.tsx`)
1. **Hit Sync & Card Collision at 43.3s (E11)**:
   - Force headline "Frontier head-to-head." to render with zero entry delay in Scene 13 so it is 100% visible on Frame 2598 (43.30s).
   - Animate cards sliding inward from opposite sides and slamming together at Frame 2598 with `Z2` punch-in, flash, and spark particles, then rebounding to resting positions.
2. **Frameworks Tile Alignment & Cursor Overlap (E12 / User Override)**:
   - Fixed pill container alignment: replaced narrow fixed 320px width with automatic horizontal padding (`padding: '12px 36px'`) and `whiteSpace: 'nowrap'`.
   - The text `+3 MORE EXPORT RUNTIMES` now sits on a single, perfectly centered line with balanced curved pill caps and mint accent highlighting on `+{plusThreeCounter}`.
   - Repositioned the ghost cursor to click the `READY` tag of `Promptfoo` at `(1650, 640)`, safely 80px away from the word `Promptfoo`.
3. **Removal of 3D Cylinder Flipping Effect (E12 / User Override)**:
   - Completely eliminated the 3D `rotateY` cylinder rotation that caused the framework cards to rotate backwards and display mirror-reversed text.
   - Replaced with a smooth front-facing scale (`scale: 1 -> 0.92`) and opacity fade transition into the Monolithic Finale, keeping all typography 100% upright and readable at all times.

---

### 2.8 Scene 15, 16 & 17 (`Scene6MonolithicFinale.tsx`)
1. **Typography Fix for Headlines (E13, E14)**:
   - Add `fontFamily: "'Inter', sans-serif"` to "Stop guessing.", "Start engineering.", and "Bedrock".
   - Hide redundant bottom captions in Scenes 15 and 16 (`hideCaption={true}`).
   - Animate the mint underline on "Start engineering." landing on Frame 3225 (53.75s).
2. **End-Card Shockwave, Geometry & Download Box (E14 / User Override)**:
   - Center the shockwave ring directly on the Bedrock logo icon (`top: 320px`, `left: 960px`).
   - Replaced terminal CLI command box (`$ npm i -g @bedrock/cli`) with a sleek, dual-platform "Download for Windows & Mac" glassmorphic action box.
   - Includes custom vector logos (Windows & Apple), dedicated action buttons (`Download for Windows` with `Windows 10/11 · .exe`, and `Download for Mac` with `macOS 12+ · .dmg`), and single-line nowrap symmetry.
   - Ghost cursor smoothly glides to and clicks the primary `Download for Windows` button at Frame 3380 (local Frame 63) with active tactile press response.
   - Subtitle `WINDOWS & macOS · v1.2.4` cleanly positioned below the action container.

---

## 3. Implementation Verification Checklist

- [x] `SceneChrome.tsx`: Shine pass unmasked trapezoid removed (opacity fade + text clip).
- [x] `SceneChrome.tsx`: Multi-word keyWord underline working.
- [x] `Scene1ProblemAndGenesis.tsx`: Error red state active through f306; Scene 3 duplicate headline removed; 90° orthogonal camera alignment (dutchTilt removed).
- [x] `Scene2FrontierMatrix.tsx`: Pill row detached from zoom scale; card values spaced; Claude margin clearance; 3D card flip un-mirrored; ghost cursor in Scene 8; 5 satellite model chips removed.
- [x] `Scene3PromptCompiler.tsx`: XML contrast lifted; closing tags unclipped; symmetrical dual-workstation inspector layout.
- [x] `Scene4DAGBranching.tsx`: DAG log collision resolved; S6 upward scrolling active; 0.8ms chip zoom stabilized.
- [x] `Scene5ArenaAndFrameworks.tsx`: 43.3s headline visible; Arena card clash impact; Promptfoo cursor clearance; +3 more tile single-line auto padding.
- [x] `Scene6MonolithicFinale.tsx`: Sans-serif `Inter` applied to all headlines/wordmarks; duplicate captions removed; shockwave aligned with logo; terminal CLI box replaced with dual-platform "Download for Windows & Mac" action box.
- [x] Full headless 60fps render re-run and verified (public/bedrock-intro.mp4 - 34.7 MB).
