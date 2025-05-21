<template>
  <div class="global-materials-manager component-section">
    <h2>Manage Global Materials</h2>

    <div v-if="materialItemsStore.isLoading">Loading global materials...</div>
    <div v-if="materialItemsStore.error" class="error-message">Error: {{ materialItemsStore.error }}</div>

    <form @submit.prevent="handleAddOrUpdateMaterial" class="material-form">
      <h3>{{ editingMaterialId ? 'Edit Global Material' : 'Add New Global Material' }}</h3>
      <div>
        <label for="materialName">Material Name:</label>
        <input type="text" id="materialName" v-model="currentMaterial.name" required :disabled="!!editingMaterialId" />
        <small v-if="editingMaterialId">(Name cannot be changed once set)</small>
      </div>
      <div>
        <label for="materialCategory">Category:</label>
        <select id="materialCategory" v-model="currentMaterial.category">
          <option v-for="cat in materialCategories" :key="cat.value" :value="cat.value">{{ cat.label }}</option>
        </select>
      </div>
      <div>
        <label for="materialUnitPrice">Unit Price:</label>
        <input type="number" id="materialUnitPrice" v-model.number="currentMaterial.unitPrice" required step="0.01" min="0" />
      </div>
      <button type="submit" class="primary">{{ editingMaterialId ? 'Update Material' : 'Add Material' }}</button>
      <button type="button" v-if="editingMaterialId" @click="cancelEdit" class="secondary">Cancel Edit</button>
    </form>

    <table v-if="materialItemsStore.globalMaterialList.length > 0">
      <thead>
        <tr>
          <th>Name</th>
          <th>Category</th>
          <th>Unit Price</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="material in materialItemsStore.globalMaterialList" :key="material.id">
          <td>{{ material.name }}</td>
          <td>{{ material.category }}</td>
          <td>{{ formatCurrency(material.unitPrice) }}</td>
          <td>
            <button @click="editMaterial(material)" class="secondary small-btn">Edit</button>
            <button @click="confirmDeleteMaterial(material.id)" class="danger small-btn">Delete</button>
          </td>
        </tr>
      </tbody>
    </table>
    <p v-else-if="!materialItemsStore.isLoading">No global materials defined yet.</p>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useMaterialItemsStore } from '../stores/materialItemsStore';

const materialItemsStore = useMaterialItemsStore();

const defaultMaterial = () => ({ name: '', category: 'Hardware', unitPrice: 0 });
const currentMaterial = ref(defaultMaterial());
const editingMaterialId = ref(null);

const materialCategories = ref([
  { value: 'Hardware', label: 'Hardware' },
  { value: 'Software', label: 'Software' },
  { value: 'Shipping', label: 'Shipping' },
  { value: 'Misc', label: 'Miscellaneous' }
]);

onMounted(() => {
  materialItemsStore.fetchGlobalMaterials();
});

const handleAddOrUpdateMaterial = async () => {
  if (!currentMaterial.value.name || currentMaterial.value.unitPrice < 0) {
    alert('Material name and a non-negative unit price are required.');
    return;
  }
  const success = await materialItemsStore.saveGlobalMaterial({ ...currentMaterial.value });
  if (success) {
    currentMaterial.value = defaultMaterial();
    editingMaterialId.value = null;
  } else {
    alert('Failed to save global material. Check console for errors.');
  }
};

const editMaterial = (material) => {
  editingMaterialId.value = material.id;
  currentMaterial.value = { ...material };
};

const cancelEdit = () => {
  currentMaterial.value = defaultMaterial();
  editingMaterialId.value = null;
};

const confirmDeleteMaterial = async (materialId) => {
  if (confirm('Are you sure you want to delete this global material? This will not affect existing project items that use this material.')) {
    const success = await materialItemsStore.deleteGlobalMaterial(materialId);
    if (!success) {
      alert('Failed to delete global material. Check console for errors.');
    }
  }
};

const formatCurrency = (value) => {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
};
</script>

<style scoped>
.global-materials-manager {
  padding: 20px;
  font-family: sans-serif;
}
.material-form {
  margin-bottom: 20px;
  padding: 15px;
  border: 1px solid #ccc;
  border-radius: 5px;
}
.material-form div {
  margin-bottom: 10px;
}
.material-form label {
  display: inline-block;
  width: 120px; /* Adjusted width for labels */
  margin-right: 10px;
}
.material-form input, .material-form select {
  padding: 5px;
  border: 1px solid #ddd;
  border-radius: 3px;
  width: calc(100% - 140px); /* Adjust width to fit */
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

/* Re-using general button styles from RatesManager to match app theme */
button.primary {
  background-color: #42b983; /* Vue green */
  color: white;
  border: none;
  border-radius: 4px;
  padding: 8px 15px;
  cursor: pointer;
  transition: background-color 0.2s ease;
}
button.primary:hover {
  background-color: #3aa873;
}

button.secondary {
  background-color: #f0f0f0;
  color: #333;
  border: 1px solid #ccc;
  border-radius: 4px;
  padding: 8px 15px;
  cursor: pointer;
  transition: background-color 0.2s ease;
}
button.secondary:hover {
  background-color: #e0e0e0;
}

button.danger {
  background-color: #dc3545;
  color: white;
  border: none;
  border-radius: 4px;
  padding: 8px 15px;
  cursor: pointer;
  transition: background-color 0.2s ease;
}
button.danger:hover {
  background-color: #c82333;
}

button.small-btn {
    font-size: 0.85em;
    padding: 5px 10px;
}
</style>