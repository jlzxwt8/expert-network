import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

const MODEL = "gemini-2.5-flash";

function cleanJsonResponse(text: string): string {
  return text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
}

function ensureString(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(ensureString).join("\n");
  if (typeof value === "object" && value !== null) {
    return Object.entries(value)
      .map(([k, v]) => `**${k}**: ${ensureString(v)}`)
      .join("\n");
  }
  return String(value ?? "");
}

export async function generateExpertProfile(data: {
  linkedIn?: string;
  twitter?: string;
  substack?: string;
  instagram?: string;
  tiktok?: string;
  xiaohongshu?: string;
  domains: string[];
  nickName: string;
  resumeText?: string;
}) {
  const socialLinks = [
    data.linkedIn && `LinkedIn: ${data.linkedIn}`,
    data.twitter && `X/Twitter: ${data.twitter}`,
    data.substack && `Substack: ${data.substack}`,
    data.instagram && `Instagram: ${data.instagram}`,
    data.tiktok && `TikTok: ${data.tiktok}`,
    data.xiaohongshu && `XiaoHongShu: ${data.xiaohongshu}`,
  ]
    .filter(Boolean)
    .join("\n");

  const resumeSection = data.resumeText
    ? `\n\nAdditional context from uploaded document:\n${data.resumeText.slice(0, 3000)}`
    : "";

  const prompt = `You are creating a professional profile for an expert on the Help&Grow Expert Network — a platform connecting Singapore-based tech professionals with global startup founders.

Expert's name: ${data.nickName}
Professional domains: ${data.domains.join(", ")}
Social profiles:
${socialLinks}${resumeSection}

STEP 1 — Research: Use Google Search to look up each social profile link above. Gather ONLY verifiable facts:
- Job title, company, professional headline
- Real work history and achievements
- Follower/subscriber/connection counts (exact numbers only if found)
- Content themes and recent posts
- For Instagram/TikTok/XiaoHongShu: follower count, content focus — these indicate KOL/marketing capability

CRITICAL RULES:
- NEVER fabricate or estimate numbers. If you cannot find an exact number, DO NOT mention it.
- NEVER invent companies, job titles, or achievements not found in search results.
- If search returns limited info, write a shorter bio using ONLY what you found. A short truthful bio is better than a long fabricated one.

STEP 2 — Generate a JSON object with these 3 keys:

1. "bio" (STRING — must be a single markdown-formatted string, NOT an object or array):
Write a concise third-person summary in markdown bullet points:
- **Current Role**: Job title and company (if found)
- **Expertise**: 2-3 bullet points on distinct domain areas
- **Track Record**: 1-2 bullet points with verifiable achievements
- **Social Presence**: Follower/subscriber counts (only if found via search)
Keep under 100 words. No fluff.

2. "services" (ARRAY of objects): 3-4 specific services, each as {"title": "...", "description": "... (1 sentence)"}

3. "videoScript" (STRING): A natural first-person introduction (45-60 seconds spoken). Use ONLY real facts. Structure: who I am → what I do → how I help founders → book a session CTA.

IMPORTANT: "bio" must be a plain string with markdown formatting, never a JSON object or array.

Return ONLY the JSON object, no markdown code fences.`;

  const response = await ai.models.generateContent({
    model: MODEL,
    contents: prompt,
    config: {
      tools: [{ googleSearch: {} }],
    },
  });

  const text = response.text ?? "";
  const cleaned = cleanJsonResponse(text);
  const parsed = JSON.parse(cleaned);

  return {
    bio: ensureString(parsed.bio),
    services: Array.isArray(parsed.services) ? parsed.services : [],
    videoScript: ensureString(parsed.videoScript),
  };
}

export async function generateProfileImage(data: {
  nickName: string;
  domains: string[];
  bio: string;
}): Promise<string | null> {
  const bioSnippet = data.bio.slice(0, 300);

  const domainVisuals: Record<string, string> = {
    "AI Tech": "neural network nodes, circuit patterns, glowing data streams",
    "Fintech": "abstract currency symbols, blockchain links, rising chart lines",
    "Local Marketing": "location pins, megaphone waves, connected community dots",
    "Compliance": "shield emblem, balanced scales, structured grid patterns",
    "Business Expansion": "globe with connection arcs, rocket trail, branching paths",
    "Legal/Regulatory": "gavel silhouette, document layers, pillar structures",
  };

  const visualElements = data.domains
    .map((d) => domainVisuals[d] || d.toLowerCase())
    .join("; ");

  const prompt = `Create a unique, personalized digital avatar for a professional expert. This must be an artistic character illustration — NOT a real photo, NOT a generic icon.

Expert profile:
- Name: ${data.nickName}
- Expertise: ${data.domains.join(", ")}
- Background: ${bioSnippet}

Design requirements:
- Create a stylized character (like a modern cartoon/anime-inspired avatar) with distinctive features that feel personal and unique to this expert
- The character should have a confident, approachable expression
- Incorporate visual elements from their expertise domains into the scene or outfit: ${visualElements}
- Use a rich color palette with indigo/purple as the primary accent
- The character should be shown from shoulders up or mid-body, slightly angled
- Add a subtle abstract background with floating elements related to their domains
- The overall feeling should be: premium, creative, slightly playful, and professional
- The avatar should feel like it belongs to THIS specific person but should NOT resemble any real person — it's an artistic representation of their professional identity
- Do NOT include any text, letters, words, or watermarks in the image

This avatar protects the expert's real identity while giving them a memorable, personal brand image.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-image",
      contents: prompt,
      config: {
        responseModalities: ["image", "text"],
      },
    });

    const parts = response.candidates?.[0]?.content?.parts ?? [];
    for (const part of parts) {
      if (part.inlineData?.data) {
        const mimeType = part.inlineData.mimeType || "image/png";
        return `data:${mimeType};base64,${part.inlineData.data}`;
      }
    }
    console.error("[generateProfileImage] No image data in response parts:", JSON.stringify(parts.map(p => ({ hasInlineData: !!p.inlineData, hasText: !!p.text }))));
    return null;
  } catch (error) {
    console.error("[generateProfileImage]", error);
    return null;
  }
}

export async function matchExperts(
  query: string,
  expertSummaries: string,
  conversationHistory: { role: string; content: string }[]
) {
  const historyContext = conversationHistory
    .map((m) => `${m.role}: ${m.content}`)
    .join("\n");

  const prompt = `You are the AI matchmaking assistant for the Help&Grow Expert Network — a platform connecting Singapore-based tech professionals with global startup founders.

Here is the pool of available experts:
${expertSummaries}

${historyContext ? `Previous conversation:\n${historyContext}\n` : ""}

The founder's latest query: "${query}"

Based on your deep analysis of the founder's needs and the expert pool, recommend the top 2-3 most relevant experts. For each recommendation, provide:

1. "expertId": The expert's ID
2. "name": The expert's name
3. "reason": A highly specific 2-3 sentence explanation of why this expert's background perfectly matches the founder's need.
4. "sessionTypes": Available session types

If no expert matches well, return empty "recommendations" array with a "noMatchMessage" string.

Return ONLY a JSON object, no markdown code fences.`;

  const response = await ai.models.generateContent({
    model: MODEL,
    contents: prompt,
  });

  const text = response.text ?? "";
  const cleaned = cleanJsonResponse(text);
  return JSON.parse(cleaned) as {
    recommendations: {
      expertId: string;
      name: string;
      reason: string;
      sessionTypes: string[];
    }[];
    noMatchMessage?: string;
  };
}
