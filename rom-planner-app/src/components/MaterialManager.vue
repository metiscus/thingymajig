<template>
  <div class="material-manager component-section" v-if="projectsStore.currentProject">
    <h3>Detailed Material Expenses for: {{ projectsStore.currentProject.name }}</h3>

    <div v-if="materialItemsStore.isLoading" class="loading-message">Loading material items...</div>
    <div v-if="materialItemsStore.error" class="error-message">Error: {{ materialItemsStore.error }}</div>

    <div class="add-item-controls">
      <button @click="prepareNewItem" class="primary" :disabled="!!editingItemId">
        <i class="fas fa-plus"></i> Add New Material Item
      </button>
      <span v-if="editingItemId" class="editing-hint">
        (Complete or cancel current edit to add another)
      </span>
    </div>

    <form @submit.prevent="handleSaveItem">
      <table v-if="materialItemsStore.materialItemsList.length > 0 || editingItemId === 'new'" class="material-table editable-table">
        <thead>
          <tr>
            <th>Line Item</th>
            <th>Vendor</th>
            <th>Category</th>
            <th>Unit Price</th>
            <th>Quantity</th>
            <th>Subtotal</th>
            <th>Comment</th>
            <th class="col-actions">Actions</th>
          </tr>
        </thead>
        <tbody>
          <!-- Existing Items -->
          <tr v-for="item in materialItemsStore.materialItemsList" :key="item.id" :class="{ 'editing-row': editingItemId === item.id }">
            <template v-if="editingItemId === item.id">
              <td><input type="text" v-model="editableItemData.lineItem" required ref="firstEditableInput" /></td>
              <td><input type="text" v-model="editableItemData.vendor" /></td>
              <td>
                <select v-model="editableItemData.category">
                  <option v-for="cat in materialCategories" :key="cat.value" :value="cat.value">{{ cat.label }}</option>
                </select>
              </td>
              <td><input type="number" v-model.number="editableItemData.unitPrice" step="0.01" min="0" /></td>
              <td><input type="number" v-model.number="editableItemData.quantity" step="1" min="0" /></td>
              <td class="read-only-cell">{{ formatCurrency(calculateSubtotal(editableItemData)) }}</td>
              <td><input type="text" v-model="editableItemData.comment" /></td>
              <td class="actions-cell">
                <button type="submit" class="primary small-btn"><i class="fas fa-save"></i> Save</button>
                <button type="button" @click="cancelEdit" class="secondary small-btn"><i class="fas fa-times"></i> Cancel</button>
              </td>
            </template>
            <template v-else>
              <td @dblclick="startEdit(item)">{{ item.lineItem }}</td>
              <td @dblclick="startEdit(item)">{{ item.vendor }}</td>
              <td @dblclick="startEdit(item)">{{ item.category }}</td>
              <td @dblclick="startEdit(item)">{{ formatCurrency(item.unitPrice) }}</td>
              <td @dblclick="startEdit(item)">{{ item.quantity }}</td>
              <td>{{ formatCurrency(item.unitPrice * item.quantity) }}</td>
              <td @dblclick="startEdit(item)" class="comment-cell">{{ item.comment }}</td>
              <td class="actions-cell">
                <button @click="startEdit(item)" class="secondary small-btn" :disabled="!!editingItemId"><i class="fas fa-edit"></i> Edit</button>
                <button @click="confirmDeleteItem(item.id)" class="danger small-btn" :disabled="!!editingItemId"><i class="fas fa-trash"></i> Delete</button>
              </td>
            </template>
          </tr>

          <!-- New Item Row (when adding) -->
          <tr v-if="editingItemId === 'new'" class="editing-row new-item-row">
            <td><input type="text" v-model="editableItemData.lineItem" placeholder="Line Item Name" required ref="firstEditableInput" /></td>
            <td><input type="text" v-model="editableItemData.vendor" placeholder="Vendor" /></td>
            <td>
              <select v-model="editableItemData.category">
                <option v-for="cat in materialCategories" :key="cat.value" :value="cat.value">{{ cat.label }}</option>
              </select>
            </td>
            <td><input type="number" v-model.number="editableItemData.unitPrice" step="0.01" min="0" /></td>
            <td><input type="number" v-model.number="editableItemData.quantity" step="1" min="1" /></td>
            <td class="read-only-cell">{{ formatCurrency(calculateSubtotal(editableItemData)) }}</td>
            <td><input type="text" v-model="editableItemData.comment" placeholder="Comment" /></td>
            <td class="actions-cell">
              <button type="submit" class="primary small-btn"><i class="fas fa-save"></i> Save</button>
              <button type="button" @click="cancelEdit" class="secondary small-btn"><i class="fas fa-times"></i> Cancel</button>
            </td>
          </tr>
        </tbody>
        <tfoot v-if="materialItemsStore.materialItemsList.length > 0 || editingItemId === 'new'">
          <tr>
            <th colspan="5" style="text-align: right;">Total Detailed Material Costs:</th>
            <th>{{ formatCurrency(materialItemsStore.totalDetailedMaterialCost) }}</th>
            <th colspan="2"></th>
          </tr>
        </tfoot>
      </table>
       <p v-else-if="!materialItemsStore.isLoading && projectsStore.currentProject && editingItemId !== 'new'">
          No detailed material expenses recorded for this project yet. Click "Add New Material Item" to begin.
      </p>
    </form>
  </div>
