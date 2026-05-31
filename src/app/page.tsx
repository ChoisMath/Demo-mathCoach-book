"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { MathView } from "@/components/MathView";
import { coaches } from "@/lib/coaches";
import { DrawingCanvas } from "@/components/DrawingCanvas";
import { 
  BookOpen, 
  Send, 
  CheckCircle, 
  Lock, 
  Unlock, 
  Download, 
  Sparkles,
  User,
  GraduationCap,
  AlertTriangle,
  Lightbulb,
  Compass,
  FileText
} from "lucide-react";


interface CoachResponse {
  reply: string;
  svg: string | null;
  cleanText: string;
}

const PRESET_PROBLEMS = [
  {
    id: "prob1",
    title: "이차함수의 최대·최소",
    content: "이차함수 $f(x) = x^2 - 4x + 3$의 $0 \\le x \\le 3$에서의 최댓값과 최솟값을 구하고 그 과정을 서술하시오."
  },
  {
    id: "prob2",
    title: "등차수열의 일반항",
    content: "수열 $a_n$의 첫째항부터 제$n$항까지의 합이 $S_n = n^2 + 2n$일 때, 일반항 $a_n$을 구하고 그 과정을 서술하시오."
  },
  {
    id: "prob3",
    title: "삼각방정식 해의 개수",
    content: "구간 $[0, 2\\pi]$에서 방정식 $\\sin^2(x) - \\cos(x) - 1 = 0$의 모든 실근의 합을 구하고 그 과정을 서술하시오."
  },
  {
    id: "custom",
    title: "직접 문제 입력",
    content: ""
  }
];

