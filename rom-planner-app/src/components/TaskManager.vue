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
            <!-- {{ console.log(`[v-for rendering] Task ID: ${task.id}, Index: ${index}, Name: ${task.name}`) }} -->
            <template v-if="editingTaskId === task.id">
              <td class="drag-handle-cell"><i class="fas fa-grip-vertical drag-handle disabled-drag-handle"></i></td>
              <td><input type="text" v-model="editableTaskData.name" required ref="firstEditableInput" /></td>
              <td><input type="text" v-model="editableTaskData.description" /></td>
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
                <td :colspan="7 + tasksStore.availableRoles.length" class="no-tasks-message"> 
                    No tasks in this project yet.
                </td>
            </tr>
        </tbody>

        <tbody v-if="editingTaskId === 'new'">
          <tr class="editing-row new-task-row">
            <td class="drag-handle-cell"><i class="fas fa-grip-vertical disabled-drag-handle"></i></td>
            <td><input type="text" v-model="editableTaskData.name" placeholder="New Task Name" required ref="firstEditableInput"/></td>
            <td><input type="text" v-model="editableTaskData.description" placeholder="Description" /></td>
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
            <th colspan="2">Project Totals:</th>
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
              <th colspan="2">Cost per Role:</th>
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
import Sortable from 'sortablejs'; // Import SortableJS
import { useProjectsStore } from '../stores/projectsStore';
import { useTasksStore } from '../stores/tasksStore';
import { useRatesStore } from '../stores/ratesStore';

const projectsStore = useProjectsStore();
const tasksStore = useTasksStore();
const ratesStore = useRatesStore();

const editingTaskId = ref(null);
const editableTaskData = ref(null);
const firstEditableInput = ref(null);
const localTasks = ref([]);
const tasksTbody = ref(null); // Template ref for the tbody element
let sortableInstance = null;

watch(() => tasksStore.tasksList, (newTasksFromStore) => {
  localTasks.value = Array.isArray(newTasksFromStore) ? [...newTasksFromStore] : [];
  // console.log('[TaskManager] Updated localTasks. Length:', localTasks.value.length);
  // if (localTasks.value.length > 0) {
  //   localTasks.value.forEach(t => console.log(`  Task ID: ${t.id}, Type: ${typeof t.id}, Name: ${t.name}`));
  // }

  // Re-initialize SortableJS if tasksTbody is available and tasks have loaded
  // This is important if tasks load after component is mounted
  if (tasksTbody.value && localTasks.value.length > 0) {
    initSortable();
  }
}, { deep: true, immediate: true });

const initSortable = () => {
  if (sortableInstance) {
    sortableInstance.destroy(); // Destroy previous instance if exists
  }
  if (tasksTbody.value) { // Ensure the element is available
    sortableInstance = Sortable.create(tasksTbody.value, {
      handle: '.drag-handle', // Class of the element to use as a drag handle
      animation: 150,
      ghostClass: 'ghost-drag', // Class for the drop placeholder
      filter: '.disabled-drag-handle', // Elements with this class won't be draggable (e.g., when editing)
      preventOnFilter: true,
      onEnd: async (evt) => {
        // console.log('[SortableJS onEnd] Event:', evt);
        if (evt.oldIndex === undefined || evt.newIndex === undefined || evt.oldIndex === evt.newIndex) {
          return; // No change in position
        }
        
        // Manually update localTasks order based on DOM reorder by SortableJS
        const movedItem = localTasks.value.splice(evt.oldIndex, 1)[0];
        localTasks.value.splice(evt.newIndex, 0, movedItem);

        // Now update the sequence in the backend
        const tasksToUpdateSequence = localTasks.value.map((task, index) => ({
          id: task.id,
          sequence: index,
        }));
        if (projectsStore.currentProject?.id) {
          await tasksStore.updateTaskSequence(tasksToUpdateSequence, projectsStore.currentProject.id);
        }
      },
      // Disable dragging if any task is being edited
      onStart: (evt) => {
        if (editingTaskId.value) {
          // To prevent dragging when an item is being edited.
          // SortableJS doesn't have a reactive 'disabled' prop like vuedraggable.
          // We can try to prevent the drag from starting.
          // This might need more robust handling or disabling sortable instance when editing starts.
          return false; // Attempt to prevent drag
        }
      },
    });
  } else {
    // console.warn('[SortableJS] tasksTbody ref not available for initSortable.');
  }
};

onMounted(() => {
  if (!ratesStore.ratesList || ratesStore.ratesList.length === 0) {
    ratesStore.fetchRates();
  }
  // Initial SortableJS setup if tasks are already present (e.g. from immediate watcher)
  // and tbody is rendered.
  nextTick(() => { // Ensure DOM is ready
    if (localTasks.value.length > 0 && tasksTbody.value) {
        initSortable();
    }
  });
});

// Watch for editingTaskId to potentially disable/enable sortable
watch(editingTaskId, (isEditing) => {
    if (sortableInstance) {
        // SortableJS's 'disabled' option is set at creation.
        // To disable/enable dynamically, we might need to destroy and recreate,
        // or use the 'filter' option effectively.
        // For now, the onStart event tries to prevent dragging.
        // A more robust way is to set sortableInstance.option('disabled', !!isEditing);
        // if the library supports it reactively, or destroy/recreate.
        // Let's try the option method:
        try {
            sortableInstance.option('disabled', !!isEditing);
        } catch (e) {
            // console.warn("Failed to set sortable option 'disabled'. May need destroy/recreate.", e)
        }
    }
});


