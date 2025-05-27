<!-- src/views/AdminDashboard.vue -->
<template>
  <div class="admin-dashboard component-section">
    <h3>Admin Dashboard</h3>
    <div class="admin-content">
      <div class="admin-section">
        <h4>User Management</h4>
        <p>Total Users: {{ userCount }}</p>
        <button @click="refreshUserCount">Refresh User Count</button>
      </div>
      
      <div class="admin-section">
        <h4>System Status</h4>
        <p>API Status: <span class="status-indicator">{{ apiStatus }}</span></p>
        <p>Database Status: <span class="status-indicator">{{ dbStatus }}</span></p>
      </div>
      
      <div class="admin-section">
        <h4>Quick Actions</h4>
        <button class="secondary" @click="backupDatabase">Backup Database</button>
        <button class="secondary" @click="clearCache">Clear Cache</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useAuthStore } from '../stores/authStore';

const authStore = useAuthStore();
const userCount = ref(0);
const apiStatus = ref('Online');
const dbStatus = ref('Connected');

const refreshUserCount = async () => {
  // This would make an API call to get user count
  // For now, just mock it
  userCount.value = Math.floor(Math.random() * 100) + 1;
};

const backupDatabase = () => {
  alert('Database backup initiated (mock)');
};

const clearCache = () => {
  alert('Cache cleared (mock)');
};

onMounted(() => {
  refreshUserCount();
});
</script>

<style scoped>
.admin-content {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 20px;
}

.admin-section {
  background-color: #f8f9fa;
  padding: 15px;
  border-radius: 4px;
  border: 1px solid #dee2e6;
}

.admin-section h4 {
  margin-top: 0;
  color: #495057;
  border-bottom: 1px solid #dee2e6;
  padding-bottom: 8px;
}

.status-indicator {
  font-weight: bold;
  color: #28a745;
}

.admin-section button {
  margin-right: 10px;
  margin-top: 10px;
}
</style>