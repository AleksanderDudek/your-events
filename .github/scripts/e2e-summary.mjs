// Turns Playwright's JSON report (results.json) into:
//   1. a GitHub Actions job summary ($GITHUB_STEP_SUMMARY), and
//   2. e2e-comment.md — the body for a sticky PR comment.
// It always exits 0: these e2e runs are informational and must never fail the
// job or block a merge.
import { readFileSync, writeFileSync, appendFileSync, existsSync } from 'node:fs';

const RESULTS = 'results.json';
const COMMENT_FILE = 'e2e-comment.md';
const MARKER = '<!-- e2e-insights -->';

function emit(md) {
  writeFileSync(COMMENT_FILE, `${MARKER}\n${md}\n`);
  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (summaryPath) {
    try {
      appendFileSync(summaryPath, `${md}\n`);
    } catch {
      /* summary is best-effort */
    }
  }
  console.log(md);
}

function collect(suites, into, project) {
  for (const suite of suites ?? []) {
    for (const spec of suite.specs ?? []) {
      for (const t of spec.tests ?? []) {
        const name = `${spec.title}${t.projectName ? ` — ${t.projectName}` : ''}`;
        if (t.status === 'unexpected') into.failed.push(name);
        else if (t.status === 'flaky') into.flaky.push(name);
      }
    }
    collect(suite.suites, into, project);
  }
}

function main() {
  if (!existsSync(RESULTS)) {
    emit(
      '### 🎭 E2E insights (non-blocking)\n\n' +
        'No `results.json` was produced — the Playwright run never started ' +
        '(likely a dev-server or install failure). See the job logs.'
    );
    return;
  }

  let report;
  try {
    report = JSON.parse(readFileSync(RESULTS, 'utf8'));
  } catch (err) {
    emit(`### 🎭 E2E insights (non-blocking)\n\nCould not parse \`results.json\`: ${err.message}`);
    return;
  }

  const stats = report.stats ?? {};
  const passed = stats.expected ?? 0;
  const failed = stats.unexpected ?? 0;
  const flaky = stats.flaky ?? 0;
  const skipped = stats.skipped ?? 0;
  const durationS = Math.round((stats.duration ?? 0) / 1000);

  const buckets = { failed: [], flaky: [] };
  collect(report.suites, buckets);

  const icon = failed > 0 ? '❌' : flaky > 0 ? '⚠️' : '✅';
  const lines = [
    `### ${icon} E2E insights (non-blocking)`,
    '',
    `**${passed} passed · ${failed} failed · ${flaky} flaky · ${skipped} skipped** — ${durationS}s`,
    '',
    '> Real app + live Supabase, Chromium + Mobile Chrome. Informational only — never blocks a merge.',
  ];

  if (buckets.failed.length) {
    lines.push('', '#### Failed');
    for (const name of buckets.failed.slice(0, 40)) lines.push(`- ❌ ${name}`);
  }
  if (buckets.flaky.length) {
    lines.push('', '#### Flaky (passed on retry)');
    for (const name of buckets.flaky.slice(0, 40)) lines.push(`- ⚠️ ${name}`);
  }
  lines.push('', '_Full HTML report is attached as the **playwright-report** artifact._');

  emit(lines.join('\n'));
}

main();
