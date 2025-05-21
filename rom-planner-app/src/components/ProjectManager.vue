<template>
  <div class="project-manager">
    <h3>Projects / Phases</h3>
    <div v-if="projectsStore.isLoading">Loading projects...</div>
    <div v-if="projectsStore.error" class="error-message">Error: {{ projectsStore.error }}</div>

    <form @submit.prevent="handleAddOrUpdateProject" class="project-form">
      <input type="text" v-model="currentProjectForm.name" placeholder="Project/Phase Name" required />
      <input type="text" v-model="currentProjectForm.description" placeholder="Description (optional)" />
      <button type="submit">{{ currentProjectForm.id ? 'Update Project' : 'Add Project' }}</button>
      <button type="button" v-if="currentProjectForm.id" @click="cancelEditProject">Cancel</button>
    </form>

    <ul v-if="projectsStore.projectsList.length > 0" class="project-list">
      <li
        v-for="project in projectsStore.projectsList"
        :key="project.id"
        @click="selectProject(project)"
        :class="{ selected: projectsStore.currentProject && projectsStore.currentProject.id === project.id }"
      >
        {{ project.name }}
        <div class="project-actions">
          <button @click.stop="editProject(project)">Edit</button>
          <button @click.stop="confirmDeleteProject(project.id)">Delete</button>
        </div>
      </li>
    </ul>
    <p v-else-if="!projectsStore.isLoading">No projects yet. Add one above.</p>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useProjectsStore } from '../stores/projectsStore';
import { useTasksStore } from '../stores/tasksStore'; // To clear tasks when project changes

const projectsStore = useProjectsStore();
const tasksStore = useTasksStore(); // To manage tasks related to the selected project

const defaultProjectForm = () => ({ id: null, name: '', description: '' });
const currentProjectForm = ref(defaultProjectForm());

onMounted(() => {
  projectsStore.fetchProjects();
});

const handleAddOrUpdateProject = async () => {
  if (!currentProjectForm.value.name.trim()) return;
  const saved = await projectsStore.saveProject({ ...currentProjectForm.value });
  if (saved) {
    currentProjectForm.value = defaultProjectForm();
  }
};

const editProject = (project) => {
  currentProjectForm.value = { ...project };
};

const cancelEditProject = () => {
  currentProjectForm.value = defaultProjectForm();
};

const confirmDeleteProject = async (projectId) => {
  if (confirm('Are you sure? This will also delete all tasks in this project.')) {
    await projectsStore.deleteProject(projectId);
  }
};

const selectProject = (project) => {
  projectsStore.selectProject(project);
  tasksStore.fetchTasksForProject(project.id); // Load tasks for the newly selected project
};
</script>

<style scoped>
.project-manager { margin-bottom: 20px; }
.project-form { display: flex; gap: 10px; margin-bottom: 10px; }
.project-form input { flex-grow: 1; padding: 8px; }
.project-list { list-style: none; padding: 0; }
.project-list li {
  padding: 10px;
  border: 1px solid #eee;
  margin-bottom: 5px;
  cursor: pointer;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.project-list li:hover { background-color: #f9f9f9; }
.project-list li.selected { background-color: #e0f0ff; border-left: 3px solid #42b983; }
.project-actions button { margin-left: 5px; }
.error-message { color: red; }
</style>