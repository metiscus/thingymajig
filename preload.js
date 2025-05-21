const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
    // Rates Management
    getRates: () => ipcRenderer.invoke('get-rates'),
    updateRate: (id, dailyRate) => ipcRenderer.invoke('update-rate', id, dailyRate),

    // Tasks Management
    getTasks: () => ipcRenderer.invoke('get-tasks'),
    addTask: (task) => ipcRenderer.invoke('add-task', task),
    updateTask: (task) => ipcRenderer.invoke('update-task', task),
    deleteTask: (id) => ipcRenderer.invoke('delete-task', id),

    // Calculations
    calculateTotals: () => ipcRenderer.invoke('calculate-totals'),

    // Export functionality
    exportToExcel: () => ipcRenderer.invoke('export-to-excel')
});