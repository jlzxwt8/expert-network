import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { SessionType } from "@/generated/prisma/client";

const SESSION_TYPES: SessionType[] = ["ONLINE", "OFFLINE", "BOTH"];

function parseSessionType(value: unknown): SessionType | null {
  return typeof value === "string" && SESSION_TYPES.includes(value as SessionType)
    ? (value as SessionType)
    : null;
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    if (typeof body !== "object" || body === null) {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 }
      );
    }

    const expertId = typeof body.expertId === "string" ? body.expertId.trim() : null;
    const sessionType = parseSessionType(body.sessionType);
    const startTime = body.startTime;
    const endTime = body.endTime;
    const timezone =
      typeof body.timezone === "string" ? body.timezone : "Asia/Singapore";

    if (!expertId) {
      return NextResponse.json(
        { error: "expertId is required" },
        { status: 400 }
      );
    }
    if (!sessionType) {
      return NextResponse.json(
        { error: "sessionType is required (ONLINE, OFFLINE, or BOTH)" },
        { status: 400 }
      );
    }

    const start = startTime ? new Date(startTime) : null;
    const end = endTime ? new Date(endTime) : null;

    if (!start || isNaN(start.getTime())) {
      return NextResponse.json(
        { error: "Valid startTime is required" },
        { status: 400 }
      );
    }
    if (!end || isNaN(end.getTime())) {
      return NextResponse.json(
        { error: "Valid endTime is required" },
        { status: 400 }
      );
    }
    if (end <= start) {
      return NextResponse.json(
        { error: "endTime must be after startTime" },
        { status: 400 }
      );
    }

    const expert = await prisma.expert.findUnique({
      where: { id: expertId, isPublished: true },
    });
    if (!expert) {
      return NextResponse.json(
        { error: "Expert not found" },
        { status: 404 }
      );
    }

    const booking = await prisma.booking.create({
      data: {
        expertId,
        founderId: session.user.id,
        sessionType,
        startTime: start,
        endTime: end,
        timezone,
        status: "CONFIRMED",
      },
      include: {
        expert: { include: { user: true } },
        founder: true,
      },
    });

    return NextResponse.json(booking);
  } catch (error) {
    console.error("[bookings POST]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const role = searchParams.get("role"); // "founder" | "expert" | omit for both

    const isExpert = await prisma.expert.findUnique({
      where: { userId: session.user.id },
    });

    const where =
      role === "expert" && isExpert
        ? { expertId: isExpert.id }
        : role === "founder"
          ? { founderId: session.user.id }
          : isExpert
            ? {
                OR: [
                  { founderId: session.user.id },
                  { expertId: isExpert.id },
                ],
              }
            : { founderId: session.user.id };

    const bookings = await prisma.booking.findMany({
      where,
      orderBy: { startTime: "desc" },
      include: {
        expert: { include: { user: true } },
        founder: true,
      },
    });

    return NextResponse.json({ bookings });
  } catch (error) {
    console.error("[bookings GET]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
