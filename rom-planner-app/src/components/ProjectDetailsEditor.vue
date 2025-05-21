<template>
  <div class="project-details-editor component-section" v-if="projectsStore.currentProject || projectsStore.isEditingNewProject">
    <h3>{{ projectsStore.isEditingNewProject ? 'Add New Project' : 'Edit Project Details' }}</h3>
    
    <form @submit.prevent="handleSave" v-if="editableProjectData">
      <div class="form-grid">
        <div class="form-group">
          <label for="projectName">Project Name:</label>
          <input type="text" id="projectName" v-model="editableProjectData.name" required />
        </div>
        
        <div class="form-group">
          <label for="projectRisk">Risk Percentage (%):</label>
          <input type="number" id="projectRisk" v-model.number="editableProjectData.riskPercentage" min="0" max="100" step="0.1" />
        </div>

        <div class="form-group full-width">
          <label for="projectDescription">Description:</label>
          <textarea id="projectDescription" v-model="editableProjectData.description" rows="3"></textarea>
        </div>
      </div>
      
      <div class="form-actions">
        <button type="submit" class="primary"><i class="fas fa-save"></i> Save Project</button>
        <button type="button" @click="handleCancel" class="secondary" v-if="!projectsStore.isEditingNewProject">
            <i class="fas fa-times"></i> Cancel Edit
        </button>
         <button type="button" @click="handleCancelNewProject" class="secondary" v-if="projectsStore.isEditingNewProject">
            <i class="fas fa-ban"></i> Cancel New Project
        </button>
      </div>
    </form>
     <div v-else-if="projectsStore.isLoading" class="loading-message">Loading project details...</div>
  </div>
</template>

<script setup>
import { ref, watch, onMounted } from 'vue';
import { useProjectsStore } from '../stores/projectsStore';
import { toRaw } from 'vue'; // Import toRaw

const projectsStore = useProjectsStore();
const editableProjectData = ref(null);

const syncFormWithStore = () => {
  if (projectsStore.currentProject) {
    // Deep copy to avoid direct mutation of store state if user types then cancels
    editableProjectData.value = JSON.parse(JSON.stringify(toRaw(projectsStore.currentProject)));
    // Ensure riskPercentage is a number
    if (editableProjectData.value) {
        editableProjectData.value.riskPercentage = Number(editableProjectData.value.riskPercentage || 0);
    }
  } else {
    editableProjectData.value = null; // Clear form if no project selected
  }
};

// Watch for changes in the selected project or new project mode
watch(() => [projectsStore.currentProject, projectsStore.isEditingNewProject], () => {
  syncFormWithStore();
}, { deep: true, immediate: true });


const handleSave = async () => {
  if (!editableProjectData.value || !editableProjectData.value.name.trim()) {
    alert('Project name is required.');
    return;
  }
  // Ensure riskPercentage is a number before saving
  const dataToSave = {
      ...editableProjectData.value,
      riskPercentage: parseFloat(editableProjectData.value.riskPercentage) || 0
  };
  
  await projectsStore.saveProject(dataToSave);
  // The store's saveProject will now handle selecting the saved project,
  // which will trigger the watcher and re-sync the form.
  // projectsStore.isEditingNewProject will also be set to false by the store.
};

const handleCancel = () => {
  // Re-sync form with the original currentProject data from the store
  syncFormWithStore(); 
};

const handleCancelNewProject = () => {
    projectsStore.cancelNewProjectEdit();
};

</script>

<style scoped>
.project-details-editor {
  margin-bottom: 20px; /* Spacing before next component like summary */
}
.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr; /* Two columns for name and risk */
  gap: 15px 20px; /* Row gap, Column gap */
  margin-bottom: 20px;
}
.form-group {
  display: flex;
  flex-direction: column;
}
.form-group.full-width {
  grid-column: 1 / -1; /* Span both columns */
}
.form-group label {
  margin-bottom: 5px;
  font-weight: 500;
  font-size: 0.9em;
}
.form-group input[type="text"],
.form-group input[type="number"],
.form-group textarea {
  padding: 10px;
  border: 1px solid #ccc;
  border-radius: 4px;
  font-size: 1em;
}
.form-group textarea {
  resize: vertical;
  min-height: 60px;
}
.form-actions {
  display: flex;
  gap: 10px;
  margin-top: 10px; /* Add some space above buttons */
  border-top: 1px solid #eee;
  padding-top: 15px;
}
</style>