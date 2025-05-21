<template>
  <div id="app-container">
    <aside class="sidebar">
      <div class="logo-container">
        <img src="../src/assets/vue.svg" alt="Vue Logo" class="logo vue-logo" />
        <img src="../public/vite.svg" alt="Vite Logo" class="logo vite-logo" />
        <h1 class="app-title">ROM Planner</h1>
      </div>

      <ProjectManager class="sidebar-section" />

      <div class="settings-section sidebar-section">
        <h3>Settings</h3>
        <ul class="settings-nav">
          <li :class="{ active: activeSettingView === 'rates' }" @click="activeSettingView = 'rates'">
            <i class="fas fa-dollar-sign"></i> Manage Rates
          </li>
          <li :class="{ active: activeSettingView === 'materials' }" @click="activeSettingView = 'materials'">
            <i class="fas fa-boxes"></i> Manage Global Materials
          </li>
        </ul>
      </div>

      <div class="footer-note">
        <p>Built with Vue, Electron & SQLite</p>
      </div>
    </aside>

    <main class="main-content">
      <div v-if="activeView === 'projects'">
        <ProjectDetailsEditor />
        <ProjectSummary />
        <TaskManager />
        <MaterialManager />
      </div>
      <div v-else-if="activeView === 'settings'">
        <RatesManager v-if="activeSettingView === 'rates'" />
        <GlobalMaterialManager v-if="activeSettingView === 'materials'" />
      </div>
      <div v-else class="welcome-message component-section">
        <h2>Welcome!</h2>
        <p>Select a project from the left sidebar to begin, or create a new one.</p>
        <p>Use the "Settings" section to define your labor rates and global material prices.</p>
      </div>
    </main>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue';
import ProjectManager from './components/ProjectManager.vue';
import ProjectDetailsEditor from './components/ProjectDetailsEditor.vue';
import ProjectSummary from './components/ProjectSummary.vue';
import TaskManager from './components/TaskManager.vue';
import MaterialManager from './components/MaterialManager.vue';
import RatesManager from './components/RatesManager.vue';
import GlobalMaterialManager from './components/GlobalMaterialManager.vue'; // Import the new component
import { useProjectsStore } from './stores/projectsStore';

const projectsStore = useProjectsStore();

// State to control which main view is active
const activeView = ref('none'); // 'none', 'projects', 'settings'
const activeSettingView = ref('rates'); // 'rates', 'materials'

// Watch for currentProject changes to switch to 'projects' view
watch(() => projectsStore.currentProject, (newProject) => {
  if (newProject && newProject.id) {
    activeView.value = 'projects';
  } else if (projectsStore.isEditingNewProject) {
    activeView.value = 'projects'; // Stay on projects view for new project form
  } else {
    activeView.value = 'none'; // No project selected
  }
}, { immediate: true });

// Watch for isEditingNewProject to keep 'projects' view active when adding
watch(() => projectsStore.isEditingNewProject, (isEditing) => {
  if (isEditing) {
    activeView.value = 'projects';
  }
});

// Watch for changes in activeSettingView to switch to 'settings' view
watch(activeSettingView, () => {
    activeView.value = 'settings';
});

// If no project selected and not in settings view, default to welcome
watch(activeView, (newView) => {
  if (newView === 'none' && !projectsStore.currentProject && !projectsStore.isEditingNewProject) {
    // This watch might be overly complex, simple init and then rely on user clicks
    // For now, let's keep initial activeView as 'none' and welcome will show if no project selected.
  }
}, { immediate: true });
</script>

<style>
/* Global Styles (unchanged, but included for context if you copy-paste the whole thing) */
:root {
  --color-primary: #42b983; /* Vue green */
  --color-primary-dark: #3aa873;
  --color-secondary: #f0f0f0;
  --color-secondary-dark: #e0e0e0;
  --color-danger: #dc3545;
  --color-danger-dark: #c82333;
  --color-background: #f8f8f8;
  --color-light-grey: #e9ecef;
  --color-mid-grey: #adb5bd;
  --color-dark-grey: #495057;
  --color-text: #2c3e50;
  --border-radius-base: 4px;
}

body {
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  margin: 0;
  padding: 0;
  background-color: var(--color-background);
  color: var(--color-text);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  font-size: 16px;
}

#app-container {
  display: flex;
  height: 100vh;
  overflow: hidden; /* Prevent main scrollbar on flex container */
}

