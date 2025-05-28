<template>
  <div id="app-layout-wrapper">
    <!-- Router View for Login/Register (no sidebar, no header) -->
    <router-view v-if="!authStore.isAuthenticated"></router-view>

    <!-- Main Application Layout (with sidebar, header) -->
    <div v-else id="app-container">
      <header class="app-header">
        <div class="header-left">
          <img src="./assets/vue.svg" alt="Vue Logo" class="logo vue-logo" />
          <img src="./public/vite.svg" alt="Vite Logo" class="logo vite-logo" />
          <h1 class="app-title">ROM Planner</h1>
        </div>
        <nav class="header-nav">
          <span class="user-info">Logged in as: <strong>{{ authStore.user?.email }}</strong></span>
          <button @click="authStore.logout()" class="secondary small-btn logout-btn">
            <i class="fas fa-sign-out-alt"></i> Logout
          </button>
        </nav>
      </header>

      <div class="app-content-area">
        <aside class="sidebar">
          <ProjectManager class="sidebar-section" />

          <div class="settings-section sidebar-section">
            <h3>Settings</h3>
            <ul class="settings-nav">
              <li :class="{ active: $route.name === 'ManageRates' }" @click="goToSettings('rates')">
                <i class="fas fa-dollar-sign"></i> Manage Rates
              </li>
              <li :class="{ active: $route.name === 'ManageGlobalMaterials' }" @click="goToSettings('materials')">
                <i class="fas fa-boxes"></i> Manage Global Materials
              </li>
              <!-- Example for admin-only setting -->
              <li v-if="authStore.isAdmin" :class="{ active: $route.name === 'AdminDashboard' }" @click="goToSettings('admin')">
                <i class="fas fa-user-shield"></i> Admin Dashboard
              </li>
            </ul>
          </div>

          <div class="footer-note">
            <p>Built with Vue, FastAPI & PostgreSQL</p>
          </div>
        </aside>

        <main class="main-content">
          <!-- Main content router-view for projects, rates, materials managers -->
          <router-view name="mainContent"></router-view>

          <!-- Welcome message if no project selected AND not in settings view -->
          <div v-if="showWelcomeMessage" class="welcome-message component-section">
            <h2>Welcome!</h2>
            <p>Select a project from the left sidebar to begin, or create a new one.</p>
            <p>Use the "Settings" section to define your labor rates and global material prices.</p>
          </div>
        </main>
      </div>
    </div>
  </div>
</template>

<script setup>
import { watch, computed } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import ProjectManager from './components/ProjectManager.vue';
import { useProjectsStore } from './stores/projectsStore';
import { useAuthStore } from './stores/authStore';

const projectsStore = useProjectsStore();
const authStore = useAuthStore();

const router = useRouter();
const route = useRoute();

// Computed property to determine if the welcome message should be shown
const showWelcomeMessage = computed(() => {
  const isWelcome = (
    route.name === 'Home' && // Only show if current route is 'Home'
    !projectsStore.currentProject && // And no project is selected
    !projectsStore.isEditingNewProject // And not in new project mode
  );
  console.log('App.vue: showWelcomeMessage computed. Result:', isWelcome, 'route.name:', route.name, 'currentProject:', projectsStore.currentProject?.name, 'isEditingNewProject:', projectsStore.isEditingNewProject);
  return isWelcome;
});

// Function to navigate to settings views
const goToSettings = (setting) => {
  projectsStore.selectProject(null); // Clear selected project when going to settings
  if (setting === 'rates') {
    router.push({ name: 'ManageRates' });
  } else if (setting === 'materials') {
    router.push({ name: 'ManageGlobalMaterials' });
  } else if (setting === 'admin') {
    router.push({ name: 'AdminDashboard' });
  }
};

// MODIFIED: This watcher in App.vue becomes simpler.
// It mainly handles cases where the route state changes unexpectedly
// or when we need to ensure the project is selected based on a direct URL paste.
// It *should not* re-push to ProjectDetails if projectsStore actions already did.
watch(() => projectsStore.currentProject, (newProject) => {
  console.log('App.vue: projectsStore.currentProject watcher fired. newProject:', newProject?.name, 'isEditingNewProject:', projectsStore.isEditingNewProject, 'current route:', route.name);
  
  // If a project is selected in the store, but the route doesn't match, push to the correct route.
  // This handles direct URL access or state synchronization.
  if (newProject && newProject.id && (route.name !== 'ProjectDetails' || route.params.projectId != newProject.id)) {
    console.log(`App.vue: Current project ${newProject.name} is selected, but route is ${route.name}. Navigating to ProjectDetails.`);
    router.push({ name: 'ProjectDetails', params: { projectId: newProject.id } });
  } 
  // If no project is selected in the store, and we are not in new project mode,
  // and we are not on a settings page or already home, then go home.
  else if (!newProject && !projectsStore.isEditingNewProject && !['ManageRates', 'ManageGlobalMaterials', 'AdminDashboard', 'Home'].includes(route.name)) {
    console.log('App.vue: No project selected, not in new project mode, not a settings view. Redirecting to Home.');
    router.push({ name: 'Home' });
  }
}, { immediate: true });

