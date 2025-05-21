      
<template>
  <div class="task-manager component-section" v-if="projectsStore.currentProject">
    <h3>Tasks for: {{ projectsStore.currentProject.name }}</h3>

    <div v-if="tasksStore.isLoading" class="loading-message">Loading tasks...</div>
    <div v-if="tasksStore.error" class="error-message">Error: {{ tasksStore.error }}</div>

    <!-- "Add New Task" Button - Form is now part of the table for a new row -->
    <div class="add-task-controls">
        <button @click="prepareNewTask" class="primary" :disabled="editingTaskId === 'new' || !!editingTaskId">
            <i class="fas fa-plus"></i> Add New Task
        </button>
        <span v-if="editingTaskId === 'new' || !!editingTaskId" class="editing-hint">
            (Complete or cancel current edit to add another)
        </span>
    </div>


    <!-- Task Table with Inline Editing -->
    <form @submit.prevent="saveEditedTask"> <!-- Form wraps the table for Enter key submission -->
        <table v-if="tasksStore.tasksList.length > 0 || editingTaskId === 'new'" class="task-table editable-table">
          <thead>
            <tr>
              <th class="col-name">Task Name</th>
              <th class="col-description">Description</th>
              <th v-for="role in tasksStore.availableRoles" :key="role" class="col-effort">{{ role }} (Days)</th>
              <th class="col-cost">Travel</th>
              <th class="col-cost">Materials</th>
              <th class="col-total">Task Total Days</th>
              <th class="col-total">Task Total Cost</th>
              <th class="col-actions">Actions</th>
            </tr>
          </thead>
          <tbody>

            <!-- Existing Tasks -->
            <tr v-for="(task, index) in tasksStore.tasksList" :key="task.id" :class="{ 'editing-row': editingTaskId === task.id }">
              <template v-if="editingTaskId === task.id">
                <td><input type="text" v-model="editableTaskData.name" required ref="firstEditableInput" /></td>
                <td><input type="text" v-model="editableTaskData.description" /></td>
                <td v-for="role in tasksStore.availableRoles" :key="task.id + '-' + role">
                  <input type="number" v-model.number="editableTaskData.efforts[role]" min="0" step="0.5" />
                </td>
                <td><input type="number" v-model.number="editableTaskData.travelCost" min="0" step="0.01" /></td>
                <td><input type="number" v-model.number="editableTaskData.materialsCost" min="0" step="0.01" /></td>
                <td class="read-only-cell">{{ calculateTaskTotalDays(editableTaskData) }}</td>
                <td class="read-only-cell">{{ formatCurrency(calculateTaskTotalCost(editableTaskData)) }}</td>
                <td class="actions-cell">
                  <button type="submit" class="primary small-btn"><i class="fas fa-save"></i> Save</button>
                  <button type="button" @click="cancelEdit" class="secondary small-btn"><i class="fas fa-times"></i> Cancel</button>
                </td>
              </template>
              <template v-else>
                <td @dblclick="startEdit(task, index)">{{ task.name }}</td>
                <td @dblclick="startEdit(task, index)" class="description-cell">
                    <span v-if="task.description">{{ task.description }}</span>
                    <span v-else class="no-description">-</span>
                </td>
                <td v-for="role in tasksStore.availableRoles" :key="task.id + '-' + role" @dblclick="startEdit(task, index)">
                  {{ task.efforts[role] || 0 }}
                </td>
                <td @dblclick="startEdit(task, index)">{{ formatCurrency(task.travelCost) }}</td>
                <td @dblclick="startEdit(task, index)">{{ formatCurrency(task.materialsCost) }}</td>
                <td class="read-only-cell">{{ calculateTaskTotalDays(task) }}</td>
                <td class="read-only-cell">{{ formatCurrency(calculateTaskTotalCost(task)) }}</td>
                <td class="actions-cell">
                  <button @click="startEdit(task, index)" class="secondary small-btn" :disabled="!!editingTaskId"><i class="fas fa-edit"></i> Edit</button>
                  <button @click="confirmDeleteTask(task.id)" class="danger small-btn" :disabled="!!editingTaskId"><i class="fas fa-trash"></i> Delete</button>
                  <button @click="moveTask(index, -1)" :disabled="index === 0 || !!editingTaskId" class="secondary small-btn"><i class="fas fa-arrow-up"></i></button>
                  <button @click="moveTask(index, 1)" :disabled="index === tasksStore.tasksList.length - 1 || !!editingTaskId" class="secondary small-btn"><i class="fas fa-arrow-down"></i></button>
                </td>
              </template>
            </tr>

            <!-- Row for adding a new task (if active) -->
            <tr v-if="editingTaskId === 'new'" class="editing-row new-task-row">
              <td><input type="text" v-model="editableTaskData.name" placeholder="New Task Name" required ref="firstEditableInput"/></td>
              <td><input type="text" v-model="editableTaskData.description" placeholder="Description" /></td>
              <td v-for="role in tasksStore.availableRoles" :key="'new-'+role">
                <input type="number" v-model.number="editableTaskData.efforts[role]" min="0" step="0.5" />
              </td>
              <td><input type="number" v-model.number="editableTaskData.travelCost" min="0" step="0.01" /></td>
              <td><input type="number" v-model.number="editableTaskData.materialsCost" min="0" step="0.01" /></td>
              <td class="read-only-cell">{{ calculateTaskTotalDays(editableTaskData) }}</td>
              <td class="read-only-cell">{{ formatCurrency(calculateTaskTotalCost(editableTaskData)) }}</td>
              <td class="actions-cell">
                <button type="submit" class="primary small-btn"><i class="fas fa-save"></i> Save</button>
                <button type="button" @click="cancelEdit" class="secondary small-btn"><i class="fas fa-times"></i> Cancel</button>
              </td>
            </tr>
          </tbody>
          <!-- Summary Row -->
          <tfoot v-if="tasksStore.tasksList.length > 0 || editingTaskId === 'new'">
            <tr>
              <th colspan="2">Project Totals:</th>
              <th v-for="role in tasksStore.availableRoles" :key="'total-' + role">
                {{ tasksStore.totalDaysPerRoleForCurrentProject[role] || 0 }}
              </th>
              <th>{{ formatCurrency(tasksStore.totalTravelCostForCurrentProject) }}</th>
              <th>{{ formatCurrency(tasksStore.totalMaterialsCostForCurrentProject) }}</th>
              <th>
                {{ Object.values(tasksStore.totalDaysPerRoleForCurrentProject).reduce((sum, days) => sum + days, 0) }}
              </th>
              <th>{{ formatCurrency(tasksStore.grandTotalCostForCurrentProject) }}</th>
              <th></th>
            </tr>
            <tr class="cost-summary">
                <th colspan="2">Cost per Role:</th>
                 <th v-for="role in tasksStore.availableRoles" :key="'cost-total-' + role" class="role-cost-cell">
                    {{ formatCurrency(tasksStore.totalCostPerRoleForCurrentProject[role] || 0) }}
                 </th>
                 <th colspan="5"></th> <!-- Span remaining columns -->
            </tr>
          </tfoot>
        </table>
        <p v-else-if="!tasksStore.isLoading && projectsStore.currentProject && editingTaskId !== 'new'">
            No tasks yet for this project. Click "Add New Task" to begin.
        </p>
    </form> <!-- End form wrapping table -->
  </div>
  <div v-else class="component-section">
    <p>Select a project to view and manage its tasks.</p>
  </div>
