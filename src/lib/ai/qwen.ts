import OpenAI from "openai";
import { GoogleGenAI } from "@google/genai";
import type {
  AIProvider,
  ProfileInput,
  ProfileOutput,
  ImageInput,
  MatchResult,
} from "./types";
import {
  cleanJsonResponse,
  ensureString,
  buildImagePrompt,
  formatSocialLinks,
} from "./types";

const DASHSCOPE_BASE_URL =
  "https://dashscope-intl.aliyuncs.com/compatible-mode/v1";
const DASHSCOPE_TASK_URL =
  "https://dashscope-intl.aliyuncs.com/api/v1/services/aigc/text2image/image-synthesis";
const DASHSCOPE_TASK_STATUS_URL =
  "https://dashscope-intl.aliyuncs.com/api/v1/tasks";

const QWEN_MODEL = "qwen-max";
const WANX_MODEL = "wanx-v1";
const WANX_POLL_INTERVAL_MS = 2000;
const WANX_TIMEOUT_MS = 60_000;

function createQwenClient(): OpenAI {
  const apiKey = process.env.DASHSCOPE_API_KEY;
  if (!apiKey) {
    console.warn("[Qwen] DASHSCOPE_API_KEY not set");
  }
  return new OpenAI({ apiKey: apiKey || "", baseURL: DASHSCOPE_BASE_URL });
}

function createGeminiSearchClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn(
      "[Qwen] GEMINI_API_KEY not set — Google Search grounding will be unavailable"
    );
    return null;
  }
  return new GoogleGenAI({ apiKey });
}

export class QwenProvider implements AIProvider {
  private qwen: OpenAI;
  private gemini: GoogleGenAI | null;

  constructor() {
    this.qwen = createQwenClient();
    this.gemini = createGeminiSearchClient();
    console.log("[AI] Using Qwen provider (DashScope)");
  }

  // ---------------------------------------------------------------------------
  // Google Search grounding via Gemini (used for social profile research)
  // ---------------------------------------------------------------------------

  private async searchSocialProfiles(data: ProfileInput): Promise<string> {
    if (!this.gemini) {
      return "Google Search grounding unavailable (GEMINI_API_KEY not set). Profile will be generated from the uploaded document only.";
    }

    const socialLinks = formatSocialLinks(data);
    if (!socialLinks) {
      return "No social profile links provided.";
    }

    const prompt = `Search for publicly available information about "${data.nickName}" using the social profile links below. For each link, gather ONLY verifiable facts you find through Google Search:

${socialLinks}

For each platform, report:
- Job title, company, professional headline
- Real work history and achievements
- Follower/subscriber/connection counts (exact numbers only)
- Content themes and recent posts
- Any other publicly visible professional details

IMPORTANT: If Google Search returns NO usable results for a platform, state clearly: "No data found for [platform]". Do NOT fabricate or guess.

Return your findings as a structured text report, organized by platform.`;

    try {
      const response = await this.gemini.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: { tools: [{ googleSearch: {} }] },
      });

      const grounding = response.candidates?.[0]?.groundingMetadata;
      if (grounding?.webSearchQueries) {
        console.log(
          "[Qwen/searchSocialProfiles] Google Search queries:",
          grounding.webSearchQueries
        );
      }

