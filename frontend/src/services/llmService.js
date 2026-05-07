export async function generateText(prompt, model) {
  // Call backend proxy with the selected HF Router model
  const url = `http://localhost:8000/llm/chat`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prompt: prompt,
      model: model,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Backend error: ${res.status} ${text}`);
  }

  const data = await res.json();

  // Backend returns { text: "...", reasoning: "..." or null, model: "..." }
  if (data.text) {
    return {
      text: data.text,
      reasoning: data.reasoning || null,
      model: data.model || null,
    };
  }

  throw new Error("No response text from backend");
}
