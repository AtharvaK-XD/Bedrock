"""
Bedrock launch film — score, sound design and final mix.

Synthesizes a heavy-bass trailer score and every sound effect from scratch
(deterministic, no samples, no licensing), locks them to the cue sheet
exported from the Remotion timeline, ducks the bed under the narration, mixes
in the voice clips, and masters to public/audio/launch/mix.wav.

Inputs  remotion/launch/data/cues.json     (npx tsx scripts/launch-video/export-cues.mts)
        remotion/launch/data/narration.json + remotion/launch/audio-src/vo_*.wav
Output  public/audio/launch/mix.mp3 (320 kbps, used by the film)
        scratch/launch-audio/mix.wav + music/sfx/voice stems (local only)

Usage (from repo root):  python -I scripts/launch-video/build_score.py
"""
import json
import os
import subprocess

import numpy as np
from scipy.io import wavfile
from scipy.ndimage import maximum_filter1d
from scipy.signal import butter, fftconvolve, sosfilt

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
CUES = os.path.join(ROOT, "remotion", "launch", "data", "cues.json")
OUT_DIR = os.path.join(ROOT, "public", "audio", "launch")
WORK_DIR = os.path.join(ROOT, "scratch", "launch-audio")
SR = 48000
rng = np.random.default_rng(2026)


# ============================================================ DSP helpers
def t_axis(dur):
    return np.arange(int(dur * SR)) / SR


def midi(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def filt(x, kind, f, order=2):
    if isinstance(f, (list, tuple)):
        f = [min(max(v, 20), SR / 2 - 100) for v in f]
    else:
        f = min(max(f, 20), SR / 2 - 100)
    sos = butter(order, f, btype=kind, fs=SR, output="sos")
    return sosfilt(sos, x)


def env_ad(n, attack, decay, curve=4.0):
    a = max(1, int(attack * SR))
    e = np.ones(n)
    e[:a] = np.linspace(0, 1, a) if a < n else np.linspace(0, 1, n)
    if n > a:
        tt = np.arange(n - a) / SR
        e[a:] = np.exp(-tt * curve / max(decay, 1e-3))
    return e


def noise(n):
    return rng.standard_normal(n)


def saw(freq, t, detune_cents=0.0):
    f = freq * 2 ** (detune_cents / 1200)
    ph = (f * t + rng.random()) % 1.0
    return 2 * ph - 1


def make_ir(dur=2.4, damp=5500, seed=0):
    r = np.random.default_rng(seed)
    n = int(dur * SR)
    tt = np.arange(n) / SR
    ir = r.standard_normal(n) * np.exp(-tt * 3.2)
    ir = filt(ir, "low", damp)
    ir[: int(0.012 * SR)] *= np.linspace(0, 1, int(0.012 * SR))
    return ir / np.sqrt(np.sum(ir**2))


IR_L, IR_R = make_ir(seed=1), make_ir(seed=2)
IR_SMALL_L, IR_SMALL_R = make_ir(0.6, 7000, 3), make_ir(0.6, 7000, 4)


def reverb(mono_or_st, wet=0.25, small=False):
    x = mono_or_st if mono_or_st.ndim == 2 else np.stack([mono_or_st, mono_or_st])
    il, ir = (IR_SMALL_L, IR_SMALL_R) if small else (IR_L, IR_R)
    wl = fftconvolve(x[0], il)[: x.shape[1]]
    wr = fftconvolve(x[1], ir)[: x.shape[1]]
    return x * (1 - wet * 0.35) + np.stack([wl, wr]) * wet


def swept_noise(n, fc):
    """Noise whose spectral centre follows fc (Hz, per sample) — smooth band crossfade."""
    x = noise(n)
    centers = np.geomspace(180, 11000, 16)
    out = np.zeros(n)
    lf = np.log(np.maximum(fc, 20))
    for c in centers:
        band = filt(x, "band", [c / 1.25, c * 1.25])
        w = np.exp(-((lf - np.log(c)) ** 2) / (2 * 0.32**2))
        out += band * w
    return out


def pan(mono, p=0.0):
    l = np.cos((p + 1) * np.pi / 4)
    r = np.sin((p + 1) * np.pi / 4)
    return np.stack([mono * l, mono * r])


def place(bus, sig, at_sec, gain=1.0):
    st = sig if sig.ndim == 2 else np.stack([sig, sig])
    i = int(round(at_sec * SR))
    if i >= bus.shape[1]:
        return
    j0 = max(0, -i)
    i = max(0, i)
    n = min(st.shape[1] - j0, bus.shape[1] - i)
    if n > 0:
        bus[:, i : i + n] += st[:, j0 : j0 + n] * gain


def db(x):
    return 10 ** (x / 20)


# ============================================================ instruments
def kick(gain=1.0):
    t = t_axis(0.55)
    f = 46 + 110 * np.exp(-t * 28)
    ph = 2 * np.pi * np.cumsum(f) / SR
    body = np.sin(ph) * env_ad(len(t), 0.002, 0.42, 5)
    click = filt(noise(len(t)), "high", 2500) * env_ad(len(t), 0.0005, 0.012, 6) * 0.35
    return np.tanh((body + click) * 1.8) * 0.9 * gain


def sub808(freq, dur, gain=1.0):
    t = t_axis(dur)
    f = freq * (1 + 0.6 * np.exp(-t * 35))
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) + 0.25 * np.sin(4 * np.pi * np.cumsum(f) / SR)
    e = np.minimum(1, t / 0.01) * np.minimum(1, np.maximum(0, (dur - t) / 0.12))
    return np.tanh(s * e * 1.6) * 0.75 * gain


