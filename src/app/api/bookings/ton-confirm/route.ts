import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveUserId } from "@/lib/request-auth";
import { storeBookingEvent } from "@/lib/integrations/mem9-lifecycle";
import { notifyExpertBooking, notifyFounderBooking } from "@/lib/telegram-bot";

/**
 * POST /api/bookings/ton-confirm
 * Called after the user completes a TON payment in their wallet.
 * Marks the pending booking as CONFIRMED.
 */
export async function POST(request: NextRequest) {
  try {
    const userId = await resolveUserId(request);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { bookingId } = await request.json();
    if (!bookingId) {
      return NextResponse.json({ error: "Missing bookingId" }, { status: 400 });
    }

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        expert: { include: { user: true } },
        founder: true,
      },
    });

    if (!booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    if (booking.founderId !== userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    if (booking.status !== "PENDING") {
      return NextResponse.json({
        status: "already_confirmed",
        bookingId: booking.id,
      });
    }

    const updated = await prisma.booking.update({
      where: { id: bookingId },
      data: {
        status: "CONFIRMED",
        paymentStatus: "deposit_paid",
      },
      include: {
        expert: { include: { user: true } },
        founder: true,
      },
    });

    storeBookingEvent({
      expertId: updated.expertId,
      founderName: updated.founder.nickName ?? updated.founder.name ?? "Client",
      sessionType: updated.sessionType,
      startTime: updated.startTime,
      status: updated.status,
    }).catch(() => {});

    const depositLabel = `${updated.currency} ${((updated.depositAmountCents || 0) / 100).toFixed(2)}`;

    notifyExpertBooking({
      expertTelegramUsername: updated.expert.user.telegramUsername,
      founderName: updated.founder.nickName ?? updated.founder.name ?? "Client",
      sessionType: updated.sessionType,
      startTime: updated.startTime,
      depositAmount: depositLabel,
    }).catch(() => {});

    notifyFounderBooking({
      founderTelegramUsername: updated.founder.telegramUsername,
      expertName: updated.expert.user.nickName ?? updated.expert.user.name ?? "Expert",
      sessionType: updated.sessionType,
      startTime: updated.startTime,
      depositAmount: depositLabel,
    }).catch(() => {});

    return NextResponse.json({
      status: "confirmed",
      bookingId: updated.id,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[bookings/ton-confirm]", message, error);
    return NextResponse.json(
      { error: "Confirmation failed", detail: message },
      { status: 500 }
    );
  }
}
