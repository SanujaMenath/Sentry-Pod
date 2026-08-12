import api from "./api";

export const getAllHostsDeviceCount = async () => {
  try {
    const response = await api.get("/playbooks/inventory/all-hosts-count");

    return response.data;
  } catch (error) {
    throw error.response?.data?.detail || "Failed to fetch allHosts count";
  }
};

// Fetches dynamic metrics and active blueprints table documents together
export const getPlaybookDashboardData = async () => {
  try {
    const response = await api.get("/playbooks/dashboard");
    return response.data;
  } catch (error) {
    throw error.response?.data?.detail || "Failed to load playbook dashboard metrics";
  }
};

// Dispatches your modal registration form data payload straight to MongoDB
export const addPlaybook = async (formData) => {
  try {
    const response = await api.post("/playbooks/add", formData, {
      headers: { "Content-Type": "multipart/form-data" }
    });
    return response.data;
  } catch (error) {
    throw error.response?.data?.detail || "Failed to register new playbook blueprint";
  }
};

// Triggers playbook automation execution when clicking the "Run" button
export const executePlaybook = async (playbookName) => {
  try {
    const response = await api.post("/playbooks/execute", {
      playbook_name: playbookName
    });
    return response.data;
  } catch (error) {
    throw error.response?.data?.detail || "Playbook execution dispatch failed";
  }
};

// Executes a playbook with extra vars (e.g. network settings from the Settings page)
export const executePlaybookWithVars = async (playbookName, extraVars = {}) => {
  try {
    const response = await api.post("/playbooks/execute", {
      playbook_name: playbookName,
      extra_vars: extraVars
    });
    return response.data;
  } catch (error) {
    throw error.response?.data?.detail || "Playbook execution dispatch failed";
  }
};

// Drops a playbook blueprint row cleanly out of MongoDB by its unique ID string
export const deletePlaybook = async (playbookId) => {
  try {
    const response = await api.delete(`/playbooks/delete/${playbookId}`);
    return response.data;
  } catch (error) {
    throw error.response?.data?.detail || "Failed to delete playbook entry permanently";
  }
};

export const updatePlaybook = async (id, playbookData) => {
  try {
    const response = await api.put(`/playbooks/${id}`, playbookData);
    return response.data;
  } catch (error) {
    throw error.response?.data?.detail || "Failed to update playbook blueprint";
  }
};

export const updatePlaybookStatus = async (id, status) => {
  try {
    const response = await api.patch(`/playbooks/${id}/status`, { pipeline_status: status });
    return response.data;
  } catch (error) {
    throw error.response?.data?.detail || "Failed to update pipeline status";
  }
};