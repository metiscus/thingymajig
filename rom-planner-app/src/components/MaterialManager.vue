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
              <td>
                <input 
                  type="text" 
                  v-model="editableItemData.lineItem" 
                  required 
                  ref="firstEditableInput" 
                  list="globalMaterialsList" 
                  @input="handleLineItemInput"
                  @change="handleLineItemChange"
                />
                <datalist id="globalMaterialsList">
                  <option v-for="g_mat in filteredGlobalMaterials" :key="g_mat.id" :value="g_mat.name"></option>
                </datalist>
              </td>
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
            <td>
              <input 
                type="text" 
                v-model="editableItemData.lineItem" 
                placeholder="Line Item Name" 
                required 
                ref="firstEditableInput" 
                list="globalMaterialsList" 
                @input="handleLineItemInput"
                @change="handleLineItemChange"
              />
              <datalist id="globalMaterialsList">
                  <option v-for="g_mat in filteredGlobalMaterials" :key="g_mat.id" :value="g_mat.name"></option>
              </datalist>
            </td>
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
import { ref, watch, nextTick, toRaw, computed, onMounted } from 'vue';
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

// New: Fetch global materials on component mount
onMounted(() => {
  materialItemsStore.fetchGlobalMaterials();
});

// New: Filter global materials for datalist suggestions
const filteredGlobalMaterials = computed(() => {
  if (!editableItemData.value || !editableItemData.value.lineItem) {
    return materialItemsStore.globalMaterialList;
  }
  const searchTerm = editableItemData.value.lineItem.toLowerCase();
  return materialItemsStore.globalMaterialList.filter(g_mat =>
    g_mat.name.toLowerCase().includes(searchTerm)
  );
});

// New: Handler for when user types into the lineItem input (useful for pre-filling if a global material is selected via dropdown)
const handleLineItemInput = (event) => {
  const selectedName = event.target.value;
  const matchedGlobalMaterial = materialItemsStore.globalMaterialList.find(
    (g_mat) => g_mat.name === selectedName
  );

  if (matchedGlobalMaterial) {
    // If an exact match from global list is found, pre-fill price and category
    editableItemData.value.unitPrice = matchedGlobalMaterial.unitPrice;
    if (materialCategories.value.find(cat => cat.value === matchedGlobalMaterial.category)) {
      editableItemData.value.category = matchedGlobalMaterial.category;
    } else {
      editableItemData.value.category = 'Misc'; // Fallback for unknown category
    }
  } else {
    // If text doesn't match a global material, clear price/category to indicate manual entry
    // Only clear if the user is typing a new item, not if they are editing an existing one
    if (editingItemId.value === 'new') {
        editableItemData.value.unitPrice = 0;
        editableItemData.value.category = 'Hardware'; // Reset to default
    }
  }
};

// New: Handler for when the input value changes (e.g., after selecting from datalist)
const handleLineItemChange = (event) => {
    // This is essentially the same as handleLineItemInput for handling selection
    handleLineItemInput(event);
};


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
    const elementToFocus = Array.isArray(firstEditableInput.value) ? firstEditableInput.value[0] : firstEditableInput.value;
    if (elementToFocus) {
        elementToFocus.focus();
        if (typeof elementToFocus.select === 'function') {
            elementToFocus.select();
        }
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
    const success = await materialItemsStore.deleteMaterialItem(itemId, projectsStore.currentProject.id);
    if (!success) {
      alert('Failed to delete material item. Check console for errors.');
    }
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
/* Add this CSS to both TaskManager.vue and MaterialManager.vue <style scoped> sections */

/* TABLE STYLING - Core table structure */
.task-table, .material-table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 15px;
  background-color: white;
  border: 1px solid #ddd;
  border-radius: 4px;
  overflow: hidden;
}

.task-table th, .task-table td,
.material-table th, .material-table td {
  border: 1px solid #ddd;
  padding: 8px 12px;
  text-align: left;
  vertical-align: middle;
}

