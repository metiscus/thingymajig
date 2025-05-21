<template>
  <div class="project-summary component-section" v-if="projectsStore.currentProject && projectsStore.currentProject.id">
    <h3>Project Cost Summary: {{ projectsStore.currentProject.name }}</h3>
    
    <div v-if="tasksStore.isLoading || materialItemsStore.isLoading" class="loading-message">
      Calculating summary...
    </div>
    <div v-else class="summary-grid">
      <div class="summary-item">
        <span class="label">Total Labor Cost:</span>
        <span class="value">{{ formatCurrency(totalLaborCost) }}</span>
      </div>
      <div class="summary-item">
        <span class="label">Total Task Travel Cost:</span>
        <span class="value">{{ formatCurrency(tasksStore.totalTravelCostForCurrentProject) }}</span>
      </div>
      <div class="summary-item">
        <span class="label">Total Task Incidental Materials:</span>
        <span class="value">{{ formatCurrency(tasksStore.totalMaterialsCostForCurrentProject) }}</span>
      </div>
      <div class="summary-item">
        <span class="label">Total Detailed Material Expenses:</span>
        <span class="value">{{ formatCurrency(materialItemsStore.totalDetailedMaterialCost) }}</span>
      </div>

      <div class="summary-item subtotal-item">
        <span class="label">SUBTOTAL (Before Risk):</span>
        <span class="value">{{ formatCurrency(subtotalBeforeRisk) }}</span>
      </div>

      <div class="summary-item risk-item">
        <span class="label">Risk ({{ projectsStore.currentProject.riskPercentage || 0 }}%):</span>
        <span class="value">{{ formatCurrency(riskAmount) }}</span>
      </div>
      
      <div class="summary-item grand-total">
        <span class="label">PROJECT GRAND TOTAL (incl. Risk):</span>
        <span class="value">{{ formatCurrency(grandTotalWithRisk) }}</span>
      </div>
    </div>
     <div v-if="tasksStore.error || materialItemsStore.error" class="error-message">
      Could not load all data for summary. {{ tasksStore.error }} {{ materialItemsStore.error }}
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useProjectsStore } from '../stores/projectsStore';
import { useTasksStore } from '../stores/tasksStore';
import { useMaterialItemsStore } from '../stores/materialItemsStore';

const projectsStore = useProjectsStore();
const tasksStore = useTasksStore();
const materialItemsStore = useMaterialItemsStore();

const totalLaborCost = computed(() => {
  return Object.values(tasksStore.totalCostPerRoleForCurrentProject).reduce((sum, cost) => sum + (Number(cost) || 0), 0);
});

const subtotalBeforeRisk = computed(() => {
  return totalLaborCost.value +
         (Number(tasksStore.totalTravelCostForCurrentProject) || 0) +
         (Number(tasksStore.totalMaterialsCostForCurrentProject) || 0) +
         (Number(materialItemsStore.totalDetailedMaterialCost) || 0);
});

const riskAmount = computed(() => {
  const riskPercentage = Number(projectsStore.currentProject?.riskPercentage || 0);
  return subtotalBeforeRisk.value * (riskPercentage / 100);
});

const grandTotalWithRisk = computed(() => {
  return subtotalBeforeRisk.value + riskAmount.value;
});

const formatCurrency = (value) => {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(value) || 0);
};
</script>

<style scoped>
.project-summary {
  /* background-color: #eef7ff; */
  /* border: 1px solid #cfe2f3; */
}
.summary-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); /* Adjusted minmax */
  gap: 15px;
}
.summary-item {
  background-color: #f8f9fa;
  padding: 15px;
  border-radius: 6px;
  border: 1px solid #e9ecef;
  display: flex;
  flex-direction: column; 
  justify-content: space-between; 
}
.summary-item .label {
  font-weight: 600;
  color: #495057;
  margin-bottom: 8px; 
  font-size: 0.9em; /* Slightly smaller label */
}
.summary-item .value {
  font-size: 1.15em; /* Adjusted value size */
  color: #2c3e50;
  font-weight: bold;
  text-align: right; 
}

.subtotal-item {
  /* border-top: 2px solid #adb5bd; */
  /* padding-top: 15px; */
  /* margin-top: 10px; */
  background-color: #e9ecef; /* Slightly different background */
}
.subtotal-item .label {
  font-size: 0.95em;
}
.subtotal-item .value {
  font-size: 1.2em;
}

.risk-item {
    background-color: #fff3cd; /* Light yellow for risk */
    border-color: #ffeeba;
}
.risk-item .label, .risk-item .value {
    color: #856404; /* Dark yellow text */
}


.summary-item.grand-total {
  background-color: #35495E; 
  color: white;
  grid-column: 1 / -1; 
  margin-top:10px;
}
.summary-item.grand-total .label {
  color: #f0f0f0;
  font-size: 1.05em; /* Adjusted */
}
.summary-item.grand-total .value {
  color: white;
  font-size: 1.4em; /* Adjusted */
}
</style>