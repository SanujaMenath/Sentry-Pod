import api from "./api";

export const getAllHostsDeviceCount = async () => {
  try {
    const response = await api.get("/playbooks/inventory/all-hosts-count");

    return response.data;
  } catch (error) {
    throw error.response?.data?.detail || "Failed to fetch allHosts count";
  }
};