// MODIFIED: This watcher is also simplified.
// It only pushes to 'NewProject' if we are in new project mode AND not already on that route.
// It explicitly *does not* handle the 'leaving new project mode' scenario, as that's handled by `cancelNewProjectEdit` itself.
watch(() => projectsStore.isEditingNewProject, (isEditing) => {
  console.log('App.vue: projectsStore.isEditingNewProject watcher fired. isEditing:', isEditing, 'current route:', route.name);
  if (isEditing && route.name !== 'NewProject') {
    console.log('App.vue: In new project mode, but route is not NewProject. Navigating to NewProject.');
    router.push({ name: 'NewProject' });
  }
  // The 'else if (!isEditing && route.name === "NewProject")' logic is removed,
  // as `cancelNewProjectEdit` directly pushes to 'Home'.
}, { immediate: true });
</script>

<style>
/* Reset and Base Styles */
:root {
  --color-primary: #42b983; /* Vue green */
  --color-primary-dark: #3aa873;
  --color-secondary: #f0f0f0;
  --color-secondary-dark: #e0e0e0;
  --color-danger: #dc3545;
  --color-danger-dark: #c82333;
  --color-background: #f4f7f6; /* Slightly darker background */
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

/* Auth View Wrapper */
#app-layout-wrapper {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  background-color: var(--color-background); /* Ensures consistent background for login/register */
}

/* Main App Container */
#app-container {
  display: flex;
  flex-direction: column; /* Header on top, content below */
  flex-grow: 1; /* Takes remaining height */
  overflow: hidden; /* Prevent main scrollbar on flex container */
}

.app-header {
  background-color: #35495E; /* Dark blue from Vue logo */
  color: white;
  padding: 15px 25px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  flex-shrink: 0; /* Prevent header from shrinking */
}

.header-left {
  display: flex;
  align-items: center;
}

.logo {
  height: 36px;
  margin-right: 10px;
}
.app-title {
  font-size: 1.8em;
  color: white;
  margin: 0;
  line-height: 1;
  font-weight: 600;
}

.header-nav {
  display: flex;
  align-items: center;
  gap: 15px;
}

.user-info {
  font-size: 0.95em;
  opacity: 0.9;
}
.user-info strong {
    font-weight: bold;
    color: #42b983; /* Use primary color for username */
}

.logout-btn i {
    margin-right: 5px;
}

.app-content-area {
    display: flex;
    flex-grow: 1; /* Takes up remaining space below header */
    overflow: hidden; /* Contains sidebar and main-content scrolls */
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
  flex-shrink: 0; /* Prevent sidebar from shrinking */
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
button:hover:not(:disabled) {
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
button.secondary:hover:not(:disabled) {
  background-color: var(--color-secondary-dark);
}
button.danger {
  background-color: var(--color-danger);
  color: white;
}
button.danger:hover:not(:disabled) {
  background-color: var(--color-danger-dark);
}

button.small-btn {
    font-size: 0.85em;
    padding: 5px 10px;
}
button.danger-text-btn {
  background: none;
  border: none;
  color: var(--color-danger);
  padding: 4px;
  cursor: pointer;
  font-size: 0.9em;
}
button.danger-text-btn:hover {
  color: var(--color-danger-dark);
}
button.danger-text-btn i { margin-right: 0; }


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

/* Form inputs consistency */
input[type="text"],
input[type="number"],
input[type="email"],
input[type="password"],
textarea,
select {
  padding: 10px;
  border: 1px solid #ccc;
  border-radius: 4px;
  font-size: 1em;
  width: 100%;
  box-sizing: border-box; /* Include padding in width */
  margin-bottom: 10px;
}
input[type="number"] { text-align: right; }
select {
  appearance: none; /* Remove default arrow */
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 10px center;
  background-size: 16px;
}
</style>