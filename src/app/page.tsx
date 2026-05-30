"use client";

import React, { useState, useEffect } from "react";
import { MathView } from "@/components/MathView";
import { coaches } from "@/lib/coaches";
import { DrawingCanvas } from "@/components/DrawingCanvas";
import { 
  BookOpen, 
  Send, 
  CheckCircle, 
  HelpCircle, 
  Lock, 
  Unlock, 
  Download, 
  ChevronRight, 
  Sparkles,
  User,
  GraduationCap,
  Maximize2
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
  const [isSolved, setIsSolved] = useState<boolean | null>(null);

  // Workflow State
  const [isInitialSubmitted, setIsInitialSubmitted] = useState(false);
  const [selectedCoachId, setSelectedCoachId] = useState<string>("algebra");
  
  // Coach Responses & Logs
  const [coachResponses, setCoachResponses] = useState<Record<string, CoachResponse>>({});
  const [comparisonLogs, setComparisonLogs] = useState<Record<string, string>>({
    algebra: "",
    geometry: "",
    argumentation: "",
  });
  const [finalReflection, setFinalReflection] = useState("");

  // UI State
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [isClient, setIsClient] = useState(false);

  // Mount check
  useEffect(() => {
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
        if (parsed.isSolved !== undefined) setIsSolved(parsed.isSolved);
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
          isSolved,
        })
      );
    }
  }, [className, studentNumber, studentName, studentSolutionImage, studentExplanation, isSolved, isClient]);


  // Extract SVG from text
  const parseCoachReply = (text: string): CoachResponse => {
    if (!text) return { reply: text, svg: null, cleanText: "" };
    
    // Match ```xml <svg ...> </svg> ``` or ```svg <svg ...> </svg> ```
    const match = text.match(/```(?:xml|svg)?\s*(<svg[\s\S]*?<\/svg>)\s*```/i) || text.match(/(<svg[\s\S]*?<\/svg>)/i);
    
    if (match) {
      const svgCode = match[1];
      // Clean up text
      let cleanText = text
        .replace(/```(?:xml|svg)?\s*<svg[\s\S]*?<\/svg>\s*```/gi, "")
        .replace(/<svg[\s\S]*?<\/svg>/gi, "")
        .trim();
      return { reply: text, svg: svgCode, cleanText };
    }
    
    return { reply: text, svg: null, cleanText: text };
  };

  // Check if current coach's comparison log is written
  const isComparisonWrittenFor = (id: string) => {
    return comparisonLogs[id]?.trim().length > 5;
  };

  // Submit initial solution & activate coaches
  const handleInitialSubmit = () => {
    if (!className || !studentNumber || !studentName) {
      alert("학급명, 번호, 이름을 먼저 모두 입력해 주세요.");
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
    if (isSolved === null) {
      alert("스스로 정답을 해결했는지 여부를 선택해 주세요.");
      return;
    }
    setIsInitialSubmitted(true);
    // Request first coach
    callCoachApi(selectedCoachId);
  };

  // Call Gemini Coach API
  const callCoachApi = async (coachId: string) => {
    setLoading(true);
    setError(null);
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
          isSolved,
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
        setError(data.error || "코칭 내용을 불러오지 못했습니다.");
      }
    } catch (err) {
      setError("서버와의 통신이 실패했습니다. 네트워크 상태를 확인해 주세요.");
    } finally {
      setLoading(false);
    }
  };

  // Select another coach (handles lock mechanics)
  const handleCoachSelect = (coachId: string) => {
    setSelectedCoachId(coachId);
    if (isInitialSubmitted && !coachResponses[coachId]) {
      callCoachApi(coachId);
    }
  };

  // Handle final submission
  const handleFinalSubmit = () => {
    // Validate that all activated coaches have comparison logs
    const activeCoaches = coaches.filter(c => coachResponses[c.id]);
    for (const c of activeCoaches) {
      if (!isComparisonWrittenFor(c.id)) {
        alert(`${c.name}의 풀이를 읽고 비교 기록을 6자 이상 작성해 주세요.`);
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
      isSolved: !!isSolved,
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
          <a
            href="/teacher"
            className="px-4 py-2 text-blue-600 hover:text-blue-700 font-medium hover:bg-blue-50 rounded-lg transition-colors"
          >
            교사 화면으로 이동
          </a>
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
                setIsSolved(null);
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
                  <User className="h-3.5 w-3.5 text-slate-400" /> 학급명
                </label>
                <input
                  type="text"
                  placeholder="예: 3학년1반"
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

            {/* Solved Status */}
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-slate-700">스스로 정답을 최종 해결하셨나요?</label>
              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setIsSolved(true)}
                  disabled={loading}
                  className={`py-3 px-4 rounded-xl border text-sm font-semibold flex items-center justify-center space-x-2 transition-all cursor-pointer ${
                    isSolved === true
                      ? "border-emerald-600 bg-emerald-50 text-emerald-800 shadow-sm"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <CheckCircle className="h-4.5 w-4.5" />
                  <span>네, 정답을 구했습니다.</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsSolved(false)}
                  disabled={loading}
                  className={`py-3 px-4 rounded-xl border text-sm font-semibold flex items-center justify-center space-x-2 transition-all cursor-pointer ${
                    isSolved === false
                      ? "border-amber-500 bg-amber-50 text-amber-800 shadow-sm"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <HelpCircle className="h-4.5 w-4.5" />
                  <span>아니오, 중간에 막혔습니다.</span>
                </button>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                ※ 막혔다고 응답한 경우, 제출 시 해당 관점의 코치로부터 문제를 풀어가기 위한 디딤돌 힌트가 제공됩니다.
              </p>
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
                  {isInitialSubmitted ? "풀이 수정 제출 및 코치 호출" : "풀이 제출 및 코칭 받기"}
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
                        setIsSolved(null);
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
              <div className="border-b border-slate-100 pb-4 flex justify-between items-center">
                <div>
                  <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-indigo-500" />
                    Step 2. AI 다중관점 코칭
                  </h2>
                  <p className="text-xs text-slate-500">풀이를 제출하고 코치를 하나씩 활성화하여 다른 시야를 학습해 보세요.</p>
                </div>
              </div>

              {/* Coach Selection Tab Headers */}
              <div className="grid grid-cols-3 gap-2">
                {coaches.map((c) => {
                  const isCoachUnlocked = isInitialSubmitted;
                  const isActive = selectedCoachId === c.id;
                  const hasResponse = !!coachResponses[c.id];

                  return (
                    <button
                      key={c.id}
                      type="button"
                      disabled={!isCoachUnlocked}
                      onClick={() => handleCoachSelect(c.id)}
                      className={`relative py-3 px-2 rounded-xl border text-xs font-bold transition-all cursor-pointer flex flex-col items-center justify-center space-y-1.5 ${
                        isActive
                          ? "border-blue-600 bg-blue-50/50 text-blue-800 shadow-sm"
                          : isCoachUnlocked
                          ? "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                          : "border-slate-100 bg-slate-50 text-slate-400 cursor-not-allowed"
                      }`}
                    >
                      {/* Badge indicator */}
                      {isCoachUnlocked && hasResponse && (
                        <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-emerald-500" />
                      )}
                      
                      {/* Icon */}
                      {isCoachUnlocked ? (
                        <Unlock className={`h-4 w-4 ${isActive ? "text-blue-600" : "text-slate-400"}`} />
                      ) : (
                        <Lock className="h-4 w-4 text-slate-300" />
                      )}

                      <span className="text-center font-bold">{c.name}</span>
                    </button>
                  );
                })}
              </div>

              {/* Coach Feedback Body */}
              {!isInitialSubmitted ? (
                <div className="py-16 text-center text-slate-400 border border-dashed border-slate-200 rounded-xl flex flex-col items-center justify-center space-y-3">
                  <Lock className="h-12 w-12 text-slate-300" />
                  <p className="text-sm font-medium">왼쪽에서 자기 풀이를 제출하면 코칭 탭이 활성화됩니다.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Selected Coach Description */}
                  <div className="p-3.5 bg-slate-50 rounded-xl text-xs border border-slate-100 text-slate-600">
                    <span className="font-semibold text-slate-700">코치 안내: </span>
                    {coaches.find(c => c.id === selectedCoachId)?.description}
                  </div>

                  {loading && selectedCoachId && !coachResponses[selectedCoachId] ? (
                    <div className="py-20 text-center space-y-4">
                      <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
                      <p className="text-xs font-semibold text-blue-600 animate-pulse">
                        {coaches.find(c => c.id === selectedCoachId)?.name}가 학생의 풀이를 분석 중입니다...
                      </p>
                    </div>
                  ) : error && !coachResponses[selectedCoachId] ? (
                    <div className="p-4 bg-red-50 text-red-700 rounded-xl border border-red-100 text-sm">
                      <p className="font-bold">에러가 발생했습니다:</p>
                      <p>{error}</p>
                      <button
                        onClick={() => callCoachApi(selectedCoachId)}
                        className="mt-3 px-4 py-2 bg-red-600 text-white rounded-lg text-xs font-semibold hover:bg-red-700"
                      >
                        재시도하기
                      </button>
                    </div>
                  ) : coachResponses[selectedCoachId] ? (
                    <div className="space-y-4">
                      {/* Coach Explanation Text */}
                      <div className="p-5 bg-blue-50/20 border border-slate-100 rounded-2xl text-slate-800 text-sm space-y-4">
                        <div className="flex items-center space-x-2 border-b border-slate-100 pb-2">
                          <span className="px-2 py-0.5 bg-blue-100 text-blue-800 text-xs font-bold rounded">COACH FEEDBACK</span>
                          <span className="text-xs text-slate-400 font-mono">Real-time Gemini</span>
                        </div>
                        
                        <MathView text={coachResponses[selectedCoachId].cleanText} />
                      </div>

                      {/* SVG Visualization Box (For Geometry Coach primarily) */}
                      {coachResponses[selectedCoachId].svg && (
                        <div className="space-y-2">
                          <div className="text-xs font-bold text-slate-500 flex items-center gap-1">
                            <span>기하 시각화 그래프</span>
                            <span className="text-[10px] px-1.5 py-0.5 bg-orange-100 text-orange-800 font-bold rounded">SVG Vector</span>
                          </div>
                          <div className="w-full flex items-center justify-center p-4 bg-slate-900 rounded-xl shadow-inner border border-slate-850 overflow-auto min-h-[300px]">
                            <div 
                              className="w-full max-w-md bg-transparent text-white"
                              dangerouslySetInnerHTML={{ __html: coachResponses[selectedCoachId].svg || "" }}
                            />
                          </div>
                        </div>
                      )}

                      {/* Comparison Log Input */}
                      <div className="space-y-2.5 pt-2 border-t border-slate-100">
                        <div className="flex justify-between items-center">
                          <label className="block text-sm font-semibold text-slate-800">
                            {coaches.find(c => c.id === selectedCoachId)?.name} 풀이 비교 일지
                          </label>
                          {isComparisonWrittenFor(selectedCoachId) ? (
                            <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1">
                              <CheckCircle className="h-3.5 w-3.5 fill-emerald-50" /> 작성 완료
                            </span>
                          ) : (
                            <span className="text-xs text-amber-600 font-semibold">비교 글을 6자 이상 작성해 주세요</span>
                          )}
                        </div>
                        <textarea
                          placeholder="방금 확인한 코치의 풀이 방법이나 힌트가 나의 원래 풀이와 무엇이 다른지, 그리고 어떤 점이 새로운지 적어 보세요."
                          value={comparisonLogs[selectedCoachId]}
                          onChange={(e) => setComparisonLogs(prev => ({
                            ...prev,
                            [selectedCoachId]: e.target.value
                          }))}
                          rows={3}
                          className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="py-12 text-center text-slate-400">
                      <p className="text-sm">코치 탭을 눌러 분석 요청을 받아 보세요.</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Step 3. Final Reflection & Submit */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-md p-6 space-y-4">
              <div className="border-b border-slate-100 pb-4">
                <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-emerald-500" />
                  Step 3. 최종 학습 성찰 및 제출
                </h2>
                <p className="text-xs text-slate-500">모든 풀이를 비교한 후, 종합적인 깨달음을 서술하고 제출해 주세요.</p>
              </div>

              {/* Final Reflection Input */}
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-slate-700">최종 종합 성찰 일지</label>
                <textarea
                  placeholder="대수, 기하, 논증 세 가지 서로 다른 풀이를 모두 확인하고 비교하면서, 수학 문제를 푸는 태도나 사고방식에서 어떤 변화나 깨달음을 얻었는지 종합 성찰을 적어주세요. (최소 10자 이상)"
                  value={finalReflection}
                  onChange={(e) => setFinalReflection(e.target.value)}
                  disabled={!isInitialSubmitted}
                  rows={4}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none disabled:bg-slate-50 disabled:opacity-60"
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

          </div>
        </div>
      )}
    </main>
  );
}
