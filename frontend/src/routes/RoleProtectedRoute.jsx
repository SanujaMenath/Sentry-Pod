import { Navigate, useLocation } from "react-router-dom";
import { useState } from "react";
import { jwtDecode } from "jwt-decode";
import { PAGE_PERMISSIONS } from "../constants/roles";
import AccessDenied from "../components/AccessDenied";

const RoleProtectedRoute = ({ children }) => {
  const location = useLocation();
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

  const userRole = decoded.role;
  const allowedRoles = PAGE_PERMISSIONS[location.pathname] || [];

  if (!allowedRoles.includes(userRole)) {
    return <AccessDenied requiredRole={allowedRoles.join(", ")} />;
  }

  return children;
};

export default RoleProtectedRoute;