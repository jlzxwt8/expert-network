import { type NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { resolveUserId } from "@/lib/request-auth";
import { createAccountLink } from "@/lib/stripe";

/**
 * GET /api/stripe/connect/refresh
 * Generates a fresh Account Link when the previous one expired.
 * Stripe sends the user here when an account link is no longer valid.
 */
export async function GET(request: NextRequest) {
  const origin = process.env.NEXTAUTH_URL || "";

  try {
    const userId = await resolveUserId(request);
    if (!userId) {
      return NextResponse.redirect(`${origin}/auth/signin`);
    }

    const expert = await prisma.expert.findUnique({
      where: { userId },
      select: { stripeAccountId: true },
    });

    if (!expert?.stripeAccountId) {
      return NextResponse.redirect(`${origin}/profile?stripe_connect=no_account`);
    }

    const accountLink = await createAccountLink({
      account: expert.stripeAccountId,
      refresh_url: `${origin}/api/stripe/connect/refresh`,
      return_url: `${origin}/api/stripe/connect/callback`,
    });

    return NextResponse.redirect(accountLink.url);
  } catch (error) {
    console.error("[stripe/connect/refresh]", error);
    return NextResponse.redirect(`${origin}/profile?stripe_connect=error`);
  }
}
