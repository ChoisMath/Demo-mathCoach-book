import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { coaches } from "@/lib/coaches";

// Ensure this route is dynamic and not cached
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        {
          error: "GEMINI_API_KEY가 .env.local 파일에 설정되어 있지 않습니다.",
        },
        { status: 500 }
      );
    }

    const {
      studentInfo,
      problem,
      studentSolutionImage, // Base64 data url from the canvas drawing pad
      studentExplanation,
      coachId,
      isSolved,
      chatHistory = [],
    } = await request.json();

    const coach = coaches.find((c) => c.id === coachId);
    if (!coach) {
      return NextResponse.json(
        { error: "존재하지 않는 코치 ID입니다." },
        { status: 400 }
      );
    }

    // Initialize Gemini Client
    const ai = new GoogleGenAI({ apiKey });

    // Fallback system prompts if the user hasn't filled systemPrompt in coaches.ts yet.
    let activeSystemPrompt = coach.systemPrompt;
    if (!activeSystemPrompt) {
      activeSystemPrompt = `당신은 고등학교 수학 수업에서 사용하는 [${coach.name}]입니다.
코칭 목표: ${coach.description}

[코칭 핵심 원칙]
1. 정답을 절대 한 줄로 바로 제시하지 마십시오.
2. 학생이 업로드한 이미지(손글씨 풀이, 수식, 그래프, 도형)와 풀이 의도 텍스트를 면밀히 판독하고 분석하여, 학생이 어떤 수학적 의도를 담고 있는지 관점을 먼저 설명해 주십시오. (OCR 판독 결과를 자연스럽게 설명에 녹여주세요)
3. 현재 학생이 풀이를 완수하지 못했거나(isSolved가 거짓일 때), 풀이에 오개념이 있다면 해당 오개념이나 모르고 있는 부분을 스스로 생각하고 해결해 나갈 수 있도록 힌트(Scaffolding)만 간단하게 제시하십시오.
4. 절대로 다른 코치의 풀이 영역(예: 대수 코치가 기하 그래프를 그리라고 하거나, 기하 코치가 엄밀한 논리 증명 단계를 요구하는 등)으로 넘어가는 사고를 하도록 코칭하지 마십시오.
5. 학생이 해결하는 방식(원래의 방식)을 지지하며 그 방식 안에서 정답을 구하도록 돕습니다.
6. 학생이 정답을 최종적으로 구하고 나면(isSolved가 참일 때), 그제서야 당신의 전공 관점(대수, 기하, 논증)에서 이 문제를 다르게 풀이할 수 있는 새로운 접근 방식을 상세히 소개하십시오. 다른 관점을 유도하되 자기 자신의 영역을 넘어선 풀이를 지도하지 마십시오.
7. 답변을 작성할 때 수학 공식은 LaTeX 문법을 사용해 주십시오. (예: $x^2 + 2x + 1 = 0$, 블록 공식은 $$f(x) = ax^2 + bx + c$$)
8. 만약 당신이 '기하·시각화 코치'이고 다른 기하학적 풀이를 보여준다면, 설명과 함께 학생이 시각적으로 이해할 수 있는 아름답고 세련된 SVG 코드도 함께 출력해 주십시오. SVG 코드는 반드시 \`\`\`xml ... \`\`\` 또는 \`\`\`svg ... \`\`\` 코드 블록 내에만 담아 주십시오. SVG 내부에는 격자선, 좌표축, 그래프 선, 텍스트 레이블 등을 눈에 잘 띄는 색상(예: 파란색 #2563eb, 주황색 #f97316, 다크그레이 등)으로 아름답게 그려주십시오.`;
    }

    // Process image if present
    let imagePart = null;
    if (studentSolutionImage && studentSolutionImage.startsWith("data:image/")) {
      const commaIndex = studentSolutionImage.indexOf(",");
      if (commaIndex !== -1) {
        const mimeType = studentSolutionImage.substring(5, studentSolutionImage.indexOf(";")); // e.g. "image/png"
        const base64Data = studentSolutionImage.substring(commaIndex + 1);
        imagePart = {
          inlineData: {
            mimeType: mimeType,
            data: base64Data,
          }
        };
      }
    }

    // Format the context about the student and task
    const contextPrompt = `
[학습 컨텍스트]
- 학생 정보: 학급명 - ${studentInfo.className}, 번호 - ${studentInfo.number}번, 이름 - ${studentInfo.name}
- 현재 해결하려는 문제:
${problem}

- 학생의 풀이 의도 설명:
${studentExplanation || "(아직 입력하지 않음)"}

- 학생의 해결 여부: ${isSolved ? "이미 스스로 정답을 완벽히 구했음 (다른 풀이 관점 제시 필요 단계)" : "아직 해결하는 중임 (비계 및 힌트 단계)"}

[안내]
- 학생은 풀이 과정 전체를 손글씨 필기 패드에 직접 작성(수식, 그래프, 기하 도형, 히스토그램 포함)하여 이미지로 전달했습니다.
- 전달된 이미지를 정확히 관찰하여 학생의 풀이 단계와 오개념 유무를 파악하십시오.
`;

    // Construct request contents
    const userParts: any[] = [
      { text: contextPrompt }
    ];

    if (imagePart) {
      userParts.push(imagePart);
    } else {
      userParts.push({ text: "[알림] 학생의 손글씨 이미지가 전송되지 않았습니다." });
    }

    // Append chat history
    chatHistory.forEach((msg: any) => {
      userParts.push({ text: `${msg.role === "user" ? "학생" : "코치"}: ${msg.content}` });
    });

    userParts.push({ text: "위 맥락과 첨부된 학생의 손글씨 풀이 이미지를 분석하여 코칭 원칙에 따라 답변해 주십시오." });

    const contents = [
      {
        role: "user",
        parts: userParts
      }
    ];

    // Call the model with retries for transient 429 Rate Limits
    let response;
    let attempts = 0;
    const maxAttempts = 3;

    while (attempts < maxAttempts) {
      try {
        attempts++;
        response = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: contents,
          config: {
            systemInstruction: activeSystemPrompt,
            temperature: 0.3,
          }
        });
        break; // Success, exit retry loop
      } catch (err: any) {
        const isRateLimit = err.status === 429 || (err.message && err.message.includes("429"));
        if (isRateLimit && attempts < maxAttempts) {
          console.warn(`[Gemini API] Rate limited (429). Retrying attempt ${attempts + 1}/${maxAttempts} in 2 seconds...`);
          await new Promise((resolve) => setTimeout(resolve, 2000));
        } else {
          throw err; // Re-throw error if it's not a rate limit or we ran out of retry attempts
        }
      }
    }

    if (!response) {
      throw new Error("Gemini API 응답을 받지 못했습니다.");
    }

    const responseText = response.text || "";

    return NextResponse.json({
      reply: responseText,
    });
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    return NextResponse.json(
      {
        error: "Gemini API를 호출하는 도중 오류가 발생했습니다.",
        details: error.message,
      },
      { status: 500 }
    );
  }
}
