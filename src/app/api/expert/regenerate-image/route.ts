import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { domainStrings } from "@/lib/domains";
import { generateProfileImage } from "@/lib/ai";

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
      return NextResponse.json({ error: "Expert profile not found" }, { status: 404 });
    }

    const nickName = expert.user.nickName ?? expert.user.name ?? "Expert";

    const profileImage = await generateProfileImage({
      nickName,
      domains: domainStrings(expert.domains),
      bio: expert.bio ?? "",
      gender: expert.gender ?? undefined,
    });

    if (!profileImage) {
      return NextResponse.json({ error: "Failed to generate image" }, { status: 500 });
    }

    await prisma.expert.update({
      where: { id: expert.id },
      data: { avatarVideoUrl: profileImage },
    });

    return NextResponse.json({ profileImage });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[expert/regenerate-image POST]", message, error);
    return NextResponse.json({ error: "Failed to regenerate image", detail: message }, { status: 500 });
  }
}
