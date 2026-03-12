export interface ProfileInput {
  linkedIn?: string;
  website?: string;
  twitter?: string;
  substack?: string;
  instagram?: string;
  xiaohongshu?: string;
  domains: string[];
  nickName: string;
  resumeText?: string;
}

export interface ServiceItem {
  title: string;
  description: string;
}

export interface ProfileOutput {
  bio: string;
  services: ServiceItem[];
  videoScript: string;
  sourceSummary: string;
}

export interface ImageInput {
  nickName: string;
  domains: string[];
  bio: string;
  gender?: string;
}

export interface MatchResult {
  recommendations: {
    expertId: string;
    name: string;
    reason: string;
    sessionTypes: string[];
  }[];
  noMatchMessage?: string;
}

export interface AIProvider {
  generateExpertProfile(data: ProfileInput): Promise<ProfileOutput>;
  generateProfileImage(data: ImageInput): Promise<string | null>;
  improveWriting(type: "intro" | "services", content: string): Promise<string>;
  matchExperts(
    query: string,
    expertSummaries: string,
    conversationHistory: { role: string; content: string }[]
  ): Promise<MatchResult>;
  extractTextFromPdf(buffer: Buffer): Promise<string>;
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

export function cleanJsonResponse(text: string): string {
  let cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (jsonMatch) cleaned = jsonMatch[0];
  return cleaned;
}

export function ensureString(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(ensureString).join("\n");
  if (typeof value === "object" && value !== null) {
    return Object.entries(value)
      .map(([k, v]) => `**${k}**: ${ensureString(v)}`)
      .join("\n");
  }
  return String(value ?? "");
}

const DOMAIN_VISUALS: Record<string, string> = {
  "Marketing & BD":
    "megaphone waves, handshake silhouette, growth analytics charts, globe with connection arcs",
  Headhunter:
    "magnifying glass over profile cards, talent pipeline, connecting dots",
  Law: "balanced scales, gavel silhouette, document layers with legal seals",
  Funding:
    "rising bar charts, currency symbols, rocket launch trail, investor handshake",
};

export function buildImagePrompt(data: ImageInput): string {
  const bioSnippet = data.bio.slice(0, 200);
  const visualElements = data.domains
    .map((d) => DOMAIN_VISUALS[d] || d.toLowerCase())
    .join("; ");

  const genderDesc = data.gender === "female" ? "female" : data.gender === "male" ? "male" : "";
  const personDesc = [genderDesc, "professional expert"].filter(Boolean).join(" ");
  const nameHint = data.nickName ? ` The character's name is "${data.nickName}" — reflect a culturally appropriate appearance for this name.` : "";

  return `A stylized digital avatar illustration of a ${personDesc}. Modern cartoon style, NOT a real photo. The character has a confident, approachable expression shown from shoulders up. Rich indigo and purple color palette.${nameHint} Background has floating abstract elements: ${visualElements}. Premium, creative, slightly playful professional feel. The character wears modern business-casual attire with subtle details reflecting expertise in ${data.domains.join(" and ")}. Context: ${bioSnippet}. No text or watermarks in the image.`;
}

export function formatSocialLinks(data: ProfileInput): string {
  return [
    data.linkedIn && `LinkedIn: ${data.linkedIn}`,
    data.website && `Official Website: ${data.website}`,
    data.twitter && `X/Twitter: ${data.twitter}`,
    data.substack && `Substack: ${data.substack}`,
    data.instagram && `Instagram: ${data.instagram}`,
    data.xiaohongshu && `XiaoHongShu: ${data.xiaohongshu}`,
  ]
    .filter(Boolean)
    .join("\n");
}
