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
  /* width: 100%; */
  /* box-sizing: border-box; */
  /* padding: 6px 8px; */
  /* height: calc(100% + 12px); */
}
</style>