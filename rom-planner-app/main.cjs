      
// main.cjs
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const dbPath = app.isPackaged
  ? path.join(app.getPath('userData'), 'rom_planner.db')
  : path.join(__dirname, 'rom_planner.db');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Database opening error: ', err);
  } else {
    console.log(`Database opened successfully at ${dbPath}`);
    db.serialize(() => {
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

      db.run(`
        CREATE TABLE IF NOT EXISTS projects (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT UNIQUE NOT NULL,
          description TEXT,
          riskPercentage REAL DEFAULT 0, -- New field
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `, (err) => {
        if (err) console.error("Error creating/altering 'projects' table", err);
        else {
          console.log("'projects' table checked/created.");
          // Simple migration: Add column if it doesn't exist for older DBs
          db.get("PRAGMA table_info(projects)", (err, rows) => {
            if (err) return console.error("Error getting projects table info", err);
            const columns = Array.isArray(rows) ? rows.map(col => col.name) : Object.keys(rows || {});
            if (!columns.includes('riskPercentage')) {
              db.run("ALTER TABLE projects ADD COLUMN riskPercentage REAL DEFAULT 0", (alterErr) => {
                if (alterErr) console.error("Error adding riskPercentage column to projects", alterErr);
                else console.log("riskPercentage column added to projects table.");
              });
            }
          });
        }
      });

      db.run(`
        CREATE TABLE IF NOT EXISTS tasks (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          projectId INTEGER NOT NULL,
          name TEXT NOT NULL,
          description TEXT,
          efforts TEXT, 
          travelCost REAL DEFAULT 0,
          materialsCost REAL DEFAULT 0, 
          sequence INTEGER DEFAULT 0, 
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (projectId) REFERENCES projects(id) ON DELETE CASCADE
        )
      `, (err) => {
        if (err) console.error("Error creating 'tasks' table", err);
        else console.log("'tasks' table checked/created.");
      });

      db.run(`
        CREATE TABLE IF NOT EXISTS material_items (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          projectId INTEGER NOT NULL,
          lineItem TEXT NOT NULL,
          vendor TEXT,
          category TEXT,
          unitPrice REAL DEFAULT 0,
          quantity INTEGER DEFAULT 1,
          comment TEXT,
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (projectId) REFERENCES projects(id) ON DELETE CASCADE
        )
      `, (err) => {
        if (err) console.error("Error creating 'material_items' table", err);
        else console.log("'material_items' table checked/created.");
      });
    });
  }
});

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
  db.close((err) => { 
    if (err) {
      return console.error(err.message);
    }
    console.log('Database connection closed.');
  });
  if (process.platform !== 'darwin') app.quit();
});


// --- IPC Handlers for Rates (Unchanged) ---
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
        resolve(row);
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

// --- IPC Handlers for Projects (Updated) ---
ipcMain.handle('get-projects', async () => {
  return new Promise((resolve, reject) => {
    // Ensure riskPercentage is selected
    db.all("SELECT id, name, description, riskPercentage, createdAt FROM projects ORDER BY name", [], (err, rows) => {
      if (err) reject(err); else resolve(rows);
    });
  });
});

ipcMain.handle('save-project', async (event, projectData) => { 
  // projectData = { id?, name, description, riskPercentage }
  const { id, name, description, riskPercentage } = projectData;
  const risk = parseFloat(riskPercentage) || 0; // Ensure it's a number

  return new Promise((resolve, reject) => {
    if (id) { // Update existing
      const sql = "UPDATE projects SET name = ?, description = ?, riskPercentage = ? WHERE id = ? RETURNING *";
      db.get(sql, [name, description, risk, id], (err, row) => {
        if (err) reject(err); else resolve(row);
      });
    } else { // Insert new
      const sql = "INSERT INTO projects (name, description, riskPercentage) VALUES (?, ?, ?) RETURNING *";
      db.get(sql, [name, description, risk], (err, row) => {
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

// --- IPC Handlers for Tasks (Unchanged) ---
ipcMain.handle('get-tasks-for-project', async (event, projectId) => {
  return new Promise((resolve, reject) => {
    db.all("SELECT id, projectId, name, description, efforts, travelCost, materialsCost, sequence FROM tasks WHERE projectId = ? ORDER BY sequence, createdAt", [projectId], (err, rows) => {
      if (err) {
        reject(err);
      } else {
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
ipcMain.handle('update-task-sequence', async (event, tasksToUpdate) => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run('BEGIN TRANSACTION');
      let completed = 0;
      if (tasksToUpdate.length === 0) {
        db.run('COMMIT');
        resolve({success: true});
        return;
      }
      tasksToUpdate.forEach(task => {
        db.run("UPDATE tasks SET sequence = ? WHERE id = ?", [task.sequence, task.id], function(err) {
          if (err) {
            db.run('ROLLBACK');
            reject(err);
            return; 
          }
          completed++;
          if (completed === tasksToUpdate.length) {
            db.run('COMMIT');
            resolve({ success: true });
          }
        });
      });
    });
  });
});

// --- IPC Handlers for Material Items (Unchanged) ---
ipcMain.handle('get-material-items-for-project', async (event, projectId) => {
  return new Promise((resolve, reject) => {
    db.all("SELECT * FROM material_items WHERE projectId = ? ORDER BY createdAt", [projectId], (err, rows) => {
      if (err) {
        console.error('Error fetching material items:', err);
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
});
ipcMain.handle('save-material-item', async (event, itemData) => {
  return new Promise((resolve, reject) => {
    const { id, projectId, lineItem, vendor, category, unitPrice, quantity, comment } = itemData;
    if (id) { // Update
      const sql = `UPDATE material_items 
                   SET lineItem = ?, vendor = ?, category = ?, unitPrice = ?, quantity = ?, comment = ?
                   WHERE id = ? AND projectId = ? RETURNING *`;
      db.get(sql, [lineItem, vendor, category, parseFloat(unitPrice), parseInt(quantity), comment, id, projectId], (err, row) => {
        if (err) {
          console.error('Error updating material_item:', err);
          reject(err);
        } else resolve(row);
      });
    } else { // Insert
      const sql = `INSERT INTO material_items (projectId, lineItem, vendor, category, unitPrice, quantity, comment)
                   VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING *`;
      db.get(sql, [projectId, lineItem, vendor, category, parseFloat(unitPrice), parseInt(quantity), comment], (err, row) => {
        if (err) {
          console.error('Error inserting material_item:', err);
          reject(err);
        } else resolve(row);
      });
    }
  });
});
ipcMain.handle('delete-material-item', async (event, itemId) => {
  return new Promise((resolve, reject) => {
    db.run("DELETE FROM material_items WHERE id = ?", [itemId], function(err) {
      if (err) {
        console.error('Error deleting material_item:', err);
        reject(err);
      } else {
        resolve({ success: this.changes > 0, id: itemId });
      }
    });
  });
});