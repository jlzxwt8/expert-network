import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateCustodialWallet } from "@/lib/ton-wallet";
import { resolveUserId } from "@/lib/request-auth";

export async function GET(request: NextRequest) {
  try {
    const userId = await resolveUserId(request);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const expert = await prisma.expert.findUnique({
      where: { userId },
      select: { tonWalletAddress: true, tonWalletType: true },
    });

    if (!expert) {
      return NextResponse.json({ error: "Expert not found" }, { status: 404 });
    }

    return NextResponse.json({
      address: expert.tonWalletAddress,
      type: expert.tonWalletType,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[expert/wallet GET]", message, error);
    return NextResponse.json(
      { error: "Failed to get wallet", detail: message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await resolveUserId(request);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const expert = await prisma.expert.findUnique({ where: { userId } });
    if (!expert) {
      return NextResponse.json({ error: "Expert not found" }, { status: 404 });
    }

    const { action, address } = await request.json();

    if (action === "connect" && address) {
      await prisma.expert.update({
        where: { userId },
        data: {
          tonWalletAddress: address,
          tonWalletType: "tonconnect",
          tonMnemonicEnc: null,
        },
      });

      return NextResponse.json({
        address,
        type: "tonconnect",
      });
    }

    if (action === "auto-create") {
      // Don't overwrite an existing wallet
      if (expert.tonWalletAddress) {
        return NextResponse.json({
          address: expert.tonWalletAddress,
          type: expert.tonWalletType,
        });
      }

      const wallet = await generateCustodialWallet();
      await prisma.expert.update({
        where: { userId },
        data: {
          tonWalletAddress: wallet.address,
          tonWalletType: "custodial",
          tonMnemonicEnc: wallet.encryptedMnemonic,
        },
      });

      return NextResponse.json({
        address: wallet.address,
        type: "custodial",
      });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[expert/wallet POST]", message, error);
    return NextResponse.json(
      { error: "Wallet operation failed", detail: message },
      { status: 500 }
    );
  }
}
