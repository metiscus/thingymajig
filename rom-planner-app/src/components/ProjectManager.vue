<template>
  <div class="project-manager">
    <h3>Projects / Phases</h3>
    <div v-if="projectsStore.isLoading">Loading projects...</div>
    <div v-if="projectsStore.error" class="error-message">Error: {{ projectsStore.error }}</div>

    <div class="project-actions-top">
        <button @click="handleAddNewProject" class="primary add-project-btn">
            <i class="fas fa-plus"></i> Add New Project
        </button>
    </div>

    <ul v-if="projectsStore.projectsList.length > 0" class="project-list">
      <li
        v-for="project in projectsStore.projectsList"
        :key="project.id"
        @click="selectProject(project)"
        :class="{ 
            selected: projectsStore.currentProject && projectsStore.currentProject.id === project.id && !projectsStore.isEditingNewProject
        }"
      >
        <span class="project-name">{{ project.name }}</span>
        <button @click.stop="confirmDeleteProject(project.id)" class="danger-text-btn small-btn">
            <i class="fas fa-trash-alt"></i>
        </button>
      </li>
    </ul>
    <p v-else-if="!projectsStore.isLoading && !projectsStore.isEditingNewProject">
      No projects yet. Click "Add New Project" to begin.
    </p>
  </div>
</template>

<script setup>
import { onMounted } from 'vue';
import { useProjectsStore } from '../stores/projectsStore';

const projectsStore = useProjectsStore();

onMounted(() => {
  projectsStore.fetchProjects();
});

const handleAddNewProject = () => {
  projectsStore.startNewProject(); 
};

const confirmDeleteProject = async (projectId) => {
  if (confirm('Are you sure? This will also delete all tasks and materials in this project.')) {
    await projectsStore.deleteProject(projectId);
  }
};

const selectProject = (project) => {
  projectsStore.selectProject(project);
};
</script>

<style scoped>
.project-manager { margin-bottom: 0; } /* Removed bottom margin as it's in a sidebar section */
.project-actions-top {
  margin-bottom: 15px;
}
.add-project-btn {
  width: 100%;
  padding: 10px;
}
.project-list { list-style: none; padding: 0; }
.project-list li {
  padding: 10px 12px;
  border: 1px solid #eee;
  margin-bottom: -1px; /* Collapsed borders */
  cursor: pointer;
  display: flex;
  justify-content: space-between;
  align-items: center;
  transition: background-color 0.2s ease;
}
.project-list li:first-child {
    border-top-left-radius: 4px;
    border-top-right-radius: 4px;
}
.project-list li:last-child {
    border-bottom-left-radius: 4px;
    border-bottom-right-radius: 4px;
    margin-bottom: 0;
}
.project-list li:hover { background-color: #f9f9f9; }
.project-list li.selected { 
  background-color: #42b983; /* Vue green */
  color: white;
  border-color: #3aa873;
  z-index: 1;
  position: relative;
}
.project-list li.selected .project-name {
    font-weight: 600;
}
.project-list li.selected .danger-text-btn {
    color: #f8d7da; /* Light red for visibility on dark green */
}
.project-list li.selected .danger-text-btn:hover {
    color: white;
}


.project-name {
  flex-grow: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-right: 10px;
}
.danger-text-btn {
  background: none;
  border: none;
  color: #dc3545;
  padding: 4px;
  cursor: pointer;
  font-size: 0.9em;
}
.danger-text-btn:hover {
  color: #a71d2a;
}
.danger-text-btn i { margin-right: 0; }
.small-btn {
    font-size: 0.85em;
    padding: 5px 8px;
}

.error-message { color: red; }
</style>