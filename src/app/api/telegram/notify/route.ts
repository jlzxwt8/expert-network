import { NextRequest, NextResponse } from "next/server";
import {
  sendGreeting,
  notifyExpertBooking,
  notifyFounderBooking,
} from "@/lib/telegram-bot";

/**
 * Internal API for sending Telegram notifications.
 * Called by other parts of the app (onboarding, booking webhooks, etc.)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type } = body;

    switch (type) {
      case "greeting": {
        const { telegramUsername } = body;
        if (!telegramUsername) {
          return NextResponse.json(
            { error: "telegramUsername is required" },
            { status: 400 }
          );
        }
        const sent = await sendGreeting(telegramUsername);
        return NextResponse.json({ sent });
      }

      case "booking_expert": {
        const sent = await notifyExpertBooking({
          expertTelegramUsername: body.expertTelegramUsername,
          founderName: body.founderName,
          sessionType: body.sessionType,
          startTime: new Date(body.startTime),
          depositAmount: body.depositAmount,
        });
        return NextResponse.json({ sent });
      }

      case "booking_founder": {
        const sent = await notifyFounderBooking({
          founderTelegramUsername: body.founderTelegramUsername,
          expertName: body.expertName,
          sessionType: body.sessionType,
          startTime: new Date(body.startTime),
          depositAmount: body.depositAmount,
        });
        return NextResponse.json({ sent });
      }

      default:
        return NextResponse.json(
          { error: `Unknown notification type: ${type}` },
          { status: 400 }
        );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[telegram/notify POST]", message, error);
    return NextResponse.json(
      { error: "Failed to send notification" },
      { status: 500 }
    );
  }
}
