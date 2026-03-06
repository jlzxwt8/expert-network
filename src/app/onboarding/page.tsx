"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Loader2,
  Send,
  SkipForward,
  Check,
  Sparkles,
  Upload,
  FileText,
} from "lucide-react";

import {
  DOMAINS,
  SOCIAL_PLATFORMS,
  ONBOARDING_STEPS,
} from "@/lib/constants";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Step =
  | "GREETING"
  | "NICKNAME"
  | "SOCIAL_LINKS"
  | "DOMAINS"
  | "DOCUMENT_UPLOAD"
  | "SESSION_PREFS"
  | "AI_GENERATION"
  | "PREVIEW";

type Message = {
  id: string;
  role: "ai" | "user";
  content: string;
  type?: "text" | "input" | "chips" | "options";
};

type SocialLinks = Partial<
  Record<(typeof SOCIAL_PLATFORMS)[number]["key"], string>
>;

type GeneratedProfile = {
  bio: string;
  services: { title: string; description: string }[];
  videoScript: string;
  profileImage: string | null;
};

const SESSION_OPTIONS = [
  { value: "ONLINE", label: "Online Only", desc: "Video calls & remote sessions" },
  { value: "OFFLINE", label: "Offline Only", desc: "In-person meetings" },
  { value: "BOTH", label: "Both Online & Offline", desc: "Flexible availability" },
] as const;

const AI_PROCESSING_MESSAGES = [
  "Searching your social profiles with AI...",
  "Analysing your professional footprint...",
  "Generating your expert profile...",
];

function getProgressValue(step: Step): number {
  switch (step) {
    case "GREETING":
    case "NICKNAME":
      return 10;
    case "SOCIAL_LINKS":
    case "DOMAINS":
    case "DOCUMENT_UPLOAD":
    case "SESSION_PREFS":
      return 25;
    case "AI_GENERATION":
      return 50;
    case "PREVIEW":
      return 75;
    default:
      return 0;
  }
}

