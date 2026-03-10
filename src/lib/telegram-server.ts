/**
 * Server-only Telegram initData validation.
 * Do NOT import this from client components — it uses node:crypto.
 */

interface TelegramUser {
  id: number;
  firstName: string;
  lastName?: string;
  username?: string;
  photoUrl?: string;
  languageCode?: string;
}

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
