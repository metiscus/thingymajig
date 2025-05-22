// main.cjs
const { app, BrowserWindow } = require('electron'); // Remove ipcMain, dialog, sqlite3, ExcelJS, fs
const path = require('path');

// No more local database path or SQLite initialization
// const dbPath = app.isPackaged
//   ? path.join(app.getPath('userData'), 'rom_planner.db')
//   : path.join(__dirname, 'rom_planner.db');

// const db = new sqlite3.Database(dbPath, (err) => { /* ... removed ... */ });


function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (process.env.NODE_ENV === 'development') {
    // In development, load from Vite's dev server which now talks to FastAPI
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    // In production build, load the compiled Vue app
    mainWindow.loadFile(path.join(__dirname, 'dist/index.html'));
  }
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  // No database connection to close here
  // db.close((err) => { /* ... removed ... */ });
  if (process.platform !== 'darwin') app.quit();
});

// --- REMOVE ALL IPC HANDLERS ---
// All ipcMain.handle calls related to data (get-rates, save-rate, get-projects, save-project, etc.)
// should be removed from here.

// For example, delete everything from `ipcMain.handle('get-rates', ...)` down to the end of the file.