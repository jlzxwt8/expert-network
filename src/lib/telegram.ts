/**
 * Telegram Mini App — client-safe utilities only.
 * Server-side validation lives in telegram-server.ts to avoid pulling
 * node:crypto into client bundles.
 */

/**
 * Returns true when the app is running inside a Telegram Mini App WebView.
 * Only trusts `initData` — it's the sole field guaranteed to be non-empty
 * exclusively inside a real Mini App. The SDK's `platform` is set even in
 * regular browsers and must NOT be used as a signal.
 * Safe to call during SSR (returns false).
 */
export function isTelegramMiniApp(): boolean {
  if (typeof window === "undefined") return false;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const webApp = (window as any).Telegram?.WebApp;
  if (!webApp) return false;
  return typeof webApp.initData === "string" && webApp.initData.length > 0;
}
