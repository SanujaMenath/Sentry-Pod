import axios from "axios";

const API_URL = "http://localhost:8000";

export const getAllHostsDeviceCount = async () => {
  try {
    const response = await axios.get(`${API_URL}/playbooks/inventory/all-hosts-count`);
    return response.data;
  } catch (error) {
    throw error.response?.data?.detail || "Failed to fetch allHosts count";
  }
};
