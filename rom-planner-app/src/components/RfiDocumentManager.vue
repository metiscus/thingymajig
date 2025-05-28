<template>
  <div class="rfi-document-manager component-section" v-if="projectsStore.currentProject">
    <h3>RFI Documents for: {{ projectsStore.currentProject.name }}</h3>

    <div v-if="rfiDocsStore.isLoading">Loading RFI documents...</div>
    <div v-if="rfiDocsStore.error" class="error-message">Error: {{ rfiDocsStore.error }}</div>

    <div class="rfi-upload-section">
      <h4>Upload New RFI Document (PDF only)</h4>
      <input type="file" @change="handleFileChange" accept="application/pdf" />
      <button @click="uploadDocument" :disabled="!selectedFile || rfiDocsStore.isLoading || rfiDocsStore.isProcessing" class="primary">
        <i class="fas fa-upload"></i> Upload
      </button>
      <span v-if="selectedFile">{{ selectedFile.name }}</span>
    </div>

    <table v-if="rfiDocsStore.rfiDocumentsList.length > 0">
      <thead>
        <tr>
          <th>Filename</th>
          <th>Uploaded At</th>
          <th>Last Processed</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="doc in rfiDocsStore.rfiDocumentsList" :key="doc.id">
          <td>{{ doc.filename }}</td>
          <td>{{ formatDate(doc.uploaded_at) }}</td>
          <td>{{ doc.last_processed_at ? formatDate(doc.last_processed_at) : 'Never' }}</td>
          <td>
            <button @click="downloadDocument(doc)" class="secondary small-btn">
              <i class="fas fa-download"></i> View/Download
            </button>
            <button 
              @click="confirmProcessRfi(doc)" 
              :disabled="rfiDocsStore.isProcessing && rfiDocsStore.processingDocId !== doc.id"
              :class="{ 'primary': rfiDocsStore.processingDocId !== doc.id, 'secondary': rfiDocsStore.processingDocId === doc.id }"
              class="small-btn">
              <i class="fas fa-robot"></i> {{ rfiDocsStore.isProcessing && rfiDocsStore.processingDocId === doc.id ? 'Processing...' : 'Process with AI' }}
            </button>
            <button @click="confirmDeleteDocument(doc)" class="danger small-btn">
              <i class="fas fa-trash"></i> Delete
            </button>
          </td>
        </tr>
      </tbody>
    </table>
    <p v-else-if="!rfiDocsStore.isLoading">No RFI documents uploaded yet.</p>
  </div>
</template>

<script setup>
import { ref, watch, onMounted } from 'vue';
import { useProjectsStore } from '../stores/projectsStore';
import { useRfiDocumentsStore } from '../stores/rfiDocumentsStore';
import { useRequirementsStore } from '../stores/requirementsStore'; // For refreshing after process
import { useTasksStore } from '../stores/tasksStore'; // For refreshing after process

const projectsStore = useProjectsStore();
const rfiDocsStore = useRfiDocumentsStore();
const requirementsStore = useRequirementsStore();
const tasksStore = useTasksStore();

const selectedFile = ref(null);

onMounted(() => {
  if (projectsStore.currentProject?.id) {
    rfiDocsStore.fetchRfiDocuments(projectsStore.currentProject.id);
  }
});

watch(() => projectsStore.currentProject, (newProject) => {
  if (newProject?.id) {
    rfiDocsStore.fetchRfiDocuments(newProject.id);
  } else {
    rfiDocsStore.clearState(); // Clear RFI docs if no project selected
  }
}, { immediate: true });

const handleFileChange = (event) => {
  selectedFile.value = event.target.files[0];
};

const uploadDocument = async () => {
  if (!selectedFile.value) {
    alert('Please select a PDF file to upload.');
    return;
  }
  if (!projectsStore.currentProject?.id) {
    alert('Please select a project first.');
    return;
  }

  const success = await rfiDocsStore.uploadRfiDocument(projectsStore.currentProject.id, selectedFile.value);
  if (success) {
    selectedFile.value = null; // Clear input
    event.target.value = ''; // Reset file input
    alert('Document uploaded successfully.');
  } else {
    alert('Failed to upload document.');
  }
};

const downloadDocument = async (doc) => {
  if (!projectsStore.currentProject?.id) return;
  await rfiDocsStore.downloadRfiDocument(projectsStore.currentProject.id, doc.id, doc.filename);
};

const confirmDeleteDocument = async (doc) => {
  if (confirm(`Are you sure you want to delete "${doc.filename}"?`)) {
    if (!projectsStore.currentProject?.id) return;
    const success = await rfiDocsStore.deleteRfiDocument(projectsStore.currentProject.id, doc.id);
    if (success) {
      alert('Document deleted.');
    } else {
      alert('Failed to delete document.');
    }
  }
};

const confirmProcessRfi = async (doc) => {
  const choice = confirm('This will generate requirements and tasks. Do you want to overwrite all existing tasks for this project? \n\nOK = Overwrite Tasks \nCancel = Append Tasks');
  const overwriteTasks = choice; // true for Overwrite, false for Append

  if (!projectsStore.currentProject?.id) return;

  const success = await rfiDocsStore.processRfiDocument(
    projectsStore.currentProject.id,
    doc.id,
    overwriteTasks
  );

  if (success) {
    alert(`RFI processing initiated for "${doc.filename}". Tasks and requirements will be updated.`);
    // After processing is triggered, refresh requirements and tasks for current project
    await requirementsStore.fetchRequirements(projectsStore.currentProject.id);
    await tasksStore.fetchTasksForProject(projectsStore.currentProject.id);
  } else {
    alert(`Failed to initiate processing for "${doc.filename}".`);
  }
};

const formatDate = (dateString) => {
  if (!dateString) return '';
  const options = { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
  return new Date(dateString).toLocaleDateString(undefined, options);
};
</script>

<style scoped>
.rfi-document-manager {
  padding: 20px;
}

.rfi-upload-section {
  background-color: #f8f9fa;
  border: 1px dashed #ced4da;
  padding: 20px;
  border-radius: var(--border-radius-base);
  margin-bottom: 20px;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 15px;
}

.rfi-upload-section h4 {
  width: 100%;
  margin-top: 0;
  margin-bottom: 15px;
  color: var(--color-dark-grey);
}

.rfi-upload-section input[type="file"] {
  flex-grow: 1;
  padding: 5px;
  border: 1px solid #ced4da;
  border-radius: var(--border-radius-base);
  font-size: 0.95em;
}

.rfi-upload-section button {
  white-space: nowrap;
}

.rfi-upload-section span {
  margin-left: 10px;
  font-style: italic;
  color: #6c757d;
}

table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 15px;
}

th, td {
  border: 1px solid #ddd;
  padding: 10px;
  text-align: left;
  vertical-align: top;
}

th {
  background-color: #f2f2f2;
  font-weight: 600;
}

td button {
  margin-right: 5px;
  margin-bottom: 5px; /* For stacking on smaller screens */
  white-space: nowrap;
}

td button i {
    margin-right: 5px;
}
</style>