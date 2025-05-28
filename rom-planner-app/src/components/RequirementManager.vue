<template>
  <div class="requirement-manager component-section" v-if="projectsStore.currentProject">
    <h3>Requirements for: {{ projectsStore.currentProject.name }}</h3>

    <div v-if="requirementsStore.isLoading">Loading requirements...</div>
    <div v-if="requirementsStore.error" class="error-message">Error: {{ requirementsStore.error }}</div>

    <form @submit.prevent="handleAddOrUpdateRequirement" class="requirement-form">
      <h4>{{ editingRequirementId ? 'Edit Requirement' : 'Add New Requirement' }}</h4>
      <div class="form-grid">
        <div class="form-group">
          <label for="customId">Custom ID (e.g., REQ-001):</label>
          <input type="text" id="customId" v-model="currentRequirement.custom_id" required :disabled="!!editingRequirementId" />
          <small v-if="editingRequirementId">(ID cannot be changed once set)</small>
        </div>
        <div class="form-group full-width">
          <label for="requirementText">Requirement Text:</label>
          <textarea id="requirementText" v-model="currentRequirement.requirement_text" rows="3" required></textarea>
        </div>
      </div>
      <div class="form-actions">
        <button type="submit" class="primary">{{ editingRequirementId ? 'Update Requirement' : 'Add Requirement' }}</button>
        <button type="button" v-if="editingRequirementId" @click="cancelEdit" class="secondary">Cancel Edit</button>
      </div>
    </form>

    <table v-if="requirementsStore.requirementsList.length > 0">
      <thead>
        <tr>
          <th style="width: 15%;">Custom ID</th>
          <th style="width: 55%;">Requirement Text</th>
          <th style="width: 15%;">Linked Tasks</th>
          <th style="width: 15%;">Actions</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="req in requirementsStore.requirementsList" :key="req.id">
          <td>{{ req.custom_id }}</td>
          <td>{{ req.requirement_text }}</td>
          <td>
            <span v-if="getLinkedTaskNames(req.id).length > 0" class="linked-tasks-badge" :title="getLinkedTaskNames(req.id).join(', ')">
                {{ getLinkedTaskNames(req.id).length }} linked
            </span>
            <span v-else class="no-linked-tasks">-</span>
          </td>
          <td>
            <button @click="editRequirement(req)" class="secondary small-btn">Edit</button>
            <button @click="confirmDeleteRequirement(req.id)" class="danger small-btn">Delete</button>
          </td>
        </tr>
      </tbody>
    </table>
    <p v-else-if="!requirementsStore.isLoading">No requirements defined yet for this project. Use the "RFI Documents" tab to process documents, or add manually here.</p>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue';
import { useRequirementsStore } from '../stores/requirementsStore';
import { useProjectsStore } from '../stores/projectsStore';
import { useTasksStore } from '../stores/tasksStore';

const requirementsStore = useRequirementsStore();
const projectsStore = useProjectsStore();
const tasksStore = useTasksStore(); // To get linked task names

const defaultRequirement = () => ({ custom_id: '', requirement_text: '' });
const currentRequirement = ref(defaultRequirement());
const editingRequirementId = ref(null);

// MOVE THE cancelEdit FUNCTION DEFINITION HERE
const cancelEdit = () => {
  currentRequirement.value = defaultRequirement();
  editingRequirementId.value = null;
};

onMounted(() => {
  if (projectsStore.currentProject?.id) {
    requirementsStore.fetchRequirements(projectsStore.currentProject.id);
  }
});

watch(() => projectsStore.currentProject, (newProject) => {
  if (newProject?.id) {
    requirementsStore.fetchRequirements(newProject.id);
    cancelEdit();
  } else {
    requirementsStore.clearState();
    cancelEdit();
  }
}, { immediate: true });

const handleAddOrUpdateRequirement = async () => {
  if (!currentRequirement.value.custom_id || !currentRequirement.value.requirement_text.trim()) {
    alert('Custom ID and requirement text are required.');
    return;
  }
  
  if (!projectsStore.currentProject?.id) {
      alert('Please select a project first.');
      return;
  }

  const payload = { ...currentRequirement.value, project_id: projectsStore.currentProject.id };

  let success = false;
  if (editingRequirementId.value) {
    success = await requirementsStore.updateRequirement(editingRequirementId.value, payload);
  } else {
    success = await requirementsStore.createRequirement(projectsStore.currentProject.id, payload);
  }

  if (success) {
    currentRequirement.value = defaultRequirement();
    editingRequirementId.value = null;
  } else {
    alert('Failed to save requirement. Check console for errors.');
  }
};

const editRequirement = (req) => {
  editingRequirementId.value = req.id;
  currentRequirement.value = { ...req };
};


const confirmDeleteRequirement = async (requirementId) => {
  if (confirm('Are you sure you want to delete this requirement? This will also unlink it from any tasks.')) {
    const success = await requirementsStore.deleteRequirement(requirementId);
    if (!success) {
      alert('Failed to delete requirement. Check console for errors.');
    }
  }
};

const getLinkedTaskNames = (requirementId) => {
  const linkedTaskNames = [];
  tasksStore.tasksList.forEach(task => {
    if (task.requirements && task.requirements.some(req => req.id === requirementId)) {
      linkedTaskNames.push(task.name);
    }
  });
  return linkedTaskNames;
};
</script>

<style scoped>
.requirement-manager {
  padding: 20px;
}
.requirement-form {
  margin-bottom: 20px;
  padding: 15px;
  border: 1px solid #e0e0e0;
  border-radius: var(--border-radius-base);
  background-color: #f8f9fa;
}
.requirement-form h4 {
  margin-top: 0;
  margin-bottom: 15px;
  color: var(--color-dark-grey);
  border-bottom: 1px solid #eee;
  padding-bottom: 10px;
}

.requirement-form .form-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 10px;
}

.requirement-form .form-group.full-width {
    grid-column: 1 / -1;
}

.requirement-form label {
  display: block;
  margin-bottom: 5px;
  font-weight: 500;
  font-size: 0.9em;
}

.requirement-form input[type="text"],
.requirement-form textarea {
  width: 100%;
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: var(--border-radius-base);
  box-sizing: border-box;
}

.requirement-form small {
    font-size: 0.85em;
    color: #6c757d;
    margin-top: 5px;
    display: block;
}

.form-actions {
  display: flex;
  gap: 10px;
  margin-top: 20px;
  padding-top: 15px;
  border-top: 1px solid #eee;
}

table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 15px;
}
th, td {
  border: 1px solid #ddd;
  padding: 10px;
  text-align: left;
  vertical-align: top;
}
th {
  background-color: #f2f2f2;
  font-weight: 600;
}
td button {
  margin-right: 5px;
}

.linked-tasks-badge {
    background-color: #e0f2f7;
    color: #0288d1;
    padding: 3px 8px;
    border-radius: 4px;
    font-size: 0.8em;
    font-weight: bold;
    cursor: help; /* To indicate tooltip */
    white-space: nowrap;
}

.no-linked-tasks {
    color: #adb5bd;
    font-style: italic;
    font-size: 0.9em;
}
</style>