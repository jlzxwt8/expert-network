import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getVoiceSynthesis } from "@/lib/integrations/config";
import { resolveUserId } from "@/lib/request-auth";

export async function POST(request: NextRequest) {
  try {
    const userId = await resolveUserId(request);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const voiceSynthesis = await getVoiceSynthesis();
    if (!voiceSynthesis || !voiceSynthesis.cloneVoice) {
      return NextResponse.json(
        { error: "Voice cloning is not configured" },
        { status: 503 }
      );
    }

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

    const formData = await request.formData();
    const audioFile = formData.get("audio");
    if (!audioFile || !(audioFile instanceof Blob)) {
      return NextResponse.json(
        { error: "Missing audio file" },
        { status: 400 }
      );
    }

    const arrayBuf = await audioFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuf);

    if (buffer.length < 1000) {
      return NextResponse.json(
        { error: "Audio file too small — please record at least 10 seconds" },
        { status: 400 }
      );
    }

    const title = `${expert.user.nickName ?? expert.user.name ?? "Expert"} — voice clone`;

    const modelId = await voiceSynthesis.cloneVoice(title, buffer);

    await prisma.expert.update({
      where: { id: expert.id },
      data: { fishAudioModelId: modelId },
    });

    return NextResponse.json({ voiceModelId: modelId });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[expert/voice-clone POST]", message, error);
    return NextResponse.json(
      { error: "Failed to clone voice", detail: message },
      { status: 500 }
    );
  }
}
