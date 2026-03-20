import { type NextRequest, NextResponse } from "next/server";

import { searchExpertMemories } from "@/lib/integrations/mem9-lifecycle";

/**
 * GET /api/experts/[id]/memories?q=...&limit=...
 *
 * Public endpoint: search an expert's cloud memory.
 * Returns relevant memories for display on the profile or
 * for AI enrichment in the match flow.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q") ?? "";
    const limit = Math.min(
      20,
      Math.max(1, parseInt(searchParams.get("limit") ?? "5", 10) || 5)
    );

    if (!query) {
      return NextResponse.json(
        { error: "q query parameter is required" },
        { status: 400 }
      );
    }

    const memories = await searchExpertMemories(id, query, limit);

    return NextResponse.json({ memories, total: memories.length });
  } catch (error) {
    console.error("[experts/[id]/memories GET]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
