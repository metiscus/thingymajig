// src/stores/tasksStore.js
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { useRatesStore } from './ratesStore';
import { httpAPI } from '../services/httpAPI'; // <--- NEW IMPORT

export const useTasksStore = defineStore('tasks', () => {
  const tasksList = ref([]);
  const isLoading = ref(false);
  const error = ref(null);
  const ratesStore = useRatesStore();

  async function fetchTasksForProject(projectId) {
    // REMOVE check for window.electronAPI
    if (!projectId) { // Keep projectId check
      tasksList.value = [];
      console.log('[tasksStore] fetchTasksForProject - No projectId, tasksList cleared.');
      return;
    }
    isLoading.value = true; error.value = null;
    try {
      const fetchedDbTasks = await httpAPI.getTasksForProject(projectId); // <--- CHANGE HERE
      tasksList.value = fetchedDbTasks;
      console.log('[tasksStore] Fetched tasks for project, tasksList updated:', JSON.parse(JSON.stringify(tasksList.value)));
    } catch (e) {
      console.error('[tasksStore] Error in fetchTasksForProject:', e);
      error.value = e.message;
      tasksList.value = [];
    } finally { isLoading.value = false; }
  }

  async function saveTask(taskData) {
    // REMOVE check for window.electronAPI
    isLoading.value = true; error.value = null;
    console.log('[tasksStore] Attempting to save taskData:', JSON.parse(JSON.stringify(taskData)));

    try {
      const savedTaskFromBackend = await httpAPI.saveTask(taskData); // <--- CHANGE HERE
      console.log('[tasksStore] Saved task from backend:', savedTaskFromBackend ? JSON.parse(JSON.stringify(savedTaskFromBackend)) : null);

      if (savedTaskFromBackend && taskData.projectId) {
        console.log('[tasksStore] Backend save successful, now fetching tasks for project:', taskData.projectId);
        await fetchTasksForProject(taskData.projectId);
      } else if (!savedTaskFromBackend) {
        console.error('[tasksStore] Backend did not return a saved task object.');
      }
      return savedTaskFromBackend;
    } catch (e) {
      console.error('[tasksStore] Error in saveTask:', e);
      error.value = e.message || 'Failed to save task in store.';
      return null;
    } finally { isLoading.value = false; }
  }

  async function deleteTask(taskId, projectId) {
    // REMOVE check for window.electronAPI
    isLoading.value = true; error.value = null;
    try {
      const result = await httpAPI.deleteTask(taskId); // <--- CHANGE HERE
      if (result.success && projectId) {
        await fetchTasksForProject(projectId);
      }
      return result.success;
    } catch (e) {
      console.error('[tasksStore] Error in deleteTask:', e);
      error.value = e.message; return false;
    } finally { isLoading.value = false; }
  }

  async function updateTaskSequence(tasksToUpdate, projectId) {
    // REMOVE check for window.electronAPI
    isLoading.value = true; error.value = null;
    try {
      const result = await httpAPI.updateTaskSequence(tasksToUpdate); // <--- CHANGE HERE
      if (result.success && projectId) {
         await fetchTasksForProject(projectId);
      }
      return result.success;
    } catch (e) {
      console.error('[tasksStore] Error in updateTaskSequence:', e);
      error.value = e.message; return false;
    } finally { isLoading.value = false; }
  }

  const availableRoles = computed(() => {
    if (!ratesStore.ratesList) return [];
    return ratesStore.ratesList.map(r => r.role).sort();
  });

  const totalDaysPerRoleForCurrentProject = computed(() => {
    const totals = {};
    availableRoles.value.forEach(role => totals[role] = 0);
    (tasksList.value || []).forEach(task => {
      if (task && task.efforts) {
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
    (ratesStore.ratesList || []).forEach(r => {
      if (r && r.role && r.rate !== undefined) {
        roleRates[r.role] = r.unit === 'hour' ? Number(r.rate) * 8 : Number(r.rate);
      }
    });

    availableRoles.value.forEach(role => costs[role] = 0);
    const daysPerRole = totalDaysPerRoleForCurrentProject.value;
    for (const role in daysPerRole) {
      if (roleRates[role] !== undefined) {
        costs[role] = daysPerRole[role] * roleRates[role];
      }
    }
    return costs;
  });

  const totalTravelCostForCurrentProject = computed(() => {
    return (tasksList.value || []).reduce((sum, task) => sum + Number(task?.travelCost || 0), 0);
  });

  const totalMaterialsCostForCurrentProject = computed(() => {
    return (tasksList.value || []).reduce((sum, task) => sum + Number(task?.materialsCost || 0), 0);
  });

  const grandTotalCostForCurrentProject = computed(() => {
    let sumRoleCosts = 0;
    const roleCosts = totalCostPerRoleForCurrentProject.value;
    for (const role in roleCosts) {
      sumRoleCosts += Number(roleCosts[role] || 0);
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