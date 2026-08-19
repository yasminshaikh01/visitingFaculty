import React, { useEffect, useMemo, useState, useRef } from "react";
import { Download, Plus, Search, Filter, Eye, BookOpen, UserX, Users } from "lucide-react";
import LoadingSpinner from "./LoadingSpinner";
import FacultyModal from "./FacultyModal";
import adminApi from "../../api/adminApi";

const PAGE_SIZE = 5;

const statusStyles = {
  active: "bg-blue-50 text-blue-600",
  inactive: "bg-slate-100 text-slate-500",
  approved: "bg-green-50 text-green-600",
  rejected: "bg-red-50 text-red-700",
  pending: "bg-amber-50 text-amber-600",
};

export default function FacultyManagement({ setActiveTab, onAllocateSubject }) {
  const [faculty, setFaculty] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Filters & Sorting States - Defaulted designation to "approved"
  const [search, setSearch] = useState("");
  const [designation, setDesignation] = useState("approved"); // "" | "approved" | "pending" | "rejected"
  const [status, setStatus] = useState("");
  const [sortOrder, setSortOrder] = useState("newest"); // 'newest' | 'oldest'
  
  // UI States
  const [page, setPage] = useState(1);
  const [rejectedPage, setRejectedPage] = useState(1);
  const [viewId, setViewId] = useState(null);
  const [filterMenuOpen, setFilterMenuOpen] = useState(false);

  const filterRef = useRef(null);

  const fetchAll = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await adminApi.getAllFaculty();
      const facultyList = response?.data?.data || response?.data || response || [];
      setFaculty(Array.isArray(facultyList) ? facultyList : []);
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to load faculty list.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  // NEW: Listen for the global refresh event to instantly update table data
  useEffect(() => {
    const handleRefresh = () => fetchAll();
    window.addEventListener('refresh-dashboard', handleRefresh);
    return () => window.removeEventListener('refresh-dashboard', handleRefresh);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (filterRef.current && !filterRef.current.contains(e.target)) setFilterMenuOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // ==========================================
  // 1. MAIN TABLE DATA (Active, Inactive, Pending)
  // ==========================================
  const mainFilteredAndSorted = useMemo(() => {
    let result = faculty.filter((f) => {
      const currentApproval = f.FacultyApproval?.status?.toLowerCase() || (f.is_approved ? "approved" : "pending");
      
      // Exclude explicitly rejected faculty from the main table
      if (currentApproval === "rejected") return false;

      // 1. Search Filter
      const q = search.trim().toLowerCase();
      const matchesSearch =
      !q ||
      f.full_name?.toLowerCase().includes(q) ||
      (f.uvfin || f.FacultyApproval?.uvfin)?.toLowerCase().includes(q) ||
      String(f.user_id).toLowerCase().includes(q);
        
      // 2. Designation Filter
      const matchesDesignation = 
        !designation || 
        (designation === "approved" && currentApproval === "approved") || 
        (designation === "pending" && currentApproval === "pending");
      
      // 3. Status Filter (Active / Inactive)
      const currentStatus = f.is_active ? 'active' : 'inactive';
      const matchesStatus = !status || currentStatus === status.toLowerCase();
      
      return matchesSearch && matchesDesignation && matchesStatus;
    });

    // 4. Sorting logic
    result.sort((a, b) => {
      const dateA = new Date(a.created_at || a.user_id).getTime();
      const dateB = new Date(b.created_at || b.user_id).getTime();
      return sortOrder === "newest" ? dateB - dateA : dateA - dateB;
    });

    return result;
  }, [faculty, search, designation, status, sortOrder]);

  const totalPages = Math.max(1, Math.ceil(mainFilteredAndSorted.length / PAGE_SIZE));
  const paginatedMain = mainFilteredAndSorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // ==========================================
  // 2. REJECTED TABLE DATA
  // ==========================================
  const rejectedFilteredAndSorted = useMemo(() => {
    let result = faculty.filter((f) => {
      const currentApproval = f.FacultyApproval?.status?.toLowerCase() || "";
      
      // ONLY include rejected faculty
      if (currentApproval !== "rejected") return false;

      const q = search.trim().toLowerCase();
      const matchesSearch =
        !q ||
        f.full_name?.toLowerCase().includes(q) ||
        f.FacultyApproval?.uvfin?.toLowerCase().includes(q) ||
        String(f.user_id).toLowerCase().includes(q);
        
      return matchesSearch;
    });

    result.sort((a, b) => {
      const dateA = new Date(a.created_at || a.user_id).getTime();
      const dateB = new Date(b.created_at || b.user_id).getTime();
      return sortOrder === "newest" ? dateB - dateA : dateA - dateB;
    });

    return result;
  }, [faculty, search, sortOrder]);

  const totalRejectedPages = Math.max(1, Math.ceil(rejectedFilteredAndSorted.length / PAGE_SIZE));
  const paginatedRejected = rejectedFilteredAndSorted.slice((rejectedPage - 1) * PAGE_SIZE, rejectedPage * PAGE_SIZE);

  // Reset pagination when filters change
  useEffect(() => {
    setPage(1);
    setRejectedPage(1);
  }, [search, designation, status, sortOrder]);

  const handleExport = () => {
    // Export based on the current view
    const exportData = designation === "rejected" ? rejectedFilteredAndSorted : mainFilteredAndSorted;
    
    const headers = ["UVFIN", "Name", "Qualification", "Status", "Designation"];
    const rows = exportData.map((f) => [
      f.FacultyApproval?.uvfin || "N/A",
      f.full_name,
      f.qualification || "N/A",
      f.is_active ? "Active" : "Inactive",
      designation === "rejected" ? "Rejected" : "Visiting Faculty"
    ]);
    
    const csv = [headers, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `faculty_list_${designation || "all"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <main className="p-4 sm:p-6 space-y-6 w-full relative bg-slate-50/50 min-h-screen max-w-full overflow-hidden">
      
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Faculty Management</h1>
          <p className="text-sm text-slate-500 mt-0.5">All registered visiting faculty members</p>
        </div>
        {/* UPDATED: Buttons wrap nicely on mobile */}
        <div className="flex flex-wrap sm:flex-nowrap gap-3 w-full md:w-auto">
          <button
            onClick={handleExport}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors shadow-sm whitespace-nowrap"
          >
            <Download size={16} /> Export
          </button>
          <button
            onClick={() => setActiveTab("dashboard")}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#2563eb] text-white text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm whitespace-nowrap"
          >
            <Plus size={16} /> Register New
          </button>
        </div>
      </div>

      {/* Filters Section */}
      {/* UPDATED: flex-col for mobile, wraps seamlessly into row on md screens */}
      <div className="bg-white rounded-xl border border-slate-200 p-3 sm:p-4 flex flex-col lg:flex-row gap-3 shadow-sm w-full">
        <div className="relative flex-1 w-full">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or UVFIN..."
            className="w-full pl-10 pr-3 py-2.5 rounded-lg bg-slate-50 border-transparent text-sm focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
          />
        </div>
        
        <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
          <select
            value={designation}
            onChange={(e) => setDesignation(e.target.value)}
            className="w-full sm:w-auto lg:min-w-[190px] px-3 py-2.5 rounded-lg border border-slate-200 text-sm font-medium text-slate-700 bg-white focus:outline-none focus:border-blue-500"
          >
            <option value="approved">Approved Faculty</option>
            <option value="pending">Pending Approval</option>
            <option value="rejected">Rejected Applications</option>
            <option value="">All Faculty (Except Rejected)</option>
          </select>
          
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            disabled={designation === "rejected"}
            className="w-full sm:w-auto lg:min-w-[140px] px-3 py-2.5 rounded-lg border border-slate-200 text-sm text-slate-600 bg-white focus:outline-none focus:border-blue-500 disabled:opacity-50 disabled:bg-slate-50"
          >
            <option value="">Select Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>

          <div className="relative w-full sm:w-auto" ref={filterRef}>
            <button 
              onClick={() => setFilterMenuOpen(!filterMenuOpen)}
              className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors h-full"
            >
              <Filter size={16} className="text-slate-500" /> Filter
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
      </div>

      {/* ======================================================= */}
      {/* 1. MAIN FACULTY TABLE (Shows when Designation !== "rejected") */}
      {/* ======================================================= */}
      {designation !== "rejected" && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm animate-in fade-in duration-300 w-full">
          {/* UPDATED: hide-scrollbar added to keep it clean on mobile */}
          <div className="overflow-x-auto hide-scrollbar w-full">
            <table className="w-full text-sm text-left min-w-[750px]">
              <thead>
                <tr className="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                  <th className="px-4 sm:px-6 py-4 whitespace-nowrap">UVFIN</th>
                  <th className="px-4 sm:px-6 py-4 whitespace-nowrap">Faculty Name</th>
                  <th className="px-4 sm:px-6 py-4 whitespace-nowrap">Qualification</th>
                  <th className="px-4 sm:px-6 py-4 whitespace-nowrap">Status</th>
                  <th className="px-4 sm:px-6 py-4 whitespace-nowrap">Allocate Subject</th>
                  <th className="px-4 sm:px-6 py-4 text-center whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={6} className="py-12">
                      <LoadingSpinner label="Loading faculty..." />
                    </td>
                  </tr>
                )}

                {!loading && error && (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-red-500 text-sm bg-red-50/50">
                      {error}
                    </td>
                  </tr>
                )}

                {!loading && !error && paginatedMain.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-16 text-center text-slate-400 text-sm">
                      <div className="flex flex-col items-center gap-2">
                        <Users size={32} className="text-slate-300" />
                        <p>No faculty found matching your filters.</p>
                      </div>
                    </td>
                  </tr>
                )}

                {!loading &&
                  !error &&
                  paginatedMain.map((f) => {
                    const currentApproval = f.FacultyApproval?.status?.toLowerCase() || (f.is_approved ? "approved" : "pending");
                    const isPending = currentApproval === "pending";
                    const isActive = f.is_active;
                    
                    return (
                      <tr key={f.user_id} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors last:border-0">
                        <td className="px-4 sm:px-6 py-4 font-medium text-slate-600 whitespace-nowrap">
                        {(f.uvfin || f.FacultyApproval?.uvfin) ? (
                          f.uvfin || f.FacultyApproval?.uvfin
                        ) : (
                          <span className="text-slate-400 font-normal italic">Pending</span>
                        )}
                      </td>
                        <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-3">
                            <div className="h-9 w-9 shrink-0 rounded-full bg-[#eff6ff] text-[#2563eb] flex items-center justify-center text-sm font-bold uppercase border border-blue-100">
                              {f.full_name?.charAt(0) ?? "F"}
                            </div>
                            <span className="font-bold text-slate-900">{f.full_name}</span>
                          </div>
                        </td>
                        <td className="px-4 sm:px-6 py-4 text-slate-600 whitespace-nowrap">{f.qualification || "N/A"}</td>
                        <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                          {isPending ? (
                            <span className="text-slate-400 italic">N/A</span>
                          ) : (
                            <span
                              className={`px-3 py-1 rounded-full text-xs font-semibold capitalize inline-block ${
                                isActive ? statusStyles.active : statusStyles.inactive
                              }`}
                            >
                              {isActive ? "Active" : "Inactive"}
                            </span>
                          )}
                        </td>
                        <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                          {isPending ? (
                            <span className="text-slate-400 italic">N/A</span>
                          ) : f.allocated ? (
                            <span className="px-3 py-1.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-600 inline-block">
                              Allocated
                            </span>
                          ) : (
                            <button
                            onClick={() => onAllocateSubject && onAllocateSubject(f)} 
                            disabled={f.is_active === false}
                            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                              f.is_active === false 
                                ? 'bg-slate-100 text-slate-400 cursor-not-allowed' 
                                : 'bg-red-50 text-red-500 hover:bg-red-100 hover:text-red-600'
                            }`}
                          >
                            Allocate Subject
                          </button>
                          )}
                        </td>
                        <td className="px-4 sm:px-6 py-4 text-center whitespace-nowrap">
                          <button
                            onClick={() => setViewId(f.user_id)}
                            className="inline-flex flex-col items-center gap-1 text-slate-400 hover:text-[#004DD2] transition-colors"
                          >
                            <Eye size={18} />
                            <span className="text-[10px] font-semibold leading-none">View Profile</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>

          {/* UPDATED: Pagination flex-wrap for mobile */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-4 sm:px-6 py-4 border-t border-slate-100 text-sm bg-white">
            <span className="text-slate-500 text-center sm:text-left">
              Showing {paginatedMain.length} of {mainFilteredAndSorted.length} records
            </span>
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
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 2. REJECTED APPLICATIONS TABLE (Shows ONLY when Designation === "rejected") */}
      {/* ============================================================== */}
      {designation === "rejected" && (
        <div className="animate-in fade-in duration-300 w-full">
          <div className="flex items-center gap-2 mb-4">
            <UserX size={20} className="text-red-600" />
            <h2 className="text-lg font-bold text-slate-800">Rejected Applications</h2>
          </div>
          
          <div className="bg-white rounded-xl border border-red-100 overflow-hidden shadow-sm w-full">
            {/* UPDATED: horizontal scroll for mobile */}
            <div className="overflow-x-auto hide-scrollbar w-full">
              <table className="w-full text-sm text-left min-w-[600px]">
                <thead>
                  <tr className="bg-red-50/50 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-red-100">
                    <th className="px-4 sm:px-6 py-4 whitespace-nowrap">UVFIN</th>
                    <th className="px-4 sm:px-6 py-4 whitespace-nowrap">Faculty Name</th>
                    <th className="px-4 sm:px-6 py-4 whitespace-nowrap">Qualification</th>
                    <th className="px-4 sm:px-6 py-4 whitespace-nowrap">Status</th>
                    <th className="px-4 sm:px-6 py-4 text-center whitespace-nowrap">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {!loading && !error && paginatedRejected.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-16 text-center text-slate-400 text-sm">
                        <div className="flex flex-col items-center gap-2">
                          <UserX size={32} className="text-slate-200" />
                          <p>No rejected applications found.</p>
                        </div>
                      </td>
                    </tr>
                  )}

                  {paginatedRejected.map((f) => (
                    <tr key={f.user_id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors last:border-0">
                      <td className="px-4 sm:px-6 py-4 font-medium text-slate-400 italic whitespace-nowrap">N/A</td>
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 shrink-0 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center text-sm font-bold uppercase border border-slate-200">
                            {f.full_name?.charAt(0) ?? "F"}
                          </div>
                          <span className="font-bold text-slate-700">{f.full_name}</span>
                        </div>
                      </td>
                      <td className="px-4 sm:px-6 py-4 text-slate-500 whitespace-nowrap">{f.qualification || "N/A"}</td>
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                        <span className="px-3 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-600 inline-block">
                          Rejected
                        </span>
                      </td>
                      <td className="px-4 sm:px-6 py-4 text-center whitespace-nowrap">
                        <button
                          onClick={() => setViewId(f.user_id)}
                          className="px-4 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors inline-flex items-center gap-2"
                        >
                          <Eye size={14} /> Review Profile
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            {paginatedRejected.length > 0 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-4 sm:px-6 py-4 border-t border-red-100 text-sm bg-white">
                <span className="text-slate-500 text-center sm:text-left">
                  Showing {paginatedRejected.length} of {rejectedFilteredAndSorted.length} records
                </span>
                <div className="flex flex-wrap justify-center items-center gap-1">
                  <button
                    disabled={rejectedPage === 1}
                    onClick={() => setRejectedPage((p) => Math.max(1, p - 1))}
                    className="h-8 w-8 flex items-center justify-center rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50 transition-colors text-slate-600 shrink-0"
                  >
                    ‹
                  </button>
                  {Array.from({ length: totalRejectedPages }, (_, i) => i + 1).map((p) => (
                    <button
                      key={p}
                      onClick={() => setRejectedPage(p)}
                      className={`h-8 w-8 flex items-center justify-center rounded-lg text-sm font-semibold transition-colors shrink-0 ${
                        p === rejectedPage ? "bg-slate-800 text-white" : "border border-slate-200 text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                  <button
                    disabled={rejectedPage === totalRejectedPages}
                    onClick={() => setRejectedPage((p) => Math.min(totalRejectedPages, p + 1))}
                    className="h-8 w-8 flex items-center justify-center rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50 transition-colors text-slate-600 shrink-0"
                  >
                    ›
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Profile Modal */}
      {viewId && (
        <FacultyModal 
          userId={viewId} 
          onClose={() => setViewId(null)} 
          // Fire the global refresh when an action succeeds in the modal
          onActionSuccess={() => {
            fetchAll();
            window.dispatchEvent(new Event('refresh-dashboard'));
          }} 
        />
      )}
    </main>
  );
}