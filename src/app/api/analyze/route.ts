import { NextResponse } from "next/server";
import { GoogleGenAI, Type } from "@google/genai";

export const dynamic = "force-dynamic";

// Gemini API Structured Output JSON Schema 정의
const analysisSchema = {
  type: Type.OBJECT,
  properties: {
    coachFrequency: {
      type: Type.STRING,
      description: "코치 호출 순서 분석 (패턴의 수학적 의미를 포함하는 3~4문장의 단락)",
    },
    stuckStages: {
      type: Type.STRING,
      description: "학생들이 자주 막힌 단계 분석 (공식, 시각화, 정당화 중 짚는 3~4문장의 단락)",
    },
    misconceptions: {
      type: Type.STRING,
      description: "반복적인 오개념 및 오류 설명 (교사용 학술 언어를 쓰는 3~4문장의 단락)",
    },
    focusStudents: {
      type: Type.STRING,
      description: "내일 도입에서 짚어줄 학생 2~3명의 가명과 지도 방법 요약 (3~4문장의 단락)",
    },
  },
  required: ["coachFrequency", "stuckStages", "misconceptions", "focusStudents"],
};

export async function POST(request: Request) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "GEMINI_API_KEY가 .env.local 파일에 설정되어 있지 않습니다." },
        { status: 500 }
      );
    }

    const { submissions } = await request.json();
    if (!submissions || !Array.isArray(submissions) || submissions.length === 0) {
      return NextResponse.json(
        { error: "분석할 학생 제출 데이터가 없거나 올바르지 않습니다." },
        { status: 400 }
      );
    }

    // 1. 개인정보 마스킹 (실명 -> 가명 치환 및 경량화)
    const nameMap = new Map<string, string>();
    let nameIndex = 1;

    const maskedSubmissions = submissions.map((sub: any) => {
      const rawName = sub.studentInfo?.name || "무명";
      if (!nameMap.has(rawName)) {
        nameMap.set(rawName, `학생 ${nameIndex++}`);
      }
      const maskedName = nameMap.get(rawName);

      // 이미지 데이터 등 무겁고 무관한 데이터는 필터링하여 최소 정보만 전송
      return {
        studentInfo: {
          className: sub.studentInfo?.className || "",
          number: sub.studentInfo?.number || "",
          name: maskedName,
        },
        problem: sub.problem || "",
        studentExplanation: sub.studentExplanation || "",
        coachResponses: sub.coachResponses || {},
        comparisonLogs: sub.comparisonLogs || {},
        finalReflection: sub.finalReflection || "",
      };
    });

    // 2. Gemini 클라이언트 및 시스템 명령어 설정
    const ai = new GoogleGenAI({ apiKey });
    const systemInstruction = `당신은 고등학교 수학 수업을 마친 교사 옆에서 학생 기록을 함께 들여다보는 조력자입니다. 
입력으로 전달되는 학생들의 학습 성찰 및 제출 기록 JSON 데이터(이름은 가명 처리됨)를 면밀히 분석한 후, 
다음 네 가지 기준에 맞춰 분석 결과를 작성해 주십시오.

각 항목은 교사가 내일 수업 도입용 5분 설명 자료로 즉시 복사하여 읽거나 판서할 수 있도록, 
구체적이고 자연스러운 한 단락 분량의 문장(약 3~4문장 내외)으로 작성해야 합니다.

1. coachFrequency (코치 호출 순서): 학생들이 어떤 코치(대수, 기하, 논증)를 가장 먼저, 가장 자주 호출했는지 그 패턴과 대다수 학생이 취한 문제해결 접근법의 수학적 의미를 한 문장으로 짚어 분석해 주세요.
2. stuckStages (멈춘 단계): 학생들이 풀이 과정의 어떤 단계에서 가장 자주 막혔거나 멈추었는지(예: 수식 설계, 기하학적 시각화 부족, 논증적 정당화 오류 등)를 정리해 주세요.
3. misconceptions (반복되는 오개념): 학생들이 작성한 비교 기록과 설명에서 공통적으로 노출한 오개념이나 수학적 오류를 한두 가지 교사용 학술적 언어로 알기 쉽게 정리해 주세요.
4. focusStudents (내일 다시 다룰 학생): 다음 차시 도입에서 교사가 한 번 더 피드백해 주면 전체 학습 효과가 높아질 구체적인 대상 학생 2~3명을 번호 또는 가명으로 선정하고, 각 학생에 대해 어떤 수학적 포인트를 짚어주면 좋을지 한 문장씩 적어 주세요.

[제한사항]
- 채점 결과나 정답은 절대 작성하지 마십시오.
- 오직 학생들의 수학적 사고의 진행 상태, 오개념, 그리고 내일 수업 도입 설계에 유용한 인사이트 제공에만 전념하십시오.
- 반드시 한국어로 자연스럽고 정중한 말투를 사용해 작성하십시오.`;

    const contentPrompt = `아래의 학생 제출 JSON 데이터를 분석하여 응답 스키마에 맞는 JSON 결과를 생성하십시오.\n\n${JSON.stringify(maskedSubmissions, null, 2)}`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: contentPrompt,
      config: {
        systemInstruction,
        temperature: 0.2,
        responseMimeType: "application/json",
        responseSchema: analysisSchema,
      },
    });

    const responseText = response.text || "{}";
    const parsedData = JSON.parse(responseText);

    return NextResponse.json(parsedData);

  } catch (error: any) {
    console.error("Analysis API Error:", error);
    return NextResponse.json(
      { error: "Gemini 분석 처리 중 오류가 발생했습니다.", details: error.message },
      { status: 500 }
    );
  }
}
