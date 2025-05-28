// src/stores/rfiDocumentsStore.js
import { defineStore } from 'pinia';
import { httpAPI } from '../services/httpAPI';
import { useProjectsStore } from './projectsStore'; // To refresh project data if needed after process

export const useRfiDocumentsStore = defineStore('rfiDocuments', {
  state: () => ({
    rfiDocumentsList: [],
    isLoading: false,
    error: null,
    isProcessing: false,
    processingDocId: null,
  }),

  actions: {
    async fetchRfiDocuments(projectId) {
      if (!projectId) {
        this.rfiDocumentsList = [];
        return;
      }
      this.isLoading = true;
      this.error = null;
      try {
        const data = await httpAPI.getProjectRfiDocuments(projectId);
        this.rfiDocumentsList = data;
      } catch (error) {
        console.error(`Error fetching RFI documents for project ${projectId}:`, error);
        this.error = 'Failed to fetch RFI documents.';
      } finally {
        this.isLoading = false;
      }
    },

    async uploadRfiDocument(projectId, file) {
      if (!projectId) {
        this.error = 'No project selected. Cannot upload RFI.';
        return false;
      }
      this.isLoading = true;
      this.error = null;
      try {
        const newDoc = await httpAPI.uploadRfiDocument(projectId, file);
        this.rfiDocumentsList.push(newDoc);
        this.rfiDocumentsList.sort((a,b) => a.uploaded_at.localeCompare(b.uploaded_at)); // Keep sorted by date
        return true;
      } catch (error) {
        console.error('Error uploading RFI document:', error);
        this.error = `Failed to upload document: ${error.detail || error.message}`;
        return false;
      } finally {
        this.isLoading = false;
      }
    },

    async deleteRfiDocument(projectId, docId) {
      if (!projectId) {
        this.error = 'No project selected. Cannot delete RFI.';
        return false;
      }
      this.isLoading = true;
      this.error = null;
      try {
        const result = await httpAPI.deleteRfiDocument(projectId, docId);
        if (result.success) {
          this.rfiDocumentsList = this.rfiDocumentsList.filter(doc => doc.id !== docId);
          return true;
        } else {
          throw new Error('Deletion failed on server.');
        }
      } catch (error) {
        console.error(`Error deleting RFI document ${docId}:`, error);
        this.error = `Failed to delete document: ${error.detail || error.message}`;
        return false;
      } finally {
        this.isLoading = false;
      }
    },

    async processRfiDocument(projectId, docId, overwriteTasks) {
      if (!projectId || !docId) {
        this.error = 'Invalid project or document ID. Cannot process RFI.';
        return false;
      }
      this.isProcessing = true;
      this.processingDocId = docId;
      this.error = null;
      try {
        const response = await httpAPI.processRfiDocument(projectId, docId, overwriteTasks);
        
        // Update the last_processed_at for the document
        const index = this.rfiDocumentsList.findIndex(doc => doc.id === docId);
        if (index !== -1) {
          this.rfiDocumentsList[index].last_processed_at = new Date().toISOString(); // Update timestamp locally
        }

        // Trigger re-fetch of tasks and requirements for the current project
        const projectsStore = useProjectsStore();
        if (projectsStore.currentProject && projectsStore.currentProject.id === projectId) {
            projectsStore.fetchProjects(); // To ensure current project is updated with new relationships if any
            // Force reload tasks and requirements which are external stores
            // Consider direct calls if tasks/requirements stores are not automatically reacting
            // e.g., useTasksStore().fetchTasksForProject(projectId);
            // useRequirementsStore().fetchRequirements(projectId);
        }

        alert(response.message || 'RFI processing started successfully!');
        return true;
      } catch (error) {
        console.error(`Error processing RFI document ${docId}:`, error);
        this.error = `Failed to process document: ${error.detail || error.message}`;
        return false;
      } finally {
        this.isProcessing = false;
        this.processingDocId = null;
      }
    },

    clearState() {
      this.rfiDocumentsList = [];
      this.isLoading = false;
      this.error = null;
      this.isProcessing = false;
      this.processingDocId = null;
    }
  },
});