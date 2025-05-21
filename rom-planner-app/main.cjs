      
// main.cjs
const { app, BrowserWindow, ipcMain } = require('electron'); // Added ipcMain
const path = require('path');
const sqlite3 = require('sqlite3').verbose(); // Added sqlite3

// --- Database Setup ---
// Determine the path for the database. In development, it's in the project root.
// For a packaged app, app.getPath('userData') is a better place.
const dbPath = app.isPackaged
  ? path.join(app.getPath('userData'), 'rom_planner.db')
  : path.join(__dirname, 'rom_planner.db');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Database opening error: ', err);
  } else {
    console.log(`Database opened successfully at ${dbPath}`);
    db.serialize(() => {
      // Rates Table (existing)
      db.run(`
        CREATE TABLE IF NOT EXISTS rates (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          role TEXT UNIQUE NOT NULL,
          rate REAL NOT NULL,
          unit TEXT DEFAULT 'day'
        )
      `, (err) => {
        if (err) console.error("Error creating 'rates' table", err);
        else console.log("'rates' table checked/created.");
      });

      // Projects/Phases Table
      db.run(`
        CREATE TABLE IF NOT EXISTS projects (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT UNIQUE NOT NULL,
          description TEXT,
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `, (err) => {
        if (err) console.error("Error creating 'projects' table", err);
        else console.log("'projects' table checked/created.");
      });

      // Tasks Table
      db.run(`
        CREATE TABLE IF NOT EXISTS tasks (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          projectId INTEGER NOT NULL,
          name TEXT NOT NULL,
          description TEXT,
          efforts TEXT, -- JSON object: {"Eng": 8, "QA": 4}
          travelCost REAL DEFAULT 0,
          materialsCost REAL DEFAULT 0,
          sequence INTEGER DEFAULT 0, -- For ordering tasks within a project
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (projectId) REFERENCES projects(id) ON DELETE CASCADE
        )
      `, (err) => {
        if (err) console.error("Error creating 'tasks' table", err);
        else console.log("'tasks' table checked/created.");
      });
    });
  }
});
// --- End Database Setup ---


function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1000, // Increased width a bit
    height: 700, // Increased height a bit
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
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
  db.close((err) => { // Close DB when app closes
    if (err) {
      return console.error(err.message);
    }
    console.log('Database connection closed.');
  });
  if (process.platform !== 'darwin') app.quit();
});


