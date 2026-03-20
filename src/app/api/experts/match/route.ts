import { type NextRequest, NextResponse } from "next/server";

import { matchExperts } from "@/lib/ai";
import { domainStrings } from "@/lib/domains";
import { searchExpertMemories } from "@/lib/integrations/mem9-lifecycle";
import { prisma } from "@/lib/prisma";

function keywordMatch(
  query: string,
  experts: {
    id: string;
    bio: string | null;
    sessionType: string;
    servicesOffered: unknown;
    domains: { domain: string }[];
    user: { nickName: string | null; name: string | null };
  }[]
) {
  const q = query.toLowerCase();
  const scored = experts
    .map((e) => {
      let score = 0;
      const domainStr = domainStrings(e.domains).join(" ").toLowerCase();
      const bio = (e.bio ?? "").toLowerCase();
      const name = (e.user.nickName ?? e.user.name ?? "").toLowerCase();
      const services = JSON.stringify(e.servicesOffered ?? []).toLowerCase();

      if (domainStr.includes(q) || q.split(/\s+/).some((w) => domainStr.includes(w))) score += 3;
      if (bio.includes(q) || q.split(/\s+/).some((w) => w.length > 2 && bio.includes(w))) score += 2;
      if (services.includes(q) || q.split(/\s+/).some((w) => w.length > 2 && services.includes(w))) score += 1;
      if (name.includes(q)) score += 1;

      return { expert: e, score };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  if (scored.length === 0) {
    return {
      recommendations: [],
      noMatchMessage:
        "I couldn't find a perfect match for your query. Try describing your specific challenge — e.g. 'I need help with BD in Southeast Asia' or 'Looking for legal advice on incorporation'.",
    };
  }

  return {
    recommendations: scored.map((r) => ({
      expertId: r.expert.id,
      name: r.expert.user.nickName ?? r.expert.user.name ?? "Expert",
      reason: `Matches your search based on their expertise in ${domainStrings(r.expert.domains).join(", ")}.`,
      sessionTypes: [r.expert.sessionType],
    })),
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    if (typeof body !== "object" || body === null) {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 }
      );
    }

    const query = typeof body.query === "string" ? body.query.trim() : "";
    if (!query) {
      return NextResponse.json(
        { error: "query is required" },
        { status: 400 }
      );
    }

    const history = Array.isArray(body.history)
      ? (body.history as { role: string; content: string }[]).filter(
          (m) =>
            typeof m === "object" &&
            m !== null &&
            typeof m.role === "string" &&
            typeof m.content === "string"
        )
      : [];

    const experts = await prisma.expert.findMany({
      where: { isPublished: true },
      include: {
        domains: true,
        user: {
          select: {
            nickName: true,
            name: true,
          },
        },
      },
    });

    if (experts.length === 0) {
      return NextResponse.json({
        recommendations: [],
        noMatchMessage: "No experts are available at the moment. Please check back later.",
      });
    }

    // Enrich each expert summary with relevant memories (in parallel)
    const memoryResults = await Promise.all(
      experts.map((e) =>
        searchExpertMemories(e.id, query, 3).catch(() => [] as string[])
      )
    );

    const expertSummaries = experts
      .map((e, i) => {
        const base = `ID: ${e.id}\nName: ${e.user.nickName ?? e.user.name ?? "Unknown"}\nDomains: ${domainStrings(e.domains).join(", ")}\nSession types: ${e.sessionType}\nBio: ${e.bio ?? "(none)"}\nServices: ${JSON.stringify(e.servicesOffered ?? [])}`;
        const memories = memoryResults[i];
        if (memories.length > 0) {
          return `${base}\nAgent Memory: ${memories.join("; ")}`;
        }
        return base;
      })
      .join("\n\n---\n\n");

    try {
      const result = await matchExperts(query, expertSummaries, history);
      return NextResponse.json(result);
    } catch (aiError) {
      console.error("[experts/match] AI matching failed, falling back to keyword:", aiError);
      const fallback = keywordMatch(query, experts);
      return NextResponse.json(fallback);
    }
  } catch (error) {
    console.error("[experts/match POST]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
