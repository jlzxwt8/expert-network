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

/**
 * Returns raw Telegram initData when inside Mini App; otherwise null.
 */
export function getTelegramInitData(): string | null {
  if (typeof window === "undefined") return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const webApp = (window as any).Telegram?.WebApp;
  if (!webApp || typeof webApp.initData !== "string" || webApp.initData.length === 0) {
    return null;
  }
  return webApp.initData;
}

/**
 * Open an external URL safely from a Mini App.
 * In Telegram: uses WebApp.openLink() to open in external browser.
 * In web: uses window.open().
 */
export function openExternalUrl(url: string) {
  if (isTelegramMiniApp()) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).Telegram?.WebApp?.openLink?.(url);
  } else {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}
