"""
Bedrock launch film — voiceover generator.

Reads remotion/launch/data/script.json, renders one voice clip per section,
gives it a deep "trailer" treatment (low-shelf bass, presence, compression),
and writes word-level timings to remotion/launch/data/narration.json so the
picture and subtitles lock to the voice.

Providers
  elevenlabs  final voice. Needs ELEVENLABS_API_KEY in .env.local / .env.
              Uses POST /v1/text-to-speech/{voice_id}/with-timestamps.
  edge        free Microsoft neural voice, used as a timing/preview stand-in.

Usage (from repo root)
  python -I scripts/launch-video/generate_voiceover.py --provider edge
  python -I scripts/launch-video/generate_voiceover.py --provider elevenlabs --voice-id <id>
  python -I scripts/launch-video/generate_voiceover.py --list-voices
  python -I scripts/launch-video/generate_voiceover.py --provider elevenlabs --samples <id1,id2,...>
"""
import argparse
import asyncio
import base64
import json
import os
import re
import subprocess
import sys
import tempfile
import urllib.request

import numpy as np
from scipy.io import wavfile
from scipy.signal import lfilter

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
SCRIPT_JSON = os.path.join(ROOT, "remotion", "launch", "data", "script.json")
NARRATION_JSON = os.path.join(ROOT, "remotion", "launch", "data", "narration.json")
# Voice takes live outside public/ (they are source material, not shipped assets).
OUT_DIR = os.path.join(ROOT, "remotion", "launch", "audio-src")
SAMPLES_DIR = os.path.join(ROOT, "scratch", "voice-samples")
SR = 48000
MIN_GAP = 0.32  # seconds of air between sections
END_LIMIT = 58.6  # last word must finish before the end card settles


# ---------------------------------------------------------------- utilities
def load_env_key(name):
    if os.environ.get(name):
        return os.environ[name]
    for fname in (".env.local", ".env"):
        path = os.path.join(ROOT, fname)
        if not os.path.exists(path):
            continue
        with open(path, encoding="utf-8") as f:
            for line in f:
                m = re.match(rf"^\s*{name}\s*=\s*(.*)\s*$", line)
                if m:
                    return m.group(1).strip().strip('"').strip("'")
    return None


def norm(s):
    return re.sub(r"[^a-z0-9]", "", s.lower())


def ffmpeg(*args):
    cmd = ["npx", "remotion", "ffmpeg", "-hide_banner", "-loglevel", "error", "-y", *args]
    subprocess.run(cmd, check=True, cwd=ROOT, shell=(os.name == "nt"), capture_output=True)


def decode_to_array(audio_bytes, suffix):
    with tempfile.TemporaryDirectory() as tmp:
        src = os.path.join(tmp, "in" + suffix)
        dst = os.path.join(tmp, "out.wav")
        with open(src, "wb") as f:
            f.write(audio_bytes)
        ffmpeg("-i", src, "-ar", str(SR), "-ac", "1", "-c:a", "pcm_s16le", dst)
        _, data = wavfile.read(dst)
    return data.astype(np.float64) / 32768.0


# ---------------------------------------------------------------- voice DSP
def biquad_shelf(kind, f0, gain_db, q=0.707):
    a = 10 ** (gain_db / 40)
    w0 = 2 * np.pi * f0 / SR
    alpha = np.sin(w0) / (2 * q)
    cw = np.cos(w0)
    sa = 2 * np.sqrt(a) * alpha
    if kind == "low":
        b = [a * ((a + 1) - (a - 1) * cw + sa), 2 * a * ((a - 1) - (a + 1) * cw), a * ((a + 1) - (a - 1) * cw - sa)]
        den = [(a + 1) + (a - 1) * cw + sa, -2 * ((a - 1) + (a + 1) * cw), (a + 1) + (a - 1) * cw - sa]
    else:
        b = [a * ((a + 1) + (a - 1) * cw + sa), -2 * a * ((a - 1) + (a + 1) * cw), a * ((a + 1) + (a - 1) * cw - sa)]
        den = [(a + 1) - (a - 1) * cw + sa, 2 * ((a - 1) - (a + 1) * cw), (a + 1) - (a - 1) * cw - sa]
    return np.array(b) / den[0], np.array(den) / den[0]


