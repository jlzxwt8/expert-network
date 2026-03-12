import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { domainStrings } from "@/lib/domains";
import { generateExpertProfile, generateProfileImage } from "@/lib/ai";

export const maxDuration = 60;

export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const expert = await prisma.expert.findUnique({
      where: { userId: session.user.id },
      include: { user: true, domains: true },
    });

    if (!expert) {
      return NextResponse.json(
        { error: "Expert profile not found. Complete onboarding first." },
        { status: 404 }
      );
    }

    const nickName =
      expert.user.nickName ?? expert.user.name ?? "Expert";
    const domains = domainStrings(expert.domains);

    const profileInput = {
      linkedIn: expert.linkedIn ?? undefined,
      website: expert.website ?? undefined,
      twitter: expert.twitter ?? undefined,
      substack: expert.substack ?? undefined,
      instagram: expert.instagram ?? undefined,
      xiaohongshu: expert.xiaohongshu ?? undefined,
      domains,
      nickName,
      resumeText: expert.avatarScript ?? undefined,
    };

    // Run text generation and image generation in parallel
    const [generated, profileImage] = await Promise.all([
      generateExpertProfile(profileInput),
      generateProfileImage({ nickName, domains, bio: domains.join(", ") }),
    ]);

    await prisma.expert.update({
      where: { id: expert.id },
      data: {
        bio: generated.bio,
        servicesOffered: generated.services as object,
        avatarScript: generated.videoScript,
        avatarVideoUrl: profileImage,
        onboardingStep: "AI_GENERATION",
      },
    });

    return NextResponse.json({
      bio: generated.bio,
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
