import api from "./api";

export const getNotifications = () => api.get("/api/notifications");
export const markNotificationRead = (id) => api.post(`/api/notifications/${id}/read`);
export const markAllNotificationsRead = () => api.post("/api/notifications/read-all");