</template>

<script setup>
import { ref, watch, onMounted, nextTick, computed } from 'vue';
import { useProjectsStore } from '../stores/projectsStore';
import { useTasksStore } from '../stores/tasksStore';
import { useRatesStore } from '../stores/ratesStore';

const projectsStore = useProjectsStore();
const tasksStore = useTasksStore();
const ratesStore = useRatesStore();

const editingTaskId = ref(null); // Stores ID of task being edited, or 'new' for a new task
const editableTaskData = ref(null); // Holds the data for the task being edited/added
const firstEditableInput = ref(null); // Template ref for focusing the first input in edit mode

// --- FUNCTION DEFINITIONS MOVED UP ---
const cancelEdit = () => {
  editingTaskId.value = null;
  editableTaskData.value = null;
};

// Helper to create a default structure for a new/editable task
const createDefaultEditableTask = () => {
  const efforts = {};
  tasksStore.availableRoles.forEach(role => {
    efforts[role] = 0;
  });
  return {
    id: null, // Will be 'new' or an existing ID
    projectId: projectsStore.currentProject?.id || null,
    name: '',
    description: '',
    efforts: efforts,
    travelCost: 0,
    materialsCost: 0,
    sequence: tasksStore.tasksList.length, // Default for new, will be preserved for existing
  };
};

