import api from "./api";

export const getSyncStatus = () => api.get("/api/sync/status");
export const runSyncNow = () => api.post("/api/sync/run");
export const resolveSync = (decisions) =>
  api.post("/api/sync/resolve", {
    conflicts: decisions.conflicts || [],
    delete_vs_modify: decisions.delete_vs_modify || [],
  });

export const getBackups = () => api.get("/api/backups");
export const createBackup = () => api.post("/api/backups");
export const restoreBackup = (name) => api.post(`/api/backups/restore/${name}`);

export const getSystemHealth = () => api.get("/api/system/health");