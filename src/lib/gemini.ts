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

IMPORTANT: Use Google Search to look up each social profile link above. Visit the actual profile pages and gather as much real information as possible including:
- Professional headline, job title, company
- Work history and key achievements
- Number of followers/connections/fans
- Recent posts, articles, or content themes
- Skills and endorsements
- For Instagram/XiaoHongShu: follower count, content focus, engagement level — these indicate marketing/KOL capability

Then generate the following as a JSON object:

1. "bio": A deeply personalized 150–200 word third-person professional bio in markdown. Synthesize REAL information gathered from their social profiles into a cohesive narrative highlighting domain expertise, Singapore/SEA market knowledge, key achievements, and social media influence (mention follower counts if found). Make it compelling for startup founders.

2. "services": An array of 3-5 specific services this expert could offer, each as an object with "title" (string) and "description" (string, 1-2 sentences). Base these on real expertise found in their profiles.

3. "videoScript": A compelling first-person video introduction script (60-90 seconds when spoken). Reference real details from their profiles — actual companies worked at, real achievements, genuine expertise areas. Make it natural and conversational with a call-to-action for startup founders to book a session.

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
