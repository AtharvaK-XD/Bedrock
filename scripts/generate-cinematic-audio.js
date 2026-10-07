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
    // Envelope: rise and rapid cut
    const env = Math.pow(Math.sin(t * Math.PI), 2.5);
    // Noise with pitch frequency modulation
    const noise = Math.random() * 2 - 1;
    const toneFreq = 120 + Math.pow(t, 2) * 800;
    const tone = Math.sin((2 * Math.PI * toneFreq * i) / SAMPLE_RATE) * 0.4;
    const val = (noise * 0.6 + tone) * env * 0.8;

    // Stereo pan left to right
    left[i] = val * (1 - t * 0.6);
    right[i] = val * (0.4 + t * 0.6);
  }
  writeWavFile('whoosh.wav', left, right);
}

// 2. Generate Cinematic Sub-Bass Impact (2.5s)
function generateImpact() {
  const duration = 2.5;
  const count = Math.floor(duration * SAMPLE_RATE);
  const left = new Float32Array(count);
  const right = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    const t = i / SAMPLE_RATE;
    const progress = i / count;
    // Pitch drops from 120Hz down to 32Hz
    const freq = 32 + 88 * Math.exp(-t * 6);
    const env = Math.exp(-t * 2.2);
    // Heavy sub sine wave with warm saturation
    let sub = Math.sin(2 * Math.PI * freq * t) * 1.5;
    // Soft clip saturation
    sub = Math.tanh(sub);

    // Initial click/transient
    const transient = Math.exp(-t * 80) * (Math.random() * 2 - 1) * 0.5;
    const sample = (sub * 0.8 + transient) * env;

    left[i] = sample;
    right[i] = sample;
  }
  writeWavFile('impact.wav', left, right);
}

// 3. Generate Mechanical UI Click (0.15s)
function generateClick() {
  const duration = 0.15;
  const count = Math.floor(duration * SAMPLE_RATE);
  const left = new Float32Array(count);
  const right = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    const t = i / SAMPLE_RATE;
    const env = Math.exp(-t * 120);
    const chirp = Math.sin(2 * Math.PI * 1800 * t) * 0.5;
    const noise = (Math.random() * 2 - 1) * 0.5;
    const sample = (chirp + noise) * env * 0.7;

    left[i] = sample;
    right[i] = sample;
  }
  writeWavFile('click.wav', left, right);
}

// 4. Generate Emerald Verification Chime (2.0s)
function generateChime() {
  const duration = 2.0;
  const count = Math.floor(duration * SAMPLE_RATE);
  const left = new Float32Array(count);
  const right = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    const t = i / SAMPLE_RATE;
    const env = Math.exp(-t * 2.5);
    // Harmonic bell frequencies (528Hz Solfeggio + 1056Hz + 1584Hz)
    const f1 = Math.sin(2 * Math.PI * 528 * t);
    const f2 = Math.sin(2 * Math.PI * 1056 * t) * 0.5;
    const f3 = Math.sin(2 * Math.PI * 1584 * t) * 0.25;
    const sample = (f1 + f2 + f3) * 0.6 * env;

    left[i] = sample * (1 + 0.1 * Math.sin(t * 8));
    right[i] = sample * (1 - 0.1 * Math.sin(t * 8));
  }
  writeWavFile('chime.wav', left, right);
}

// 5. Generate 30-Second Full Driving Cinematic Soundtrack
function generateSoundtrack() {
  const duration = 32.0; // 32 seconds
  const count = Math.floor(duration * SAMPLE_RATE);
  const left = new Float32Array(count);
  const right = new Float32Array(count);

  const bpm = 124;
  const beatDuration = 60 / bpm; // ~0.483s
  const totalBeats = Math.floor(duration / beatDuration);

  // Bassline notes (Root: E1, G1, A1, B1 in Hz)
  const bassNotes = [41.2, 41.2, 49.0, 55.0, 61.7, 55.0, 49.0, 41.2];

  for (let i = 0; i < count; i++) {
    const t = i / SAMPLE_RATE;
    const beatIndex = Math.floor(t / beatDuration);
    const beatPhase = (t % beatDuration) / beatDuration;

    // Intensity envelope building over 30s
    let intensity = 0.3;
    if (t > 4) intensity = 0.6;
    if (t > 12) intensity = 0.85;
    if (t > 22) intensity = 1.0;
    if (t > 29) intensity = Math.max(0, (32 - t) / 3);

    // 1. Driving Sub-Bass Rhythm
    const noteFreq = bassNotes[beatIndex % bassNotes.length];
    const bassEnv = Math.pow(1 - beatPhase, 1.8);
    let bass = Math.sin(2 * Math.PI * noteFreq * t) + 0.4 * Math.sin(4 * Math.PI * noteFreq * t);
    bass = Math.tanh(bass * 1.6) * bassEnv * 0.45 * intensity;

    // 2. High-Tech Arpeggio Synth (16th notes)
    const arpPhase = (t % (beatDuration / 4)) / (beatDuration / 4);
    const arpStep = Math.floor(t / (beatDuration / 4)) % 16;
    const arpScale = [329.6, 392.0, 440.0, 493.8, 587.3, 659.2, 784.0, 880.0];
    const arpeggioFreq = arpScale[arpStep % arpScale.length];
    const arpEnv = Math.exp(-arpPhase * 8);
    const arpTone = Math.sin(2 * Math.PI * arpeggioFreq * t) * arpEnv * 0.18 * (intensity > 0.4 ? intensity : 0);

    // 3. Ambient Pad Drone (Copper Warmth)
    const pad1 = Math.sin(2 * Math.PI * 164.8 * t) * 0.15;
    const pad2 = Math.sin(2 * Math.PI * 220.0 * t) * 0.12;
    const pad = (pad1 + pad2) * (0.5 + 0.5 * Math.sin(t * 0.8));

    // 4. Rhythmic Hi-Hat Shimmer
    let hihat = 0;
    if (t > 8) {
      const hatPhase = (t % (beatDuration / 2)) / (beatDuration / 2);
      const hatEnv = Math.exp(-hatPhase * 25);
      hihat = (Math.random() * 2 - 1) * hatEnv * 0.08 * intensity;
    }

    // Mix stereo
    const mono = bass + pad * 0.3;
    left[i] = mono + arpTone * 0.85 + hihat * 0.9;
    right[i] = mono + arpTone * 0.7 + hihat * 1.1;
  }

  writeWavFile('soundtrack.wav', left, right);
}

console.log('🔊 Synthesizing custom cinematic audio suite for Bedrock...');
generateWhoosh();
generateImpact();
generateClick();
generateChime();
generateSoundtrack();
console.log('✅ All audio assets synthesized to public/audio/');
