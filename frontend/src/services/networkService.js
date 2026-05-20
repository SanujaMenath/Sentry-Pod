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