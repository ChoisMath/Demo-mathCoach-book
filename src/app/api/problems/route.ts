import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const DEFAULT_PROBLEMS = [
  {
    title: "이차함수의 최대·최소",
    content: "이차함수 $f(x) = x^2 - 4x + 3$의 $0 \\le x \\le 3$에서의 최댓값과 최솟값을 구하고 그 과정을 서술하시오."
  },
  {
    title: "등차수열의 일반항",
    content: "수열 $a_n$의 첫째항부터 제$n$항까지의 합이 $S_n = n^2 + 2n$일 때, 일반항 $a_n$을 구하고 그 과정을 서술하시오."
  },
  {
    title: "삼각방정식 해의 개수",
    content: "구간 $[0, 2\\pi]$에서 방정식 $\\sin^2(x) - \\cos(x) - 1 = 0$의 모든 실근의 합을 구하고 그 과정을 서술하시오."
  }
];

export async function GET() {
  try {
    let dbProblems = await prisma.problem.findMany({
      orderBy: { createdAt: "asc" }
    });

    // Seed default problems if database is empty
    if (dbProblems.length === 0) {
      await prisma.problem.createMany({
        data: DEFAULT_PROBLEMS
      });
      dbProblems = await prisma.problem.findMany({
        orderBy: { createdAt: "asc" }
      });
    }

    // Append the "custom" option for UI consistency
    const result = [
      ...dbProblems,
      {
        id: "custom",
        title: "직접 문제 입력",
        content: ""
      }
    ];

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Failed to fetch problems:", error);
    return NextResponse.json(
      { error: "문제를 불러오지 못했습니다.", details: error.message },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const list = await request.json();
    if (!Array.isArray(list)) {
      return NextResponse.json(
        { error: "올바르지 않은 문제 목록 형식입니다." },
        { status: 400 }
      );
    }

    // Filter out the 'custom' UI option as it should not be stored in DB
    const problemsToSave = list.filter((p: any) => p.id !== "custom" && p.title.trim() !== "");

    // Bulk update by deleting and re-creating
    await prisma.$transaction([
      prisma.problem.deleteMany(),
      prisma.problem.createMany({
        data: problemsToSave.map((p: any) => ({
          title: p.title,
          content: p.content
        }))
      })
    ]);

    const updatedList = await prisma.problem.findMany({
      orderBy: { createdAt: "asc" }
    });

    const result = [
      ...updatedList,
      {
        id: "custom",
        title: "직접 문제 입력",
        content: ""
      }
    ];

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Failed to update problems:", error);
    return NextResponse.json(
      { error: "문제를 업데이트하지 못했습니다.", details: error.message },
      { status: 500 }
    );
  }
}