// --- IPC Handlers for Rates ---
ipcMain.handle('get-rates', async () => {
  return new Promise((resolve, reject) => {
    db.all("SELECT id, role, rate, unit FROM rates ORDER BY role", [], (err, rows) => {
      if (err) {
        console.error('Error fetching rates:', err);
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
});

ipcMain.handle('save-rate', async (event, { role, rate, unit }) => {
  return new Promise((resolve, reject) => {
    // Use INSERT OR REPLACE (or UPSERT) to handle both new and existing roles
    const sql = `
      INSERT INTO rates (role, rate, unit) VALUES (?, ?, ?)
      ON CONFLICT(role) DO UPDATE SET rate=excluded.rate, unit=excluded.unit
      RETURNING id, role, rate, unit;
    `;
    db.get(sql, [role, parseFloat(rate), unit], function(err, row) {
      if (err) {
        console.error('Error saving rate:', err);
        reject(err);
      } else {
        console.log('Rate saved/updated:', row);
        resolve(row); // Returns the inserted/updated row
      }
    });
  });
});

ipcMain.handle('delete-rate', async (event, rateId) => {
  return new Promise((resolve, reject) => {
    db.run("DELETE FROM rates WHERE id = ?", [rateId], function(err) {
      if (err) {
        console.error('Error deleting rate:', err);
        reject(err);
      } else {
        resolve({ success: this.changes > 0, id: rateId });
      }
    });
  });
});
// --- End IPC Handlers for Rates ---

// --- IPC Handlers for Projects ---
ipcMain.handle('get-projects', async () => {
  return new Promise((resolve, reject) => {
    db.all("SELECT id, name, description, createdAt FROM projects ORDER BY name", [], (err, rows) => {
      if (err) reject(err); else resolve(rows);
    });
  });
});

ipcMain.handle('save-project', async (event, projectData) => { // { id?, name, description }
  return new Promise((resolve, reject) => {
    if (projectData.id) { // Update existing
      const sql = "UPDATE projects SET name = ?, description = ? WHERE id = ? RETURNING *";
      db.get(sql, [projectData.name, projectData.description, projectData.id], (err, row) => {
        if (err) reject(err); else resolve(row);
      });
    } else { // Insert new
      const sql = "INSERT INTO projects (name, description) VALUES (?, ?) RETURNING *";
      db.get(sql, [projectData.name, projectData.description], (err, row) => {
        if (err) reject(err); else resolve(row);
      });
    }
  });
});

ipcMain.handle('delete-project', async (event, projectId) => {
  return new Promise((resolve, reject) => {
    db.run("DELETE FROM projects WHERE id = ?", [projectId], function(err) {
      if (err) reject(err); else resolve({ success: this.changes > 0, id: projectId });
    });
  });
});

// --- IPC Handlers for Tasks ---
ipcMain.handle('get-tasks-for-project', async (event, projectId) => {
  return new Promise((resolve, reject) => {
    db.all("SELECT id, projectId, name, description, efforts, travelCost, materialsCost, sequence FROM tasks WHERE projectId = ? ORDER BY sequence, createdAt", [projectId], (err, rows) => {
      if (err) {
        reject(err);
      } else {
        // Parse efforts JSON string into an object for each task
        const tasks = rows.map(task => ({
          ...task,
          efforts: task.efforts ? JSON.parse(task.efforts) : {}
        }));
        resolve(tasks);
      }
    });
  });
});

ipcMain.handle('save-task', async (event, taskData) => {
  // taskData = { id?, projectId, name, description, efforts: {}, travelCost, materialsCost, sequence }
  return new Promise((resolve, reject) => {
    const effortsJSON = JSON.stringify(taskData.efforts || {});
    if (taskData.id) { // Update
      const sql = `UPDATE tasks SET name = ?, description = ?, efforts = ?, travelCost = ?, materialsCost = ?, sequence = ?
                   WHERE id = ? AND projectId = ? RETURNING *`;
      db.get(sql, [taskData.name, taskData.description, effortsJSON, taskData.travelCost, taskData.materialsCost, taskData.sequence, taskData.id, taskData.projectId], (err, row) => {
        if (err) reject(err);
        else resolve({ ...row, efforts: JSON.parse(row.efforts || '{}') });
      });
    } else { // Insert
      const sql = `INSERT INTO tasks (projectId, name, description, efforts, travelCost, materialsCost, sequence)
                   VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING *`;
      db.get(sql, [taskData.projectId, taskData.name, taskData.description, effortsJSON, taskData.travelCost, taskData.materialsCost, taskData.sequence], (err, row) => {
        if (err) reject(err);
        else resolve({ ...row, efforts: JSON.parse(row.efforts || '{}') });
      });
    }
  });
});

ipcMain.handle('delete-task', async (event, taskId) => {
  return new Promise((resolve, reject) => {
    db.run("DELETE FROM tasks WHERE id = ?", [taskId], function(err) {
      if (err) reject(err); else resolve({ success: this.changes > 0, id: taskId });
    });
  });
});

// It might also be useful to have a way to reorder tasks
ipcMain.handle('update-task-sequence', async (event, tasksToUpdate) => {
  // tasksToUpdate is an array of { id: taskId, sequence: newSequence }
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run('BEGIN TRANSACTION');
      let completed = 0;
      tasksToUpdate.forEach(task => {
        db.run("UPDATE tasks SET sequence = ? WHERE id = ?", [task.sequence, task.id], function(err) {
          if (err) {
            db.run('ROLLBACK');
            reject(err);
            return; // Exit early on error
          }
          completed++;
          if (completed === tasksToUpdate.length) {
            db.run('COMMIT');
            resolve({ success: true });
          }
        });
      });
      if (tasksToUpdate.length === 0) { // Handle empty array case
        db.run('COMMIT'); // Or ROLLBACK, depending on desired behavior
        resolve({success: true});
      }
    });
  });
});
// --- End IPC Handlers for Tasks ---