// preload.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Only expose true Electron/OS specific features here, if any.
  // For data interaction, the frontend will now use HTTP directly.
  // Example if you still needed a file dialog for something else, but NOT for data:
  // openFileDialog: () => ipcRenderer.invoke('open-file-dialog'),
  // saveFile: (data) => ipcRenderer.invoke('save-file', data),
});

console.log('Preload script loaded (minimal).');