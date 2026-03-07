import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const expert = await prisma.expert.findUnique({
      where: { userId: session.user.id },
      include: { user: { select: { id: true, name: true, nickName: true, email: true, image: true } } },
    });

    if (!expert) {
      return NextResponse.json({ error: "Expert profile not found" }, { status: 404 });
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { avatarVideoUrl: _av, documentData: _dd, ...rest } = expert;
    return NextResponse.json({ ...rest, hasAvatar: !!expert.avatarVideoUrl });
  } catch (error) {
    console.error("[expert/profile GET]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const expert = await prisma.expert.findUnique({
      where: { userId: session.user.id },
    });

    if (!expert) {
      return NextResponse.json({ error: "Expert profile not found" }, { status: 404 });
    }

    const body = await request.json();
    const updateData: Record<string, unknown> = {};

    if (Array.isArray(body.domains)) {
      updateData.domains = body.domains;
    }
    if (typeof body.bio === "string") {
      updateData.bio = body.bio;
    }
    if (typeof body.avatarScript === "string") {
      updateData.avatarScript = body.avatarScript;
    }
    if (Array.isArray(body.servicesOffered)) {
      updateData.servicesOffered = body.servicesOffered;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    const updated = await prisma.expert.update({
      where: { id: expert.id },
      data: updateData,
      include: { user: { select: { id: true, name: true, nickName: true, email: true, image: true } } },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("[expert/profile PATCH]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
