const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const ExcelJS = require('exceljs'); // Import exceljs
const fs = require('fs'); // Import fs for file operations

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

// --- New IPC Handler for Exporting Project Data ---
ipcMain.handle('export-project-to-excel', async (event, projectId) => {
  const workbook = new ExcelJS.Workbook();
  const options = {
    title: 'Save Project Export',
    defaultPath: `Project_Export_${Date.now()}.xlsx`,
    filters: [
      { name: 'Excel Files', extensions: ['xlsx'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  };

  const { filePath } = await dialog.showSaveDialog(BrowserWindow.getFocusedWindow(), options);

  if (!filePath) {
    return { success: false, error: 'Save dialog cancelled.' };
  }

  try {
    // 1. Fetch all necessary data
    const project = await new Promise((resolve, reject) => {
      db.get("SELECT id, name, description, riskPercentage FROM projects WHERE id = ?", [projectId], (err, row) => {
        if (err) reject(err); else resolve(row);
      });
    });

    if (!project) {
      throw new Error('Project not found.');
    }

    const rates = await new Promise((resolve, reject) => {
      db.all("SELECT id, role, rate, unit FROM rates ORDER BY role", [], (err, rows) => {
        if (err) reject(err); else resolve(rows);
      });
    });

    const tasks = await new Promise((resolve, reject) => {
      db.all("SELECT id, projectId, name, description, efforts, travelCost, materialsCost FROM tasks WHERE projectId = ? ORDER BY sequence, createdAt", [projectId], (err, rows) => {
        if (err) reject(err);
        else {
          const parsedTasks = rows.map(task => ({
            ...task,
            efforts: task.efforts ? JSON.parse(task.efforts) : {}
          }));
          resolve(parsedTasks);
        }
      });
    });

    const materialItems = await new Promise((resolve, reject) => {
      db.all("SELECT id, projectId, lineItem, vendor, category, unitPrice, quantity, comment FROM material_items WHERE projectId = ? ORDER BY createdAt", [projectId], (err, rows) => {
        if (err) reject(err); else resolve(rows);
      });
    });

    // Helper to calculate role rate
    const getRoleRate = (role) => {
      const rateObj = rates.find(r => r.role === role);
      if (!rateObj) return 0;
      return rateObj.unit === 'hour' ? Number(rateObj.rate || 0) * 8 : Number(rateObj.rate || 0);
    };

    // Helper to calculate task total cost
    const calculateTaskTotalCost = (task) => {
      let cost = 0;
      for (const role in task.efforts) {
        cost += (Number(task.efforts[role] || 0)) * getRoleRate(role);
      }
      cost += Number(task.travelCost || 0);
      cost += Number(task.materialsCost || 0);
      return cost;
    };

    // Helper to calculate task total days
    const calculateTaskTotalDays = (task) => {
      return Object.values(task.efforts || {}).reduce((sum, effort) => sum + Number(effort || 0), 0);
    };

    // Get all unique roles for headers
    const allRoles = [...new Set(rates.map(r => r.role))].sort();

    // 2. Summary Sheet
    const summarySheet = workbook.addWorksheet('Summary');
    summarySheet.columns = [{ width: 30 }, { width: 40 }];

    summarySheet.addRow(['Project Name:', project.name]).font = { bold: true };
    summarySheet.addRow(['Project Description:', project.description]);
    summarySheet.addRow([]);

    let totalLaborCost = 0;
    const totalDaysPerRole = {};
    allRoles.forEach(role => totalDaysPerRole[role] = 0);

    tasks.forEach(task => {
      for (const role in task.efforts) {
        totalDaysPerRole[role] = (totalDaysPerRole[role] || 0) + Number(task.efforts[role] || 0);
      }
    });

    const totalCostPerRole = {};
    for (const role in totalDaysPerRole) {
        const rate = getRoleRate(role);
        totalCostPerRole[role] = totalDaysPerRole[role] * rate;
        totalLaborCost += totalCostPerRole[role];
    }
    
    const totalTaskTravelCost = tasks.reduce((sum, task) => sum + Number(task.travelCost || 0), 0);
    const totalTaskIncidentalMaterials = tasks.reduce((sum, task) => sum + Number(task.materialsCost || 0), 0);
    const totalDetailedMaterialExpenses = materialItems.reduce((sum, item) => sum + (Number(item.unitPrice || 0) * Number(item.quantity || 0)), 0);

    const subtotalBeforeRisk = totalLaborCost + totalTaskTravelCost + totalTaskIncidentalMaterials + totalDetailedMaterialExpenses;
    const riskPercentage = Number(project.riskPercentage || 0);
    const riskAmount = subtotalBeforeRisk * (riskPercentage / 100);
    const grandTotalWithRisk = subtotalBeforeRisk + riskAmount;

    summarySheet.addRow(['Total Labor Cost:', totalLaborCost]).numFmt = '$#,##0.00';
    summarySheet.addRow(['Total Task Travel Cost:', totalTaskTravelCost]).numFmt = '$#,##0.00';
    summarySheet.addRow(['Total Task Incidental Materials:', totalTaskIncidentalMaterials]).numFmt = '$#,##0.00';
    summarySheet.addRow(['Total Detailed Material Expenses:', totalDetailedMaterialExpenses]).numFmt = '$#,##0.00';
    summarySheet.addRow([]);
    summarySheet.addRow(['SUBTOTAL (Before Risk):', subtotalBeforeRisk]).font = { bold: true };
    summarySheet.lastRow.getCell(2).numFmt = '$#,##0.00';
    summarySheet.addRow([`Risk (${riskPercentage}%):`, riskAmount]);
    summarySheet.lastRow.getCell(2).numFmt = '$#,##0.00';
    summarySheet.addRow([]);
    summarySheet.addRow(['PROJECT GRAND TOTAL (incl. Risk):', grandTotalWithRisk]).font = { bold: true, size: 12 };
    summarySheet.lastRow.getCell(2).numFmt = '$#,##0.00';

    // Apply styles to summary
    summarySheet.eachRow({ includeEmpty: false }, function(row, rowNumber) {
        row.eachCell({ includeEmpty: true }, function(cell, colNumber) {
            cell.alignment = { vertical: 'top', horizontal: 'left' };
            if (rowNumber === 1 || rowNumber === 2) {
                cell.font = { bold: true };
            }
        });
        if (row.values[1] && row.values[1].includes('GRAND TOTAL')) {
             row.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FF35495E' } // Match Vue dark blue
            };
            row.font = { color: { argb: 'FFFFFFFF' }, bold: true, size: 12 };
        }
    });


    // 3. Labor Details Sheet
    const laborSheet = workbook.addWorksheet('Labor Details');
    const laborHeaders = ['Task Name', 'Description', ...allRoles.map(role => `${role} (Days)`), 'Travel Cost', 'Materials Cost', 'Total Task Days', 'Total Task Cost'];
    laborSheet.addRow(laborHeaders).font = { bold: true };

    laborSheet.columns = [
        { width: 30 }, // Task Name
        { width: 40 }, // Description
        ...allRoles.map(() => ({ width: 15, alignment: { horizontal: 'center' } })), // Roles
        { width: 15, style: { numFmt: '$#,##0.00' } }, // Travel Cost
        { width: 15, style: { numFmt: '$#,##0.00' } }, // Materials Cost
        { width: 15, alignment: { horizontal: 'center' } }, // Total Task Days
        { width: 18, style: { numFmt: '$#,##0.00' } }  // Total Task Cost
    ];

    tasks.forEach(task => {
      const rowData = [
        task.name,
        task.description,
        ...allRoles.map(role => Number(task.efforts[role] || 0)),
        Number(task.travelCost || 0),
        Number(task.materialsCost || 0),
        calculateTaskTotalDays(task),
        calculateTaskTotalCost(task)
      ];
      laborSheet.addRow(rowData);
    });

    // Add totals to labor sheet footer
    const laborTotalsRow = [];
    laborTotalsRow[0] = 'Project Totals:';
    laborTotalsRow[1] = ''; // Description column
    let currentColumn = 2;
    for (const role of allRoles) {
      laborTotalsRow[currentColumn++] = totalDaysPerRole[role];
    }
    laborTotalsRow[currentColumn++] = totalTaskTravelCost;
    laborTotalsRow[currentColumn++] = totalTaskIncidentalMaterials;
    laborTotalsRow[currentColumn++] = tasks.reduce((sum, task) => sum + calculateTaskTotalDays(task), 0); // Grand total days
    laborTotalsRow[currentColumn++] = totalLaborCost + totalTaskTravelCost + totalTaskIncidentalMaterials; // Grand total cost for tasks only
    
    laborSheet.addRow(laborTotalsRow).font = { bold: true };
    // Apply currency format to relevant total cells
    laborSheet.lastRow.getCell(currentColumn - 3).numFmt = '$#,##0.00'; // Travel cost total
    laborSheet.lastRow.getCell(currentColumn - 2).numFmt = '$#,##0.00'; // Materials cost total
    laborSheet.lastRow.getCell(currentColumn - 1).numFmt = '$#,##0.00'; // Grand total cost for tasks only

    const costPerRoleRow = [];
    costPerRoleRow[0] = 'Cost per Role:';
    costPerRoleRow[1] = '';
    currentColumn = 2;
     for (const role of allRoles) {
      costPerRoleRow[currentColumn++] = totalCostPerRole[role];
    }
    laborSheet.addRow(costPerRoleRow);
    for (let i = 2; i < 2 + allRoles.length; i++) { // Apply currency format to role costs
        laborSheet.lastRow.getCell(i).numFmt = '$#,##0.00';
    }

    // 4. Rates Sheet
    const ratesSheet = workbook.addWorksheet('Rates');
    ratesSheet.columns = [
      { header: 'Role', key: 'role', width: 25 },
      { header: 'Rate', key: 'rate', width: 15, style: { numFmt: '$#,##0.00' } },
      { header: 'Unit', key: 'unit', width: 10 }
    ];
    ratesSheet.addRow(ratesSheet.columns.map(col => col.header)).font = { bold: true };
    rates.forEach(rate => {
      ratesSheet.addRow([rate.role, rate.rate, rate.unit]);
    });

    // 5. Materials Sheet
    const materialsSheet = workbook.addWorksheet('Materials');
    materialsSheet.columns = [
      { header: 'Line Item', key: 'lineItem', width: 30 },
      { header: 'Vendor', key: 'vendor', width: 20 },
      { header: 'Category', key: 'category', width: 15 },
      { header: 'Unit Price', key: 'unitPrice', width: 15, style: { numFmt: '$#,##0.00' } },
      { header: 'Quantity', key: 'quantity', width: 10 },
      { header: 'Subtotal', key: 'subtotal', width: 15, style: { numFmt: '$#,##0.00' } },
      { header: 'Comment', key: 'comment', width: 40 }
    ];
    materialsSheet.addRow(materialsSheet.columns.map(col => col.header)).font = { bold: true };
    materialItems.forEach(item => {
      materialsSheet.addRow([
        item.lineItem,
        item.vendor,
        item.category,
        Number(item.unitPrice || 0),
        Number(item.quantity || 0),
        Number(item.unitPrice || 0) * Number(item.quantity || 0),
        item.comment
      ]);
    });
    materialsSheet.addRow([]);
    materialsSheet.addRow(['Total Detailed Material Costs:', '', '', '', '', totalDetailedMaterialExpenses]).font = { bold: true };
    materialsSheet.lastRow.getCell(6).numFmt = '$#,##0.00';


    // Write to file
    await workbook.xlsx.writeFile(filePath);

    return { success: true, filePath: filePath };
  } catch (error) {
    console.error('Failed to export project to Excel:', error);
    return { success: false, error: error.message };
  }
});