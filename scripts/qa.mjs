import { spawn, spawnSync } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { access, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { migrate } from './migrate.ts';
import { seed } from './seed.ts';
import { testPool } from '../tests/support/database.ts';
import { createToken } from '../src/server/auth.ts';

const root = path.resolve(import.meta.dirname, '..');
const out = path.join(root, '.qa');
const browserTemp = path.join(out, `browser-${process.pid}`);
const project = `inventory-qa-${process.pid}-${Date.now()}`;
const dockerApp = process.argv.includes('--docker-app');
const freeRuntime = process.argv.includes('--free-runtime');
const containerName = `${project}-app`;
const baseURL = 'http://127.0.0.1:5173';
const children = new Set();
const steps = [];
const controller = new AbortController();
let databaseStarted = false;
let imageBuilt = false;
let containerCreated = false;
let server;
let serverLog;
let failure;

await mkdir(out, { recursive: true });
await mkdir(browserTemp, { recursive: true });
const environment = Object.fromEntries(
  ['PATH', 'HOME', 'TMPDIR', 'LANG', 'CHROME_PATH', 'CI']
    .filter((key) => process.env[key] !== undefined)
    .map((key) => [key, process.env[key]]),
);
Object.assign(environment, {
  NEXT_TELEMETRY_DISABLED: '1',
  NODE_ENV: 'production',
  TMPDIR: browserTemp,
  HOST: '127.0.0.1',
  PORT: '5173',
  APP_ORIGIN: baseURL,
  E2E_BASE_URL: baseURL,
  DATABASE_URL: 'mysql://inventory_test:test-only-password@127.0.0.1:3308/inventory_test',
  TEST_DATABASE_URL: 'mysql://inventory_test:test-only-password@127.0.0.1:3308/inventory_test',
  JWT_SECRET: 'public-qa-only-key-never-use-in-a-real-deployment',
});
if (freeRuntime) environment.E2E_SLOW_SERVER = '1';
process.env.TEST_DATABASE_URL = environment.TEST_DATABASE_URL;
process.env.JWT_SECRET = environment.JWT_SECRET;

const compose = [
  'compose',
  '--env-file',
  '.env.example',
  '--project-name',
  project,
  '--profile',
  'test',
];
const listenersBefore = listeners();
process.once('SIGINT', () => controller.abort());
process.once('SIGTERM', () => controller.abort());

function listeners() {
  const result = spawnSync('lsof', ['-nP', '-iTCP', '-sTCP:LISTEN'], { encoding: 'utf8' });
  return (result.stdout || '')
    .split('\n')
    .filter((line) => /:(3000|4173|4321|5173|8787|8788|8789)\b/.test(line));
}

function browserPids() {
  const pattern = browserTemp.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const result = spawnSync('pgrep', ['-f', pattern], { encoding: 'utf8' });
  if (result.error || ![0, 1].includes(result.status)) return null;
  return result.stdout
    .trim()
    .split(/\s+/)
    .map(Number)
    .filter((pid) => pid > 0 && pid !== process.pid);
}

async function stop(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  child.kill('SIGTERM');
  await Promise.race([new Promise((resolve) => child.once('close', resolve)), delay(5000)]);
  if (child.exitCode === null && child.signalCode === null) {
    child.kill('SIGKILL');
    await new Promise((resolve) => child.once('close', resolve));
  }
}

async function run(label, command, args, options = {}) {
  const started = Date.now();
  const logPath = path.join(out, `${label}.log`);
  const log = createWriteStream(logPath);
  const child = spawn(command, args, {
    cwd: root,
    env: environment,
    signal: options.cleanup ? undefined : controller.signal,
  });
  children.add(child);
  child.stdout.pipe(log, { end: false });
  child.stderr.pipe(log, { end: false });
  try {
    const code = await new Promise((resolve, reject) => {
      child.once('error', reject);
      child.once('close', resolve);
    });
    const passed = code === 0;
    steps.push({
      name: label,
      passed,
      durationMs: Date.now() - started,
      log: path.relative(root, logPath),
    });
    if (!passed)
      throw new Error(`${label} failed (exit ${code}). See ${path.relative(root, logPath)}.`);
    console.info(`PASS ${label}`);
  } finally {
    children.delete(child);
    await new Promise((resolve) => log.end(resolve));
  }
}

async function waitForServer() {
  const timeout = freeRuntime ? 90_000 : 30_000;
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    controller.signal.throwIfAborted();
    if (server.exitCode !== null || server.signalCode !== null)
      throw new Error('The QA server stopped. See .qa/server.log.');
    try {
      const response = await fetch(`${baseURL}/api/health`, { signal: AbortSignal.timeout(1000) });
      if (response.ok) return;
    } catch {
      /* The server may still be preparing Next.js. */
    }
    await delay(250);
  }
  throw new Error(
    `The QA server was not healthy within ${timeout / 1000} seconds. See .qa/server.log.`,
  );
}

