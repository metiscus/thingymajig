<template>
  <div class="rates-manager">
    <h2>Manage Rates</h2>

    <div v-if="store.isLoading">Loading rates...</div>
    <div v-if="store.error" class="error-message">Error: {{ store.error }}</div>

    <form @submit.prevent="handleAddOrUpdateRate" class="rate-form">
      <h3>{{ editingRateId ? 'Edit Rate' : 'Add New Rate' }}</h3>
      <div>
        <label for="role">Role:</label>
        <input type="text" id="role" v-model="currentRate.role" required :disabled="!!editingRateId" />
        <small v-if="editingRateId">(Role cannot be changed once set)</small>
      </div>
      <div>
        <label for="rate">Rate:</label>
        <input type="number" id="rate" v-model.number="currentRate.rate" required step="0.01" min="0" />
      </div>
      <div>
        <label for="unit">Unit:</label>
        <select id="unit" v-model="currentRate.unit">
          <option value="day">Per Day</option>
          <option value="hour">Per Hour</option>
        </select>
      </div>
      <button type="submit">{{ editingRateId ? 'Update Rate' : 'Add Rate' }}</button>
      <button type="button" v-if="editingRateId" @click="cancelEdit">Cancel Edit</button>
    </form>

    <table v-if="store.ratesList.length > 0">
      <thead>
        <tr>
          <th>Role</th>
          <th>Rate</th>
          <th>Unit</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="rate in store.ratesList" :key="rate.id">
          <td>{{ rate.role }}</td>
          <td>{{ formatCurrency(rate.rate) }}</td>
          <td>{{ rate.unit }}</td>
          <td>
            <button @click="editRate(rate)">Edit</button>
            <button @click="confirmDeleteRate(rate.id)">Delete</button>
          </td>
        </tr>
      </tbody>
    </table>
    <p v-else-if="!store.isLoading">No rates defined yet.</p>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRatesStore } from '../stores/ratesStore';

const store = useRatesStore();

const defaultRate = () => ({ role: '', rate: 0, unit: 'day' });
const currentRate = ref(defaultRate());
const editingRateId = ref(null); // To track if we are editing an existing rate

onMounted(() => {
  store.fetchRates();
});

const handleAddOrUpdateRate = async () => {
  if (!currentRate.value.role || currentRate.value.rate <= 0) {
    alert('Role and a positive rate are required.');
    return;
  }
  const success = await store.saveRate({ ...currentRate.value });
  if (success) {
    currentRate.value = defaultRate(); // Reset form
    editingRateId.value = null;
     // store.fetchRates(); // Re-fetch to ensure list is fresh, or rely on store's optimistic update
  } else {
    alert('Failed to save rate. Check console for errors.');
  }
};

const editRate = (rate) => {
  // When editing, the ID is from the existing rate. Role is kept for the `saveRate` UPSERT logic.
  editingRateId.value = rate.id; // Store the original ID for context if needed
  currentRate.value = { ...rate }; // Copy rate data to form
};

const cancelEdit = () => {
  currentRate.value = defaultRate();
  editingRateId.value = null;
};

const confirmDeleteRate = async (rateId) => {
  if (confirm('Are you sure you want to delete this rate?')) {
    const success = await store.deleteRate(rateId);
    if (!success) {
      alert('Failed to delete rate. Check console for errors.');
    }
  }
};

const formatCurrency = (value) => {
  // Basic currency formatting, adjust as needed
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
};
</script>

<style scoped>
.rates-manager {
  padding: 20px;
  font-family: sans-serif;
}
.rate-form {
  margin-bottom: 20px;
  padding: 15px;
  border: 1px solid #ccc;
  border-radius: 5px;
}
.rate-form div {
  margin-bottom: 10px;
}
.rate-form label {
  display: inline-block;
  width: 80px;
  margin-right: 10px;
}
.rate-form input, .rate-form select {
  padding: 5px;
  border: 1px solid #ddd;
  border-radius: 3px;
}
table {
  width: 100%;
  border-collapse: collapse;
}
th, td {
  border: 1px solid #ddd;
  padding: 8px;
  text-align: left;
}
th {
  background-color: #f2f2f2;
}
button {
  margin-right: 5px;
  padding: 5px 10px;
  cursor: pointer;
}
.error-message {
  color: red;
  margin-bottom: 10px;
}
</style>