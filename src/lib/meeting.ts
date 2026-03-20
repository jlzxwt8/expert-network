import crypto from "crypto";

/**
 * Generate a Jitsi Meet link for an online booking session.
 *
 * Uses the public meet.jit.si instance — no API keys, no accounts,
 * no time limits. Both parties join via browser link.
 */
export function generateMeetingLink(): string {
  const slug = crypto.randomBytes(8).toString("hex");
  return `https://meet.jit.si/HelpGrow-${slug}`;
}
