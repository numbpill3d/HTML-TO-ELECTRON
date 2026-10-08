const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

const cli = path.resolve(__dirname, '..', 'cli.js');

test('prints command help', () => {
  const result = spawnSync(process.execPath, [cli, '--help'], { encoding: 'utf8' });
  assert.equal(result.status, 0);
  assert.match(result.stdout, /Usage: html-to-electron/);
  assert.match(result.stdout, /--zip/);
});

test('converts an HTML file from the CLI', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'html-to-electron-cli-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const input = path.join(root, 'sample.html');
  const output = path.join(root, 'desktop-app');
  await fs.writeFile(input, '<!doctype html><style>body{color:red}</style><h1>Hi</h1>');

  const result = spawnSync(process.execPath, [cli, input, '--output', output], { encoding: 'utf8' });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Created Electron project/);
  assert.match(await fs.readFile(path.join(output, 'style.css'), 'utf8'), /color:red/);
});

test('returns a non-zero exit code for invalid input', () => {
  const result = spawnSync(process.execPath, [cli, 'missing.html'], { encoding: 'utf8' });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /not found/i);
});
