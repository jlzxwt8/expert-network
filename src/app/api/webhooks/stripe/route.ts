import { NextRequest, NextResponse } from "next/server";
import { getStripeServer } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import { storeBookingEvent } from "@/lib/integrations/mem9-lifecycle";
import { notifyExpertBooking, notifyFounderBooking } from "@/lib/telegram-bot";
import type { SessionType } from "@/generated/prisma/client";

export async function POST(request: NextRequest) {
  const stripe = getStripeServer();
  const sig = request.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!sig || !webhookSecret) {
    return NextResponse.json(
      { error: "Missing signature or webhook secret" },
      { status: 400 }
    );
  }

  let event;
  try {
    const body = await request.text();
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[webhooks/stripe] Signature verification failed:", msg);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        if (session.metadata?.type !== "booking_deposit") break;

        const pi =
          typeof session.payment_intent === "string"
            ? session.payment_intent
            : session.payment_intent?.id;

        let paymentMethodId: string | undefined;
        let customerId: string | undefined;
        let piMeta: Record<string, string> = {};

        if (pi) {
          const paymentIntent = await stripe.paymentIntents.retrieve(pi);
          paymentMethodId =
            typeof paymentIntent.payment_method === "string"
              ? paymentIntent.payment_method
              : paymentIntent.payment_method?.id ?? undefined;
          customerId =
            typeof paymentIntent.customer === "string"
              ? paymentIntent.customer
              : paymentIntent.customer?.id ?? undefined;
          piMeta = (paymentIntent.metadata as Record<string, string>) ?? {};
        }

        const meta = { ...((session.metadata ?? {}) as Record<string, string>), ...piMeta };

        const booking = await prisma.booking.create({
          data: {
            expertId: meta.expertId!,
            founderId: meta.founderId!,
            sessionType: (meta.sessionType || "ONLINE") as SessionType,
            startTime: new Date(meta.startTime!),
            endTime: new Date(meta.endTime!),
            timezone: meta.timezone || "Asia/Singapore",
            meetingLink: meta.meetingLink || null,
            status: "CONFIRMED",
            totalAmountCents: parseInt(meta.totalCents || "0", 10),
            depositAmountCents: parseInt(meta.depositCents || "0", 10),
            currency: meta.currency || "SGD",
            paymentMethod: "stripe",
            paymentStatus: "deposit_paid",
            stripeCheckoutSessionId: session.id,
            stripePaymentIntentId: pi || null,
            stripeCustomerId: customerId || null,
            stripePaymentMethodId: paymentMethodId || null,
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

        const depositLabel = `${booking.currency} ${((booking.depositAmountCents || 0) / 100).toFixed(2)}`;

        // Telegram notifications (fire-and-forget)
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

        console.log(
          `[webhooks/stripe] Booking ${booking.id} created (deposit paid)`
        );
        break;
      }

      case "payment_intent.succeeded": {
        const pi = event.data.object;
        if (pi.metadata?.type !== "booking_remainder") break;

        const bookingId = pi.metadata.bookingId;
        if (bookingId) {
          await prisma.booking.update({
            where: { id: bookingId },
            data: {
              paymentStatus: "fully_paid",
              stripeRemainderPIId: pi.id,
              remainderChargedAt: new Date(),
            },
          });
          console.log(
            `[webhooks/stripe] Booking ${bookingId} remainder paid`
          );
        }
        break;
      }

      default:
        break;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[webhooks/stripe] Processing error:", message, error);
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 }
    );
  }

  return NextResponse.json({ received: true });
}
