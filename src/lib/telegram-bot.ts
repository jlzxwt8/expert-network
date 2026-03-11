const BOT_USERNAME = process.env.TELEGRAM_BOT_USERNAME || "";
const MINI_APP_URL = `https://t.me/${BOT_USERNAME}/opc`;

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
  inlineKeyboard?: { text: string; url: string }[][]
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
    [{ text: "🚀 Open Expert Network", url: MINI_APP_URL }],
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
    [{ text: "📋 View Bookings", url: MINI_APP_URL }],
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
    [{ text: "📋 View My Bookings", url: MINI_APP_URL }],
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
