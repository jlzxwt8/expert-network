import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const bookings = await prisma.booking.findMany({
    select: {
      id: true,
      status: true,
      paymentStatus: true,
      sessionType: true,
      startTime: true,
      totalAmountCents: true,
      depositAmountCents: true,
      currency: true,
      stripeCheckoutSessionId: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ total: bookings.length, bookings });
}
