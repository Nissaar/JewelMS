// Prints a Markdown summary of playwright-report/results.json to stdout.
// Used for the GitHub job summary and the pull request comment.
import fs from 'fs';

const RESULTS = 'playwright-report/results.json';

if (!fs.existsSync(RESULTS)) {
  console.log('### ⚠️ E2E tests did not produce results\n\nCheck the workflow logs: the build or server start probably failed.');
  process.exit(0);
}

const report = JSON.parse(fs.readFileSync(RESULTS, 'utf8'));
const rows = [];

function walk(suite, file) {
  const f = suite.file || file;
  for (const spec of suite.specs || []) {
    const results = spec.tests.flatMap(t => t.results);
    const last = results[results.length - 1];
    const status = spec.tests.every(t => t.status === 'skipped') ? 'skipped'
      : spec.ok ? (results.length > 1 ? 'flaky' : 'passed') : 'failed';
    const duration = results.reduce((sum, r) => sum + (r.duration || 0), 0);
    const error = status === 'failed' ? (last?.error?.message || '').split('\n')[0].replace(/\u001b\[[0-9;]*m/g, '') : '';
    rows.push({ file: f, title: spec.title, status, duration, error });
  }
  for (const child of suite.suites || []) walk(child, f);
}
for (const suite of report.suites || []) walk(suite, suite.file);

const count = s => rows.filter(r => r.status === s).length;
const failed = count('failed');
const icon = { passed: '✅', failed: '❌', flaky: '⚠️', skipped: '⏭️' };
const seconds = ms => (ms / 1000).toFixed(1) + 's';

const lines = [
  `### ${failed ? '❌' : '✅'} E2E tests: ${count('passed')} passed, ${failed} failed` +
    (count('flaky') ? `, ${count('flaky')} flaky` : '') +
    (count('skipped') ? `, ${count('skipped')} skipped` : ''),
  '',
  `Total time: ${seconds(report.stats?.duration || 0)}`,
  '',
  '| | Test | File | Time |',
  '|---|---|---|---|',
  ...rows.map(r => `| ${icon[r.status]} | ${r.title.replace(/\|/g, '\\|')} | \`${r.file}\` | ${seconds(r.duration)} |`),
];

const failures = rows.filter(r => r.status === 'failed' && r.error);
if (failures.length) {
  lines.push('', '<details><summary>Failure details</summary>', '');
  for (const r of failures) lines.push(`- **${r.title}**: ${r.error.replace(/\|/g, '\\|').slice(0, 300)}`);
  lines.push('', '</details>');
}

console.log(lines.join('\n'));
