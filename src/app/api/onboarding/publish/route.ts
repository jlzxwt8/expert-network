import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { domainStrings } from "@/lib/domains";
import { seedExpertProfile } from "@/lib/integrations/mem9-lifecycle";

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

    const updated = await prisma.expert.update({
      where: { id: expert.id },
      data: {
        isPublished: true,
        onboardingStep: "PUBLISHED",
      },
    });

    // Fire-and-forget: provision mem9 space and seed profile memories
    seedExpertProfile({
      expertId: expert.id,
      nickName: expert.user.nickName ?? expert.user.name ?? "Expert",
      bio: expert.bio ?? "",
      domains: domainStrings(expert.domains),
      services: (expert.servicesOffered as unknown[]) ?? [],
      socialLinks: {
        linkedIn: expert.linkedIn,
        website: expert.website,
        twitter: expert.twitter,
        substack: expert.substack,
        instagram: expert.instagram,
        xiaohongshu: expert.xiaohongshu,
      },
    }).catch(() => {});

    return NextResponse.json(updated);
  } catch (error) {
    console.error("[onboarding/publish POST]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
