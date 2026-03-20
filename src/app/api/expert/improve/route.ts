import { type NextRequest, NextResponse } from "next/server";

import { improveWriting } from "@/lib/ai";
import { resolveUserId } from "@/lib/request-auth";

export async function POST(request: NextRequest) {
  try {
    const userId = await resolveUserId(request);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { type, content } = body;

    if (type !== "intro" && type !== "services") {
      return NextResponse.json(
        { error: "Invalid type. Must be 'intro' or 'services'." },
        { status: 400 }
      );
    }

    if (!content || (typeof content === "string" && !content.trim())) {
      return NextResponse.json(
        { error: "Content is required." },
        { status: 400 }
      );
    }

    const contentStr = typeof content === "string" ? content : JSON.stringify(content);
    const improved = await improveWriting(type, contentStr);

    if (type === "services") {
      const cleaned = improved.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      const jsonMatch = cleaned.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        return NextResponse.json({ improved: JSON.parse(jsonMatch[0]) });
      }
      return NextResponse.json(
        { error: "AI returned invalid format. Please try again." },
        { status: 500 }
      );
    }

    return NextResponse.json({ improved });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[expert/improve POST]", message, error);

    const isRateLimit =
      (error as { status?: number })?.status === 429 ||
      message.includes("RESOURCE_EXHAUSTED") ||
      message.includes("quota");

    return NextResponse.json(
      {
        error: isRateLimit
          ? "AI quota exceeded. Please try again later."
          : `Failed to improve content. Please try again.`,
      },
      { status: isRateLimit ? 429 : 500 }
    );
  }
}
