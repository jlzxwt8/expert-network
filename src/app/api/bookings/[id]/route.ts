import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { BookingStatus } from "@/generated/prisma/client";

const VALID_STATUSES: BookingStatus[] = [
  "PENDING",
  "CONFIRMED",
  "COMPLETED",
  "CANCELLED",
];

function parseStatus(value: unknown): BookingStatus | null {
  return typeof value === "string" && VALID_STATUSES.includes(value as BookingStatus)
    ? (value as BookingStatus)
    : null;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    if (!id) {
      return NextResponse.json(
        { error: "Booking ID is required" },
        { status: 400 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const status = parseStatus(
      typeof body === "object" && body !== null ? body.status : undefined
    );

    if (!status) {
      return NextResponse.json(
        { error: "Valid status is required (PENDING, CONFIRMED, COMPLETED, CANCELLED)" },
        { status: 400 }
      );
    }

    const booking = await prisma.booking.findUnique({
      where: { id },
      include: { expert: true },
    });

    if (!booking) {
      return NextResponse.json(
        { error: "Booking not found" },
        { status: 404 }
      );
    }

    const isFounder = booking.founderId === session.user.id;
    const isExpert = booking.expert.userId === session.user.id;

    if (!isFounder && !isExpert) {
      return NextResponse.json(
        { error: "Forbidden: you can only update your own bookings" },
        { status: 403 }
      );
    }

    const updated = await prisma.booking.update({
      where: { id },
      data: { status },
      include: {
        expert: { include: { user: true } },
        founder: true,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("[bookings/[id] PATCH]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
