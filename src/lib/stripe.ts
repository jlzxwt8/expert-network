import Stripe from "stripe";

let _stripe: Stripe | null = null;

export function getStripeServer(): Stripe {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
    _stripe = new Stripe(key, {
      timeout: 30_000,
      maxNetworkRetries: 3,
    });
  }
  return _stripe;
}

/**
 * Calculates booking amounts in cents.
 * Duration is rounded up to the nearest hour.
 */
export function calculateBookingAmount(
  pricePerHourCents: number,
  startTime: Date,
  endTime: Date
): { totalCents: number; depositCents: number; remainderCents: number } {
  const durationMs = endTime.getTime() - startTime.getTime();
  const durationHours = Math.max(1, Math.ceil(durationMs / (60 * 60 * 1000)));
  const totalCents = pricePerHourCents * durationHours;
  const depositCents = Math.ceil(totalCents / 2);
  const remainderCents = totalCents - depositCents;
  return { totalCents, depositCents, remainderCents };
}