def compress(x, threshold_db=-20.0, ratio=3.0, attack=0.004, release=0.09):
    env = np.abs(x)
    a_att = np.exp(-1 / (attack * SR))
    a_rel = np.exp(-1 / (release * SR))
    smoothed = np.zeros_like(env)
    level = 0.0
    for i, e in enumerate(env):
        coef = a_att if e > level else a_rel
        level = coef * level + (1 - coef) * e
        smoothed[i] = level
    db = 20 * np.log10(np.maximum(smoothed, 1e-6))
    over = np.maximum(0, db - threshold_db)
    gain = 10 ** (-(over - over / ratio) / 20)
    return x * gain


def trailer_voice(x):
    """Deep, close, broadcast-style treatment for the narration."""
    b, a = biquad_shelf("low", 130, 5.0)
    x = lfilter(b, a, x)
    b, a = biquad_shelf("high", 5200, 2.0)
    x = lfilter(b, a, x)
    x = compress(x, -22, 3.2)
    peak = np.max(np.abs(x)) or 1.0
    return x * (10 ** (-1.5 / 20) / peak)


def write_wav(path, x):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    wavfile.write(path, SR, (np.clip(x, -1, 1) * 32767).astype(np.int16))


# ---------------------------------------------------------------- providers
def tokens_of(text):
    return text.split()


async def edge_synth(text, voice, rate, pitch):
    import edge_tts

    comm = edge_tts.Communicate(text, voice, rate=rate, pitch=pitch, boundary="WordBoundary")
    audio = bytearray()
    marks = []
    async for chunk in comm.stream():
        if chunk["type"] == "audio":
            audio.extend(chunk["data"])
        elif chunk["type"] == "WordBoundary":
            start = chunk["offset"] / 1e7
            marks.append((chunk["text"], start, start + chunk["duration"] / 1e7))
    # Map Microsoft word marks back onto the script's whitespace tokens.
    words, j = [], 0
    for tok in tokens_of(text):
        target, acc, start, end = norm(tok), "", None, None
        while j < len(marks) and len(acc) < len(target):
            piece = norm(marks[j][0])
            if piece:
                acc += piece
                start = marks[j][1] if start is None else start
                end = marks[j][2]
            j += 1
        if start is None:  # punctuation-only token
            start = end = words[-1]["end"] if words else 0.0
        words.append({"text": tok, "start": round(start, 3), "end": round(end, 3)})
    return bytes(audio), ".mp3", words


def eleven_request(path, payload=None, key=None):
    url = f"https://api.elevenlabs.io{path}"
    data = json.dumps(payload).encode() if payload is not None else None
    req = urllib.request.Request(url, data=data, method="POST" if data else "GET")
    req.add_header("xi-api-key", key)
    req.add_header("Accept", "application/json")
    if data:
        req.add_header("Content-Type", "application/json")
    with urllib.request.urlopen(req, timeout=120) as r:
        return json.loads(r.read().decode())


def eleven_synth(text, voice_id, key, model, stability, similarity, style, speed, prev_text=None, next_text=None):
    payload = {
        "text": text,
        "model_id": model,
        "voice_settings": {
            "stability": stability,
            "similarity_boost": similarity,
            "style": style,
            "use_speaker_boost": True,
            "speed": speed,
        },
    }
    if prev_text:
        payload["previous_text"] = prev_text
    if next_text:
        payload["next_text"] = next_text
    res = eleven_request(f"/v1/text-to-speech/{voice_id}/with-timestamps?output_format=mp3_44100_192", payload, key)
    audio = base64.b64decode(res["audio_base64"])
    al = res.get("alignment") or res["normalized_alignment"]
    chars, starts, ends = al["characters"], al["character_start_times_seconds"], al["character_end_times_seconds"]
    words, cur, cs, ce = [], "", None, None
    for ch, s, e in zip(chars, starts, ends):
        if ch.isspace():
            if cur:
                words.append({"text": cur, "start": round(cs, 3), "end": round(ce, 3)})
            cur, cs, ce = "", None, None
            continue
        cur += ch
        cs = s if cs is None else cs
        ce = e
    if cur:
        words.append({"text": cur, "start": round(cs, 3), "end": round(ce, 3)})
    expected = tokens_of(text)
    if [norm(w["text"]) for w in words] != [norm(t) for t in expected]:
        print("  ! alignment tokens differ from script tokens; keeping script text", file=sys.stderr)
        words = [{"text": t, "start": w["start"], "end": w["end"]} for t, w in zip(expected, words)]
    return audio, ".mp3", words


