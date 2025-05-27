<!-- src/views/ProjectView.vue -->
<template>
  <div class="project-view">
    <!-- Project Details - Show editor only when editing, otherwise show read-only summary -->
    <div class="project-details-section component-section" v-if="projectsStore.currentProject && !projectsStore.isEditingNewProject">
      <div class="project-header">
        <div class="project-info">
          <h3>{{ projectsStore.currentProject.name }}</h3>
          <p v-if="projectsStore.currentProject.description" class="project-description">
            {{ projectsStore.currentProject.description }}
          </p>
          <div class="project-meta">
            <span class="risk-info">Risk: {{ projectsStore.currentProject.riskPercentage || 0 }}%</span>
            <span class="created-info">Created: {{ formatDate(projectsStore.currentProject.createdAt) }}</span>
          </div>
        </div>
        <div class="project-actions">
          <button @click="startEditing" class="secondary">
            <i class="fas fa-edit"></i> Edit Project
          </button>
        </div>
      </div>
    </div>

    <!-- Project Details Editor (only when editing) -->
    <ProjectDetailsEditor v-if="isEditing || projectsStore.isEditingNewProject" />
    
    <!-- Project Summary -->
    <ProjectSummary v-if="projectsStore.currentProject && !projectsStore.isEditingNewProject" />
    
    <!-- Task Manager -->
    <TaskManager v-if="projectsStore.currentProject && !projectsStore.isEditingNewProject" />
    
    <!-- Material Manager -->
    <MaterialManager v-if="projectsStore.currentProject && !projectsStore.isEditingNewProject" />
  </div>
</template>

<script setup>
import { ref, watch } from 'vue';
import ProjectDetailsEditor from '../components/ProjectDetailsEditor.vue';
import ProjectSummary from '../components/ProjectSummary.vue';
import TaskManager from '../components/TaskManager.vue';
import MaterialManager from '../components/MaterialManager.vue';
import { useProjectsStore } from '../stores/projectsStore';

const projectsStore = useProjectsStore();
const isEditing = ref(false);

const startEditing = () => {
  isEditing.value = true;
};

// Watch for project changes to stop editing mode
watch(() => projectsStore.currentProject, () => {
  isEditing.value = false;
});

// Watch for save/cancel in ProjectDetailsEditor to exit editing mode
watch(() => [projectsStore.currentProject, projectsStore.isEditingNewProject], ([newProject, isEditingNew]) => {
  if (!isEditingNew && newProject) {
    isEditing.value = false;
  }
});

const formatDate = (dateString) => {
  if (!dateString) return '';
  return new Date(dateString).toLocaleDateString();
};
</script>

<style scoped>
.project-view {
  /* Each component has its own styling, so minimal needed here */
}

.project-details-section {
  margin-bottom: 20px;
}

.project-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.project-info {
  flex-grow: 1;
}

.project-info h3 {
  margin: 0 0 10px 0;
  color: var(--color-dark-grey);
  font-size: 1.4em;
}

.project-description {
  color: #666;
  margin: 0 0 15px 0;
  line-height: 1.4;
}

.project-meta {
  display: flex;
  gap: 20px;
  font-size: 0.9em;
  color: #777;
}

.risk-info {
  font-weight: 500;
}

.project-actions {
  flex-shrink: 0;
}
</style>