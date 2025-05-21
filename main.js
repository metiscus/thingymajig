const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('node:path');
const sqlite3 = require('sqlite3').verbose();
const ExcelJS = require('exceljs');
const fs = require('node:fs'); // Use fs.promises for async file operations if preferred

// Database connection (global for simplicity in this example)
let db;

function createDbConnection() {
    // Determine a persistent location for the database
    // app.getPath('userData') ensures it's stored in a standard OS-specific location
    const appDataPath = app.getPath('userData');
    const dbDirPath = path.join(appDataPath, 'database');
    
    // Ensure the database directory exists
    if (!fs.existsSync(dbDirPath)) {
        fs.mkdirSync(dbDirPath, { recursive: true });
    }
    const dbPath = path.join(dbDirPath, 'rom_planner.db');
    console.log(`Database path: ${dbPath}`);

    db = new sqlite3.Database(dbPath, (err) => {
        if (err) {
            console.error('Error opening database:', err.message);
        } else {
            console.log('Connected to the SQLite database.');
            
            // Create 'rates' table if it doesn't exist
            db.run(`
                CREATE TABLE IF NOT EXISTS rates (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    role TEXT UNIQUE NOT NULL,
                    daily_rate REAL NOT NULL
                )
            `, (err) => {
                if (err) console.error("Error creating rates table:", err.message);
            });

            // Create 'tasks' table if it doesn't exist
            db.run(`
                CREATE TABLE IF NOT EXISTS tasks (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    project_name TEXT,
                    task TEXT NOT NULL,
                    eng REAL DEFAULT 0,
                    art_unreal REAL DEFAULT 0,
                    sys_eng REAL DEFAULT 0,
                    qa REAL DEFAULT 0,
                    pm REAL DEFAULT 0,
                    doc REAL DEFAULT 0,
                    travel REAL DEFAULT 0,
                    materials REAL DEFAULT 0
                )
            `, (err) => {
                if (err) console.error("Error creating tasks table:", err.message);
                
                // Insert default rates if the rates table is new and empty
                db.get("SELECT COUNT(*) as count FROM rates", (err, row) => {
                    if (err) return console.error(err.message);
                    if (row.count === 0) {
                        const defaultRates = [
                            { role: 'Eng', daily_rate: 800 },
                            { role: 'Art / Unreal', daily_rate: 700 },
                            { role: 'Sys. Eng', daily_rate: 900 },
                            { role: 'QA', daily_rate: 600 },
                            { role: 'PM', daily_rate: 850 },
                            { role: 'Doc', daily_rate: 650 }
                        ];
                        const stmt = db.prepare("INSERT INTO rates (role, daily_rate) VALUES (?, ?)");
                        defaultRates.forEach(rate => stmt.run(rate.role, rate.daily_rate));
                        stmt.finalize((err) => {
                            if (err) console.error("Error inserting default rates:", err.message);
                            else console.log("Default rates inserted.");
                        });
                    }
                });
            });
        }
    });
}

function createWindow() {
    const win = new BrowserWindow({
        width: 1200,
        height: 800,
        minWidth: 1000,
        minHeight: 600,
        webPreferences: {
            // Path to your preload script
            preload: path.join(__dirname, 'preload.js'),
            // Keep contextIsolation and nodeIntegration set to recommended secure values
            contextIsolation: true,
            nodeIntegration: false,
        },
    });

    // In production, load the built React app from 'dist' folder
    // In development, load the Vite dev server
    if (app.isPackaged) {
        win.loadFile(path.join(__dirname, 'dist', 'index.html'));
    } else {
        win.loadURL('http://localhost:5173');
        win.webContents.openDevTools(); // Open DevTools in dev mode
    }
}

