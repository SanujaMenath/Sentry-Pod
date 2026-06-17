import api from "./api";

export const getSetupStatus = async () => {
  try {
    const response = await api.get("/setup/status");
    return response.data;
  } catch (error) {
    throw error.response?.data?.detail || "Failed to check setup status";
  }
};

export const previewSetup = async (payload) => {
  try {
    const response = await api.post("/setup/preview", payload);
    return response.data;
  } catch (error) {
    throw error.response?.data?.detail || "Failed to generate preview";
  }
};

export const applySetup = async (payload) => {
  try {
    const response = await api.post("/setup/apply", payload);
    return response.data;
  } catch (error) {
    throw error.response?.data?.detail || "Failed to apply setup";
  }
};

export const initUser = async (userData) => {
  try {
    const response = await api.post("/setup/init-user", userData);
    return response.data;
  } catch (error) {
    throw error.response?.data?.detail || "Failed to create admin user";
  }
};

export const initCollections = async () => {
  try {
    const response = await api.post("/setup/init-collections");
    return response.data;
  } catch (error) {
    throw error.response?.data?.detail || "Failed to initialize collections";
  }
};

export const generateSecret = async () => {
  try {
    const response = await api.post("/setup/generate-secret");
    return response.data;
  } catch (error) {
    throw error.response?.data?.detail || "Failed to generate JWT secret";
  }
};
