import { test, expect } from '@playwright/test';
import { execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { fileURLToPath } from 'url';

const run = promisify(execFile);
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');

/** Runs a check script in a fresh process with an in-memory database. */
async function check(script: string) {
  const { stdout } = await run(process.execPath, [path.join(ROOT, 'node_modules/tsx/dist/cli.mjs'), path.join(HERE, script)], {
    cwd: ROOT,
    env: { ...process.env, DATABASE_URL: '', NODE_ENV: 'development', JWT_SECRET: 'db-check-secret' },
    timeout: 120_000,
  });
  return stdout;
}

test.describe('Database migrations', () => {
  test('a new install from init.sql starts without migrating', async () => {
    expect(await check('check-fresh-install.mts')).toContain('fresh install: ok');
  });

  test('an existing database from the old init.sql is upgraded and keeps its data', async () => {
    expect(await check('check-legacy-upgrade.mts')).toContain('legacy upgrade: ok');
  });
});