export default function StudentPage() {
  // Student Info
  const [className, setClassName] = useState("");
  const [studentNumber, setStudentNumber] = useState("");
  const [studentName, setStudentName] = useState("");

  // Problem Selection
  const [presetProblems, setPresetProblems] = useState(PRESET_PROBLEMS);
  const [selectedProblemIndex, setSelectedProblemIndex] = useState(0);
  const [customProblem, setCustomProblem] = useState("");
  const problem = selectedProblemIndex === presetProblems.length - 1 
    ? customProblem 
    : (presetProblems[selectedProblemIndex]?.content || "");

  // Student Input
  const [studentSolutionImage, setStudentSolutionImage] = useState("");
  const [studentExplanation, setStudentExplanation] = useState("");

  // Workflow State
  const [isInitialSubmitted, setIsInitialSubmitted] = useState(false);
  
  // Coach Responses & Logs
  const [coachResponses, setCoachResponses] = useState<Record<string, CoachResponse>>({});
  const [comparisonLogs, setComparisonLogs] = useState<Record<string, string>>({
    algebra: "",
    geometry: "",
    argumentation: "",
  });
  const [finalReflection, setFinalReflection] = useState("");

  // UI & Warning States
  const [loading, setLoading] = useState(false);
  const [loadingCoachId, setLoadingCoachId] = useState<string | null>(null);
  const [coachErrors, setCoachErrors] = useState<Record<string, string | null>>({
    algebra: null,
    geometry: null,
    argumentation: null,
  });
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [pendingCoachId, setPendingCoachId] = useState<string | null>(null);
  const [emptyLogCoachNames, setEmptyLogCoachNames] = useState<string[]>([]);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [isClient, setIsClient] = useState(false);

  // Mount check
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsClient(true);

    // Load preset problems from database API
    const fetchProblems = async () => {
      try {
        const res = await fetch("/api/problems");
        if (res.ok) {
          const list = await res.json();
          setPresetProblems(list);
        }
      } catch (err) {
        console.error("Failed to fetch preset problems:", err);
      }
    };
    fetchProblems();

    // Recover auto-save if any
    const saved = localStorage.getItem("math_coach_draft");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setClassName(parsed.className || "");
        setStudentNumber(parsed.studentNumber || "");
        setStudentName(parsed.studentName || "");
        setStudentSolutionImage(parsed.studentSolutionImage || "");
        setStudentExplanation(parsed.studentExplanation || "");
      } catch (e) {
        console.error(e);
      }
    }
  }, []);

  // Auto-save draft
  useEffect(() => {
    if (isClient) {
      localStorage.setItem(
        "math_coach_draft",
        JSON.stringify({
          className,
          studentNumber,
          studentName,
          studentSolutionImage,
          studentExplanation,
        })
      );
    }
  }, [className, studentNumber, studentName, studentSolutionImage, studentExplanation, isClient]);


  // Extract SVG from text
  const parseCoachReply = (text: string): CoachResponse => {
    if (!text) return { reply: text, svg: null, cleanText: "" };
    
    // Match ```xml <svg ...> </svg> ``` or ```svg <svg ...> </svg> ```
    const match = text.match(/```(?:xml|svg)?\s*(<svg[\s\S]*?<\/svg>)\s*```/i) || text.match(/(<svg[\s\S]*?<\/svg>)/i);
    
    if (match) {
      const svgCode = match[1];
      // Clean up text
      const cleanText = text
        .replace(/```(?:xml|svg)?\s*<svg[\s\S]*?<\/svg>\s*```/gi, "")
        .replace(/<svg[\s\S]*?<\/svg>/gi, "")
        .trim();
      return { reply: text, svg: svgCode, cleanText };
    }
    
    return { reply: text, svg: null, cleanText: text };
  };

  // Check if current coach's comparison log is written (at least 5 chars)
  const isComparisonWrittenFor = (id: string) => {
    return (comparisonLogs[id] || "").trim().length >= 5;
  };

  // Parser for coach response sections
  interface ParsedSections {
    perspective: string;
    advice: string;
    keyIdea: string;
    isParsed: boolean;
  }

  const parseFeedbackSections = (text: string): ParsedSections => {
    if (!text) {
      return { perspective: "", advice: "", keyIdea: "", isParsed: false };
    }
    
    // Pattern: 1. 풀이 관점 / 2. 단계 분석 / 3. 핵심 아이디어
    const perspectiveRegex = /(?:1\.|###|\*\*1\.)\s*풀이\s*관점[:\s\-\*]*([\s\S]*?)(?=(?:2\.|###|\*\*2\.)\s*단계\s*분석|$)/i;
    const adviceRegex = /(?:2\.|###|\*\*2\.)\s*단계\s*분석\s*(?:및\s*조언)?[:\s\-\*]*([\s\S]*?)(?=(?:3\.|###|\*\*3\.)\s*핵심\s*아이디어|$)/i;
    const keyIdeaRegex = /(?:3\.|###|\*\*3\.)\s*핵심\s*아이디어[:\s\-\*]*([\s\S]*?)$/i;

    const pMatch = text.match(perspectiveRegex);
    const aMatch = text.match(adviceRegex);
    const iMatch = text.match(keyIdeaRegex);

    if (pMatch && aMatch && iMatch) {
      return {
        perspective: pMatch[1].trim(),
        advice: aMatch[1].trim(),
        keyIdea: iMatch[1].trim(),
        isParsed: true
      };
    }

    // Fallback: simple text splits
    const split1 = text.split(/(?:^|\n)(?:2\.|###\s*2\.)/);
    if (split1.length >= 2) {
      const part1 = split1[0];
      const rest = split1.slice(1).join("2.");
      const split2 = rest.split(/(?:^|\n)(?:3\.|###\s*3\.)/);
      if (split2.length >= 2) {
        const part2 = split2[0];
        const part3 = split2.slice(1).join("3.");
        
        const cleanPart1 = part1.replace(/(?:1\.|###\s*1\.)\s*풀이\s*관점[:\s\-\*]*/i, "").trim();
        const cleanPart2 = part2.replace(/\s*단계\s*분석\s*(?:및\s*조언)?[:\s\-\*]*/i, "").trim();
        const cleanPart3 = part3.replace(/\s*핵심\s*아이디어[:\s\-\*]*/i, "").trim();
        
        if (cleanPart1 || cleanPart2 || cleanPart3) {
          return {
            perspective: cleanPart1 || "",
            advice: cleanPart2 || "",
            keyIdea: cleanPart3 || "",
            isParsed: true
          };
        }
      }
    }

    return {
      perspective: "",
      advice: "",
      keyIdea: "",
      isParsed: false
    };
  };

  // Submit initial solution & activate coaches
  const handleInitialSubmit = () => {
    if (!className || !studentNumber || !studentName) {
      alert("학급 코드, 번호, 이름을 먼저 모두 입력해 주세요.");
      return;
    }
    if (!problem.trim()) {
      alert("문제를 입력하거나 선택해 주세요.");
      return;
    }
    if (!studentSolutionImage) {
      alert("자신의 손글씨 풀이를 패드에 작성해 주세요.");
      return;
    }
    setIsInitialSubmitted(true);
  };

  // Call Gemini Coach API
  const callCoachApi = async (coachId: string) => {
    setLoadingCoachId(coachId);
    setLoading(true);
    setCoachErrors(prev => ({ ...prev, [coachId]: null }));
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentInfo: { className, number: studentNumber, name: studentName },
          problem,
          studentSolutionImage,
          studentExplanation,
          coachId,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        const parsedResponse = parseCoachReply(data.reply);
        setCoachResponses(prev => ({
          ...prev,
          [coachId]: parsedResponse
        }));
      } else {
        setCoachErrors(prev => ({ ...prev, [coachId]: data.error || "코칭 내용을 불러오지 못했습니다." }));
      }
    } catch {
      setCoachErrors(prev => ({ ...prev, [coachId]: "서버와의 통신이 실패했습니다. 네트워크 상태를 확인해 주세요." }));
    } finally {
      setLoading(false);
      setLoadingCoachId(null);
    }
  };

  // Handle manual coach call triggering warning checks
  const handleCallCoach = (coachId: string) => {
    if (!isInitialSubmitted) {
      alert("먼저 1차 풀이를 제출해 주세요.");
      return;
    }

    // Check if any previously called coach has an empty comparison log
    const emptyLogs = coaches.filter(c => {
      const hasResp = !!coachResponses[c.id];
      const isDifferent = c.id !== coachId;
      const isLogEmpty = !comparisonLogs[c.id]?.trim();
      return hasResp && isDifferent && isLogEmpty;
    });

    if (emptyLogs.length > 0) {
      setEmptyLogCoachNames(emptyLogs.map(c => c.name));
      setPendingCoachId(coachId);
      setShowWarningModal(true);
    } else {
      callCoachApi(coachId);
    }
  };

  // Handle final submission
  const handleFinalSubmit = () => {
    // Validate that all activated coaches have comparison logs
    const activeCoaches = coaches.filter(c => coachResponses[c.id]);
    
    if (activeCoaches.length < 2) {
      alert("최종 제출을 하려면 두 개 이상의 코치를 호출하여 조언을 받고 비교 기록을 작성해 주세요.");
      return;
    }

    for (const c of activeCoaches) {
      if (!isComparisonWrittenFor(c.id)) {
        alert(`${c.name}의 풀이를 읽고 비교 기록을 5자 이상 작성해 주세요.`);
        return;
      }
    }

    if (finalReflection.trim().length < 10) {
      alert("최종 성찰을 최소 10자 이상 작성해 주세요.");
      return;
    }

    // Save submission to database API and state
    const newSubmission = {
      id: `${Date.now()}-${studentName}`,
      timestamp: new Date().toLocaleString("ko-KR"),
      studentInfo: { className, number: studentNumber, name: studentName },
      problem,
      studentSolutionImage,
      studentExplanation,
      isSolved: false,
      coachResponses: Object.fromEntries(
        Object.entries(coachResponses).map(([k, v]) => [k, v.reply])
      ),
      comparisonLogs,
      finalReflection,
    };

    const saveToDatabase = async () => {
      try {
        const res = await fetch("/api/submissions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(newSubmission),
        });
        if (!res.ok) {
          console.error("데이터베이스에 제출 기록을 저장하지 못했습니다.");
        }
      } catch (err) {
        console.error("데이터베이스 저장 오류:", err);
      }
    };
    saveToDatabase();

    // Export to JSON file
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(newSubmission, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `${className}_${studentNumber}번_${studentName}_수학성찰기록.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();

    setSubmitSuccess(true);
    // Clear draft
    localStorage.removeItem("math_coach_draft");
  };

  if (!isClient) return null;

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-b border-slate-200 px-6 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center space-x-3">
          <GraduationCap className="h-8 w-8 text-blue-600" />
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-800 flex items-center gap-1.5">
              수학 다중풀이 코칭 시스템 <Sparkles className="h-4.5 w-4.5 text-orange-500 fill-orange-500 animate-pulse" />
            </h1>
            <p className="text-xs text-slate-500">한 수학 문제를 대수, 기하, 논증의 다채로운 눈으로 바라봅니다.</p>
          </div>
        </div>
        <div className="flex items-center space-x-3 text-sm">
          <Link
            href="/teacher"
            className="px-4 py-2 text-blue-600 hover:text-blue-700 font-medium hover:bg-blue-50 rounded-lg transition-colors"
          >
            교사 화면으로 이동
          </Link>
        </div>
      </header>

      {submitSuccess ? (
        <div className="max-w-2xl mx-auto my-16 bg-white p-8 rounded-2xl shadow-xl border border-slate-100 text-center">
          <div className="inline-flex p-4 bg-emerald-50 rounded-full text-emerald-500 mb-6">
            <CheckCircle className="h-16 w-16" />
          </div>
          <h2 className="text-2xl font-bold text-slate-800 mb-3">제출이 성공적으로 완료되었습니다!</h2>
          <p className="text-slate-600 mb-8 max-w-md mx-auto">
            학습 기록 파일이 컴퓨터에 다운로드되었습니다. 다운로드된 파일을 교사에게 전달해 주세요.<br/>
            (로컬 브라우저 저장소에도 학습 데이터가 임시 보관되었습니다.)
          </p>
          <div className="flex justify-center gap-4">
            <button
              onClick={() => {
                setSubmitSuccess(false);
                setIsInitialSubmitted(false);
                setStudentSolutionImage("");
                setStudentExplanation("");
                setCoachResponses({});
                setComparisonLogs({ algebra: "", geometry: "", argumentation: "" });
                setFinalReflection("");
              }}
              className="px-6 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-all hover:scale-102 cursor-pointer shadow-md shadow-blue-500/10"
            >
              새 문제 도전하기
            </button>
          </div>
        </div>
      ) : (
        <div className="max-w-[1600px] mx-auto p-4 md:p-6 grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          
          {/* Left Pane: Problem, Student Solution & Explanation */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-md p-6 space-y-6">
            <div className="border-b border-slate-100 pb-4">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-blue-500" />
                Step 1. 정보 및 풀이 작성
              </h2>
              <p className="text-xs text-slate-500">학생 본인의 기본 정보를 넣고 풀이를 구상해 보세요.</p>
            </div>

            {/* Student Info Inputs */}
            <div className="grid grid-cols-3 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5 flex items-center gap-1">
                  <User className="h-3.5 w-3.5 text-slate-400" /> 학급 코드
                </label>
                <input
                  type="text"
                  placeholder="예: 3-1 또는 코드"
                  value={className}
                  onChange={(e) => setClassName(e.target.value)}
                  disabled={isInitialSubmitted}
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-60"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">번호</label>
                <input
                  type="text"
                  placeholder="예: 15"
                  value={studentNumber}
                  onChange={(e) => setStudentNumber(e.target.value)}
                  disabled={isInitialSubmitted}
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-60"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">이름</label>
                <input
                  type="text"
                  placeholder="예: 홍길동"
                  value={studentName}
                  onChange={(e) => setStudentName(e.target.value)}
                  disabled={isInitialSubmitted}
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-60"
                />
              </div>
            </div>

            {/* Problem Selection */}
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-slate-700">과제 문제 선택</label>
              <select
                value={selectedProblemIndex}
                onChange={(e) => setSelectedProblemIndex(Number(e.target.value))}
                disabled={isInitialSubmitted}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              >
                {presetProblems.map((prob, idx) => (
                  <option key={prob.id} value={idx}>
                    {prob.title} {prob.content ? `- ${prob.content.slice(0, 40)}...` : ""}
                  </option>
                ))}
              </select>

              {/* Custom Problem Input */}
              {selectedProblemIndex === presetProblems.length - 1 && (
                <textarea
                  placeholder="수학 문제를 LaTeX 문법과 함께 작성해 주세요. (예: $f(x) = x^2 - 1$)"
                  value={customProblem}
                  onChange={(e) => setCustomProblem(e.target.value)}
                  disabled={isInitialSubmitted}
                  rows={3}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              )}


              {/* Selected Problem Render */}
              {problem && (
                <div className="p-4 bg-blue-50/50 rounded-xl border border-blue-100/50 text-slate-800 text-sm">
                  <div className="font-semibold text-blue-700 mb-1.5">문제:</div>
                  <MathView text={problem} />
                </div>
              )}
            </div>

            {/* Student Solution Input (Drawing Canvas) */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="block text-sm font-semibold text-slate-700">자기 풀이 과정 (손글씨 및 시각화 패드)</label>
                <span className="text-xs text-slate-400">수식, 그래프, 도형을 직접 그려보세요. (터치/스타일러스 지원)</span>
              </div>
              <DrawingCanvas
                onImageChange={(base64) => setStudentSolutionImage(base64)}
                disabled={loading}
                initialImage={studentSolutionImage}
              />
            </div>


            {/* Student Intent/Explanation */}
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-slate-700">풀이 의도 및 설명</label>
              <textarea
                placeholder="이 풀이에서 사용한 주요 아이디어나 식의 설계 의도를 설명해 주세요."
                value={studentExplanation}
                onChange={(e) => setStudentExplanation(e.target.value)}
                disabled={loading}
                rows={3}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>



            {/* Submit Button */}
            <div className="space-y-3">
              <button
                type="button"
                onClick={handleInitialSubmit}
                disabled={loading}
                className="w-full py-3.5 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-all cursor-pointer flex items-center justify-center space-x-2 shadow-md shadow-blue-500/10 hover:scale-101 disabled:bg-blue-400 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <Send className="h-4.5 w-4.5" />
                )}
                <span>
                  {isInitialSubmitted ? "풀이 제출 및 코칭 받기 (수정하여 다시 제출)" : "풀이 제출 및 코칭 받기"}
                </span>
              </button>
              
              {isInitialSubmitted && (
                <div className="flex justify-between items-center px-4 py-3 bg-emerald-50 border border-emerald-100 rounded-xl">
                  <span className="text-xs text-emerald-800 font-semibold flex items-center gap-1">
                    <CheckCircle className="h-4 w-4 text-emerald-600" /> 1차 풀이가 제출되었습니다.
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      if(confirm("기존 입력 내용과 받았던 코칭 내용이 모두 지워집니다. 완전히 초기화하시겠습니까?")) {
                        setIsInitialSubmitted(false);
                        setCoachResponses({});
                        setStudentSolutionImage("");
                        setStudentExplanation("");
                      }
                    }}
                    className="text-xs text-blue-600 hover:underline font-medium cursor-pointer"
                  >
                    전체 초기화
                  </button>
                </div>
              )}
            </div>

          </div>

          {/* Right Pane: AI Multi-Coaches & Compare & Reflect */}
          <div className="space-y-6">
            {/* AI Coaching Console */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-md p-6 space-y-6">
              <div className="border-b border-slate-100 pb-4">
                <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-indigo-500" />
                  Step 2. AI 다중관점 코칭
                </h2>
                <p className="text-xs text-slate-500">풀이를 제출하고 코치를 하나씩 활성화하여 다른 시야를 학습해 보세요.</p>
              </div>

              <div className="space-y-6">
                {coaches.map((c) => {
                  const hasResponse = !!coachResponses[c.id];
                  const isLoading = loadingCoachId === c.id;
                  const coachError = coachErrors[c.id];

                  // Parse response sections
                  const parsed = hasResponse ? parseFeedbackSections(coachResponses[c.id].cleanText) : null;
                  const svgCode = hasResponse ? coachResponses[c.id].svg : null;

                  return (
                    <div key={c.id} className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm transition-all duration-300">
                      {/* Header */}
                      <div className="bg-slate-50/80 border-b border-slate-100 px-5 py-4 flex items-center justify-between">
                        <div className="flex items-center space-x-2.5">
                          <span className={`p-1.5 rounded-lg ${
                            hasResponse 
                              ? "bg-emerald-50 text-emerald-600" 
                              : !isInitialSubmitted 
                              ? "bg-slate-100 text-slate-400" 
                              : "bg-blue-50 text-blue-600"
                          }`}>
                            {hasResponse ? (
                              <CheckCircle className="h-4.5 w-4.5" />
                            ) : !isInitialSubmitted ? (
                              <Lock className="h-4.5 w-4.5" />
                            ) : (
                              <Unlock className="h-4.5 w-4.5" />
                            )}
                          </span>
                          <div>
                            <h3 className="text-sm font-bold text-slate-800">{c.name}</h3>
                            <p className="text-[11px] text-slate-400 mt-0.5">{c.description}</p>
                          </div>
                        </div>
                        
                        {hasResponse && (
                          <span className="text-[10px] px-2.5 py-0.5 bg-emerald-100 text-emerald-800 font-bold rounded">
                            호출 완료
                          </span>
                        )}
                      </div>

                      {/* Body */}
                      <div className="p-5 bg-white space-y-4">
                        {!isInitialSubmitted ? (
                          <div className="py-6 text-center text-slate-400 text-xs flex flex-col items-center justify-center space-y-1.5">
                            <Lock className="h-8 w-8 text-slate-300 animate-pulse" />
                            <p>1차 풀이를 제출하면 이 코치를 호출할 수 있습니다.</p>
                          </div>
                        ) : isLoading ? (
                          <div className="py-10 text-center space-y-3">
                            <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
                            <p className="text-xs font-semibold text-blue-600 animate-pulse">
                              {c.name}가 학생의 풀이를 분석하는 중입니다...
                            </p>
                          </div>
                        ) : coachError ? (
                          <div className="p-4 bg-red-50 text-red-700 rounded-xl border border-red-100 text-xs space-y-2">
                            <p className="font-bold">에러가 발생했습니다:</p>
                            <p>{coachError}</p>
                            <button
                              type="button"
                              onClick={() => callCoachApi(c.id)}
                              className="px-3 py-1.5 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 cursor-pointer"
                            >
                              재시도하기
                            </button>
                          </div>
                        ) : !hasResponse ? (
                          <div className="py-6 flex flex-col items-center justify-center space-y-3 bg-slate-50/50 border border-dashed border-slate-200 rounded-xl">
                            <p className="text-xs text-slate-500 font-medium">아직 호출되지 않았습니다.</p>
                            <button
                              type="button"
                              onClick={() => handleCallCoach(c.id)}
                              className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all hover:scale-102 cursor-pointer flex items-center gap-1.5"
                            >
                              <Unlock className="h-3.5 w-3.5" />
                              <span>{c.name} 호출하여 조언받기</span>
                            </button>
                          </div>
                        ) : (
                          <div className="space-y-4">
                            {/* Coach Feedback Render (3 parsed parts or fallback) */}
                            {parsed && parsed.isParsed ? (
                              <div className="space-y-3">
                                {/* Perspective */}
                                <div className="p-4 bg-indigo-50/30 border border-indigo-100/50 rounded-xl space-y-1">
                                  <div className="flex items-center space-x-1.5 text-xs font-bold text-indigo-700">
                                    <BookOpen className="h-4 w-4" />
                                    <span>풀이 관점</span>
                                  </div>
                                  <div className="text-sm text-slate-700 pl-5 leading-relaxed">
                                    <MathView text={parsed.perspective} />
                                  </div>
                                </div>

                                {/* Advice */}
                                <div className="p-4 bg-blue-50/30 border border-blue-100/50 rounded-xl space-y-1">
                                  <div className="flex items-center space-x-1.5 text-xs font-bold text-blue-700">
                                    <Compass className="h-4 w-4" />
                                    <span>단계 분석 및 조언</span>
                                  </div>
                                  <div className="text-sm text-slate-700 pl-5 leading-relaxed">
                                    <MathView text={parsed.advice} />
                                  </div>
                                </div>

                                {/* Key Idea */}
                                <div className="p-4 bg-emerald-50/30 border border-emerald-100/50 rounded-xl space-y-1">
                                  <div className="flex items-center space-x-1.5 text-xs font-bold text-emerald-700">
                                    <Lightbulb className="h-4 w-4" />
                                    <span>핵심 아이디어</span>
                                  </div>
                                  <div className="text-sm text-slate-700 pl-5 leading-relaxed">
                                    <MathView text={parsed.keyIdea} />
                                  </div>
                                </div>
                              </div>
                            ) : (
                              // Fallback
                              <div className="p-4 bg-blue-50/20 border border-slate-100 rounded-xl text-slate-800 text-sm">
                                <MathView text={coachResponses[c.id].cleanText} />
                              </div>
                            )}

                            {/* SVG Visualizations if any */}
                            {svgCode && (
                              <div className="space-y-2 pt-1">
                                <div className="text-xs font-bold text-slate-500 flex items-center gap-1">
                                  <span>기하 시각화 그래프</span>
                                  <span className="text-[10px] px-1.5 py-0.5 bg-orange-100 text-orange-800 font-bold rounded">SVG Vector</span>
                                </div>
                                <div className="w-full flex items-center justify-center p-4 bg-slate-900 rounded-xl shadow-inner border border-slate-800 overflow-auto min-h-[300px]">
                                  <div 
                                    className="w-full max-w-md bg-transparent text-white"
                                    dangerouslySetInnerHTML={{ __html: svgCode || "" }}
                                  />
                                </div>
                              </div>
                            )}

                            {/* Comparison Log */}
                            <div className="space-y-2.5 pt-3 border-t border-slate-100">
                              <div className="flex justify-between items-center">
                                <label className="block text-xs font-bold text-slate-700 flex items-center gap-1">
                                  <FileText className="h-3.5 w-3.5 text-slate-500" />
                                  <span>{c.name} 풀이 비교 일지</span>
                                </label>
                                {isComparisonWrittenFor(c.id) ? (
                                  <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-0.5">
                                    <CheckCircle className="h-3 w-3" /> 작성됨
                                  </span>
                                ) : (
                                  <span className="text-[10px] text-amber-600 font-bold animate-pulse">
                                    비교 글을 작성해 주세요 (5자 이상)
                                  </span>
                                )}
                              </div>
                              <textarea
                                placeholder={`[생각해 볼 질문]\n1. 내 풀이와 이 코치의 조언이 만나는 지점은 무엇인가?\n2. 이 코치가 짚어 준 다음 한 걸음은 무엇인가?\n3. 내 풀이에서 다시 고치거나 덧붙여야 할 부분은 무엇인가?\n4. 이 관점은 다음 문제에서 언제 써 볼 수 있을까?`}
                                value={comparisonLogs[c.id] || ""}
                                onChange={(e) => setComparisonLogs(prev => ({
                                  ...prev,
                                  [c.id]: e.target.value
                                }))}
                                rows={4}
                                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none placeholder:text-slate-400/90 leading-relaxed font-sans animate-in fade-in duration-200"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Step 3. Final Reflection & Submit */}
            {Object.keys(coachResponses).length >= 2 && (
              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-md p-6 space-y-4 transition-all duration-300 animate-in fade-in slide-in-from-bottom-4">
                <div className="border-b border-slate-100 pb-4">
                  <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-emerald-500" />
                    Step 3. 최종 학습 성찰 및 제출
                  </h2>
                  <p className="text-xs text-slate-500">두 개 이상의 코치 풀이를 비교한 후, 최종 성찰을 기록하고 완료하세요.</p>
                </div>

                {/* Final Reflection Input */}
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-slate-700">최종 종합 성찰 일지</label>
                  <textarea
                    placeholder={`[생각해 볼 질문]\n1. 오늘 본 코치 중 나에게 가장 도움이 된 코치는 누구인가?\n2. 그 코치의 어떤 조언이 내 풀이를 가장 많이 움직였는가?\n3. 다음에 비슷한 문제를 만나면 어디서부터 다시 시작해 볼 것인가?`}
                    value={finalReflection}
                    onChange={(e) => setFinalReflection(e.target.value)}
                    disabled={!isInitialSubmitted}
                    rows={5}
                    className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none placeholder:text-slate-400/90 leading-relaxed disabled:bg-slate-50 disabled:opacity-60"
                  />
                </div>

                {/* Submit / Export Trigger */}
                <button
                  type="button"
                  onClick={handleFinalSubmit}
                  disabled={!isInitialSubmitted}
                  className="w-full py-4 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-all cursor-pointer flex items-center justify-center space-x-2 shadow-md shadow-emerald-500/10 hover:scale-101 disabled:bg-slate-300 disabled:shadow-none disabled:cursor-not-allowed disabled:scale-100"
                >
                  <Download className="h-4.5 w-4.5" />
                  <span>최종 제출 및 학습 결과 파일 다운로드</span>
                </button>
              </div>
            )}

          </div>
        </div>
      )}

      {/* Custom Warning Modal */}
      {showWarningModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 transform transition-all animate-in zoom-in-95 duration-200">
            <div className="flex items-start space-x-3.5 mb-4">
              <div className="p-2 bg-amber-50 rounded-full text-amber-600 shrink-0">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">비교 기록이 비어 있습니다</h3>
                <p className="text-sm text-slate-500 mt-1.5 leading-relaxed">
                  이전 코치({emptyLogCoachNames.join(", ")})의 비교 기록을 아직 작성하지 않으셨네요! 
                  코치의 피드백과 본인의 풀이를 비교하여 기록하면 학습 효과가 훨씬 높아집니다.
                </p>
              </div>
            </div>
            <div className="flex justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowWarningModal(false);
                  setPendingCoachId(null);
                }}
                className="px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer transition-colors"
              >
                기록 작성하기
              </button>
              <button
                type="button"
                onClick={() => {
                  if (pendingCoachId) {
                    callCoachApi(pendingCoachId);
                  }
                  setShowWarningModal(false);
                  setPendingCoachId(null);
                }}
                className="px-4 py-2.5 bg-amber-600 text-white rounded-xl text-sm font-semibold hover:bg-amber-700 cursor-pointer transition-colors"
              >
                네, 계속 진행할게요
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
