import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: expertId } = await params;
    if (!expertId) {
      return NextResponse.json(
        { error: "Expert ID is required" },
        { status: 400 }
      );
    }

    const now = new Date();

    const slots = await prisma.availableSlot.findMany({
      where: {
        expertId,
        isBooked: false,
        endTime: { gt: now },
      },
      orderBy: { startTime: "asc" },
    });

    return NextResponse.json({ slots });
  } catch (error) {
    console.error("[experts/[id]/slots GET]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: expertId } = await params;
    if (!expertId) {
      return NextResponse.json(
        { error: "Expert ID is required" },
        { status: 400 }
      );
    }

    const expert = await prisma.expert.findUnique({
      where: { id: expertId },
    });

    if (!expert) {
      return NextResponse.json(
        { error: "Expert not found" },
        { status: 404 }
      );
    }
    if (expert.userId !== session.user.id) {
      return NextResponse.json(
        { error: "Forbidden: you can only manage your own slots" },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const slotsInput = Array.isArray(body.slots) ? body.slots : [];

    if (slotsInput.length === 0) {
      return NextResponse.json(
        { error: "slots array is required and must not be empty" },
        { status: 400 }
      );
    }

    const now = new Date();
    const validSlots: { startTime: Date; endTime: Date }[] = [];

    for (const slot of slotsInput) {
      if (
        typeof slot !== "object" ||
        slot === null ||
        typeof slot.startTime !== "string" ||
        typeof slot.endTime !== "string"
      ) {
        continue;
      }
      const start = new Date(slot.startTime);
      const end = new Date(slot.endTime);
      if (
        !isNaN(start.getTime()) &&
        !isNaN(end.getTime()) &&
        end > start &&
        start >= now
      ) {
        validSlots.push({ startTime: start, endTime: end });
      }
    }

    if (validSlots.length === 0) {
      return NextResponse.json(
        { error: "No valid slots provided. Each slot needs startTime and endTime (ISO strings), with endTime > startTime and in the future." },
        { status: 400 }
      );
    }

    const slots = await prisma.availableSlot.createManyAndReturn({
      data: validSlots.map((s) => ({
        expertId,
        startTime: s.startTime,
        endTime: s.endTime,
      })),
    });

    return NextResponse.json({ created: slots.length, slots });
  } catch (error) {
    console.error("[experts/[id]/slots POST]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
