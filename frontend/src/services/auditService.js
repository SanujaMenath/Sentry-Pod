import api from "./api";

export const logAction = async (actionName, playbookName, status, output, username = 'Anonymous User') => {
  try {
    const response = await api.post('/audit-logs/log-action', {
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
    const response = await api.get('/audit-logs/all', {
      params: { limit }
    });
    
    return response.data;
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    throw error.response?.data?.detail || "Failed to fetch audit logs";
  }
};

export const getAuditLogById = async (logId) => {
  try {
    const response = await api.get(`/audit-logs/${logId}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching audit log:', error);
    throw error.response?.data?.detail || "Failed to fetch audit log";
  }
};

export const getLogsByUser = async (username, limit = 50) => {
  try {
    const response = await api.get(`/audit-logs/by-user/${username}`, {
      params: { limit }
    });
    
    return response.data;
  } catch (error) {
    console.error('Error fetching logs by user:', error);
    throw error.response?.data?.detail || "Failed to fetch logs";
  }
};
