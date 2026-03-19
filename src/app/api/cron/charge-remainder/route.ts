import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createPaymentIntent } from "@/lib/stripe";
import { sendSessionReminder } from "@/lib/telegram-bot";

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
    // Auto-complete confirmed bookings whose session has ended
    const completed = await prisma.booking.updateMany({
      where: {
        status: "CONFIRMED",
        endTime: { lt: new Date() },
      },
      data: { status: "COMPLETED" },
    });
    if (completed.count > 0) {
      console.log(`[cron/charge-remainder] Auto-completed ${completed.count} bookings`);
    }

    const bookings = await prisma.booking.findMany({
      where: {
        paymentStatus: "deposit_paid",
        remainderChargedAt: null,
        endTime: { lt: cutoff },
      },
    });

    let charged = 0;
    let failed = 0;
    let manualDue = 0;

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

      // Stripe card remainder (only if card was saved)
      if (
        booking.paymentMethod === "stripe" &&
        booking.stripeCustomerId &&
        booking.stripePaymentMethodId
      ) {
        try {
          const pi = await createPaymentIntent({
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

      // Stripe without saved card (PayNow, GrabPay, Alipay, WeChat Pay),
      // TON, or Telegram Payments: mark as remainder_due for manual payment
      if (
        booking.paymentMethod === "stripe" ||
        booking.paymentMethod === "ton" ||
        booking.paymentMethod === "telegram_payments"
      ) {
        await prisma.booking.update({
          where: { id: booking.id },
          data: { paymentStatus: "remainder_due" },
        });
        manualDue++;
        continue;
      }
    }

    // Send reminders for sessions starting within the next 25 hours
    // (since cron runs daily, this covers roughly the next day)
    const reminderStart = new Date();
    const reminderEnd = new Date(Date.now() + 25 * 60 * 60 * 1000);

    const upcomingBookings = await prisma.booking.findMany({
      where: {
        status: "CONFIRMED",
        paymentStatus: "deposit_paid",
        startTime: { gte: reminderStart, lte: reminderEnd },
      },
      include: {
        expert: { include: { user: true } },
        founder: true,
      },
    });

    let reminders = 0;
    for (const b of upcomingBookings) {
      const expertName =
        b.expert.user.nickName ?? b.expert.user.name ?? "Expert";

      const founderName = b.founder.nickName ?? b.founder.name ?? "Client";

      sendSessionReminder({
        telegramUsername: b.founder.telegramUsername,
        expertName,
        sessionType: b.sessionType,
        startTime: b.startTime,
      }).catch(() => {});

      sendSessionReminder({
        telegramUsername: b.expert.user.telegramUsername,
        expertName: founderName,
        sessionType: b.sessionType,
        startTime: b.startTime,
      }).catch(() => {});


      reminders++;
    }

    console.log(
      `[cron/charge-remainder] Processed ${bookings.length} bookings: ${charged} charged, ${failed} failed, ${manualDue} manual due, ${reminders} reminders sent`
    );

    return NextResponse.json({
      processed: bookings.length,
      charged,
      failed,
      manualDue,
      reminders,
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
