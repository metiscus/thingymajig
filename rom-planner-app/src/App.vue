<template>
  <div id="app-container">
    <header>
      <h1>ROM Planner</h1>
    </header>
    <nav>
      <!-- Basic navigation - can be improved with Vue Router later -->
      <button @click="currentView = 'planner'">Planner</button>
      <button @click="currentView = 'rates'">Manage Rates</button>
    </nav>
    <main>
      <div v-if="currentView === 'planner'" class="planner-view">
        <ProjectManager />
        <TaskManager />
      </div>
      <RatesManager v-if="currentView === 'rates'" />
    </main>
    <footer>
      <!-- Footer content if any -->
    </footer>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import RatesManager from './components/RatesManager.vue';
import ProjectManager from './components/ProjectManager.vue';
import TaskManager from './components/TaskManager.vue';

const currentView = ref('planner'); // Default view
</script>

<style>
/* Basic global styles - from style.css or here */
body { margin: 0; font-family: Avenir, Helvetica, Arial, sans-serif; color: #2c3e50; }
#app-container { display: flex; flex-direction: column; min-height: 100vh; }
header { background-color: #42b983; color: white; padding: 10px 20px; text-align: center; }
nav {
  background-color: #f0f0f0;
  padding: 10px 20px;
  text-align: center;
  border-bottom: 1px solid #ddd;
}
nav button {
  padding: 8px 15px;
  margin: 0 5px;
  background-color: #4CAF50;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}
nav button:hover { background-color: #45a049; }
main { flex-grow: 1; padding: 20px; }
.planner-view {
  /* You might want a layout for ProjectManager and TaskManager, e.g., side-by-side or stacked */
}
footer { background-color: #333; color: white; padding: 10px 20px; text-align: center; font-size: 0.8em;}
</style>