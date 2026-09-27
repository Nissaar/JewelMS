// Prints a Markdown summary of playwright-report/results.json to stdout, grouped
// by kind of test (Playwright project: Unit, Database, API, E2E). Used for the
// GitHub job summary and the pull request comment.
import fs from 'fs';

const RESULTS = 'playwright-report/results.json';
const ORDER = ['Unit', 'Database', 'API', 'E2E'];

if (!fs.existsSync(RESULTS)) {
  console.log('### ⚠️ Tests did not produce results\n\nCheck the workflow logs: the build or server start probably failed.');
  process.exit(0);
}

const report = JSON.parse(fs.readFileSync(RESULTS, 'utf8'));
const rows = [];

function walk(suite, file, path) {
  const f = suite.file || file;
  // The file-level suite is named after the file; describe blocks add to the path.
  const here = suite.title && suite.title !== f && !suite.title.endsWith('.ts') ? [...path, suite.title] : path;
  for (const spec of suite.specs || []) {
    for (const t of spec.tests) {
      const results = t.results || [];
      const last = results[results.length - 1];
      const status = t.status === 'skipped' ? 'skipped'
        : t.status === 'flaky' ? 'flaky'
        : t.status === 'expected' ? 'passed' : 'failed';
      const error = status === 'failed' ? (last?.error?.message || '').split('\n')[0].replace(/\u001b\[[0-9;]*m/g, '') : '';
      rows.push({
        project: t.projectName || 'Tests',
        title: [...here, spec.title].join(' › '),
        file: f,
        status,
        duration: results.reduce((sum, r) => sum + (r.duration || 0), 0),
        error,
      });
    }
  }
  for (const child of suite.suites || []) walk(child, f, here);
}
for (const suite of report.suites || []) walk(suite, suite.file, []);

const icon = { passed: '✅', failed: '❌', flaky: '⚠️', skipped: '⏭️' };
const seconds = ms => (ms / 1000).toFixed(1) + 's';
const count = (list, s) => list.filter(r => r.status === s).length;
// Test titles and error messages go into Markdown tables in the PR comment:
// escape backslashes, HTML and the table separator.
const esc = s => s.replace(/\\/g, '\\\\').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\|/g, '\\|');

const projects = [...new Set(rows.map(r => r.project))].sort((a, b) => (ORDER.indexOf(a) + 1 || 99) - (ORDER.indexOf(b) + 1 || 99));
const failed = count(rows, 'failed');
const lines = [
  `### ${failed ? '❌' : '✅'} Tests: ${count(rows, 'passed')} passed, ${failed} failed` +
    (count(rows, 'flaky') ? `, ${count(rows, 'flaky')} flaky` : '') +
    (count(rows, 'skipped') ? `, ${count(rows, 'skipped')} skipped` : ''),
  '',
  `${projects.map(p => `**${p}** ${count(rows.filter(r => r.project === p), 'passed')}/${rows.filter(r => r.project === p).length}`).join(' · ')} — total time ${seconds(report.stats?.duration || 0)}`,
  '',
];

for (const project of projects) {
  const list = rows.filter(r => r.project === project);
  const bad = count(list, 'failed');
  lines.push(
    `<details${bad ? ' open' : ''}><summary>${bad ? '❌' : '✅'} <b>${project}</b> — ${count(list, 'passed')} of ${list.length} passed${bad ? `, ${bad} failed` : ''}</summary>`,
    '',
    '| | Test | File | Time |',
    '|---|---|---|---|',
    ...list.map(r => `| ${icon[r.status]} | ${esc(r.title)}${r.error ? `<br><sub>${esc(r.error.slice(0, 200))}</sub>` : ''} | \`${r.file}\` | ${seconds(r.duration)} |`),
    '',
    '</details>',
    '',
  );
}

console.log(lines.join('\n'));
