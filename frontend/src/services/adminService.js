import api from "./api";

export const fetchSystemUsers = async () => {
  try {
    const response = await api.get("/users/");
    return response.data;
  } catch (error) {
    throw error.response?.data?.detail || "Failed to retrieve system user lists.";
  }
};

export const modifyUserRole = async (userId, targetRole) => {
  try {
    const response = await api.put(`/users/${userId}/role`, { role: targetRole });
    return response.data;
  } catch (error) {
    throw error.response?.data?.detail || "Failed to modify user access privileges.";
  }
};