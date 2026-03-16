import { NextRequest, NextResponse } from "next/server";
import { verifyWebhookSignature, retrievePaymentIntent, getAccountStatus } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import { storeBookingEvent } from "@/lib/integrations/mem9-lifecycle";
import { notifyExpertBooking, notifyFounderBooking } from "@/lib/telegram-bot";
import type { SessionType } from "@/generated/prisma/client";

export async function POST(request: NextRequest) {
  const sig = request.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!sig || !webhookSecret) {
    return NextResponse.json(
      { error: "Missing signature or webhook secret" },
      { status: 400 }
    );
  }

  let event: Record<string, unknown>;
  try {
    const body = await request.text();
    event = await verifyWebhookSignature(body, sig, webhookSecret);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[webhooks/stripe] Signature verification failed:", msg);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    const eventType = event.type as string;
    const dataObject = (event.data as { object: Record<string, unknown> })?.object;

    switch (eventType) {
      case "checkout.session.completed": {
        const session = dataObject;
        const sessionMeta = session.metadata as Record<string, string> | undefined;

        if (sessionMeta?.type === "booking_remainder") {
          const bookingId = sessionMeta.bookingId;
          if (bookingId) {
            await prisma.booking.update({
              where: { id: bookingId },
              data: {
                paymentStatus: "fully_paid",
                remainderChargedAt: new Date(),
              },
            });
            console.log(
              `[webhooks/stripe] Booking ${bookingId} remainder paid via checkout`
            );
          }
          break;
        }

        if (sessionMeta?.type !== "booking_deposit") break;

        const alreadyExists = await prisma.booking.findFirst({
          where: { stripeCheckoutSessionId: session.id as string },
        });
        if (alreadyExists) {
          console.log(`[webhooks/stripe] Booking already exists for session ${session.id}`);
          break;
        }

        const pi =
          typeof session.payment_intent === "string"
            ? session.payment_intent
            : (session.payment_intent as { id?: string })?.id;

        let paymentMethodId: string | undefined;
        let customerId: string | undefined;
        let piMeta: Record<string, string> = {};

        if (pi) {
          const paymentIntent = await retrievePaymentIntent(pi);
          paymentMethodId =
            typeof paymentIntent.payment_method === "string"
              ? paymentIntent.payment_method
              : undefined;
          customerId =
            typeof paymentIntent.customer === "string"
              ? paymentIntent.customer
              : undefined;
          piMeta = (paymentIntent.metadata as Record<string, string>) ?? {};
        }

        const meta = { ...(sessionMeta ?? {}), ...piMeta };

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
            stripeCheckoutSessionId: session.id as string,
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

        notifyExpertBooking({
          expertTelegramId: booking.expert.user.telegramId,
          expertTelegramUsername: booking.expert.user.telegramUsername,
          founderName: booking.founder.nickName ?? booking.founder.name ?? "Client",
          sessionType: booking.sessionType,
          startTime: booking.startTime,
          depositAmount: depositLabel,
          timezone: booking.timezone,
        }).catch(() => {});

        notifyFounderBooking({
          founderTelegramId: booking.founder.telegramId,
          founderTelegramUsername: booking.founder.telegramUsername,
          expertName: booking.expert.user.nickName ?? booking.expert.user.name ?? "Expert",
          sessionType: booking.sessionType,
          startTime: booking.startTime,
          depositAmount: depositLabel,
          timezone: booking.timezone,
        }).catch(() => {});

        console.log(
          `[webhooks/stripe] Booking ${booking.id} created (deposit paid)`
        );
        break;
      }

      case "payment_intent.succeeded": {
        const piMeta = dataObject.metadata as Record<string, string> | undefined;
        if (piMeta?.type !== "booking_remainder") break;

        const bookingId = piMeta.bookingId;
        if (bookingId) {
          await prisma.booking.update({
            where: { id: bookingId },
            data: {
              paymentStatus: "fully_paid",
              stripeRemainderPIId: dataObject.id as string,
              remainderChargedAt: new Date(),
            },
          });
          console.log(
            `[webhooks/stripe] Booking ${bookingId} remainder paid`
          );
        }
        break;
      }

      case "account.updated": {
        const acct = dataObject as {
          id?: string;
          charges_enabled?: boolean;
          payouts_enabled?: boolean;
          details_submitted?: boolean;
          requirements?: {
            currently_due: string[];
            eventually_due: string[];
            disabled_reason: string | null;
          };
        };

        if (acct.id) {
          const status = getAccountStatus({
            id: acct.id as string,
            charges_enabled: !!acct.charges_enabled,
            payouts_enabled: !!acct.payouts_enabled,
            details_submitted: !!acct.details_submitted,
            requirements: acct.requirements,
          });

          await prisma.expert.updateMany({
            where: { stripeAccountId: acct.id as string },
            data: { stripeAccountStatus: status },
          });

          console.log(
            `[webhooks/stripe] Connected account ${acct.id} status → ${status}`
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
