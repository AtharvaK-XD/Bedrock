import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const OUTPUT_DIR = path.resolve('public/screenshots');

async function run() {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  console.log('🚀 Launching Playwright browser for Bedrock screen captures...');
  let browser;
  try {
    browser = await chromium.launch({ channel: 'msedge', headless: true });
  } catch (e) {
    try {
      browser = await chromium.launch({ channel: 'chrome', headless: true });
    } catch (e2) {
      browser = await chromium.launch({ headless: true });
    }
  }

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 2, // 4K high-DPI clarity
  });

  const page = await context.newPage();

  // Route interception to inject rich telemetry data
  await page.route('**/api/traces', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        totalInferences: 1428,
        totalTokens: 842190,
        avgLatency: 110,
        p99Latency: 230,
        reliability: 99.94,
        activeModelsCount: 6,
        activeModels: ['gemini-2.5-pro', 'groq-llama-3.3-70b', 'claude-3-7-sonnet', 'gpt-4o', 'deepseek-r1'],
        traces: [
          { id: 'tr-1', time: '10:14:02', node: 'SYS_ORCHESTRATOR', model: 'gemini-2.5-pro', tokens: 2048, latency: 114, status: 'OK' },
          { id: 'tr-2', time: '10:13:58', node: 'PROMPT_EVAL_DAG', model: 'groq-llama-3.3-70b', tokens: 840, latency: 88, status: 'OK' },
          { id: 'tr-3', time: '10:13:40', node: 'ARENA_BENCHMARK', model: 'claude-3-7-sonnet', tokens: 3120, latency: 340, status: 'OK' },
          { id: 'tr-4', time: '10:13:12', node: 'DEFENSE_FIREWALL', model: 'bedrock-sentinel-v1', tokens: 512, latency: 42, status: 'OK' },
        ],
      }),
    });
  });

  // Seed localStorage before navigation
  await page.addInitScript(() => {
    localStorage.setItem(
      'bedrock_auth_session',
      JSON.stringify({
        isLoggedIn: true,
        email: 'founder@bedrockxai.com',
        name: 'Principal Motion Architect',
        loginTime: new Date().toISOString(),
      })
    );

    localStorage.setItem(
      'bedrock_api_keys',
      JSON.stringify({
        geminiKey: 'mock-gemini-key',
        groqKey: 'mock-groq-key',
        openAiKey: 'mock-openai-key',
        anthropicKey: 'mock-anthropic-key',
      })
    );

    // Seed a rich DAG workflow
    const sampleWorkflow = [
      {
        id: 'wf_core',
        title: 'Enterprise Distributed AI Gateway DAG',
        updatedAt: new Date().toISOString(),
        nodes: [
          {
            id: 'node-sys',
            type: 'systemNode',
            position: { x: 100, y: 180 },
            data: {
              title: 'Principal Systems Architect',
              description: 'Enforce OWASP security, ACID isolation, strict TypeScript 5.8 schemas, and zero unhandled rejections.',
              nodeType: 'system',
              agentId: 'claude',
              modelId: 'claude-3-7-sonnet',
              status: 'success',
            },
          },
          {
            id: 'node-prompt',
            type: 'promptNode',
            position: { x: 500, y: 150 },
            data: {
              title: 'Dynamic Prompt Synthesis Engine',
              description: 'Synthesize high-concurrency payment routing prompt with automatic fallback logic and idempotency keys.',
              nodeType: 'prompt',
              agentId: 'gemini',
              modelId: 'gemini-2.5-pro',
              status: 'running',
            },
          },
          {
            id: 'node-route',
            type: 'conditionNode',
            position: { x: 920, y: 120 },
            data: {
              title: 'Latency Gate (<150ms)',
              conditionRule: 'contains',
              conditionValue: 'p99',
              conditionResult: true,
              nodeType: 'condition',
              status: 'success',
            },
          },
          {
            id: 'node-code',
            type: 'codeNode',
            position: { x: 920, y: 320 },
            data: {
              title: 'WAF Prompt Injection Sanitizer',
              codeScript: 'return sanitizePrompt(input);',
              nodeType: 'code',
              status: 'success',
            },
          },
          {
            id: 'node-out',
            type: 'outputNode',
            position: { x: 1300, y: 200 },
            data: {
              title: 'Production Verified Blueprint',
              output: '✓ 100% Type-Safe\n✓ Injection Defense Active\n✓ P99 Latency: 94ms',
              nodeType: 'output',
              status: 'success',
            },
          },
        ],
        edges: [
          { id: 'e1', source: 'node-sys', target: 'node-prompt', animated: true, style: { stroke: '#3b82f6', strokeWidth: 3 } },
          { id: 'e2', source: 'node-prompt', target: 'node-route', animated: true, style: { stroke: '#c8a86b', strokeWidth: 3 } },
          { id: 'e3', source: 'node-prompt', target: 'node-code', animated: true, style: { stroke: '#10b981', strokeWidth: 3 } },
          { id: 'e4', source: 'node-route', target: 'node-out', animated: true, style: { stroke: '#06b6d4', strokeWidth: 3 } },
          { id: 'e5', source: 'node-code', target: 'node-out', animated: true, style: { stroke: '#10b981', strokeWidth: 3 } },
        ],
      },
    ];
    localStorage.setItem('bedrock_saved_workflows', JSON.stringify(sampleWorkflow));
  });

  // 1. Landing Page Hero
  console.log('📸 1. Capturing Landing Page Top Hero...');
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(OUTPUT_DIR, '01_landing_hero.png') });

  // 1b. Landing Scrolled Showcase
  console.log('📸 1b. Capturing Landing Page Scrolled Showcase...');
  await page.evaluate(() => window.scrollTo(0, 950));
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(OUTPUT_DIR, '01b_landing_showcase.png') });

  // 1c. Landing Features Grid
  console.log('📸 1c. Capturing Landing Features Grid...');
  await page.evaluate(() => window.scrollTo(0, 2200));
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(OUTPUT_DIR, '01c_landing_features.png') });

  // 2. Telemetry Dashboard
  console.log('📸 2. Capturing Telemetry Dashboard HUD...');
  await page.goto('http://localhost:5173/#/app/dashboard', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: path.join(OUTPUT_DIR, '02_dashboard_hud.png') });

  // 3. Prompt Generator (Wizard)
  console.log('📸 3. Capturing Prompt Synthesis Engine Wizard...');
  await page.goto('http://localhost:5173/#/app/generator', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  try {
    const input = await page.$('textarea, input[type="text"]');
    if (input) {
      await input.fill('Distributed Redis cluster orchestrator with automatic shard failover and zero-data-loss replication');
    }
  } catch (e) {}
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(OUTPUT_DIR, '03_generator_wizard.png') });

  // 4. Visual Branching Canvas
  console.log('📸 4. Capturing Visual Branching Canvas DAG...');
  await page.goto('http://localhost:5173/#/app/branching', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  // Click on first workflow or create new if on dashboard
  try {
    const wfCard = await page.$('button:has-text("Enterprise Distributed"), div:has-text("Enterprise Distributed")');
    if (wfCard) {
      await wfCard.click();
    } else {
      const newBtn = await page.$('button:has-text("New Pipeline"), button:has-text("Create")');
      if (newBtn) await newBtn.click();
    }
  } catch (e) {}
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(OUTPUT_DIR, '04_branching_canvas.png') });

  // 5. Multi-Model The Arena
  console.log('📸 5. Capturing Multi-Model Arena...');
  await page.goto('http://localhost:5173/#/app/tester', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  try {
    const textarea = await page.$('textarea');
    if (textarea) {
      await textarea.fill('Optimize this PostgreSQL query for 10M rows: SELECT * FROM telemetry_events WHERE status = "FAILED" ORDER BY created_at DESC LIMIT 50;');
    }
  } catch (e) {}
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(OUTPUT_DIR, '05_arena_benchmark.png') });

  // 6. Prompt Library
  console.log('📸 6. Capturing Prompt Library with 3D Cards...');
  await page.goto('http://localhost:5173/#/app/library', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(OUTPUT_DIR, '06_prompt_library.png') });

  // 7. Prompt History Archive
  console.log('📸 7. Capturing Dedicated History Archive...');
  await page.goto('http://localhost:5173/#/app/history', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(OUTPUT_DIR, '07_history_archive.png') });

  await browser.close();
  console.log('🎉 ALL authentic Bedrock workstation screenshots successfully captured!');
}

run().catch((err) => {
  console.error('❌ Capture error:', err);
  process.exit(1);
});
