const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const HTMLElectronSplitter = require('../file-splitter');

async function fixture() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'html-to-electron-'));
  const input = path.join(root, 'input.html');
  const output = path.join(root, 'output');
  await fs.writeFile(input, `<!doctype html>
<html><head>
  <link rel="stylesheet" href="external.css">
  <style>body { color: red; }</style>
</head><body>
  <h1>Demo</h1>
  <script src="external.js"></script>
  <script>document.body.dataset.ready = 'yes';</script>
</body></html>`);
  return { root, input, output };
}

test('creates a runnable Electron project and preserves external assets', async (t) => {
  const { root, input, output } = await fixture();
  t.after(() => fs.rm(root, { recursive: true, force: true }));

  const result = await new HTMLElectronSplitter().splitHTMLtoElectron(input, { outputDir: output });

  assert.equal(result.success, true);
  assert.equal(result.outputDirectory, output);
  assert.deepEqual(
    (await fs.readdir(output)).sort(),
    ['README.md', 'index.html', 'main.js', 'package.json', 'renderer.js', 'style.css'].sort(),
  );

  const [html, css, renderer, main, manifest] = await Promise.all([
    fs.readFile(path.join(output, 'index.html'), 'utf8'),
    fs.readFile(path.join(output, 'style.css'), 'utf8'),
    fs.readFile(path.join(output, 'renderer.js'), 'utf8'),
    fs.readFile(path.join(output, 'main.js'), 'utf8'),
    fs.readFile(path.join(output, 'package.json'), 'utf8'),
  ]);

  assert.match(html, /external\.css/);
  assert.match(html, /external\.js/);
  assert.match(html, /href="style\.css"/);
  assert.match(html, /src="renderer\.js"/);
  assert.doesNotMatch(html, /body \{ color: red; \}/);
  assert.match(css, /body \{ color: red; \}/);
  assert.match(renderer, /dataset\.ready/);
  assert.match(main, /contextIsolation: true/);
  assert.equal(JSON.parse(manifest).main, 'main.js');
});

test('can create a zip archive', async (t) => {
  const { root, input, output } = await fixture();
  t.after(() => fs.rm(root, { recursive: true, force: true }));

  const result = await new HTMLElectronSplitter().splitHTMLtoElectron(input, {
    outputDir: output,
    createZip: true,
  });

  assert.equal(result.success, true);
  assert.equal(result.files.zipFile, `${output}.zip`);
  assert.ok((await fs.stat(`${output}.zip`)).size > 0);
});

test('returns useful validation errors without modifying the source', async (t) => {
  const { root, input, output } = await fixture();
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await fs.mkdir(output);
  await fs.writeFile(path.join(output, 'keep.txt'), 'keep');

  const result = await new HTMLElectronSplitter().splitHTMLtoElectron(input, { outputDir: output });

  assert.equal(result.success, false);
  assert.match(result.error, /not empty/i);
  assert.equal(await fs.readFile(path.join(output, 'keep.txt'), 'utf8'), 'keep');
});

test('refuses to overwrite the source tree', async (t) => {
  const { root, input } = await fixture();
  t.after(() => fs.rm(root, { recursive: true, force: true }));

  const result = await new HTMLElectronSplitter().splitHTMLtoElectron(input, {
    outputDir: root,
    overwrite: true,
  });

  assert.equal(result.success, false);
  assert.match(result.error, /contains the source/i);
  assert.match(await fs.readFile(input, 'utf8'), /Demo/);
});

test('does not replace an existing ZIP unless overwrite is enabled', async (t) => {
  const { root, input, output } = await fixture();
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await fs.writeFile(`${output}.zip`, 'keep');

  const result = await new HTMLElectronSplitter().splitHTMLtoElectron(input, {
    outputDir: output,
    createZip: true,
  });

  assert.equal(result.success, false);
  assert.match(result.error, /zip archive already exists/i);
  assert.equal(await fs.readFile(`${output}.zip`, 'utf8'), 'keep');
});

test('preserves style and script placement, attributes, and file scope', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'html-to-electron-order-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const input = path.join(root, 'ordered.html');
  const output = path.join(root, 'output');
  await fs.writeFile(input, `<!doctype html><html><head>
    <style media="print" integrity="sha256-invalid" crossorigin="anonymous">.print { display: block; }</style>
    <link rel="stylesheet" href="middle.css">
    <style>.screen { display: grid; }</style>
  </head><body>
    <script type="text/javascript; charset=utf-8" integrity="sha256-invalid" attributionsrc="https://example.invalid/register" async defer>window.order = ['first'];</script>
    <script src="middle.js"></script>
    <script>window.order.push('last');</script>
    <script type="module">const value = 'a';</script>
    <script type="module">const value = 'b';</script>
  </body></html>`);

  const result = await new HTMLElectronSplitter().splitHTMLtoElectron(input, { outputDir: output });

  assert.equal(result.success, true);
  const html = await fs.readFile(path.join(output, 'index.html'), 'utf8');
  const firstGeneratedStyle = html.match(/<link[^>]+href="style\.css"[^>]*>/)?.[0];
  assert.ok(firstGeneratedStyle);
  assert.match(firstGeneratedStyle, /media="print"/);
  assert.doesNotMatch(firstGeneratedStyle, /integrity|crossorigin/);
  assert.ok(html.indexOf('style.css') < html.indexOf('middle.css'));
  assert.ok(html.indexOf('middle.css') < html.indexOf('style-2.css'));
  assert.ok(html.indexOf('renderer.js') < html.indexOf('middle.js'));
  const firstGeneratedScript = html.match(/<script[^>]+src="renderer\.js"[^>]*>/)?.[0];
  assert.ok(firstGeneratedScript);
  assert.doesNotMatch(firstGeneratedScript, /integrity|attributionsrc|async|defer/);
  assert.ok(html.indexOf('middle.js') < html.indexOf('renderer-2.js'));
  assert.ok(html.indexOf('renderer-module.js') < html.indexOf('renderer-module-2.js'));
  assert.match(await fs.readFile(path.join(output, 'renderer-module-2.js'), 'utf8'), /value = 'b'/);
});

