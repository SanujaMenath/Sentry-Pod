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