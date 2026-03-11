/**
 * Stripe integration via direct REST API calls.
 *
 * The official Stripe Node SDK consistently fails with connection errors
 * in Vercel's serverless environment (tested on both Node 20 and 24).
 * Direct fetch to api.stripe.com works reliably, so we use Stripe's
 * well-documented REST API directly.
 *
 * Reference: https://docs.stripe.com/api
 */

const STRIPE_API = "https://api.stripe.com/v1";

function getKey(): string {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
  return key;
}

async function stripeRequest<T = Record<string, unknown>>(
  method: string,
  path: string,
  body?: Record<string, unknown>
): Promise<T> {
  const res = await fetch(`${STRIPE_API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${getKey()}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body ? encodeBody(body) : undefined,
  });

  const data = await res.json();
  if (!res.ok) {
    const msg = data?.error?.message || `Stripe API error (${res.status})`;
    throw new Error(msg);
  }
  return data as T;
}

/**
 * Encodes a nested object into Stripe's form-encoded format.
 * e.g. { line_items: [{ price_data: { currency: "sgd" } }] }
 * becomes "line_items[0][price_data][currency]=sgd"
 */
function encodeBody(obj: Record<string, unknown>, prefix = ""): string {
  const parts: string[] = [];

  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}[${key}]` : key;
    if (value === null || value === undefined) continue;

    if (Array.isArray(value)) {
      value.forEach((item, i) => {
        if (typeof item === "object" && item !== null) {
          parts.push(encodeBody(item as Record<string, unknown>, `${fullKey}[${i}]`));
        } else {
          parts.push(`${encodeURIComponent(`${fullKey}[${i}]`)}=${encodeURIComponent(String(item))}`);
        }
      });
    } else if (typeof value === "object") {
      parts.push(encodeBody(value as Record<string, unknown>, fullKey));
    } else {
      parts.push(`${encodeURIComponent(fullKey)}=${encodeURIComponent(String(value))}`);
    }
  }

  return parts.filter(Boolean).join("&");
}

// ---- Checkout Sessions ----

interface CheckoutSession {
  id: string;
  url: string | null;
  payment_intent?: string;
  metadata?: Record<string, string>;
}

export async function createCheckoutSession(params: {
  mode: string;
  payment_method_types: string[];
  line_items: {
    price_data: {
      currency: string;
      unit_amount: number;
      product_data: { name: string; description?: string };
    };
    quantity: number;
  }[];
  payment_intent_data?: Record<string, unknown>;
  metadata?: Record<string, string>;
  success_url: string;
  cancel_url: string;
}): Promise<CheckoutSession> {
  return stripeRequest<CheckoutSession>("POST", "/checkout/sessions", params);
}

// ---- Payment Intents ----

interface PaymentIntent {
  id: string;
  status: string;
  payment_method?: string;
  customer?: string;
  metadata?: Record<string, string>;
}

export async function retrievePaymentIntent(id: string): Promise<PaymentIntent> {
  return stripeRequest<PaymentIntent>("GET", `/payment_intents/${id}`);
}

export async function createPaymentIntent(params: {
  amount: number;
  currency: string;
  customer: string;
  payment_method: string;
  off_session: boolean;
  confirm: boolean;
  metadata?: Record<string, string>;
}): Promise<PaymentIntent> {
  return stripeRequest<PaymentIntent>("POST", "/payment_intents", params);
}

// ---- Balance (for diagnostics) ----

export async function retrieveBalance(): Promise<Record<string, unknown>> {
  return stripeRequest("GET", "/balance");
}

// ---- Webhook Signature Verification ----

export async function verifyWebhookSignature(
  payload: string,
  sigHeader: string,
  secret: string
): Promise<Record<string, unknown>> {
  const parts = sigHeader.split(",").reduce(
    (acc, part) => {
      const [k, v] = part.split("=");
      if (k === "t") acc.timestamp = v;
      if (k === "v1") acc.signatures.push(v);
      return acc;
    },
    { timestamp: "", signatures: [] as string[] }
  );

  if (!parts.timestamp || parts.signatures.length === 0) {
    throw new Error("Invalid Stripe signature header");
  }

  const signedPayload = `${parts.timestamp}.${payload}`;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(signedPayload));
  const expected = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  const valid = parts.signatures.some((s) => s === expected);
  if (!valid) throw new Error("Invalid signature");

  const tolerance = 300;
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - parseInt(parts.timestamp, 10)) > tolerance) {
    throw new Error("Webhook timestamp too old");
  }

  return JSON.parse(payload);
}

// ---- Booking Amount Calculation ----

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