def pad_chord(notes, dur, cutoff=1600, gain=1.0):
    t = t_axis(dur)
    x = np.zeros(len(t))
    for m in notes:
        for d in (-9, 0, 8):
            x += saw(midi(m), t, d)
    x = filt(x / (3 * len(notes)), "low", cutoff, 2)
    e = np.minimum(1, t / 0.35) * np.minimum(1, np.maximum(0, (dur - t) / 0.5))
    return x * e * 0.55 * gain


def pluck(freq, gain=1.0):
    t = t_axis(0.32)
    x = saw(freq, t) * 0.6 + np.sin(2 * np.pi * freq * 2 * t) * 0.3
    x = filt(x, "low", 2400 + 2200 * 1)  # bright digital pluck
    return x * env_ad(len(t), 0.002, 0.16, 5) * 0.32 * gain


def hat(gain=1.0, open_=False):
    n = int((0.18 if open_ else 0.05) * SR)
    x = filt(noise(n), "high", 7500)
    return x * env_ad(n, 0.0005, 0.12 if open_ else 0.028, 5) * 0.16 * gain


def clap(gain=1.0):
    n = int(0.35 * SR)
    x = filt(noise(n), "band", [900, 3800])
    e = np.zeros(n)
    for k, off in enumerate((0, 0.011, 0.022)):
        i = int(off * SR)
        e[i:] += env_ad(n - i, 0.0005, 0.03 if k < 2 else 0.18, 5) * (0.8 if k < 2 else 1)
    return x * e * 0.32 * gain


# ============================================================ sound design
def sfx_whoosh(heavy=False, gain=1.0):
    dur = 1.1 if heavy else 0.8
    t = t_axis(dur)
    n = len(t)
    out = swept_noise(n, 300 + 5200 * np.sin(np.pi * t / dur) ** 2)
    e = np.sin(np.pi * np.clip(t / dur, 0, 1)) ** 2.2
    s = out * e * (0.55 if heavy else 0.4)
    if heavy:
        s += np.sin(2 * np.pi * (60 - 20 * t / dur) * t) * e * 0.35
    st = np.stack([s * (1 - 0.6 * t / dur), s * (0.4 + 0.6 * t / dur)])
    return reverb(st, 0.2) * gain


