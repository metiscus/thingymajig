// src/stores/projectsStore.js
import { defineStore } from 'pinia';
import { ref } from 'vue';
import { useTasksStore } from './tasksStore'; // For clearing tasks
import { useMaterialItemsStore } from './materialItemsStore'; // For clearing material items

export const useProjectsStore = defineStore('projects', () => {
  const projectsList = ref([]);
  const currentProject = ref(null); 
  const isEditingNewProject = ref(false); // Flag for new project mode
  const isLoading = ref(false);
  const error = ref(null);

  const tasksStore = useTasksStore();
  const materialItemsStore = useMaterialItemsStore();

  async function fetchProjects() {
    if (!window.electronAPI) return; 
    isLoading.value = true; error.value = null;
    try {
      const fetched = await window.electronAPI.getProjects();
      // Ensure riskPercentage is a number
      projectsList.value = fetched.map(p => ({ ...p, riskPercentage: Number(p.riskPercentage || 0) }));
    } catch (e) { error.value = e.message; }
    finally { isLoading.value = false; }
  }

  async function saveProject(projectData) { // projectData includes { id?, name, description, riskPercentage }
    if (!window.electronAPI) return null;
    isLoading.value = true; error.value = null;
    try {
      const dataToSave = {
        ...projectData,
        riskPercentage: parseFloat(projectData.riskPercentage) || 0,
      };
      const savedProject = await window.electronAPI.saveProject(dataToSave);
      await fetchProjects(); // Re-fetch for simplicity
      
      // If it was a new project, select it. If updating, ensure currentProject is updated.
      if (savedProject) {
        const updatedProjectInList = projectsList.value.find(p => p.id === savedProject.id);
        if (updatedProjectInList) {
            selectProject(updatedProjectInList); // This also handles isEditingNewProject = false
        } else {
            isEditingNewProject.value = false;
        }
      } else {
        isEditingNewProject.value = false;
      }
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
        await fetchProjects(); 
        if (currentProject.value && currentProject.value.id === projectId) {
          currentProject.value = null; 
          isEditingNewProject.value = false;
          tasksStore.tasksList = [];
          materialItemsStore.materialItemsList = [];
        }
      }
      return result.success;
    } catch (e) { error.value = e.message; return false; }
    finally { isLoading.value = false; }
  }

  function selectProject(project) {
    currentProject.value = project ? { ...project, riskPercentage: Number(project.riskPercentage || 0) } : null;
    isEditingNewProject.value = false; // Selecting an existing project means we are not in 'new project' mode.
    if (project) {
      tasksStore.fetchTasksForProject(project.id);
      materialItemsStore.fetchMaterialItemsForProject(project.id);
    } else {
      // Clear tasks and materials if no project is selected (or new project mode)
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
    tasksStore.tasksList = []; // Clear tasks for new project form
    materialItemsStore.materialItemsList = []; // Clear materials for new project form
  }

  function cancelNewProjectEdit() {
    if (isEditingNewProject.value) {
        currentProject.value = null;
        isEditingNewProject.value = false;
    }
  }


  return { 
    projectsList, currentProject, isLoading, error, isEditingNewProject,
    fetchProjects, saveProject, deleteProject, selectProject, startNewProject, cancelNewProjectEdit
  };
});