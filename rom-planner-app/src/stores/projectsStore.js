import { defineStore } from 'pinia';
import { httpAPI } from '../services/httpAPI';
import router from '../router'; // Import router instance

export const useProjectsStore = defineStore('projects', {
  state: () => ({
    projectsList: [],
    currentProject: null,
    isLoading: false,
    error: null,
    isEditingNewProject: false, // NEW state to track if a new project form is active
    isExporting: false, // NEW state for export
  }),

  actions: {
    async fetchProjects() {
      this.isLoading = true;
      this.error = null;
      try {
        const data = await httpAPI.getProjects();
        this.projectsList = data;
        console.log('ProjectsStore: fetchProjects - projectsList updated. currentProject before re-selection:', this.currentProject?.name);
        // Re-select current project if it was loaded previously (e.g., on page refresh)
        if (this.currentProject && this.currentProject.id) {
          const reselectedProject = this.projectsList.find(p => p.id === this.currentProject.id);
          if (reselectedProject) {
            // Only update currentProject if it's a different object instance or if its data changed
            if (this.currentProject !== reselectedProject) {
                this.currentProject = reselectedProject;
                console.log('ProjectsStore: fetchProjects - reselected currentProject:', this.currentProject.name);
            }
          } else {
            this.currentProject = null; // Project might have been deleted, or ID changed somehow
            console.log('ProjectsStore: fetchProjects - previous currentProject not found, set to null.');
          }
        }
      } catch (error) {
        console.error('Error fetching projects:', error);
        this.error = 'Failed to fetch projects.';
      } finally {
        this.isLoading = false;
      }
    },

    async saveProject(projectData) {
      console.log('ProjectsStore: saveProject START. Saving:', projectData.name);
      this.isLoading = true;
      this.error = null;
      try {
        const savedProject = await httpAPI.saveProject(projectData);
        
        if (projectData.id) {
          // Update existing project in the list
          const index = this.projectsList.findIndex(p => p.id === savedProject.id);
          if (index !== -1) {
            this.projectsList[index] = savedProject;
          }
        } else {
          // Add new project to the list
          this.projectsList.push(savedProject);
        }
        this.projectsList.sort((a,b) => a.name.localeCompare(b.name)); // Keep sorted
        
        this.currentProject = savedProject; // Set the saved project as current
        this.isEditingNewProject = false; // Exit new project mode

        // Navigate to the project's details page ONLY IF NOT ALREADY ON IT
        if (router.currentRoute.value.name !== 'ProjectDetails' || router.currentRoute.value.params.projectId != savedProject.id) {
            console.log(`ProjectsStore: saveProject - Navigating to ProjectDetails for ${savedProject.name}`);
            router.push({ name: 'ProjectDetails', params: { projectId: savedProject.id } });
        } else {
            console.log(`ProjectsStore: saveProject - Already on ProjectDetails for ${savedProject.name}, no navigation needed.`);
        }
        return true;
      } catch (error) {
        console.error('Error saving project:', error);
        this.error = `Failed to save project: ${error.detail || error.message}`;
        return false;
      } finally {
        this.isLoading = false;
        console.log('ProjectsStore: saveProject END. currentProject:', this.currentProject?.name);
      }
    },

    async deleteProject(projectId) {
      this.isLoading = true;
      this.error = null;
      try {
        const result = await httpAPI.deleteProject(projectId);
        if (result.success) {
          this.projectsList = this.projectsList.filter(p => p.id !== projectId);
          if (this.currentProject && this.currentProject.id === projectId) {
            this.currentProject = null; // Deselect if deleted
            console.log(`ProjectsStore: deleteProject - Project ${projectId} deleted, currentProject set to null.`);
            router.push({ name: 'Home' }); // Go back to home/welcome
          }
        } else {
          throw new Error('Deletion failed on server.');
        }
        return true;
      } catch (error) {
        console.error('Error deleting project:', error);
        this.error = `Failed to delete project: ${error.detail || error.message}`;
        return false;
      } finally {
        this.isLoading = false;
      }
    },

    // MODIFIED: Simplified selectProject logic, handles routing
    selectProject(project) {
        console.log('ProjectsStore: selectProject called. project:', project?.name, 'currentProject BEFORE:', this.currentProject?.name);
        
        // If clicking the currently selected project, deselect it
        if (this.currentProject && project && this.currentProject.id === project.id) {
            this.currentProject = null;
            this.isEditingNewProject = false;
            console.log('ProjectsStore: selectProject - Deselecting current project. Navigating to Home.');
            router.push({ name: 'Home' });
        } else {
            // Select the new project
            this.currentProject = project;
            this.isEditingNewProject = false;
            console.log('ProjectsStore: selectProject - Selecting project:', project?.name);
            // Navigate to project details if not already there
            if (project && project.id && (router.currentRoute.value.name !== 'ProjectDetails' || router.currentRoute.value.params.projectId != project.id)) {
                console.log(`ProjectsStore: selectProject - Navigating to ProjectDetails for ${project.name}`);
                router.push({ name: 'ProjectDetails', params: { projectId: project.id } });
            } else if (!project && router.currentRoute.value.name !== 'Home') {
                 // This case should ideally not happen if project is null here and not already home
                 console.log('ProjectsStore: selectProject - Project is null, navigating to Home.');
                 router.push({ name: 'Home' });
            }
        }
        console.log('ProjectsStore: selectProject END. currentProject AFTER:', this.currentProject?.name);
    },

    startNewProject() {
      console.log('ProjectsStore: startNewProject START.');
      this.currentProject = null; // Ensure no project is currently selected for editing
      this.isEditingNewProject = true;
      // Navigate to the new project route ONLY IF NOT ALREADY THERE
      if (router.currentRoute.value.name !== 'NewProject') {
          console.log('ProjectsStore: startNewProject - Navigating to NewProject route.');
          router.push({ name: 'NewProject' });
      } else {
          console.log('ProjectsStore: startNewProject - Already on NewProject route.');
      }
      console.log('ProjectsStore: startNewProject END. currentProject:', this.currentProject?.name);
    },

    cancelNewProjectEdit() {
        console.log('ProjectsStore: cancelNewProjectEdit START.');
        this.isEditingNewProject = false;
        this.currentProject = null; // Clear any temporary new project data
        console.log('ProjectsStore: cancelNewProjectEdit - Navigating to Home.');
        router.push({ name: 'Home' }); // Go back to home/welcome
        console.log('ProjectsStore: cancelNewProjectEdit END. currentProject:', this.currentProject?.name);
    },

    async exportProject(projectId) {
      this.isExporting = true;
      this.error = null;
      try {
        const result = await httpAPI.exportProjectToExcel(projectId);
        if (result.success) {
          alert('Project exported successfully! Check your downloads folder.');
        } else {
          throw new Error(result.error || 'Failed to export project.');
        }
        return true;
      } catch (error) {
        console.error('Error exporting project:', error);
        this.error = `Failed to export project: ${error.detail || error.message}`;
        return false;
      } finally {
        this.isExporting = false;
      }
    }
  },
});