.sidebar {
  width: 300px;
  background-color: white;
  border-right: 1px solid #e0e0e0;
  padding: 20px;
  box-shadow: 2px 0 5px rgba(0,0,0,0.05);
  display: flex;
  flex-direction: column;
  overflow-y: auto; /* Allow sidebar to scroll */
}

.logo-container {
  display: flex;
  align-items: center;
  margin-bottom: 25px;
  justify-content: center;
}
.logo {
  height: 36px;
  margin-right: 10px;
}
.app-title {
  font-size: 1.8em;
  color: var(--color-dark-grey);
  margin: 0;
  line-height: 1;
  font-weight: 600;
}

.sidebar-section {
  margin-bottom: 25px;
  background-color: #fcfcfc;
  border: 1px solid #f0f0f0;
  border-radius: var(--border-radius-base);
  padding: 15px;
}
.sidebar-section h3 {
  margin-top: 0;
  color: var(--color-dark-grey);
  font-size: 1.1em;
  border-bottom: 1px solid #eee;
  padding-bottom: 10px;
  margin-bottom: 15px;
}

.settings-nav {
  list-style: none;
  padding: 0;
}
.settings-nav li {
  padding: 8px 10px;
  cursor: pointer;
  border-radius: var(--border-radius-base);
  transition: background-color 0.2s ease;
  color: var(--color-dark-grey);
  font-size: 0.95em;
  display: flex;
  align-items: center;
}
.settings-nav li i {
  margin-right: 8px;
  width: 20px; /* fixed width for icon alignment */
  text-align: center;
}
.settings-nav li:hover {
  background-color: var(--color-light-grey);
}
.settings-nav li.active {
  background-color: var(--color-primary);
  color: white;
  font-weight: 500;
}
.settings-nav li.active i {
    color: white; /* Ensure icon color matches text */
}

.main-content {
  flex-grow: 1;
  padding: 20px;
  overflow-y: auto; /* Allow main content to scroll */
}

.component-section {
  background-color: white;
  border: 1px solid #e0e0e0;
  border-radius: var(--border-radius-base);
  padding: 20px;
  margin-bottom: 20px;
}
.component-section h3 {
  margin-top: 0;
  color: var(--color-dark-grey);
  font-size: 1.2em;
  border-bottom: 1px solid #eee;
  padding-bottom: 10px;
  margin-bottom: 20px;
}

/* General Button Styles */
button {
  background-color: var(--color-primary);
  color: white;
  border: none;
  border-radius: var(--border-radius-base);
  padding: 10px 20px;
  cursor: pointer;
  font-size: 1em;
  transition: background-color 0.2s ease, opacity 0.2s ease;
}
button:hover {
  background-color: var(--color-primary-dark);
}
button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
button.secondary {
  background-color: var(--color-secondary);
  color: var(--color-dark-grey);
  border: 1px solid var(--color-mid-grey);
}
button.secondary:hover {
  background-color: var(--color-secondary-dark);
}
button.danger {
  background-color: var(--color-danger);
  color: white;
}
button.danger:hover {
  background-color: var(--color-danger-dark);
}

/* Table styles */
table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 15px;
  font-size: 0.9em;
}
th, td {
  border: 1px solid #e0e0e0;
  padding: 10px 8px;
  text-align: left;
}
th {
  background-color: #f2f2f2;
  font-weight: 600;
  color: var(--color-dark-grey);
}
tr:nth-child(even) {
  background-color: #fdfdfd;
}
tr:hover {
  background-color: #f5f5f5;
}

.loading-message, .error-message, .welcome-message {
  padding: 15px;
  border-radius: var(--border-radius-base);
  margin-bottom: 15px;
}
.loading-message {
  background-color: #eef7ff;
  color: #2a6496;
  border: 1px solid #a8d5ff;
}
.error-message {
  background-color: #f8d7da;
  color: #721c24;
  border: 1px solid #f5c6cb;
}
.welcome-message {
  background-color: #f0fff4; /* Light green */
  color: #28a745; /* Green */
  border: 1px solid #d4edda; /* Light green border */
}

.footer-note {
  margin-top: auto; /* Pushes the footer to the bottom of the sidebar */
  text-align: center;
  font-size: 0.8em;
  color: #a0a0a0;
  padding-top: 20px;
  border-top: 1px solid #eee;
}
</style>