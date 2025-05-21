import React, { useState } from 'react';
import './TaskTable.css';

const initialNewTask = {
  projectName: '',
  taskName: '',
  eng: 0,
  artUnreal: 0,
  sysEng: 0,
  qa: 0,
  pm: 0,
  doc: 0,
  travel: 0,
  materials: 0,
};

function TaskTable({ tasks, onAddTask, onUpdateTask, onDeleteTask }) {
  const [newTask, setNewTask] = useState({ ...initialNewTask });
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [editingTask, setEditingTask] = useState(null);

  const handleNewTaskChange = (e) => {
    const { name, value } = e.target;
    setNewTask((prev) => ({
      ...prev,
      [name]: name === 'taskName' || name === 'projectName' ? value : parseFloat(value) || 0,
    }));
  };

  const handleAddTaskClick = async () => {
    if (!newTask.taskName.trim()) {
      alert('Task name cannot be empty.');
      return;
    }
    await onAddTask(newTask);
    setNewTask({ ...initialNewTask }); // Reset form
  };

  const handleEditClick = (task) => {
    setEditingTaskId(task.id);
    setEditingTask({
      id: task.id,
      projectName: task.project_name, // Map database column name to React state name
      taskName: task.task,
      eng: task.eng,
      artUnreal: task.art_unreal,
      sysEng: task.sys_eng,
      qa: task.qa,
      pm: task.pm,
      doc: task.doc,
      travel: task.travel,
      materials: task.materials,
    });
  };

  const handleEditingTaskChange = (e) => {
    const { name, value } = e.target;
    setEditingTask((prev) => ({
      ...prev,
      [name]: name === 'taskName' || name === 'projectName' ? value : parseFloat(value) || 0,
    }));
  };

  const handleSaveEdit = async () => {
    if (!editingTask.taskName.trim()) {
      alert('Task name cannot be empty.');
      return;
    }
    await onUpdateTask(editingTask);
    setEditingTaskId(null);
    setEditingTask(null);
  };

  const handleCancelEdit = () => {
    setEditingTaskId(null);
    setEditingTask(null);
  };

  return (
    <div className="task-table-container">
      <table className="task-table">
        <thead>
          <tr>
            <th>Project Name</th>
            <th>Task</th>
            <th>Eng (Days)</th>
            <th>Art / Unreal (Days)</th>
            <th>Sys. Eng (Days)</th>
            <th>QA (Days)</th>
            <th>PM (Days)</th>
            <th>Doc (Days)</th>
            <th>Travel ($)</th>
            <th>Materials ($)</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((task) => (
            <tr key={task.id}>
              {editingTaskId === task.id ? (
                <>
                  <td><input type="text" name="projectName" value={editingTask.projectName} onChange={handleEditingTaskChange} /></td>
                  <td><input type="text" name="taskName" value={editingTask.taskName} onChange={handleEditingTaskChange} /></td>
                  <td><input type="number" name="eng" value={editingTask.eng} onChange={handleEditingTaskChange} /></td>
                  <td><input type="number" name="artUnreal" value={editingTask.artUnreal} onChange={handleEditingTaskChange} /></td>
                  <td><input type="number" name="sysEng" value={editingTask.sysEng} onChange={handleEditingTaskChange} /></td>
                  <td><input type="number" name="qa" value={editingTask.qa} onChange={handleEditingTaskChange} /></td>
                  <td><input type="number" name="pm" value={editingTask.pm} onChange={handleEditingTaskChange} /></td>
                  <td><input type="number" name="doc" value={editingTask.doc} onChange={handleEditingTaskChange} /></td>
                  <td><input type="number" name="travel" value={editingTask.travel} onChange={handleEditingTaskChange} /></td>
                  <td><input type="number" name="materials" value={editingTask.materials} onChange={handleEditingTaskChange} /></td>
                  <td>
                    <button onClick={handleSaveEdit}>Save</button>
                    <button onClick={handleCancelEdit}>Cancel</button>
                  </td>
                </>
              ) : (
                <>
                  <td>{task.project_name}</td>
                  <td>{task.task}</td>
                  <td>{task.eng}</td>
                  <td>{task.art_unreal}</td>
                  <td>{task.sys_eng}</td>
                  <td>{task.qa}</td>
                  <td>{task.pm}</td>
                  <td>{task.doc}</td>
                  <td>${task.travel.toFixed(2)}</td>
                  <td>${task.materials.toFixed(2)}</td>
                  <td>
                    <button onClick={() => handleEditClick(task)}>Edit</button>
                    <button className="delete-button" onClick={() => onDeleteTask(task.id)}>Delete</button>
                  </td>
                </>
              )}
            </tr>
          ))}
          {/* New Task Row for adding */}
          <tr>
            <td><input type="text" name="projectName" placeholder="Project Name (Optional)" value={newTask.projectName} onChange={handleNewTaskChange} /></td>
            <td><input type="text" name="taskName" placeholder="New Task" value={newTask.taskName} onChange={handleNewTaskChange} /></td>
            <td><input type="number" name="eng" value={newTask.eng} onChange={handleNewTaskChange} /></td>
            <td><input type="number" name="artUnreal" value={newTask.artUnreal} onChange={handleNewTaskChange} /></td>
            <td><input type="number" name="sysEng" value={newTask.sysEng} onChange={handleNewTaskChange} /></td>
            <td><input type="number" name="qa" value={newTask.qa} onChange={handleNewTaskChange} /></td>
            <td><input type="number" name="pm" value={newTask.pm} onChange={handleNewTaskChange} /></td>
            <td><input type="number" name="doc" value={newTask.doc} onChange={handleNewTaskChange} /></td>
            <td><input type="number" name="travel" value={newTask.travel} onChange={handleNewTaskChange} /></td>
            <td><input type="number" name="materials" value={newTask.materials} onChange={handleNewTaskChange} /></td>
            <td>
              <button onClick={handleAddTaskClick}>Add Task</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export default TaskTable;