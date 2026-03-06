import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

const MODEL = "gemini-2.5-flash";

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

2. "services" (ARRAY of objects): 3-4 services following MECE (Mutually Exclusive, Collectively Exhaustive) principle. Each service covers a distinct, non-overlapping area. Format: {"title": "concise service name (3-5 words)", "description": "one-sentence value proposition for founders"}

3. "videoScript" (STRING): A natural first-person introduction (45-60 seconds spoken). Use ONLY real facts. Structure: who I am → what I do → how I help founders → book a session CTA.

IMPORTANT: "bio" must be a plain string with markdown formatting, never a JSON object or array.

Return ONLY the JSON object, no markdown code fences.`;

  const response = await ai.models.generateContent({
    model: MODEL,
    contents: prompt,
    config: {
      tools: [{ googleSearch: {} }],
      responseMimeType: "application/json",
    },
  });

  const text = response.text ?? "";
  const cleaned = cleanJsonResponse(text);

  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    console.error("[generateExpertProfile] Failed to parse JSON, raw response:", text.slice(0, 500));
    throw new Error("AI returned invalid response format. Please try again.");
  }

  return {
    bio: ensureString(parsed.bio),
    services: Array.isArray(parsed.services) ? parsed.services : [],
    videoScript: ensureString(parsed.videoScript),
  };
}

const DASHSCOPE_BASE_URL = "https://dashscope-intl.aliyuncs.com/api/v1";

function getDashScopeKey(): string {
  return process.env.DASHSCOPE_API_KEY || "";
}

async function submitQwenImageTask(prompt: string): Promise<string | null> {
  const res = await fetch(
    `${DASHSCOPE_BASE_URL}/services/aigc/text2image/image-synthesis`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${getDashScopeKey()}`,
        "Content-Type": "application/json",
        "X-DashScope-Async": "enable",
      },
      body: JSON.stringify({
        model: "qwen-image-plus",
        input: { prompt },
        parameters: {
          size: "1328*1328",
          n: 1,
          prompt_extend: true,
          watermark: false,
        },
      }),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    console.error("[submitQwenImageTask] Submit failed:", res.status, err);
    return null;
  }

  const body = await res.json();
  return body?.output?.task_id ?? null;
}

async function pollQwenImageResult(
  taskId: string,
  maxWaitMs = 60000
): Promise<string | null> {
  const start = Date.now();
  let interval = 3000;

  while (Date.now() - start < maxWaitMs) {
    await new Promise((r) => setTimeout(r, interval));

    const res = await fetch(`${DASHSCOPE_BASE_URL}/tasks/${taskId}`, {
      headers: { Authorization: `Bearer ${getDashScopeKey()}` },
    });

    if (!res.ok) {
      console.error("[pollQwenImageResult] Poll failed:", res.status);
      return null;
    }

    const body = await res.json();
    const status = body?.output?.task_status;

    if (status === "SUCCEEDED") {
      const imageUrl = body?.output?.results?.[0]?.url;
      return imageUrl ?? null;
    }

    if (status === "FAILED") {
      console.error("[pollQwenImageResult] Task failed:", JSON.stringify(body?.output));
      return null;
    }

    if (interval < 5000) interval += 1000;
  }

  console.error("[pollQwenImageResult] Timed out after", maxWaitMs, "ms");
  return null;
}

async function downloadImageAsBase64(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const buffer = await res.arrayBuffer();
    const base64 = Buffer.from(buffer).toString("base64");
    const contentType = res.headers.get("content-type") || "image/png";
    return `data:${contentType};base64,${base64}`;
  } catch {
    return null;
  }
}

export async function generateProfileImage(data: {
  nickName: string;
  domains: string[];
  bio: string;
}): Promise<string | null> {
  if (!getDashScopeKey()) {
    console.error("[generateProfileImage] DASHSCOPE_API_KEY not set");
    return null;
  }

  const bioSnippet = data.bio.slice(0, 200);

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

  const prompt = `A stylized digital avatar illustration of a professional expert. Modern cartoon style, NOT a real photo. The character has a confident, approachable expression shown from shoulders up. Rich indigo and purple color palette. Background has floating abstract elements: ${visualElements}. Premium, creative, slightly playful professional feel. The character wears modern business-casual attire with subtle details reflecting expertise in ${data.domains.join(" and ")}. Context: ${bioSnippet}. No text or watermarks in the image.`;

  try {
    const taskId = await submitQwenImageTask(prompt);
    if (!taskId) return null;

    const imageUrl = await pollQwenImageResult(taskId);
    if (!imageUrl) return null;

    return await downloadImageAsBase64(imageUrl);
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
