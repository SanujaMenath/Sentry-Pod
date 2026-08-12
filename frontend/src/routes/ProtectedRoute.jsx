import { Navigate } from "react-router-dom";
import { useState } from "react";
import { jwtDecode } from "jwt-decode";

const ProtectedRoute = ({ children }) => {
  const token = localStorage.getItem("token");
  const [now] = useState(() => Date.now() / 1000);

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  let decoded;
  try {
    decoded = jwtDecode(token);
  } catch {
    decoded = null;
  }

  if (!decoded || decoded.exp < now) {
    localStorage.removeItem("token");
    return <Navigate to="/login" replace />;
  }

  return children;
};

export default ProtectedRoute;