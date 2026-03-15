import { View, Text, Input, ScrollView } from "@tarojs/components";
import Taro, {
  useLoad,
  usePullDownRefresh,
  useReachBottom,
} from "@tarojs/taro";
import { useState, useCallback, useRef } from "react";
import { get, post } from "../../shared/api";
import ExpertCard from "../../components/ExpertCard";
import type {
  Expert,
  ExpertsResponse,
  MatchRecommendation,
  MatchResponse,
} from "../../shared/types";
import { DOMAINS } from "../../shared/types";
import "./index.scss";

type SessionFilter = "all" | "ONLINE" | "OFFLINE";
type SortOption = "reviews" | "newest";
type TabType = "browse" | "match";

interface ChatMessage {
  role: "user" | "assistant";
  content?: string;
  recommendations?: MatchRecommendation[];
  noMatchMessage?: string;
}

export default function DiscoverPage() {
  const [tab, setTab] = useState<TabType>("browse");
  const [experts, setExperts] = useState<Expert[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [selectedDomains, setSelectedDomains] = useState<string[]>([]);
  const [sessionFilter, setSessionFilter] = useState<SessionFilter>("all");
  const [sortBy, setSortBy] = useState<SortOption>("reviews");

  // AI Match state
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatLoading, setChatLoading] = useState(false);

  const expertsRef = useRef<Expert[]>([]);
  expertsRef.current = experts;
  const take = 20;

  const fetchExperts = useCallback(
    async (append = false) => {
      if (append) setLoadingMore(true);
      else setLoading(true);

      try {
        const params: Record<string, string | number | undefined> = {
          sort: sortBy,
          skip: append ? expertsRef.current.length : 0,
          take,
        };
        if (selectedDomains.length) params.domain = selectedDomains.join(",");
        if (sessionFilter !== "all") params.sessionType = sessionFilter;

        const res = await get<ExpertsResponse>("/api/experts", params);
        if (res.statusCode === 200 && res.data.experts) {
          if (append) {
            setExperts((prev) => [...prev, ...res.data.experts]);
          } else {
            setExperts(res.data.experts);
          }
          setTotal(res.data.total);
        }
      } catch {
        if (!append) setExperts([]);
      } finally {
        setLoading(false);
        setLoadingMore(false);
        Taro.stopPullDownRefresh();
      }
    },
    [selectedDomains, sessionFilter, sortBy]
  );

  useLoad(() => {
    fetchExperts();
  });

  usePullDownRefresh(() => {
    fetchExperts();
  });

  useReachBottom(() => {
    if (tab === "browse" && !loadingMore && experts.length < total) {
      fetchExperts(true);
    }
  });

  const filterKey = `${selectedDomains.join(",")}|${sessionFilter}|${sortBy}`;
  const filterKeyRef = useRef(filterKey);

  if (filterKeyRef.current !== filterKey) {
    filterKeyRef.current = filterKey;
    fetchExperts();
  }

  const toggleDomain = (domain: string) => {
    setSelectedDomains((prev) =>
      prev.includes(domain)
        ? prev.filter((d) => d !== domain)
        : [...prev, domain]
    );
  };

  const changeSessionFilter = (f: SessionFilter) => {
    setSessionFilter(f);
  };

  const changeSort = (s: SortOption) => {
    setSortBy(s);
  };

  const sendMatchQuery = async () => {
    const q = chatInput.trim();
    if (!q || chatLoading) return;

    setChatInput("");
    setChatMessages((prev) => [...prev, { role: "user", content: q }]);
    setChatLoading(true);

    const history = chatMessages
      .filter(
        (m) => m.role === "user" || (m.role === "assistant" && m.content)
      )
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
      const res = await post<MatchResponse>("/api/experts/match", {
        query: q,
        history,
      });
      if (res.statusCode === 200) {
        setChatMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            recommendations: res.data.recommendations,
            noMatchMessage: res.data.noMatchMessage,
          },
        ]);
      } else {
        throw new Error("Match failed");
      }
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

  const goToExpert = (expertId: string) => {
    Taro.navigateTo({ url: `/pages/expert/index?id=${expertId}` });
  };

  const goToBook = (expertId: string) => {
    Taro.navigateTo({ url: `/pages/book/index?id=${expertId}&from=match` });
  };

  return (
    <View className="discover">
      {/* Domain filters */}
      <ScrollView scrollX className="discover__domains" enableFlex>
        {DOMAINS.map((d) => (
          <View
            key={d}
            className={`discover__domain-chip ${
              selectedDomains.includes(d)
                ? "discover__domain-chip--active"
                : ""
            }`}
            onClick={() => toggleDomain(d)}
          >
            {d}
          </View>
        ))}
      </ScrollView>

      {/* Session type + Sort */}
      <View className="discover__filters">
        <View className="discover__session-toggle">
          {(["all", "ONLINE", "OFFLINE"] as const).map((st) => (
            <View
              key={st}
              className={`discover__session-btn ${
                sessionFilter === st ? "discover__session-btn--active" : ""
              }`}
              onClick={() => changeSessionFilter(st)}
            >
              {st === "all" ? "All" : st === "ONLINE" ? "Online" : "Offline"}
            </View>
          ))}
        </View>
        <View className="discover__sort" onClick={() => changeSort(sortBy === "reviews" ? "newest" : "reviews")}>
          {sortBy === "reviews" ? "Most Reviews ↓" : "Newest ↓"}
        </View>
      </View>

      {/* Tabs */}
      <View className="discover__tabs">
        <View
          className={`discover__tab ${tab === "browse" ? "discover__tab--active" : ""}`}
          onClick={() => setTab("browse")}
        >
          🔍 Browse
        </View>
        <View
          className={`discover__tab ${tab === "match" ? "discover__tab--active" : ""}`}
          onClick={() => setTab("match")}
        >
          ✨ AI Match
        </View>
      </View>

      {/* Browse tab */}
      {tab === "browse" && (
        <View className="discover__list">
          {loading ? (
            <View className="discover__loading">
              {[1, 2, 3].map((i) => (
                <View key={i} className="discover__skeleton">
                  <View className="discover__skeleton-avatar" />
                  <View className="discover__skeleton-lines">
                    <View className="discover__skeleton-line discover__skeleton-line--w60" />
                    <View className="discover__skeleton-line discover__skeleton-line--w80" />
                    <View className="discover__skeleton-line discover__skeleton-line--w40" />
                  </View>
                </View>
              ))}
            </View>
          ) : experts.length === 0 ? (
            <View className="discover__empty">
              <Text>No experts found. Try adjusting your filters.</Text>
            </View>
          ) : (
            <>
              {experts.map((expert) => (
                <ExpertCard key={expert.id} expert={expert} />
              ))}
              {loadingMore && (
                <View className="discover__loading-more">Loading...</View>
              )}
            </>
          )}
        </View>
      )}

      {/* AI Match tab */}
      {tab === "match" && (
        <View className="discover__match">
          <View className="discover__chat">
            {chatMessages.length === 0 && (
              <View className="discover__chat-empty">
                <Text className="discover__chat-empty-icon">✨</Text>
                <Text className="discover__chat-empty-text">
                  Describe your challenge and we'll match you with the right
                  experts.
                </Text>
                <Text className="discover__chat-empty-hint">
                  e.g. "I need help with AI product strategy in SEA"
                </Text>
              </View>
            )}
            {chatMessages.map((m, i) => (
              <View
                key={i}
                className={`discover__chat-msg ${
                  m.role === "user"
                    ? "discover__chat-msg--user"
                    : "discover__chat-msg--assistant"
                }`}
              >
                {m.role === "user" && m.content && (
                  <View className="discover__chat-bubble discover__chat-bubble--user">
                    {m.content}
                  </View>
                )}
                {m.role === "assistant" && (
                  <View className="discover__chat-results">
                    {m.recommendations && m.recommendations.length > 0
                      ? m.recommendations.map((rec) => (
                          <View key={rec.expertId} className="discover__rec-card">
                            <View className="discover__rec-avatar">
                              {rec.name
                                .split(" ")
                                .map((n) => n[0])
                                .join("")
                                .toUpperCase()
                                .slice(0, 2)}
                            </View>
                            <View className="discover__rec-info">
                              <Text className="discover__rec-name">
                                {rec.name}
                              </Text>
                              <Text className="discover__rec-reason">
                                {rec.reason}
                              </Text>
                              <View className="discover__rec-actions">
                                <View
                                  className="discover__rec-btn discover__rec-btn--primary"
                                  onClick={() => goToBook(rec.expertId)}
                                >
                                  Book
                                </View>
                                <View
                                  className="discover__rec-btn discover__rec-btn--outline"
                                  onClick={() => goToExpert(rec.expertId)}
                                >
                                  View
                                </View>
                              </View>
                            </View>
                          </View>
                        ))
                      : m.noMatchMessage && (
                          <View className="discover__chat-bubble discover__chat-bubble--system">
                            {m.noMatchMessage}
                          </View>
                        )}
                  </View>
                )}
              </View>
            ))}
            {chatLoading && (
              <View className="discover__chat-loading">Finding experts...</View>
            )}
          </View>

          {/* Input area */}
          <View className="discover__input-bar">
            <Input
              className="discover__input"
              placeholder="Describe your challenge..."
              value={chatInput}
              onInput={(e) => setChatInput(e.detail.value)}
              confirmType="send"
              onConfirm={sendMatchQuery}
              disabled={chatLoading}
            />
            <View
              className={`discover__send-btn ${
                !chatInput.trim() || chatLoading
                  ? "discover__send-btn--disabled"
                  : ""
              }`}
              onClick={sendMatchQuery}
            >
              {chatLoading ? "..." : "→"}
            </View>
          </View>
        </View>
      )}
    </View>
  );
}
