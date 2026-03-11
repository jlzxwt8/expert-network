import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getStripeServer } from "@/lib/stripe";

/**
 * Vercel Cron job: charges the remainder for bookings where the session
 * ended more than 24 hours ago and deposit has been paid.
 *
 * Secured by the CRON_SECRET header (automatically set by Vercel).
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);

  try {
    const bookings = await prisma.booking.findMany({
      where: {
        paymentStatus: "deposit_paid",
        remainderChargedAt: null,
        endTime: { lt: cutoff },
      },
    });

    let charged = 0;
    let failed = 0;
    let tonDue = 0;

    const stripe = getStripeServer();

    for (const booking of bookings) {
      const remainderCents =
        (booking.totalAmountCents || 0) - (booking.depositAmountCents || 0);

      if (remainderCents <= 0) {
        await prisma.booking.update({
          where: { id: booking.id },
          data: {
            paymentStatus: "fully_paid",
            remainderChargedAt: new Date(),
          },
        });
        charged++;
        continue;
      }

      // Stripe card remainder
      if (
        booking.paymentMethod === "stripe" &&
        booking.stripeCustomerId &&
        booking.stripePaymentMethodId
      ) {
        try {
          const pi = await stripe.paymentIntents.create({
            amount: remainderCents,
            currency: (booking.currency || "sgd").toLowerCase(),
            customer: booking.stripeCustomerId,
            payment_method: booking.stripePaymentMethodId,
            off_session: true,
            confirm: true,
            metadata: {
              type: "booking_remainder",
              bookingId: booking.id,
            },
          });

          await prisma.booking.update({
            where: { id: booking.id },
            data: {
              paymentStatus: "fully_paid",
              stripeRemainderPIId: pi.id,
              remainderChargedAt: new Date(),
            },
          });

          charged++;
        } catch (err) {
          console.error(
            `[cron/charge-remainder] Failed for booking ${booking.id}:`,
            err
          );
          await prisma.booking.update({
            where: { id: booking.id },
            data: { paymentStatus: "failed" },
          });
          failed++;
        }
        continue;
      }

      // TON or Telegram Payments: mark as remainder_due
      if (
        booking.paymentMethod === "ton" ||
        booking.paymentMethod === "telegram_payments"
      ) {
        await prisma.booking.update({
          where: { id: booking.id },
          data: { paymentStatus: "remainder_due" },
        });
        tonDue++;
        continue;
      }
    }

    console.log(
      `[cron/charge-remainder] Processed ${bookings.length} bookings: ${charged} charged, ${failed} failed, ${tonDue} TON/TG due`
    );

    return NextResponse.json({
      processed: bookings.length,
      charged,
      failed,
      tonDue,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[cron/charge-remainder]", message, error);
    return NextResponse.json(
      { error: "Cron job failed", detail: message },
      { status: 500 }
    );
  }
}
