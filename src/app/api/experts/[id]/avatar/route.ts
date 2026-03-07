import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const expert = await prisma.expert.findUnique({
      where: { id },
      select: { avatarVideoUrl: true },
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

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=300, s-maxage=300",
        "Content-Length": String(buffer.length),
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
