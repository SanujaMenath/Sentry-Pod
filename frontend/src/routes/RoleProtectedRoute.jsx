import { Navigate } from "react-router-dom";
import { jwtDecode } from "jwt-decode";

const RoleProtectedRoute = ({ children, allowedRoles }) => {
  const token = localStorage.getItem("token");

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  try {
    const decoded = jwtDecode(token);
    const now = Date.now() / 1000;

    if (decoded.exp < now) {
      localStorage.removeItem("token");
      return <Navigate to="/login" replace />;
    }

    const userRole = decoded.role;

    if (!allowedRoles.includes(userRole)) {
      return <Navigate to="/dashboard" replace />;
    }

    return children;

  } catch (e) {
    localStorage.removeItem("token");
    return <Navigate to="/login" replace />;
  }
};

export default RoleProtectedRoute;