# ---------------------------------------------------------------- commands
def list_voices(key):
    res = eleven_request("/v1/voices", key=key)
    for v in res.get("voices", []):
        labels = v.get("labels") or {}
        print(f"{v['voice_id']}  {v['name']:<28} {labels.get('gender', ''):<8} {labels.get('age', ''):<12} {labels.get('accent', ''):<14} {labels.get('description', '') or labels.get('descriptive', '')}  [{v.get('category', '')}]")


def render_samples(args, key):
    line = "This is Bedrock. Intelligence, shaped by you. Stop guessing with LLMs. Start engineering."
    os.makedirs(SAMPLES_DIR, exist_ok=True)
    for vid in args.samples.split(","):
        audio, suffix, _ = eleven_synth(line, vid.strip(), key, args.model, args.stability, args.similarity, args.style, args.speed)
        x = trailer_voice(decode_to_array(audio, suffix))
        out = os.path.join(SAMPLES_DIR, f"sample_{vid.strip()}.wav")
        write_wav(out, x)
        print("wrote", os.path.relpath(out, ROOT))


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--provider", choices=["edge", "elevenlabs"], default="edge")
    p.add_argument("--voice", default="en-US-ChristopherNeural", help="edge voice")
    p.add_argument("--rate", default="-4%", help="edge rate")
    p.add_argument("--pitch", default="-6Hz", help="edge pitch")
    p.add_argument("--voice-id", help="ElevenLabs voice id")
    p.add_argument("--model", default="eleven_multilingual_v2")
    p.add_argument("--stability", type=float, default=0.42)
    p.add_argument("--similarity", type=float, default=0.8)
    p.add_argument("--style", type=float, default=0.28)
    p.add_argument("--speed", type=float, default=0.96)
    p.add_argument("--list-voices", action="store_true")
    p.add_argument("--samples", help="comma-separated ElevenLabs voice ids to audition")
    args = p.parse_args()

    key = None
    if args.provider == "elevenlabs" or args.list_voices or args.samples:
        key = load_env_key("ELEVENLABS_API_KEY")
        if not key:
            sys.exit("ELEVENLABS_API_KEY not found in environment, .env.local or .env")
    if args.list_voices:
        return list_voices(key)
    if args.samples:
        return render_samples(args, key)
    if args.provider == "elevenlabs" and not args.voice_id:
        sys.exit("--voice-id is required for elevenlabs (see --list-voices)")

    with open(SCRIPT_JSON, encoding="utf-8") as f:
        sections = json.load(f)["sections"]

    os.makedirs(OUT_DIR, exist_ok=True)
    out_sections, prev_end = [], -1.0
    for i, s in enumerate(sections):
        print(f"[{s['id']}] synthesizing...")
        if args.provider == "edge":
            audio, suffix, words = asyncio.run(edge_synth(s["text"], args.voice, args.rate, args.pitch))
        else:
            prev_text = sections[i - 1]["text"] if i else None
            next_text = sections[i + 1]["text"] if i + 1 < len(sections) else None
            audio, suffix, words = eleven_synth(
                s["text"], args.voice_id, key, args.model, args.stability, args.similarity, args.style, args.speed, prev_text, next_text
            )
        x = trailer_voice(decode_to_array(audio, suffix))
        duration = len(x) / SR
        rel = f"remotion/launch/audio-src/vo_{s['id']}.wav"
        write_wav(os.path.join(ROOT, rel), x)

        first_word = words[0]["start"] if words else 0.0
        start = max(float(s["start"]) - first_word, prev_end + MIN_GAP - first_word if prev_end > 0 else 0.0)
        start = max(0.0, start)
        prev_end = start + (words[-1]["end"] if words else duration)
        out_sections.append({"id": s["id"], "file": rel, "start": round(start, 3), "duration": round(duration, 3), "words": words})
        print(f"   clip {duration:5.2f}s  speech {start + first_word:6.2f}s -> {prev_end:6.2f}s")

    with open(NARRATION_JSON, "w", encoding="utf-8") as f:
        json.dump({"source": args.provider, "sections": out_sections}, f, indent=2)
    print("wrote", os.path.relpath(NARRATION_JSON, ROOT))
    if prev_end > END_LIMIT:
        print(f"WARNING: narration ends at {prev_end:.2f}s (> {END_LIMIT}s). Tighten script starts or speed.", file=sys.stderr)


if __name__ == "__main__":
    main()
