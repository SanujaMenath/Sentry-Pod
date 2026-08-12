import { jwtDecode } from "jwt-decode";

export const ROLES = {
  SUPER_ADMIN: "Super Admin",
  NETWORK_ADMIN: "Network Admin",
  SECURITY_ADMIN: "Security Admin",
  AUDITOR: "Auditor",
  READ_ONLY: "Read Only",
  PENDING: "Pending",
};

export const ALL_ROLES = Object.values(ROLES);

export const PAGE_PERMISSIONS = {
  "/dashboard": ALL_ROLES,
  "/topology": [ROLES.SUPER_ADMIN, ROLES.NETWORK_ADMIN],
  "/ai-chat": [
    ROLES.SUPER_ADMIN,
    ROLES.NETWORK_ADMIN,
    ROLES.SECURITY_ADMIN,
    ROLES.AUDITOR,
  ],
  "/profile": ALL_ROLES,
  "/settings": [ROLES.SUPER_ADMIN],
  "/drift-reports": [
    ROLES.SUPER_ADMIN,
    ROLES.NETWORK_ADMIN,
    ROLES.SECURITY_ADMIN,
    ROLES.AUDITOR,
  ],
  "/console": [ROLES.SUPER_ADMIN, ROLES.NETWORK_ADMIN],
  "/network-devices": [
    ROLES.SUPER_ADMIN,
    ROLES.NETWORK_ADMIN,
    ROLES.SECURITY_ADMIN,
  ],
  "/audit-logs": [ROLES.SUPER_ADMIN, ROLES.AUDITOR],
  "/users": [ROLES.SUPER_ADMIN],
  "/playbooks": [ROLES.SUPER_ADMIN, ROLES.NETWORK_ADMIN],
};

export const getCurrentUserRole = () => {
  try {
    const token = localStorage.getItem("token");
    if (!token) return "";
    return jwtDecode(token).role || "";
  } catch {
    return "";
  }
};