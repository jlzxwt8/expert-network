import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveUserId } from "@/lib/request-auth";
import { findOverlappingBooking } from "@/lib/booking-utils";
import { notifyCancellation, notifyReschedule } from "@/lib/telegram-bot";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await resolveUserId(request);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const booking = await prisma.booking.findUnique({
      where: { id },
      include: {
        expert: { include: { user: true } },
        founder: true,
      },
    });

    if (!booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    const isFounder = booking.founderId === userId;
    const isExpert = booking.expert.userId === userId;
    if (!isFounder && !isExpert) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json(booking);
  } catch (error) {
    console.error("[bookings/[id] GET]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await resolveUserId(request);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "Booking ID is required" }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    if (typeof body !== "object" || body === null) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const booking = await prisma.booking.findUnique({
      where: { id },
      include: { expert: { include: { user: true } }, founder: true },
    });

    if (!booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    const isFounder = booking.founderId === userId;
    const isExpert = booking.expert.userId === userId;
    if (!isFounder && !isExpert) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const action = typeof body.action === "string" ? body.action : null;

    // === CANCEL ===
    if (action === "cancel" || body.status === "CANCELLED") {
      if (booking.status === "CANCELLED") {
        return NextResponse.json({ error: "Booking is already cancelled" }, { status: 400 });
      }
      if (booking.status === "COMPLETED") {
        return NextResponse.json({ error: "Cannot cancel a completed booking" }, { status: 400 });
      }

      const updated = await prisma.booking.update({
        where: { id },
        data: {
          status: "CANCELLED",
          cancelledBy: userId,
          cancelReason: typeof body.reason === "string" ? body.reason.slice(0, 500) : null,
        },
        include: { expert: { include: { user: true } }, founder: true },
      });

      const cancellerName = isFounder
        ? (updated.founder.nickName ?? updated.founder.name ?? "Client")
        : (updated.expert.user.nickName ?? updated.expert.user.name ?? "Expert");
      const founderName = updated.founder.nickName ?? updated.founder.name ?? "Client";
      const expertName = updated.expert.user.nickName ?? updated.expert.user.name ?? "Expert";

      // Notify the other party
      if (isFounder) {
        notifyCancellation({
          telegramUsername: updated.expert.user.telegramUsername,
          otherPartyName: founderName,
          cancelledByName: cancellerName,
          sessionType: updated.sessionType,
          startTime: updated.startTime,
          reason: updated.cancelReason,
        }).catch(() => {});
      } else {
        notifyCancellation({
          telegramUsername: updated.founder.telegramUsername,
          otherPartyName: expertName,
          cancelledByName: cancellerName,
          sessionType: updated.sessionType,
          startTime: updated.startTime,
          reason: updated.cancelReason,
        }).catch(() => {});
      }

      return NextResponse.json(updated);
    }

    // === RESCHEDULE ===
    if (action === "reschedule") {
      if (booking.status === "CANCELLED" || booking.status === "COMPLETED") {
        return NextResponse.json(
          { error: `Cannot reschedule a ${booking.status.toLowerCase()} booking` },
          { status: 400 }
        );
      }

      const newStart = body.startTime ? new Date(body.startTime) : null;
      const newEnd = body.endTime ? new Date(body.endTime) : null;

      if (!newStart || isNaN(newStart.getTime()) || !newEnd || isNaN(newEnd.getTime())) {
        return NextResponse.json(
          { error: "Valid startTime and endTime are required for rescheduling" },
          { status: 400 }
        );
      }
      if (newEnd <= newStart) {
        return NextResponse.json({ error: "endTime must be after startTime" }, { status: 400 });
      }

      const overlap = await findOverlappingBooking(booking.expertId, newStart, newEnd, id);
      if (overlap) {
        return NextResponse.json(
          { error: "New time slot conflicts with another booking" },
          { status: 409 }
        );
      }

      const oldStartTime = booking.startTime;

      const updated = await prisma.booking.update({
        where: { id },
        data: {
          startTime: newStart,
          endTime: newEnd,
          timezone: typeof body.timezone === "string" ? body.timezone : undefined,
        },
        include: { expert: { include: { user: true } }, founder: true },
      });

      const reschedulerName = isFounder
        ? (updated.founder.nickName ?? updated.founder.name ?? "Client")
        : (updated.expert.user.nickName ?? updated.expert.user.name ?? "Expert");
      const rFounderName = updated.founder.nickName ?? updated.founder.name ?? "Client";
      const rExpertName = updated.expert.user.nickName ?? updated.expert.user.name ?? "Expert";

      // Notify the other party
      if (isFounder) {
        notifyReschedule({
          telegramUsername: updated.expert.user.telegramUsername,
          otherPartyName: rFounderName,
          rescheduledByName: reschedulerName,
          sessionType: updated.sessionType,
          oldStartTime,
          newStartTime: newStart,
        }).catch(() => {});
      } else {
        notifyReschedule({
          telegramUsername: updated.founder.telegramUsername,
          otherPartyName: rExpertName,
          rescheduledByName: reschedulerName,
          sessionType: updated.sessionType,
          oldStartTime,
          newStartTime: newStart,
        }).catch(() => {});
      }

      return NextResponse.json(updated);
    }

    // === UPDATE LOCATION ===
    if (action === "update_location") {
      const offlineAddress = typeof body.offlineAddress === "string" ? body.offlineAddress.trim() : null;
      const meetingLink = typeof body.meetingLink === "string" ? body.meetingLink.trim() : null;

      const updated = await prisma.booking.update({
        where: { id },
        data: {
          ...(offlineAddress !== null ? { offlineAddress } : {}),
          ...(meetingLink !== null ? { meetingLink } : {}),
        },
        include: { expert: { include: { user: true } }, founder: true },
      });

      return NextResponse.json(updated);
    }

    // === STATUS UPDATE (legacy) ===
    const validStatuses = ["PENDING", "CONFIRMED", "COMPLETED", "CANCELLED"];
    if (typeof body.status === "string" && validStatuses.includes(body.status)) {
      const updated = await prisma.booking.update({
        where: { id },
        data: { status: body.status },
        include: { expert: { include: { user: true } }, founder: true },
      });
      return NextResponse.json(updated);
    }

    return NextResponse.json({ error: "No valid action or status provided" }, { status: 400 });
  } catch (error) {
    console.error("[bookings/[id] PATCH]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await resolveUserId(request);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const booking = await prisma.booking.findUnique({
      where: { id },
      include: { expert: true },
    });

    if (!booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    const isFounder = booking.founderId === userId;
    const isExpert = booking.expert.userId === userId;
    if (!isFounder && !isExpert) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (booking.status !== "CANCELLED") {
      return NextResponse.json(
        { error: "Only cancelled bookings can be deleted" },
        { status: 400 }
      );
    }

    await prisma.booking.delete({ where: { id } });
    return NextResponse.json({ deleted: true });
  } catch (error) {
    console.error("[bookings/[id] DELETE]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
