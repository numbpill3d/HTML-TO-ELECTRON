#!/usr/bin/env node

const path = require('node:path');
const HTMLElectronSplitter = require('./file-splitter');
const { version } = require('./package.json');

const HELP = `HTML to Electron

Usage: html-to-electron <input.html> [options]

Options:
  -o, --output <directory>  Output directory (default: <input>-electron)
  -z, --zip                 Also create a ZIP archive
      --overwrite           Replace a non-empty output directory
  -h, --help                Show this help
  -v, --version             Show the version
`;

function parseArgs(argv) {
  const options = { createZip: false, overwrite: false };
  let input;

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--help' || argument === '-h') return { help: true };
    if (argument === '--version' || argument === '-v') return { version: true };
    if (argument === '--zip' || argument === '-z') options.createZip = true;
    else if (argument === '--overwrite') options.overwrite = true;
    else if (argument === '--output' || argument === '-o') {
      const value = argv[index + 1];
      if (!value || value.startsWith('-')) throw new Error(`${argument} requires a directory.`);
      options.outputDir = path.resolve(value);
      index += 1;
    } else if (argument.startsWith('-')) {
      throw new Error(`Unknown option: ${argument}`);
    } else if (!input) input = argument;
    else throw new Error(`Unexpected argument: ${argument}`);
  }

  if (!input) throw new Error('An input HTML file is required.');
  return { input: path.resolve(input), options };
}

async function run(argv = process.argv.slice(2)) {
  try {
    const parsed = parseArgs(argv);
    if (parsed.help) {
      process.stdout.write(HELP);
      return 0;
    }
    if (parsed.version) {
      process.stdout.write(`${version}\n`);
      return 0;
    }

    const result = await new HTMLElectronSplitter().splitHTMLtoElectron(parsed.input, parsed.options);
    if (!result.success) throw new Error(result.error);

    process.stdout.write(`Created Electron project: ${result.outputDirectory}\n`);
    if (result.files.zipFile) process.stdout.write(`Created ZIP archive: ${result.files.zipFile}\n`);
    return 0;
  } catch (error) {
    process.stderr.write(`Error: ${error.message}\n`);
    return 1;
  }
}

if (require.main === module) {
  run().then((code) => {
    process.exitCode = code;
  });
}

module.exports = { parseArgs, run };
