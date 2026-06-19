import api from "./api";

export const getTopologyGraph = () => api.get("/api/topology/graph");
export const refreshTopology = () => api.post("/api/topology/refresh");
