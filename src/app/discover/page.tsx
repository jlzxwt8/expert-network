"use client";

import { memo, Suspense, startTransition, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { useTelegram } from "@/components/telegram-provider";
import Link from "next/link";
import {
  Star,
  Shield,
  Search,
  Sparkles,
  Send,
  Loader2,
  ArrowLeft,
} from "lucide-react";
import { UserMenu } from "@/components/user-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { VoiceInputButton } from "@/components/voice-input-button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DOMAINS } from "@/lib/constants";

type SessionFilter = "all" | "ONLINE" | "OFFLINE";
type SortOption = "reviews" | "newest";

interface ExpertUser {
  id: string;
  name: string | null;
  nickName: string | null;
  image: string | null;
  email: string | null;
}

interface Expert {
  id: string;
  domains: string[];
  sessionType: string;
  bio: string | null;
  isVerified: boolean;
  avgRating: number;
  reviewCount: number;
  priceOnlineCents: number | null;
  priceOfflineCents: number | null;
  currency: string;
  user: ExpertUser;
}

interface ExpertsResponse {
  experts: Expert[];
  total: number;
  skip: number;
  take: number;
}

interface MatchRecommendation {
  expertId: string;
  name: string;
  reason: string;
  sessionTypes: string[];
}

interface MatchResponse {
  recommendations: MatchRecommendation[];
  noMatchMessage?: string;
}

function ExpertCardSkeleton() {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4">
        <div className="flex gap-4">
          <div className="h-14 w-14 shrink-0 rounded-full bg-muted animate-pulse" />
          <div className="flex-1 space-y-2">
            <div className="h-5 w-32 rounded bg-muted animate-pulse" />
            <div className="flex gap-1">
              <div className="h-5 w-16 rounded bg-muted animate-pulse" />
              <div className="h-5 w-16 rounded bg-muted animate-pulse" />
            </div>
            <div className="h-4 w-24 rounded bg-muted animate-pulse" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

const ExpertCard = memo(function ExpertCard({ expert }: { expert: Expert }) {
  const name = expert.user.nickName ?? expert.user.name ?? "Expert";
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <Card className="overflow-hidden transition-shadow hover:shadow-md">
      <CardContent className="p-4">
        <div className="flex gap-4 items-start">
          <div
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-lg font-semibold text-white"
            aria-hidden
          >
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <h3 className="font-semibold text-foreground truncate">{name}</h3>
                {expert.isVerified && (
                  <Badge
                    variant="secondary"
                    className="shrink-0 gap-1 bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                  >
                    <Shield className="h-3 w-3" />
                    Verified
                  </Badge>
                )}
              </div>
              {(expert.priceOnlineCents || expert.priceOfflineCents) && (
                <span className="shrink-0 text-sm font-medium text-emerald-700 dark:text-emerald-400">
                  SGD {((Math.min(expert.priceOnlineCents || Infinity, expert.priceOfflineCents || Infinity)) / 100).toFixed(0)}/hr
                </span>
              )}
            </div>
            <div className="mt-1 flex flex-wrap gap-1">
              {expert.domains.map((d) => (
                <Badge key={d} variant="outline" className="text-xs">
                  {d}
                </Badge>
              ))}
            </div>
            <div className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground">
              <div className="flex">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Star
                    key={i}
                    className={`h-4 w-4 ${
                      i <= Math.round(expert.avgRating)
                        ? "fill-amber-400 text-amber-400"
                        : "text-muted-foreground/40"
                    }`}
                  />
                ))}
              </div>
              <span>
                {expert.reviewCount} review{expert.reviewCount !== 1 ? "s" : ""}
              </span>
            </div>
          </div>
        </div>
        <div className="mt-3 flex gap-2">
          <Button asChild size="sm" className="flex-1">
            <Link href={`/experts/${expert.id}/book?from=browse`}>Book Session</Link>
          </Button>
          <Button asChild variant="outline" size="sm" className="flex-1">
            <Link href={`/experts/${expert.id}`}>View Profile</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
});

const MatchRecommendationCard = memo(function MatchRecommendationCard({ rec }: { rec: MatchRecommendation }) {
  const initials = rec.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <Card className="overflow-hidden border-indigo-200 dark:border-indigo-800">
      <CardContent className="p-4">
        <div className="flex gap-4">
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-sm font-semibold text-white"
            aria-hidden
          >
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="font-semibold text-foreground">{rec.name}</h4>
            <p className="mt-1 text-sm text-muted-foreground">{rec.reason}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button asChild size="sm">
                <Link href={`/experts/${rec.expertId}/book?from=match`}>Book Session</Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link href={`/experts/${rec.expertId}`}>View Profile</Link>
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
});

