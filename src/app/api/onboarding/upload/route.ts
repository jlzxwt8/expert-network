import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ai } from "@/lib/gemini";

async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  const base64 = buffer.toString("base64");

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: [
      {
        role: "user",
        parts: [
          {
            inlineData: {
              mimeType: "application/pdf",
              data: base64,
            },
          },
          {
            text: "Extract all text content from this PDF document. Return ONLY the extracted text, preserving the structure (headings, lists, paragraphs). Do not add any commentary or explanation.",
          },
        ],
      },
    ],
  });

  return response.text ?? "";
}

async function extractTextFromDocx(buffer: Buffer): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mammoth = require("mammoth") as {
    extractRawText: (opts: { buffer: Buffer }) => Promise<{ value: string }>;
  };
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

    const maxSize = 5 * 1024 * 1024;
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
      try {
        text = await extractTextFromPdf(buffer);
      } catch (e) {
        console.warn("[upload] PDF text extraction failed, saving file without text:", e instanceof Error ? e.message : e);
      }
    } else if (fileName.endsWith(".docx")) {
      try {
        text = await extractTextFromDocx(buffer);
      } catch (e) {
        console.warn("[upload] DOCX text extraction failed, saving file without text:", e instanceof Error ? e.message : e);
      }
    } else if (fileName.endsWith(".txt") || fileName.endsWith(".md")) {
      text = buffer.toString("utf-8");
    } else {
      return NextResponse.json(
        {
          error:
            "Unsupported file type. Please upload PDF, DOCX, TXT, or MD.",
        },
        { status: 400 }
      );
    }

    const trimmedText = text.trim().slice(0, 5000);

    const mimeMap: Record<string, string> = {
      ".pdf": "application/pdf",
      ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ".txt": "text/plain",
      ".md": "text/markdown",
    };
    const ext = Object.keys(mimeMap).find((e) => fileName.endsWith(e)) ?? ".txt";
    const mime = mimeMap[ext];
    const base64File = buffer.toString("base64");
    const dataUrl = `data:${mime};base64,${base64File}`;

    let expert = await prisma.expert.findUnique({
      where: { userId: session.user.id },
    });

    const documentFields = {
      documentName: file.name,
      documentData: dataUrl,
    };

    if (!expert) {
      expert = await prisma.expert.create({
        data: {
          userId: session.user.id,
          ...documentFields,
          ...(trimmedText ? { avatarScript: trimmedText } : {}),
        },
      });
    } else {
      const updateData: Record<string, unknown> = { ...documentFields };
      if (trimmedText && !expert.bio) {
        updateData.avatarScript = trimmedText;
      }
      expert = await prisma.expert.update({
        where: { id: expert.id },
        data: updateData,
      });
    }

    return NextResponse.json({
      success: true,
      fileName: file.name,
      textLength: trimmedText.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[onboarding/upload POST]", message, error);
    return NextResponse.json(
      { error: `Failed to process file: ${message}` },
      { status: 500 }
    );
  }
}
