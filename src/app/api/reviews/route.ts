import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    if (typeof body !== "object" || body === null) {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 }
      );
    }

    const bookingId =
      typeof body.bookingId === "string" ? body.bookingId.trim() : null;
    const rating =
      typeof body.rating === "number" ? body.rating : parseInt(String(body.rating ?? ""), 10);
    const comment =
      typeof body.comment === "string" ? body.comment : undefined;

    if (!bookingId) {
      return NextResponse.json(
        { error: "bookingId is required" },
        { status: 400 }
      );
    }
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return NextResponse.json(
        { error: "rating must be an integer between 1 and 5" },
        { status: 400 }
      );
    }

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { expert: true },
    });

    if (!booking) {
      return NextResponse.json(
        { error: "Booking not found" },
        { status: 404 }
      );
    }
    if (booking.founderId !== session.user.id) {
      return NextResponse.json(
        { error: "Forbidden: only the founder can review this booking" },
        { status: 403 }
      );
    }
    if (booking.status !== "COMPLETED") {
      return NextResponse.json(
        { error: "Can only review completed bookings" },
        { status: 400 }
      );
    }

    const existingReview = await prisma.review.findUnique({
      where: { bookingId },
    });
    if (existingReview) {
      return NextResponse.json(
        { error: "This booking has already been reviewed" },
        { status: 400 }
      );
    }

    const [review, agg] = await prisma.$transaction([
      prisma.review.create({
        data: {
          bookingId,
          expertId: booking.expertId,
          founderId: session.user.id,
          rating,
          comment: comment ?? null,
        },
        include: { founder: true, expert: { include: { user: true } } },
      }),
      prisma.review.aggregate({
        where: { expertId: booking.expertId },
        _avg: { rating: true },
        _count: true,
      }),
    ]);

    await prisma.expert.update({
      where: { id: booking.expertId },
      data: {
        avgRating: agg._avg.rating ?? 0,
        reviewCount: agg._count,
      },
    });

    return NextResponse.json(review);
  } catch (error) {
    console.error("[reviews POST]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const expertId = searchParams.get("expertId");
    const skip = Math.max(0, parseInt(searchParams.get("skip") ?? "0", 10) || 0);
    const take = Math.min(50, Math.max(1, parseInt(searchParams.get("take") ?? "20", 10) || 20));

    if (!expertId) {
      return NextResponse.json(
        { error: "expertId query param is required" },
        { status: 400 }
      );
    }

    const [reviews, total] = await Promise.all([
      prisma.review.findMany({
        where: { expertId },
        orderBy: { createdAt: "desc" },
        skip,
        take,
        include: {
          founder: {
            select: {
              id: true,
              name: true,
              nickName: true,
              image: true,
            },
          },
        },
      }),
      prisma.review.count({ where: { expertId } }),
    ]);

    return NextResponse.json({ reviews, total, skip, take });
  } catch (error) {
    console.error("[reviews GET]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
