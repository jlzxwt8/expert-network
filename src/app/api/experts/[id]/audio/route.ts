import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const expert = await prisma.expert.findUnique({
      where: { id },
      select: { audioIntroUrl: true },
    });

    if (!expert?.audioIntroUrl) {
      return NextResponse.json({ error: "No audio intro" }, { status: 404 });
    }

    const match = expert.audioIntroUrl.match(
      /^data:(audio\/\w+);base64,(.+)$/
    );
    if (!match) {
      return NextResponse.json({ error: "Invalid audio data" }, { status: 500 });
    }

    const [, mime, b64] = match;
    const buffer = Buffer.from(b64, "base64");

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": mime,
        "Content-Length": String(buffer.length),
        "Cache-Control": "public, max-age=86400, s-maxage=86400, stale-while-revalidate=3600",
      },
    });
  } catch (error) {
    console.error("[experts/[id]/audio GET]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
