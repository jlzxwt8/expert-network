import { type NextRequest, NextResponse } from "next/server";

import { matchExperts } from "@/lib/ai";
import { domainStrings } from "@/lib/domains";
import { searchExpertMemories } from "@/lib/integrations/mem9-lifecycle";
import { prisma } from "@/lib/prisma";
import { resolveUserId } from "@/lib/request-auth";

export async function POST(request: NextRequest) {
  try {
    const userId = await resolveUserId(request);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    if (!user || !["NGO", "BOOTCAMP", "ADMIN"].includes(user.role)) {
      return NextResponse.json(
        { error: "Forbidden: Only NGOs or Bootcamp students can access mentor matchmaking." },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const query = typeof body.query === "string" ? body.query.trim() : "";
    if (!query) {
      return NextResponse.json({ error: "query is required" }, { status: 400 });
    }

    const experts = await prisma.expert.findMany({
      where: { isPublished: true },
      include: {
        domains: true,
        user: {
          select: { nickName: true, name: true },
        },
      },
    });

    if (experts.length === 0) {
      return NextResponse.json({
        recommendations: [],
        noMatchMessage: "No mentors are available at the moment. Please check back later.",
      });
    }

    const memoryResults = await Promise.all(
      experts.map((e) => searchExpertMemories(e.id, query, 3).catch(() => []))
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
      const result = await matchExperts(query, expertSummaries, []);
      return NextResponse.json(result);
    } catch (aiError) {
      console.error("[matchmaking] AI matching failed:", aiError);
      return NextResponse.json({
        recommendations: [],
        noMatchMessage: "AI Match failed. Please refine your query or contact an administrator.",
      });
    }
  } catch (error) {
    console.error("[matchmaking POST]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
