import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateExpertProfile, generateProfileImage } from "@/lib/gemini";

export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const expert = await prisma.expert.findUnique({
      where: { userId: session.user.id },
      include: { user: true },
    });

    if (!expert) {
      return NextResponse.json(
        { error: "Expert profile not found. Complete onboarding first." },
        { status: 404 }
      );
    }

    const nickName =
      expert.user.nickName ?? expert.user.name ?? "Expert";

    const generated = await generateExpertProfile({
      linkedIn: expert.linkedIn ?? undefined,
      twitter: expert.twitter ?? undefined,
      substack: expert.substack ?? undefined,
      instagram: expert.instagram ?? undefined,
      tiktok: expert.tiktok ?? undefined,
      xiaohongshu: expert.xiaohongshu ?? undefined,
      domains: expert.domains,
      nickName,
    });

    const bioText = typeof generated.bio === "string"
      ? generated.bio
      : JSON.stringify(generated.bio);

    const profileImage = await generateProfileImage({
      nickName,
      domains: expert.domains,
      bio: bioText,
    });

    await prisma.expert.update({
      where: { id: expert.id },
      data: {
        bio: bioText,
        servicesOffered: generated.services as object,
        avatarScript: generated.videoScript,
        avatarVideoUrl: profileImage,
        onboardingStep: "AI_GENERATION",
      },
    });

    return NextResponse.json({
      bio: bioText,
      services: generated.services,
      videoScript: generated.videoScript,
      profileImage,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[onboarding/generate POST]", message, error);
    return NextResponse.json(
      { error: "Internal server error", detail: message },
      { status: 500 }
    );
  }
}
