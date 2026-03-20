import { type NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { resolveUserId } from "@/lib/request-auth";
import {
  createConnectedAccount,
  createAccountLink,
  retrieveAccount,
  getAccountStatus,
} from "@/lib/stripe";

/**
 * POST /api/stripe/connect
 * Creates a Stripe Connected Account for the expert (if not yet created)
 * and returns an Account Link URL for KYC onboarding.
 */
export async function POST(request: NextRequest) {
  let step = "init";
  try {
    step = "auth";
    const userId = await resolveUserId(request);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    step = "find-expert";
    const expert = await prisma.expert.findUnique({
      where: { userId },
      include: { user: true },
    });

    if (!expert) {
      return NextResponse.json(
        { error: "Expert profile not found" },
        { status: 404 }
      );
    }

    const origin =
      request.headers.get("origin") || process.env.NEXTAUTH_URL || "";

    let stripeAccountId = expert.stripeAccountId;

    if (!stripeAccountId) {
      step = "create-account";
      const account = await createConnectedAccount({
        email: expert.user.email ?? undefined,
        country: "SG",
        metadata: {
          expertId: expert.id,
          userId: expert.userId,
        },
      });
      stripeAccountId = account.id;

      step = "save-account-id";
      await prisma.expert.update({
        where: { id: expert.id },
        data: {
          stripeAccountId: account.id,
          stripeAccountStatus: "onboarding",
        },
      });
    }

    step = "create-account-link";
    const accountLink = await createAccountLink({
      account: stripeAccountId,
      refresh_url: `${origin}/api/stripe/connect/refresh?from=onboarding`,
      return_url: `${origin}/api/stripe/connect/callback`,
    });

    return NextResponse.json({
      url: accountLink.url,
      accountId: stripeAccountId,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[stripe/connect POST] step=${step}`, message, error);
    return NextResponse.json(
      { error: "Failed to create Stripe account", detail: `[${step}] ${message}` },
      { status: 500 }
    );
  }
}

/**
 * GET /api/stripe/connect
 * Returns the current Stripe Connect status for the expert.
 */
export async function GET(request: NextRequest) {
  try {
    const userId = await resolveUserId(request);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const expert = await prisma.expert.findUnique({
      where: { userId },
      select: {
        stripeAccountId: true,
        stripeAccountStatus: true,
      },
    });

    if (!expert) {
      return NextResponse.json(
        { error: "Expert profile not found" },
        { status: 404 }
      );
    }

    if (!expert.stripeAccountId) {
      return NextResponse.json({
        status: "none",
        chargesEnabled: false,
        payoutsEnabled: false,
        detailsSubmitted: false,
      });
    }

    try {
      const account = await retrieveAccount(expert.stripeAccountId);
      const status = getAccountStatus(account);

      if (status !== expert.stripeAccountStatus) {
        await prisma.expert.update({
          where: { userId },
          data: { stripeAccountStatus: status },
        });
      }

      return NextResponse.json({
        status,
        chargesEnabled: account.charges_enabled,
        payoutsEnabled: account.payouts_enabled,
        detailsSubmitted: account.details_submitted,
        requirements: account.requirements,
      });
    } catch {
      return NextResponse.json({
        status: expert.stripeAccountStatus || "none",
        chargesEnabled: false,
        payoutsEnabled: false,
        detailsSubmitted: false,
      });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[stripe/connect GET]", message);
    return NextResponse.json(
      { error: "Failed to check account status" },
      { status: 500 }
    );
  }
}
