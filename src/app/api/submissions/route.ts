import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

// Helper to get drawings directory path on persistent volume
function getDrawingsDirectory() {
  const volumePath = process.env.VOLUME_PATH || path.join(process.cwd(), "public");
  const drawingsDir = path.join(volumePath, "drawings");
  if (!fs.existsSync(drawingsDir)) {
    fs.mkdirSync(drawingsDir, { recursive: true });
  }
  return drawingsDir;
}

export async function GET() {
  try {
    const submissions = await prisma.submission.findMany({
      orderBy: { createdAt: "desc" }
    });

    // Map database flat schema back to the nested studentInfo structure expected by the frontend
    const mapped = submissions.map((sub) => ({
      id: sub.id,
      timestamp: sub.timestamp,
      studentInfo: {
        className: sub.className,
        number: sub.number,
        name: sub.name
      },
      problem: sub.problem,
      studentExplanation: sub.studentExplanation,
      studentSolutionImage: sub.studentSolutionImage,
      isSolved: sub.isSolved,
      coachResponses: sub.coachResponses,
      comparisonLogs: sub.comparisonLogs,
      finalReflection: sub.finalReflection
    }));

    return NextResponse.json(mapped);
  } catch (error: any) {
    console.error("Failed to fetch submissions:", error);
    return NextResponse.json(
      { error: "제출 기록을 불러오지 못했습니다.", details: error.message },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      studentInfo,
      problem,
      studentSolutionImage, // base64 representation
      studentExplanation,
      isSolved,
      coachResponses = {},
      comparisonLogs = {},
      finalReflection
    } = body;

    if (!studentInfo || !studentInfo.name || !problem) {
      return NextResponse.json(
        { error: "필수 데이터(학생 정보, 문제)가 누락되었습니다." },
        { status: 400 }
      );
    }

    // 1. Create a database record first to generate id
    const newSubmission = await prisma.submission.create({
      data: {
        timestamp: new Date().toLocaleString("ko-KR"),
        className: studentInfo.className,
        number: studentInfo.number,
        name: studentInfo.name,
        problem: problem,
        studentExplanation: studentExplanation || "",
        studentSolutionImage: "", // Will update shortly
        isSolved: !!isSolved,
        coachResponses: coachResponses,
        comparisonLogs: comparisonLogs,
        finalReflection: finalReflection || ""
      }
    });

    const submissionId = newSubmission.id;
    let finalImageUrl = "";

    // 2. Save base64 image data to Railway Volume as PNG file if present
    if (studentSolutionImage && studentSolutionImage.startsWith("data:image/")) {
      const commaIndex = studentSolutionImage.indexOf(",");
      if (commaIndex !== -1) {
        const base64Data = studentSolutionImage.substring(commaIndex + 1);
        const drawingsDir = getDrawingsDirectory();
        const filePath = path.join(drawingsDir, `${submissionId}.png`);
        
        console.log(`[Submissions API] Writing drawing to path: ${filePath}`);
        fs.writeFileSync(filePath, base64Data, "base64");
        console.log(`[Submissions API] Successfully wrote drawing file. Size: ${fs.statSync(filePath).size} bytes`);
        
        finalImageUrl = `/api/drawings/${submissionId}`;
      }
    } else {
      console.log("[Submissions API] No valid base64 image provided in request.");
    }

    // 3. Update database record with served URL to the PNG drawing
    const updatedSubmission = await prisma.submission.update({
      where: { id: submissionId },
      data: {
        studentSolutionImage: finalImageUrl
      }
    });

    return NextResponse.json(updatedSubmission);
  } catch (error: any) {
    console.error("Failed to create submission:", error);
    return NextResponse.json(
      { error: "제출 기록을 저장하지 못했습니다.", details: error.message },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    const drawingsDir = getDrawingsDirectory();

    if (id) {
      // Delete single submission
      const submission = await prisma.submission.findUnique({
        where: { id }
      });

      if (!submission) {
        return NextResponse.json(
          { error: "존재하지 않는 제출 기록입니다." },
          { status: 404 }
        );
      }

      // Delete database record
      await prisma.submission.delete({
        where: { id }
      });

      // Delete image file if exists in volume
      const filePath = path.join(drawingsDir, `${id}.png`);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }

      return NextResponse.json({ success: true, deletedId: id });
    } else {
      // Delete all submissions (Clear All)
      const allSubmissions = await prisma.submission.findMany();
      
      await prisma.submission.deleteMany();

      // Clean up drawings files inside the directory
      allSubmissions.forEach((sub) => {
        const filePath = path.join(drawingsDir, `${sub.id}.png`);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      });

      return NextResponse.json({ success: true });
    }
  } catch (error: any) {
    console.error("Failed to delete submission(s):", error);
    return NextResponse.json(
      { error: "삭제를 처리하는 도중 오류가 발생했습니다.", details: error.message },
      { status: 500 }
    );
  }
}
