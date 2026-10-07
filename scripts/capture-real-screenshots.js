import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const OUTPUT_DIR = path.resolve('public/screenshots');

async function capture() {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  console.log('🚀 Launching system browser for high-DPI Bedrock screen captures...');
  let browser;
  try {
    browser = await chromium.launch({ channel: 'msedge', headless: true });
  } catch (e) {
    try {
      browser = await chromium.launch({ channel: 'chrome', headless: true });
    } catch (e2) {
      console.log('Trying default chromium...');
      browser = await chromium.launch({ headless: true });
    }
  }
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 2, // 2x Retina scaling for ultra-crisp 4K textures
  });

  const page = await context.newPage();

  // 1. Landing Page Hero
  console.log('📸 Capturing Landing Page...');
  await page.goto('http://localhost:4173/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(OUTPUT_DIR, '01_landing_hero.png') });

  // 2. Telemetry Dashboard
  console.log('📸 Capturing Telemetry Dashboard...');
  await page.goto('http://localhost:4173/#/app', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: path.join(OUTPUT_DIR, '02_dashboard_hud.png') });

  // 3. Prompt Generator (Wizard)
  console.log('📸 Capturing Prompt Generator Wizard...');
  await page.goto('http://localhost:4173/#/app/generator', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  // Type in the rich input to show active workstation state
  try {
    const textarea = await page.$('textarea, input[type="text"]');
    if (textarea) {
      await textarea.fill('High-concurrency distributed payment orchestrator with cryptographic audit trails and zero-knowledge proofs');
    }
  } catch (e) {}
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(OUTPUT_DIR, '03_generator_wizard.png') });

  // 4. Visual Branching Canvas
  console.log('📸 Capturing Visual Branching Canvas...');
  await page.goto('http://localhost:4173/#/app/branching', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: path.join(OUTPUT_DIR, '04_branching_canvas.png') });

  // 5. Multi-Model The Arena
  console.log('📸 Capturing Multi-Model Arena...');
  await page.goto('http://localhost:4173/#/app/tester', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(OUTPUT_DIR, '05_arena_benchmark.png') });

  // 6. Prompt Library
  console.log('📸 Capturing Prompt Library...');
  await page.goto('http://localhost:4173/#/app/library', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(OUTPUT_DIR, '06_prompt_library.png') });

  // 7. Prompt History Archive
  console.log('📸 Capturing Dedicated History Archive...');
  await page.goto('http://localhost:4173/#/app/history', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(OUTPUT_DIR, '07_history_archive.png') });

  await browser.close();
  console.log('✅ All real Bedrock workstation screens captured to public/screenshots/');
}

capture().catch((err) => {
  console.error('❌ Capture error:', err);
  process.exit(1);
});