</template>

<script setup>
import { ref, watch, nextTick, toRaw } from 'vue';
import { useProjectsStore } from '../stores/projectsStore';
import { useMaterialItemsStore } from '../stores/materialItemsStore';

const projectsStore = useProjectsStore();
const materialItemsStore = useMaterialItemsStore();

const editingItemId = ref(null); // null, 'new', or an item ID
const editableItemData = ref(null);
const firstEditableInput = ref(null); // For focusing

const materialCategories = ref([
  { value: 'Hardware', label: 'Hardware' },
  { value: 'Software', label: 'Software' },
  { value: 'Shipping', label: 'Shipping' },
  { value: 'Misc', label: 'Miscellaneous' }
]);

const cancelEdit = () => {
  editingItemId.value = null;
  editableItemData.value = null;
};

const defaultItem = () => ({
  id: null,
  projectId: projectsStore.currentProject?.id || null,
  lineItem: '',
  vendor: '',
  category: 'Hardware', // Default to 'Hardware' or another preferred default
  unitPrice: 0,
  quantity: 1,
  comment: ''
});

const focusFirstInput = async () => {
  await nextTick();
  if (firstEditableInput.value) {
    firstEditableInput.value.focus();
    if (typeof firstEditableInput.value.select === 'function') {
      firstEditableInput.value.select();
    }
  }
};

const prepareNewItem = () => {
  if (editingItemId.value) return; 
  if (!projectsStore.currentProject?.id) {
    alert("Please select a project first.");
    return;
  }
  editableItemData.value = defaultItem();
  editableItemData.value.projectId = projectsStore.currentProject.id;
  editingItemId.value = 'new';
  focusFirstInput();
};

const startEdit = (item) => {
  if (editingItemId.value) return;
  editableItemData.value = JSON.parse(JSON.stringify(toRaw(item)));
  // Ensure category exists in options, if not, default or handle
  if (!materialCategories.value.find(cat => cat.value === editableItemData.value.category)) {
      editableItemData.value.category = 'Misc'; // Or some other default if loaded data has an unknown category
  }
  editingItemId.value = item.id;
  focusFirstInput();
};

const handleSaveItem = async () => {
  if (!editableItemData.value || !editableItemData.value.lineItem.trim()) {
    alert('Line Item name is required.');
    return;
  }
  if (!projectsStore.currentProject?.id) {
    alert('No project selected. Cannot save item.');
    return;
  }

  const itemToSave = { ...toRaw(editableItemData.value) };
  itemToSave.projectId = projectsStore.currentProject.id;
  itemToSave.unitPrice = parseFloat(itemToSave.unitPrice || 0);
  itemToSave.quantity = parseInt(itemToSave.quantity || 0);

  if (editingItemId.value === 'new') {
    itemToSave.id = null; 
  }

  const saved = await materialItemsStore.saveMaterialItem(itemToSave);
  if (saved) {
    cancelEdit();
  } else {
    alert('Failed to save material item. Check console for errors.');
  }
};

const confirmDeleteItem = async (itemId) => {
  if (editingItemId.value) return; 
  if (confirm('Are you sure you want to delete this material item?')) {
    await materialItemsStore.deleteMaterialItem(itemId, projectsStore.currentProject.id);
  }
};

const calculateSubtotal = (item) => {
  if (!item) return 0;
  return (Number(item.unitPrice || 0) * Number(item.quantity || 0));
};

const formatCurrency = (value) => {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value || 0);
};

watch(() => projectsStore.currentProject, (newProject) => {
  cancelEdit(); 
  if (newProject) {
    materialItemsStore.fetchMaterialItemsForProject(newProject.id);
  } else {
    materialItemsStore.materialItemsList = []; 
  }
}, { immediate: true });

</script>

<style scoped>
.material-manager { /* Styles specific to MaterialManager or use global .component-section */ }
.add-item-controls { margin-bottom: 15px; display: flex; align-items: center; }
.editing-hint { margin-left: 10px; font-size: 0.9em; color: #777; }

.material-table th, .material-table td {
  /* Adjust column widths as needed */
}
.material-table .col-actions { width: 150px; text-align: center; }
.comment-cell { max-width: 200px; white-space: pre-wrap; word-break: break-word; font-size:0.9em; }
.read-only-cell { color: #555; font-style: italic; }
.actions-cell button.small-btn { padding: 5px 8px; font-size: 0.85em; }
.actions-cell button.small-btn i { margin-right: 3px; }

.new-item-row td { padding-top: 10px; padding-bottom: 10px; }

/* Ensure select takes up space like other inputs in editable table */
.editable-table td select {
  /* Styles are inherited from global .editable-table td input, but if you need specific ones: */
  /* width: 100%; */
  /* box-sizing: border-box; */
  /* padding: 6px 8px; */
  /* height: calc(100% + 12px); */
}
</style>