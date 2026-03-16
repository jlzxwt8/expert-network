import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveUserId } from "@/lib/request-auth";
import { findOverlappingBooking } from "@/lib/booking-utils";
import { notifyExpertBooking, notifyFounderBooking } from "@/lib/telegram-bot";
import type { SessionType } from "@/generated/prisma/client";

export async function POST(request: NextRequest) {
  try {
    const userId = await resolveUserId(request);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { expertId, sessionType, startTime, endTime, timezone, meetingLink, offlineAddress } = body;

    if (!expertId || !sessionType || !startTime || !endTime) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const start = new Date(startTime);
    const end = new Date(endTime);
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) {
      return NextResponse.json({ error: "Invalid time range" }, { status: 400 });
    }

    const expert = await prisma.expert.findUnique({
      where: { id: expertId, isPublished: true },
      include: { user: true },
    });
    if (!expert) {
      return NextResponse.json({ error: "Expert not found" }, { status: 404 });
    }

    const pricePerHour =
      sessionType === "OFFLINE" ? expert.priceOfflineCents : expert.priceOnlineCents;

    if (pricePerHour !== 0) {
      return NextResponse.json(
        { error: "This endpoint is only for free sessions (price = 0)" },
        { status: 400 }
      );
    }

    const overlap = await findOverlappingBooking(expertId, start, end);
    if (overlap) {
      return NextResponse.json(
        { error: "This time slot is already booked. Please choose a different time." },
        { status: 409 }
      );
    }

    const founder = await prisma.user.findUnique({ where: { id: userId } });

    const booking = await prisma.booking.create({
      data: {
        expertId,
        founderId: userId,
        sessionType: sessionType as SessionType,
        startTime: start,
        endTime: end,
        timezone: timezone || "Asia/Singapore",
        meetingLink: meetingLink || null,
        offlineAddress: offlineAddress || null,
        status: "CONFIRMED",
        totalAmountCents: 0,
        depositAmountCents: 0,
        currency: expert.currency,
        paymentMethod: "free",
        paymentStatus: "fully_paid",
      },
      include: {
        expert: { include: { user: true } },
        founder: true,
      },
    });

    const expertName = expert.user.nickName ?? expert.user.name ?? "Expert";
    const founderName = founder?.nickName ?? founder?.name ?? "Client";

    notifyExpertBooking({
      expertTelegramId: expert.user.telegramId,
      expertTelegramUsername: expert.user.telegramUsername,
      founderName,
      sessionType,
      startTime: start,
      depositAmount: "Free",
      timezone: timezone || "Asia/Singapore",
    }).catch(() => {});

    notifyFounderBooking({
      founderTelegramId: founder?.telegramId,
      founderTelegramUsername: founder?.telegramUsername,
      expertName,
      sessionType,
      startTime: start,
      depositAmount: "Free",
      timezone: timezone || "Asia/Singapore",
    }).catch(() => {});

    return NextResponse.json({ bookingId: booking.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[bookings/free POST]", message, error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
