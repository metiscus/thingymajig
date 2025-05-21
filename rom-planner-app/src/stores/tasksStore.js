// src/stores/tasksStore.js
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { useRatesStore } from './ratesStore'; // To use for calculations

export const useTasksStore = defineStore('tasks', () => {
  const tasksList = ref([]); // Tasks for the currently selected project
  const isLoading = ref(false);
  const error = ref(null);
  const ratesStore = useRatesStore(); // Access rates for calculations

  async function fetchTasksForProject(projectId) {
    if (!window.electronAPI || !projectId) {
      tasksList.value = [];
      return;
    }
    isLoading.value = true; error.value = null;
    try {
      tasksList.value = await window.electronAPI.getTasksForProject(projectId);
    } catch (e) { error.value = e.message; tasksList.value = []; }
    finally { isLoading.value = false; }
  }

  async function saveTask(taskData) {
    if (!window.electronAPI) return null;
    isLoading.value = true; error.value = null;
    try {
      console.log('--- Sending taskData to main process ---');
      console.log('Type of taskData:', typeof taskData, taskData);
      // Log each property to inspect it, especially nested objects
      for (const key in taskData) {
          console.log(`taskData.${key}:`, typeof taskData[key], taskData[key]);
          if (typeof taskData[key] === 'object' && taskData[key] !== null) {
              console.log(`   Is ${key} a Vue proxy?`, taskData[key].__v_isReactive !== undefined || taskData[key].__v_isRef !== undefined);
              // For efforts object specifically
              if (key === 'efforts') {
                  for (const effortKey in taskData[key]) {
                      console.log(`   taskData.efforts.${effortKey}:`, typeof taskData[key][effortKey], taskData[key][effortKey]);
                  }
              }
          }
      }
      // Use JSON.stringify as a test for plain data
      try {
          const jsonString = JSON.stringify(taskData);
          console.log('taskData as JSON string (if successful):', jsonString);
          // If this works, the object is likely cloneable or close to it.
          // You can then try sending the parsed version:
          // const plainTaskData = JSON.parse(jsonString);
          // const savedTask = await window.electronAPI.saveTask(plainTaskData);
      } catch (e) {
          console.error('!!! taskData is NOT stringifiable, likely contains non-cloneable parts:', e);
          // This indicates the problem area.
      }

      const savedTask = await window.electronAPI.saveTask(taskData);
      // Re-fetch or update locally. For simplicity, re-fetch if projectId context is clear.
      if (savedTask && taskData.projectId) {
        await fetchTasksForProject(taskData.projectId);
      }
      return savedTask;
    } catch (e) { error.value = e.message; return null; }
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
         await fetchTasksForProject(projectId); // Re-fetch to reflect new order
      }
      return result.success;
    } catch (e) { error.value = e.message; return false; }
     finally { isLoading.value = false; }
  }


  // --- Computed Properties for Totals (Example) ---
  const availableRoles = computed(() => {
    if (!ratesStore.ratesList) return [];
    return ratesStore.ratesList.map(r => r.role).sort();
  });

  const totalDaysPerRoleForCurrentProject = computed(() => {
    const totals = {};
    availableRoles.value.forEach(role => totals[role] = 0);
    tasksList.value.forEach(task => {
      for (const role in task.efforts) {
        if (totals.hasOwnProperty(role)) {
          totals[role] += Number(task.efforts[role] || 0);
        }
      }
    });
    return totals;
  });

  const totalCostPerRoleForCurrentProject = computed(() => {
    const costs = {};
    const roleRates = {};
    ratesStore.ratesList.forEach(r => {
      // Assuming daily rates for now for simplicity. Need to handle hourly vs daily properly.
      // For now, if unit is 'hour', let's assume 8 hours = 1 day rate equivalent
      // This logic needs to be robust based on your rate units.
      roleRates[r.role] = r.unit === 'hour' ? r.rate * 8 : r.rate;
    });

    availableRoles.value.forEach(role => costs[role] = 0);
    const daysPerRole = totalDaysPerRoleForCurrentProject.value;
    for (const role in daysPerRole) {
      if (roleRates[role]) {
        costs[role] = daysPerRole[role] * roleRates[role];
      }
    }
    return costs;
  });
  
  const totalTravelCostForCurrentProject = computed(() => {
    return tasksList.value.reduce((sum, task) => sum + Number(task.travelCost || 0), 0);
  });
  
  const totalMaterialsCostForCurrentProject = computed(() => {
    return tasksList.value.reduce((sum, task) => sum + Number(task.materialsCost || 0), 0);
  });

  const grandTotalCostForCurrentProject = computed(() => {
    let sumRoleCosts = 0;
    const roleCosts = totalCostPerRoleForCurrentProject.value;
    for (const role in roleCosts) {
      sumRoleCosts += roleCosts[role];
    }
    return sumRoleCosts + totalTravelCostForCurrentProject.value + totalMaterialsCostForCurrentProject.value;
  });


  return {
    tasksList, isLoading, error,
    fetchTasksForProject, saveTask, deleteTask, updateTaskSequence,
    availableRoles, // To populate columns dynamically
    totalDaysPerRoleForCurrentProject,
    totalCostPerRoleForCurrentProject,
    totalTravelCostForCurrentProject,
    totalMaterialsCostForCurrentProject,
    grandTotalCostForCurrentProject
  };
});