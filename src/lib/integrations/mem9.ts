import type {
  MemoryProvider,
  MemoryEntry,
  ImportMeta,
} from "./types";

const API_BASE = "https://api.mem9.ai/v1alpha1/mem9s";

/**
 * mem9 persistent cloud memory provider.
 *
 * Each expert gets their own memory space (identified by a space ID stored
 * on the Expert model). The agent accumulates knowledge over time:
 *   - Onboarding data (bio, services, social)
 *   - Booking/session summaries
 *   - Meeting transcripts
 *   - Client feedback / reviews
 *   - Social media activity
 */
export class Mem9Provider implements MemoryProvider {
  async createSpace(): Promise<string> {
    const res = await fetch(API_BASE, { method: "POST" });
    if (!res.ok) throw new Error(`mem9 createSpace failed (${res.status})`);
    const data = await res.json();
    return data.id;
  }

  async store(spaceId: string, entry: MemoryEntry): Promise<string> {
    const res = await fetch(`${API_BASE}/${spaceId}/memories`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: entry.content,
        tags: entry.tags,
        source: entry.source,
      }),
    });
    if (!res.ok) throw new Error(`mem9 store failed (${res.status})`);
    const data = await res.json();
    return data.id;
  }

  async search(spaceId: string, query: string, limit = 10): Promise<MemoryEntry[]> {
    const params = new URLSearchParams({ q: query, limit: String(limit) });
    const res = await fetch(`${API_BASE}/${spaceId}/memories?${params}`);
    if (!res.ok) throw new Error(`mem9 search failed (${res.status})`);
    return res.json();
  }

  async get(spaceId: string, memoryId: string): Promise<MemoryEntry | null> {
    const res = await fetch(`${API_BASE}/${spaceId}/memories/${memoryId}`);
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`mem9 get failed (${res.status})`);
    return res.json();
  }

  async update(spaceId: string, memoryId: string, content: string): Promise<void> {
    const res = await fetch(`${API_BASE}/${spaceId}/memories/${memoryId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });
    if (!res.ok) throw new Error(`mem9 update failed (${res.status})`);
  }

  async delete(spaceId: string, memoryId: string): Promise<void> {
    const res = await fetch(`${API_BASE}/${spaceId}/memories/${memoryId}`, {
      method: "DELETE",
    });
    if (!res.ok) throw new Error(`mem9 delete failed (${res.status})`);
  }

  async importFile(spaceId: string, file: Buffer | Uint8Array, meta: ImportMeta): Promise<string> {
    const formData = new FormData();
    formData.append("file", new Blob([new Uint8Array(file)]), "upload.json");
    formData.append("file_type", meta.fileType);
    if (meta.agentId) formData.append("agent_id", meta.agentId);
    if (meta.sessionId) formData.append("session_id", meta.sessionId);

    const res = await fetch(`${API_BASE}/${spaceId}/imports`, {
      method: "POST",
      body: formData,
    });
    if (!res.ok) throw new Error(`mem9 import failed (${res.status})`);
    const data = await res.json();
    return data.id;
  }
}
