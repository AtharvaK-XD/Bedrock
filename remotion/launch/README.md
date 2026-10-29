# Bedrock launch film (60 s · 2560×1440 · 60 fps)

A 60-second problem-to-solution launch film. The picture, voice, subtitles and sound design all run off one timeline, so every beat lands on the word being spoken.

| Composition | Size | Use |
|---|---|---|
| `BedrockLaunch2K` | 2560×1440, 60 fps, 3600 frames | final master |
| `BedrockLaunchPreview` | 1920×1080, same timeline | fast previews |

## Pipeline

```
data/script.json ──► generate_voiceover.py ──► audio-src/vo_*.wav (voice takes)
                                           └─► data/narration.json (word timings)
data/narration.json ──► timeline.ts (words → frames, scene ranges, cue())
                         ├─► scenes/*        (animations keyed to spoken words)
                         ├─► Subtitles.tsx   (word-by-word highlight)
                         └─► beats.ts ──► export-cues.mts ──► data/cues.json
data/cues.json + vo_*.wav ──► build_score.py ──► public/audio/launch/mix.mp3
```

Run order after any script or voice change (from the repo root):

```bash
python -I scripts/launch-video/generate_voiceover.py --provider elevenlabs --voice-id <id>
npx tsx scripts/launch-video/export-cues.mts
python -I scripts/launch-video/build_score.py
npx remotion render remotion/index.ts BedrockLaunch2K public/bedrock-launch-2k.mp4 --crf=16
```

`--provider edge` gives a free stand-in voice for checking timing.

## Files

- `data/script.json` holds the narration. Every claim comes from `src/pages/Landing.tsx` or `README.md`. Edit the narration here and nowhere else.
- `timeline.ts` maps word timings to frames. Use `sceneCues(id).at('phrase')` for a beat.
- `beats.ts` lists the sound-design hits. The derived beats (shatter, logo impact) are shared with the scenes.
- `theme.ts` holds the tokens. The primary color is `#2C9A8B` (the app's `copper-500`), with the same fonts as the app: Space Grotesk, Inter, Fira Code and Playfair Display.
- `scenes/` has 7 scenes: Problem → Reveal → Generator → Branching → Arena → Export → Finale.
- `components/` has the shared pieces:
  - `Stage` scales the 1920×1080 design space up to 2K.
  - `LogoAssembly` builds the real logo from shards made by `build-logo-shards.py`.
  - `AppWindow` recreates the app's top bar.
  - `Subtitles`, `Fx` and `Cursor` cover captions, effects and the on-screen cursor.
- `clips.ts` holds optional Higgsfield background plates, text-free atmosphere only.
- `audio.ts` points to the final mix. Only `mix.mp3` ships in `public/`; voice takes stay in `audio-src/`, and stems go to the gitignored `scratch/launch-audio/`.

## Higgsfield plates (optional)

Generate after `higgsfield auth login`. Save the files under `public/video/launch/` and set their paths in `clips.ts`. The plates must contain **no text, UI or logos**, because AI video garbles them.

- **reveal**: macro shot of dark basalt rock strata cracking open, teal `#2C9A8B` light glowing through the fissures, dust and haze, slow push-in, black background.
- **finale**: slow glide over a dark basalt plain with glowing teal veins forming a geometric grid, volumetric fog.
