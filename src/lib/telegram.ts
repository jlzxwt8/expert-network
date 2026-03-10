/**
 * Telegram Mini App utilities.
 *
 * Client-side: environment detection
 * Server-side: initData validation
 */

// ---------------------------------------------------------------------------
// Client-side helpers (safe to import in "use client" components)
// ---------------------------------------------------------------------------

/**
 * Returns true when the app is running inside a Telegram Mini App WebView.
 * Safe to call during SSR (returns false).
 */
export function isTelegramMiniApp(): boolean {
  if (typeof window === "undefined") return false;
  // Telegram WebView injects `window.Telegram.WebApp`
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return !!(window as any).Telegram?.WebApp?.initData;
}

// ---------------------------------------------------------------------------
// Server-side helpers
// ---------------------------------------------------------------------------

interface TelegramUser {
  id: number;
  firstName: string;
  lastName?: string;
  username?: string;
  photoUrl?: string;
  languageCode?: string;
}

/**
 * Validate and parse Telegram initData on the server.
 * Throws on invalid / expired data.
 */
export async function validateAndParseTelegramInitData(
  rawInitData: string,
  botToken: string
): Promise<TelegramUser> {
  const { validate, parse } = await import("@telegram-apps/init-data-node");

  validate(rawInitData, botToken, { expiresIn: 86400 });

  const parsed = parse(rawInitData);
  const user = parsed.user;
  if (!user) throw new Error("No user in Telegram initData");

  return {
    id: user.id,
    firstName: String(user.firstName ?? ""),
    lastName: user.lastName ? String(user.lastName) : undefined,
    username: user.username ? String(user.username) : undefined,
    photoUrl: user.photoUrl ? String(user.photoUrl) : undefined,
    languageCode: user.languageCode ? String(user.languageCode) : undefined,
  };
}
