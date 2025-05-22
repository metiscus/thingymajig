// src/stores/projectsStore.js
import { defineStore } from 'pinia';
import { ref } from 'vue';
import { useTasksStore } from './tasksStore';
import { useMaterialItemsStore } from './materialItemsStore';
import { httpAPI } from '../services/httpAPI'; // <--- NEW IMPORT

export const useProjectsStore = defineStore('projects', () => {
  const projectsList = ref([]);
  const currentProject = ref(null);
  const isEditingNewProject = ref(false);
  const isLoading = ref(false);
  const isExporting = ref(false);
  const error = ref(null);

  const tasksStore = useTasksStore();
  const materialItemsStore = useMaterialItemsStore();

  async function fetchProjects() {
    // REMOVE check for window.electronAPI
    isLoading.value = true; error.value = null;
    try {
      const fetched = await httpAPI.getProjects(); // <--- CHANGE HERE
      projectsList.value = fetched.map(p => ({ ...p, riskPercentage: Number(p.riskPercentage || 0) }));
    } catch (e) {
      console.error('Failed to fetch projects:', e); // Log the error for debugging
      error.value = e.message;
    } finally { isLoading.value = false; }
  }

  async function saveProject(projectData) {
    // REMOVE check for window.electronAPI
    isLoading.value = true; error.value = null;
    try {
      const dataToSave = {
        ...projectData,
        riskPercentage: parseFloat(projectData.riskPercentage) || 0,
      };
      const savedProject = await httpAPI.saveProject(dataToSave); // <--- CHANGE HERE
      await fetchProjects();
      
      if (savedProject) {
        const updatedProjectInList = projectsList.value.find(p => p.id === savedProject.id);
        if (updatedProjectInList) {
            selectProject(updatedProjectInList);
        } else {
            isEditingNewProject.value = false;
        }
      } else {
        isEditingNewProject.value = false;
      }
      return savedProject;
    } catch (e) {
      console.error('Failed to save project:', e); // Log the error for debugging
      error.value = e.message; return null;
    } finally { isLoading.value = false; }
  }

  async function deleteProject(projectId) {
    // REMOVE check for window.electronAPI
    isLoading.value = true; error.value = null;
    try {
      const result = await httpAPI.deleteProject(projectId); // <--- CHANGE HERE
      if (result.success) {
        await fetchProjects();
        if (currentProject.value && currentProject.value.id === projectId) {
          currentProject.value = null;
          isEditingNewProject.value = false;
          tasksStore.tasksList = [];
          materialItemsStore.materialItemsList = [];
        }
      }
      return result.success;
    } catch (e) {
      console.error('Failed to delete project:', e); // Log the error for debugging
      error.value = e.message; return false;
    } finally { isLoading.value = false; }
  }

  function selectProject(project) {
    currentProject.value = project ? { ...project, riskPercentage: Number(project.riskPercentage || 0) } : null;
    isEditingNewProject.value = false;
    if (project) {
      tasksStore.fetchTasksForProject(project.id);
      materialItemsStore.fetchMaterialItemsForProject(project.id);
    } else {
      tasksStore.tasksList = [];
      materialItemsStore.materialItemsList = [];
    }
  }

  function startNewProject() {
    currentProject.value = {
        id: null,
        name: '',
        description: '',
        riskPercentage: 0,
        createdAt: new Date().toISOString()
    };
    isEditingNewProject.value = true;
    tasksStore.tasksList = [];
    materialItemsStore.materialItemsList = [];
  }

  function cancelNewProjectEdit() {
    if (isEditingNewProject.value) {
        currentProject.value = null;
        isEditingNewProject.value = false;
    }
  }

  async function exportProject(projectId) {
    // REMOVE check for window.electronAPI
    isExporting.value = true;
    error.value = null;
    try {
        // httpAPI.exportProjectToExcel handles the file download directly in the browser
        const result = await httpAPI.exportProjectToExcel(projectId); // <--- CHANGE HERE
        if (result.success) {
            alert('Project exported successfully.'); // File download is handled by the browser
        } else {
            alert('Export failed: ' + (result.error || 'Unknown error.'));
        }
    } catch (e) {
        console.error('Error during project export:', e); // Log the error for debugging
        error.value = e.message || 'An unexpected error occurred during export.';
        alert('An error occurred during export: ' + e.message);
    } finally {
        isExporting.value = false;
    }
  }


  return {
    projectsList, currentProject, isLoading, error, isEditingNewProject, isExporting,
    fetchProjects, saveProject, deleteProject, selectProject, startNewProject, cancelNewProjectEdit,
    exportProject
  };
});