onBeforeUnmount(() => {
  if (sortableInstance) {
    sortableInstance.destroy(); // Clean up SortableJS instance
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
  };
};

const focusFirstInput = async () => {
  await nextTick();
  if (firstEditableInput.value) {
    firstEditableInput.value.focus();
    if (typeof firstEditableInput.value.select === 'function') {
      firstEditableInput.value.select();
    }
  }
};

watch(() => projectsStore.currentProject, (newProject) => {
  cancelEdit();
  if (sortableInstance) { // Destroy sortable instance for old project
      sortableInstance.destroy();
      sortableInstance = null;
  }
  if (newProject) {
    tasksStore.fetchTasksForProject(newProject.id).then(() => {
        nextTick(() => { // Ensure DOM has updated with new tasks before initSortable
            if (localTasks.value.length > 0 && tasksTbody.value) {
                 initSortable();
            }
        });
    });
  } else {
    tasksStore.tasksList = [];
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

const prepareNewTask = () => {
  if (editingTaskId.value) return;
  editableTaskData.value = createDefaultEditableTask();
  if (!projectsStore.currentProject?.id) {
    alert("Please select a project first.");
    return;
  }
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
  editableTaskData.value = plainTaskCopy;
  editableTaskData.value.sequence = task.sequence !== undefined ? task.sequence : index; 
  editingTaskId.value = task.id;
  focusFirstInput();
};

const saveEditedTask = async () => {
  // NEW CHECK: Only proceed if an edit was intended
  if (!editingTaskId.value || !editableTaskData.value) {
    // console.log('[saveEditedTask] Called but no active edit. Bailing out.');
    // This might happen if form submitted due to focus shift after delete/re-render
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
  if (editingTaskId.value === 'new') {
    taskToSave.id = null;
  }
  const saved = await tasksStore.saveTask(taskToSave); // This will trigger fetch and re-init sortable via watcher
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
    console.log('After delete, active element is:', document.activeElement);
  }
};

// calculateTaskTotalDays, calculateTaskTotalCost, formatCurrency remain the same
const calculateTaskTotalDays = (task) => { /* ... same ... */ if (!task || !task.efforts) return 0; return Object.values(task.efforts).reduce((sum, effort) => sum + Number(effort || 0), 0); };
const calculateTaskTotalCost = (task) => { /* ... same ... */ if (!task || !task.efforts || !ratesStore.ratesList || ratesStore.ratesList.length === 0) return 0; let cost = 0; const roleRatesMap = ratesStore.ratesList.reduce((acc, r) => { if (r && r.role) { acc[r.role] = r.unit === 'hour' ? (Number(r.rate || 0) * 8) : Number(r.rate || 0); } return acc; }, {}); for (const role in task.efforts) { if (roleRatesMap[role] !== undefined && task.efforts[role]) { cost += Number(task.efforts[role]) * roleRatesMap[role]; } } cost += Number(task.travelCost || 0); cost += Number(task.materialsCost || 0); return cost; };
const formatCurrency = (value) => { /* ... same ... */ return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value || 0); };


defineExpose({ saveEditedTask, cancelEdit });

</script>

<style scoped>
/* Styles from previous full CSS, adapted slightly */
.add-task-controls { margin-bottom: 15px; display: flex; align-items: center; }
.editing-hint { margin-left: 10px; font-size: 0.9em; color: #777; }
.task-table.editable-table td input[type="text"],
.task-table.editable-table td input[type="number"] {
  width: 100%; padding: 6px 8px; margin: 0px -8px; /* Counteract cell padding */
  border: 1px solid #3498db; font-size: inherit; height: calc(100% + 12px); /* Fill cell */
  box-sizing: border-box;
}
.task-table.editable-table td { vertical-align: middle; } /* Better for inputs */
.editing-row { background-color: #e6f7ff !important; }
.new-task-row td { padding-top: 10px; padding-bottom: 10px; } /* More space for new row inputs */
.actions-cell { white-space: nowrap; text-align: right; }
.actions-cell button.small-btn { padding: 5px 8px; font-size: 0.85em; margin-left: 4px; }
.actions-cell button.small-btn i { margin-right: 4px; }
.read-only-cell { color: #555; font-style: italic; }
.description-cell { max-width: 250px; white-space: normal; font-size: 0.9em; color: #444; }
.no-description { color: #aaa; font-style: italic; }
.no-tasks-message { text-align: center; padding: 20px; color: #777; font-style: italic; }
.col-drag-handle { width: 30px; }
.col-name { width: 20%; }
.col-description { width: 25%; }
.col-effort { width: auto; min-width: 70px; text-align: center; }
.col-cost { width: 10%; text-align: right; }
.col-total { width: 10%; text-align: right; font-weight: bold; }
.col-actions { width: auto; min-width: 120px; text-align: center;}
.task-table tfoot .role-cost-cell { font-size: 0.85em; text-align: right; font-weight: normal; }
.drag-handle-cell { width: 30px; text-align: center; padding-left: 8px; padding-right: 8px; }
.drag-handle { cursor: grab; color: #aaa; }
.drag-handle:hover { color: #777; }
.disabled-drag-handle { cursor: default; color: #ddd; }
.ghost-drag { opacity: 0.5; background: #c8ebfb; } /* SortableJS ghost class */
.sortable-chosen { /* SortableJS class for the item being dragged */ }
</style>