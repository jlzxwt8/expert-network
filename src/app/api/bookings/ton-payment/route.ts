import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { calculateBookingAmount } from "@/lib/stripe";
import type { SessionType } from "@/generated/prisma/client";
import { resolveUserId } from "@/lib/request-auth";
import { findOverlappingBooking } from "@/lib/booking-utils";
import { storeBookingEvent } from "@/lib/integrations/mem9-lifecycle";
import { notifyExpertBooking, notifyFounderBooking } from "@/lib/telegram-bot";

const TON_RATE_API = "https://tonapi.io/v2/rates?tokens=ton&currencies=sgd";

async function getSGDToTONRate(): Promise<number> {
  try {
    const res = await fetch(TON_RATE_API, { next: { revalidate: 300 } });
    const data = await res.json();
    const sgdRate = data?.rates?.TON?.prices?.SGD;
    if (sgdRate && sgdRate > 0) return sgdRate;
  } catch (e) {
    console.error("[ton-payment] Rate fetch failed:", e);
  }
  return 3.5; // fallback rate
}

export async function POST(request: NextRequest) {
  try {
    const userId = await resolveUserId(request);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { expertId, sessionType, startTime, endTime, timezone, meetingLink } =
      body;

    if (!expertId || !sessionType || !startTime || !endTime) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const platformWallet = process.env.PLATFORM_TON_WALLET;
    if (!platformWallet) {
      return NextResponse.json(
        { error: "TON payments not configured" },
        { status: 500 }
      );
    }

    const start = new Date(startTime);
    const end = new Date(endTime);

    const expert = await prisma.expert.findUnique({
      where: { id: expertId, isPublished: true },
      include: { user: true },
    });

    if (!expert) {
      return NextResponse.json({ error: "Expert not found" }, { status: 404 });
    }

    const overlap = await findOverlappingBooking(expertId, start, end);
    if (overlap) {
      return NextResponse.json(
        { error: "This time slot is already booked. Please choose a different time." },
        { status: 409 }
      );
    }

    const pricePerHour =
      sessionType === "OFFLINE"
        ? expert.priceOfflineCents
        : expert.priceOnlineCents;

    if (!pricePerHour || pricePerHour <= 0) {
      return NextResponse.json(
        { error: "Expert has not set pricing" },
        { status: 400 }
      );
    }

    const { totalCents, depositCents } = calculateBookingAmount(
      pricePerHour,
      start,
      end
    );

    const tonRate = await getSGDToTONRate();
    const depositSGD = depositCents / 100;
    const depositTON = depositSGD / tonRate;
    const depositNanoTON = Math.ceil(depositTON * 1e9);

    const booking = await prisma.booking.create({
      data: {
        expertId,
        founderId: userId,
        sessionType: sessionType as SessionType,
        startTime: start,
        endTime: end,
        timezone: timezone || "Asia/Singapore",
        meetingLink: meetingLink || null,
        status: "CONFIRMED",
        totalAmountCents: totalCents,
        depositAmountCents: depositCents,
        currency: expert.currency,
        paymentMethod: "ton",
        paymentStatus: "deposit_paid",
      },
      include: {
        expert: { include: { user: true } },
        founder: true,
      },
    });

    const comment = `booking:${booking.id}`;
    const tonLink = `https://app.tonkeeper.com/transfer/${platformWallet}?amount=${depositNanoTON}&text=${encodeURIComponent(comment)}`;

    const depositLabel = `${booking.currency} ${(depositCents / 100).toFixed(2)}`;

    storeBookingEvent({
      expertId: booking.expertId,
      founderName: booking.founder.nickName ?? booking.founder.name ?? "Client",
      sessionType: booking.sessionType,
      startTime: booking.startTime,
      status: booking.status,
    }).catch(() => {});

    notifyExpertBooking({
      expertTelegramUsername: booking.expert.user.telegramUsername,
      founderName: booking.founder.nickName ?? booking.founder.name ?? "Client",
      sessionType: booking.sessionType,
      startTime: booking.startTime,
      depositAmount: depositLabel,
    }).catch(() => {});

    notifyFounderBooking({
      founderTelegramUsername: booking.founder.telegramUsername,
      expertName: booking.expert.user.nickName ?? booking.expert.user.name ?? "Expert",
      sessionType: booking.sessionType,
      startTime: booking.startTime,
      depositAmount: depositLabel,
    }).catch(() => {});

    return NextResponse.json({
      bookingId: booking.id,
      tonLink,
      depositTON: depositTON.toFixed(4),
      depositSGD: depositSGD.toFixed(2),
      tonRate: tonRate.toFixed(2),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[bookings/ton-payment POST]", message, error);
    return NextResponse.json(
      { error: "Failed to create TON payment", detail: message },
      { status: 500 }
    );
  }
}
