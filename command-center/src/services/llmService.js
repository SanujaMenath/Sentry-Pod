const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

export async function generateText(prompt, model, sessionId = null) {
  const url = `${API_BASE}/llm/chat`;

  const body = {
    prompt: prompt,
    model: model,
  };
  if (sessionId) {
    body.session_id = sessionId;
  }

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Backend error: ${res.status} ${text}`);
  }

  const data = await res.json();

  if (data.text) {
    return {
      text: data.text,
      reasoning: data.reasoning || null,
      model: data.model || null,
      session_id: data.session_id || null,
      playbook_suggestions: data.playbook_suggestions || [],
    };
  }

  throw new Error("No response text from backend");
}
