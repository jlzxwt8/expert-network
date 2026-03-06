import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  const pdfParse = (await import("pdf-parse")).default;
  const result = await pdfParse(buffer);
  return result.text;
}

async function extractTextFromDocx(buffer: Buffer): Promise<string> {
  const mammoth = await import("mammoth");
  const result = await mammoth.extractRawText({ buffer });
  return result.value;
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: "File too large. Maximum 5MB." },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const fileName = file.name.toLowerCase();
    let text = "";

    if (fileName.endsWith(".pdf")) {
      text = await extractTextFromPdf(buffer);
    } else if (fileName.endsWith(".docx")) {
      text = await extractTextFromDocx(buffer);
    } else if (fileName.endsWith(".txt") || fileName.endsWith(".md")) {
      text = buffer.toString("utf-8");
    } else {
      return NextResponse.json(
        { error: "Unsupported file type. Please upload PDF, DOCX, TXT, or MD." },
        { status: 400 }
      );
    }

    const trimmedText = text.trim().slice(0, 5000);

    if (!trimmedText) {
      return NextResponse.json(
        { error: "Could not extract text from file." },
        { status: 400 }
      );
    }

    let expert = await prisma.expert.findUnique({
      where: { userId: session.user.id },
    });

    if (!expert) {
      expert = await prisma.expert.create({
        data: {
          userId: session.user.id,
          avatarScript: trimmedText,
        },
      });
    } else {
      expert = await prisma.expert.update({
        where: { id: expert.id },
        data: { avatarScript: trimmedText },
      });
    }

    return NextResponse.json({
      success: true,
      fileName: file.name,
      textLength: trimmedText.length,
    });
  } catch (error) {
    console.error("[onboarding/upload POST]", error);
    return NextResponse.json(
      { error: "Failed to process file" },
      { status: 500 }
    );
  }
}
