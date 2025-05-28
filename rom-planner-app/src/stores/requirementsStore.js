// src/stores/requirementsStore.js
import { defineStore } from 'pinia';
import { httpAPI } from '../services/httpAPI';
import { useTasksStore } from './tasksStore';

export const useRequirementsStore = defineStore('requirements', {
  state: () => ({
    requirementsList: [],
    isLoading: false,
    error: null,
  }),

  actions: {
    async fetchRequirements(projectId) {
      if (!projectId) {
        this.requirementsList = [];
        return;
      }
      this.isLoading = true;
      this.error = null;
      try {
        const data = await httpAPI.getProjectRequirements(projectId);
        this.requirementsList = data;
      } catch (error) {
        console.error(`Error fetching requirements for project ${projectId}:`, error);
        this.error = 'Failed to fetch requirements.';
      } finally {
        this.isLoading = false;
      }
    },

    async createRequirement(projectId, reqData) {
      if (!projectId) {
        this.error = 'No project selected. Cannot create requirement.';
        return false;
      }
      this.isLoading = true;
      this.error = null;
      try {
        const newReq = await httpAPI.createRequirement(projectId, reqData);
        this.requirementsList.push(newReq);
        this.requirementsList.sort((a,b) => (a.custom_id || '').localeCompare(b.custom_id || ''));
        return true;
      } catch (error) {
        console.error('Error creating requirement:', error);
        this.error = `Failed to create requirement: ${error.detail || error.message}`;
        return false;
      } finally {
        this.isLoading = false;
      }
    },

    async updateRequirement(requirementId, reqData) {
      this.isLoading = true;
      this.error = null;
      try {
        const updatedReq = await httpAPI.updateRequirement(requirementId, reqData);
        const index = this.requirementsList.findIndex(req => req.id === updatedReq.id);
        if (index !== -1) {
          this.requirementsList[index] = updatedReq;
          // Also update any tasks that might be displaying this requirement
          const tasksStore = useTasksStore();
          tasksStore.updateTaskRequirement(updatedReq); // Call a method in tasksStore to update
        }
        return true;
      } catch (error) {
        console.error('Error updating requirement:', error);
        this.error = `Failed to update requirement: ${error.detail || error.message}`;
        return false;
      } finally {
        this.isLoading = false;
      }
    },

    async deleteRequirement(requirementId) {
      this.isLoading = true;
      this.error = null;
      try {
        const result = await httpAPI.deleteRequirement(requirementId);
        if (result.success) {
          this.requirementsList = this.requirementsList.filter(req => req.id !== requirementId);
          // Also remove this requirement from any tasks that were linked to it
          const tasksStore = useTasksStore();
          tasksStore.removeRequirementFromAllTasks(requirementId); // Call a method in tasksStore to update
        } else {
          throw new Error('Deletion failed on server.');
        }
        return true;
      } catch (error) {
        console.error(`Error deleting requirement ${requirementId}:`, error);
        this.error = `Failed to delete requirement: ${error.detail || error.message}`;
        return false;
      } finally {
        this.isLoading = false;
      }
    },

    clearState() {
      this.requirementsList = [];
      this.isLoading = false;
      this.error = null;
    }
  },
});
