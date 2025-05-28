<template>
  <div class="project-view" v-if="projectsStore.currentProject || isNewProject">
    <div class="project-header">
      <h2>Project: {{ projectsStore.currentProject?.name || 'New Project' }}</h2>
      <div class="project-nav">
        <button
          @click="selectTab('details')"
          :class="{ active: activeTab === 'details' }"
        >
          <i class="fas fa-info-circle"></i> Details
        </button>
        <button
          @click="selectTab('tasks')"
          :class="{ active: activeTab === 'tasks' }"
          :disabled="isNewProjectMode"
        >
          <i class="fas fa-tasks"></i> Tasks
        </button>
        <button
          @click="selectTab('materials')"
          :class="{ active: activeTab === 'materials' }"
          :disabled="isNewProjectMode"
        >
          <i class="fas fa-truck-ramp-box"></i> Materials
        </button>
        <button
          @click="selectTab('rfi')"
          :class="{ active: activeTab === 'rfi' }"
          :disabled="isNewProjectMode"
        >
          <i class="fas fa-file-invoice"></i> RFI Documents
        </button>
        <button
          @click="selectTab('requirements')"
          :class="{ active: activeTab === 'requirements' }"
          :disabled="isNewProjectMode"
        >
          <i class="fas fa-list-check"></i> Requirements
        </button>
      </div>
    </div>

    <div class="project-content">
      <ProjectDetailsEditor v-show="activeTab === 'details'" />
      <ProjectSummary v-show="activeTab === 'details' && projectsStore.currentProject && !isNewProjectMode" />
      <TaskManager v-show="activeTab === 'tasks'" />
      <MaterialManager v-show="activeTab === 'materials'" />
      <RfiDocumentManager v-show="activeTab === 'rfi'" />
      <RequirementManager v-show="activeTab === 'requirements'" />
    </div>
  </div>
  <div v-else class="component-section">
    <p>Select a project from the left sidebar or create a new one.</p>
  </div>
</template>

