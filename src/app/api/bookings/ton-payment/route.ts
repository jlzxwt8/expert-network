import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { calculateBookingAmount } from "@/lib/stripe";
import type { SessionType } from "@/generated/prisma/client";
import { resolveUserId } from "@/lib/request-auth";
import { findOverlappingBooking } from "@/lib/booking-utils";
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
    const { expertId, sessionType, startTime, endTime, timezone, meetingLink, offlineAddress } =
      body;

    if (!expertId || !sessionType || !startTime || !endTime) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const platformWalletRaw = process.env.PLATFORM_TON_WALLET;
    if (!platformWalletRaw) {
      return NextResponse.json(
        { error: "TON payments not configured" },
        { status: 500 }
      );
    }
    // Sanitize: trim, strip quotes, convert URL-safe base64 to standard, ensure padding
    let walletAddr = platformWalletRaw.trim().replace(/^["']|["']$/g, "");
    walletAddr = walletAddr.replace(/-/g, "+").replace(/_/g, "/");
    while (walletAddr.length % 4 !== 0) walletAddr += "=";
    console.log("[ton-payment] raw env:", JSON.stringify(platformWalletRaw), "cleaned:", walletAddr, "len:", walletAddr.length);

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

    // PENDING holds the slot; user confirms after paying in wallet.
    // Unconfirmed PENDING bookings expire after 30 minutes (cleaned lazily).
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
        status: "PENDING",
        totalAmountCents: totalCents,
        depositAmountCents: depositCents,
        currency: expert.currency,
        paymentMethod: "ton",
        paymentStatus: "pending",
      },
    });

    const comment = `booking:${booking.id}`;

    return NextResponse.json({
      bookingId: booking.id,
      walletAddress: walletAddr,
      amountNanoTON: depositNanoTON.toString(),
      comment,
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
