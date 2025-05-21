// src/stores/projectsStore.js
import { defineStore } from 'pinia';
import { ref } from 'vue';

export const useProjectsStore = defineStore('projects', () => {
  const projectsList = ref([]);
  const currentProject = ref(null); // To hold the currently selected project
  const isLoading = ref(false);
  const error = ref(null);

  async function fetchProjects() {
    if (!window.electronAPI) return; // Handle browser-only mode if needed
    isLoading.value = true; error.value = null;
    try {
      projectsList.value = await window.electronAPI.getProjects();
    } catch (e) { error.value = e.message; }
    finally { isLoading.value = false; }
  }

  async function saveProject(projectData) {
    if (!window.electronAPI) return null;
    isLoading.value = true; error.value = null;
    try {
      const savedProject = await window.electronAPI.saveProject(projectData);
      await fetchProjects(); // Re-fetch for simplicity, or update locally
      return savedProject;
    } catch (e) { error.value = e.message; return null; }
    finally { isLoading.value = false; }
  }

  async function deleteProject(projectId) {
    if (!window.electronAPI) return false;
    isLoading.value = true; error.value = null;
    try {
      const result = await window.electronAPI.deleteProject(projectId);
      if (result.success) {
        await fetchProjects(); // Re-fetch
        if (currentProject.value && currentProject.value.id === projectId) {
          currentProject.value = null; // Clear current project if it was deleted
        }
      }
      return result.success;
    } catch (e) { error.value = e.message; return false; }
    finally { isLoading.value = false; }
  }

  function selectProject(project) {
    currentProject.value = project;
    // Optionally, trigger fetch for tasks of this project here or in component
  }

  return { projectsList, currentProject, isLoading, error, fetchProjects, saveProject, deleteProject, selectProject };
});