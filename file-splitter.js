const fs = require('node:fs/promises');
const path = require('node:path');
const { createWriteStream, constants } = require('node:fs');
const { randomUUID } = require('node:crypto');
const { ZipArchive } = require('archiver');
const cheerio = require('cheerio');

const GENERATED_ELECTRON_VERSION = '^44.0.0';

class HTMLElectronSplitter {
  async splitHTMLtoElectron(inputPath, options = {}) {
    let stagingDirectory;
    let stagingZip;

    try {
      const requestedSourcePath = path.resolve(inputPath);
      await this.validateInput(requestedSourcePath);
      const sourcePath = await fs.realpath(requestedSourcePath);
      const outputDirectory = path.resolve(
        options.outputDir || path.join(process.cwd(), `${path.parse(sourcePath).name}-electron`),
      );
      const overwrite = Boolean(options.overwrite);
      const createZip = Boolean(options.createZip);
      const canonicalOutput = await this.realpathForCreation(outputDirectory);

      await this.validateDestination(sourcePath, canonicalOutput, { createZip, overwrite });
      await this.validateOutputState(outputDirectory, overwrite);

      // Read before any destination replacement so the source can never be deleted first.
      const source = await fs.readFile(sourcePath, 'utf8');
      await fs.mkdir(path.dirname(outputDirectory), { recursive: true });
      stagingDirectory = await fs.mkdtemp(
        path.join(path.dirname(outputDirectory), `.${path.basename(outputDirectory)}.tmp-`),
      );

      const stagedFiles = await this.generateProject(source, sourcePath, stagingDirectory);
      if (createZip) {
        stagingZip = `${stagingDirectory}.zip`;
        await this.createZip(stagingDirectory, stagingZip);
      }

      // Repeat the canonical containment check immediately before publication.
      const finalCanonicalOutput = await this.realpathForCreation(outputDirectory);
      await this.validateDestination(sourcePath, finalCanonicalOutput, { createZip, overwrite });

      let zipPublication;
      if (createZip) {
        zipPublication = await this.publishPath(stagingZip, `${outputDirectory}.zip`, overwrite, 'ZIP archive');
      }

      let outputPublication;
      try {
        outputPublication = await this.publishPath(
          stagingDirectory,
          outputDirectory,
          overwrite,
          'Output directory',
        );
      } catch (error) {
        if (zipPublication) await zipPublication.rollback();
        throw error;
      }

      await outputPublication.finalize();
      if (zipPublication) await zipPublication.finalize();
      stagingDirectory = undefined;
      stagingZip = undefined;

      const files = Object.fromEntries(
        Object.entries(stagedFiles).map(([key, value]) => [
          key,
          path.join(outputDirectory, path.basename(value)),
        ]),
      );

      if (createZip) files.zipFile = `${outputDirectory}.zip`;

      return { success: true, files, outputDirectory };
    } catch (error) {
      if (stagingDirectory) await fs.rm(stagingDirectory, { recursive: true, force: true }).catch(() => {});
      if (stagingZip) await fs.rm(stagingZip, { force: true }).catch(() => {});
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async validateInput(sourcePath) {
    let stats;
    try {
      stats = await fs.stat(sourcePath);
    } catch (error) {
      if (error.code === 'ENOENT') throw new Error(`Input file not found: ${sourcePath}`);
      throw error;
    }

    if (!stats.isFile()) throw new Error('Input must be a regular file.');
    if (!['.html', '.htm'].includes(path.extname(sourcePath).toLowerCase())) {
      throw new Error('Input must use the .html or .htm extension.');
    }
  }

  async realpathForCreation(targetPath) {
    let cursor = targetPath;
    const missingSegments = [];

    while (true) {
      try {
        const realBase = await fs.realpath(cursor);
        return path.join(realBase, ...missingSegments);
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
        const parent = path.dirname(cursor);
        if (parent === cursor) throw error;
        missingSegments.unshift(path.basename(cursor));
        cursor = parent;
      }
    }
  }

  async validateDestination(sourcePath, outputDirectory, options) {
    const sourceRelativeToOutput = path.relative(outputDirectory, sourcePath);
    if (!sourceRelativeToOutput.startsWith('..') && !path.isAbsolute(sourceRelativeToOutput)) {
      throw new Error('Output directory contains the source HTML file; choose a separate destination.');
    }

    if (options.createZip && !options.overwrite) {
      try {
        await fs.access(`${outputDirectory}.zip`);
        throw new Error(`ZIP archive already exists: ${outputDirectory}.zip. Use overwrite to replace it.`);
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
      }
    }
  }

  async validateOutputState(outputDirectory, overwrite) {
    try {
      const stats = await fs.lstat(outputDirectory);
      if (stats.isSymbolicLink()) throw new Error('Output directory cannot be a symbolic link.');
      if (!stats.isDirectory()) throw new Error(`Output path is not a directory: ${outputDirectory}`);
      const entries = await fs.readdir(outputDirectory);
      if (entries.length && !overwrite) {
        throw new Error(`Output directory is not empty: ${outputDirectory}. Use overwrite to replace it.`);
      }
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }

  async pathFingerprint(targetPath) {
    const stats = await fs.lstat(targetPath, { bigint: true });
    return {
      dev: stats.dev,
      ino: stats.ino,
      size: stats.size,
      mtimeNs: stats.mtimeNs,
    };
  }

  async ownsPublishedPath(targetPath, fingerprint) {
    try {
      const current = await this.pathFingerprint(targetPath);
      return (
        current.dev === fingerprint.dev &&
        current.ino === fingerprint.ino &&
        current.size === fingerprint.size &&
        current.mtimeNs === fingerprint.mtimeNs
      );
    } catch (error) {
      if (error.code === 'ENOENT') return false;
      throw error;
    }
  }

  async publishPath(stagedPath, destinationPath, overwrite, label) {
    if (!overwrite) {
      const stagedStats = await fs.lstat(stagedPath);
      if (stagedStats.isFile()) {
        try {
          await fs.copyFile(stagedPath, destinationPath, constants.COPYFILE_EXCL);
        } catch (error) {
          if (error.code === 'EEXIST') {
            throw new Error(`${label} already exists: ${destinationPath}. Use overwrite to replace it.`);
          }
          throw error;
        }
        const fingerprint = await this.pathFingerprint(destinationPath);
        return {
          finalize: async () => fs.rm(stagedPath, { force: true }),
          rollback: async () => {
            if (await this.ownsPublishedPath(destinationPath, fingerprint)) {
              await fs.rm(destinationPath, { force: true });
            }
          },
        };
      }

      try {
        const destinationStats = await fs.lstat(destinationPath);
        if (!destinationStats.isDirectory() || destinationStats.isSymbolicLink()) {
          throw new Error(`${label} already exists: ${destinationPath}. Use overwrite to replace it.`);
        }
        // rmdir succeeds only while the directory is empty; concurrent data is preserved.
        await fs.rmdir(destinationPath);
      } catch (error) {
        if (error.code !== 'ENOENT') {
          if (error.code === 'ENOTEMPTY' || error.code === 'EEXIST') {
            throw new Error(`${label} already exists: ${destinationPath}. Use overwrite to replace it.`);
          }
          throw error;
        }
      }

      try {
        // A directory rename cannot replace a non-empty directory or a file.
        await fs.rename(stagedPath, destinationPath);
      } catch (error) {
        if (['EEXIST', 'ENOTEMPTY', 'ENOTDIR', 'EISDIR'].includes(error.code)) {
          throw new Error(`${label} already exists: ${destinationPath}. Use overwrite to replace it.`);
        }
        throw error;
      }
      const fingerprint = await this.pathFingerprint(destinationPath);
      return {
        finalize: async () => {},
        rollback: async () => {
          if (await this.ownsPublishedPath(destinationPath, fingerprint)) {
            await fs.rm(destinationPath, { recursive: true, force: true });
          }
        },
      };
    }

    let backupPath;
    try {
      await fs.lstat(destinationPath);
      backupPath = `${destinationPath}.backup-${randomUUID()}`;
      await fs.rename(destinationPath, backupPath);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }

    try {
      await fs.rename(stagedPath, destinationPath);
    } catch (error) {
      if (backupPath) await fs.rename(backupPath, destinationPath).catch(() => {});
      throw error;
    }

    const fingerprint = await this.pathFingerprint(destinationPath);
    return {
      finalize: async () => {
        if (backupPath) await fs.rm(backupPath, { recursive: true, force: true }).catch(() => {});
      },
      rollback: async () => {
        if (await this.ownsPublishedPath(destinationPath, fingerprint)) {
          await fs.rm(destinationPath, { recursive: true, force: true }).catch(() => {});
          if (backupPath) await fs.rename(backupPath, destinationPath).catch(() => {});
        }
      },
    };
  }

  async generateProject(source, sourcePath, outputDirectory) {
    const $ = cheerio.load(source, { decodeEntities: false });
    if ($('base[href]').length) {
      throw new Error('Documents containing <base href> are not supported because generated assets must remain local.');
    }
    const generatedAssets = [];
    let styleCount = 0;
    let classicScriptCount = 0;
    let moduleScriptCount = 0;

    $('style').each((_, element) => {
      styleCount += 1;
      const filename = styleCount === 1 ? 'style.css' : `style-${styleCount}.css`;
      generatedAssets.push({ key: styleCount === 1 ? 'css' : `css${styleCount}`, filename, content: $(element).html() || '' });

      const replacement = $('<link>');
      Object.entries(element.attribs || {}).forEach(([name, value]) => {
        if (
          ['id', 'class', 'media', 'title', 'nonce', 'disabled'].includes(name) ||
          name.startsWith('data-') ||
          name.startsWith('aria-')
        ) {
          replacement.attr(name, value);
        }
      });
      replacement.attr('rel', 'stylesheet');
      replacement.attr('href', filename);
      $(element).replaceWith(replacement);
    });

    const classicJavaScriptTypes = new Set([
      '',
      'application/ecmascript',
      'application/javascript',
      'application/x-ecmascript',
      'application/x-javascript',
      'text/ecmascript',
      'text/javascript',
      'text/javascript1.0',
      'text/javascript1.1',
      'text/javascript1.2',
      'text/javascript1.3',
      'text/javascript1.4',
      'text/javascript1.5',
      'text/jscript',
      'text/livescript',
      'text/x-ecmascript',
      'text/x-javascript',
    ]);

    $('script:not([src])').each((_, element) => {
      const rawType = $(element).attr('type') || '';
      const type = rawType.split(';', 1)[0].trim().toLowerCase();
      if (type !== 'module' && !classicJavaScriptTypes.has(type)) return;

      const isModule = type === 'module';
      const count = isModule ? ++moduleScriptCount : ++classicScriptCount;
      const prefix = isModule ? 'renderer-module' : 'renderer';
      const filename = count === 1 ? `${prefix}.js` : `${prefix}-${count}.js`;
      const key = isModule
        ? (count === 1 ? 'moduleRenderer' : `moduleRenderer${count}`)
        : (count === 1 ? 'renderer' : `renderer${count}`);
      generatedAssets.push({ key, filename, content: $(element).html() || '' });
      Object.keys(element.attribs || {}).forEach((attribute) => {
        const allowed =
          ['id', 'class', 'nonce', 'nomodule'].includes(attribute) ||
          (attribute === 'async' && isModule) ||
          attribute.startsWith('data-') ||
          attribute.startsWith('aria-');
        if (!allowed && attribute !== 'type') $(element).removeAttr(attribute);
      });
      if (isModule) $(element).attr('type', 'module');
      else if (rawType) $(element).attr('type', 'text/javascript');
      $(element).attr('src', filename).text('');
    });

    if (styleCount === 0) generatedAssets.push({ key: 'css', filename: 'style.css', content: '/* No inline styles found. */' });
    if (classicScriptCount === 0) generatedAssets.push({ key: 'renderer', filename: 'renderer.js', content: '// No inline classic scripts found.' });

    const files = {
      html: path.join(outputDirectory, 'index.html'),
      main: path.join(outputDirectory, 'main.js'),
      packageJson: path.join(outputDirectory, 'package.json'),
      readme: path.join(outputDirectory, 'README.md'),
    };
    generatedAssets.forEach(({ key, filename }) => {
      files[key] = path.join(outputDirectory, filename);
    });

    const appName = this.toAppName(path.parse(sourcePath).name);
    await Promise.all([
      fs.writeFile(files.html, $.html()),
      fs.writeFile(files.main, this.mainTemplate()),
      fs.writeFile(files.packageJson, `${JSON.stringify(this.packageTemplate(appName), null, 2)}\n`),
      fs.writeFile(files.readme, this.readmeTemplate(appName)),
      ...generatedAssets.map(({ filename, content }) =>
        fs.writeFile(path.join(outputDirectory, filename), `${content.trim()}\n`),
      ),
    ]);

    return files;
  }

  toAppName(name) {
    return name
      .replace(/[^a-zA-Z0-9]+/g, ' ')
      .trim()
      .replace(/\b\w/g, (character) => character.toUpperCase()) || 'Electron App';
  }

  packageTemplate(appName) {
    return {
      name: appName.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      version: '1.0.0',
      private: true,
      description: `${appName}, converted to Electron`,
      main: 'main.js',
      scripts: {
        start: 'electron .',
        pack: 'electron-builder --dir',
        dist: 'electron-builder',
      },
      devDependencies: {
        electron: GENERATED_ELECTRON_VERSION,
        'electron-builder': '^26.15.3',
      },
      build: {
        appId: `com.generated.${appName.toLowerCase().replace(/[^a-z0-9]+/g, '') || 'app'}`,
        productName: appName,
        files: ['**/*', '!node_modules/**/*', '!dist/**/*'],
      },
    };
  }

  mainTemplate() {
    return `const { app, BrowserWindow } = require('electron');
const path = require('node:path');

function createWindow() {
  const window = new BrowserWindow({
    width: 1100,
    height: 760,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event, url) => {
    if (url !== window.webContents.getURL()) event.preventDefault();
  });
  window.loadFile(path.join(__dirname, 'index.html'));
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
`;
  }

  readmeTemplate(appName) {
    return `# ${appName}\n\nGenerated with HTML to Electron.\n\n## Run\n\n\`\`\`bash\nnpm install\nnpm start\n\`\`\`\n\n## Package\n\n\`\`\`bash\nnpm run dist\n\`\`\`\n`;
  }

  createZip(outputDirectory, zipPath) {
    return new Promise((resolve, reject) => {
      const output = createWriteStream(zipPath);
      const archive = new ZipArchive({ zlib: { level: 9 } });
      output.on('close', () => resolve(zipPath));
      output.on('error', reject);
      archive.on('error', reject);
      archive.pipe(output);
      archive.directory(outputDirectory, false);
      archive.finalize();
    });
  }
}

module.exports = HTMLElectronSplitter;
