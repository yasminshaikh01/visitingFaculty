import React, { useState, useEffect, useRef } from "react";
import Topbar from "./Topbar";
import {
  CalendarDays,
  Download,
  Share2,
  Search,
  Filter,
  ChevronDown,
  Loader2,
  FileText,
  RefreshCw,
  CheckCircle2,
  XCircle,
  X,
  Building2,
  Menu,
} from "lucide-react";
import api from "../../api/axiosInstance"; // Adjust the ../ as needed based on folder depth

const API_BASE = "/monthly-summary";

const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

// ─── Helpers ──────────────────────────────────────────────
function getCurrentMonthYear() {
  const now = new Date();
  return { month: MONTHS[now.getMonth()], year: now.getFullYear() };
}

function formatCurrency(num) {
  if (num == null) return "0";
  return Number(num).toLocaleString("en-IN");
}

// ─── Toast Component ──────────────────────────────────────
function Toast({ toast, onClose }) {
  if (!toast.show) return null;
  const isSuccess = toast.type === "success";
  return (
    <div className="fixed top-6 right-6 z-[9999] animate-slide-in">
      <div
        className={`flex items-center gap-3 px-5 py-3 rounded-xl shadow-2xl border backdrop-blur-sm ${
          isSuccess
            ? "bg-emerald-50/95 border-emerald-200 text-emerald-800"
            : "bg-red-50/95 border-red-200 text-red-800"
        }`}
      >
        {isSuccess ? (
          <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
        ) : (
          <XCircle className="w-5 h-5 text-red-500 shrink-0" />
        )}
        <span className="text-sm font-semibold">{toast.message}</span>
        <button onClick={onClose} className="ml-2 hover:opacity-70 transition-opacity">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// Main Component
// ═══════════════════════════════════════════════════════════
export default function MonthlySummary({ onMenuClick }) {
  const { month: curMonth, year: curYear } = getCurrentMonthYear();

  // ── Auth Role Logic ──────────────────────────────────────
  const sessionStr = sessionStorage.getItem('iipsCurrentSession');
  const session = sessionStr ? JSON.parse(sessionStr) : {};
  const isAdmin = session?.role === "admin"; // "admin" = Program Incharge

  // ── DYNAMIC THEME ENGINE ─────────────────────────────────
  const theme = isAdmin ? {
    // PROGRAM INCHARGE (ADMIN) AESTHETIC - Slate & Blue
    pageBg: "bg-slate-50",
    topbarBorder: "border-slate-100",
    iconBox: "bg-[#004DD2]",
    textDark: "text-slate-900",
    textNormal: "text-slate-800",
    textMuted: "text-slate-500",
    sessionBadge: "bg-blue-50 text-[#004DD2] border-blue-100",
    btnSecondary: "border-slate-200 text-slate-700 hover:bg-slate-50",
    cardBg: "bg-white border-slate-200",
    inputBg: "bg-slate-50 border-slate-200",
    focusRing: "focus-within:border-[#004DD2] focus-within:ring-1 focus-within:ring-[#004DD2]",
    monthPicker: "bg-white border-slate-200 focus:border-[#004DD2] focus:ring-1 focus:ring-[#004DD2]",
    applyBtn: "bg-slate-900 hover:bg-slate-800",
    loader: "text-[#004DD2]",
    courseBadge: "bg-blue-50 text-[#004DD2] border border-blue-100",
    tableHead: "bg-slate-50 border-slate-200 text-slate-700",
    tableRow: "border-slate-100 hover:bg-slate-50/50",
    textHighlight: "text-[#004DD2]",
    suggestItem: "text-slate-700 hover:bg-blue-50 hover:text-[#004DD2]",
    suggestIcon: "text-blue-500",
    divider: "border-slate-300",
    dividerDark: "border-slate-800",
  } : {
    // SUPER ADMIN AESTHETIC - Gray, Purple & Orange
    pageBg: "bg-gray-50",
    topbarBorder: "border-gray-100",
    iconBox: "bg-gradient-to-br from-purple-500 to-indigo-600",
    textDark: "text-gray-900",
    textNormal: "text-gray-800",
    textMuted: "text-gray-500",
    sessionBadge: "bg-orange-100 text-orange-700 border-orange-200",
    btnSecondary: "border-gray-200 text-gray-700 hover:bg-gray-50",
    cardBg: "bg-white border-gray-100",
    inputBg: "bg-gray-50 border-gray-200",
    focusRing: "focus-within:border-purple-400 focus-within:ring-2 focus-within:ring-purple-100",
    monthPicker: "bg-gray-50 border-gray-200 focus:border-purple-400 focus:ring-2 focus:ring-purple-100",
    applyBtn: "bg-gray-900 hover:bg-gray-800",
    loader: "text-purple-500",
    courseBadge: "bg-purple-50 text-purple-600 border border-transparent",
    tableHead: "bg-gray-50 border-gray-200 text-gray-700",
    tableRow: "border-gray-100 hover:bg-gray-50/70",
    textHighlight: "text-purple-600",
    suggestItem: "text-gray-700 hover:bg-purple-50 hover:text-purple-700",
    suggestIcon: "text-purple-400",
    divider: "border-gray-300",
    dividerDark: "border-gray-800",
  };

  // ── State ────────────────────────────────────────────────
  const [selectedMonth, setSelectedMonth] = useState(curMonth);
  const [selectedYear, setSelectedYear] = useState(curYear);
  const [courses, setCourses] = useState([]);
  const [selectedCourseId, setSelectedCourseId] = useState(null);
  const [summaryData, setSummaryData] = useState(null);
  const [allCoursesData, setAllCoursesData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isDownloadingInstitute, setIsDownloadingInstitute] = useState(false);
  const [isTriggering, setIsTriggering] = useState(false);
  const [toast, setToast] = useState({ show: false, message: "", type: "success" });
  const [hasApplied, setHasApplied] = useState(false);

  const dropdownRef = useRef(null);

  // ── Toast helper ─────────────────────────────────────────
  const showToast = (message, type = "success") => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast((p) => ({ ...p, show: false })), 4000);
  };

  // ── Close dropdown on outside click ──────────────────────
  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // ── Fetch all-courses grouped data ───────────────────────
  const fetchAllCourses = async (month, year) => {
    try {
      const { data } = await api.get(`${API_BASE}/all`, {
        params: { month, year },
      });
      if (data.success) {
        setAllCoursesData(data.data);
        if (data.data.courses) {
          setCourses(data.data.courses);
          if (isAdmin && data.data.courses.length > 0 && !selectedCourseId) {
            handleCourseSelect(data.data.courses[0].courseId || data.data.courses[0].course_id);
          }
        }
      }
    } catch (err) {
      console.error("Error fetching all courses summary:", err);
    }
  };

  // ── Fetch single-course (or combined) summary ────────────
  const fetchSummary = async (month, year, courseId) => {
    setLoading(true);
    try {
      const params = { month, year };
      if (courseId) params.courseId = courseId;
      const { data } = await api.get(API_BASE, { params });
      if (data.success) {
        setSummaryData(data.data);
      } else {
        setSummaryData(null);
      }
    } catch (err) {
      console.error("Error fetching summary:", err);
      setSummaryData(null);
    } finally {
      setLoading(false);
    }
  };

  // ── Apply filters ────────────────────────────────────────
  const handleApplyFilters = () => {
    setHasApplied(true);
    fetchAllCourses(selectedMonth, selectedYear);
    if (selectedCourseId || !isAdmin) {
      fetchSummary(selectedMonth, selectedYear, selectedCourseId);
    }
  };

  // ── Auto-load on mount with current month/year ───────────
  useEffect(() => {
    handleApplyFilters();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Global Auto-Refresh Listener ─────────────────────────
  useEffect(() => {
    const handleRefresh = () => {
      fetchAllCourses(selectedMonth, selectedYear);
      fetchSummary(selectedMonth, selectedYear, selectedCourseId);
    };
    
    window.addEventListener('refresh-dashboard', handleRefresh);
    return () => window.removeEventListener('refresh-dashboard', handleRefresh);
  }, [selectedMonth, selectedYear, selectedCourseId]);

  const handleCourseSelect = (courseId) => {
    setSelectedCourseId(courseId);
    setSearchQuery(""); 
    setShowSuggestions(false);
    fetchSummary(selectedMonth, selectedYear, courseId);
  };

  // ── Download single-course PDF ───────────────────────────
  const handleDownloadPDF = async () => {
    if (!selectedCourseId && !isAdmin) {
      handleDownloadInstitutePDF();
      return;
    }
    setIsDownloading(true);
    try {
      const response = await api.get(`${API_BASE}/download`, {
        params: { month: selectedMonth, year: selectedYear, courseId: selectedCourseId },
        responseType: "blob",
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `${selectedMonth}_${selectedYear}_course_${selectedCourseId}_summary.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      showToast("PDF downloaded successfully!");
    } catch (err) {
      console.error("PDF download error:", err);
      showToast("Failed to download PDF. Please try again.", "error");
    } finally {
      setIsDownloading(false);
    }
  };

  // ── Download full institute PDF ──────────────────────────
  const handleDownloadInstitutePDF = async () => {
    setIsDownloadingInstitute(true);
    try {
      const response = await api.get(`${API_BASE}/super-admin-pdf`, {
        params: { month: selectedMonth, year: selectedYear },
        responseType: "blob",
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `${selectedMonth}_${selectedYear}_institute_summary.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      showToast("Institute PDF downloaded successfully!");
    } catch (err) {
      console.error("Institute PDF download error:", err);
      showToast("Failed to download institute PDF.", "error");
    } finally {
      setIsDownloadingInstitute(false);
    }
  };

  // ── Refresh Data Button ──────────────────────────────────
  const handleTriggerNow = async () => {
    setIsTriggering(true);
    try {
      await fetchAllCourses(selectedMonth, selectedYear);
      await fetchSummary(selectedMonth, selectedYear, selectedCourseId);
      showToast("Data refreshed with latest attendance!");
    } catch (err) {
      console.error("Refresh error:", err);
      showToast("Failed to refresh data.", "error");
    } finally {
      setIsTriggering(false);
    }
  };

  // ── Month picker handler ─────────────────────────────────
  const handleMonthInputChange = (e) => {
    const val = e.target.value;
    if (!val) return;
    const [y, m] = val.split("-");
    const newYear = parseInt(y, 10);
    const newMonth = MONTHS[parseInt(m, 10) - 1];
    
    setSelectedYear(newYear);
    setSelectedMonth(newMonth);
    setHasApplied(true); 
    
    fetchAllCourses(newMonth, newYear);
    fetchSummary(newMonth, newYear, selectedCourseId);
  };

  const monthInputValue = `${selectedYear}-${String(MONTHS.indexOf(selectedMonth) + 1).padStart(2, "0")}`;

  // ── Build the flat faculty rows ──────────────────────────
  const buildFacultyRows = () => {
    if (!summaryData) return [];
    const facultyMap = new Map();

    const semesters = summaryData.semesters || [];
    semesters.forEach((sem) => {
      const entries = sem.faculties || sem.entries || sem.faculty || [];
      entries.forEach((entry) => {
        const key = entry.faculty_id || entry.uvfin || entry.faculty_name;
        if (facultyMap.has(key)) {
          facultyMap.get(key).totalAmount += Number(entry.total_amount || entry.totalAmount || entry.amount || 0);
        } else {
          facultyMap.set(key, {
            uvfin: entry.uvfin || "",
            name: entry.faculty_name || entry.name || entry.facultyName || "",
            totalAmount: Number(entry.total_amount || entry.totalAmount || entry.amount || 0),
          });
        }
      });
    });

    const rows = [];
    facultyMap.forEach((val) => rows.push(val));
    return rows;
  };

  const allBuiltFacultyRows = buildFacultyRows();

  const facultyRows = searchQuery.trim() 
    ? allBuiltFacultyRows.filter(r => 
        (r.name && r.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (r.uvfin && String(r.uvfin).toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : allBuiltFacultyRows;

  const getSuggestions = () => {
    if (!searchQuery.trim()) return { programs: [], faculties: [] };
    const q = searchQuery.toLowerCase();
    
    const programSuggestions = courses
      .filter((c) => {
        const name = c.courseName || c.course_name;
        return name && name.toLowerCase().includes(q);
      })
      .map(c => ({
        id: c.courseId || c.course_id,
        name: c.courseName || c.course_name
      }));

    const uniqueFaculties = [];
    const seen = new Set();
    for (const f of allBuiltFacultyRows) {
      if (!seen.has(f.name)) {
        seen.add(f.name);
        uniqueFaculties.push(f);
      }
    }

    const facultySuggestions = uniqueFaculties
      .filter((f) => 
        (f.name && f.name.toLowerCase().includes(q)) || 
        (f.uvfin && String(f.uvfin).toLowerCase().includes(q))
      );

    return { programs: programSuggestions, faculties: facultySuggestions };
  };

  const { programs: suggestedPrograms, faculties: suggestedFaculties } = getSuggestions();
  const grandTotal = summaryData?.grandTotal ?? summaryData?.grand_total ?? facultyRows.reduce((s, r) => s + r.totalAmount, 0);

  const selectedCourseName = selectedCourseId
    ? courses.find((c) => c.courseId === selectedCourseId || c.course_id === selectedCourseId)?.courseName ||
      courses.find((c) => c.courseId === selectedCourseId || c.course_id === selectedCourseId)?.course_name ||
      "Selected Course"
    : "All Courses Combined";

  const currentYearNow = new Date().getFullYear();

  const programIncharges = [
    "MBA (M) 5 yrs",
    "MBA (MS) 2 yrs",
    "M.Tech. (IT) 5 yrs",
    "MBA (E-Gp) 3 yrs",
    "MBA (APR) 2 yrs",
    "B.Com. (Hons)",
    "MCA 5 yrs",
    "M.Tech. (IT) 5 yrs",
    "M.Tech. (CS) 5 yrs",
  ];

  return (
    <div className={`flex flex-col h-full min-h-screen ${theme.pageBg}`}>
      <Toast toast={toast} onClose={() => setToast((p) => ({ ...p, show: false }))} />

      {/* ─── Custom Top Bar ─────────────────────────────── */}
      <div className={`flex flex-col xl:flex-row xl:items-center justify-between px-4 md:px-8 py-4 md:py-5 border-b bg-white gap-4 w-full ${theme.topbarBorder}`}>
        <div className="flex items-center gap-3">
          <button 
            onClick={onMenuClick}
            className={`p-2 -ml-2 rounded-lg lg:hidden transition-colors shrink-0 ${theme.textMuted} hover:bg-slate-100`}
          >
            <Menu className="w-6 h-6" />
          </button>
          
          <div className={`hidden md:flex w-10 h-10 rounded-xl items-center justify-center shrink-0 shadow-md ${theme.iconBox}`}>
            <CalendarDays className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className={`text-base md:text-lg font-bold leading-tight ${theme.textDark}`}>
              Monthly Summary Report
            </h2>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] md:text-xs font-semibold border ${theme.sessionBadge}`}>
                Current Session: {currentYearNow}-{(currentYearNow + 1).toString().slice(2)}
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 xl:flex items-center gap-3 w-full xl:w-auto">
          {/* Trigger Cron */}
          <button
            onClick={handleTriggerNow}
            disabled={isTriggering}
            className={`w-full xl:w-auto flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border bg-white text-sm font-semibold transition-all hover:shadow-sm disabled:opacity-50 ${theme.btnSecondary} ${isAdmin ? 'sm:col-span-1' : ''}`}
          >
            <RefreshCw className={`w-4 h-4 ${isTriggering ? "animate-spin" : ""}`} />
            <span className="truncate">{isTriggering ? "Triggering..." : "Refresh Data"}</span>
          </button>

          {/* Export PDF */}
          <button
            onClick={handleDownloadPDF}
            disabled={isDownloading || !hasApplied}
            className={`w-full xl:w-auto flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border bg-white text-sm font-semibold transition-all hover:shadow-sm disabled:opacity-50 ${theme.btnSecondary} ${isAdmin ? 'sm:col-span-2' : ''}`}
          >
            {isDownloading ? (
              <Loader2 className="w-4 h-4 animate-spin shrink-0" />
            ) : (
              <Download className="w-4 h-4 shrink-0" />
            )}
            <span className="truncate">Export PDF</span>
          </button>

          {/* Share / Institute PDF - HIDDEN FOR ADMINS */}
          {!isAdmin && (
            <button
              onClick={handleDownloadInstitutePDF}
              disabled={isDownloadingInstitute || !hasApplied}
              className="w-full xl:w-auto flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-sm font-semibold hover:from-purple-700 hover:to-indigo-700 transition-all shadow-md hover:shadow-lg disabled:opacity-50"
            >
              {isDownloadingInstitute ? (
                <Loader2 className="w-4 h-4 animate-spin shrink-0" />
              ) : (
                <Share2 className="w-4 h-4 shrink-0" />
              )}
              <span className="truncate">Share Report</span>
            </button>
          )}
        </div>
      </div>

      {/* ─── Content ────────────────────────────────────── */}
      <div className="p-4 md:p-8 flex-1 overflow-y-auto max-w-full">
        {/* ── Filter Bar ──────────────────────────────────── */}
        <div className={`rounded-2xl shadow-sm border p-4 md:p-5 mb-6 ${theme.cardBg}`}>
          <div className="flex flex-col lg:flex-row lg:items-end gap-4">
            {/* Search with Autocomplete */}
            <div className="flex-1 min-w-0 w-full relative" ref={dropdownRef}>
              <label className={`block text-xs font-semibold mb-1.5 tracking-wide ${theme.textMuted}`}>
                Search Report Data
              </label>
              <div className={`flex items-center gap-2 border rounded-xl px-4 py-2.5 transition-all outline-none ${theme.inputBg} ${theme.focusRing}`}>
                <Search className={`w-4 h-4 shrink-0 ${theme.textMuted}`} />
                <input
                  type="text"
                  placeholder="Search by faculty or program..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setShowSuggestions(true);
                  }}
                  onFocus={() => setShowSuggestions(true)}
                  className={`bg-transparent outline-none text-sm w-full placeholder:text-gray-400 ${theme.textNormal}`}
                />
                {searchQuery && (
                  <button 
                    onClick={() => {
                      setSearchQuery("");
                      setShowSuggestions(false);
                      if (selectedCourseId && !isAdmin) handleCourseSelect(null);
                    }}
                    className="p-0.5 hover:bg-gray-200 rounded-full transition-colors"
                  >
                    <X className={`w-4 h-4 ${theme.textMuted}`} />
                  </button>
                )}
              </div>

              {/* Suggestions Dropdown */}
              {showSuggestions && searchQuery.trim() && (suggestedPrograms.length > 0 || suggestedFaculties.length > 0) && (
                <div className={`absolute top-full left-0 right-0 mt-2 bg-white border rounded-xl shadow-xl z-50 max-h-80 overflow-y-auto animate-fade-in divide-y ${theme.cardBorder} divide-gray-100`}>
                  {!isAdmin && suggestedPrograms.length > 0 && (
                    <div className="py-2">
                      <div className="px-4 py-1 text-xs font-bold text-gray-400 uppercase tracking-wider">Programs</div>
                      {suggestedPrograms.map((p) => (
                        <button
                          key={p.id}
                          onClick={() => {
                            handleCourseSelect(p.id);
                          }}
                          className={`w-full text-left px-4 py-2 text-sm flex items-center gap-2 transition-colors ${theme.suggestItem}`}
                        >
                          <Building2 className={`w-4 h-4 ${theme.suggestIcon}`} />
                          <span className="truncate">{p.name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {suggestedFaculties.length > 0 && (
                    <div className="py-2">
                      <div className="px-4 py-1 text-xs font-bold text-gray-400 uppercase tracking-wider">Faculties</div>
                      {suggestedFaculties.map((f, idx) => (
                        <button
                          key={idx}
                          onClick={() => {
                            setSearchQuery(f.name);
                            setShowSuggestions(false);
                          }}
                          className={`w-full text-left px-4 py-2 text-sm flex items-center gap-2 transition-colors ${theme.suggestItem}`}
                        >
                          <FileText className={`w-4 h-4 ${theme.suggestIcon}`} />
                          <span className="truncate">{f.name}</span>
                          {f.uvfin && <span className="text-xs text-gray-400 ml-auto font-mono">{f.uvfin}</span>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Month Picker */}
            <div className="w-full lg:w-56 shrink-0">
              <label className={`block text-xs font-semibold mb-1.5 tracking-wide ${theme.textMuted}`}>
                Select Month
              </label>
              <input
                type="month"
                value={monthInputValue}
                onChange={handleMonthInputChange}
                className={`w-full border rounded-xl px-4 py-2.5 text-sm outline-none transition-all cursor-pointer ${theme.textNormal} ${theme.monthPicker}`}
              />
            </div>

            {/* Apply Button */}
            <button
              onClick={handleApplyFilters}
              className={`w-full lg:w-auto flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-white text-sm font-semibold transition-all shadow-sm whitespace-nowrap shrink-0 ${theme.applyBtn}`}
            >
              <Filter className="w-4 h-4 shrink-0" />
              Apply Filters
            </button>
          </div>
        </div>

        {/* ── Report Card ─────────────────────────────────── */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <Loader2 className={`w-10 h-10 animate-spin ${theme.loader}`} />
            <p className={`font-medium ${theme.textMuted}`}>Loading summary data...</p>
          </div>
        ) : !hasApplied ? (
          <div className={`flex flex-col items-center justify-center py-24 gap-4 px-4 text-center ${theme.textMuted}`}>
            <FileText className="w-16 h-16 opacity-50" />
            <p className="font-medium text-lg">Select month & year, then click "Apply Filters"</p>
          </div>
        ) : (
          <div className={`rounded-2xl shadow-sm border overflow-hidden ${theme.cardBg}`}>
            {/* ── Institute Header ───────────────────────── */}
            <div className={`border-b-2 mx-4 md:mx-10 mt-8 pb-6 text-center ${theme.dividerDark}`}>
              <div className="flex items-center justify-center gap-3 mb-2">
                <Building2 className={`w-5 h-5 md:w-6 md:h-6 shrink-0 ${theme.textNormal}`} />
                <h2 className={`text-sm md:text-xl font-bold tracking-wide uppercase ${theme.textDark}`}>
                  International Institute of Professional Studies
                </h2>
              </div>
              <p className={`text-xs md:text-sm font-medium tracking-wide uppercase ${theme.textMuted}`}>
                Devi Ahilya University, Indore
              </p>
              <div className="mt-4">
                <p className={`text-sm md:text-base font-bold ${theme.textNormal}`}>
                  Visiting Faculty Payment
                </p>
                <p className={`text-xs md:text-sm font-semibold tracking-widest uppercase mt-0.5 ${theme.textMuted}`}>
                  Monthly Summary
                </p>
              </div>
            </div>

            {/* ── Month / Year / Course ──────────────────── */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-6 md:px-10 py-5 text-center sm:text-left">
              <p className={`text-sm md:text-base font-bold ${theme.textNormal}`}>
                Month:{" "}
                <span className={`font-semibold ${theme.textMuted}`}>{selectedMonth}</span>
              </p>
              {selectedCourseId && (
                <p className={`text-xs md:text-sm font-semibold px-3 py-1 rounded-full ${theme.courseBadge}`}>
                  {selectedCourseName}
                </p>
              )}
              <p className={`text-sm md:text-base font-bold ${theme.textNormal}`}>
                Year:{" "}
                <span className={`font-semibold ${theme.textMuted}`}>{selectedYear}</span>
              </p>
            </div>

            {/* ── Data Table ─────────────────────────────── */}
            <div className="px-4 md:px-10 pb-6">
              <div className={`border rounded-xl overflow-hidden ${theme.cardBorder}`}>
                <div className="overflow-x-auto hide-scrollbar">
                  <table className="w-full text-sm min-w-[500px]">
                    <thead>
                      <tr className={`border-b ${theme.tableHead}`}>
                        <th className="text-left px-4 md:px-6 py-4 font-bold text-xs uppercase tracking-wider w-16 whitespace-nowrap">
                          S. No.
                        </th>
                        <th className="text-left px-4 md:px-6 py-4 font-bold text-xs uppercase tracking-wider w-28 whitespace-nowrap">
                          UVFIN
                        </th>
                        <th className="text-left px-4 md:px-6 py-4 font-bold text-xs uppercase tracking-wider whitespace-nowrap">
                          Name of Faculty
                        </th>
                        <th className="text-right px-4 md:px-6 py-4 font-bold text-xs uppercase tracking-wider w-40 whitespace-nowrap">
                          Total Amount
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {facultyRows.length > 0 ? (
                        facultyRows.map((row, idx) => (
                          <tr
                            key={row.uvfin || idx}
                            className={`border-b transition-colors ${theme.tableRow}`}
                          >
                            <td className={`px-4 md:px-6 py-4 font-medium whitespace-nowrap ${theme.textMuted}`}>
                              {idx + 1}.
                            </td>
                            <td className={`px-4 md:px-6 py-4 font-mono text-xs whitespace-nowrap ${theme.textMuted}`}>
                              {row.uvfin || "—"}
                            </td>
                            <td className={`px-4 md:px-6 py-4 font-medium whitespace-nowrap ${theme.textNormal}`}>
                              {row.name}
                            </td>
                            <td className={`px-4 md:px-6 py-4 text-right font-semibold tabular-nums whitespace-nowrap ${theme.textNormal}`}>
                              {formatCurrency(row.totalAmount)}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td
                            colSpan={4}
                            className={`px-6 py-12 text-center font-medium ${theme.textMuted}`}
                          >
                            <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                            No faculty data found for {selectedMonth} {selectedYear}
                          </td>
                        </tr>
                      )}

                      {/* Grand Total Row */}
                      {facultyRows.length > 0 && (
                        <tr className={`border-t-2 ${theme.tableHead}`}>
                          <td
                            colSpan={3}
                            className={`px-4 md:px-6 py-4 text-right font-bold uppercase tracking-wide text-sm whitespace-nowrap ${theme.textDark}`}
                          >
                            Grand Total
                          </td>
                          <td className={`px-4 md:px-6 py-4 text-right font-bold text-lg tabular-nums whitespace-nowrap ${theme.textHighlight}`}>
                            {formatCurrency(grandTotal)}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* ── Signature Blocks ────────────────────────── */}
            <div className="px-4 md:px-10 pb-8 pt-4">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 md:gap-x-8 gap-y-8">
                {programIncharges.map((name, idx) => (
                  <div key={idx} className="text-center">
                    <div className={`border-b mb-2 pb-8 ${theme.divider}`} />
                    <p className={`text-[10px] md:text-sm font-bold ${theme.textNormal}`}>
                      Program Incharge
                    </p>
                    <p className={`text-[9px] md:text-xs mt-0.5 ${theme.textMuted}`}>{name}</p>
                  </div>
                ))}
              </div>

              {/* Director Block */}
              <div className="mt-10 text-center max-w-xs mx-auto">
                <div className={`border-b mb-2 pb-8 ${theme.divider}`} />
                <p className={`text-sm font-bold ${theme.textNormal}`}>Director</p>
              </div>
            </div>

            {/* ── All Courses Grand Totals (HIDDEN FOR ADMINS) */}
            {!selectedCourseId && !isAdmin && allCoursesData && allCoursesData.courses && allCoursesData.courses.length > 0 && (
              <div className="px-4 md:px-10 pb-8">
                <div className={`border-t-2 pt-6 ${theme.cardBorder}`}>
                  <h3 className={`text-base font-bold mb-4 flex items-center gap-2 ${theme.textNormal}`}>
                    <CalendarDays className={`w-5 h-5 shrink-0 ${theme.suggestIcon}`} />
                    Course-wise Breakdown
                  </h3>
                  <div className={`border rounded-xl overflow-hidden ${theme.cardBorder}`}>
                    <div className="overflow-x-auto hide-scrollbar">
                      <table className="w-full text-sm min-w-[400px]">
                        <thead>
                          <tr className={`border-b ${theme.tableHead}`}>
                            <th className="text-left px-4 md:px-6 py-3 font-bold text-xs uppercase tracking-wider whitespace-nowrap">
                              Course
                            </th>
                            <th className="text-right px-4 md:px-6 py-3 font-bold text-xs uppercase tracking-wider w-40 whitespace-nowrap">
                              Grand Total
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {allCoursesData.courses.map((c) => (
                            <tr
                              key={c.courseId || c.course_id}
                              className={`border-b transition-colors cursor-pointer ${theme.tableRow}`}
                              onClick={() => handleCourseSelect(c.courseId || c.course_id)}
                            >
                              <td className={`px-4 md:px-6 py-3 font-medium whitespace-nowrap ${theme.textNormal}`}>
                                {c.courseName || c.course_name}
                              </td>
                              <td className={`px-4 md:px-6 py-3 text-right font-semibold tabular-nums whitespace-nowrap ${theme.textNormal}`}>
                                {formatCurrency(c.grandTotal || c.grand_total)}
                              </td>
                            </tr>
                          ))}
                          <tr className={`border-t-2 ${theme.tableHead}`}>
                            <td className={`px-4 md:px-6 py-3 font-bold uppercase text-xs md:text-sm whitespace-nowrap ${theme.textDark}`}>
                              Institute Grand Total
                            </td>
                            <td className={`px-4 md:px-6 py-3 text-right font-bold text-sm md:text-base tabular-nums whitespace-nowrap ${theme.textHighlight}`}>
                              {formatCurrency(
                                allCoursesData.grandTotal || allCoursesData.grand_total
                              )}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Inline Styles for animations ──────────────────── */}
      <style>{`
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        .animate-slide-in {
          animation: slideIn 0.35s cubic-bezier(0.16, 1, 0.3, 1);
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
          animation: fadeIn 0.2s ease-out;
        }
      `}</style>
    </div>
  );
}