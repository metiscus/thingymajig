// src/stores/tasksStore.js
import { defineStore } from 'pinia';
import { httpAPI } from '../services/httpAPI';
import { useRatesStore } from './ratesStore';
import { useProjectsStore } from './projectsStore';

export const useTasksStore = defineStore('tasks', {
  state: () => ({
    tasksList: [],
    isLoading: false,
    error: null,
  }),

  getters: {
    availableRoles: (state) => {
      const ratesStore = useRatesStore();
      return [...new Set(ratesStore.ratesList.map(rate => rate.role))];
    },

    totalDaysPerRoleForCurrentProject: (state) => {
      const totals = {};
      state.tasksList.forEach(task => {
        if (task.efforts) {
          for (const role in task.efforts) {
            totals[role] = (totals[role] || 0) + Number(task.efforts[role] || 0);
          }
        }
      });
      return totals;
    },

    totalCostPerRoleForCurrentProject: (state) => {
      const ratesStore = useRatesStore();
      const roleRatesMap = ratesStore.ratesList.reduce((acc, r) => {
        if (r && r.role) {
          acc[r.role] = r.unit === 'hour' ? (Number(r.rate || 0) * 8) : Number(r.rate || 0);
        }
        return acc;
      }, {});

      const costs = {};
      for (const role in state.totalDaysPerRoleForCurrentProject) {
        const rate = roleRatesMap[role] || 0;
        costs[role] = state.totalDaysPerRoleForCurrentProject[role] * rate;
      }
      return costs;
    },

    totalTravelCostForCurrentProject: (state) => {
      return state.tasksList.reduce((total, task) => total + Number(task.travelCost || 0), 0);
    },

    totalMaterialsCostForCurrentProject: (state) => {
      return state.tasksList.reduce((total, task) => total + Number(task.materialsCost || 0), 0);
    },

    grandTotalCostForCurrentProject: (state) => {
      const laborCost = Object.values(state.totalCostPerRoleForCurrentProject).reduce((sum, cost) => sum + cost, 0);
      return laborCost + state.totalTravelCostForCurrentProject + state.totalMaterialsCostForCurrentProject;
    },
  },

  actions: {
    async fetchTasksForProject(projectId) {
      if (!projectId) {
        this.tasksList = [];
        return;
      }
      this.isLoading = true;
      this.error = null;
      try {
        const data = await httpAPI.getTasksForProject(projectId);
        this.tasksList = data;
      } catch (error) {
        console.error(`Error fetching tasks for project ${projectId}:`, error);
        this.error = 'Failed to fetch tasks.';
      } finally {
        this.isLoading = false;
      }
    },

    async saveTask(taskData, selectedRequirementIds = []) { // NEW: added selectedRequirementIds param
      this.isLoading = true;
      this.error = null;
      try {
        const savedTask = await httpAPI.saveTask(taskData);
        
        // NEW: Update task requirements
        const updateRequirementsPromise = httpAPI.setTaskRequirements(savedTask.id, selectedRequirementIds);
        
        // Wait for both task save and requirement linking to complete
        const [ updatedTaskWithRequirements ] = await Promise.all([
            httpAPI.getTasksForProject(savedTask.projectId).then(tasks => tasks.find(t => t.id === savedTask.id)), // Refetch individual task with requirements
            updateRequirementsPromise
        ]);

        if (taskData.id) {
          const index = this.tasksList.findIndex(task => task.id === updatedTaskWithRequirements.id);
          if (index !== -1) {
            this.tasksList[index] = updatedTaskWithRequirements;
          }
        } else {
          this.tasksList.push(updatedTaskWithRequirements);
        }
        // Re-sort based on sequence after adding/updating
        this.tasksList.sort((a, b) => a.sequence - b.sequence);
        
        return true;
      } catch (error) {
        console.error('Error saving task:', error);
        this.error = `Failed to save task: ${error.detail || error.message}`;
        return false;
      } finally {
        this.isLoading = false;
      }
    },

    async deleteTask(taskId, projectId) {
      this.isLoading = true;
      this.error = null;
      try {
        const result = await httpAPI.deleteTask(taskId);
        if (result.success) {
          this.tasksList = this.tasksList.filter(task => task.id !== taskId);
          // Re-sequence remaining tasks
          const tasksToUpdate = this.tasksList.map((task, index) => ({
            id: task.id,
            sequence: index,
          }));
          await httpAPI.updateTaskSequence(tasksToUpdate);
        } else {
          throw new Error('Deletion failed on server.');
        }
        return true;
      } catch (error) {
        console.error('Error deleting task:', error);
        this.error = `Failed to delete task: ${error.detail || error.message}`;
        return false;
      } finally {
        this.isLoading = false;
      }
    },

    async updateTaskSequence(tasksToUpdate) {
      this.error = null;
      try {
        // Optimistic update
        tasksToUpdate.forEach(updatedTask => {
          const index = this.tasksList.findIndex(task => task.id === updatedTask.id);
          if (index !== -1) {
            this.tasksList[index].sequence = updatedTask.sequence;
          }
        });
        this.tasksList.sort((a, b) => a.sequence - b.sequence); // Ensure client-side order

        await httpAPI.updateTaskSequence(tasksToUpdate);
        return true;
      } catch (error) {
        console.error('Error updating task sequence:', error);
        this.error = `Failed to update task sequence: ${error.detail || error.message}`;
        // Re-fetch to revert to server state if error occurs
        const projectsStore = useProjectsStore();
        if (projectsStore.currentProject?.id) {
            this.fetchTasksForProject(projectsStore.currentProject.id);
        }
        return false;
      }
    },

    // NEW: Actions for managing requirements within tasks locally (triggered by requirements store)
    updateTaskRequirement(updatedRequirement) {
        this.tasksList.forEach(task => {
            const index = task.requirements.findIndex(req => req.id === updatedRequirement.id);
            if (index !== -1) {
                task.requirements[index] = updatedRequirement;
            }
        });
    },

    removeRequirementFromAllTasks(requirementId) {
        this.tasksList.forEach(task => {
            task.requirements = task.requirements.filter(req => req.id !== requirementId);
        });
    },

    clearState() {
      this.tasksList = [];
      this.isLoading = false;
      this.error = null;
    }
  },
});