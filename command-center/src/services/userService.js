import axios from 'axios';

const API_URL = 'http://localhost:8000/users';

export const createUser = async (userData) => {
  try {
    const response = await axios.post(`${API_URL}/`, userData);
    return response.data;
  } catch (error) {
    console.error("Error creating user:", error.response?.data?.detail || error.message);
    throw error.response?.data?.detail || "An unexpected error occurred";
  }
};