import fs from 'node:fs';
import path from 'node:path';

const AUDIO_DIR = path.resolve('public/audio');
if (!fs.existsSync(AUDIO_DIR)) {
  fs.mkdirSync(AUDIO_DIR, { recursive: true });
}

const SAMPLE_RATE = 44100;

function createWavHeader(sampleCount, sampleRate = 44100, channels = 2) {
  const bytesPerSample = 2;
  const blockAlign = channels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = sampleCount * blockAlign;
  const buffer = Buffer.alloc(44);

  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(channels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(16, 34); // Bits per sample
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  return buffer;
}

function writeWavFile(filename, samplesLeft, samplesRight) {
  const count = samplesLeft.length;
  const header = createWavHeader(count, SAMPLE_RATE, 2);
  const data = Buffer.alloc(count * 4);

  for (let i = 0; i < count; i++) {
    const l = Math.max(-1, Math.min(1, samplesLeft[i]));
    const r = Math.max(-1, Math.min(1, samplesRight[i]));
    data.writeInt16LE(Math.floor(l * 32767), i * 4);
    data.writeInt16LE(Math.floor(r * 32767), i * 4 + 2);
  }

  fs.writeFileSync(path.join(AUDIO_DIR, filename), Buffer.concat([header, data]));
  console.log(`🎵 Generated ${filename} (${(count / SAMPLE_RATE).toFixed(1)}s)`);
}

// 1. Generate Cinematic Transition Whoosh (1.2s)
function generateWhoosh() {
  const duration = 1.2;
  const count = Math.floor(duration * SAMPLE_RATE);
  const left = new Float32Array(count);
  const right = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    const t = i / count;
    const env = Math.pow(Math.sin(t * Math.PI), 2.2);
    const noise = Math.random() * 2 - 1;
    const toneFreq = 90 + Math.pow(t, 2) * 950;
    const tone = Math.sin((2 * Math.PI * toneFreq * i) / SAMPLE_RATE) * 0.45;
    const val = (noise * 0.65 + tone) * env * 0.85;

    left[i] = val * (1 - t * 0.7);
    right[i] = val * (0.3 + t * 0.7);
  }
  writeWavFile('whoosh.wav', left, right);
}

// 2. Generate Heavy Riser Whoosh (1.8s)
function generateHeavyWhoosh() {
  const duration = 1.8;
  const count = Math.floor(duration * SAMPLE_RATE);
  const left = new Float32Array(count);
  const right = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    const t = i / count;
    const env = Math.pow(t, 1.8);
    const noise = Math.random() * 2 - 1;
    const sweep = Math.sin((2 * Math.PI * (60 + t * 1400) * i) / SAMPLE_RATE) * 0.5;
    const val = (noise * 0.5 + sweep) * env * 0.9;

    left[i] = val * Math.cos(t * Math.PI * 0.5);
    right[i] = val * Math.sin(t * Math.PI * 0.5);
  }
  writeWavFile('whoosh-heavy.wav', left, right);
}

// 3. Generate Cinematic Sub-Bass Impact (3.0s)
function generateImpact() {
  const duration = 3.0;
  const count = Math.floor(duration * SAMPLE_RATE);
  const left = new Float32Array(count);
  const right = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    const t = i / SAMPLE_RATE;
    const freq = 30 + 95 * Math.exp(-t * 5.5);
    const env = Math.exp(-t * 1.9);
    let sub = Math.sin(2 * Math.PI * freq * t) * 1.8;
    sub = Math.tanh(sub);

    const transient = Math.exp(-t * 110) * (Math.random() * 2 - 1) * 0.6;
    const sample = (sub * 0.85 + transient) * env;

    left[i] = sample;
    right[i] = sample;
  }
  writeWavFile('impact.wav', left, right);
}

// 4. Generate Mechanical UI Click (0.15s)
function generateClick() {
  const duration = 0.15;
  const count = Math.floor(duration * SAMPLE_RATE);
  const left = new Float32Array(count);
  const right = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    const t = i / SAMPLE_RATE;
    const env = Math.exp(-t * 140);
    const chirp = Math.sin(2 * Math.PI * 2200 * t) * 0.5;
    const noise = (Math.random() * 2 - 1) * 0.5;
    const sample = (chirp + noise) * env * 0.8;

    left[i] = sample;
    right[i] = sample;
  }
  writeWavFile('click.wav', left, right);
}

// 5. Generate Glitch Digital Stutter (0.6s)
function generateGlitch() {
  const duration = 0.6;
  const count = Math.floor(duration * SAMPLE_RATE);
  const left = new Float32Array(count);
  const right = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    const t = i / SAMPLE_RATE;
    const step = Math.floor(t * 30);
    const stepFreq = 400 + (step * 173) % 1800;
    const tone = Math.sin(2 * Math.PI * stepFreq * t) * 0.4;
    const noise = (Math.random() * 2 - 1) * 0.4;
    const env = Math.sin((t / duration) * Math.PI);
    const val = (tone + noise) * env * 0.7;

    left[i] = (step % 2 === 0 ? val : val * 0.2);
    right[i] = (step % 2 === 1 ? val : val * 0.2);
  }
  writeWavFile('glitch.wav', left, right);
}

// 6. Generate Emerald Verification Chime (3.0s)
function generateChime() {
  const duration = 3.0;
  const count = Math.floor(duration * SAMPLE_RATE);
  const left = new Float32Array(count);
  const right = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    const t = i / SAMPLE_RATE;
    const env = Math.exp(-t * 1.8);
    // Harmonic bell frequencies (528Hz Solfeggio + 1056Hz + 1584Hz + 2112Hz)
    const f1 = Math.sin(2 * Math.PI * 528 * t);
    const f2 = Math.sin(2 * Math.PI * 1056 * t) * 0.55;
    const f3 = Math.sin(2 * Math.PI * 1584 * t) * 0.3;
    const f4 = Math.sin(2 * Math.PI * 2112 * t) * 0.15;
    const sample = (f1 + f2 + f3 + f4) * 0.65 * env;

    left[i] = sample * (1 + 0.15 * Math.sin(t * 7));
    right[i] = sample * (1 - 0.15 * Math.sin(t * 7));
  }
  writeWavFile('chime.wav', left, right);
}

