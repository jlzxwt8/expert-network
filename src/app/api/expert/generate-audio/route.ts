import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getVoiceSynthesis } from "@/lib/integrations/config";

export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const voiceSynthesis = await getVoiceSynthesis();
    if (!voiceSynthesis) {
      return NextResponse.json(
        { error: "Voice synthesis is not configured" },
        { status: 503 }
      );
    }

    const expert = await prisma.expert.findUnique({
      where: { userId: session.user.id },
      include: { user: true },
    });

    if (!expert) {
      return NextResponse.json(
        { error: "Expert profile not found" },
        { status: 404 }
      );
    }

    const script = expert.avatarScript;
    if (!script) {
      return NextResponse.json(
        { error: "No introduction script found. Generate your profile first." },
        { status: 400 }
      );
    }

    const result = await voiceSynthesis.synthesize({
      text: script,
      format: "mp3",
      speed: 1.0,
    });

    const dataUrl = `data:audio/mp3;base64,${result.audioBase64}`;

    await prisma.expert.update({
      where: { id: expert.id },
      data: { audioIntroUrl: dataUrl },
    });

    return NextResponse.json({ audioIntroUrl: dataUrl });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[expert/generate-audio POST]", message, error);
    return NextResponse.json(
      { error: "Failed to generate audio intro", detail: message },
      { status: 500 }
    );
  }
}
