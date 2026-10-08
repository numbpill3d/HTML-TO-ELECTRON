const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  chooseHtml: () => ipcRenderer.invoke('dialog:select-html'),
  chooseOutput: () => ipcRenderer.invoke('dialog:select-output'),
  convert: (request) => ipcRenderer.invoke('converter:run', request),
  versions: {
    electron: process.versions.electron,
    node: process.versions.node,
  },
});