export default function DiscoverPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>}>
      <DiscoverContent />
    </Suspense>
  );
}

function DiscoverContent() {
  const { status: sessionStatus } = useSession();
  const { isTelegram, ready: tgReady } = useTelegram();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [experts, setExperts] = useState<Expert[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<
    { role: "user" | "assistant"; content?: string; recommendations?: MatchRecommendation[]; noMatchMessage?: string }[]
  >([]);
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const expertsRef = useRef<Expert[]>([]);
  expertsRef.current = experts;

  useEffect(() => {
    if (tgReady && !isTelegram && sessionStatus === "unauthenticated") {
      router.push("/auth/signin?callbackUrl=/discover");
    }
  }, [sessionStatus, isTelegram, tgReady, router]);

  const domainsParam = searchParams.get("domains") ?? "";
  const domains = useMemo(
    () => (domainsParam ? domainsParam.split(",").filter(Boolean) : []),
    [domainsParam]
  );
  const sessionType = (searchParams.get("sessionType") || "all") as
    | SessionFilter
    | string;
  const sort = (searchParams.get("sort") || "reviews") as SortOption;
  const take = 20;

  const updateParams = useCallback(
    (updates: Record<string, string | null>) => {
      const next = new URLSearchParams(searchParams.toString());
      for (const [k, v] of Object.entries(updates)) {
        if (v === null || v === "") next.delete(k);
        else next.set(k, v);
      }
      next.delete("skip");
      startTransition(() => {
        router.push(`/discover?${next.toString()}`, { scroll: false });
      });
    },
    [router, searchParams]
  );

  const toggleDomain = (domain: string) => {
    const next = domains.includes(domain)
      ? domains.filter((d) => d !== domain)
      : [...domains, domain];
    updateParams({ domains: next.length ? next.join(",") : null });
  };

  const setSessionType = (st: SessionFilter) => {
    updateParams({
      sessionType: st === "all" ? null : st,
    });
  };

  const setSort = (s: SortOption) => {
    updateParams({ sort: s });
  };

  const fetchExperts = useCallback(
    async (append = false) => {
      if (append) setLoadingMore(true);
      else setLoading(true);

      const params = new URLSearchParams();
      if (domains.length) params.set("domain", domains.join(","));
      if (sessionType !== "all" && sessionType) params.set("sessionType", sessionType);
      params.set("sort", sort);
      params.set("skip", String(append ? expertsRef.current.length : 0));
      params.set("take", String(take));

      try {
        const headers: Record<string, string> = {};
        if (isTelegram) headers["x-telegram-mini-app"] = "true";
        const res = await fetch(`/api/experts?${params.toString()}`, { headers });
        if (!res.ok) throw new Error("Failed to fetch");
        const data: ExpertsResponse = await res.json();
        if (append) {
          setExperts((prev) => [...prev, ...data.experts]);
        } else {
          setExperts(data.experts);
        }
        setTotal(data.total);
      } catch {
        setExperts([]);
        setTotal(0);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [domains, sessionType, sort, isTelegram]
  );

  const filterKey = `${domains.join(",")}|${sessionType}|${sort}`;
  useEffect(() => {
    fetchExperts();
  }, [filterKey, fetchExperts]);

  const loadMore = () => {
    fetchExperts(true);
  };

  const sendMatchQuery = async () => {
    const q = chatInput.trim();
    if (!q || chatLoading) return;

    setChatInput("");
    setChatMessages((prev) => [...prev, { role: "user", content: q }]);
    setChatLoading(true);

    const history = chatMessages
      .filter((m) => m.role === "user" || (m.role === "assistant" && m.content))
      .map((m) => ({
        role: m.role,
        content:
          m.role === "user"
            ? m.content!
            : m.recommendations
              ? `Recommended: ${m.recommendations.map((r) => r.name).join(", ")}`
              : m.noMatchMessage ?? "",
      }));

    try {
      const res = await fetch("/api/experts/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q, history }),
      });
      if (!res.ok) throw new Error("Match failed");
      const data: MatchResponse = await res.json();

      setChatMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          recommendations: data.recommendations,
          noMatchMessage: data.noMatchMessage,
        },
      ]);
    } catch {
      setChatMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          noMatchMessage: "Sorry, something went wrong. Please try again.",
        },
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages, chatLoading]);

  const hasMore = experts.length < total;

  return (
    <div className="min-h-screen w-full max-w-lg mx-auto flex flex-col pb-24">
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
        <div className="px-4 pt-4 pb-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <Link
                href="/"
                className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-1"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Home
              </Link>
              <h1 className="text-xl font-bold text-foreground">
                Discover Experts
              </h1>
            </div>
            <UserMenu />
          </div>

          {/* Domain chips */}
          <div className="overflow-x-auto no-scrollbar -mx-4 px-4">
            <div className="flex gap-2 pb-2">
              {DOMAINS.map((d) => (
                <Badge
                  key={d}
                  variant={domains.includes(d) ? "default" : "outline"}
                  className="cursor-pointer shrink-0 transition-colors"
                  onClick={() => toggleDomain(d)}
                >
                  {d}
                </Badge>
              ))}
            </div>
          </div>

          {/* Session type + Sort */}
          <div className="flex items-center gap-3 mt-3">
            <div className="flex rounded-lg border bg-muted p-0.5">
              {(["all", "ONLINE", "OFFLINE"] as const).map((st) => (
                <button
                  key={st}
                  onClick={() => setSessionType(st)}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                    sessionType === st
                      ? "bg-background text-foreground shadow"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {st === "all" ? "All" : st === "ONLINE" ? "Online" : "Offline"}
                </button>
              ))}
            </div>
            <Select value={sort} onValueChange={(v) => setSort(v as SortOption)}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="reviews">Most Reviews</SelectItem>
                <SelectItem value="newest">Newest</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <Tabs defaultValue="browse" className="flex-1 px-4">
        <TabsList className="grid w-full grid-cols-2 mt-4">
          <TabsTrigger value="browse" className="gap-2">
            <Search className="h-4 w-4" />
            Browse
          </TabsTrigger>
          <TabsTrigger value="match" className="gap-2">
            <Sparkles className="h-4 w-4" />
            AI Match
          </TabsTrigger>
        </TabsList>

        <TabsContent value="browse" className="mt-4">
          {loading ? (
            <div className="space-y-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <ExpertCardSkeleton key={i} />
              ))}
            </div>
          ) : experts.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              No experts found. Try adjusting your filters.
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-4">
                {experts.map((expert) => (
                  <ExpertCard key={expert.id} expert={expert} />
                ))}
              </div>
              {hasMore && (
                <div className="mt-6 flex justify-center">
                  <Button
                    variant="outline"
                    onClick={loadMore}
                    disabled={loadingMore}
                  >
                    {loadingMore ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Loading...
                      </>
                    ) : (
                      "Load more"
                    )}
                  </Button>
                </div>
              )}
            </>
          )}
        </TabsContent>

        <TabsContent value="match" className="mt-4">
          <div className="flex flex-col h-[calc(100vh-320px)] min-h-[400px]">
            <div className="flex-1 overflow-y-auto space-y-4 pr-2">
              {chatMessages.length === 0 && (
                <div className="py-8 text-center text-muted-foreground text-sm">
                  <Sparkles className="h-10 w-10 mx-auto mb-3 text-indigo-500" />
                  <p>Describe your challenge and we&apos;ll match you with the right experts.</p>
                  <p className="mt-1">e.g. &quot;I need help with AI product strategy in SEA&quot;</p>
                </div>
              )}
              {chatMessages.map((m, i) => (
                <div
                  key={i}
                  className={`chat-bubble-animate ${
                    m.role === "user"
                      ? "ml-4 mr-0 text-right"
                      : "mr-4 ml-0 text-left"
                  }`}
                  style={{ animationDelay: `${i * 50}ms` }}
                >
                  {m.role === "user" && m.content && (
                    <div className="inline-block rounded-2xl bg-primary px-4 py-2 text-primary-foreground text-sm">
                      {m.content}
                    </div>
                  )}
                  {m.role === "assistant" && (
                    <div className="space-y-3">
                      {m.recommendations && m.recommendations.length > 0 ? (
                        m.recommendations.map((rec) => (
                          <MatchRecommendationCard key={rec.expertId} rec={rec} />
                        ))
                      ) : m.noMatchMessage ? (
                        <div className="rounded-2xl bg-muted px-4 py-3 text-sm text-muted-foreground">
                          {m.noMatchMessage}
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>
              ))}
              {chatLoading && (
                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                  <span className="typing-dots">Finding experts</span>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            <div className="sticky bottom-0 pt-4 pb-2 bg-background">
              <div className="flex gap-2">
                <Input
                  placeholder="Describe your challenge..."
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      sendMatchQuery();
                    }
                  }}
                  disabled={chatLoading}
                  className="flex-1"
                />
                <VoiceInputButton
                  onTranscript={(text) => setChatInput((prev) => prev ? `${prev} ${text}` : text)}
                />
                <Button
                  size="icon"
                  onClick={sendMatchQuery}
                  disabled={!chatInput.trim() || chatLoading}
                >
                  {chatLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
