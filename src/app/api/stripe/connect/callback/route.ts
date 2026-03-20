import { type NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { resolveUserId } from "@/lib/request-auth";
import { retrieveAccount, getAccountStatus } from "@/lib/stripe";

/**
 * GET /api/stripe/connect/callback
 * Stripe redirects here after the expert completes (or exits) the KYC flow.
 * Syncs account status and redirects to the appropriate page.
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

    if (expert?.stripeAccountId) {
      const account = await retrieveAccount(expert.stripeAccountId);
      const status = getAccountStatus(account);

      await prisma.expert.update({
        where: { userId },
        data: { stripeAccountStatus: status },
      });
    }

    const returnTo = request.nextUrl.searchParams.get("return") || "/profile";
    return NextResponse.redirect(`${origin}${returnTo}?stripe_connect=complete`);
  } catch (error) {
    console.error("[stripe/connect/callback]", error);
    return NextResponse.redirect(`${origin}/profile?stripe_connect=error`);
  }
}
