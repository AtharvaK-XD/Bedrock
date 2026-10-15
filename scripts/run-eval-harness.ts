/**
 * Bedrock Evaluation Harness CLI Runner
 * Run 15-20 test benchmarks per profile against all models, score automatically,
 * and drop unreliable models.
 *
 * Usage:
 *   npx tsx scripts/run-eval-harness.ts
 *   npx tsx scripts/run-eval-harness.ts --profile=coding_agent
 *   npx tsx scripts/run-eval-harness.ts --live
 *   npx tsx scripts/run-eval-harness.ts --markdown=report.md
 */

import {
  runEvalSuite,
  exportEvalReportAsMarkdown,
  exportEvalReportAsJson,
  EVAL_TEST_CASES,
} from '../src/lib/evalHarness';
import { UseCaseProfileId, getAllProfiles } from '../src/lib/useCaseProfiles';
import * as fs from 'fs';
import * as path from 'path';

// Parse command line arguments
const args = process.argv.slice(2);
const profileArg = args.find((a) => a.startsWith('--profile='))?.split('=')[1];
const modelsArg = args.find((a) => a.startsWith('--models='))?.split('=')[1];
const isLive = args.includes('--live');
const autoDrop = args.includes('--drop-unreliable') || true;
const markdownOut = args.find((a) => a.startsWith('--markdown='))?.split('=')[1];
const jsonOut = args.find((a) => a.startsWith('--json='))?.split('=')[1];

const targetProfiles: UseCaseProfileId[] = profileArg
  ? ([profileArg] as UseCaseProfileId[])
  : (['coding_agent', 'image_generation', 'writing', 'freelance_brief', 'hackathon_pitch', 'no_code', 'video_generation'] as UseCaseProfileId[]);

const targetModels = modelsArg
  ? modelsArg.split(',')
  : [
      'gemini-3.8-flash',
      'llama-3.3-70b-versatile',
      'deepseek-r1-distill-llama-70b',
      'gpt-4o-mini',
      'hf/zephyr-7b-beta',
    ];

async function main() {
  console.log('\n' + '='.repeat(70));
  console.log('       BEDROCK AUTOMATED EVALUATION HARNESS BENCHMARK RUNNER');
  console.log('='.repeat(70));
  console.log(`Execution Mode:  ${isLive ? 'LIVE LLM INFERENCE APIS' : 'DETERMINISTIC BENCHMARK SIMULATOR'}`);
  console.log(`Profiles:        ${targetProfiles.join(', ')}`);
  console.log(`Models Tested:   ${targetModels.join(', ')}`);
  console.log(`Total Test Bank: ${EVAL_TEST_CASES.length} available test ideas`);
  console.log('='.repeat(70) + '\n');

  const startTime = Date.now();
  let lastReportedPercent = -1;

  const suiteResult = await runEvalSuite({
    profiles: targetProfiles,
    models: targetModels,
    useSimulator: !isLive,
    autoDropUnreliable: autoDrop,
    onProgress: (progress) => {
      const percent = Math.floor((progress.completed / progress.total) * 100);
      if (percent !== lastReportedPercent && percent % 10 === 0) {
        lastReportedPercent = percent;
        process.stdout.write(
          `[PROGRESS] ${percent.toString().padStart(3)}% | Test ${progress.completed}/${progress.total} | ${progress.currentModel.padEnd(28)} | ${progress.currentTest.slice(0, 30)}...\n`
        );
      }
    },
  });

  const durationSec = ((Date.now() - startTime) / 1000).toFixed(2);

  console.log('\n' + '='.repeat(70));
  console.log('                    BENCHMARK RESULTS SUMMARY');
  console.log('='.repeat(70));
  console.log(`Duration:                 ${durationSec}s`);
  console.log(`Total Tests Executed:     ${suiteResult.totalTests}`);
  console.log(`Tests Passed:             ${suiteResult.passedCount} / ${suiteResult.totalTests} (${suiteResult.overallPassRate}%)`);
  console.log(`Average Composite Score:  ${suiteResult.avgCompositeScore} / 100`);
  console.log(`Average Format Score:     ${suiteResult.avgFormatScore} / 100`);
  console.log(`Average Topic Score:      ${suiteResult.avgTopicScore} / 100`);
  console.log(`Average Forbidden Score:  ${suiteResult.avgForbiddenScore} / 100`);
  console.log('='.repeat(70) + '\n');

  console.log('MODEL RELIABILITY MATRIX & DROPPED STATUS:');
  console.log('-'.repeat(70));
  console.log(
    `${'Model'.padEnd(30)} ${'Profile'.padEnd(18)} ${'Pass%'.padEnd(8)} ${'Score'.padEnd(8)} Status`
  );
  console.log('-'.repeat(70));

  for (const record of suiteResult.reliabilityMatrix) {
    const statusLabel =
      record.status === 'RELIABLE'
        ? '\x1b[32mRELIABLE\x1b[0m'
        : record.status === 'DEGRADED'
        ? '\x1b[33mDEGRADED\x1b[0m'
        : '\x1b[31mDROPPED (UNRELIABLE)\x1b[0m';

    console.log(
      `${record.modelId.padEnd(30)} ${record.profileId.padEnd(18)} ${(record.passRate + '%').padEnd(8)} ${(record.avgCompositeScore + '/100').padEnd(8)} ${statusLabel}`
    );
  }
  console.log('-'.repeat(70));

  if (suiteResult.droppedModels.length > 0) {
    console.log('\n\x1b[31mDROPPED MODELS FOR SPECIFIC PROFILES:\x1b[0m');
    for (const d of suiteResult.droppedModels) {
      console.log(`  ❌ Model [${d.modelId}] for [${d.profileId}]: ${d.reason}`);
    }
  } else {
    console.log('\n\x1b[32mAll tested models met production reliability thresholds!\x1b[0m');
  }

  // Export reports if requested
  if (markdownOut) {
    const md = exportEvalReportAsMarkdown(suiteResult);
    fs.writeFileSync(path.resolve(process.cwd(), markdownOut), md, 'utf-8');
    console.log(`\nMarkdown report exported to: ${markdownOut}`);
  }

  if (jsonOut) {
    const json = exportEvalReportAsJson(suiteResult);
    fs.writeFileSync(path.resolve(process.cwd(), jsonOut), json, 'utf-8');
    console.log(`\nJSON report exported to: ${jsonOut}`);
  }

  console.log('\n[EVAL COMPLETE] Benchmarking finished successfully.\n');
}

main().catch((err) => {
  console.error('Eval harness failed:', err);
  process.exit(1);
});
