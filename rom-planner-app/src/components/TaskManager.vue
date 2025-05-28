<template>
  <div class="task-manager component-section" v-if="projectsStore.currentProject">
    <h3>Tasks for: {{ projectsStore.currentProject.name }}</h3>

    <div v-if="tasksStore.isLoading" class="loading-message">Loading tasks...</div>
    <div v-if="tasksStore.error" class="error-message">Error: {{ tasksStore.error }}</div>

    <div class="add-task-controls">
      <button @click="prepareNewTask" class="primary" :disabled="!!editingTaskId">
        <i class="fas fa-plus"></i> Add New Task
      </button>
      <span v-if="editingTaskId" class="editing-hint">
        (Complete or cancel current edit to add another)
      </span>
    </div>

    <form @submit.prevent="saveEditedTask">
      <table v-if="localTasks.length > 0 || editingTaskId === 'new'" class="task-table editable-table">
        <thead>
          <tr>
            <th class="col-drag-handle"></th> <!-- Handle for drag -->
            <th class="col-name">Task Name</th>
            <th class="col-description">Description</th>
            <th class="col-requirements">Requirements</th> <!-- New column for requirements -->
            <th v-for="header_role in tasksStore.availableRoles" :key="header_role" class="col-effort">{{ header_role }} (Days)</th>
            <th class="col-cost">Travel</th>
            <th class="col-cost">Materials</th>
            <th class="col-total">Task Total Days</th>
            <th class="col-total">Task Total Cost</th>
            <th class="col-actions">Actions</th>
          </tr>
        </thead>

        <!-- tbody for existing tasks - SortableJS will target this -->
        <tbody ref="tasksTbody" v-if="localTasks.length > 0">
          <tr v-for="(task, index) in localTasks" :key="task.id" :data-id="task.id" 
              :class="{ 'editing-row': editingTaskId === task.id, 'drag-item': true }">
            <template v-if="editingTaskId === task.id">
              <td class="drag-handle-cell"><i class="fas fa-grip-vertical drag-handle disabled-drag-handle"></i></td>
              <td><input type="text" v-model="editableTaskData.name" required ref="firstEditableInput" /></td>
              <td><input type="text" v-model="editableTaskData.description" /></td>
              <td>
                <select multiple v-model="editableTaskData.linkedRequirementIds">
                  <option v-for="req in requirementsStore.requirementsList" :key="req.id" :value="req.id">
                    {{ req.custom_id }}: {{ req.requirement_text.substring(0, 50) }}...
                  </option>
                </select>
              </td>
              <td v-for="role_name_editor in tasksStore.availableRoles" :key="task.id + '-' + role_name_editor">
                <input type="number" v-model.number="editableTaskData.efforts[role_name_editor]" min="0" step="0.5" />
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
              <td class="drag-handle-cell"><i class="fas fa-grip-vertical drag-handle"></i></td>
              <td @dblclick="startEdit(task, index)">{{ task.name }}</td>
              <td @dblclick="startEdit(task, index)" class="description-cell">
                <span v-if="task.description">{{ task.description }}</span>
                <span v-else class="no-description">-</span>
              </td>
              <td @dblclick="startEdit(task, index)" class="requirements-cell">
                <span v-if="task.requirements && task.requirements.length > 0" class="req-tags">
                  <span v-for="req in task.requirements" :key="req.id" class="req-tag" :title="req.requirement_text">
                    {{ req.custom_id }}
                  </span>
                </span>
                <span v-else class="no-requirements">-</span>
              </td>
              <td v-for="role_name_display in tasksStore.availableRoles" :key="task.id + '-' + role_name_display" @dblclick="startEdit(task, index)">
                {{ task.efforts[role_name_display] || 0 }}
              </td>
              <td @dblclick="startEdit(task, index)">{{ formatCurrency(task.travelCost) }}</td>
              <td @dblclick="startEdit(task, index)">{{ formatCurrency(task.materialsCost) }}</td>
              <td class="read-only-cell">{{ calculateTaskTotalDays(task) }}</td>
              <td class="read-only-cell">{{ formatCurrency(calculateTaskTotalCost(task)) }}</td>
              <td class="actions-cell">
                <button @click="startEdit(task, index)" class="secondary small-btn" :disabled="!!editingTaskId"><i class="fas fa-edit"></i> Edit</button>
                <button @click="confirmDeleteTask(task.id)" class="danger small-btn" :disabled="!!editingTaskId"><i class="fas fa-trash"></i> Delete</button>
              </td>
            </template>
          </tr>
        </tbody>
        
        <tbody v-if="localTasks.length === 0 && editingTaskId !== 'new'">
            <tr>
                <td :colspan="8 + tasksStore.availableRoles.length" class="no-tasks-message"> 
                    No tasks in this project yet.
                </td>
            </tr>
        </tbody>

        <tbody v-if="editingTaskId === 'new'">
          <tr class="editing-row new-task-row">
            <td class="drag-handle-cell"><i class="fas fa-grip-vertical disabled-drag-handle"></i></td>
            <td><input type="text" v-model="editableTaskData.name" placeholder="New Task Name" required ref="firstEditableInput"/></td>
            <td><input type="text" v-model="editableTaskData.description" placeholder="Description" /></td>
            <td>
              <select multiple v-model="editableTaskData.linkedRequirementIds">
                <option v-for="req in requirementsStore.requirementsList" :key="req.id" :value="req.id">
                  {{ req.custom_id }}: {{ req.requirement_text.substring(0, 50) }}...
                </option>
              </select>
            </td>
            <td v-for="role_name_new in tasksStore.availableRoles" :key="'new-'+role_name_new">
              <input type="number" v-model.number="editableTaskData.efforts[role_name_new]" min="0" step="0.5" />
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

        <tfoot v-if="localTasks.length > 0 || editingTaskId === 'new'">
          <tr>
            <th class="col-drag-handle"></th>
            <th colspan="3">Project Totals:</th> <!-- Increased colspan for new column -->
            <th v-for="footer_total_role in tasksStore.availableRoles" :key="'total-' + footer_total_role">
              {{ tasksStore.totalDaysPerRoleForCurrentProject[footer_total_role] || 0 }}
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
              <th class="col-drag-handle"></th>
              <th colspan="3">Cost per Role:</th> <!-- Increased colspan -->
               <th v-for="footer_cost_role in tasksStore.availableRoles" :key="'cost-total-' + footer_cost_role" class="role-cost-cell">
                  {{ formatCurrency(tasksStore.totalCostPerRoleForCurrentProject[footer_cost_role] || 0) }}
               </th>
               <th :colspan="5"></th>
          </tr>
        </tfoot>
      </table>
      <p v-else-if="!tasksStore.isLoading && projectsStore.currentProject && editingTaskId !== 'new'">
          No tasks yet for this project. Click "Add New Task" to begin.
      </p>
    </form>
  </div>
  <div v-else class="component-section">
    <p>Select a project to view and manage its tasks.</p>
  </div>
