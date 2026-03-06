import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export const geminiModel = genAI.getGenerativeModel({
  model: "gemini-2.5-pro-preview-05-06",
});

export async function generateExpertProfile(data: {
  linkedIn?: string;
  github?: string;
  twitter?: string;
  substack?: string;
  wechatOA?: string;
  xiaohongshu?: string;
  tiktok?: string;
  domains: string[];
  nickName: string;
}) {
  const socialLinks = [
    data.linkedIn && `LinkedIn: ${data.linkedIn}`,
    data.github && `GitHub: ${data.github}`,
    data.twitter && `X/Twitter: ${data.twitter}`,
    data.substack && `Substack: ${data.substack}`,
    data.wechatOA && `WeChat Official Account: ${data.wechatOA}`,
    data.xiaohongshu && `XiaoHongShu: ${data.xiaohongshu}`,
    data.tiktok && `TikTok: ${data.tiktok}`,
  ]
    .filter(Boolean)
    .join("\n");

  const prompt = `You are creating a professional profile for an expert on the Help&Grow Expert Network — a platform connecting Singapore-based tech professionals with global startup founders.

Expert's name: ${data.nickName}
Professional domains: ${data.domains.join(", ")}
Social profiles:
${socialLinks}

Generate the following as a JSON object:

1. "bio": A deeply personalized 150–200 word third-person professional bio in markdown. Synthesize information from their social profiles into a cohesive narrative highlighting domain expertise, Singapore/SEA market knowledge, and key achievements. Make it compelling for startup founders considering hiring them.

2. "services": An array of 3-5 specific services this expert could offer, each as an object with "title" (string) and "description" (string, 1-2 sentences). Infer these from their domains and social presence.

3. "videoScript": A compelling first-person video introduction script (60-90 seconds when spoken). Structure it as the expert introducing themselves, their professional history, specific services they offer, and a call-to-action for startup founders to book a session. Make it natural and conversational.

Return ONLY the JSON object, no markdown code fences.`;

  const result = await geminiModel.generateContent(prompt);
  const text = result.response.text();

  const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
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

  const result = await geminiModel.generateContent(prompt);
  const text = result.response.text();

  const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
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
