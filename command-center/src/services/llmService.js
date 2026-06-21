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

export async function proposeModification(playbookName, modification, model) {
  const url = `${API_BASE}/playbooks/modify/propose`;

  const body = {
    playbook_name: playbookName,
    modification: modification,
  };
  if (model) {
    body.model = model;
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

  return await res.json();
}

export async function approveModification(payload) {
  const url = `${API_BASE}/playbooks/modify/approve`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Backend error: ${res.status} ${text}`);
  }

  return await res.json();
}
