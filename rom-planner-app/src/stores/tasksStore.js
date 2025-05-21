// src/stores/tasksStore.js
import { defineStore } from 'pinia';
import { ref, computed } from 'vue'; // Ensure computed is imported if used
import { useRatesStore } from './ratesStore'; // To use for calculations

export const useTasksStore = defineStore('tasks', () => {
  const tasksList = ref([]); // Tasks for the currently selected project
  const isLoading = ref(false);
  const error = ref(null);
  const ratesStore = useRatesStore(); // Access rates for calculations

  async function fetchTasksForProject(projectId) {
    if (!window.electronAPI || !projectId) {
      tasksList.value = [];
      console.log('[tasksStore] fetchTasksForProject - No projectId or electronAPI, tasksList cleared.');
      return;
    }
    isLoading.value = true; error.value = null;
    try {
      const fetchedDbTasks = await window.electronAPI.getTasksForProject(projectId);
      tasksList.value = fetchedDbTasks; // Assign the new array
      // Defensive copy for logging to avoid issues if fetchedDbTasks is mutated elsewhere unexpectedly
      console.log('[tasksStore] Fetched tasks for project, tasksList updated:', JSON.parse(JSON.stringify(tasksList.value)));
    } catch (e) {
      console.error('[tasksStore] Error in fetchTasksForProject:', e);
      error.value = e.message;
      tasksList.value = [];
    }
    finally { isLoading.value = false; }
  }

  async function saveTask(taskData) { // taskData is expected to be a plain object
    if (!window.electronAPI) {
      console.error('[tasksStore] saveTask - electronAPI not available.');
      return null;
    }
    isLoading.value = true; error.value = null;
    console.log('[tasksStore] Attempting to save taskData:', JSON.parse(JSON.stringify(taskData))); // Log data being sent to backend

    try {
      const savedTaskFromBackend = await window.electronAPI.saveTask(taskData);
      // Defensive copy for logging
      console.log('[tasksStore] Saved task from backend:', savedTaskFromBackend ? JSON.parse(JSON.stringify(savedTaskFromBackend)) : null);

      if (savedTaskFromBackend && taskData.projectId) {
        console.log('[tasksStore] Backend save successful, now fetching tasks for project:', taskData.projectId);
        await fetchTasksForProject(taskData.projectId); // This should update tasksList
      } else if (!savedTaskFromBackend) {
        console.error('[tasksStore] Backend did not return a saved task object.');
        // Potentially throw an error or set error.value here
      }
      return savedTaskFromBackend; // Return the task with its DB ID
    } catch (e) {
      console.error('[tasksStore] Error in saveTask:', e);
      error.value = e.message || 'Failed to save task in store.';
      return null;
    }
    finally { isLoading.value = false; }
  }

  async function deleteTask(taskId, projectId) {
    if (!window.electronAPI) return false;
    isLoading.value = true; error.value = null;
    try {
      const result = await window.electronAPI.deleteTask(taskId);
      if (result.success && projectId) {
        await fetchTasksForProject(projectId);
      }
      return result.success;
    } catch (e) { error.value = e.message; return false; }
    finally { isLoading.value = false; }
  }

  async function updateTaskSequence(tasksToUpdate, projectId) {
    if (!window.electronAPI) return false;
    isLoading.value = true; error.value = null;
    try {
      const result = await window.electronAPI.updateTaskSequence(tasksToUpdate);
      if (result.success && projectId) {
         await fetchTasksForProject(projectId);
      }
      return result.success;
    } catch (e) { error.value = e.message; return false; }
     finally { isLoading.value = false; }
  }

  const availableRoles = computed(() => {
    if (!ratesStore.ratesList) return [];
    return ratesStore.ratesList.map(r => r.role).sort();
  });

  const totalDaysPerRoleForCurrentProject = computed(() => {
    const totals = {};
    availableRoles.value.forEach(role => totals[role] = 0);
    (tasksList.value || []).forEach(task => { // Add guard for tasksList.value
      if (task && task.efforts) { // Add guard for task and task.efforts
        for (const role in task.efforts) {
          if (totals.hasOwnProperty(role)) {
            totals[role] += Number(task.efforts[role] || 0);
          }
        }
      }
    });
    return totals;
  });

  const totalCostPerRoleForCurrentProject = computed(() => {
    const costs = {};
    const roleRates = {};
    (ratesStore.ratesList || []).forEach(r => { // Add guard for ratesStore.ratesList
      if (r && r.role && r.rate !== undefined) { // Add guard for r and its properties
        roleRates[r.role] = r.unit === 'hour' ? Number(r.rate) * 8 : Number(r.rate);
      }
    });

    availableRoles.value.forEach(role => costs[role] = 0);
    const daysPerRole = totalDaysPerRoleForCurrentProject.value;
    for (const role in daysPerRole) {
      if (roleRates[role] !== undefined) { // Check if rate exists
        costs[role] = daysPerRole[role] * roleRates[role];
      }
    }
    return costs;
  });

  const totalTravelCostForCurrentProject = computed(() => {
    return (tasksList.value || []).reduce((sum, task) => sum + Number(task?.travelCost || 0), 0); // Add guard
  });

  const totalMaterialsCostForCurrentProject = computed(() => {
    return (tasksList.value || []).reduce((sum, task) => sum + Number(task?.materialsCost || 0), 0); // Add guard
  });

  const grandTotalCostForCurrentProject = computed(() => {
    let sumRoleCosts = 0;
    const roleCosts = totalCostPerRoleForCurrentProject.value;
    for (const role in roleCosts) {
      sumRoleCosts += Number(roleCosts[role] || 0); // Add guard
    }
    return sumRoleCosts + totalTravelCostForCurrentProject.value + totalMaterialsCostForCurrentProject.value;
  });

  return {
    tasksList, isLoading, error,
    fetchTasksForProject, saveTask, deleteTask, updateTaskSequence,
    availableRoles,
    totalDaysPerRoleForCurrentProject,
    totalCostPerRoleForCurrentProject,
    totalTravelCostForCurrentProject,
    totalMaterialsCostForCurrentProject,
    grandTotalCostForCurrentProject
  };
});