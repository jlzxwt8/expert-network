import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { chat } from "@/lib/chat-engine";
import { storeBookingEvent } from "@/lib/integrations/mem9-lifecycle";
import type { SessionType } from "@/generated/prisma/client";

const BOT_USERNAME = process.env.TELEGRAM_BOT_USERNAME || "";
const MINI_APP_URL = `https://t.me/${BOT_USERNAME}/opc`;

async function sendMessage(
  botToken: string,
  chatId: number,
  text: string,
  extra: Record<string, unknown> = {}
) {
  await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "Markdown",
      ...extra,
    }),
  });
}

async function sendChatAction(
  botToken: string,
  chatId: number,
  action: string
) {
  await fetch(`https://api.telegram.org/bot${botToken}/sendChatAction`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, action }),
  });
}

function buildExpertButtons(
  experts: { expertId: string; name: string; profileUrl: string; bookUrl: string }[]
) {
  return experts.slice(0, 5).map((e) => [
    { text: `View ${e.name}`, url: e.profileUrl },
    { text: `Book ${e.name}`, url: e.bookUrl },
  ]);
}

export async function POST(request: NextRequest) {
  try {
    const update = await request.json();
    const botToken = process.env.TELEGRAM_BOT_TOKEN;

    if (!botToken) {
      return NextResponse.json({ ok: true });
    }

    // --- Pre-checkout query (payment) ---
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

    // --- Successful payment ---
    const payment = update.message?.successful_payment;
    if (payment) {
      const payload = JSON.parse(payment.invoice_payload);
      const chatId = update.message.chat.id;

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

      await sendMessage(
        botToken,
        chatId,
        `✅ *Booking confirmed!*\nYour session with ${booking.expert.user.nickName || booking.expert.user.name || "the expert"} is booked. You'll receive details shortly.`
      );

      return NextResponse.json({ ok: true });
    }

    // --- Text message handling ---
    const message = update.message;
    if (!message?.text) {
      return NextResponse.json({ ok: true });
    }

    const chatId = message.chat.id;
    const text = message.text.trim();

    // /start command
    if (text === "/start" || text === `/start@${BOT_USERNAME}`) {
      const welcomeText = [
        `👋 *Welcome to Help&Grow Expert Network!*`,
        ``,
        `I can help you find the perfect expert for your needs. Just describe what you're looking for, for example:`,
        ``,
        `• _"I need a marketing expert for my startup"_`,
        `• _"Looking for a tech mentor with AI experience"_`,
        `• _"Who can help with fundraising in Singapore?"_`,
        ``,
        `Or use these commands:`,
        `/find <your need> — Find matching experts`,
        `/help — Show this help message`,
      ].join("\n");

      const buttons: Record<string, unknown> = {};
      if (BOT_USERNAME) {
        buttons.reply_markup = {
          inline_keyboard: [
            [{ text: "🚀 Open Full App", url: MINI_APP_URL }],
          ],
        };
      }

      await sendMessage(botToken, chatId, welcomeText, buttons);
      return NextResponse.json({ ok: true });
    }

    // /help command
    if (text === "/help" || text === `/help@${BOT_USERNAME}`) {
      const helpText = [
        `*Help&Grow Expert Network Bot*`,
        ``,
        `💬 *Chat with me* — Tell me what kind of expert you need and I'll recommend the best matches.`,
        ``,
        `*Commands:*`,
        `/find <description> — Find experts matching your needs`,
        `/browse — Open the expert directory`,
        `/help — Show this message`,
        ``,
        `You can also type any question naturally!`,
      ].join("\n");

      await sendMessage(botToken, chatId, helpText);
      return NextResponse.json({ ok: true });
    }

    // /browse command
    if (text === "/browse" || text === `/browse@${BOT_USERNAME}`) {
      const buttons = BOT_USERNAME
        ? {
            reply_markup: {
              inline_keyboard: [
                [{ text: "🔍 Browse Experts", url: MINI_APP_URL }],
              ],
            },
          }
        : {};
      await sendMessage(
        botToken,
        chatId,
        `Open the full app to browse all experts:`,
        buttons
      );
      return NextResponse.json({ ok: true });
    }

    // /find command or regular text → AI expert matching
    let query = text;
    if (text.startsWith("/find")) {
      query = text.replace(/^\/find(@\w+)?\s*/, "").trim();
      if (!query) {
        await sendMessage(
          botToken,
          chatId,
          `Please describe what you're looking for.\nExample: /find marketing expert for SaaS startup`
        );
        return NextResponse.json({ ok: true });
      }
    }

    // Show "typing" indicator
    await sendChatAction(botToken, chatId, "typing");

    const result = await chat(query);

    if (result.experts.length > 0) {
      // Build a text reply with inline buttons
      const lines = result.experts.map(
        (e, i) =>
          `*${i + 1}. ${e.name}*${e.priceLabel ? ` — ${e.priceLabel}` : ""}\n${e.reason}`
      );
      const replyText = `🎯 *Expert Recommendations*\n\n${lines.join("\n\n")}`;

      const buttons = buildExpertButtons(result.experts);
      if (BOT_USERNAME) {
        buttons.push([{ text: "🔍 Browse All Experts", url: MINI_APP_URL }]);
      }

      await sendMessage(botToken, chatId, replyText, {
        reply_markup: { inline_keyboard: buttons },
      });
    } else {
      const fallbackButtons = BOT_USERNAME
        ? {
            reply_markup: {
              inline_keyboard: [
                [{ text: "🔍 Browse All Experts", url: MINI_APP_URL }],
              ],
            },
          }
        : {};

      await sendMessage(
        botToken,
        chatId,
        result.reply,
        fallbackButtons
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[webhooks/telegram]", message, error);
    return NextResponse.json({ ok: true });
  }
}