def sfx_impact(level="impact", gain=1.0):
    dur = {"impactSoft": 1.2, "impact": 2.0, "boom": 4.0}[level]
    t = t_axis(dur)
    f = 38 + (140 if level == "boom" else 90) * np.exp(-t * (14 if level == "boom" else 20))
    sub = np.sin(2 * np.pi * np.cumsum(f) / SR) * env_ad(len(t), 0.001, dur * 0.55, 3.2)
    crack = filt(noise(len(t)), "low", 3200) * env_ad(len(t), 0.0005, 0.09, 5)
    body = filt(noise(len(t)), "band", [80, 400]) * env_ad(len(t), 0.001, 0.4, 4) * 0.6
    amt = {"impactSoft": 0.55, "impact": 0.85, "boom": 1.1}[level]
    s = np.tanh((sub * 1.2 + crack * 0.5 + body) * 1.5) * amt
    return reverb(s, 0.35 if level == "boom" else 0.22) * gain


def sfx_shatter(gain=1.0):
    dur = 2.6
    n = int(dur * SR)
    out = np.zeros(n)
    t = np.arange(n) / SR
    burst = filt(noise(n), "high", 2500) * env_ad(n, 0.0005, 0.35, 4) * 0.7
    out += burst
    for k in range(70):  # glass shards: inharmonic decaying pings
        start = int(abs(rng.normal(0, 0.18)) * SR)
        if start >= n:
            continue
        m = n - start
        tt = np.arange(m) / SR
        fr = rng.uniform(2200, 9500)
        ping = np.sin(2 * np.pi * fr * tt) * np.exp(-tt * rng.uniform(18, 45)) * rng.uniform(0.05, 0.22)
        out[start:] += ping
    low = np.sin(2 * np.pi * (70 - 30 * np.minimum(1, t / 0.4)) * t) * env_ad(n, 0.001, 0.5, 4) * 0.7
    s = np.tanh((out + low) * 1.2)
    return reverb(np.stack([s * 0.95, np.roll(s, 90) * 0.95]), 0.3) * gain


def sfx_glitch(gain=1.0):
    dur = 0.42
    n = int(dur * SR)
    out = np.zeros(n)
    i = 0
    while i < n:
        seg = int(rng.uniform(0.008, 0.04) * SR)
        f = rng.choice([180, 420, 880, 1760, 3300])
        tt = np.arange(min(seg, n - i)) / SR
        out[i : i + seg] = np.sign(np.sin(2 * np.pi * f * tt)) * rng.uniform(0.15, 0.5) * (rng.random() > 0.25)
        i += seg
    out = np.round(out * 6) / 6  # bitcrush
    out = filt(out, "band", [200, 6000])
    return pan(out * 0.55, rng.uniform(-0.4, 0.4)) * gain


def sfx_alarm(gain=1.0):
    dur = 1.3
    t = t_axis(dur)
    tone = np.where((t * 4) % 1 < 0.5, 880, 660)
    x = filt(np.sign(np.sin(2 * np.pi * np.cumsum(tone) / SR)), "band", [500, 2500])
    return reverb(x * env_ad(len(t), 0.005, 1.0, 1.5) * 0.18, 0.3) * gain


def sfx_click(gain=1.0):
    n = int(0.06 * SR)
    x = filt(noise(n), "band", [1500, 6000]) * env_ad(n, 0.0002, 0.012, 6)
    x += np.sin(2 * np.pi * 1800 * np.arange(n) / SR) * env_ad(n, 0.0002, 0.02, 6) * 0.4
    return x * 0.5 * gain


def sfx_tick(gain=1.0):
    n = int(0.08 * SR)
    t = np.arange(n) / SR
    return np.sin(2 * np.pi * 2600 * t) * env_ad(n, 0.0002, 0.03, 6) * 0.22 * gain


def sfx_pop(gain=1.0):
    n = int(0.22 * SR)
    t = np.arange(n) / SR
    f = 320 + 900 * np.exp(-t * 40)
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * env_ad(n, 0.001, 0.08, 5)
    return reverb(pan(x * 0.35, rng.uniform(-0.5, 0.5)), 0.15, small=True) * gain


