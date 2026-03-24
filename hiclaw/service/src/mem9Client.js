const API_BASE = "https://api.mem9.ai/v1alpha1/mem9s";

export async function searchMemories(spaceId, query, limit = 10) {
  const params = new URLSearchParams({ q: query, limit: String(limit) });
  const res = await fetch(`${API_BASE}/${spaceId}/memories?${params}`);
  if (!res.ok) throw new Error(`mem9 search failed (${res.status})`);
  return res.json();
}

export async function storeMemory(spaceId, { content, tags, source }) {
  const res = await fetch(`${API_BASE}/${spaceId}/memories`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content, tags, source }),
  });
  if (!res.ok) throw new Error(`mem9 store failed (${res.status})`);
  return res.json();
}

/**
 * Retrieve expert context for shadow generation.
 * Returns concatenated memory content as a single context string.
 */
export async function getExpertContext(spaceId, query) {
  const memories = await searchMemories(spaceId, query, 15);
  return memories.map((m) => m.content).join("\n\n");
}
