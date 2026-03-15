import { prisma } from "@/lib/prisma";

const APP_ID = process.env.WECHAT_APP_ID || "";
const APP_SECRET = process.env.WECHAT_APP_SECRET || "";

let accessToken = "";
let tokenExpiresAt = 0;

async function getAccessToken(): Promise<string> {
  if (accessToken && Date.now() < tokenExpiresAt) {
    return accessToken;
  }

  if (!APP_ID || !APP_SECRET) {
    throw new Error("WeChat app credentials not configured");
  }

  const res = await fetch(
    `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${APP_ID}&secret=${APP_SECRET}`
  );
  const data = await res.json();

  if (data.errcode) {
    console.error("[wechat-notify] token error:", data);
    throw new Error(data.errmsg || "Failed to get access token");
  }

  accessToken = data.access_token;
  tokenExpiresAt = Date.now() + (data.expires_in - 300) * 1000;
  return accessToken;
}

interface SubscribeMessageParams {
  openid: string;
  templateId: string;
  page?: string;
  data: Record<string, { value: string }>;
}

async function sendSubscribeMessage(
  params: SubscribeMessageParams
): Promise<boolean> {
  try {
    const token = await getAccessToken();
    const res = await fetch(
      `https://api.weixin.qq.com/cgi-bin/message/subscribe/send?access_token=${token}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          touser: params.openid,
          template_id: params.templateId,
          page: params.page || "",
          data: params.data,
        }),
      }
    );

    const result = await res.json();
    if (result.errcode !== 0) {
      console.error("[wechat-notify] send error:", result);
      return false;
    }

    return true;
  } catch (err) {
    console.error("[wechat-notify] error:", err);
    return false;
  }
}

function formatDate(date: Date, timezone?: string | null): string {
  const tz = timezone || "Asia/Singapore";
  return date.toLocaleString("en-SG", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: tz,
    timeZoneName: "short",
  });
}

async function resolveOpenId(userId: string): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { wechatOpenId: true },
  });
  return user?.wechatOpenId || null;
}

// Template IDs are configured in WeChat admin console.
// These are placeholders that need to be replaced with actual template IDs
// after creating templates at mp.weixin.qq.com > Subscribe Messages.
const TEMPLATE_IDS = {
  bookingConfirmed: process.env.WECHAT_TPL_BOOKING_CONFIRMED || "",
  bookingCancelled: process.env.WECHAT_TPL_BOOKING_CANCELLED || "",
  bookingRescheduled: process.env.WECHAT_TPL_BOOKING_RESCHEDULED || "",
  locationUpdated: process.env.WECHAT_TPL_LOCATION_UPDATED || "",
  sessionReminder: process.env.WECHAT_TPL_SESSION_REMINDER || "",
};

export async function notifyWechatBookingConfirmed(params: {
  userId: string;
  expertName: string;
  sessionType: string;
  startTime: Date;
  depositAmount: string;
  timezone?: string | null;
}): Promise<boolean> {
  if (!TEMPLATE_IDS.bookingConfirmed) return false;

  const openid = await resolveOpenId(params.userId);
  if (!openid) return false;

  return sendSubscribeMessage({
    openid,
    templateId: TEMPLATE_IDS.bookingConfirmed,
    page: "pages/dashboard/index",
    data: {
      thing1: { value: `Session with ${params.expertName}` },
      time2: { value: formatDate(params.startTime, params.timezone) },
      thing3: { value: params.sessionType },
      amount4: { value: params.depositAmount },
      thing5: { value: "Confirmed" },
    },
  });
}

export async function notifyWechatBookingCancelled(params: {
  userId: string;
  otherPartyName: string;
  sessionType: string;
  startTime: Date;
  reason?: string;
  timezone?: string | null;
}): Promise<boolean> {
  if (!TEMPLATE_IDS.bookingCancelled) return false;

  const openid = await resolveOpenId(params.userId);
  if (!openid) return false;

  return sendSubscribeMessage({
    openid,
    templateId: TEMPLATE_IDS.bookingCancelled,
    page: "pages/dashboard/index",
    data: {
      thing1: { value: `Session with ${params.otherPartyName}` },
      time2: { value: formatDate(params.startTime, params.timezone) },
      thing3: { value: params.reason || "Cancelled" },
    },
  });
}

export async function notifyWechatBookingRescheduled(params: {
  userId: string;
  otherPartyName: string;
  sessionType: string;
  oldTime: Date;
  newTime: Date;
  timezone?: string | null;
}): Promise<boolean> {
  if (!TEMPLATE_IDS.bookingRescheduled) return false;

  const openid = await resolveOpenId(params.userId);
  if (!openid) return false;

  return sendSubscribeMessage({
    openid,
    templateId: TEMPLATE_IDS.bookingRescheduled,
    page: "pages/dashboard/index",
    data: {
      thing1: { value: `Session with ${params.otherPartyName}` },
      time2: { value: formatDate(params.oldTime, params.timezone) },
      time3: { value: formatDate(params.newTime, params.timezone) },
      thing4: { value: "Rescheduled" },
    },
  });
}

export async function notifyWechatLocationUpdated(params: {
  userId: string;
  otherPartyName: string;
  startTime: Date;
  location: string;
  timezone?: string | null;
}): Promise<boolean> {
  if (!TEMPLATE_IDS.locationUpdated) return false;

  const openid = await resolveOpenId(params.userId);
  if (!openid) return false;

  return sendSubscribeMessage({
    openid,
    templateId: TEMPLATE_IDS.locationUpdated,
    page: "pages/dashboard/index",
    data: {
      thing1: { value: `Session with ${params.otherPartyName}` },
      time2: { value: formatDate(params.startTime, params.timezone) },
      thing3: { value: params.location },
    },
  });
}

export async function notifyWechatSessionReminder(params: {
  userId: string;
  otherPartyName: string;
  sessionType: string;
  startTime: Date;
  timezone?: string | null;
}): Promise<boolean> {
  if (!TEMPLATE_IDS.sessionReminder) return false;

  const openid = await resolveOpenId(params.userId);
  if (!openid) return false;

  return sendSubscribeMessage({
    openid,
    templateId: TEMPLATE_IDS.sessionReminder,
    page: "pages/dashboard/index",
    data: {
      thing1: { value: `Session with ${params.otherPartyName}` },
      time2: { value: formatDate(params.startTime, params.timezone) },
      thing3: { value: params.sessionType },
      thing4: { value: "Starts soon" },
    },
  });
}
