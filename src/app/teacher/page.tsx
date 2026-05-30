"use client";

import React, { useState, useEffect } from "react";
import { MathView } from "@/components/MathView";
import { coaches } from "@/lib/coaches";
import { 
  Download, 
  Upload, 
  ArrowLeft, 
  Search, 
  GraduationCap, 
  Users, 
  FileText,
  Clock,
  CheckCircle,
  HelpCircle,
  FileCheck,
  Trash2
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
  studentSolution?: string;
  studentSolutionImage?: string;
  studentExplanation: string;
  isSolved: boolean;
  coachResponses: Record<string, string>;
  comparisonLogs: Record<string, string>;
  finalReflection: string;
}

const DEFAULT_PROBLEMS = [
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

export default function TeacherPage() {
  const [activeTab, setActiveTab] = useState<"dashboard" | "presets">("dashboard");
  const [presetProblems, setPresetProblems] = useState<any[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [selectedClass, setSelectedClass] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);
  const [selectedDetailCoachId, setSelectedDetailCoachId] = useState<string>("algebra");
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    const loadData = async () => {
      try {
        const problemsRes = await fetch("/api/problems");
        if (problemsRes.ok) {
          const probs = await problemsRes.json();
          setPresetProblems(probs);
        } else {
          setPresetProblems(DEFAULT_PROBLEMS);
        }
      } catch (e) {
        setPresetProblems(DEFAULT_PROBLEMS);
      }

      try {
        const subsRes = await fetch("/api/submissions");
        if (subsRes.ok) {
          const subs = await subsRes.json();
          setSubmissions(subs);
        }
      } catch (e) {}
    };
    loadData();
  }, []);

  const saveSubmissions = (newSubs: Submission[]) => {
    setSubmissions(newSubs);
    localStorage.setItem("math_coach_submissions", JSON.stringify(newSubs));
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files);
    let loadedCount = 0;
    const newSubmissions: Submission[] = [...submissions];
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const content = event.target?.result as string;
          const parsed = JSON.parse(content);
          if (parsed.studentInfo && parsed.problem && (parsed.studentSolution || parsed.studentSolutionImage)) {
            const isDuplicate = newSubmissions.some(
              (sub) => 
                sub.studentInfo.className === parsed.studentInfo.className &&
                sub.studentInfo.number === parsed.studentInfo.number &&
                sub.studentInfo.name === parsed.studentInfo.name &&
                sub.problem === parsed.problem
            );
            if (!isDuplicate) {
              parsed.id = parsed.id || `${Date.now()}-${parsed.studentInfo.name}-${Math.random()}`;
              newSubmissions.push(parsed);
            }
          }
        } catch (err) {}
        loadedCount++;
        if (loadedCount === files.length) {
          saveSubmissions(newSubmissions);
          alert(`${files.length}개 파일 처리 완료`);
        }
      };
      reader.readAsText(file);
    });
  };

  const handleDownloadAll = () => {
    if (submissions.length === 0) return;
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(submissions, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `학급_수학성찰기록_일괄.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleDeleteSubmission = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("이 학생의 제출 기록을 정말 삭제하시겠습니까?")) {
      try {
        const res = await fetch(`/api/submissions?id=${id}`, {
          method: "DELETE"
        });
        if (res.ok) {
          const filtered = submissions.filter((sub) => sub.id !== id);
          setSubmissions(filtered);
          if (selectedSubmission?.id === id) setSelectedSubmission(null);
        } else {
          alert("제출 기록 삭제에 실패했습니다.");
        }
      } catch (err) {
        console.error(err);
        alert("삭제 처리 중 오류가 발생했습니다.");
      }
    }
  };

  const handleClearAll = async () => {
    if (confirm("모든 제출 기록을 삭제하시겠습니까?")) {
      try {
        const res = await fetch("/api/submissions", {
          method: "DELETE"
        });
        if (res.ok) {
          setSubmissions([]);
          setSelectedSubmission(null);
        } else {
          alert("모든 기록 삭제에 실패했습니다.");
        }
      } catch (err) {
        console.error(err);
        alert("삭제 처리 중 오류가 발생했습니다.");
      }
    }
  };

  const handleSavePresets = async () => {
    const customOption = presetProblems.find((p) => p.id === "custom") || {
      id: "custom",
      title: "직접 문제 입력",
      content: "",
    };
    const userProblems = presetProblems.filter((p) => p.id !== "custom" && p.id.trim() !== "");
    const finalPresets = [...userProblems, customOption];

    try {
      const res = await fetch("/api/problems", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(finalPresets)
      });
      if (res.ok) {
        const updated = await res.json();
        setPresetProblems(updated);
        alert("과제 문제가 데이터베이스에 성공적으로 설정되었습니다!");
      } else {
        alert("과제 문제 설정 저장에 실패했습니다.");
      }
    } catch (err) {
      console.error(err);
      alert("과제 설정 저장 도중 오류가 발생했습니다.");
    }
  };

  const handleResetPresets = async () => {
    if (confirm("초기 기본 문제로 복원하시겠습니까?")) {
      try {
        const res = await fetch("/api/problems", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify([...DEFAULT_PROBLEMS, { id: "custom", title: "직접 문제 입력", content: "" }])
        });
        if (res.ok) {
          const updated = await res.json();
          setPresetProblems(updated);
          alert("기본 문제로 복원되었습니다.");
        }
      } catch (err) {
        console.error(err);
        alert("기본 문제 복원 도중 오류가 발생했습니다.");
      }
    }
  };

  const handleUpdatePreset = (index: number, field: "title" | "content", value: string) => {
    const updated = [...presetProblems];
    updated[index] = { ...updated[index], [field]: value };
    setPresetProblems(updated);
  };

  const handleAddPreset = () => {
    const newProb = {
      id: `prob-${Date.now()}`,
      title: "새로운 과제 문제",
      content: "여기에 LaTeX 수식을 포함한 수학 문제 지문을 작성해 주세요.",
    };
    const updated = [...presetProblems];
    const customIndex = updated.findIndex((p) => p.id === "custom");
    if (customIndex !== -1) updated.splice(customIndex, 0, newProb);
    else updated.push(newProb);
    setPresetProblems(updated);
  };

  const handleDeletePreset = (id: string) => {
    if (id === "custom") return;
    if (confirm("이 문제를 삭제하시겠습니까? (저장을 누르셔야 적용됩니다)")) {
      setPresetProblems(presetProblems.filter((p) => p.id !== id));
    }
  };

  const classesList = Array.from(new Set(submissions.map((sub) => sub.studentInfo.className)));
  const filteredSubmissions = submissions.filter((sub) => {
    const classMatches = selectedClass === "all" || sub.studentInfo.className === selectedClass;
    const nameOrNumMatches = 
      sub.studentInfo.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sub.studentInfo.number.includes(searchQuery) ||
      sub.studentInfo.className.toLowerCase().includes(searchQuery.toLowerCase());
    return classMatches && nameOrNumMatches;
  });

  const getSvgFromText = (text: string) => {
    if (!text) return null;
    const match = text.match(/```(?:xml|svg)?\s*(<svg[\s\S]*?<\/svg>)\s*```/i) || text.match(/(<svg[\s\S]*?<\/svg>)/i);
    return match ? match[1] : null;
  };

  const cleanTextFromSvg = (text: string) => {
    if (!text) return "";
    return text.replace(/```(?:xml|svg)?\s*<svg[\s\S]*?<\/svg>\s*```/gi, "").replace(/<svg[\s\S]*?<\/svg>/gi, "").trim();
  };

  if (!isClient) return null;

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-16">
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-b border-slate-200 px-6 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center space-x-3">
          <GraduationCap className="h-8 w-8 text-indigo-600" />
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-800">수학 다중풀이 코칭 - 교사 대시보드</h1>
            <p className="text-xs text-slate-500">학생들이 제출한 다중 성찰 기록 파일을 열람하고 평가합니다.</p>
          </div>
        </div>
        <div className="flex items-center space-x-3 text-sm">
          <a href="/" className="px-4 py-2 text-slate-600 hover:text-slate-700 font-medium hover:bg-slate-100 rounded-lg transition-colors flex items-center gap-1.5">
            <ArrowLeft className="h-4 w-4" /> 학생 화면으로
          </a>
        </div>
      </header>

      <div className="bg-white border-b border-slate-200 px-6 py-2 flex items-center space-x-6 shadow-sm">
        <button onClick={() => setActiveTab("dashboard")} className={`pb-2 pt-1 font-bold text-sm border-b-2 transition-all cursor-pointer ${activeTab === "dashboard" ? "border-indigo-600 text-indigo-600" : "border-transparent text-slate-500"}`}>학생 성찰기록 분석</button>
        <button onClick={() => setActiveTab("presets")} className={`pb-2 pt-1 font-bold text-sm border-b-2 transition-all cursor-pointer ${activeTab === "presets" ? "border-indigo-600 text-indigo-600" : "border-transparent text-slate-500"}`}>학습 과제 문제 설정</button>
      </div>

      {activeTab === "dashboard" ? (
        <div className="max-w-[1600px] mx-auto p-4 md:p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center space-x-4">
              <div className="p-3 bg-blue-50 text-blue-600 rounded-xl"><Users className="h-6 w-6" /></div>
              <div>
                <div className="text-xs text-slate-400 font-semibold">총 제출 학생 수</div>
                <div className="text-2xl font-bold text-slate-800">{submissions.length}명</div>
              </div>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center space-x-4">
              <div className="p-3 bg-purple-50 text-purple-600 rounded-xl"><GraduationCap className="h-6 w-6" /></div>
              <div>
                <div className="text-xs text-slate-400 font-semibold">참여 학급 수</div>
                <div className="text-2xl font-bold text-slate-800">{classesList.length}개 학급</div>
              </div>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center space-x-4">
              <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl"><FileCheck className="h-6 w-6" /></div>
              <div>
                <div className="text-xs text-slate-400 font-semibold">완전 해결 학생 비율</div>
                <div className="text-2xl font-bold text-slate-800">{submissions.length > 0 ? `${Math.round((submissions.filter(s => s.isSolved).length / submissions.length) * 100)}%` : "0%"}</div>
              </div>
            </div>
            <div className="bg-slate-900 text-white p-4 rounded-2xl shadow-sm flex flex-col justify-between">
              <div className="text-xs font-semibold text-slate-400">데이터 내보내기 및 관리</div>
              <div className="flex gap-2 mt-2">
                <button onClick={handleDownloadAll} className="flex-1 py-2 px-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5"><Download className="h-3.5 w-3.5" /> 일괄 다운로드</button>
                <button onClick={handleClearAll} className="py-2 px-2 bg-red-600/30 hover:bg-red-600 text-red-400 hover:text-white rounded-lg text-xs font-semibold flex items-center justify-center"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-12 bg-white border border-dashed border-slate-300 rounded-2xl p-6 text-center shadow-sm">
              <Upload className="h-10 w-10 text-indigo-500 mx-auto mb-3" />
              <h3 className="text-sm font-bold text-slate-700 mb-1">학생 기록 파일 불러오기</h3>
              <p className="text-xs text-slate-400 mb-4">학생들이 제출한 JSON 파일들을 선택하거나 여기에 드래그 앤 드롭 하세요.</p>
              <label className="inline-flex py-2.5 px-5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-bold cursor-pointer">
                파일 선택하기
                <input type="file" multiple accept=".json" onChange={handleFileUpload} className="hidden" />
              </label>
            </div>

            <div className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
              <h3 className="text-base font-bold text-slate-800">제출 학생 명단 ({filteredSubmissions.length}명)</h3>
              <div className="space-y-2">
                <div className="flex gap-2">
                  <select value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)} className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold">
                    <option value="all">전체 학급</option>
                    {classesList.map((c) => (<option key={c} value={c}>{c}</option>))}
                  </select>
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                    <input type="text" placeholder="이름 또는 학급 검색" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none" />
                  </div>
                </div>
              </div>

              <div className="space-y-2.5 max-h-[600px] overflow-y-auto">
                {filteredSubmissions.length === 0 ? (
                  <div className="py-20 text-center text-slate-400 text-xs">기록이 없습니다.</div>
                ) : (
                  filteredSubmissions.map((sub) => {
                    const isSelected = selectedSubmission?.id === sub.id;
                    const unlockedCount = Object.keys(sub.coachResponses).length;
                    return (
                      <div key={sub.id} onClick={() => { setSelectedSubmission(sub); const keys = Object.keys(sub.coachResponses); if (keys.length > 0) setSelectedDetailCoachId(keys[0]); }} className={`p-4 rounded-xl border cursor-pointer flex justify-between items-center group ${isSelected ? "border-indigo-600 bg-indigo-50/40" : "border-slate-200 hover:bg-slate-50"}`}>
                        <div className="space-y-1.5">
                          <div className="flex items-center space-x-2">
                            <span className="text-xs font-bold text-slate-500">{sub.studentInfo.className}</span>
                            <span className="text-xs font-semibold text-slate-400">{sub.studentInfo.number}번</span>
                            <span className="text-sm font-bold text-slate-800">{sub.studentInfo.name}</span>
                          </div>
                          <div className="flex items-center space-x-2.5">
                            {sub.isSolved ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[10px] font-bold"><CheckCircle className="h-3 w-3 mr-1" /> 해결</span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded bg-amber-50 text-amber-700 text-[10px] font-bold"><HelpCircle className="h-3 w-3 mr-1" /> 힌트</span>
                            )}
                            <span className="text-[10px] text-slate-400"><Clock className="h-3 w-3 mr-0.5" /> {sub.timestamp.split(" ")[1]}</span>
                          </div>
                        </div>
                        <div className="flex items-center space-x-3">
                          <div className="text-right">
                            <div className="text-[10px] font-semibold text-slate-400">참여 코치</div>
                            <div className="text-xs font-bold text-slate-600">{unlockedCount} / 3</div>
                          </div>
                          <button type="button" onClick={(e) => handleDeleteSubmission(sub.id, e)} className="p-1.5 text-slate-300 hover:text-red-500 transition-colors"><Trash2 className="h-4 w-4" /></button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm min-h-[600px] flex flex-col">
              {selectedSubmission ? (
                <div className="space-y-6 flex-1 flex flex-col">
                  <div className="border-b border-slate-100 pb-4 flex justify-between items-start">
                    <div>
                      <h3 className="text-lg font-bold text-slate-800">{selectedSubmission.studentInfo.name} 학생의 성찰기록</h3>
                      <p className="text-xs text-slate-400 mt-1">{selectedSubmission.studentInfo.className} · {selectedSubmission.studentInfo.number}번</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-4">
                      <div className="bg-blue-50/30 p-4 rounded-xl border border-blue-50">
                        <h4 className="text-xs font-bold text-blue-700 mb-1.5">선택 문제</h4>
                        <div className="text-xs text-slate-800 overflow-x-auto"><MathView text={selectedSubmission.problem} /></div>
                      </div>
                      <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                        <h4 className="text-xs font-bold text-slate-600 mb-1.5">학생 풀이 의도</h4>
                        <p className="text-xs text-slate-700 whitespace-pre-wrap">{selectedSubmission.studentExplanation}</p>
                      </div>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex flex-col">
                      <h4 className="text-xs font-bold text-slate-600 mb-2">학생 최초 풀이 과정</h4>
                      <div className="bg-white p-3.5 rounded-lg border border-slate-100 text-xs overflow-y-auto flex-1 max-h-[220px] flex items-center justify-center">
                        {selectedSubmission.studentSolutionImage ? (
                          <img src={selectedSubmission.studentSolutionImage} alt="Handwriting Drawing" className="max-h-[180px] w-auto object-contain bg-white rounded border border-slate-100" />
                        ) : (
                          <MathView text={selectedSubmission.studentSolution || ""} />
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-slate-150 pt-4 flex-1 flex flex-col space-y-4">
                    <h4 className="text-xs font-bold text-slate-500">AI 코칭 및 학생 비교 피드백</h4>
                    <div className="flex space-x-1.5 bg-slate-100 p-1 rounded-xl">
                      {coaches.map((c) => {
                        const hasFeedback = !!selectedSubmission.coachResponses[c.id];
                        return (
                          <button key={c.id} type="button" onClick={() => setSelectedDetailCoachId(c.id)} className={`flex-1 py-2 text-center text-xs font-bold rounded-lg ${selectedDetailCoachId === c.id ? "bg-white text-slate-800 shadow-sm" : hasFeedback ? "text-slate-600" : "text-slate-400 opacity-50"}`} disabled={!hasFeedback}>{c.name}</button>
                        );
                      })}
                    </div>

                    {selectedSubmission.coachResponses[selectedDetailCoachId] ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1">
                        <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100 flex flex-col overflow-y-auto max-h-[350px]">
                          <h5 className="text-[11px] font-bold text-slate-400 mb-2">코치 피드백 내용</h5>
                          {getSvgFromText(selectedSubmission.coachResponses[selectedDetailCoachId]) && (
                            <div className="mb-4 p-2 bg-slate-900 rounded-lg flex items-center justify-center">
                              <div className="w-full max-w-[200px] text-white" dangerouslySetInnerHTML={{ __html: getSvgFromText(selectedSubmission.coachResponses[selectedDetailCoachId]) || "" }} />
                            </div>
                          )}
                          <div className="text-xs text-slate-700 leading-relaxed bg-white p-3 rounded-lg border border-slate-50">
                            <MathView text={cleanTextFromSvg(selectedSubmission.coachResponses[selectedDetailCoachId])} />
                          </div>
                        </div>
                        <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100 flex flex-col">
                          <h5 className="text-[11px] font-bold text-slate-400 mb-2">학생의 대조 분석 기록</h5>
                          <div className="bg-white p-4 rounded-lg border border-slate-55 text-xs text-slate-700 flex-1 whitespace-pre-wrap">{selectedSubmission.comparisonLogs[selectedDetailCoachId]}</div>
                        </div>
                      </div>
                    ) : null}
                  </div>

                  <div className="border-t border-slate-150 pt-4 bg-emerald-50/30 p-4 rounded-xl border border-emerald-100">
                    <h4 className="text-xs font-bold text-emerald-800 mb-2"><FileText className="h-4 w-4 mr-1 text-emerald-600" /> 최종 종합 성찰 일지</h4>
                    <p className="text-xs text-slate-700 bg-white p-3 rounded-lg border border-emerald-100/50">{selectedSubmission.finalReflection}</p>
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-center text-slate-400 py-24 space-y-4">
                  <FileText className="h-16 w-16 text-slate-200" />
                  <div>
                    <h3 className="text-sm font-bold text-slate-600">열람할 학생 기록을 선택해 주세요</h3>
                    <p className="text-xs text-slate-400 mt-1">왼쪽 학생 목록에서 상세히 열람할 학생 카드를 클릭하세요.</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="max-w-4xl mx-auto p-6 bg-white rounded-2xl border border-slate-200 shadow-md space-y-6 my-6">
          <div className="border-b border-slate-100 pb-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h2 className="text-lg font-bold text-slate-800">학습 과제 문제 설정</h2>
              <p className="text-xs text-slate-500">학생 화면의 과제 선택 드롭다운에 들어갈 수학 문항 리스트를 직접 구성합니다.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={handleResetPresets} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold">기본값 복구</button>
              <button type="button" onClick={handleAddPreset} className="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-bold">+ 새 문제 추가</button>
              <button type="button" onClick={handleSavePresets} className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm shadow-indigo-500/10">설정 저장 및 학생 화면 동기화</button>
            </div>
          </div>

          <div className="space-y-4">
            {presetProblems.map((prob, idx) => {
              const isCustomOption = prob.id === "custom";
              return (
                <div key={prob.id} className={`p-5 rounded-xl border space-y-4 ${isCustomOption ? "bg-slate-50 border-slate-200" : "bg-white border-slate-150 shadow-sm"}`}>
                  <div className="flex justify-between items-center">
                    <div className="flex items-center space-x-2">
                      <span className="w-5 h-5 bg-indigo-50 text-indigo-700 border border-indigo-100 text-[10px] font-bold rounded-full flex items-center justify-center font-mono">{idx + 1}</span>
                      <span className="text-xs font-bold text-slate-500">{isCustomOption ? "기본 옵션 (수정 불가)" : "과제 문항"}</span>
                    </div>
                    {!isCustomOption ? (
                      <button type="button" onClick={() => handleDeletePreset(prob.id)} className="text-xs text-red-500 hover:underline font-bold">삭제</button>
                    ) : null}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="md:col-span-1 space-y-1.5">
                      <label className="block text-xs font-bold text-slate-500">문제 제목</label>
                      <input type="text" value={prob.title} onChange={(e) => handleUpdatePreset(idx, "title", e.target.value)} disabled={isCustomOption} className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white font-semibold" />
                    </div>
                    <div className="md:col-span-2 space-y-1.5">
                      <label className="block text-xs font-bold text-slate-500">문제 지문 (LaTeX 수식 기호 $ 사용 가능)</label>
                      {isCustomOption ? (
                        <div className="text-xs text-slate-400 italic py-2.5 bg-slate-150/70 border border-slate-200 px-3 rounded-lg">이 옵션은 학생이 문제를 자유롭게 직접 타이핑해 넣을 수 있도록 제공되는 기본 빈칸 창입니다.</div>
                      ) : (
                        <textarea value={prob.content} onChange={(e) => handleUpdatePreset(idx, "content", e.target.value)} placeholder="수식 지문은 $x^2$ 처럼 기호 $로 감싸 작성해 주세요." rows={3} className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white leading-relaxed font-mono" />
                      )}
                    </div>
                  </div>
                  {!isCustomOption && prob.content ? (
                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 text-[11px] text-slate-700">
                      <div className="font-bold text-indigo-600 mb-1">실시간 미리보기:</div>
                      <MathView text={prob.content} />
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </main>
  );
}
