import { GoogleGenAI } from "@google/genai";
import * as fs from "fs";

function setupServiceAccountAuth() {
  const encoded = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!encoded || process.env.GOOGLE_APPLICATION_CREDENTIALS) return;

  const keyPath = "/tmp/gcp-sa-key.json";
  fs.writeFileSync(keyPath, Buffer.from(encoded, "base64").toString("utf-8"));
  process.env.GOOGLE_APPLICATION_CREDENTIALS = keyPath;
}

function createAIClient(): GoogleGenAI {
  const project = process.env.GOOGLE_CLOUD_PROJECT;
  const location = process.env.GOOGLE_CLOUD_LOCATION || "us-central1";

  if (project) {
    setupServiceAccountAuth();
    console.log(`[Gemini] Using Vertex AI (project=${project}, location=${location})`);
    return new GoogleGenAI({ vertexai: true, project, location });
  }

  console.log("[Gemini] Using AI Studio API key");
  return new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });
}

const ai = createAIClient();

export { ai };

const MODEL = "gemini-2.5-flash";
const IMAGE_MODEL = "gemini-2.5-flash-image";

async function generateImage(prompt: string): Promise<string | null> {
  const response = await ai.models.generateContent({
    model: IMAGE_MODEL,
    contents: prompt,
    config: {
      responseModalities: ["IMAGE"],
    },
  });

  const parts = response.candidates?.[0]?.content?.parts;
  if (!parts) return null;

  for (const part of parts) {
    if (part.inlineData?.data) {
      const mimeType = part.inlineData.mimeType || "image/png";
      return `data:${mimeType};base64,${part.inlineData.data}`;
    }
  }
  return null;
}