      return response.text ?? "No search results returned.";
    } catch (error) {
      console.error("[Qwen/searchSocialProfiles] Gemini search failed:", error);
      return "Google Search grounding failed. Profile will be generated from the uploaded document only.";
    }
  }

  // ---------------------------------------------------------------------------
  // Profile generation
  // ---------------------------------------------------------------------------

  async generateExpertProfile(data: ProfileInput): Promise<ProfileOutput> {
    const searchResults = await this.searchSocialProfiles(data);

    const resumeSection = data.resumeText
      ? `\n\nUploaded document (resume/CV) — TRUSTED source:\n${data.resumeText.slice(0, 3000)}`
      : "";

    const prompt = `You are creating a professional profile for an expert on the Help&Grow Expert Network — a platform connecting Singapore-based tech professionals with global startup founders.

Expert's name: ${data.nickName}
Professional domains: ${data.domains.join(", ")}

=== RESEARCH RESULTS (from Google Search) ===
${searchResults}
=== END RESEARCH RESULTS ===${resumeSection}

Based on the research results above and the uploaded document (if provided), generate a JSON object with these 4 keys:

1. "bio" (STRING — must be a single markdown-formatted string, NOT an object or array):
Write a concise third-person summary in markdown bullet points:
- **Current Role**: Job title and company (only if verified)
- **Expertise**: 2-3 bullet points on distinct domain areas
- **Track Record**: 1-2 bullet points with verifiable achievements
- **Social Presence**: Only mention platforms where the research found real data.
Keep under 100 words. No fluff.

2. "services" (ARRAY of objects): 3-4 services following MECE principle. Each service covers a distinct, non-overlapping area. Format: {"title": "concise service name (3-5 words)", "description": "one-sentence value proposition for founders"}

3. "videoScript" (STRING): A natural first-person introduction (45-60 seconds spoken). Use ONLY facts from the research or document. Structure: who I am → what I do → how I help founders → book a session CTA.

4. "sourceSummary" (STRING): Which platforms had useful search data and which did not. Example: "Found data from: LinkedIn, Substack. No data: X/Twitter, TikTok."

ABSOLUTE RULES — Truth over polish:
- NEVER fabricate or estimate numbers.
- NEVER invent companies, job titles, or achievements.
- A short, honest profile is ALWAYS better than a detailed but fabricated one.
- "bio" must be a plain string with markdown formatting, never a JSON object or array.

Return ONLY the JSON object, no markdown code fences.`;

    const response = await this.qwen.chat.completions.create({
      model: QWEN_MODEL,
      messages: [{ role: "user", content: prompt }],
    });

    const text = response.choices[0]?.message?.content ?? "";
    const cleaned = cleanJsonResponse(text);

    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      console.error(
        "[Qwen/generateExpertProfile] Failed to parse JSON, raw:",
        text.slice(0, 500)
      );
      throw new Error("AI returned invalid response format. Please try again.");
    }

    if (parsed.sourceSummary) {
      console.log(
        "[Qwen/generateExpertProfile] Source summary:",
        parsed.sourceSummary
      );
    }

    return {
      bio: ensureString(parsed.bio),
      services: Array.isArray(parsed.services) ? parsed.services : [],
      videoScript: ensureString(parsed.videoScript),
      sourceSummary: ensureString(parsed.sourceSummary ?? ""),
    };
  }

  // ---------------------------------------------------------------------------
  // Image generation via DashScope wanx (async task API)
  // ---------------------------------------------------------------------------

  async generateProfileImage(data: ImageInput): Promise<string | null> {
    const apiKey = process.env.DASHSCOPE_API_KEY;
    if (!apiKey) {
      console.error("[Qwen/generateProfileImage] DASHSCOPE_API_KEY not set");
      return null;
    }

    const prompt = buildImagePrompt(data);

    try {
      const taskId = await this.submitWanxTask(apiKey, prompt);
      const imageUrl = await this.pollWanxTask(apiKey, taskId);
      return await this.downloadImageAsDataUrl(imageUrl);
    } catch (error) {
      console.error("[Qwen/generateProfileImage]", error);
      return null;
    }
  }

  private async submitWanxTask(
    apiKey: string,
    prompt: string
  ): Promise<string> {
    const res = await fetch(DASHSCOPE_TASK_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "X-DashScope-Async": "enable",
      },
      body: JSON.stringify({
        model: WANX_MODEL,
        input: { prompt },
        parameters: { size: "1024*1024", n: 1 },
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`wanx submit failed (${res.status}): ${body}`);
    }

    const data = await res.json();
    const taskId = data?.output?.task_id;
    if (!taskId) {
      throw new Error(
        `wanx submit returned no task_id: ${JSON.stringify(data)}`
      );
    }

    console.log(`[Qwen/wanx] Task submitted: ${taskId}`);
    return taskId;
  }

  private async pollWanxTask(
    apiKey: string,
    taskId: string
  ): Promise<string> {
    const deadline = Date.now() + WANX_TIMEOUT_MS;

    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, WANX_POLL_INTERVAL_MS));

      const res = await fetch(`${DASHSCOPE_TASK_STATUS_URL}/${taskId}`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });

      if (!res.ok) {
        const body = await res.text();
        throw new Error(`wanx poll failed (${res.status}): ${body}`);
      }

      const data = await res.json();
      const status = data?.output?.task_status;

      if (status === "SUCCEEDED") {
        const url = data.output.results?.[0]?.url;
        if (!url) throw new Error("wanx SUCCEEDED but no image URL returned");
        console.log(`[Qwen/wanx] Task completed: ${taskId}`);
        return url;
      }

      if (status === "FAILED") {
        throw new Error(
          `wanx task failed: ${JSON.stringify(data.output)}`
        );
      }
    }

    throw new Error(`wanx task timed out after ${WANX_TIMEOUT_MS}ms`);
  }

  private async downloadImageAsDataUrl(url: string): Promise<string> {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to download image: ${res.status}`);

    const arrayBuffer = await res.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");
    const contentType = res.headers.get("content-type") || "image/png";
    return `data:${contentType};base64,${base64}`;
  }

  // ---------------------------------------------------------------------------
  // Improve writing
  // ---------------------------------------------------------------------------

  async improveWriting(
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

    const response = await this.qwen.chat.completions.create({
      model: QWEN_MODEL,
      messages: [{ role: "user", content: prompt }],
    });

    return (response.choices[0]?.message?.content ?? "").trim();
  }

  // ---------------------------------------------------------------------------
  // Match experts
  // ---------------------------------------------------------------------------

  async matchExperts(
    query: string,
    expertSummaries: string,
    conversationHistory: { role: string; content: string }[]
  ): Promise<MatchResult> {
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

    const response = await this.qwen.chat.completions.create({
      model: QWEN_MODEL,
      messages: [{ role: "user", content: prompt }],
    });

    const text = response.choices[0]?.message?.content ?? "";
    const cleaned = cleanJsonResponse(text);
    return JSON.parse(cleaned) as MatchResult;
  }

  // ---------------------------------------------------------------------------
  // PDF extraction — uses Gemini since we already need it for search grounding.
  // Can be migrated to Qwen-VL (qwen-vl-max) in the future.
  // ---------------------------------------------------------------------------

  async extractTextFromPdf(buffer: Buffer): Promise<string> {
    if (!this.gemini) {
      throw new Error(
        "GEMINI_API_KEY is required for PDF extraction in Qwen mode"
      );
    }

    const base64 = buffer.toString("base64");

    const response = await this.gemini.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          role: "user",
          parts: [
            {
              inlineData: {
                mimeType: "application/pdf",
                data: base64,
              },
            },
            {
              text: "Extract all text content from this PDF document. Return ONLY the extracted text, preserving the structure (headings, lists, paragraphs). Do not add any commentary or explanation.",
            },
          ],
        },
      ],
    });

    return response.text ?? "";
  }
}