<script setup>
import { ref, watch, computed, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { useProjectsStore } from '../stores/projectsStore';

import ProjectDetailsEditor from '../components/ProjectDetailsEditor.vue';
import ProjectSummary from '../components/ProjectSummary.vue';
import TaskManager from '../components/TaskManager.vue';
import MaterialManager from '../components/MaterialManager.vue';
import RfiDocumentManager from '../components/RfiDocumentManager.vue'; // NEW IMPORT
import RequirementManager from '../components/RequirementManager.vue'; // NEW IMPORT

const projectsStore = useProjectsStore();
const route = useRoute();

const activeTab = ref('details'); // Default active tab

// Props to determine if it's a new project or existing
const props = defineProps({
  projectId: [String, Number], // For existing project
  isNewProject: { // For new project route like /project/new
    type: Boolean,
    default: false
  }
});

// Computed property to simplify checks for new project mode
const isNewProjectMode = computed(() => {
  const result = props.isNewProject || projectsStore.isEditingNewProject;
  console.log('ProjectView: isNewProjectMode computed. Result:', result, 'props.isNewProject:', props.isNewProject, 'projectsStore.isEditingNewProject:', projectsStore.isEditingNewProject);
  return result;
});


// Watch for project selection in the store to update the tab
watch(() => projectsStore.currentProject, (newProject) => {
  if (newProject || projectsStore.isEditingNewProject) {
    // If a project is selected or we're in new project mode, ensure 'details' tab is active
    activeTab.value = 'details';
  } else {
    // If no project is selected and not in new project mode, reset tab state
    activeTab.value = 'details'; // Or handle no project state
  }
  console.log('ProjectView: projectsStore.currentProject watcher fired. New project:', newProject?.name, 'isEditingNewProject:', projectsStore.isEditingNewProject, 'activeTab:', activeTab.value);
}, { immediate: true });

// MODIFIED: This watcher handles setting the projectsStore.currentProject
// based on the route.params.projectId, especially for direct URL access/refresh.
watch(() => route.params.projectId, async (newProjectId) => {
  console.log('ProjectView: route.params.projectId watcher fired. New projectId:', newProjectId);
  
  if (newProjectId && newProjectId !== 'new') {
    // If route has a projectId and it's not 'new'
    // And if projectsStore.currentProject is not already this project
    if (!projectsStore.currentProject || projectsStore.currentProject.id.toString() !== newProjectId.toString()) {
      console.log('ProjectView: Route projectId indicates an existing project, but store currentProject is not matching. Attempting to select from store.');
      
      // Ensure projectsList is populated before trying to find the project
      if (!projectsStore.projectsList || projectsStore.projectsList.length === 0) {
        console.log('ProjectView: projectsList is empty, fetching projects first.');
        await projectsStore.fetchProjects();
      }
      
      const project = projectsStore.projectsList.find(p => p.id.toString() === newProjectId.toString());
      if (project) {
        console.log('ProjectView: Found project in list. Selecting project (forcing non-toggle):', project.name);
        projectsStore.selectProject(project); // Use the store action to set currentProject
      } else {
        console.warn('ProjectView: Project not found in projectsList after fetch for ID:', newProjectId);
        // If project from route params is not found, maybe redirect to home or show error
        projectsStore.selectProject(null); // Deselect any stale project, redirect to home
      }
    } else {
        console.log('ProjectView: Current project in store already matches route. No action needed.');
    }
  } else if (newProjectId === 'new') {
    // If route is 'new', ensure new project mode is activated
    if (!projectsStore.isEditingNewProject) {
      console.log('ProjectView: Route is "new" and not in new project mode. Starting new project mode via store.');
      projectsStore.startNewProject();
    } else {
      console.log('ProjectView: Already in new project mode via route "new". No action needed.');
    }
  } else {
    // If projectId is null/undefined (e.g., navigating from /project/1 to /)
    if (projectsStore.currentProject || projectsStore.isEditingNewProject) {
        console.log('ProjectView: Route projectId is undefined, but store has a project selected or is in new mode. Clearing store state.');
        projectsStore.selectProject(null); // Clear selected project, which will redirect to Home
    } else {
        console.log('ProjectView: Route projectId is undefined, and store is clean. No action needed.');
    }
  }
}, { immediate: true });


onMounted(() => {
  console.log('ProjectView: component mounted. Route params:', route.params);
});

const selectTab = (tabName) => {
  activeTab.value = tabName;
  console.log('ProjectView: Tab changed to:', tabName);
};
</script>

<style scoped>
.project-view {
  display: flex;
  flex-direction: column;
  height: 100%; /* Take full height of main-content */
}

.project-header {
  margin-bottom: 20px;
  background-color: white;
  border: 1px solid #e0e0e0;
  border-radius: var(--border-radius-base);
  padding: 20px;
  padding-bottom: 0; /* Remove bottom padding because of nav */
  flex-shrink: 0; /* Prevent from shrinking */
}

.project-header h2 {
  margin-top: 0;
  margin-bottom: 15px;
  color: var(--color-dark-grey);
  font-size: 1.4em;
  border-bottom: 1px solid #eee;
  padding-bottom: 10px;
}

.project-nav {
  display: flex;
  gap: 5px;
  border-bottom: 2px solid #e0e0e0;
  margin-top: 15px;
  position: relative;
  top: 1px; /* Align with border */
}

.project-nav button {
  padding: 10px 15px;
  border: none;
  background-color: transparent;
  color: var(--color-dark-grey);
  font-size: 0.95em;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  transition: all 0.2s ease;
  border-radius: 4px 4px 0 0;
  display: flex;
  align-items: center;
  gap: 8px;
  white-space: nowrap;
}

.project-nav button:hover:not(:disabled) {
  background-color: var(--color-light-grey);
  color: var(--color-text);
}

.project-nav button.active {
  background-color: var(--color-primary);
  color: white;
  font-weight: 600;
  border-bottom: 2px solid var(--color-primary);
}

.project-nav button.active:hover {
  background-color: var(--color-primary-dark);
}

.project-nav button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  background-color: #f8f9fa;
  color: #6c757d;
}

.project-content {
  flex-grow: 1; /* Takes up remaining space */
  padding-top: 20px; /* Space between nav and content */
  /* Remove default padding from App.vue's main-content if this is directly child, or ensure it's not double-padded */
}

/* Ensure child components fill available space and maintain their own margins */
.project-content > div {
  margin-bottom: 20px;
}
.project-content > div:last-child {
  margin-bottom: 0;
}
</style>