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
// UPDATED: Added onMenuClick prop for the mobile Sidebar
export default function MonthlySummary({ onMenuClick }) {
  const { month: curMonth, year: curYear } = getCurrentMonthYear();

  // ── State ────────────────────────────────────────────────
  const [selectedMonth, setSelectedMonth] = useState(curMonth);
  const [selectedYear, setSelectedYear] = useState(curYear);
  const [courses, setCourses] = useState([]);
  const [selectedCourseId, setSelectedCourseId] = useState(null); // null = all combined
  const [summaryData, setSummaryData] = useState(null);
  const [allCoursesData, setAllCoursesData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showCourseDropdown, setShowCourseDropdown] = useState(false);
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
        setShowCourseDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // ── Fetch all-courses grouped data (for course list + grand view)
  const fetchAllCourses = async (month, year) => {
    try {
      const { data } = await api.get(`${API_BASE}/all`, {
        params: { month, year },
      });
      if (data.success) {
        setAllCoursesData(data.data);
        // Build course list from response
        if (data.data.courses) {
          setCourses(data.data.courses);
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
    fetchSummary(selectedMonth, selectedYear, selectedCourseId);
  };

  // ── Auto-load on mount with current month/year ───────────
  useEffect(() => {
    handleApplyFilters();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── NEW: Global Auto-Refresh ─────────────────────────────
  useEffect(() => {
    const handleRefresh = () => {
      if (hasApplied) {
        fetchAllCourses(selectedMonth, selectedYear);
        fetchSummary(selectedMonth, selectedYear, selectedCourseId);
      }
    };
    
    window.addEventListener('refresh-dashboard', handleRefresh);
    return () => window.removeEventListener('refresh-dashboard', handleRefresh);
  }, [selectedMonth, selectedYear, selectedCourseId, hasApplied]);

  // ── When course selection changes, refetch ───────────────
  const handleCourseSelect = (courseId) => {
    setSelectedCourseId(courseId);
    setShowCourseDropdown(false);
    fetchSummary(selectedMonth, selectedYear, courseId);
  };

  // ── Download single-course PDF ───────────────────────────
  const handleDownloadPDF = async () => {
    if (!selectedCourseId) {
      // If no specific course is selected, download institute PDF instead
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

  // ── Trigger cron job ─────────────────────────────────────
  const handleTriggerNow = async () => {
    setIsTriggering(true);
    try {
      const { data } = await api.post(`${API_BASE}/trigger-now`);
      if (data.success) {
        showToast(data.message || "Monthly summary job triggered successfully!");
        // Refresh data after a short delay to allow the backend to process
        setTimeout(() => {
          handleApplyFilters();
          window.dispatchEvent(new Event('refresh-dashboard')); // Tell others to refresh too
        }, 2000);
      }
    } catch (err) {
      console.error("Trigger error:", err);
      showToast("Failed to trigger monthly summary job.", "error");
    } finally {
      setIsTriggering(false);
    }
  };

  // ── Month picker handler ─────────────────────────────────
  const handleMonthInputChange = (e) => {
    const val = e.target.value; // "2026-07"
    if (!val) return;
    const [y, m] = val.split("-");
    setSelectedYear(parseInt(y, 10));
    setSelectedMonth(MONTHS[parseInt(m, 10) - 1]);
  };

  // ── Derive month input value ─────────────────────────────
  const monthInputValue = `${selectedYear}-${String(MONTHS.indexOf(selectedMonth) + 1).padStart(2, "0")}`;

  // ── Build the flat faculty rows from summaryData ─────────
  // Backend shape from aggregateSummary():
  //   { semesters: [{ semester_number, faculties: [{ faculty_id, faculty_name, total_amount, ... }], semester_total }], grandTotal }
  const buildFacultyRows = () => {
    if (!summaryData) return [];
    const facultyMap = new Map();

    const semesters = summaryData.semesters || [];
    semesters.forEach((sem) => {
      // Backend uses "faculties" as the key
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

    // Apply search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return rows.filter(
        (r) =>
          (r.name && r.name.toLowerCase().includes(q)) ||
          (r.uvfin && String(r.uvfin).toLowerCase().includes(q))
      );
    }
    return rows;
  };

  const facultyRows = buildFacultyRows();
  const grandTotal = summaryData?.grandTotal ?? summaryData?.grand_total ?? facultyRows.reduce((s, r) => s + r.totalAmount, 0);

  // ── Determine selected course name ───────────────────────
  const selectedCourseName = selectedCourseId
    ? courses.find((c) => c.courseId === selectedCourseId || c.course_id === selectedCourseId)?.courseName ||
      courses.find((c) => c.courseId === selectedCourseId || c.course_id === selectedCourseId)?.course_name ||
      "Selected Course"
    : "All Courses Combined";

  // ── Year range for picker ────────────────────────────────
  const currentYear = new Date().getFullYear();

  // ── Signature blocks data ────────────────────────────────
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
    <div className="flex flex-col h-full bg-gray-50 min-h-screen">
      <Toast toast={toast} onClose={() => setToast((p) => ({ ...p, show: false }))} />

      {/* ─── Custom Top Bar ─────────────────────────────── */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between px-4 md:px-8 py-4 md:py-5 border-b border-gray-100 bg-white gap-4 w-full">
        <div className="flex items-center gap-3">
          {/* UPDATED: Mobile Menu Button */}
          <button 
            onClick={onMenuClick}
            className="p-2 -ml-2 rounded-lg hover:bg-gray-100 lg:hidden text-gray-600 transition-colors shrink-0"
          >
            <Menu className="w-6 h-6" />
          </button>
          
          <div className="hidden md:flex w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 items-center justify-center shrink-0 shadow-md">
            <CalendarDays className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-base md:text-lg font-bold text-gray-900 leading-tight">
              Monthly Summary Report
            </h2>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] md:text-xs font-semibold bg-orange-100 text-orange-700 border border-orange-200">
                Current Session: {currentYear}-{(currentYear + 1).toString().slice(2)}
              </span>
            </div>
          </div>
        </div>

        {/* UPDATED: Action buttons grid for responsiveness */}
        <div className="grid grid-cols-1 sm:grid-cols-3 xl:flex items-center gap-3 w-full xl:w-auto">
          {/* Trigger Cron */}
          <button
            onClick={handleTriggerNow}
            disabled={isTriggering}
            className="w-full xl:w-auto flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 text-gray-700 bg-white hover:bg-gray-50 text-sm font-semibold transition-all hover:shadow-sm disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isTriggering ? "animate-spin" : ""}`} />
            <span className="truncate">{isTriggering ? "Triggering..." : "Refresh Data"}</span>
          </button>

          {/* Export PDF */}
          <button
            onClick={handleDownloadPDF}
            disabled={isDownloading || !hasApplied}
            className="w-full xl:w-auto flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 text-gray-700 bg-white hover:bg-gray-50 text-sm font-semibold transition-all hover:shadow-sm disabled:opacity-50"
          >
            {isDownloading ? (
              <Loader2 className="w-4 h-4 animate-spin shrink-0" />
            ) : (
              <Download className="w-4 h-4 shrink-0" />
            )}
            <span className="truncate">Export PDF</span>
          </button>

          {/* Share / Institute PDF */}
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
        </div>
      </div>

      {/* ─── Content ────────────────────────────────────── */}
      <div className="p-4 md:p-8 flex-1 overflow-y-auto max-w-full">
        {/* ── Filter Bar ──────────────────────────────────── */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 md:p-5 mb-6">
          <div className="flex flex-col lg:flex-row lg:items-end gap-4">
            {/* Search */}
            <div className="flex-1 min-w-0 w-full">
              <label className="block text-xs font-semibold text-gray-500 mb-1.5 tracking-wide">
                Search Report Data
              </label>
              <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 focus-within:border-purple-400 focus-within:ring-2 focus-within:ring-purple-100 transition-all">
                <Search className="w-4 h-4 text-gray-400 shrink-0" />
                <input
                  type="text"
                  placeholder="Search by faculty or program..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-transparent outline-none text-sm text-gray-700 w-full placeholder:text-gray-400"
                />
              </div>
            </div>

            {/* Month Picker */}
            <div className="w-full lg:w-56 shrink-0">
              <label className="block text-xs font-semibold text-gray-500 mb-1.5 tracking-wide">
                Select Month
              </label>
              <input
                type="month"
                value={monthInputValue}
                onChange={handleMonthInputChange}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-700 focus:border-purple-400 focus:ring-2 focus:ring-purple-100 outline-none transition-all cursor-pointer"
              />
            </div>

            {/* Course Dropdown */}
            <div className="w-full lg:w-64 relative shrink-0" ref={dropdownRef}>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5 tracking-wide">
                Select Program
              </label>
              <button
                onClick={() => setShowCourseDropdown(!showCourseDropdown)}
                className="w-full flex items-center justify-between bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-700 hover:border-purple-400 focus:border-purple-400 focus:ring-2 focus:ring-purple-100 outline-none transition-all"
              >
                <span className="truncate pr-2">
                  {selectedCourseId
                    ? selectedCourseName
                    : "All Programs (Institute)"}
                </span>
                <ChevronDown
                  className={`w-4 h-4 text-gray-400 shrink-0 transition-transform ${
                    showCourseDropdown ? "rotate-180" : ""
                  }`}
                />
              </button>

              {showCourseDropdown && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl z-50 max-h-60 overflow-y-auto animate-fade-in">
                  <button
                    onClick={() => handleCourseSelect(null)}
                    className={`w-full text-left px-4 py-3 text-sm hover:bg-purple-50 transition-colors ${
                      !selectedCourseId
                        ? "bg-purple-50 text-purple-700 font-semibold"
                        : "text-gray-700"
                    }`}
                  >
                    All Programs (Institute)
                  </button>
                  {courses.map((c) => {
                    const id = c.courseId || c.course_id;
                    const name = c.courseName || c.course_name;
                    return (
                      <button
                        key={id}
                        onClick={() => handleCourseSelect(id)}
                        className={`w-full text-left px-4 py-3 text-sm hover:bg-purple-50 transition-colors border-t border-gray-50 ${
                          selectedCourseId === id
                            ? "bg-purple-50 text-purple-700 font-semibold"
                            : "text-gray-700"
                        }`}
                      >
                        {name}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Apply Button */}
            <button
              onClick={handleApplyFilters}
              className="w-full lg:w-auto flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-gray-900 text-white text-sm font-semibold hover:bg-gray-800 transition-all shadow-sm whitespace-nowrap shrink-0"
            >
              <Filter className="w-4 h-4 shrink-0" />
              Apply Filters
            </button>
          </div>
        </div>

        {/* ── Report Card ─────────────────────────────────── */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <Loader2 className="w-10 h-10 animate-spin text-purple-500" />
            <p className="text-gray-500 font-medium">Loading summary data...</p>
          </div>
        ) : !hasApplied ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4 text-gray-400 px-4 text-center">
            <FileText className="w-16 h-16 text-gray-300" />
            <p className="font-medium text-lg">Select month & year, then click "Apply Filters"</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            {/* ── Institute Header ───────────────────────── */}
            <div className="border-b-2 border-gray-800 mx-4 md:mx-10 mt-8 pb-6 text-center">
              <div className="flex items-center justify-center gap-3 mb-2">
                <Building2 className="w-5 h-5 md:w-6 md:h-6 text-gray-700 shrink-0" />
                <h2 className="text-sm md:text-xl font-bold text-gray-900 tracking-wide uppercase">
                  International Institute of Professional Studies
                </h2>
              </div>
              <p className="text-xs md:text-sm text-gray-600 font-medium tracking-wide uppercase">
                Devi Ahilya University, Indore
              </p>
              <div className="mt-4">
                <p className="text-sm md:text-base font-bold text-gray-800">
                  Visiting Faculty Payment
                </p>
                <p className="text-xs md:text-sm font-semibold text-gray-500 tracking-widest uppercase mt-0.5">
                  Monthly Summary
                </p>
              </div>
            </div>

            {/* ── Month / Year / Course ──────────────────── */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-6 md:px-10 py-5 text-center sm:text-left">
              <p className="text-sm md:text-base font-bold text-gray-800">
                Month:{" "}
                <span className="text-gray-600 font-semibold">{selectedMonth}</span>
              </p>
              {selectedCourseId && (
                <p className="text-xs md:text-sm font-semibold text-purple-600 bg-purple-50 px-3 py-1 rounded-full">
                  {selectedCourseName}
                </p>
              )}
              <p className="text-sm md:text-base font-bold text-gray-800">
                Year:{" "}
                <span className="text-gray-600 font-semibold">{selectedYear}</span>
              </p>
            </div>

            {/* ── Data Table ─────────────────────────────── */}
            <div className="px-4 md:px-10 pb-6">
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                {/* UPDATED: Added overflow-x-auto to prevent table squishing on mobile */}
                <div className="overflow-x-auto hide-scrollbar">
                  <table className="w-full text-sm min-w-[500px]">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <th className="text-left px-4 md:px-6 py-4 font-bold text-gray-700 text-xs uppercase tracking-wider w-16 whitespace-nowrap">
                          S. No.
                        </th>
                        <th className="text-left px-4 md:px-6 py-4 font-bold text-gray-700 text-xs uppercase tracking-wider w-28 whitespace-nowrap">
                          UVFIN
                        </th>
                        <th className="text-left px-4 md:px-6 py-4 font-bold text-gray-700 text-xs uppercase tracking-wider whitespace-nowrap">
                          Name of Faculty
                        </th>
                        <th className="text-right px-4 md:px-6 py-4 font-bold text-gray-700 text-xs uppercase tracking-wider w-40 whitespace-nowrap">
                          Total Amount
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {facultyRows.length > 0 ? (
                        facultyRows.map((row, idx) => (
                          <tr
                            key={row.uvfin || idx}
                            className="border-b border-gray-100 hover:bg-gray-50/70 transition-colors"
                          >
                            <td className="px-4 md:px-6 py-4 text-gray-500 font-medium whitespace-nowrap">
                              {idx + 1}.
                            </td>
                            <td className="px-4 md:px-6 py-4 text-gray-600 font-mono text-xs whitespace-nowrap">
                              {row.uvfin || "—"}
                            </td>
                            <td className="px-4 md:px-6 py-4 text-gray-800 font-medium whitespace-nowrap">
                              {row.name}
                            </td>
                            <td className="px-4 md:px-6 py-4 text-right text-gray-800 font-semibold tabular-nums whitespace-nowrap">
                              {formatCurrency(row.totalAmount)}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td
                            colSpan={4}
                            className="px-6 py-12 text-center text-gray-400 font-medium"
                          >
                            <FileText className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                            No faculty data found for {selectedMonth} {selectedYear}
                          </td>
                        </tr>
                      )}

                      {/* Grand Total Row */}
                      {facultyRows.length > 0 && (
                        <tr className="bg-gray-50 border-t-2 border-gray-200">
                          <td
                            colSpan={3}
                            className="px-4 md:px-6 py-4 text-right font-bold text-gray-900 uppercase tracking-wide text-sm whitespace-nowrap"
                          >
                            Grand Total
                          </td>
                          <td className="px-4 md:px-6 py-4 text-right font-bold text-purple-600 text-lg tabular-nums whitespace-nowrap">
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
                    <div className="border-b border-gray-300 mb-2 pb-8" />
                    <p className="text-[10px] md:text-sm font-bold text-gray-700">
                      Program Incharge
                    </p>
                    <p className="text-[9px] md:text-xs text-gray-500 mt-0.5">{name}</p>
                  </div>
                ))}
              </div>

              {/* Director Block */}
              <div className="mt-10 text-center max-w-xs mx-auto">
                <div className="border-b border-gray-300 mb-2 pb-8" />
                <p className="text-sm font-bold text-gray-700">Director</p>
              </div>
            </div>

            {/* ── All Courses Grand Totals (when viewing all) */}
            {!selectedCourseId && allCoursesData && allCoursesData.courses && allCoursesData.courses.length > 0 && (
              <div className="px-4 md:px-10 pb-8">
                <div className="border-t-2 border-gray-200 pt-6">
                  <h3 className="text-base font-bold text-gray-800 mb-4 flex items-center gap-2">
                    <CalendarDays className="w-5 h-5 text-purple-500 shrink-0" />
                    Course-wise Breakdown
                  </h3>
                  <div className="border border-gray-200 rounded-xl overflow-hidden">
                    <div className="overflow-x-auto hide-scrollbar">
                      <table className="w-full text-sm min-w-[400px]">
                        <thead>
                          <tr className="bg-gray-50 border-b border-gray-200">
                            <th className="text-left px-4 md:px-6 py-3 font-bold text-gray-700 text-xs uppercase tracking-wider whitespace-nowrap">
                              Course
                            </th>
                            <th className="text-right px-4 md:px-6 py-3 font-bold text-gray-700 text-xs uppercase tracking-wider w-40 whitespace-nowrap">
                              Grand Total
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {allCoursesData.courses.map((c) => (
                            <tr
                              key={c.courseId || c.course_id}
                              className="border-b border-gray-100 hover:bg-gray-50/70 transition-colors cursor-pointer"
                              onClick={() => handleCourseSelect(c.courseId || c.course_id)}
                            >
                              <td className="px-4 md:px-6 py-3 text-gray-800 font-medium whitespace-nowrap">
                                {c.courseName || c.course_name}
                              </td>
                              <td className="px-4 md:px-6 py-3 text-right text-gray-800 font-semibold tabular-nums whitespace-nowrap">
                                {formatCurrency(c.grandTotal || c.grand_total)}
                              </td>
                            </tr>
                          ))}
                          <tr className="bg-gray-50 border-t-2 border-gray-200">
                            <td className="px-4 md:px-6 py-3 font-bold text-gray-900 uppercase text-xs md:text-sm whitespace-nowrap">
                              Institute Grand Total
                            </td>
                            <td className="px-4 md:px-6 py-3 text-right font-bold text-purple-600 text-sm md:text-base tabular-nums whitespace-nowrap">
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