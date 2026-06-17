import api from './api';

export const fetchNetworkTraffic = async () => {
  try {
    // Hits http://localhost:8000/api/network/traffic-history
    const response = await api.get('/api/network/traffic-history');
    return response.data;
  } catch (error) {
    console.error("Error fetching network traffic telemetry:", error);
    throw error;
  }
};

export const fetchNetworkDevices = async () => {
  try {
    const response = await api.get('/api/network/devices');
    return response.data;
  } catch (error) {
    console.error("Error fetching network devices:", error);
    throw error;
  }
};

export const addNetworkDevice = async (device) => {
  try {
    const response = await api.post('/api/network/devices', device);
    return response.data;
  } catch (error) {
    console.error("Error adding network device:", error);
    throw error;
  }
};

export const updateNetworkDevice = async (deviceId, updates) => {
  try {
    const response = await api.put(`/api/network/devices/${deviceId}`, updates);
    return response.data;
  } catch (error) {
    console.error("Error updating network device:", error);
    throw error;
  }
};

export const saveDeviceConfiguration = async (deviceId, configuration) => {
  try {
    const response = await api.post(`/api/network/devices/${deviceId}/configure`, configuration);
    return response.data;
  } catch (error) {
    console.error("Error saving device configuration:", error);
    throw error;
  }
};

export const runNetworkTerminalCommand = async (deviceId, command) => {
  try {
    const response = await api.post(`/api/network/devices/${deviceId}/terminal-command`, { command });
    return response.data;
  } catch (error) {
    console.error("Error running terminal command:", error);
    throw error;
  }
};

export const getNetworkTerminalSocketUrl = (deviceId) => {
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || window.location.origin;
  const url = new URL(apiBaseUrl);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  url.pathname = `/api/network/devices/${deviceId}/terminal/ws`;
  url.search = '';
  return url.toString();
};


export const fetchDevices = async () => {
  try {
    const resp = await api.get('/api/network/devices');
    return resp.data;
  } catch (e) {
    console.error('Error fetching network devices:', e);
    return [];
  }
};

export const fetchNetworkTrafficFor = async (params = {}) => {
  try {
    const resp = await api.get('/api/network/traffic-history', { params });
    return resp.data;
  } catch (e) {
    console.error('Error fetching filtered network traffic:', e);
    throw e;
  }
};

export const getRefreshFactsUrl = () => {
  const base = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000';
  return `${base}/api/network/refresh-facts`;
};

export const fetchTelemetryHosts = async () => {
  try {
    const resp = await api.get('/api/network/telemetry-hosts');
    return resp.data;
  } catch (e) {
    console.error('Error fetching telemetry hosts:', e);
    return [];
  }
};