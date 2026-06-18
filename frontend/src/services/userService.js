import api from "./api";

export const createUser = async (userData) => {
  try {
    const response = await api.post("/users/", userData);
    return response.data;
  } catch (error) {
    console.error("Error creating user:", error.response?.data?.detail || error.message);
    throw error.response?.data?.detail || "An unexpected error occurred";
  }
};