const focusFirstInput = async () => {
    await nextTick(); // Wait for the DOM to update
    if (firstEditableInput.value) {
        firstEditableInput.value.focus();
        if (typeof firstEditableInput.value.select === 'function') {
            firstEditableInput.value.select(); // Select text for easy replacement
        }
    }
};
// --- END OF MOVED FUNCTION DEFINITIONS ---


// Ensure rates and initial roles are loaded for calculations and form structure
onMounted(() => {
  if (ratesStore.ratesList.length === 0) {
    ratesStore.fetchRates();
  }
});


// When the selected project changes, clear any active edits and fetch tasks
watch(() => projectsStore.currentProject, (newProject) => {
  cancelEdit(); // Now cancelEdit is defined before this watcher runs
  if (newProject) {
    tasksStore.fetchTasksForProject(newProject.id);
  } else {
    tasksStore.tasksList = []; // Clear tasks if no project is selected
  }
}, { immediate: true });

// When available roles change (e.g., after rates are loaded/updated),
// ensure editableTaskData.efforts is up-to-date.
watch(() => tasksStore.availableRoles, (newRoles) => {
  if (editableTaskData.value) {
    const newEfforts = { ...editableTaskData.value.efforts };
    newRoles.forEach(role => {
      if (!(role in newEfforts)) {
        newEfforts[role] = 0;
      }
    });
    Object.keys(newEfforts).forEach(role => {
      if (!newRoles.includes(role)) {
        delete newEfforts[role];
      }
    });
    editableTaskData.value.efforts = newEfforts;
  }
}, { deep: true });


const prepareNewTask = () => {
  if (editingTaskId.value) return; // Don't allow if already editing
  editableTaskData.value = createDefaultEditableTask();
  if(projectsStore.currentProject?.id) { // Ensure currentProject exists
      editableTaskData.value.projectId = projectsStore.currentProject.id;
  } else {
      // Handle case where no project is selected, perhaps alert user or disable 'Add New Task'
      console.warn("Cannot prepare new task: No project selected.");
      return;
  }
  editingTaskId.value = 'new';
  focusFirstInput();
};

const startEdit = (task, index) => {
  if (editingTaskId.value) return; // Don't allow if already editing
  // Deep clone task data for editing to prevent modifying original store data directly
  editableTaskData.value = JSON.parse(JSON.stringify(task));
  // Ensure all available roles are present in the efforts object for the form
  tasksStore.availableRoles.forEach(role => {
    if (editableTaskData.value.efforts[role] === undefined || editableTaskData.value.efforts[role] === null) {
      editableTaskData.value.efforts[role] = 0;
    }
  });
  editableTaskData.value.sequence = index; // Preserve original sequence
  editingTaskId.value = task.id;
  focusFirstInput();
};


const saveEditedTask = async () => {
  if (!editableTaskData.value || !editableTaskData.value.name || !editableTaskData.value.name.trim()) {
    alert('Task name is required.');
    return;
  }
  if (!projectsStore.currentProject) {
    alert('No project selected. Cannot save task.');
    return;
  }

  const taskToSave = { ...editableTaskData.value };
  taskToSave.projectId = projectsStore.currentProject.id;

  // Ensure efforts are numbers
  for (const role in taskToSave.efforts) {
    taskToSave.efforts[role] = Number(taskToSave.efforts[role] || 0);
  }
  taskToSave.travelCost = Number(taskToSave.travelCost || 0);
  taskToSave.materialsCost = Number(taskToSave.materialsCost || 0);

  // If it's a new task, 'id' will be null or 'new'. The backend handles new vs update.
  if (editingTaskId.value === 'new') {
      taskToSave.id = null; // Ensure backend treats it as new
  }


  const saved = await tasksStore.saveTask(taskToSave);
  if (saved) {
    cancelEdit(); // Clear edit state
  } else {
    alert('Failed to save task. Check console for errors.');
  }
};


