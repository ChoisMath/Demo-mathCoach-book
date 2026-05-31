"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { 
  BarChart2, 
  ArrowLeft, 
  Copy, 
  RotateCw, 
  Play, 
  Sparkles, 
  Clock, 
  Users, 
  CheckCircle2, 
  AlertCircle, 
  BookOpen, 
  MessageSquare,
  HelpCircle,
  TrendingUp,
  Award
} from "lucide-react";

interface Submission {
  id: string;
  timestamp: string;
  studentInfo: {
    className: string;
    number: string;
    name: string;
  };
  problem: string;
  studentExplanation: string;
  isSolved: boolean;
  coachResponses: Record<string, string>;
  comparisonLogs: Record<string, string>;
  finalReflection: string;
}

interface AnalysisResult {
  coachFrequency: string;
  stuckStages: string;
  misconceptions: string;
  focusStudents: string;
}

// Locale date parser to parse "2026. 5. 31. 오전 10:55:00" format correctly
function parseKoLocaleDate(dateStr: string): Date {
  const parts = dateStr.split(".");
  if (parts.length >= 3) {
    const year = parseInt(parts[0].trim(), 10);
    const month = parseInt(parts[1].trim(), 10) - 1;
    const day = parseInt(parts[2].trim(), 10);
    
    let hours = 0;
    let minutes = 0;
    let seconds = 0;
    
    if (parts[3]) {
      const timeStr = parts[3].trim();
      const isPm = timeStr.includes("오후");
      const isAm = timeStr.includes("오전");
      
      const timeParts = timeStr.replace("오전", "").replace("오후", "").trim().split(":");
      if (timeParts.length >= 2) {
        let h = parseInt(timeParts[0].trim(), 10);
        if (isPm && h < 12) h += 12;
        if (isAm && h === 12) h = 0;
        hours = h;
        minutes = parseInt(timeParts[1].trim(), 10);
        if (timeParts[2]) {
          seconds = parseInt(timeParts[2].trim(), 10);
        }
      }
    }
    return new Date(year, month, day, hours, minutes, seconds);
  }
  
  const d = new Date(dateStr);
  if (!isNaN(d.getTime())) return d;
  return new Date();
}