// App ready event listener
app.whenReady().then(() => {
    createDbConnection(); // Connect to SQLite when app is ready
    createWindow(); // Create the main browser window

    // On macOS, re-create a window when the dock icon is clicked and no windows are open
    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

// Quit when all windows are closed, except on macOS where apps stay active in the menu bar
app.on('window-all-closed', () => {
    if (db) {
        db.close((err) => {
            if (err) {
                console.error('Error closing database:', err.message);
            } else {
                console.log('Closed the SQLite database connection.');
            }
        });
    }
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// --- IPC Handlers for Database Operations ---

// Get all rates
ipcMain.handle('get-rates', () => {
    return new Promise((resolve, reject) => {
        db.all("SELECT * FROM rates", (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
});

// Update a specific rate
ipcMain.handle('update-rate', (event, id, dailyRate) => {
    return new Promise((resolve, reject) => {
        db.run("UPDATE rates SET daily_rate = ? WHERE id = ?", [dailyRate, id], function(err) {
            if (err) reject(err);
            else resolve(this.changes); // Returns number of rows changed
        });
    });
});

// Get all tasks
ipcMain.handle('get-tasks', () => {
    return new Promise((resolve, reject) => {
        db.all("SELECT * FROM tasks ORDER BY id", (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
});

// Add a new task
ipcMain.handle('add-task', (event, task) => {
    return new Promise((resolve, reject) => {
        // Ensure all numeric fields are actual numbers, even if they come as strings from input
        const parsedTask = {
            projectName: task.projectName || '', // Allow empty project name
            taskName: task.taskName,
            eng: parseFloat(task.eng) || 0,
            artUnreal: parseFloat(task.artUnreal) || 0,
            sysEng: parseFloat(task.sysEng) || 0,
            qa: parseFloat(task.qa) || 0,
            pm: parseFloat(task.pm) || 0,
            doc: parseFloat(task.doc) || 0,
            travel: parseFloat(task.travel) || 0,
            materials: parseFloat(task.materials) || 0,
        };

        const { projectName, taskName, eng, artUnreal, sysEng, qa, pm, doc, travel, materials } = parsedTask;

        db.run(`INSERT INTO tasks (project_name, task, eng, art_unreal, sys_eng, qa, pm, doc, travel, materials) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [projectName, taskName, eng, artUnreal, sysEng, qa, pm, doc, travel, materials],
            function(err) {
                if (err) reject(err);
                // Return the new task with its ID
                else resolve({ id: this.lastID, project_name: projectName, task: taskName, eng, art_unreal: artUnreal, sys_eng: sysEng, qa, pm, doc, travel, materials });
            }
        );
    });
});

// Update an existing task
ipcMain.handle('update-task', (event, task) => {
    return new Promise((resolve, reject) => {
        const parsedTask = { // Ensure all numeric fields are actual numbers
            id: task.id,
            projectName: task.projectName || '',
            taskName: task.taskName,
            eng: parseFloat(task.eng) || 0,
            artUnreal: parseFloat(task.artUnreal) || 0,
            sysEng: parseFloat(task.sysEng) || 0,
            qa: parseFloat(task.qa) || 0,
            pm: parseFloat(task.pm) || 0,
            doc: parseFloat(task.doc) || 0,
            travel: parseFloat(task.travel) || 0,
            materials: parseFloat(task.materials) || 0,
        };

        const { id, projectName, taskName, eng, artUnreal, sysEng, qa, pm, doc, travel, materials } = parsedTask;

        db.run(`UPDATE tasks SET project_name = ?, task = ?, eng = ?, art_unreal = ?, sys_eng = ?, qa = ?, pm = ?, doc = ?, travel = ?, materials = ? WHERE id = ?`,
            [projectName, taskName, eng, artUnreal, sysEng, qa, pm, doc, travel, materials, id],
            function(err) {
                if (err) reject(err);
                else resolve(this.changes);
            }
        );
    });
});

// Delete a task
ipcMain.handle('delete-task', (event, id) => {
    return new Promise((resolve, reject) => {
        db.run("DELETE FROM tasks WHERE id = ?", [id], function(err) {
            if (err) reject(err);
            else resolve(this.changes);
        });
    });
});

// --- Excel Export Functionality ---
ipcMain.handle('export-to-excel', async () => {
    try {
        // Show save dialog to let user choose file location and name
        const result = await dialog.showSaveDialog(BrowserWindow.getFocusedWindow(), {
            title: 'Save ROM Plan Data',
            defaultPath: `rom_plan_${new Date().toISOString().slice(0, 10)}.xlsx`, // e.g., rom_plan_2023-12-20.xlsx
            filters: [{ name: 'Excel Files', extensions: ['xlsx'] }]
        });

        if (result.canceled || !result.filePath) {
            return { success: false, message: 'Export cancelled by user.' };
        }

        const filePath = result.filePath;

        // Fetch all tasks from the database
        const tasks = await new Promise((resolve, reject) => {
            db.all(`SELECT project_name, task, eng, art_unreal, sys_eng, qa, pm, doc, travel, materials FROM tasks ORDER BY id`, (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });

        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('ROM Plan Data');

        // Define columns for the Excel sheet
        // These match the database column names and the desired output headers
        sheet.columns = [
            { header: 'Project Name', key: 'project_name', width: 25 },
            { header: 'Task', key: 'task', width: 45 },
            { header: 'Eng (Days)', key: 'eng', width: 15 },
            { header: 'Art / Unreal (Days)', key: 'art_unreal', width: 20 },
            { header: 'Sys. Eng (Days)', key: 'sys_eng', width: 18 },
            { header: 'QA (Days)', key: 'qa', width: 12 },
            { header: 'PM (Days)', key: 'pm', width: 12 },
            { header: 'Doc (Days)', key: 'doc', width: 12 },
            { header: 'Travel ($)', key: 'travel', width: 15 },
            { header: 'Materials ($)', key: 'materials', width: 15 }
        ];

        // Add rows to the worksheet
        tasks.forEach(task => {
            sheet.addRow(task);
        });

        // Write the workbook to the chosen file path
        await workbook.xlsx.writeFile(filePath);

        return { success: true, message: `Data successfully exported to:\n${filePath}` };

    } catch (error) {
        console.error('Error during Excel export:', error);
        return { success: false, message: `Failed to export data: ${error.message}. Check console for details.` };
    }
});


// --- Calculations for UI Display ---
// This function fetches data and performs calculations client-side for displaying totals
ipcMain.handle('calculate-totals', async () => {
    try {
        const tasks = await new Promise((resolve, reject) => {
            db.all("SELECT eng, art_unreal, sys_eng, qa, pm, doc, travel, materials FROM tasks", (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });

        const rates = await new Promise((resolve, reject) => {
            db.all("SELECT role, daily_rate FROM rates", (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });

        // Create a map for easy rate lookup, normalizing role names to match DB columns
        const rateMap = rates.reduce((acc, rate) => {
            // Converts 'Art / Unreal' to 'art_unreal', 'Sys. Eng' to 'sys_eng', etc.
            const normalizedRole = rate.role.replace(/ /g, '_').replace(/[\W_]+/g, '_').toLowerCase();
            acc[normalizedRole] = rate.daily_rate;
            return acc;
        }, {});

        const totalDays = { eng: 0, art_unreal: 0, sys_eng: 0, qa: 0, pm: 0, doc: 0 };
        let totalDirectCosts = 0; // For Travel + Materials

        tasks.forEach(task => {
            totalDays.eng += task.eng;
            totalDays.art_unreal += task.art_unreal;
            totalDays.sys_eng += task.sys_eng;
            totalDays.qa += task.qa;
            totalDays.pm += task.pm;
            totalDays.doc += task.doc;
            totalDirectCosts += task.travel + task.materials;
        });

        const totalDollars = {};
        let grandTotalDollars = totalDirectCosts; // Start with direct costs

        // Calculate dollar totals for each role using the rate map
        for (const roleKey in totalDays) {
            // Convert normalized key back to a display name for the UI summary
            const displayRoleName = rates.find(r => r.role.replace(/ /g, '_').replace(/[\W_]+/g, '_').toLowerCase() === roleKey)?.role || roleKey;
            const rate = rateMap[roleKey] || 0; // Get rate, default to 0 if not found
            const dollarsForRole = totalDays[roleKey] * rate;
            totalDollars[displayRoleName] = dollarsForRole;
            grandTotalDollars += dollarsForRole;
        }

        return {
            totalDays,
            totalDollars,
            totalDirectCosts,
            grandTotalDollars
        };

    } catch (error) {
        console.error("Error calculating totals:", error);
        return { error: error.message };
    }
});