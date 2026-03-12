/**
 * Server-only Telegram initData validation.
 * Do NOT import this from client components — it uses node:crypto.
 */

export interface TelegramUser {
  id: number;
  firstName: string;
  lastName?: string;
  username?: string;
  photoUrl?: string;
  languageCode?: string;
}

/**
 * Validate and parse Telegram initData with full HMAC verification.
 * Throws if signature is invalid or data is expired.
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

/**
 * Parse Telegram initData WITHOUT signature validation.
 * Use only when the initData comes from a trusted path (e.g. the client
 * already authenticated via /api/auth/telegram which did full validation).
 */
export function parseTelegramInitDataUnsafe(rawInitData: string): TelegramUser | null {
  try {
    const params = new URLSearchParams(rawInitData);
    const userJson = params.get("user");
    if (!userJson) return null;

    const user = JSON.parse(userJson);
    if (!user.id) return null;

    return {
      id: Number(user.id),
      firstName: String(user.first_name ?? ""),
      lastName: user.last_name ? String(user.last_name) : undefined,
      username: user.username ? String(user.username) : undefined,
      photoUrl: user.photo_url ? String(user.photo_url) : undefined,
      languageCode: user.language_code ? String(user.language_code) : undefined,
    };
  } catch {
    return null;
  }
}