export default function OnboardingPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatAreaRef = useRef<HTMLDivElement>(null);

  const [messages, setMessages] = useState<Message[]>([]);
  const [currentStep, setCurrentStep] = useState<Step>("GREETING");
  const [isTyping, setIsTyping] = useState(false);
  const [socialLinks, setSocialLinks] = useState<SocialLinks>({});
  const [selectedDomains, setSelectedDomains] = useState<string[]>([]);
  const [sessionType, setSessionType] = useState<string>("");
  const [generatedProfile, setGeneratedProfile] =
    useState<GeneratedProfile | null>(null);
  const [currentSocialIndex, setCurrentSocialIndex] = useState(0);
  const [inputValue, setInputValue] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editedBio, setEditedBio] = useState("");
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [userNickName, setUserNickName] = useState("");

  // Track which step-questions have already been added to avoid duplicates
  const addedQuestionsRef = useRef<Set<string>>(new Set());

  const nickName =
    userNickName ||
    ((session?.user as { nickName?: string })?.nickName ??
    session?.user?.name ??
    "");

  const addStepMessage = useCallback(
    (stepKey: string, msg: Message, delayMs = 800) => {
      if (addedQuestionsRef.current.has(stepKey)) return;
      addedQuestionsRef.current.add(stepKey);

      const run = async () => {
        setIsTyping(true);
        await new Promise((r) => setTimeout(r, delayMs));
        setIsTyping(false);
        setMessages((prev) => [...prev, msg]);
      };
      run();
    },
    []
  );

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/signin?role=expert");
      return;
    }
    if (status === "authenticated") {
      const userRole = (session?.user as { role?: string })?.role;
      if (userRole !== "EXPERT") {
        fetch("/api/user", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role: "EXPERT" }),
        }).catch(console.error);
      }
    }
  }, [status, session, router]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  // Greeting
  useEffect(() => {
    if (status !== "authenticated" || messages.length > 0) return;

    const addGreeting = async () => {
      addedQuestionsRef.current.add("greeting");
      setIsTyping(true);
      await new Promise((r) => setTimeout(r, 800));
      setIsTyping(false);
      setMessages([
        {
          id: "greeting",
          role: "ai",
          content:
            "Hey! Welcome to Help&Grow Expert Network. Let's set up your professional profile. It'll take just 2 minutes.",
          type: "text",
        },
      ]);

      await new Promise((r) => setTimeout(r, 800));
      setMessages((prev) => [
        ...prev,
        {
          id: "ask-nickname",
          role: "ai",
          content: "First, what should we call you? (Your display name)",
          type: "input",
        },
      ]);
      setCurrentStep("NICKNAME");
    };

    addGreeting();
  }, [status, messages.length]);

  // Social link questions
  useEffect(() => {
    if (currentStep !== "SOCIAL_LINKS" || currentSocialIndex >= SOCIAL_PLATFORMS.length)
      return;

    const platform = SOCIAL_PLATFORMS[currentSocialIndex];
    const questionKey = `social-${platform.key}`;

    const isOptional = !platform.required;
    const skipHint = isOptional ? " (paste link or press Skip)" : "";

    const question =
      currentSocialIndex === 0
        ? `Now let's add your social profiles. What's your ${platform.label} profile URL?${platform.required ? " (required)" : skipHint}`
        : `What's your ${platform.label}?${skipHint}`;

    addStepMessage(questionKey, {
      id: questionKey,
      role: "ai",
      content: question,
      type: "input",
    });
  }, [currentStep, currentSocialIndex, addStepMessage]);

  // Domains question
  useEffect(() => {
    if (currentStep !== "DOMAINS") return;
    addStepMessage("domains", {
      id: "domains",
      role: "ai",
      content:
        "Great! Now, what areas do you specialize in? Select all that apply.",
      type: "chips",
    });
  }, [currentStep, addStepMessage]);

  // Document upload question (now between links and session prefs)
  useEffect(() => {
    if (currentStep !== "DOCUMENT_UPLOAD") return;
    addStepMessage("upload-question", {
      id: "upload-question",
      role: "ai",
      content:
        "Would you like to upload a document (PDF, DOCX) to help me better understand your services? This could be a resume, portfolio, or service description. You can also skip this step.",
      type: "text",
    });
  }, [currentStep, addStepMessage]);

  // Session prefs question
  useEffect(() => {
    if (currentStep !== "SESSION_PREFS") return;
    addStepMessage("session", {
      id: "session",
      role: "ai",
      content: "How would you like to meet with startup founders?",
      type: "options",
    });
  }, [currentStep, addStepMessage]);

  const saveOnboarding = async (data: Record<string, unknown>) => {
    const res = await fetch("/api/onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error("Failed to save");
    return res.json();
  };

  const handleNicknameSubmit = async (value: string) => {
    if (!value.trim()) return;
    const name = value.trim();
    setUserNickName(name);

    setMessages((prev) => [
      ...prev,
      { id: "user-nickname", role: "user", content: name },
    ]);
    setInputValue("");

    try {
      await fetch("/api/user", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickName: name }),
      });
    } catch {
      // Silently fail
    }

    setCurrentStep("SOCIAL_LINKS");
    setCurrentSocialIndex(0);
  };

  const handleSocialSubmit = async (value: string, skip = false) => {
    if (!skip && !value.trim()) return;

    const platform = SOCIAL_PLATFORMS[currentSocialIndex];
    const displayValue = skip ? "(Skipped)" : value.trim();

    setMessages((prev) => [
      ...prev,
      {
        id: `user-social-${platform.key}`,
        role: "user",
        content: displayValue,
      },
    ]);
    setInputValue("");

    const newLinks = { ...socialLinks };
    if (!skip) newLinks[platform.key as keyof SocialLinks] = value.trim();
    setSocialLinks(newLinks);

    try {
      await saveOnboarding({ [platform.key]: skip ? "" : value.trim() });
    } catch {
      // Silently fail
    }

    if (currentSocialIndex < SOCIAL_PLATFORMS.length - 1) {
      setCurrentSocialIndex((i) => i + 1);
    } else {
      setCurrentStep("DOMAINS");
    }
  };

  const handleDomainsContinue = async () => {
    if (selectedDomains.length === 0) return;

    setMessages((prev) => [
      ...prev,
      {
        id: "user-domains",
        role: "user",
        content: selectedDomains.join(", "),
      },
    ]);

    try {
      await saveOnboarding({ domains: selectedDomains });
    } catch {
      // Silently fail
    }

    setCurrentStep("DOCUMENT_UPLOAD");
  };

  const handleFileUpload = async (file: File) => {
    setIsUploading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/onboarding/upload", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Upload failed");
      }
      setUploadedFileName(file.name);
      setMessages((prev) => [
        ...prev,
        { id: `user-upload-${Date.now()}`, role: "user", content: `Uploaded: ${file.name}` },
      ]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Upload failed";
      setMessages((prev) => [
        ...prev,
        { id: `upload-error-${Date.now()}`, role: "ai", content: `Upload error: ${msg}. You can try again or skip.`, type: "text" },
      ]);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDocumentContinue = async () => {
    if (uploadedFileName) {
      setMessages((prev) => [
        ...prev,
        {
          id: "upload-ack",
          role: "ai",
          content: `Great, I'll use "${uploadedFileName}" to enrich your profile.`,
          type: "text",
        },
      ]);
      await new Promise((r) => setTimeout(r, 600));
    }

    setCurrentStep("SESSION_PREFS");
  };

  const handleSessionSelect = async (value: string) => {
    setSessionType(value);

    setMessages((prev) => [
      ...prev,
      {
        id: "user-session",
        role: "user",
        content:
          SESSION_OPTIONS.find((o) => o.value === value)?.label ?? value,
      },
    ]);

    try {
      await saveOnboarding({ sessionType: value });
    } catch {
      // Silently fail
    }

    startAIGeneration();
  };

  const startAIGeneration = async () => {
    setCurrentStep("AI_GENERATION");
    setIsTyping(true);

    for (let i = 0; i < AI_PROCESSING_MESSAGES.length; i++) {
      setMessages((prev) => [
        ...prev,
        {
          id: `ai-processing-${i}`,
          role: "ai",
          content: AI_PROCESSING_MESSAGES[i],
          type: "text",
        },
      ]);
      await new Promise((r) => setTimeout(r, 1200));
    }

    setIsTyping(false);

    try {
      const res = await fetch("/api/onboarding/generate", { method: "POST" });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        console.error("Generate API error:", errBody);
        throw new Error(errBody.detail || "Generate failed");
      }
      const data = await res.json();
      setGeneratedProfile({
        bio: data.bio,
        services: data.services ?? [],
        videoScript: data.videoScript ?? "",
        profileImage: data.profileImage ?? null,
      });
      setCurrentStep("PREVIEW");
    } catch (err) {
      console.error("AI generation error:", err);
      setMessages((prev) => [
        ...prev,
        {
          id: `ai-error-${Date.now()}`,
          role: "ai",
          content: "Something went wrong generating your profile. Please try again.",
          type: "text",
        },
      ]);
      setCurrentStep("SESSION_PREFS");
    }
  };

  const handleBioSave = async () => {
    if (!generatedProfile) return;
    setGeneratedProfile((p) =>
      p ? { ...p, videoScript: editedBio } : null
    );
    try {
      await saveOnboarding({ bio: editedBio });
    } catch {
      // Silently fail
    }
  };

  const handlePublish = async () => {
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/onboarding/publish", { method: "POST" });
      if (!res.ok) throw new Error("Publish failed");
      router.push("/dashboard");
    } catch {
      setIsSubmitting(false);
    }
  };

  if (status === "loading") {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (status === "unauthenticated") {
    return null;
  }

  const platform = SOCIAL_PLATFORMS[currentSocialIndex];
  const progressValue = getProgressValue(currentStep);

  // PREVIEW: Full-screen profile card
  if (currentStep === "PREVIEW" && generatedProfile) {
    return (
      <div className="flex min-h-dvh flex-col bg-slate-50">
        <div className="sticky top-0 z-10 border-b bg-white/95 px-4 py-3 backdrop-blur">
          <h1 className="text-center text-lg font-semibold">Profile Preview</h1>
        </div>
        <div className="flex-1 overflow-y-auto p-4 pb-8">
          <Card className="mx-auto max-w-lg overflow-hidden shadow-lg">
            <CardHeader className="space-y-3">
              <CardTitle className="text-xl">{nickName}</CardTitle>
              <div className="flex flex-wrap gap-1.5">
                {selectedDomains.map((d) => (
                  <Badge key={d} variant="secondary" className="text-xs">
                    {d}
                  </Badge>
                ))}
              </div>

              {generatedProfile.profileImage ? (
                <div className="relative w-full aspect-square rounded-xl overflow-hidden bg-slate-100">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={generatedProfile.profileImage}
                    alt={`${nickName}'s digital avatar`}
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <div className="w-full aspect-square rounded-xl bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center">
                  <Sparkles className="h-16 w-16 text-indigo-300" />
                </div>
              )}
            </CardHeader>

            <CardContent className="space-y-4">
              {generatedProfile.videoScript && (
                <div>
                  <h3 className="mb-2 font-semibold">Introduction Script</h3>
                  {editedBio ? (
                    <div className="space-y-2">
                      <Textarea
                        value={editedBio}
                        onChange={(e) => setEditedBio(e.target.value)}
                        rows={6}
                        className="min-h-[120px]"
                      />
                      <Button
                        onClick={() => {
                          handleBioSave();
                          setEditedBio("");
                        }}
                        size="lg"
                        className="min-h-[44px] w-full"
                      >
                        <Check className="mr-2 h-4 w-4" />
                        Save
                      </Button>
                    </div>
                  ) : (
                    <div
                      onClick={() => setEditedBio(generatedProfile.videoScript)}
                      className="rounded-lg border bg-muted/30 p-4 text-sm leading-relaxed whitespace-pre-wrap cursor-pointer hover:border-indigo-300 transition-colors"
                    >
                      {generatedProfile.videoScript}
                      <span className="mt-2 block text-xs text-muted-foreground">
                        Tap to edit
                      </span>
                    </div>
                  )}
                </div>
              )}

              <div>
                <h3 className="mb-2 font-semibold">Services Offered</h3>
                <ul className="space-y-2">
                  {generatedProfile.services.map((s, i) => (
                    <li key={i} className="rounded-lg border p-3">
                      <p className="font-medium">{s.title}</p>
                      <p className="text-sm text-muted-foreground">
                        {s.description}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>

              <Button
                onClick={handlePublish}
                disabled={isSubmitting}
                size="lg"
                className="min-h-[48px] w-full bg-indigo-600 hover:bg-indigo-700"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Publishing...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Publish to Network
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Chat interface
  return (
    <div className="flex flex-col h-dvh max-w-lg mx-auto bg-slate-50">
      {/* Progress bar */}
      <div className="shrink-0 border-b bg-white px-4 py-3">
        <div className="mb-2 flex items-center justify-between gap-1 text-xs font-medium">
          {ONBOARDING_STEPS.map((step, i) => (
            <span
              key={step.key}
              className={cn(
                "transition-colors",
                progressValue >= (i + 1) * 25
                  ? "text-indigo-600"
                  : "text-muted-foreground"
              )}
            >
              {step.label}
            </span>
          ))}
        </div>
        <Progress value={progressValue} className="h-2" />
      </div>

      {/* Chat messages */}
      <div
        ref={chatAreaRef}
        className="flex-1 overflow-y-auto px-4 py-6 no-scrollbar"
      >
        <div className="space-y-4">
          <AnimatePresence mode="popLayout">
            {messages.map((msg) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className={cn(
                  "flex",
                  msg.role === "user" ? "justify-end" : "justify-start"
                )}
              >
                <div
                  className={cn(
                    "max-w-[85%] rounded-2xl px-4 py-3 text-[15px] leading-relaxed",
                    msg.role === "ai"
                      ? "rounded-bl-md bg-slate-200 text-slate-900 chat-bubble-animate"
                      : "rounded-br-md bg-indigo-600 text-white chat-bubble-animate"
                  )}
                >
                  {msg.content}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {isTyping && (
            <div className="flex justify-start">
              <div className="rounded-2xl rounded-bl-md bg-slate-200 px-4 py-3">
                <span className="typing-dots text-slate-600">typing</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input area */}
      <div className="shrink-0 border-t bg-white px-4 py-4 mobile-safe-bottom">
        {currentStep === "NICKNAME" && (
          <div className="flex gap-2">
            <Input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Your name or nickname"
              className="min-h-[44px] flex-1"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleNicknameSubmit(inputValue);
              }}
            />
            <Button
              onClick={() => handleNicknameSubmit(inputValue)}
              disabled={!inputValue.trim()}
              size="icon"
              className="min-h-[44px] min-w-[44px] shrink-0"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        )}

        {currentStep === "SOCIAL_LINKS" && platform && (
          <div className="space-y-2">
            <div className="flex gap-2">
              <Input
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder={platform.placeholder}
                className="min-h-[44px] flex-1"
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSocialSubmit(inputValue);
                }}
              />
              <Button
                onClick={() => handleSocialSubmit(inputValue)}
                disabled={!inputValue.trim() && platform.required}
                size="icon"
                className="min-h-[44px] min-w-[44px] shrink-0"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
            {!platform.required && (
              <Button
                variant="outline"
                onClick={() => handleSocialSubmit("", true)}
                className="min-h-[44px] w-full text-muted-foreground"
              >
                <SkipForward className="mr-2 h-4 w-4" />
                Skip {platform.label}
              </Button>
            )}
          </div>
        )}

        {currentStep === "DOMAINS" && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {DOMAINS.map((domain) => (
                <Badge
                  key={domain}
                  variant={selectedDomains.includes(domain) ? "default" : "outline"}
                  className={cn(
                    "cursor-pointer px-4 py-2 text-sm transition min-h-[44px] flex items-center",
                    selectedDomains.includes(domain)
                      ? "bg-indigo-600 text-white hover:bg-indigo-700"
                      : "hover:bg-slate-100"
                  )}
                  onClick={() => {
                    setSelectedDomains((prev) =>
                      prev.includes(domain)
                        ? prev.filter((d) => d !== domain)
                        : [...prev, domain]
                    );
                  }}
                >
                  {domain}
                </Badge>
              ))}
            </div>
            <Button
              onClick={handleDomainsContinue}
              disabled={selectedDomains.length === 0}
              className="min-h-[48px] w-full"
            >
              Continue
            </Button>
          </div>
        )}

        {currentStep === "DOCUMENT_UPLOAD" && (
          <div className="space-y-3">
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.docx,.txt,.md"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileUpload(file);
              }}
            />
            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              variant="outline"
              className="min-h-[48px] w-full"
            >
              {isUploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Uploading...
                </>
              ) : uploadedFileName ? (
                <>
                  <FileText className="mr-2 h-4 w-4" />
                  {uploadedFileName}
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Upload Document (PDF, DOCX)
                </>
              )}
            </Button>
            <Button
              onClick={handleDocumentContinue}
              disabled={isUploading}
              className="min-h-[48px] w-full bg-indigo-600 hover:bg-indigo-700"
            >
              {uploadedFileName ? "Continue with Document" : "Skip & Continue"}
            </Button>
          </div>
        )}

        {currentStep === "SESSION_PREFS" && (
          <div className="space-y-3">
            {SESSION_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => handleSessionSelect(opt.value)}
                className={cn(
                  "w-full rounded-xl border-2 p-4 text-left transition min-h-[56px] flex flex-col items-start",
                  sessionType === opt.value
                    ? "border-indigo-600 bg-indigo-50"
                    : "border-slate-200 bg-white hover:border-slate-300"
                )}
              >
                <span className="font-semibold">{opt.label}</span>
                <span className="text-sm text-muted-foreground">
                  {opt.desc}
                </span>
              </button>
            ))}
          </div>
        )}

        {currentStep === "AI_GENERATION" && (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
          </div>
        )}
      </div>
    </div>
  );
}
