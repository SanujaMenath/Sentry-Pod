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
export const addPlaybook = async (playbookData) => {
  try {
    const response = await api.post("/playbooks/add", playbookData);
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

// Drops a playbook blueprint row cleanly out of MongoDB by its unique ID string
export const deletePlaybook = async (playbookId) => {
  try {
    const response = await api.delete(`/playbooks/delete/${playbookId}`);
    return response.data;
  } catch (error) {
    throw error.response?.data?.detail || "Failed to delete playbook entry permanently";
  }
};