function cleanJsonResponse(text: string): string {
  let cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

  // If the model returned prose before/after the JSON, extract the JSON object
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    cleaned = jsonMatch[0];
  }

  return cleaned;
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
    ? `\n\nAdditional context from uploaded document (resume/CV):\n${data.resumeText.slice(0, 3000)}`
    : "";

  const prompt = `You are creating a professional profile for an expert on the Help&Grow Expert Network — a platform connecting Singapore-based tech professionals with global startup founders.

Expert's name: ${data.nickName}
Professional domains: ${data.domains.join(", ")}
Social profiles:
${socialLinks}${resumeSection}

STEP 1 — Research: Use Google Search to look up EACH social profile link AND the expert's name. For LinkedIn, also search for "[name] LinkedIn [company]" to find cached profile data. Gather ONLY verifiable facts:
- Job title, company, professional headline
- Real work history and achievements
- Follower/subscriber/connection counts (exact numbers only if found)
- Content themes and recent posts
- For Instagram/TikTok/XiaoHongShu: follower count, content focus

IMPORTANT: Some platforms (X/Twitter, TikTok, XiaoHongShu/RedBook) block Google indexing. If Google Search returns NO usable results for a platform, honestly state that you could not find information for that platform. Do NOT guess, infer, or fabricate details for platforms you could not search.

STEP 2 — Merge sources and assess what you actually found:
- For each social link, note whether Google Search returned real data or not.
- Combine verified facts from Google Search WITH the uploaded document (if provided).
- The uploaded document (resume/CV) is a TRUSTED source — use it for experience, skills, and achievements.
- Google Search results are useful for latest role, public presence, and follower counts.
- If a social link returned no data from search, do NOT pretend you found something. Simply omit it.

ABSOLUTE RULES — Truth over polish:
- NEVER fabricate or estimate numbers. If you cannot find a follower count, do NOT mention one.
- NEVER invent companies, job titles, achievements, or descriptions not found in search results or the uploaded document.
- NEVER describe content themes for a platform you could not access.
- A short, honest profile is ALWAYS better than a detailed but fabricated one.
- If you only have the uploaded document and no search results, say so — build the profile from the document alone.

STEP 3 — Generate a JSON object with these 4 keys:

1. "bio" (STRING — must be a single markdown-formatted string, NOT an object or array):
Write a concise third-person summary in markdown bullet points:
- **Current Role**: Job title and company (only if verified)
- **Expertise**: 2-3 bullet points on distinct domain areas
- **Track Record**: 1-2 bullet points with verifiable achievements
- **Social Presence**: Only mention platforms where you found real data. For platforms where search returned nothing, omit them entirely.
Keep under 100 words. No fluff.

2. "services" (ARRAY of objects): 3-4 services following MECE (Mutually Exclusive, Collectively Exhaustive) principle. Each service covers a distinct, non-overlapping area. Format: {"title": "concise service name (3-5 words)", "description": "one-sentence value proposition for founders"}

3. "videoScript" (STRING): A natural first-person introduction (45-60 seconds spoken). Use ONLY real verified facts. Structure: who I am → what I do → how I help founders → book a session CTA.

4. "sourceSummary" (STRING): A brief note listing which social platforms returned useful search data and which did not. Example: "Found data from: LinkedIn, Substack. No data from Google Search: X/Twitter, TikTok, XiaoHongShu (these platforms block search indexing)."

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

  const grounding = response.candidates?.[0]?.groundingMetadata;
  if (grounding?.webSearchQueries) {
    console.log("[generateExpertProfile] Google Search queries:", grounding.webSearchQueries);
    console.log("[generateExpertProfile] Grounding chunks:", grounding.groundingChunks?.length ?? 0);
  } else {
    console.warn("[generateExpertProfile] No grounding metadata — Google Search may not have been used");
  }

  const cleaned = cleanJsonResponse(text);

  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    console.error("[generateExpertProfile] Failed to parse JSON, raw response:", text.slice(0, 500));
    throw new Error("AI returned invalid response format. Please try again.");
  }

  if (parsed.sourceSummary) {
    console.log("[generateExpertProfile] Source summary:", parsed.sourceSummary);
  }

  return {
    bio: ensureString(parsed.bio),
    services: Array.isArray(parsed.services) ? parsed.services : [],
    videoScript: ensureString(parsed.videoScript),
    sourceSummary: ensureString(parsed.sourceSummary ?? ""),
  };
}

export async function generateProfileImage(data: {
  nickName: string;
  domains: string[];
  bio: string;
}): Promise<string | null> {
  if (!process.env.GOOGLE_CLOUD_PROJECT && !process.env.GEMINI_API_KEY) {
    console.error("[generateProfileImage] Neither GOOGLE_CLOUD_PROJECT nor GEMINI_API_KEY is set");
    return null;
  }

  const bioSnippet = data.bio.slice(0, 200);

  const domainVisuals: Record<string, string> = {
    "Marketing & BD": "megaphone waves, handshake silhouette, growth analytics charts, globe with connection arcs",
    "Headhunter": "magnifying glass over profile cards, talent pipeline, connecting dots",
    "Law": "balanced scales, gavel silhouette, document layers with legal seals",
    "Funding": "rising bar charts, currency symbols, rocket launch trail, investor handshake",
  };

  const visualElements = data.domains
    .map((d) => domainVisuals[d] || d.toLowerCase())
    .join("; ");

  const prompt = `A stylized digital avatar illustration of a professional expert. Modern cartoon style, NOT a real photo. The character has a confident, approachable expression shown from shoulders up. Rich indigo and purple color palette. Background has floating abstract elements: ${visualElements}. Premium, creative, slightly playful professional feel. The character wears modern business-casual attire with subtle details reflecting expertise in ${data.domains.join(" and ")}. Context: ${bioSnippet}. No text or watermarks in the image.`;

  try {
    return await generateImage(prompt);
  } catch (error) {
    console.error("[generateProfileImage]", error);
    return null;
  }
}

export async function improveWriting(
  type: "intro" | "services",
  content: string
): Promise<string> {
  const prompt =
    type === "intro"
      ? `You are a professional copywriter for the Help&Grow Expert Network.

Improve this expert's introduction script. Rules:
- Keep ALL facts, names, and claims unchanged
- Maintain first-person tone
- Make it more professional, concise, and engaging
- Target 45-60 seconds spoken length
- Do NOT add fabricated details
- Return ONLY the improved text, no explanations or quotes

Current introduction:
${content}`
      : `You are a professional copywriter for the Help&Grow Expert Network.

Improve these service offerings. Rules:
- Keep the same meaning and number of services
- Make titles clearer and punchier (3-6 words)
- Make descriptions more compelling and concise (one sentence each)
- Do NOT add new services or remove existing ones
- Return ONLY a JSON array of objects with "title" and "description" keys, no markdown code fences

Current services:
${content}`;

  const response = await ai.models.generateContent({
    model: MODEL,
    contents: prompt,
  });

  return (response.text ?? "").trim();
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