def sfx_chime(gain=1.0):
    dur = 3.0
    t = t_axis(dur)
    x = np.zeros(len(t))
    for ratio, amp, dec in ((1, 1, 2.2), (2.76, 0.5, 1.4), (5.4, 0.25, 0.8), (8.93, 0.12, 0.5)):
        x += np.sin(2 * np.pi * midi(81) * ratio * t) * amp * np.exp(-t * 3 / dec)
    x *= np.minimum(1, t / 0.003) * 0.16
    return reverb(np.stack([x, np.roll(x, 240)]), 0.45) * gain


def sfx_riser(len_sec, gain=1.0):
    t = t_axis(len_sec)
    p = t / len_sec
    out = swept_noise(len(t), 400 + 9000 * p**2)
    tone = np.sin(2 * np.pi * np.cumsum(110 + 660 * p**2) / SR) * 0.25
    s = (out * 0.5 + tone) * p**2.2
    return reverb(np.stack([s, np.roll(s, 120)]), 0.3) * gain


def sfx_stamp(gain=1.0):
    return sfx_impact("impactSoft", 0.8) + np.pad(pan(sfx_click(1.2)), ((0, 0), (0, int(1.2 * SR) - int(0.06 * SR)))) * 0.6 * gain


SFX = {
    "click": lambda g, l: sfx_click(g),
    "tick": lambda g, l: sfx_tick(g),
    "pop": lambda g, l: sfx_pop(g),
    "whoosh": lambda g, l: sfx_whoosh(False, g),
    "whooshHeavy": lambda g, l: sfx_whoosh(True, g),
    "glitch": lambda g, l: sfx_glitch(g),
    "alarm": lambda g, l: sfx_alarm(g),
    "impactSoft": lambda g, l: sfx_impact("impactSoft", g),
    "impact": lambda g, l: sfx_impact("impact", g),
    "boom": lambda g, l: sfx_impact("boom", g),
    "shatter": lambda g, l: sfx_shatter(g),
    "chime": lambda g, l: sfx_chime(g),
    "riser": lambda g, l: sfx_riser(l, g),
    "stamp": lambda g, l: sfx_stamp(g),
}


# ============================================================ arrangement
PROG = [  # (bass root midi, pad notes)  A minor: i – VI – III – VII
    (33, [57, 60, 64]),
    (29, [53, 57, 60]),
    (36, [52, 55, 60]),
    (31, [50, 55, 59]),
]


