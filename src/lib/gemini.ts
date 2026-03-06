import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

const MODEL = "gemini-2.5-flash";

function cleanJsonResponse(text: string): string {
  return text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
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

  const prompt = `You are creating a professional profile for an expert on the Help&Grow Expert Network — a platform connecting Singapore-based tech professionals with global startup founders.

Expert's name: ${data.nickName}
Professional domains: ${data.domains.join(", ")}
Social profiles:
${socialLinks}

STEP 1 — Research: Use Google Search to look up each social profile link above. Gather ONLY verifiable facts:
- Job title, company, professional headline
- Real work history and achievements
- Follower/subscriber/connection counts (exact numbers only if found)
- Content themes and recent posts
- For Instagram/TikTok/XiaoHongShu: follower count, content focus — these indicate KOL/marketing capability

CRITICAL RULES:
- NEVER fabricate or estimate numbers (followers, connections, subscribers, etc.). If you cannot find the exact number, DO NOT mention it at all.
- NEVER invent companies, job titles, achievements, or any facts not found in your search results.
- If search returns limited information, write a shorter bio based ONLY on what you found. A short truthful bio is far better than a long fabricated one.
- Use ONLY verified information from your search results.

STEP 2 — Generate the following as a JSON object:

1. "bio": A concise third-person professional summary using MECE (Mutually Exclusive, Collectively Exhaustive) bullet points in markdown. Structure:
   - **Current Role**: One line with job title and company (if found)
   - **Expertise**: 2-3 bullet points covering distinct domain areas
   - **Track Record**: 1-2 bullet points with verifiable achievements only
   - **Social Presence**: 1 bullet point with real follower/subscriber counts (only if found via search)
   Keep it under 100 words total. No fluff, no adjectives like "visionary" or "renowned".

2. "services": An array of 3-4 specific services, each as {"title": string, "description": string (1 sentence)}. Based on real expertise found.

3. "videoScript": A natural first-person introduction script (45-60 seconds spoken). Use ONLY real facts found. Structure: who I am → what I do → how I can help founders → book a session CTA.

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
  return JSON.parse(cleaned) as {
    bio: string;
    services: { title: string; description: string }[];
    videoScript: string;
  };
}

export async function generateProfileImage(data: {
  nickName: string;
  domains: string[];
  bio: string;
}): Promise<string | null> {
  const prompt = `Create a professional, modern profile illustration for a tech expert. This is NOT a photo — it's a stylized digital illustration / avatar.

Expert context:
- Name: ${data.nickName}
- Domains: ${data.domains.join(", ")}
- Summary: ${data.bio.slice(0, 200)}

Requirements:
- Clean, modern flat illustration style with a friendly, approachable look
- Professional setting with subtle tech/business visual elements related to their domains
- Use a cohesive color palette with indigo/blue tones
- The illustration should feel premium and suitable for a professional networking platform
- Include abstract visual elements representing their expertise domains (e.g., AI circuits, charts, globe for business expansion)
- Do NOT include any text or letters in the image`;

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
3. "reason": A highly specific 2-3 sentence explanation of why this expert's background perfectly matches the founder's need. Draw specific connections between the founder's challenge and the expert's experience.
4. "sessionTypes": Available session types

If no expert in the pool matches the query well, respond with an empty "recommendations" array and include a "noMatchMessage" explaining what type of expert would be ideal.

Return ONLY a JSON object with a "recommendations" array and optionally a "noMatchMessage" string. No markdown code fences.`;

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
