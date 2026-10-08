const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const HTMLElectronSplitter = require('./file-splitter');

let mainWindow;
const selections = new Map();
const appPage = pathToFileURL(path.join(__dirname, 'index.html')).href;

function trustedSender(event) {
  if (!mainWindow || event.sender !== mainWindow.webContents || event.senderFrame.url !== appPage) {
    throw new Error('Rejected IPC request from an untrusted renderer.');
  }
  return event.sender.id;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1080,
    height: 720,
    minWidth: 860,
    minHeight: 600,
    backgroundColor: '#e7e4dc',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.removeMenu();
  mainWindow.loadFile('index.html');
  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (url !== mainWindow.webContents.getURL()) event.preventDefault();
  });
  const rendererId = mainWindow.webContents.id;
  mainWindow.webContents.once('destroyed', () => selections.delete(rendererId));
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

ipcMain.handle('dialog:select-html', async (event) => {
  const senderId = trustedSender(event);
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Choose an HTML file',
    properties: ['openFile'],
    filters: [{ name: 'HTML documents', extensions: ['html', 'htm'] }],
  });
  if (result.canceled) return null;
  const selection = selections.get(senderId) || {};
  selection.inputPath = result.filePaths[0];
  selections.set(senderId, selection);
  return selection.inputPath;
});

ipcMain.handle('dialog:select-output', async (event) => {
  const senderId = trustedSender(event);
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Choose an output folder',
    properties: ['openDirectory', 'createDirectory'],
  });
  if (result.canceled) return null;
  const selection = selections.get(senderId) || {};
  selection.outputDir = result.filePaths[0];
  selections.set(senderId, selection);
  return selection.outputDir;
});

ipcMain.handle('converter:run', async (event, options = {}) => {
  const senderId = trustedSender(event);
  const selection = selections.get(senderId);
  if (!selection?.inputPath || !selection?.outputDir) {
    return { success: false, error: 'Choose both an HTML file and an output folder.' };
  }

  return new HTMLElectronSplitter().splitHTMLtoElectron(selection.inputPath, {
    outputDir: selection.outputDir,
    createZip: options.createZip === true,
    overwrite: options.overwrite === true,
  });
});

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