def build_music(cues, total):
    fps = cues["fps"]
    sec = lambda f: f / fps
    sc = {k: (sec(v["from"]), sec(v["from"] + v["dur"])) for k, v in cues["scenes"].items()}
    m = {k: sec(v) for k, v in cues["music"].items()}
    bus = np.zeros((2, int(total * SR)))
    duck_src = np.zeros(int(total * SR))  # kick sidechain envelope

    # ---- 1. tension bed (0 → shatter)
    tens = m["tensionEnd"]
    t = t_axis(tens)
    drone = (np.sin(2 * np.pi * 55 * t) + 0.5 * np.sin(2 * np.pi * 82.41 * t + 0.3)) * 0.28
    drone *= np.minimum(1, t / 3) * (0.7 + 0.3 * t / tens)
    wind = filt(noise(len(t)), "band", [180, 900]) * 0.05 * (0.4 + 0.6 * t / tens)
    clash = (saw(midi(57), t, -6) + saw(midi(58), t, 5)) * 0.06
    clash = filt(clash, "low", 900) * np.clip((t - (tens - 4)) / 4, 0, 1)
    place(bus, reverb(np.stack([drone + wind + clash, drone + wind * 0.8 + clash]), 0.25), 0)
    # anxious clock: every 0.5 s, then 0.25 s after the model update
    model_t = next((sec(h["f"]) for h in cues["hits"] if h["kind"] == "glitch"), tens * 0.6)
    x = 0.3
    while x < tens - 0.2:
        place(bus, pan(sfx_tick(0.55 if x < model_t else 0.75), 0.25 if int(x * 4) % 2 else -0.25), x)
        x += 0.5 if x < model_t else 0.25
    # heartbeat lows after the drift
    drift_t = [sec(h["f"]) for h in cues["hits"] if h["kind"] == "glitch"]
    hb = drift_t[-1] if drift_t else tens * 0.75
    while hb < tens - 0.3:
        place(bus, kick(0.45), hb)
        place(bus, kick(0.3), hb + 0.22)
        hb += 1.0

    # ---- 2. main groove (drop → end), grid anchored on the logo slam
    drop = m["drop"]
    beat = 0.5  # 120 BPM
    gen0, br0, ar0, ex0, cta0 = sc["generator"][0], sc["branching"][0], sc["arena"][0], sc["export"][0], sc["cta"][0]
    arena_break = m["arenaBreak"]
    slam = m["finalSlam"]
    n_beats = int((total - drop) / beat) + 1
    for k in range(n_beats):
        bt = drop + k * beat
        if bt >= total - 0.3:
            break
        in_break = arena_break - 0.5 <= bt < arena_break
        calm_cta = cta0 + 0.2 <= bt < slam
        after_slam = bt >= slam
        bar_pos = k % 4
        chord = PROG[(k // 8) % 4]
        if k % 8 == 0 and not after_slam:
            dur = min(8 * beat, (slam - bt) if bt < slam else 8 * beat)
            if dur > 0.3:
                cutoff = 900 if bt < gen0 else 1400 if bt < br0 else 2000
                place(bus, reverb(pad_chord(chord[1], dur, cutoff, 0.9 if not calm_cta else 0.7), 0.3), bt)
                place(bus, pan(sub808(midi(chord[0]), dur - 0.05, 1.0), 0), bt)
        if in_break or calm_cta or after_slam:
            continue
        if bt >= drop + 0.01 or k == 0:
            place(bus, pan(kick(1.0 if bt >= gen0 else 0.8)), bt)
            i = int(bt * SR)
            n = int(0.3 * SR)
            if i + n < len(duck_src):
                duck_src[i : i + n] = np.maximum(duck_src[i : i + n], np.exp(-np.arange(n) / SR * 14))
        if bt >= br0 and bar_pos in (1, 3):
            place(bus, reverb(pan(clap(0.9), 0), 0.2, small=True), bt)
        if bt >= br0:
            place(bus, pan(hat(1.0), 0.3), bt + beat / 2)
            if bt >= ar0:
                place(bus, pan(hat(0.6), -0.3), bt + beat / 4)
                place(bus, pan(hat(0.6), -0.3), bt + 3 * beat / 4)
        if bt >= gen0:
            tones = [n + 12 for n in chord[1]] + [chord[1][0] + 24]
            for s in range(4 if bt >= ar0 else 2):
                step = s * (beat / 4 if bt >= ar0 else beat / 2)
                note = tones[(k * 4 + s) % len(tones)]
                place(bus, pan(pluck(midi(note), 0.9), 0.35 if s % 2 else -0.35), bt + step)
                place(bus, pan(pluck(midi(note), 0.35), -0.35 if s % 2 else 0.35), bt + step + beat * 0.75)  # ping-pong echo

    # ---- 3. final slam chord + outro tail
    t = t_axis(total - slam)
    big = pad_chord(PROG[0][1] + [69], total - slam, 2600, 1.25)
    place(bus, reverb(big, 0.45), slam)
    place(bus, pan(sub808(midi(33), total - slam - 0.1, 1.1)), slam)

    # sidechain pump on everything sustained
    pump = 1 - 0.45 * duck_src
    bus *= pump
    # master fade at the very end
    fade = np.ones(bus.shape[1])
    fl = int(1.6 * SR)
    fade[-fl:] = np.linspace(1, 0, fl) ** 1.5
    return bus * fade


def build_sfx(cues, total):
    fps = cues["fps"]
    bus = np.zeros((2, int(total * SR)))
    for h in cues["hits"]:
        g = h.get("gain", 1.0)
        length = h.get("len", 40) / fps
        sig = SFX[h["kind"]](g, length)
        place(bus, sig if sig.ndim == 2 else pan(sig), h["f"] / fps)
    return bus


def build_voice(cues, total):
    fps = cues["fps"]
    bus = np.zeros((2, int(total * SR)))
    for v in cues["vo"]:
        sr, data = wavfile.read(os.path.join(ROOT, v["file"]))
        x = data.astype(np.float64) / 32768.0
        if x.ndim == 2:
            x = x.mean(axis=1)
        assert sr == SR, f"voice clip {v['file']} must be {SR} Hz"
        place(bus, reverb(pan(x), 0.06, small=True), v["from"] / fps)
    return bus


def speech_mask(cues, total):
    fps = cues["fps"]
    n = int(total * SR)
    mask = np.zeros(n)
    for a, b in cues["speech"]:
        mask[int(max(0, a / fps - 0.06) * SR) : int(min(total, b / fps + 0.18) * SR)] = 1
    # attack 40 ms / release 260 ms smoothing
    out = np.zeros(n)
    lvl = 0.0
    a_att, a_rel = np.exp(-1 / (0.04 * SR)), np.exp(-1 / (0.26 * SR))
    step = 64
    for i in range(0, n, step):
        tgt = mask[i]
        c = a_att if tgt > lvl else a_rel
        lvl = tgt + (lvl - tgt) * c**step
        out[i : i + step] = lvl
    return out


def limiter(x, ceiling_db=-1.0, release=0.08):
    ceil = db(ceiling_db)
    peak = maximum_filter1d(np.max(np.abs(x), axis=0), size=int(0.004 * SR))
    gain = np.minimum(1.0, ceil / np.maximum(peak, 1e-9))
    out = np.empty_like(gain)
    g = 1.0
    rel = np.exp(-1 / (release * SR))
    for i in range(0, len(gain), 32):
        tgt = gain[i : i + 32].min()
        g = tgt if tgt < g else tgt + (g - tgt) * rel**32
        out[i : i + 32] = g
    return x * out


def write(path, x):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    wavfile.write(path, SR, (np.clip(x, -1, 1).T * 32767).astype(np.int16))


def rms_db(x):
    return 20 * np.log10(np.sqrt(np.mean(x**2)) + 1e-12)


def main():
    with open(CUES, encoding="utf-8") as f:
        cues = json.load(f)
    total = cues["totalFrames"] / cues["fps"]
    print("music...")
    music = build_music(cues, total)
    print("sound design...")
    sfx = build_sfx(cues, total)
    print("voice...")
    voice = build_voice(cues, total)
    mask = speech_mask(cues, total)

    # level staging: voice on top, bed ducked ~7 dB under speech
    music *= db(-16) / max(db(rms_db(music[:, music.shape[1] // 3 :])), 1e-9) * (1 - 0.68 * mask)
    sfx *= db(-5) * (1 - 0.45 * mask)
    voice_level = rms_db(voice[:, np.abs(voice).max(axis=0) > 0.01]) if np.any(voice) else -20
    voice *= db(-16 - voice_level)
    mix = music + sfx + voice
    mix = np.tanh(mix * 1.15) / np.tanh(1.15)  # gentle glue saturation
    mix = limiter(mix, -1.0)

    master = os.path.join(WORK_DIR, "mix.wav")
    write(master, mix)
    write(os.path.join(WORK_DIR, "stem_music.wav"), limiter(music, -1.0))
    write(os.path.join(WORK_DIR, "stem_sfx.wav"), limiter(sfx, -1.0))
    write(os.path.join(WORK_DIR, "stem_voice.wav"), limiter(voice, -1.0))
    os.makedirs(OUT_DIR, exist_ok=True)
    cmd = ["npx", "remotion", "ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", master,
           "-c:a", "libmp3lame", "-b:a", "320k", os.path.join(OUT_DIR, "mix.mp3")]
    subprocess.run(cmd, check=True, cwd=ROOT, shell=(os.name == "nt"))
    print(f"mix: {total:.1f}s  rms {rms_db(mix):.1f} dBFS  peak {20*np.log10(np.abs(mix).max()):.1f} dBFS")
    print("wrote public/audio/launch/mix.mp3 (stems in scratch/launch-audio/)")


if __name__ == "__main__":
    main()
