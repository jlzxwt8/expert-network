export const DOMAINS = [
  "AI Tech",
  "Fintech",
  "Local Marketing",
  "Compliance",
  "Business Expansion",
  "Legal/Regulatory",
] as const;

export type Domain = (typeof DOMAINS)[number];

export const SESSION_TYPES = ["ONLINE", "OFFLINE", "BOTH"] as const;

export const ONBOARDING_STEPS = [
  { key: "profile", label: "Profile" },
  { key: "services", label: "Services" },
  { key: "review", label: "Review" },
  { key: "publish", label: "Publish" },
] as const;

export const SOCIAL_PLATFORMS = [
  { key: "linkedIn", label: "LinkedIn", placeholder: "https://linkedin.com/in/yourprofile", required: true },
  { key: "github", label: "GitHub", placeholder: "https://github.com/yourusername", required: false },
  { key: "twitter", label: "X (Twitter)", placeholder: "https://x.com/yourhandle", required: false },
  { key: "substack", label: "Substack", placeholder: "https://yourname.substack.com", required: false },
  { key: "wechatOA", label: "WeChat Official Account", placeholder: "Your WeChat OA name", required: false },
  { key: "xiaohongshu", label: "XiaoHongShu", placeholder: "Your XiaoHongShu profile link", required: false },
  { key: "tiktok", label: "TikTok", placeholder: "https://tiktok.com/@yourhandle", required: false },
] as const;
