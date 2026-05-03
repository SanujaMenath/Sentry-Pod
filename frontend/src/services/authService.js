import axios from 'axios';

const API_URL = 'http://localhost:8000';

export const login = async (username, password) => {
  try {
    const response = await axios.post(`${API_URL}/login`, { username, password });
    
    if (response.data.access_token) {
      // Store token in LocalStorage for persistence
      localStorage.setItem('token', response.data.access_token);
    }
    
    return response.data;
  } catch (error) {
    throw error.response?.data?.detail || "Login failed";
  }
};

export const logout = () => {
  localStorage.removeItem('token');
};