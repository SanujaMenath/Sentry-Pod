import api from "./api";

export const getUserProfile = async () => {
  try {
    const response = await api.get("/users/me");
    return response.data;
  } catch (error) {
    throw error.response?.data?.detail || "Failed to fetch profile info";
  }
};

export const updateProfile = async (profileData) => {
  try {
    const response = await api.put("/users/me", profileData);
    return response.data;
  } catch (error) {
    throw error.response?.data?.detail || "Failed to update profile";
  }
};

export const updatePassword = async (passwordData) => {
  try {
    const response = await api.put("/users/me/password", passwordData);
    return response.data;
  } catch (error) {
    throw error.response?.data?.detail || "Failed to update password";
  }
};