async function runSkillAudit(script) {
  const source = await readFile(script, 'utf8');
  const marker = 'const page = await openPage(cdp);';
  if (!source.includes(marker))
    throw new Error('Unsupported web-qa script: authentication hook was not found.');
  const authenticated = source.replace(
    marker,
    `${marker}\n    await page.s('Network.setCookie', { name: 'inventory_session', value: process.env.E2E_SESSION_TOKEN, url: base, httpOnly: true, sameSite: 'Strict' });`,
  );
  const target = path.join(out, 'web-qa-authenticated.mjs');
  await writeFile(target, authenticated);
  await run('web-qa', process.execPath, [
    target,
    baseURL,
    '--paths=/ru/orders,/ru/products,/ru/analytics',
    `--out=${path.join(out, 'web-qa')}`,
  ]);
}

try {
  if (freeRuntime && !dockerApp) throw new Error('--free-runtime requires --docker-app.');
  const envFiles = (await readdir(root)).filter(
    (name) => /^\.env(?:\.|$)/.test(name) && name !== '.env.example',
  );
  if (envFiles.length)
    throw new Error(
      'Run QA from a clean checkout without local .env files. Tests do not load personal credentials.',
    );
  if (listenersBefore.some((line) => /:5173\b/.test(line)))
    throw new Error('Port 5173 is already in use. Stop your own server before QA.');
  await access(path.join(root, 'node_modules/@playwright/test/cli.js'));
  const context = spawnSync(
    'docker',
    ['context', 'inspect', '--format', '{{.Endpoints.docker.Host}}'],
    { env: environment, encoding: 'utf8' },
  );
  if (context.error || context.status !== 0)
    throw new Error('Docker Desktop must be running and accessible to this terminal.');
  if (!/^(unix|npipe):/.test(context.stdout.trim()))
    throw new Error('QA only creates containers on a local Docker engine.');
  const unitFiles = (await readdir(path.join(root, 'tests/unit')))
    .filter((name) => name.endsWith('.test.ts'))
    .map((name) => `tests/unit/${name}`);
  await run('route-types', process.execPath, ['node_modules/next/dist/bin/next', 'typegen']);
  await run('typecheck', process.execPath, ['node_modules/typescript/bin/tsc', '--noEmit']);
  await run('lint', process.execPath, [
    'node_modules/eslint/bin/eslint.js',
    '.',
    '--max-warnings',
    '0',
  ]);
  await run('unit', process.execPath, ['--test', ...unitFiles]);
  await run('build', process.execPath, ['node_modules/next/dist/bin/next', 'build']);
  if (dockerApp) {
    await run('image-build', 'docker', ['build', '--tag', project, '.']);
    imageBuilt = true;
  }
  databaseStarted = true;
  await run('database-start', 'docker', [
    ...compose,
    'up',
    '-d',
    '--wait',
    '--wait-timeout',
    '120',
    'test-db',
  ]);
  await run('integration', process.execPath, [
    '--test',
    '--test-concurrency=1',
    'tests/integration/inventory.test.ts',
  ]);

  const pool = testPool();
  try {
    await migrate(pool);
    await seed(pool, { username: 'qa-demo', password: 'public-qa-password', reset: true });
    const [users] = await pool.execute('SELECT id, username FROM users WHERE username = ?', [
      'qa-demo',
    ]);
    environment.E2E_SESSION_TOKEN = await createToken(users[0]);
  } finally {
    await pool.end();
  }

  if (dockerApp) {
    const containerEnvironment = {
      NODE_ENV: 'production',
      HOST: '0.0.0.0',
      PORT: '3000',
      APP_ORIGIN: baseURL,
      DATABASE_URL: 'mysql://inventory_test:test-only-password@test-db:3306/inventory_test',
      JWT_SECRET: environment.JWT_SECRET,
      DEMO_USERNAME: 'qa-demo',
      DEMO_PASSWORD: 'public-qa-password',
      ALLOW_DEMO_SEED: '1',
    };
    await run('container-create', 'docker', [
      'create',
      '--init',
      ...(freeRuntime ? ['--memory', '512m', '--cpus', '0.1'] : []),
      '--name',
      containerName,
      '--network',
      `${project}_default`,
      '--publish',
      '127.0.0.1:5173:3000',
      ...Object.entries(containerEnvironment).flatMap(([key, value]) => [
        '--env',
        `${key}=${value}`,
      ]),
      project,
    ]);
    containerCreated = true;
  }
  serverLog = createWriteStream(path.join(out, 'server.log'));
  server = dockerApp
    ? spawn('docker', ['start', '--attach', containerName], { cwd: root, env: environment })
    : spawn(process.execPath, ['server.ts'], { cwd: root, env: environment });
  children.add(server);
  server.stdout.pipe(serverLog, { end: false });
  server.stderr.pipe(serverLog, { end: false });
  server.on('error', () => {
    /* waitForServer reports the startup failure. */
  });
  await waitForServer();
  await run('browser', process.execPath, ['node_modules/@playwright/test/cli.js', 'test']);
  const skillOption = process.argv.find((arg) => arg.startsWith('--web-qa-script='));
  if (skillOption) await runSkillAudit(skillOption.slice('--web-qa-script='.length));
} catch (error) {
  failure = error instanceof Error ? error.message : String(error);
  console.error(failure);
  process.exitCode = 1;
} finally {
  if (containerCreated) {
    try {
      await run('container-stop', 'docker', ['rm', '--force', containerName], { cleanup: true });
    } catch (error) {
      failure ??= String(error);
      process.exitCode = 1;
    }
  }
  for (const child of children) await stop(child);
  if (serverLog) await new Promise((resolve) => serverLog.end(resolve));
  const browserProcesses = browserPids();
  if (browserProcesses) {
    for (const pid of browserProcesses) {
      try {
        process.kill(pid, 'SIGTERM');
      } catch {
        /* A browser child may already have exited. */
      }
    }
    if (browserProcesses.length) await delay(500);
  }
  if (databaseStarted) {
    try {
      await run(
        'database-stop',
        'docker',
        [...compose, 'down', '--volumes', '--remove-orphans', '--timeout', '5'],
        { cleanup: true },
      );
    } catch (error) {
      failure ??= String(error);
      process.exitCode = 1;
    }
  }
  if (imageBuilt) {
    try {
      await run('image-remove', 'docker', ['image', 'rm', project], { cleanup: true });
    } catch (error) {
      failure ??= String(error);
      process.exitCode = 1;
    }
  }
  const remainingListeners = listeners().filter((line) => !listenersBefore.includes(line));
  const remainingBrowsers = browserPids();
  if (remainingListeners.length) {
    failure ??= 'A new listener remained after QA.';
    process.exitCode = 1;
  }
  if (remainingBrowsers?.length) {
    failure ??= 'A QA browser process remained after cleanup.';
    process.exitCode = 1;
  }
  if (!remainingBrowsers?.length) await rm(browserTemp, { recursive: true, force: true });
  const report = {
    checkedAt: new Date().toISOString(),
    appRuntime: dockerApp ? 'docker' : 'node',
    runtimeLimits: freeRuntime ? { memoryMiB: 512, cpus: 0.1 } : undefined,
    passed: !failure,
    failure,
    steps,
    remainingListeners,
    remainingBrowsers,
  };
  await writeFile(path.join(out, 'verification.json'), `${JSON.stringify(report, null, 2)}\n`);
  if (!failure)
    console.info(
      'QA passed. The temporary database, server and browser processes were stopped. Reports: .qa/',
    );
}
