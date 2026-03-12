const APP_URL =
  process.env.NEXTAUTH_URL || "https://expert-network.vercel.app";

async function callBotApi(method: string, body: Record<string, unknown>) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) throw new Error("TELEGRAM_BOT_TOKEN not set");

  const res = await fetch(`https://api.telegram.org/bot${botToken}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json();
}

/**
 * Resolve a Telegram username to a chat ID.
 * This only works if the user has previously interacted with the bot.
 * We look up the user's telegramId from our database as a fallback.
 */
async function resolveChatId(telegramUsername: string): Promise<number | null> {
  // Import prisma dynamically to avoid circular deps
  const { prisma } = await import("@/lib/prisma");
  const user = await prisma.user.findFirst({
    where: { telegramUsername },
    select: { telegramId: true },
  });
  if (user?.telegramId) return parseInt(user.telegramId, 10);
  return null;
}

export async function sendTelegramMessage(
  chatId: number,
  text: string,
  inlineKeyboard?: Record<string, unknown>[][]
) {
  const extra: Record<string, unknown> = { parse_mode: "Markdown" };
  if (inlineKeyboard?.length) {
    extra.reply_markup = { inline_keyboard: inlineKeyboard };
  }
  return callBotApi("sendMessage", { chat_id: chatId, text, ...extra });
}

/**
 * Send a greeting to a user who just added their Telegram username.
 */
export async function sendGreeting(telegramUsername: string): Promise<boolean> {
  const chatId = await resolveChatId(telegramUsername);
  if (!chatId) return false;

  const text = [
    `👋 *Welcome to Help&Grow Expert Network!*`,
    ``,
    `Your Telegram account has been linked. You'll now receive:`,
    `• Booking confirmations`,
    `• Session reminders`,
    `• Updates from your experts`,
    ``,
    `Tap below to explore experts right from Telegram!`,
  ].join("\n");

  await sendTelegramMessage(chatId, text, [
    [{ text: "🚀 Open Expert Network", web_app: { url: `${APP_URL}/discover` } }],
  ]);

  return true;
}

/**
 * Notify an expert about a new booking.
 */
export async function notifyExpertBooking(params: {
  expertTelegramUsername: string | null;
  founderName: string;
  sessionType: string;
  startTime: Date;
  depositAmount: string;
}): Promise<boolean> {
  if (!params.expertTelegramUsername) return false;
  const chatId = await resolveChatId(params.expertTelegramUsername);
  if (!chatId) return false;

  const dateStr = params.startTime.toLocaleDateString("en-SG", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

  const text = [
    `📅 *New Booking!*`,
    ``,
    `*${params.founderName}* has booked a ${params.sessionType.toLowerCase()} session with you.`,
    ``,
    `🗓 ${dateStr}`,
    `💰 Deposit: ${params.depositAmount}`,
    ``,
    `Open the app to view details.`,
  ].join("\n");

  await sendTelegramMessage(chatId, text, [
    [{ text: "📋 View Bookings", web_app: { url: `${APP_URL}/dashboard` } }],
  ]);

  return true;
}

/**
 * Notify a mentee about their booking confirmation.
 */
export async function notifyFounderBooking(params: {
  founderTelegramUsername: string | null;
  expertName: string;
  sessionType: string;
  startTime: Date;
  depositAmount: string;
}): Promise<boolean> {
  if (!params.founderTelegramUsername) return false;
  const chatId = await resolveChatId(params.founderTelegramUsername);
  if (!chatId) return false;

  const dateStr = params.startTime.toLocaleDateString("en-SG", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

  const text = [
    `✅ *Booking Confirmed!*`,
    ``,
    `Your ${params.sessionType.toLowerCase()} session with *${params.expertName}* is confirmed.`,
    ``,
    `🗓 ${dateStr}`,
    `💰 Deposit paid: ${params.depositAmount}`,
    ``,
    `The remainder will be charged 24h after the session.`,
  ].join("\n");

  await sendTelegramMessage(chatId, text, [
    [{ text: "📋 View My Bookings", web_app: { url: `${APP_URL}/dashboard` } }],
  ]);

  return true;
}

/**
 * Notify a user that their booking has been cancelled.
 */
export async function notifyCancellation(params: {
  telegramUsername: string | null;
  otherPartyName: string;
  cancelledByName: string;
  sessionType: string;
  startTime: Date;
  reason?: string | null;
}): Promise<boolean> {
  if (!params.telegramUsername) return false;
  const chatId = await resolveChatId(params.telegramUsername);
  if (!chatId) return false;

  const dateStr = params.startTime.toLocaleDateString("en-SG", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

  const lines = [
    `❌ *Booking Cancelled*`,
    ``,
    `Your ${params.sessionType.toLowerCase()} session with *${params.otherPartyName}* has been cancelled by *${params.cancelledByName}*.`,
    ``,
    `🗓 ${dateStr}`,
  ];

  if (params.reason) {
    lines.push(`💬 Reason: ${params.reason}`);
  }

  await sendTelegramMessage(chatId, lines.join("\n"), [
    [{ text: "📋 View Bookings", web_app: { url: `${APP_URL}/dashboard` } }],
  ]);

  return true;
}

/**
 * Notify a user that their booking has been rescheduled.
 */
export async function notifyReschedule(params: {
  telegramUsername: string | null;
  otherPartyName: string;
  rescheduledByName: string;
  sessionType: string;
  oldStartTime: Date;
  newStartTime: Date;
}): Promise<boolean> {
  if (!params.telegramUsername) return false;
  const chatId = await resolveChatId(params.telegramUsername);
  if (!chatId) return false;

  const fmt = (d: Date) =>
    d.toLocaleDateString("en-SG", {
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });

  const text = [
    `🔄 *Booking Rescheduled*`,
    ``,
    `Your ${params.sessionType.toLowerCase()} session with *${params.otherPartyName}* has been rescheduled by *${params.rescheduledByName}*.`,
    ``,
    `~~${fmt(params.oldStartTime)}~~ → 🗓 *${fmt(params.newStartTime)}*`,
  ].join("\n");

  await sendTelegramMessage(chatId, text, [
    [{ text: "📋 View Bookings", web_app: { url: `${APP_URL}/dashboard` } }],
  ]);

  return true;
}

/**
 * Send a session reminder (e.g. 1 hour before).
 */
export async function sendSessionReminder(params: {
  telegramUsername: string | null;
  expertName: string;
  sessionType: string;
  startTime: Date;
}): Promise<boolean> {
  if (!params.telegramUsername) return false;
  const chatId = await resolveChatId(params.telegramUsername);
  if (!chatId) return false;

  const dateStr = params.startTime.toLocaleDateString("en-SG", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

  const text = [
    `⏰ *Session Reminder*`,
    ``,
    `Your ${params.sessionType.toLowerCase()} session with *${params.expertName}* is coming up!`,
    ``,
    `🗓 ${dateStr}`,
  ].join("\n");

  await sendTelegramMessage(chatId, text);
  return true;
}