</template>

<script setup>
import { ref, watch, onMounted, nextTick, toRaw, onBeforeUnmount } from 'vue';
import Sortable from 'sortablejs';
import { useProjectsStore } from '../stores/projectsStore';
import { useTasksStore } from '../stores/tasksStore';
import { useRatesStore } from '../stores/ratesStore';
import { useRequirementsStore } from '../stores/requirementsStore'; // NEW IMPORT

const projectsStore = useProjectsStore();
const tasksStore = useTasksStore();
const ratesStore = useRatesStore();
const requirementsStore = useRequirementsStore(); // NEW: Initialize requirements store

const editingTaskId = ref(null);
const editableTaskData = ref(null);
const firstEditableInput = ref(null);
const localTasks = ref([]);
const tasksTbody = ref(null);
let sortableInstance = null;

const calculateTaskTotalDays = (task) => { 
  if (!task || !task.efforts) return 0; 
  return Object.values(task.efforts).reduce((sum, effort) => sum + Number(effort || 0), 0); 
};

const calculateTaskTotalCost = (task) => { 
  if (!task || !task.efforts || !ratesStore.ratesList || ratesStore.ratesList.length === 0) return 0; 
  let cost = 0; 
  const roleRatesMap = ratesStore.ratesList.reduce((acc, r) => { 
    if (r && r.role) { 
      acc[r.role] = r.unit === 'hour' ? (Number(r.rate || 0) * 8) : Number(r.rate || 0); 
    } 
    return acc; 
  }, {}); 
  for (const role in task.efforts) { 
    if (roleRatesMap[role] !== undefined && task.efforts[role]) { 
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

watch(() => tasksStore.tasksList, (newTasksFromStore) => {
  // Ensure that task objects have a 'requirements' array and a 'linkedRequirementIds' for the form
  localTasks.value = Array.isArray(newTasksFromStore) ? newTasksFromStore.map(task => ({
    ...task,
    requirements: task.requirements || [], // Ensure requirements array exists
    linkedRequirementIds: task.requirements ? task.requirements.map(req => req.id) : [] // For multi-select
  })) : [];
  if (tasksTbody.value && localTasks.value.length > 0) {
    initSortable();
  }
}, { deep: true, immediate: true });

const initSortable = () => {
  if (sortableInstance) {
    sortableInstance.destroy();
  }
  if (tasksTbody.value) {
    sortableInstance = Sortable.create(tasksTbody.value, {
      handle: '.drag-handle',
      animation: 150,
      ghostClass: 'ghost-drag',
      filter: '.disabled-drag-handle',
      preventOnFilter: true,
      onEnd: async (evt) => {
        if (evt.oldIndex === undefined || evt.newIndex === undefined || evt.oldIndex === evt.newIndex) {
          return;
        }
        const movedItem = localTasks.value.splice(evt.oldIndex, 1)[0];
        localTasks.value.splice(evt.newIndex, 0, movedItem);
        const tasksToUpdateSequence = localTasks.value.map((task, index) => ({
          id: task.id,
          sequence: index,
        }));
        if (projectsStore.currentProject?.id) {
          await tasksStore.updateTaskSequence(tasksToUpdateSequence, projectsStore.currentProject.id);
        }
      },
      onStart: (evt) => {
        if (editingTaskId.value) {
          return false;
        }
      },
    });
  }
};

onMounted(() => {
  if (!ratesStore.ratesList || ratesStore.ratesList.length === 0) {
    ratesStore.fetchRates();
  }
  nextTick(() => {
    if (localTasks.value.length > 0 && tasksTbody.value) {
        initSortable();
    }
  });
});

watch(editingTaskId, (isEditing) => {
    if (sortableInstance) {
        try {
            sortableInstance.option('disabled', !!isEditing);
        } catch (e) {
            // Ignore
        }
    }
});

onBeforeUnmount(() => {
  if (sortableInstance) {
    sortableInstance.destroy();
  }
});

const cancelEdit = () => {
  editingTaskId.value = null;
  editableTaskData.value = null;
};

const createDefaultEditableTask = () => {
  const plainEfforts = {};
  (tasksStore.availableRoles || []).forEach(role => {
    plainEfforts[role] = 0;
  });
  return {
    id: null,
    projectId: projectsStore.currentProject?.id || null,
    name: '',
    description: '',
    efforts: plainEfforts,
    travelCost: 0,
    materialsCost: 0,
    sequence: localTasks.value.length,
    linkedRequirementIds: [] // NEW: default for new tasks
  };
};

const focusFirstInput = async () => {
  await nextTick();
  if (firstEditableInput.value) {
    const elementToFocus = Array.isArray(firstEditableInput.value) ? firstEditableInput.value[0] : firstEditableInput.value;
    if (elementToFocus) {
        elementToFocus.focus();
        if (typeof elementToFocus.select === 'function') {
            elementToFocus.select();
        }
    }
  }
};

const prepareNewTask = () => {
  if (editingTaskId.value) return; 
  if (!projectsStore.currentProject?.id) {
    alert("Please select a project first.");
    return;
  }
  editableTaskData.value = createDefaultEditableTask();
  editableTaskData.value.projectId = projectsStore.currentProject.id;
  editingTaskId.value = 'new';
  focusFirstInput();
};

const startEdit = (task, index) => {
  if (editingTaskId.value) return;
  const plainTaskCopy = JSON.parse(JSON.stringify(toRaw(task)));
  const plainEfforts = {};
  (tasksStore.availableRoles || []).forEach(role => {
    plainEfforts[role] = Number(plainTaskCopy.efforts?.[role] || 0);
  });
  plainTaskCopy.efforts = plainEfforts;
  
  // NEW: Ensure linkedRequirementIds is populated for editing
  plainTaskCopy.linkedRequirementIds = task.requirements ? task.requirements.map(req => req.id) : [];

  editableTaskData.value = plainTaskCopy;
  editableTaskData.value.sequence = task.sequence !== undefined ? task.sequence : index; 
  editingTaskId.value = task.id;
  focusFirstInput();
};

const saveEditedTask = async () => {
  if (!editingTaskId.value || !editableTaskData.value) {
    return; 
  }

  if (!editableTaskData.value || !editableTaskData.value.name || !editableTaskData.value.name.trim()) {
    alert('Task name is required.');
    return;
  }
  if (!projectsStore.currentProject?.id) {
    alert('No project selected. Cannot save task.');
    return;
  }
  const taskToSave = JSON.parse(JSON.stringify(toRaw(editableTaskData.value)));
  taskToSave.projectId = projectsStore.currentProject.id;
  if (taskToSave.efforts) {
    for (const role in taskToSave.efforts) {
      taskToSave.efforts[role] = Number(taskToSave.efforts[role] || 0);
    }
  } else { taskToSave.efforts = {}; }
  taskToSave.travelCost = Number(taskToSave.travelCost || 0);
  taskToSave.materialsCost = Number(taskToSave.materialsCost || 0);
  
  // NEW: Grab the selected requirement IDs
  const selectedRequirementIds = taskToSave.linkedRequirementIds || [];
  delete taskToSave.linkedRequirementIds; // Don't send this as part of the task payload

  if (editingTaskId.value === 'new') {
    taskToSave.id = null;
  }
  const saved = await tasksStore.saveTask(taskToSave, selectedRequirementIds); // Pass selected IDs
  if (saved) {
    cancelEdit();
  } else {
    alert('Failed to save task. Check console for errors.');
  }
};

const confirmDeleteTask = async (taskId) => {
  if (editingTaskId.value) return;
  if (confirm('Are you sure you want to delete this task?')) {
    await tasksStore.deleteTask(taskId, projectsStore.currentProject.id);
  }
};

watch(() => projectsStore.currentProject, (newProject) => {
  cancelEdit();
  if (sortableInstance) {
      sortableInstance.destroy();
      sortableInstance = null;
  }
  if (newProject) {
    tasksStore.fetchTasksForProject(newProject.id).then(() => {
        nextTick(() => {
            if (localTasks.value.length > 0 && tasksTbody.value) {
                 initSortable();
            }
        });
    });
    // NEW: Fetch requirements for the project
    requirementsStore.fetchRequirements(newProject.id);
  } else {
    tasksStore.tasksList = [];
    requirementsStore.requirementsList = []; // Clear requirements when no project is selected
  }
}, { immediate: true });

watch(() => tasksStore.availableRoles, (newRoles) => {
  if (editableTaskData.value) {
    const currentEffortsSource = editableTaskData.value.efforts ? toRaw(editableTaskData.value.efforts) : {};
    const newPlainEfforts = {};
    (newRoles || []).forEach(role => {
      newPlainEfforts[role] = Number(currentEffortsSource[role] || 0);
    });
    editableTaskData.value.efforts = newPlainEfforts;
  }
}, { deep: true });

defineExpose({ saveEditedTask, cancelEdit });
</script>

<style scoped>
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

/* TABLE STYLING - Core table structure */
.task-table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 15px;
  background-color: white;
  border: 1px solid #ddd;
  border-radius: 4px;
  overflow: hidden;
}

.task-table th, .task-table td {
  border: 1px solid #ddd;
  padding: 8px 12px;
  text-align: left;
  vertical-align: middle;
}

.task-table th {
  background-color: #f8f9fa;
  font-weight: 600;
  color: #495057;
  border-bottom: 2px solid #dee2e6;
}

.task-table tbody tr {
  border-bottom: 1px solid #e9ecef;
}

.task-table tbody tr:hover {
  background-color: #f8f9fa;
}

.task-table tbody tr:last-child {
  border-bottom: none;
}

/* FOOTER STYLING */
.task-table tfoot th {
  background-color: #e9ecef;
  border-top: 2px solid #adb5bd;
  font-weight: bold;
  color: #495057;
}

.task-table tfoot .cost-summary th {
  background-color: #d1ecf1;
  color: #0c5460;
  font-size: 0.9em;
}

/* EDITABLE TABLE SPECIFIC STYLES */
.task-table.editable-table td input[type="text"],
.task-table.editable-table td input[type="number"],
.task-table.editable-table td select {
  width: 100%;
  padding: 6px 8px;
  margin: -6px -8px;
  border: 1px solid #3498db;
  border-radius: 3px;
  font-size: inherit;
  box-sizing: border-box;
  background-color: white;
}

.editing-row {
  background-color: #e6f7ff !important;
}

.editing-row td {
  border-color: #3498db !important;
}

.new-task-row td {
  padding-top: 12px;
  padding-bottom: 12px;
  background-color: #f0f8ff;
}

/* COLUMN SPECIFIC STYLES */
.col-drag-handle {
  width: 30px;
  text-align: center;
  border-right: 2px solid #dee2e6;
}

.col-name {
  min-width: 150px;
  max-width: 200px;
}

.col-description {
  min-width: 200px;
  max-width: 300px;
}

.col-requirements { /* NEW COLUMN STYLE */
  width: 150px; /* Adjust as needed */
  vertical-align: top;
}

.col-effort {
  width: 80px;
  text-align: center;
}

.col-cost {
  width: 100px;
  text-align: right;
}

.col-total {
  width: 120px;
  text-align: right;
  font-weight: bold;
  background-color: #f8f9fa;
}

.col-actions {
  width: 140px;
  text-align: center;
  border-left: 2px solid #dee2e6;
}

/* CELL SPECIFIC STYLES */
.read-only-cell {
  background-color: #f8f9fa;
  color: #6c757d;
  font-style: italic;
}

.actions-cell {
  white-space: nowrap;
  text-align: center;
}

.actions-cell button.small-btn {
  padding: 4px 8px;
  font-size: 0.8em;
  margin: 0 2px;
}

.description-cell {
  max-width: 200px;
  white-space: pre-wrap;
  word-break: break-word;
  font-size: 0.9em;
  color: #495057;
}

.requirements-cell {
  max-width: 150px;
  white-space: normal;
  word-break: break-word;
}

.req-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}

.req-tag {
  background-color: #e0f2f7;
  color: #0288d1;
  padding: 3px 6px;
  border-radius: 3px;
  font-size: 0.75em;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  cursor: help; /* Indicate tooltip */
  border: 1px solid #b3e5fc;
}

.no-description, .no-requirements {
  color: #adb5bd;
  font-style: italic;
}

.no-tasks-message {
  text-align: center;
  padding: 30px;
  color: #6c757d;
  font-style: italic;
  background-color: #f8f9fa;
}

/* DRAG AND DROP STYLES */
.drag-handle-cell {
  width: 30px;
  text-align: center;
  padding-left: 8px;
  padding-right: 8px;
  background-color: #f8f9fa;
}

.drag-handle {
  cursor: grab;
  color: #adb5bd;
  font-size: 0.9em;
}

.drag-handle:hover {
  color: #6c757d;
}

.disabled-drag-handle {
  cursor: default;
  color: #dee2e6;
}

.ghost-drag {
  opacity: 0.5;
  background: #c8ebfb;
}

.task-table tfoot .role-cost-cell {
  font-size: 0.85em;
  text-align: right;
  font-weight: normal;
}
</style>