export default function ClassAnalysisPage() {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [selectedClass, setSelectedClass] = useState<string>("all");
  const [selectedPeriod, setSelectedPeriod] = useState<"today" | "7days" | "all">("all");
  const [loading, setLoading] = useState<boolean>(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [isClient, setIsClient] = useState<boolean>(false);
  const [classesList, setClassesList] = useState<string[]>([]);
  const [copySuccessMap, setCopySuccessMap] = useState<Record<string, boolean>>({});
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Load submissions
  useEffect(() => {
    setIsClient(true);
    const loadSubmissions = async () => {
      try {
        const res = await fetch("/api/submissions");
        if (res.ok) {
          const data: Submission[] = await res.json();
          setSubmissions(data);
          
          // Get unique class names
          const uniqueClasses = Array.from(
            new Set(data.map((s) => s.studentInfo.className).filter(Boolean))
          );
          setClassesList(uniqueClasses);
          
          if (uniqueClasses.length > 0) {
            setSelectedClass(uniqueClasses[0]);
          }
        }
      } catch (err) {
        console.error("Failed to load submissions", err);
      }
    };
    loadSubmissions();
  }, []);

  // Compute filtered submissions
  const getFilteredSubmissions = () => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const sevenDaysAgo = new Date(startOfToday.getTime() - 7 * 24 * 60 * 60 * 1000);

    return submissions.filter((sub) => {
      const classMatches = selectedClass === "all" || sub.studentInfo.className === selectedClass;
      if (!classMatches) return false;

      const date = parseKoLocaleDate(sub.timestamp);
      if (selectedPeriod === "today") {
        return date >= startOfToday;
      } else if (selectedPeriod === "7days") {
        return date >= sevenDaysAgo;
      }
      return true;
    });
  };

  const filteredSubmissions = getFilteredSubmissions();

  // Cache key helper
  const getCacheKey = (className: string, period: string) => {
    return `classAnalysisCache_${className}_${period}`;
  };

  // Check cache when filters change
  useEffect(() => {
    if (!isClient || selectedClass === "all") {
      setAnalysisResult(null);
      return;
    }
    const key = getCacheKey(selectedClass, selectedPeriod);
    const cached = localStorage.getItem(key);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        setAnalysisResult(parsed.data);
        setErrorMsg(null);
      } catch (e) {
        setAnalysisResult(null);
      }
    } else {
      setAnalysisResult(null);
    }
  }, [selectedClass, selectedPeriod, isClient]);

  // Request Analysis
  const handleAnalyze = async (force: boolean = false) => {
    if (filteredSubmissions.length === 0) return;
    
    setErrorMsg(null);
    setLoading(true);
    
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submissions: filteredSubmissions }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "분석 요청에 실패했습니다.");
      }

      const data: AnalysisResult = await res.json();
      setAnalysisResult(data);
      
      // Save cache
      if (selectedClass !== "all") {
        const key = getCacheKey(selectedClass, selectedPeriod);
        localStorage.setItem(
          key, 
          JSON.stringify({
            timestamp: Date.now(),
            data
          })
        );
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "Gemini 분석 중 문제가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  // Copy to clipboard with fallback
  const handleCopyToClipboard = (key: string, text: string) => {
    if (!text) return;
    
    const cleanText = text.trim();
    
    const triggerSuccessMessage = () => {
      setCopySuccessMap((prev) => ({ ...prev, [key]: true }));
      setTimeout(() => {
        setCopySuccessMap((prev) => ({ ...prev, [key]: false }));
      }, 2000);
    };

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(cleanText)
        .then(triggerSuccessMessage)
        .catch((err) => {
          console.error("Failed to copy using navigator", err);
          fallbackCopy(cleanText, triggerSuccessMessage);
        });
    } else {
      fallbackCopy(cleanText, triggerSuccessMessage);
    }
  };

  const fallbackCopy = (text: string, callback: () => void) => {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    // Avoid scrolling to bottom
    textArea.style.top = "0";
    textArea.style.left = "0";
    textArea.style.position = "fixed";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
      document.execCommand("copy");
      callback();
    } catch (err) {
      console.error("Fallback copy failed", err);
    }
    document.body.removeChild(textArea);
  };

  if (!isClient) return null;

  const hasCache = selectedClass !== "all" && !!localStorage.getItem(getCacheKey(selectedClass, selectedPeriod));

  return (
    <main className="min-h-screen bg-[#fafaff] text-slate-900 font-sans pb-20">
      {/* Dynamic sleek header with subtle gradient */}
      <header className="sticky top-0 z-10 bg-white/70 backdrop-blur-lg border-b border-indigo-100/50 px-6 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-gradient-to-tr from-indigo-500 to-violet-600 rounded-xl shadow-md text-white">
            <BarChart2 className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-slate-800 flex items-center gap-1.5">
              수업 도입 5분 분석 대시보드
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-100">
                <Sparkles className="h-2.5 w-2.5 mr-0.5 text-indigo-600 animate-pulse" /> Gemini AI
              </span>
            </h1>
            <p className="text-xs text-slate-500">학생들의 성찰 일지를 분석하여 내일 수업 도입부에 바로 읽거나 활용할 대본을 제공합니다.</p>
          </div>
        </div>
        <div>
          <Link href="/teacher" className="px-4 py-2 text-slate-600 hover:text-slate-700 font-semibold hover:bg-slate-100 rounded-xl transition-all flex items-center gap-1.5 border border-slate-200 bg-white shadow-sm text-sm cursor-pointer">
            <ArrowLeft className="h-4 w-4" /> 교사 대시보드로
          </Link>
        </div>
      </header>

      <div className="max-w-[1400px] mx-auto p-4 md:p-6 space-y-6">
        
        {/* Sleek Filters Panel - Glassmorphism touch */}
        <section className="bg-white/80 backdrop-blur-md border border-indigo-100/80 rounded-3xl p-6 shadow-sm flex flex-col md:flex-row md:items-end justify-between gap-6 transition-all duration-300">
          <div className="flex flex-wrap md:flex-nowrap gap-6 flex-1">
            {/* Class selection */}
            <div className="space-y-2 flex-1 min-w-[200px]">
              <label className="block text-xs font-extrabold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                <Users className="h-3.5 w-3.5 text-indigo-500" /> 학급 선택
              </label>
              <select 
                value={selectedClass} 
                onChange={(e) => setSelectedClass(e.target.value)} 
                className="w-full px-4 py-3 bg-slate-50/70 border border-slate-200 rounded-2xl text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all shadow-sm"
              >
                <option value="all">학급 선택 필요</option>
                {classesList.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            {/* Time span options */}
            <div className="space-y-2">
              <label className="block text-xs font-extrabold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                <Clock className="h-3.5 w-3.5 text-indigo-500" /> 분석 기간 선택
              </label>
              <div className="flex bg-slate-100/80 p-1.5 rounded-2xl border border-slate-200/50 shadow-inner">
                {[
                  { id: "today", label: "오늘" },
                  { id: "7days", label: "최근 7일" },
                  { id: "all", label: "전체" }
                ].map((period) => (
                  <button
                    key={period.id}
                    type="button"
                    onClick={() => setSelectedPeriod(period.id as any)}
                    className={`px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${selectedPeriod === period.id ? "bg-white text-indigo-700 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}
                  >
                    {period.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-3">
            {selectedClass !== "all" && filteredSubmissions.length > 0 && (
              <div className="text-right mr-2 hidden sm:block">
                <div className="text-[10px] text-slate-400 font-bold uppercase">분석 대상</div>
                <div className="text-sm font-extrabold text-indigo-600">{filteredSubmissions.length}개 기록</div>
              </div>
            )}

            {hasCache ? (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => handleAnalyze(true)}
                  disabled={loading || selectedClass === "all" || filteredSubmissions.length === 0}
                  className="px-5 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl text-sm font-bold transition-all flex items-center justify-center gap-2 border border-slate-200 shadow-sm disabled:opacity-50 cursor-pointer"
                >
                  <RotateCw className={`h-4 w-4 text-slate-600 ${loading ? "animate-spin" : ""}`} />
                  다시 분석
                </button>
                <div className="px-5 py-3.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-2xl text-sm font-semibold flex items-center gap-1.5 shadow-sm">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" /> 로드 완료 (캐시)
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => handleAnalyze()}
                disabled={loading || selectedClass === "all" || filteredSubmissions.length === 0}
                className="px-7 py-3.5 bg-indigo-600 hover:bg-indigo-700 hover:scale-[1.02] active:scale-[0.98] text-white rounded-2xl text-sm font-bold shadow-md shadow-indigo-600/10 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:hover:scale-100 cursor-pointer"
              >
                {loading ? (
                  <>
                    <RotateCw className="h-4 w-4 animate-spin text-white" />
                    Gemini가 분석하는 중...
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 text-white fill-white" />
                    분석 시작
                  </>
                )}
              </button>
            )}
          </div>
        </section>

        {/* Error messaging */}
        {errorMsg && (
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-3 text-rose-800 text-sm shadow-sm animate-fade-in">
            <AlertCircle className="h-5 w-5 text-rose-600 shrink-0" />
            <span className="font-semibold">{errorMsg}</span>
          </div>
        )}

        {/* Interactive Layout Content */}
        {loading ? (
          /* Sleek Skeleton Loading state */
          <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm space-y-4 animate-pulse">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-slate-100 rounded-xl" />
                    <div className="h-4 bg-slate-100 rounded w-32" />
                  </div>
                  <div className="w-16 h-8 bg-slate-100 rounded-xl" />
                </div>
                <div className="space-y-2.5 pt-2">
                  <div className="h-3 bg-slate-100 rounded w-full" />
                  <div className="h-3 bg-slate-100 rounded w-[95%]" />
                  <div className="h-3 bg-slate-100 rounded w-[90%]" />
                  <div className="h-3 bg-slate-100 rounded w-[60%]" />
                </div>
              </div>
            ))}
          </section>
        ) : analysisResult ? (
          /* Actual Interactive Analysis Cards */
          <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Card A: Coach Frequency */}
            <div className="bg-white hover:shadow-lg hover:-translate-y-1 hover:border-indigo-200/80 transition-all duration-300 border border-slate-100 rounded-3xl p-6 flex flex-col justify-between shadow-sm relative group overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-50/40 rounded-full blur-xl group-hover:bg-indigo-100/50 transition-all duration-300" />
              <div>
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-indigo-50 border border-indigo-100 text-indigo-600 rounded-xl shadow-sm">
                      <TrendingUp className="h-5 w-5" />
                    </div>
                    <div>
                      <span className="text-[10px] text-indigo-500 font-extrabold uppercase tracking-widest">주제 A</span>
                      <h3 className="text-base font-bold text-slate-800">코치 호출 빈도 및 접근 패턴</h3>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 bg-indigo-50 text-indigo-700 text-[10px] font-bold rounded-full border border-indigo-100 shadow-sm">수학적 태도</span>
                </div>
                <p className="text-sm text-slate-600 leading-relaxed font-medium bg-slate-50/50 p-4 rounded-2xl border border-slate-100 min-h-[110px]">
                  {analysisResult.coachFrequency}
                </p>
              </div>
              <div className="mt-4 pt-2">
                <button
                  type="button"
                  onClick={() => handleCopyToClipboard("coachFrequency", analysisResult.coachFrequency)}
                  className={`w-full py-3 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                    copySuccessMap["coachFrequency"] 
                      ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/10" 
                      : "bg-slate-100 hover:bg-indigo-50 text-slate-700 hover:text-indigo-600"
                  }`}
                >
                  {copySuccessMap["coachFrequency"] ? (
                    <>
                      <CheckCircle2 className="h-4 w-4 text-white" />
                      도입 대본 복사 완료!
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4 text-slate-400 group-hover:text-indigo-500 transition-colors" />
                      내일 도입 자료로 복사
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Card B: Stuck Stages */}
            <div className="bg-white hover:shadow-lg hover:-translate-y-1 hover:border-violet-200/80 transition-all duration-300 border border-slate-100 rounded-3xl p-6 flex flex-col justify-between shadow-sm relative group overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-violet-50/40 rounded-full blur-xl group-hover:bg-violet-100/50 transition-all duration-300" />
              <div>
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-violet-50 border border-violet-100 text-violet-600 rounded-xl shadow-sm">
                      <HelpCircle className="h-5 w-5" />
                    </div>
                    <div>
                      <span className="text-[10px] text-violet-500 font-extrabold uppercase tracking-widest">주제 B</span>
                      <h3 className="text-base font-bold text-slate-800">풀이 상의 주요 병목 단계</h3>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 bg-violet-50 text-violet-700 text-[10px] font-bold rounded-full border border-violet-100 shadow-sm">취약점 분석</span>
                </div>
                <p className="text-sm text-slate-600 leading-relaxed font-medium bg-slate-50/50 p-4 rounded-2xl border border-slate-100 min-h-[110px]">
                  {analysisResult.stuckStages}
                </p>
              </div>
              <div className="mt-4 pt-2">
                <button
                  type="button"
                  onClick={() => handleCopyToClipboard("stuckStages", analysisResult.stuckStages)}
                  className={`w-full py-3 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                    copySuccessMap["stuckStages"] 
                      ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/10" 
                      : "bg-slate-100 hover:bg-violet-50 text-slate-700 hover:text-violet-600"
                  }`}
                >
                  {copySuccessMap["stuckStages"] ? (
                    <>
                      <CheckCircle2 className="h-4 w-4 text-white" />
                      도입 대본 복사 완료!
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4 text-slate-400 group-hover:text-violet-500 transition-colors" />
                      내일 도입 자료로 복사
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Card C: Misconceptions */}
            <div className="bg-white hover:shadow-lg hover:-translate-y-1 hover:border-rose-200/80 transition-all duration-300 border border-slate-100 rounded-3xl p-6 flex flex-col justify-between shadow-sm relative group overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-rose-50/40 rounded-full blur-xl group-hover:bg-rose-100/50 transition-all duration-300" />
              <div>
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-rose-50 border border-rose-100 text-rose-600 rounded-xl shadow-sm">
                      <AlertCircle className="h-5 w-5" />
                    </div>
                    <div>
                      <span className="text-[10px] text-rose-500 font-extrabold uppercase tracking-widest">주제 C</span>
                      <h3 className="text-base font-bold text-slate-800">반복되는 오개념 및 논리적 오류</h3>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 bg-rose-50 text-rose-700 text-[10px] font-bold rounded-full border border-rose-100 shadow-sm">오학습 교정</span>
                </div>
                <p className="text-sm text-slate-600 leading-relaxed font-medium bg-slate-50/50 p-4 rounded-2xl border border-slate-100 min-h-[110px]">
                  {analysisResult.misconceptions}
                </p>
              </div>
              <div className="mt-4 pt-2">
                <button
                  type="button"
                  onClick={() => handleCopyToClipboard("misconceptions", analysisResult.misconceptions)}
                  className={`w-full py-3 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                    copySuccessMap["misconceptions"] 
                      ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/10" 
                      : "bg-slate-100 hover:bg-rose-50 text-slate-700 hover:text-rose-600"
                  }`}
                >
                  {copySuccessMap["misconceptions"] ? (
                    <>
                      <CheckCircle2 className="h-4 w-4 text-white" />
                      도입 대본 복사 완료!
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4 text-slate-400 group-hover:text-rose-500 transition-colors" />
                      내일 도입 자료로 복사
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Card D: Focus Students */}
            <div className="bg-white hover:shadow-lg hover:-translate-y-1 hover:border-emerald-200/80 transition-all duration-300 border border-slate-100 rounded-3xl p-6 flex flex-col justify-between shadow-sm relative group overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-50/40 rounded-full blur-xl group-hover:bg-emerald-100/50 transition-all duration-300" />
              <div>
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-emerald-50 border border-emerald-100 text-emerald-600 rounded-xl shadow-sm">
                      <Award className="h-5 w-5" />
                    </div>
                    <div>
                      <span className="text-[10px] text-emerald-500 font-extrabold uppercase tracking-widest">주제 D</span>
                      <h3 className="text-base font-bold text-slate-800">개별 피드백 및 관찰 대상 학생</h3>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 text-[10px] font-bold rounded-full border border-emerald-100 shadow-sm">맞춤형 지도</span>
                </div>
                <p className="text-sm text-slate-600 leading-relaxed font-medium bg-slate-50/50 p-4 rounded-2xl border border-slate-100 min-h-[110px]">
                  {analysisResult.focusStudents}
                </p>
              </div>
              <div className="mt-4 pt-2">
                <button
                  type="button"
                  onClick={() => handleCopyToClipboard("focusStudents", analysisResult.focusStudents)}
                  className={`w-full py-3 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                    copySuccessMap["focusStudents"] 
                      ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/10" 
                      : "bg-slate-100 hover:bg-emerald-50 text-slate-700 hover:text-emerald-600"
                  }`}
                >
                  {copySuccessMap["focusStudents"] ? (
                    <>
                      <CheckCircle2 className="h-4 w-4 text-white" />
                      도입 대본 복사 완료!
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4 text-slate-400 group-hover:text-emerald-500 transition-colors" />
                      내일 도입 자료로 복사
                    </>
                  )}
                </button>
              </div>
            </div>
          </section>
        ) : (
          /* Empty / Initial State */
          <section className="bg-white border border-slate-150 rounded-3xl p-16 text-center shadow-sm max-w-2xl mx-auto space-y-4">
            <div className="w-16 h-16 bg-indigo-50 border border-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto shadow-sm">
              <BookOpen className="h-8 w-8 text-indigo-500" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-800">
                {selectedClass === "all" ? "학급을 먼저 선택해 주세요" : "수업 분석 준비 완료"}
              </h3>
              <p className="text-xs text-slate-400 mt-2 max-w-md mx-auto leading-relaxed">
                {selectedClass === "all" 
                  ? "분석 대상 학급을 드롭다운에서 선택하여 주시면, 해당 학급의 성찰 제출 기록을 모아 분석을 시작할 수 있습니다." 
                  : `선택하신 학급 및 기간에 ${filteredSubmissions.length}개의 학생 제출 기록이 있습니다. 위의 [분석 시작] 버튼을 누르면 Gemini AI 분석이 시작됩니다.`}
              </p>
            </div>
            {selectedClass !== "all" && filteredSubmissions.length === 0 && (
              <div className="p-4 bg-amber-50 border border-amber-100 rounded-2xl text-xs text-amber-800 font-semibold max-w-md mx-auto">
                선택한 학급 및 기간에 해당하는 성찰 기록이 없습니다.
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  );
}
