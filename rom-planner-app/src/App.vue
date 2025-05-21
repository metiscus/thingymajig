<template>
  <div id="app-container">
    <header class="app-header">
      <h1>Rough Order of Magnitude (ROM) Planner</h1>
      <nav class="main-navigation">
        <button 
          @click="setActiveView('projectWorkflow')" 
          :class="{ active: activeView === 'projectWorkflow' }">
          <i class="fas fa-tasks"></i> Projects & Tasks
        </button>
        <button 
          @click="setActiveView('ratesManagement')" 
          :class="{ active: activeView === 'ratesManagement' }">
          <i class="fas fa-dollar-sign"></i> Manage Rates
        </button>
      </nav>
    </header>

    <div class="main-layout">
      <aside class="sidebar" v-if="activeView === 'projectWorkflow'">
        <div class="sidebar-section">
          <ProjectManager />
        </div>
      </aside>
      
      <main class="content-area">
        <template v-if="activeView === 'projectWorkflow'">
          <!-- ProjectDetailsEditor will show if a project is selected OR if adding a new one -->
          <ProjectDetailsEditor v-if="projectsStore.currentProject || projectsStore.isEditingNewProject" />

          <div v-if="!projectsStore.currentProject && !projectsStore.isEditingNewProject" class="placeholder-content">
            <h2>Project Dashboard</h2>
            <p>Select a project from the list on the left, or create a new one to get started.</p>
          </div>
          
          <!-- Show summary, tasks, materials only if a project is truly selected (not in new mode without save) -->
          <div v-if="projectsStore.currentProject && projectsStore.currentProject.id">
            <ProjectSummary />
            <TaskManager />
            <MaterialManager />
          </div>
        </template>
        
        <template v-else-if="activeView === 'ratesManagement'">
          <RatesManager />
        </template>
      </main>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useProjectsStore } from './stores/projectsStore';
import RatesManager from './components/RatesManager.vue';
import ProjectManager from './components/ProjectManager.vue';
import ProjectDetailsEditor from './components/ProjectDetailsEditor.vue'; // New
import TaskManager from './components/TaskManager.vue';
import MaterialManager from './components/MaterialManager.vue';
import ProjectSummary from './components/ProjectSummary.vue';

const projectsStore = useProjectsStore();
const activeView = ref('projectWorkflow'); 

const setActiveView = (viewName) => {
  activeView.value = viewName;
  if (viewName !== 'projectWorkflow') {
      // If navigating away from project view, clear new project state if not saved
      if(projectsStore.isEditingNewProject) {
          projectsStore.cancelNewProjectEdit();
      }
  }
};
</script>

<style>
/* Global styles (from previous response, ensure they are complete) */
body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  margin: 0;
  background-color: #f4f7f9;
  color: #333;
  font-size: 15px;
}

#app-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
}

.app-header {
  background-color: #35495E; 
  color: white;
  padding: 10px 25px; 
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  display: flex;
  flex-direction: column; 
}

.app-header h1 {
  margin: 0 0 10px 0; 
  font-size: 1.4em; 
}

.main-navigation {
  display: flex;
  gap: 5px; 
}

.main-navigation button {
  background-color: transparent;
  color: #bdc3c7; 
  border: 1px solid transparent; 
  padding: 8px 15px;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.2s ease, color 0.2s ease;
  font-size: 0.9em;
}

.main-navigation button:hover {
  background-color: rgba(255, 255, 255, 0.1);
  color: #ecf0f1; 
}

.main-navigation button.active {
  background-color: #42b983; 
  color: white;
  font-weight: 600;
}
.main-navigation button i {
  margin-right: 6px;
}


.main-layout {
  display: flex;
  flex-grow: 1;
  overflow: hidden; 
}

.sidebar {
  width: 320px; /* Slightly narrower sidebar */
  min-width: 280px;
  background-color: #ffffff;
  border-right: 1px solid #e0e0e0;
  padding: 15px; 
  overflow-y: auto; 
  display: flex;
  flex-direction: column;
  gap: 15px; 
}

.sidebar-section {
  border: 1px solid #ddd;
  border-radius: 5px;
  padding: 15px;
  background-color: #fdfdfd;
}
.sidebar-section > h3 { /* Target direct h3 */
  margin-top: 0;
  color: #42b983; 
  font-size: 1.1em; /* Adjusted size */
  padding-bottom: 8px;
  border-bottom: 1px solid #eee;
  margin-bottom: 12px;
}


.content-area {
  flex-grow: 1;
  padding: 20px;
  overflow-y: auto; 
  display: flex;
  flex-direction: column;
  gap: 20px;
}
.content-area > .rates-manager {
  flex-grow: 1; 
}


.placeholder-content {
  text-align: center;
  margin-top: 50px;
  color: #777;
}
.placeholder-content h2 {
  color: #35495E;
  font-size: 1.6em;
}

.component-section {
  background-color: #fff;
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.05);
  margin-bottom: 0; 
}
.component-section > h3, .component-section > h2 { 
  margin-top: 0;
  border-bottom: 1px solid #eee;
  padding-bottom: 10px;
  margin-bottom: 15px;
  color: #35495E;
  font-size: 1.25em;
}

table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 15px;
}
th, td {
  border: 1px solid #e0e0e0;
  padding: 10px 12px; 
  text-align: left;
  vertical-align: middle;
  font-size: 0.95em; 
}
th {
  background-color: #f8f9fa;
  font-weight: 600;
  color: #495057;
}
tr:nth-child(even) {
  background-color: #fdfdfd;
}
tr:hover {
    background-color: #f1f1f1;
}

button {
  padding: 8px 12px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9em;
  transition: background-color 0.2s ease;
}
button.primary { background-color: #42b983; color: white; }
button.primary:hover { background-color: #3aa873; }
button.secondary { background-color: #6c757d; color: white; }
button.secondary:hover { background-color: #5a6268; }
button.danger { background-color: #dc3545; color: white; }
button.danger:hover { background-color: #c82333; }
button:disabled {
  background-color: #e9ecef;
  color: #6c757d;
  cursor: not-allowed;
}
button + button {
  margin-left: 8px;
}

input[type="text"], input[type="number"], input[type="date"], select, textarea { /* Added textarea */
  padding: 8px;
  border: 1px solid #ced4da;
  border-radius: 4px;
  box-sizing: border-box;
  width: 100%; 
  font-size: 0.95em;
}
textarea {
  min-height: 60px;
  resize: vertical;
}


input[type="number"]::-webkit-outer-spin-button,
input[type="number"]::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
input[type="number"] {
  -moz-appearance: textfield; 
}


form div { margin-bottom: 10px; }
form label { display: block; margin-bottom: 5px; font-weight: 500; }

.error-message { color: #dc3545; background-color: #f8d7da; border:1px solid #f5c6cb; padding: 10px; border-radius: 4px; margin-bottom: 10px; }
.loading-message { color: #007bff; margin: 10px 0; }

.editable-table td input[type="text"],
.editable-table td input[type="number"],
.editable-table td select {
  padding: 6px 8px; margin: -6px -8px; 
  border: 1px solid #3498db; font-size: inherit; 
  height: calc(100% + 12px); 
  width: calc(100% + 16px); 
  box-sizing: border-box;
  border-radius: 0; 
}
.editable-table .editing-row { background-color: #e6f7ff !important; }
.editable-table .actions-cell { white-space: nowrap; text-align: right; }
.editable-table .actions-cell button { margin-left: 4px; }

.fas {
  margin-right: 5px;
}
</style>