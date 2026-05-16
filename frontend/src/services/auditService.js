import axios from 'axios';

const API_URL = 'http://localhost:8000';

export const logAction = async (actionName, playbookName, status, output, username = 'Anonymous User') => {
  try {
    const response = await axios.post(`${API_URL}/audit-logs/log-action`, {
      action_name: actionName,
      playbook_name: playbookName,
      status: status,
      output: output,
      username: username,
    });
    
    return response.data;
  } catch (error) {
    console.error('Error logging action:', error);
    throw error.response?.data?.detail || "Failed to log action";
  }
};

export const getAllAuditLogs = async (limit = 50) => {
  try {
    const response = await axios.get(`${API_URL}/audit-logs/all`, {
      params: { limit }
    });
    
    return response.data;
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    throw error.response?.data?.detail || "Failed to fetch audit logs";
  }
};

export const getLogsByUser = async (username, limit = 50) => {
  try {
    const response = await axios.get(`${API_URL}/audit-logs/by-user/${username}`, {
      params: { limit }
    });
    
    return response.data;
  } catch (error) {
    console.error('Error fetching logs by user:', error);
    throw error.response?.data?.detail || "Failed to fetch logs";
  }
};
