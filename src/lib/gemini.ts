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
  const bioSnippet = data.bio.slice(0, 200);

  const prompt = `Create a professional, modern profile illustration for a tech expert named ${data.nickName}. This is a stylized digital illustration, NOT a photo of a real person.

Domains: ${data.domains.join(", ")}
Context: ${bioSnippet}

Style: Clean flat vector illustration with indigo/blue palette. Show abstract visual elements for their expertise (e.g. AI neural networks, marketing charts, globe for business expansion). Professional and premium feel. No text or letters in the image.`;

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
