import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { storeBookingEvent } from "@/lib/integrations/mem9-lifecycle";
import type { SessionType } from "@/generated/prisma/client";

/**
 * Telegram Bot webhook handler.
 * Processes successful payments (pre_checkout_query and successful_payment).
 */
export async function POST(request: NextRequest) {
  try {
    const update = await request.json();
    const botToken = process.env.TELEGRAM_BOT_TOKEN;

    // Handle pre-checkout query (must answer within 10s)
    if (update.pre_checkout_query) {
      await fetch(
        `https://api.telegram.org/bot${botToken}/answerPreCheckoutQuery`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            pre_checkout_query_id: update.pre_checkout_query.id,
            ok: true,
          }),
        }
      );
      return NextResponse.json({ ok: true });
    }

    // Handle successful payment
    const payment = update.message?.successful_payment;
    if (payment) {
      const payload = JSON.parse(payment.invoice_payload);

      const booking = await prisma.booking.create({
        data: {
          expertId: payload.expertId,
          founderId: payload.founderId,
          sessionType: (payload.sessionType || "ONLINE") as SessionType,
          startTime: new Date(payload.startTime),
          endTime: new Date(payload.endTime),
          timezone: payload.timezone || "Asia/Singapore",
          meetingLink: payload.meetingLink || null,
          status: "CONFIRMED",
          totalAmountCents: payload.totalCents,
          depositAmountCents: payload.depositCents,
          currency: payload.currency || "SGD",
          paymentMethod: "telegram_payments",
          paymentStatus: "deposit_paid",
          stripePaymentIntentId: payment.telegram_payment_charge_id || null,
        },
        include: {
          expert: { include: { user: true } },
          founder: true,
        },
      });

      storeBookingEvent({
        expertId: booking.expertId,
        founderName:
          booking.founder.nickName ?? booking.founder.name ?? "Client",
        sessionType: booking.sessionType,
        startTime: booking.startTime,
        status: booking.status,
      }).catch(() => {});

      console.log(
        `[webhooks/telegram] Booking ${booking.id} created via Telegram payment`
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[webhooks/telegram]", message, error);
    return NextResponse.json({ ok: true }); // Always return 200 to Telegram
  }
}
