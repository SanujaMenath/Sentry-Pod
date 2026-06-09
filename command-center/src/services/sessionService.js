import api from "./api";

export async function listSessions() {
  const res = await api.get("/llm/sessions");
  return res.data.sessions || [];
}

export async function getSession(sessionId) {
  const res = await api.get(`/llm/sessions/${sessionId}`);
  return res.data;
}

export async function createSession() {
  const res = await api.post("/llm/sessions");
  return res.data;
}

export async function updateSessionTitle(sessionId, title) {
  const res = await api.put(`/llm/sessions/${sessionId}`, { title });
  return res.data;
}

export async function deleteSession(sessionId) {
  const res = await api.delete(`/llm/sessions/${sessionId}`);
  return res.data;
}
