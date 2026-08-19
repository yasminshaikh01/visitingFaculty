import React, { useEffect, useMemo, useState, useRef } from "react";
import { Search, Download, Calendar, Clock, IndianRupee, Filter, Users } from "lucide-react";
import LoadingSpinner from "./LoadingSpinner";
import api from "../../api/axiosInstance"; // Adjust the ../ as needed based on folder depth

const PAGE_SIZE = 7;

export default function AttendanceRecords() {
  // --- STATE: Faculty Search ---
  const [facultySearch, setFacultySearch] = useState("");
  const [selectedFacultyId, setSelectedFacultyId] = useState("");
  const [facultyOptions, setFacultyOptions] = useState([]);
  const [showFacultyDropdown, setShowFacultyDropdown] = useState(false);
  
  // --- Quick Select ---
  const [allFaculties, setAllFaculties] = useState([]);
  const [facultiesLoading, setFacultiesLoading] = useState(true);

  const dropdownRef = useRef(null);
  const filterRef = useRef(null);

  // --- STATE: Main UI ---
  const [activeFaculty, setActiveFaculty] = useState(null);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  
  // Filters & Sort
  const [subjectFilter, setSubjectFilter] = useState("");
  const [timelineFilter, setTimelineFilter] = useState("month"); // "", "day", "week", "month"
  const [sortOrder, setSortOrder] = useState("newest"); // "newest", "oldest"
  const [filterMenuOpen, setFilterMenuOpen] = useState(false);
  
  const [page, setPage] = useState(1);

  // ==========================================
  // 1. EVENT LISTENERS & INITIAL LOAD
  // ==========================================
  useEffect(() => {
    loadAllFaculties();

    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowFacultyDropdown(false);
      }
      if (filterRef.current && !filterRef.current.contains(e.target)) {
        setFilterMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // NEW: Listen for global refresh events to auto-update active faculty history
  useEffect(() => {
    const handleRefresh = () => {
      if (selectedFacultyId) {
        handleSearch(selectedFacultyId);
      }
      loadAllFaculties();
    };

    window.addEventListener('refresh-dashboard', handleRefresh);
    return () => window.removeEventListener('refresh-dashboard', handleRefresh);
  }, [selectedFacultyId]);

  const loadAllFaculties = async () => {
    setFacultiesLoading(true);
    try {
      const res = await api.get("/admin/search-faculty?q=");
      setAllFaculties(res.data.data || []);
    } catch (err) {
      console.error("Failed to load faculties for quick select");
    } finally {
      setFacultiesLoading(false);
    }
  };

  // ==========================================
  // 2. LIVE FACULTY SEARCH
  // ==========================================
  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (!facultySearch.trim()) {
        setFacultyOptions([]);
        return;
      }
      try {
        const res = await api.get(`/admin/search-faculty?q=${facultySearch}`);
        setFacultyOptions(res.data.data || []);
      } catch (err) {
        setFacultyOptions([]);
      }
    }, 400);

    return () => clearTimeout(delayDebounceFn);
  }, [facultySearch]);

  // ==========================================
  // 3. FETCH HISTORY 
  // ==========================================
  const handleSearch = async (idToSearch = null) => {
    const targetId = idToSearch || selectedFacultyId;
    
    if (!targetId) {
      setError("Please select a faculty member from the dropdown first.");
      return;
    }
    
    setLoading(true);
    setError("");
    
    try {
      const res = await api.get(`/attendance/history/${targetId}`);
      
      const fetchedRecords = res.data.data || [];
      setRecords(Array.isArray(fetchedRecords) ? fetchedRecords : []);
      
      const selected = facultyOptions.find(f => f.user_id === targetId) || allFaculties.find(f => f.user_id === targetId);
      setActiveFaculty({
        name: selected?.full_name || facultySearch || "Selected Faculty",
        session: "2024-25" 
      });
      
    } catch (err) {
      setError(err?.response?.data?.message || "No attendance records found for this faculty.");
      setRecords([]);
      setActiveFaculty(null);
    } finally {
      setLoading(false);
    }
  };

  // ==========================================
  // 4. DATA PROCESSING & FILTERS
  // ==========================================
  const subjects = useMemo(
    () => [...new Set(records.map((r) => r.subject_name).filter(Boolean))],
    [records]
  );

  const filteredAndSorted = useMemo(() => {
    let result = records.filter((r) => {
      const matchesSubject = !subjectFilter || r.subject_name === subjectFilter;
      
      let matchesTimeline = true;
      if (timelineFilter && r.attendance_date) {
        const recordDate = new Date(r.attendance_date);
        const today = new Date();
        
        if (timelineFilter === "day") {
          matchesTimeline = recordDate.toDateString() === today.toDateString();
        } else if (timelineFilter === "week") {
          const oneWeekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
          matchesTimeline = recordDate >= oneWeekAgo && recordDate <= today;
        } else if (timelineFilter === "month") {
          matchesTimeline = recordDate.getMonth() === today.getMonth() && recordDate.getFullYear() === today.getFullYear();
        }
      }
      
      return matchesSubject && matchesTimeline;
    });

    result.sort((a, b) => {
      const dateA = new Date(a.attendance_date || 0).getTime();
      const dateB = new Date(b.attendance_date || 0).getTime();
      return sortOrder === "newest" ? dateB - dateA : dateA - dateB;
    });

    return result;
  }, [records, subjectFilter, timelineFilter, sortOrder]);

  const totalPages = Math.max(1, Math.ceil(filteredAndSorted.length / PAGE_SIZE));
  const paginated = filteredAndSorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  
  useEffect(() => setPage(1), [subjectFilter, timelineFilter, sortOrder, records]);

  // ==========================================
  // TOTALS CALCULATION (With 30k Cap Logic)
  // ==========================================
  const totals = useMemo(() => {
    const classes = filteredAndSorted.length;
    const hours = filteredAndSorted.reduce((sum, r) => sum + (Number(r.hours) || 0), 0);
    const earnings = filteredAndSorted.reduce((sum, r) => {
      if (r.is_billable === false || r.is_billable === 0) return sum;
      
      const rate = Number(r.rate_per_hour) || 0;
      const hrs = Number(r.hours) || 0;
      return sum + (hrs * rate);
    }, 0);
    return { classes, hours, earnings };
  }, [filteredAndSorted]);

  // ==========================================
  // 5. EXPORT
  // ==========================================
  const handleExport = () => {
    const headers = ["Date", "Subject Code", "Subject Name", "Type", "Hours", "Rate", "Amount", "Status"];
    
    const rows = filteredAndSorted.map((r) => {
      const rate = Number(r.rate_per_hour) || 0;
      const hrs = Number(r.hours) || 0;
      const isCapped = r.is_billable === false || r.is_billable === 0;
      
      let formattedDate = r.attendance_date || "N/A";
      if (formattedDate !== "N/A") {
        const d = new Date(formattedDate);
        if (!isNaN(d.getTime())) {
          formattedDate = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ /g, '-');
        }
      }

      return [
        formattedDate,
        r.subject_code || "N/A",
        r.subject_name || "N/A",
        r.session_type || "N/A",
        r.hours,
        rate,
        isCapped ? 0 : (hrs * rate),
        isCapped ? "Capped (Unpaid)" : "Billable"
      ];
    });

    const csv = [headers, ...rows].map((row) => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${activeFaculty?.name?.replace(/\s+/g, '_')}_Attendance.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <main className="p-4 sm:p-6 space-y-5 w-full bg-slate-50/50 min-h-screen max-w-full overflow-hidden">
      
      {/* SEARCH BAR */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col sm:flex-row gap-3 items-stretch shadow-sm w-full">
        <div className="flex-1 relative" ref={dropdownRef}>
          <label className="text-sm font-medium text-slate-700 mb-1 block">Faculty Search</label>
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={facultySearch}
              onChange={(e) => {
                setFacultySearch(e.target.value);
                setSelectedFacultyId("");
                setShowFacultyDropdown(true);
              }}
              onFocus={() => setShowFacultyDropdown(true)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="Search faculty name..."
              className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
            />
          </div>
          
          {/* Dropdown Menu */}
          {showFacultyDropdown && facultyOptions.length > 0 && (
            <ul className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
              {facultyOptions.map((f) => (
                <li
                  key={f.user_id}
                  onClick={() => {
                    setSelectedFacultyId(f.user_id);
                    setFacultySearch(`${f.full_name} (${f.email})`);
                    setShowFacultyDropdown(false);
                    handleSearch(f.user_id);
                  }}
                  className="px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 cursor-pointer border-b border-slate-50 last:border-0"
                >
                  {f.full_name} ({f.email})
                </li>
              ))}
            </ul>
          )}
        </div>
        <button
          onClick={() => handleSearch()}
          className="self-end w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg bg-[#0b57d0] text-white text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm"
        >
          <Search size={16} /> Search
        </button>
      </div>

      {/* QUICK SELECT FACULTY LIST */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 shadow-sm mb-2 w-full">
        <h2 className="text-sm font-semibold text-slate-800 mb-4 flex items-center gap-2">
          <Users size={16} className="text-[#0b57d0]" /> Quick Select Faculty
        </h2>
        
        {facultiesLoading ? (
          <div className="text-sm text-slate-400 py-2">Loading faculty list...</div>
        ) : allFaculties.length === 0 ? (
          <div className="text-sm text-slate-400 py-2">No faculty members found.</div>
        ) : (
          <ul className="max-h-40 overflow-y-auto pr-2 space-y-2 hide-scrollbar">
            {allFaculties.map((f) => (
              <li key={f.user_id}>
                <button
                  onClick={() => {
                    setSelectedFacultyId(f.user_id);
                    setFacultySearch(`${f.full_name} (${f.email})`);
                    handleSearch(f.user_id);
                  }}
                  className={`w-full text-left px-4 py-3 rounded-lg border transition-all ${
                    selectedFacultyId === f.user_id
                      ? "bg-blue-50 border-blue-200 shadow-sm"
                      : "bg-white border-slate-200 hover:bg-slate-50 hover:border-slate-300"
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 sm:gap-0">
                    <span className={`text-sm font-medium truncate ${selectedFacultyId === f.user_id ? 'text-[#0b57d0]' : 'text-slate-700'}`}>
                      {f.full_name}
                    </span>
                    <span className={`text-xs truncate ${selectedFacultyId === f.user_id ? 'text-blue-600' : 'text-slate-400'}`}>
                      {f.email}
                    </span>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {loading && <LoadingSpinner fullPage label="Fetching attendance history..." />}

      {!loading && error && (
        <p className="text-sm text-red-500 text-center py-6 bg-red-50 rounded-lg border border-red-100">{error}</p>
      )}

      {/* DASHBOARD PREVIEW */}
      {!loading && activeFaculty && (
        <>
          <div className="pt-2 flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
            <div>
              <h2 className="text-xl font-bold text-slate-800">{activeFaculty.name}</h2>
              <p className="text-sm text-slate-400 mt-1">
                {new Date().toLocaleString("en-US", { month: "long", year: "numeric" })} · Session{" "}
                {activeFaculty.session || "2024-25"}
              </p>
            </div>
            
            <button 
              onClick={() => { setActiveFaculty(null); setRecords([]); setSelectedFacultyId(""); setFacultySearch(""); }}
              className="text-sm text-[#0b57d0] hover:underline font-medium"
            >
              Search different faculty
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard icon={Calendar} label="Classes Submitted" value={totals.classes} />
            <StatCard icon={Clock} label="Total Hours" value={`${totals.hours} hrs`} />
            <StatCard icon={IndianRupee} label="Total Earnings" value={`₹${totals.earnings.toLocaleString("en-IN")}`} />
          </div>

          {/* TABLE */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm w-full">
            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between px-4 sm:px-6 py-4 border-b border-slate-100">
              <div className="flex flex-wrap gap-3 w-full sm:w-auto">
                <select
                  value={subjectFilter}
                  onChange={(e) => setSubjectFilter(e.target.value)}
                  className="w-full sm:w-auto px-3 py-2.5 rounded-lg border border-slate-200 text-sm bg-white focus:outline-none focus:border-blue-500 min-w-[160px]"
                >
                  <option value="">All Subjects</option>
                  {subjects.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>

                <select
                  value={timelineFilter}
                  onChange={(e) => setTimelineFilter(e.target.value)}
                  className="w-full sm:w-auto px-3 py-2.5 rounded-lg border border-slate-200 text-sm bg-white focus:outline-none focus:border-blue-500 min-w-[140px]"
                >
                  <option value="">Current Session</option>
                  <option value="day">Day</option>
                  <option value="week">Week</option>
                  <option value="month">Month</option>
                </select>
              </div>

              <div className="relative w-full sm:w-auto flex justify-end" ref={filterRef}>
                <button 
                  onClick={() => setFilterMenuOpen(!filterMenuOpen)}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  <Filter size={16} className="text-slate-500"/> Filter
                </button>
                
                {filterMenuOpen && (
                  <div className="absolute right-0 mt-2 w-56 bg-white border border-slate-200 rounded-xl shadow-lg py-1.5 z-20">
                    <div className="px-3 py-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wider">Sort by Date</div>
                    <button
                      onClick={() => { setSortOrder("newest"); setFilterMenuOpen(false); }}
                      className={`w-full text-left px-4 py-2.5 text-sm hover:bg-slate-50 transition-colors ${sortOrder === "newest" ? "text-blue-600 font-medium bg-blue-50/50" : "text-slate-700"}`}
                    >
                      Date: Newest to Oldest
                    </button>
                    <button
                      onClick={() => { setSortOrder("oldest"); setFilterMenuOpen(false); }}
                      className={`w-full text-left px-4 py-2.5 text-sm hover:bg-slate-50 transition-colors ${sortOrder === "oldest" ? "text-blue-600 font-medium bg-blue-50/50" : "text-slate-700"}`}
                    >
                      Date: Oldest to Newest
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="overflow-x-auto hide-scrollbar w-full">
              <table className="w-full text-sm text-left min-w-[700px]">
                <thead>
                  <tr className="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                    <th className="px-4 sm:px-5 py-4 whitespace-nowrap">SN.</th>
                    <th className="px-4 sm:px-5 py-4 whitespace-nowrap">Date</th>
                    <th className="px-4 sm:px-5 py-4 whitespace-nowrap">Subject Code</th>
                    <th className="px-4 sm:px-5 py-4 whitespace-nowrap">Subject Name</th>
                    <th className="px-4 sm:px-5 py-4 whitespace-nowrap">Type</th>
                    <th className="px-4 sm:px-5 py-4 whitespace-nowrap">Hours</th>
                    <th className="px-4 sm:px-5 py-4 whitespace-nowrap">Rate</th>
                    <th className="px-4 sm:px-5 py-4 whitespace-nowrap">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.length === 0 && (
                    <tr>
                      <td colSpan={8} className="py-16 text-center text-slate-400 text-sm">
                        No attendance records found for these filters.
                      </td>
                    </tr>
                  )}
                  {paginated.map((r, idx) => {
                    const rate = Number(r.rate_per_hour) || 0;
                    const hours = Number(r.hours) || 0;
                    const isCapped = r.is_billable === false || r.is_billable === 0;
                    const amount = isCapped ? 0 : (rate * hours);

                    return (
                      <tr key={r.attendance_id || idx} className={`border-b border-slate-100 transition-colors last:border-0 ${isCapped ? 'bg-orange-50/40 hover:bg-orange-50/60' : 'hover:bg-slate-50/50'}`}>
                        <td className="px-4 sm:px-5 py-4 text-slate-500 whitespace-nowrap">{(page - 1) * PAGE_SIZE + idx + 1}</td>
                        <td className={`px-4 sm:px-5 py-4 font-medium whitespace-nowrap ${isCapped ? 'text-slate-400 line-through' : 'text-slate-700'}`}>{r.attendance_date}</td>
                        <td className={`px-4 sm:px-5 py-4 font-bold whitespace-nowrap ${isCapped ? 'text-slate-400 line-through' : 'text-slate-900'}`}>{r.subject_code || "N/A"}</td>
                        <td className={`px-4 sm:px-5 py-4 whitespace-nowrap ${isCapped ? 'text-slate-400 line-through' : 'text-slate-600'}`}>{r.subject_name || "N/A"}</td>
                        <td className="px-4 sm:px-5 py-4 whitespace-nowrap">
                          <span
                            className={`px-2.5 py-1 rounded-full text-[11px] font-bold tracking-wide uppercase inline-block ${
                              isCapped 
                                ? "bg-orange-100 text-orange-700"
                                : r.session_type?.toLowerCase() === "practical"
                                  ? "bg-purple-50 text-purple-600"
                                  : "bg-blue-50 text-blue-600"
                            }`}
                          >
                            {isCapped ? "Capped" : (r.session_type || "N/A")}
                          </span>
                        </td>
                        <td className={`px-4 sm:px-5 py-4 font-medium whitespace-nowrap ${isCapped ? 'text-slate-400 line-through' : 'text-slate-700'}`}>{hours}h</td>
                        <td className={`px-4 sm:px-5 py-4 whitespace-nowrap ${isCapped ? 'text-slate-400 line-through' : 'text-slate-500'}`}>₹{rate}</td>
                        <td className={`px-4 sm:px-5 py-4 font-semibold whitespace-nowrap ${isCapped ? 'text-orange-600' : 'text-blue-600'}`}>
                          {isCapped ? "₹0 (Capped)" : `₹${amount}`}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-4 sm:px-6 py-4 border-t border-slate-100 text-sm bg-white">
              <span className="text-slate-500 text-center sm:text-left">Showing {paginated.length} of {filteredAndSorted.length} records</span>
              <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto justify-end">
                <div className="flex flex-wrap justify-center items-center gap-1">
                  <button
                    disabled={page === 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="h-8 w-8 flex items-center justify-center rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50 transition-colors text-slate-600 shrink-0"
                  >
                    ‹
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                    <button
                      key={p}
                      onClick={() => setPage(p)}
                      className={`h-8 w-8 flex items-center justify-center rounded-lg text-sm font-semibold transition-colors shrink-0 ${
                        p === page ? "bg-[#2563eb] text-white" : "border border-slate-200 text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                  <button
                    disabled={page === totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    className="h-8 w-8 flex items-center justify-center rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50 transition-colors text-slate-600 shrink-0"
                  >
                    ›
                  </button>
                </div>
                <button
                  onClick={handleExport}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-slate-800 text-white text-sm font-medium hover:bg-slate-900 transition-colors shadow-sm whitespace-nowrap"
                >
                  <Download size={15} /> Export
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {!loading && !activeFaculty && !error && allFaculties.length > 0 && (
        <p className="text-center text-slate-400 text-sm py-16">
          Search or select a faculty member above to view their attendance history.
        </p>
      )}
    </main>
  );
}

function StatCard({ icon: Icon, label, value }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 flex items-center gap-4 shadow-sm hover:shadow-md transition-shadow w-full">
      <div className="h-12 w-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
        <Icon size={22} />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1 truncate">{label}</p>
        <p className="text-2xl font-extrabold text-slate-800 truncate">{value}</p>
      </div>
    </div>
  );
}