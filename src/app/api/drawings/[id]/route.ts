import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const volumePath = process.env.VOLUME_PATH || path.join(process.cwd(), "public");
    const filePath = path.join(volumePath, "drawings", `${id}.png`);

    if (!fs.existsSync(filePath)) {
      return new NextResponse("그림 파일을 찾을 수 없습니다.", { status: 404 });
    }

    const fileBuffer = fs.readFileSync(filePath);

    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (error: any) {
    console.error("Failed to serve drawing image:", error);
    return new NextResponse("이미지를 전송하는 도중 오류가 발생했습니다.", { status: 500 });
  }
}