const confirmDeleteTask = async (taskId) => {
  if (editingTaskId.value) return; // Prevent delete while another edit is active
  if (confirm('Are you sure you want to delete this task?')) {
    await tasksStore.deleteTask(taskId, projectsStore.currentProject.id);
  }
};

const moveTask = async (currentIndex, direction) => {
  if (editingTaskId.value) return; // Prevent reorder while editing

  const newIndex = currentIndex + direction;
  if (newIndex < 0 || newIndex >= tasksStore.tasksList.length) return;

  const tasksCopy = [...tasksStore.tasksList];
  const [movedTask] = tasksCopy.splice(currentIndex, 1);
  tasksCopy.splice(newIndex, 0, movedTask);

  const tasksToUpdateSequence = tasksCopy.map((task, index) => ({
    id: task.id,
    sequence: index
  }));

  await tasksStore.updateTaskSequence(tasksToUpdateSequence, projectsStore.currentProject.id);
};

// --- Calculation Methods (could be moved to store if they get very complex) ---
const calculateTaskTotalDays = (task) => {
  if (!task || !task.efforts) return 0;
  return Object.values(task.efforts).reduce((sum, effort) => sum + Number(effort || 0), 0);
};

const calculateTaskTotalCost = (task) => {
  if (!task || !task.efforts || !ratesStore.ratesList || ratesStore.ratesList.length === 0) return 0;
  let cost = 0;
  const roleRatesMap = ratesStore.ratesList.reduce((acc, r) => {
    acc[r.role] = r.unit === 'hour' ? (Number(r.rate) * 8) : Number(r.rate);
    return acc;
  }, {});

  for (const role in task.efforts) {
    if (roleRatesMap[role] && task.efforts[role]) {
      cost += Number(task.efforts[role]) * roleRatesMap[role];
    }
  }
  cost += Number(task.travelCost || 0);
  cost += Number(task.materialsCost || 0);
  return cost;
};

const formatCurrency = (value) => {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value || 0);
};

// Expose method for testing or if needed by parent
defineExpose({ saveEditedTask, cancelEdit });

</script>

<style scoped>
/* Uses styles from src/style.css primarily, but adds specific tweaks */
.add-task-controls {
  margin-bottom: 15px;
  display: flex;
  align-items: center;
}
.editing-hint {
    margin-left: 10px;
    font-size: 0.9em;
    color: #777;
}

.task-table.editable-table td input[type="text"],
.task-table.editable-table td input[type="number"] {
  width: 100%; /* Make inputs fill the cell */
  padding: 6px 8px;
  margin: -6px -8px; /* Counteract cell padding to fill space */
  border: 1px solid #3498db; /* Highlight active input cell */
  font-size: inherit; /* Inherit table font size */
  height: calc(100% + 12px); /* Fill height */
  box-sizing: border-box;
}
.task-table.editable-table td {
  vertical-align: top; /* Align content to top for multi-line inputs */
}

.editing-row {
  background-color: #e6f7ff !important; /* Light blue background for the row being edited */
}
.new-task-row td {
    padding-top: 10px;
    padding-bottom: 10px;
}

.actions-cell {
  white-space: nowrap; /* Prevent action buttons from wrapping */
  width: auto; /* Let it size to content */
  text-align: right;
}
.actions-cell button.small-btn {
    padding: 5px 8px;
    font-size: 0.85em;
    margin-left: 4px;
}
.actions-cell button.small-btn i {
    margin-right: 4px; /* Space between icon and text */
}


.read-only-cell {
    color: #555;
    font-style: italic;
}

.description-cell {
    max-width: 250px; /* Limit width and allow wrap */
    white-space: normal; /* Allow wrapping */
    font-size: 0.9em;
    color: #444;
}
.no-description {
    color: #aaa;
    font-style: italic;
}

/* Column width hints - adjust as needed */
.col-name { width: 20%; }
.col-description { width: 25%; }
.col-effort { width: 8%; text-align: center; }
.col-cost { width: 10%; text-align: right; }
.col-total { width: 10%; text-align: right; font-weight: bold; }
.col-actions { width: 15%; text-align: center;}

.task-table tfoot .role-cost-cell {
    font-size: 0.85em;
    text-align: right;
    font-weight: normal;
}
</style>