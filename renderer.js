const state = { inputPath: null, outputDir: null };
const api = window.electronAPI;
const elements = {
  inputPath: document.getElementById('inputPath'),
  outputPath: document.getElementById('outputPath'),
  chooseInput: document.getElementById('chooseInput'),
  chooseOutput: document.getElementById('chooseOutput'),
  createZip: document.getElementById('createZip'),
  overwrite: document.getElementById('overwrite'),
  convert: document.getElementById('convert'),
  statusDot: document.getElementById('statusDot'),
  statusTitle: document.getElementById('statusTitle'),
  statusMessage: document.getElementById('statusMessage'),
  outputFiles: document.getElementById('outputFiles'),
  runtime: document.getElementById('runtime'),
};

function displayPath(value) {
  const parts = value.split(/[\\/]/);
  return parts.length > 4 ? `…/${parts.slice(-3).join('/')}` : value;
}

function refreshButton() {
  elements.convert.disabled = !(state.inputPath && state.outputDir);
}

function setStatus(kind, title, message) {
  elements.statusDot.className = `status-dot ${kind}`;
  elements.statusTitle.textContent = title;
  elements.statusMessage.textContent = message;
}

function renderFiles(files) {
  elements.outputFiles.replaceChildren();
  Object.entries(files || {}).forEach(([label, filePath]) => {
    const item = document.createElement('li');
    const name = document.createElement('span');
    const location = document.createElement('code');
    name.textContent = label;
    location.textContent = displayPath(filePath);
    location.title = filePath;
    item.append(name, location);
    elements.outputFiles.appendChild(item);
  });
}

elements.chooseInput.addEventListener('click', async () => {
  if (!api) return setStatus('error', 'UNAVAILABLE', 'Run this interface inside Electron to select files.');
  const selected = await api.chooseHtml();
  if (!selected) return;
  state.inputPath = selected;
  elements.inputPath.textContent = displayPath(selected);
  elements.inputPath.title = selected;
  refreshButton();
});

elements.chooseOutput.addEventListener('click', async () => {
  if (!api) return setStatus('error', 'UNAVAILABLE', 'Run this interface inside Electron to select folders.');
  const selected = await api.chooseOutput();
  if (!selected) return;
  state.outputDir = selected;
  elements.outputPath.textContent = displayPath(selected);
  elements.outputPath.title = selected;
  refreshButton();
});

elements.convert.addEventListener('click', async () => {
  elements.convert.disabled = true;
  renderFiles({});
  setStatus('working', 'BUILDING', 'Extracting assets and generating the Electron project…');

  const result = await api.convert({
    createZip: elements.createZip.checked,
    overwrite: elements.overwrite.checked,
  });

  if (result.success) {
    setStatus('success', 'COMPLETE', `Project created at ${result.outputDirectory}`);
    renderFiles(result.files);
  } else {
    setStatus('error', 'FAILED', result.error);
  }
  refreshButton();
});

if (api?.versions) {
  elements.runtime.textContent = `ELECTRON ${api.versions.electron} · NODE ${api.versions.node}`;
}
