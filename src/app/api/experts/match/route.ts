import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { matchExperts } from "@/lib/gemini";

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
        user: {
          select: {
            nickName: true,
            name: true,
          },
        },
      },
    });

    const expertSummaries = experts
      .map(
        (e) =>
          `ID: ${e.id}\nName: ${e.user.nickName ?? e.user.name ?? "Unknown"}\nDomains: ${e.domains.join(", ")}\nSession types: ${e.sessionType}\nBio: ${e.bio ?? "(none)"}\nServices: ${JSON.stringify(e.servicesOffered ?? [])}`
      )
      .join("\n\n---\n\n");

    const result = await matchExperts(query, expertSummaries, history);

    return NextResponse.json(result);
  } catch (error) {
    console.error("[experts/match POST]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
