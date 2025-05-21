// preload.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {

  getRates: () => ipcRenderer.invoke('get-rates'),
  saveRate: (rateData) => ipcRenderer.invoke('save-rate', rateData),
  deleteRate: (rateId) => ipcRenderer.invoke('delete-rate', rateId),

  // Projects
  getProjects: () => ipcRenderer.invoke('get-projects'),
  saveProject: (projectData) => ipcRenderer.invoke('save-project', projectData),
  deleteProject: (projectId) => ipcRenderer.invoke('delete-project', projectId),
  exportProjectToExcel: (projectId) => ipcRenderer.invoke('export-project-to-excel', projectId), // New export handler

  // Tasks
  getTasksForProject: (projectId) => ipcRenderer.invoke('get-tasks-for-project', projectId),
  saveTask: (taskData) => ipcRenderer.invoke('save-task', taskData),
  deleteTask: (taskId) => ipcRenderer.invoke('delete-task', taskId),
  updateTaskSequence: (tasksToUpdate) => ipcRenderer.invoke('update-task-sequence', tasksToUpdate),

  // Material Items
  getMaterialItemsForProject: (projectId) => ipcRenderer.invoke('get-material-items-for-project', projectId),
  saveMaterialItem: (itemData) => ipcRenderer.invoke('save-material-item', itemData),
  deleteMaterialItem: (itemId) => ipcRenderer.invoke('delete-material-item', itemId),

});

console.log('Preload script loaded with electronAPI.');