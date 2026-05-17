import api from "./api";

export const login = async (username, password) => {
  try {
    const response = await api.post("/login", {
      username,
      password,
    });

    if (response.data.access_token) {
      localStorage.setItem("token", response.data.access_token);
      localStorage.setItem("username", username);
    }

    return response.data;
  } catch (error) {
    throw error.response?.data?.detail || "Login failed";
  }
};

export const logout = () => {
  localStorage.removeItem("token");
  localStorage.removeItem("username");

  window.location.href = "/login";
};

export const register = async (fullName, email, username, password) => {
  try {
    const response = await api.post("/users/", { 
      full_name: fullName,
      email,
      username,
      password
    });
    return response.data;
  } catch (error) {
    throw error.response?.data?.detail || "Registration failed";
  }
};