test('rejects a symlinked source that resolves inside an overwritten output tree', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'html-to-electron-link-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const output = path.join(root, 'output');
  const realInput = path.join(output, 'source.html');
  const linkedInput = path.join(root, 'source-link.html');
  await fs.mkdir(output);
  await fs.writeFile(realInput, '<h1>Keep me</h1>');
  await fs.symlink(realInput, linkedInput);

  const result = await new HTMLElectronSplitter().splitHTMLtoElectron(linkedInput, {
    outputDir: output,
    overwrite: true,
  });

  assert.equal(result.success, false);
  assert.match(result.error, /contains the source/i);
  assert.match(await fs.readFile(realInput, 'utf8'), /Keep me/);
});

test('keeps an existing output intact when generation fails', async (t) => {
  const { root, input, output } = await fixture();
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await fs.mkdir(output);
  await fs.writeFile(path.join(output, 'keep.txt'), 'keep');

  class FailingSplitter extends HTMLElectronSplitter {
    async generateProject() {
      throw new Error('simulated generation failure');
    }
  }

  const result = await new FailingSplitter().splitHTMLtoElectron(input, {
    outputDir: output,
    overwrite: true,
  });

  assert.equal(result.success, false);
  assert.match(result.error, /simulated generation failure/);
  assert.equal(await fs.readFile(path.join(output, 'keep.txt'), 'utf8'), 'keep');
});

test('does not replace output created concurrently during generation', async (t) => {
  const { root, input, output } = await fixture();
  t.after(() => fs.rm(root, { recursive: true, force: true }));

  class RacingSplitter extends HTMLElectronSplitter {
    async generateProject(...args) {
      const files = await super.generateProject(...args);
      await fs.mkdir(output);
      await fs.writeFile(path.join(output, 'concurrent.txt'), 'keep');
      return files;
    }
  }

  const result = await new RacingSplitter().splitHTMLtoElectron(input, { outputDir: output });

  assert.equal(result.success, false);
  assert.match(result.error, /already exists|not empty/i);
  assert.equal(await fs.readFile(path.join(output, 'concurrent.txt'), 'utf8'), 'keep');
});

test('does not replace a ZIP created concurrently during generation', async (t) => {
  const { root, input, output } = await fixture();
  t.after(() => fs.rm(root, { recursive: true, force: true }));

  class RacingZipSplitter extends HTMLElectronSplitter {
    async createZip(...args) {
      const zip = await super.createZip(...args);
      await fs.writeFile(`${output}.zip`, 'keep');
      return zip;
    }
  }

  const result = await new RacingZipSplitter().splitHTMLtoElectron(input, {
    outputDir: output,
    createZip: true,
  });

  assert.equal(result.success, false);
  assert.match(result.error, /already exists/i);
  assert.equal(await fs.readFile(`${output}.zip`, 'utf8'), 'keep');
  await assert.rejects(fs.access(output), /ENOENT/);
});

test('rejects documents with base href before generating relative assets', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'html-to-electron-base-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const input = path.join(root, 'base.html');
  const output = path.join(root, 'output');
  await fs.writeFile(input, '<base href="https://example.invalid/"><style>body{color:red}</style>');

  const result = await new HTMLElectronSplitter().splitHTMLtoElectron(input, { outputDir: output });

  assert.equal(result.success, false);
  assert.match(result.error, /base href/i);
  await assert.rejects(fs.access(output), /ENOENT/);
});

test('does not delete a concurrently replaced ZIP during rollback', async (t) => {
  const { root, input, output } = await fixture();
  t.after(() => fs.rm(root, { recursive: true, force: true }));

  class RollbackRaceSplitter extends HTMLElectronSplitter {
    async publishPath(stagedPath, destinationPath, overwrite, label) {
      const publication = await super.publishPath(stagedPath, destinationPath, overwrite, label);
      if (label === 'ZIP archive') {
        await fs.rm(destinationPath);
        await fs.writeFile(destinationPath, 'concurrent replacement');
        await fs.mkdir(output);
        await fs.writeFile(path.join(output, 'concurrent.txt'), 'keep');
      }
      return publication;
    }
  }

  const result = await new RollbackRaceSplitter().splitHTMLtoElectron(input, {
    outputDir: output,
    createZip: true,
  });

  assert.equal(result.success, false);
  assert.equal(await fs.readFile(`${output}.zip`, 'utf8'), 'concurrent replacement');
  assert.equal(await fs.readFile(path.join(output, 'concurrent.txt'), 'utf8'), 'keep');
});

test('rejects directories and non-HTML inputs', async (t) => {
  const { root } = await fixture();
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const textFile = path.join(root, 'input.txt');
  await fs.writeFile(textFile, 'not html');

  const splitter = new HTMLElectronSplitter();
  const directoryResult = await splitter.splitHTMLtoElectron(root);
  const textResult = await splitter.splitHTMLtoElectron(textFile);

  assert.equal(directoryResult.success, false);
  assert.match(directoryResult.error, /regular file/i);
  assert.equal(textResult.success, false);
  assert.match(textResult.error, /\.html/i);
});