// 7. Full 60-Second Driving Masterpiece Soundtrack
function generateSoundtrack() {
  const duration = 61.0; // 61 seconds (covers full 60s video with smooth finish)
  const count = Math.floor(duration * SAMPLE_RATE);
  const left = new Float32Array(count);
  const right = new Float32Array(count);

  const bpm = 126;
  const beatDuration = 60 / bpm; // ~0.476s

  // Harmonic bass progression: E minor -> G major -> A minor -> B minor
  const bassNotes = [41.2, 41.2, 49.0, 49.0, 55.0, 55.0, 61.7, 41.2];
  const arpeggioNotes = [329.6, 392.0, 440.0, 493.8, 587.3, 659.2, 784.0, 880.0, 987.7];

  for (let i = 0; i < count; i++) {
    const t = i / SAMPLE_RATE;
    const beatIndex = Math.floor(t / beatDuration);
    const beatPhase = (t % beatDuration) / beatDuration;

    // Narrative Intensity Curve over 60 seconds
    let intensity = 0.35;
    if (t < 5) {
      intensity = 0.25 + (t / 5) * 0.2; // 0-5s: mysterious opening tension
    } else if (t < 14) {
      intensity = 0.45 + ((t - 5) / 9) * 0.25; // 5-14s: problem-to-solution riser
    } else if (t < 22) {
      intensity = 0.75; // 14-22s: landing page groove kicks in
    } else if (t < 35) {
      intensity = 0.88; // 22-35s: telemetry & wizard deep dive
    } else if (t < 48) {
      intensity = 0.95; // 35-48s: visual DAG & arena peak energy
    } else if (t < 54) {
      intensity = 1.0; // 48-54s: monolithic climax & shockwave
    } else {
      intensity = Math.max(0, (61 - t) / 7.0); // 54-60s: graceful resolution
    }

    // 1. Driving Sub-Bass Rhythm (E minor pulse)
    const noteFreq = bassNotes[beatIndex % bassNotes.length];
    const bassEnv = Math.pow(1 - beatPhase, 1.6);
    let bass = Math.sin(2 * Math.PI * noteFreq * t) + 0.35 * Math.sin(4 * Math.PI * noteFreq * t);
    bass = Math.tanh(bass * 1.7) * bassEnv * 0.45 * intensity;

    // 2. High-Tech Arpeggio Synth (16th notes with stereo ping-pong)
    const arpPhase = (t % (beatDuration / 4)) / (beatDuration / 4);
    const arpStep = Math.floor(t / (beatDuration / 4)) % arpeggioNotes.length;
    const arpFreq = arpeggioNotes[arpStep];
    const arpEnv = Math.exp(-arpPhase * 7.5);
    const arpTone = Math.sin(2 * Math.PI * arpFreq * t) * arpEnv * 0.16 * (intensity > 0.35 ? intensity : 0.2);

    // 3. Deep Cinematic Pad Drone (Warm Emerald/Copper Atmosphere)
    const pad1 = Math.sin(2 * Math.PI * 164.81 * t) * 0.14; // E3
    const pad2 = Math.sin(2 * Math.PI * 246.94 * t) * 0.10; // B3
    const pad3 = Math.sin(2 * Math.PI * 329.63 * t) * 0.08; // E4
    const pad = (pad1 + pad2 + pad3) * (0.6 + 0.4 * Math.sin(t * 0.6)) * (0.5 + intensity * 0.5);

    // 4. Rhythmic Cyber Kick (Four-on-the-Floor active from 14s onward)
    let kick = 0;
    if (t >= 14 && t < 54) {
      const kickFreq = 45 + 110 * Math.exp(-beatPhase * 18);
      const kickEnv = Math.exp(-beatPhase * 12);
      kick = Math.sin(2 * Math.PI * kickFreq * beatPhase * beatDuration) * kickEnv * 0.55 * intensity;
    }

    // 5. Hi-Hat Shimmer & Snare Claps
    let percussion = 0;
    if (t >= 14 && t < 54) {
      // 16th-note hat shimmer
      const hatPhase = (t % (beatDuration / 2)) / (beatDuration / 2);
      const hatEnv = Math.exp(-hatPhase * 28);
      const hat = (Math.random() * 2 - 1) * hatEnv * 0.07 * intensity;

      // Snare on beats 2 & 4
      const isSnareBeat = (beatIndex % 2 === 1);
      let snare = 0;
      if (isSnareBeat && beatPhase < 0.3) {
        const snareEnv = Math.exp(-beatPhase * 16);
        snare = (Math.random() * 2 - 1) * snareEnv * 0.18 * intensity;
      }
      percussion = hat + snare;
    }

    // Mix stereo
    const monoBase = bass + pad * 0.35 + kick;
    left[i] = monoBase + arpTone * 0.9 + percussion * 0.85;
    right[i] = monoBase + arpTone * 0.75 + percussion * 1.15;
  }

  writeWavFile('soundtrack.wav', left, right);
}

console.log('🔊 Synthesizing 60-Second Master Cinematic Audio Suite for Bedrock...');
generateWhoosh();
generateHeavyWhoosh();
generateImpact();
generateClick();
generateGlitch();
generateChime();
generateSoundtrack();
console.log('✅ Full 60-second audio suite synthesized to public/audio/');