.task-table th, .material-table th {
  background-color: #f8f9fa;
  font-weight: 600;
  color: #495057;
  border-bottom: 2px solid #dee2e6;
  position: sticky;
  top: 0;
  z-index: 10;
}

.task-table tbody tr, .material-table tbody tr {
  border-bottom: 1px solid #e9ecef;
}

.task-table tbody tr:hover, .material-table tbody tr:hover {
  background-color: #f8f9fa;
}

.task-table tbody tr:last-child, .material-table tbody tr:last-child {
  border-bottom: none;
}

/* FOOTER STYLING */
.task-table tfoot th, .material-table tfoot th {
  background-color: #e9ecef;
  border-top: 2px solid #adb5bd;
  font-weight: bold;
  color: #495057;
}

.task-table tfoot .cost-summary th {
  background-color: #d1ecf1;
  color: #0c5460;
  font-size: 0.9em;
}

/* EDITABLE TABLE SPECIFIC STYLES */
.task-table.editable-table td input[type="text"],
.task-table.editable-table td input[type="number"],
.task-table.editable-table td select,
.material-table.editable-table td input[type="text"],
.material-table.editable-table td input[type="number"],
.material-table.editable-table td select {
  width: 100%;
  padding: 6px 8px;
  margin: -6px -8px;
  border: 1px solid #3498db;
  border-radius: 3px;
  font-size: inherit;
  box-sizing: border-box;
  background-color: white;
}

.editing-row {
  background-color: #e6f7ff !important;
}

.editing-row td {
  border-color: #3498db !important;
}

.new-task-row td, .new-item-row td {
  padding-top: 12px;
  padding-bottom: 12px;
  background-color: #f0f8ff;
}

/* COLUMN SPECIFIC STYLES */
.col-drag-handle {
  width: 30px;
  text-align: center;
  border-right: 2px solid #dee2e6;
}

.col-name {
  min-width: 150px;
  max-width: 200px;
}

.col-description {
  min-width: 200px;
  max-width: 300px;
}

.col-effort {
  width: 80px;
  text-align: center;
}

.col-cost {
  width: 100px;
  text-align: right;
}

.col-total {
  width: 120px;
  text-align: right;
  font-weight: bold;
  background-color: #f8f9fa;
}

.col-actions {
  width: 140px;
  text-align: center;
  border-left: 2px solid #dee2e6;
}

/* CELL SPECIFIC STYLES */
.read-only-cell {
  background-color: #f8f9fa;
  color: #6c757d;
  font-style: italic;
}

.actions-cell {
  white-space: nowrap;
  text-align: center;
}

.actions-cell button.small-btn {
  padding: 4px 8px;
  font-size: 0.8em;
  margin: 0 2px;
}

.description-cell, .comment-cell {
  max-width: 200px;
  white-space: pre-wrap;
  word-break: break-word;
  font-size: 0.9em;
  color: #495057;
}

.no-description {
  color: #adb5bd;
  font-style: italic;
}

.no-tasks-message {
  text-align: center;
  padding: 30px;
  color: #6c757d;
  font-style: italic;
  background-color: #f8f9fa;
}

/* DRAG AND DROP STYLES */
.drag-handle-cell {
  width: 30px;
  text-align: center;
  padding-left: 8px;
  padding-right: 8px;
  background-color: #f8f9fa;
}

.drag-handle {
  cursor: grab;
  color: #adb5bd;
  font-size: 0.9em;
}

.drag-handle:hover {
  color: #6c757d;
}

.disabled-drag-handle {
  cursor: default;
  color: #dee2e6;
}

.ghost-drag {
  opacity: 0.5;
  background: #c8ebfb;
}

/* RESPONSIVE ADJUSTMENTS */
@media (max-width: 1200px) {
  .task-table, .material-table {
    font-size: 0.9em;
  }
  
  .col-description {
    max-width: 200px;
  }
  
  .col-effort {
    width: 70px;
  }
}
</style>
