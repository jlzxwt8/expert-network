import { type NextRequest, NextResponse } from "next/server";

import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { findOverlappingBooking } from "@/lib/booking-utils";
import { prisma } from "@/lib/prisma";
import { createCheckoutSession, calculateBookingAmount, getPlatformFeePercent } from "@/lib/stripe";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { expertId, sessionType, startTime, endTime, timezone, meetingLink, offlineAddress, donationAmountCents } =
      body;

    if (!expertId || !sessionType || !startTime || !endTime) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const start = new Date(startTime);
    const end = new Date(endTime);
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) {
      return NextResponse.json(
        { error: "Invalid time range" },
        { status: 400 }
      );
    }

    const expert = await prisma.expert.findUnique({
      where: { id: expertId, isPublished: true },
      include: { user: true },
    });

    if (!expert) {
      return NextResponse.json({ error: "Expert not found" }, { status: 404 });
    }

    if (expert.userId === session.user.id) {
      return NextResponse.json({ error: "You cannot book yourself" }, { status: 400 });
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
        { error: "Expert has not set pricing for this session type" },
        { status: 400 }
      );
    }

    const { totalCents, depositCents } = calculateBookingAmount(
      pricePerHour,
      start,
      end
    );

    const origin =
      request.headers.get("origin") || process.env.NEXTAUTH_URL || "";

    const paymentIntentData: Record<string, unknown> = {
      metadata: {
        expertId,
        founderId: session.user.id,
        sessionType,
        startTime: start.toISOString(),
        endTime: end.toISOString(),
        timezone: timezone || "Asia/Singapore",
        meetingLink: meetingLink || "",
        offlineAddress: offlineAddress || "",
        totalCents: String(totalCents),
        depositCents: String(depositCents),
        currency: expert.currency,
      },
    };

    const parsedDonation = Number(donationAmountCents) || 0;
    if (parsedDonation > 0) {
      if (!paymentIntentData.metadata) paymentIntentData.metadata = {};
      (paymentIntentData.metadata as Record<string, string>).donationAmountCents = String(parsedDonation);
    }

    if (expert.stripeAccountId && expert.stripeAccountStatus === "active") {
      const feePercent = getPlatformFeePercent();
      let applicationFee = Math.round(depositCents * (feePercent / 100));
      if (parsedDonation > 0) {
        applicationFee += parsedDonation; // Route donation to platform
      }
      paymentIntentData.application_fee_amount = applicationFee;
      paymentIntentData.transfer_data = {
        destination: expert.stripeAccountId,
      };
    }

    const checkoutSession = await createCheckoutSession({
      mode: "payment",
      payment_method_types: ["paynow", "grabpay", "card"],
      line_items: [
        {
          price_data: {
            currency: expert.currency.toLowerCase(),
            unit_amount: depositCents,
            product_data: {
              name: `Session Deposit — ${expert.user.nickName || expert.user.name || "Expert"}`,
              description: `${sessionType} session on ${start.toLocaleDateString()}. 50% deposit (remainder charged 24h after session).`,
            },
          },
          quantity: 1,
        },
        ...(parsedDonation > 0 ? [{
          price_data: {
            currency: expert.currency.toLowerCase(),
            unit_amount: parsedDonation,
            product_data: {
              name: "Help & Grow Donation",
              description: "Voluntary donation to support NGO initiatives.",
            },
          },
          quantity: 1,
        }] : [])
      ],
      payment_intent_data: paymentIntentData,
      payment_method_options: {
        card: { setup_future_usage: "off_session" },
      },
      metadata: {
        type: "booking_deposit",
        expertId,
        founderId: session.user.id,
      },
      success_url: `${origin}/bookings/checkout-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/experts/${expertId}/book?cancelled=true`,
    });

    return NextResponse.json({ checkoutUrl: checkoutSession.url });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[bookings/checkout POST]", message, error);
    return NextResponse.json(
      { error: "Failed to create checkout session", detail: message },
      { status: 500 }
    );
  }
}
