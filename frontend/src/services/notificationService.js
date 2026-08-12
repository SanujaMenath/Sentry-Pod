import api from "./api";

export const getNotifications = () => api.get("/api/notifications");
export const markNotificationRead = (id) => api.post(`/api/notifications/${id}/read`);
export const markAllNotificationsRead = () => api.post("/api/notifications/read-all");
export const clearNotifications = () => api.post("/api/notifications/clear");
export const getNotificationPreferences = () => api.get("/api/notifications/preferences");
export const updateNotificationPreferences = (preferences) => api.put("/api/notifications/preferences", preferences);
