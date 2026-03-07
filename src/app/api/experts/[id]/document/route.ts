import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // #region agent log
    console.log('[DEBUG-ce5563] Document download start', JSON.stringify({id}));
    // #endregion

    const expert = await prisma.expert.findUnique({
      where: { id },
      select: { documentName: true, documentData: true },
    });

    // #region agent log
    console.log('[DEBUG-ce5563] Document download DB result', JSON.stringify({hasExpert:!!expert,documentName:expert?.documentName,hasDocData:!!expert?.documentData,docDataLen:expert?.documentData?.length??0}));
    // #endregion

    if (!expert?.documentData || !expert.documentName) {
      return NextResponse.json(
        { error: "No document available" },
        { status: 404 }
      );
    }

    const match = expert.documentData.match(
      /^data:([^;]+);base64,(.+)$/s
    );

    // #region agent log
    console.log('[DEBUG-ce5563] Document download regex', JSON.stringify({matched:!!match,contentType:match?.[1]??null,base64Len:match?.[2]?.length??0}));
    // #endregion

    if (!match) {
      return NextResponse.json(
        { error: "Invalid document data" },
        { status: 500 }
      );
    }

    const [, contentType, base64Data] = match;
    const buffer = Buffer.from(base64Data, "base64");

    const safeFilename = expert.documentName.replace(/[^\w\s.\-()]/g, '_');
    const encodedFilename = encodeURIComponent(expert.documentName);

    // #region agent log
    console.log('[DEBUG-ce5563] Document download response', JSON.stringify({contentType,bufferLen:buffer.length,safeFilename,encodedFilename}));
    // #endregion

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${safeFilename}"; filename*=UTF-8''${encodedFilename}`,
        "Content-Length": String(buffer.length),
      },
    });
  } catch (error) {
    // #region agent log
    console.error('[DEBUG-ce5563] Document download ERROR', error instanceof Error ? error.message : String(error));
    // #endregion
    console.error("[expert document GET]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
