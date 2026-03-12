import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createHash } from "crypto";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const expert = await prisma.expert.findUnique({
      where: { id },
      select: { avatarVideoUrl: true, updatedAt: true },
    });

    if (!expert?.avatarVideoUrl) {
      return NextResponse.json(
        { error: "No avatar available" },
        { status: 404 }
      );
    }

    const match = expert.avatarVideoUrl.match(
      /^data:([^;]+);base64,(.+)$/
    );
    if (!match) {
      return NextResponse.json(
        { error: "Invalid avatar data" },
        { status: 500 }
      );
    }

    const [, contentType, base64Data] = match;
    const buffer = Buffer.from(base64Data, "base64");

    const etag = `"${createHash("md5").update(base64Data.slice(0, 200)).digest("hex")}"`;
    if (request.headers.get("if-none-match") === etag) {
      return new NextResponse(null, { status: 304 });
    }

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, no-cache, must-revalidate",
        "Content-Length": String(buffer.length),
        "ETag": etag,
      },
    });
  } catch (error) {
    console.error("[expert avatar GET]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
