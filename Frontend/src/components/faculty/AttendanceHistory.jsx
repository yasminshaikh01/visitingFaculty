import React, { useState, useEffect, useMemo, useRef } from "react";
import { Download, Calendar, Clock, IndianRupee, ChevronDown, Filter, ChevronLeft, ChevronRight, Loader2, Check, ArrowUpDown, Trash2, AlertTriangle } from "lucide-react";
import PageHeader from "./shared/PageHeader";
import api from "../../api/axiosInstance"; // Adjust the ../ as needed based on folder depth

const typeStyles = {
  Theory: "bg-brand-100 text-brand-700",
  Practical: "bg-brand-50 text-brand-600",
};

function StatCard({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-xs text-slate-500">{label}</p>
        <p className="text-lg font-bold text-slate-900">{value}</p>
      </div>
    </div>
  );
}

export default function AttendanceHistory() {
  const [history, setHistory] = useState([]);
  const [allocations, setAllocations] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [facultyName, setFacultyName] = useState("");
  
  // Single Record Delete State
  const [recordToDelete, setRecordToDelete] = useState(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [deletingId, setDeletingId] = useState(null); 

  // Bulk Delete State
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);
  const [bulkDeleteError, setBulkDeleteError] = useState("");
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  
  // Filtering & Sorting State
  const [selectedSubject, setSelectedSubject] = useState("All");
  const [selectedTimeRange, setSelectedTimeRange] = useState("This Month");
  const [sortOrder, setSortOrder] = useState("desc"); // 'desc' = Newest First, 'asc' = Oldest First
  
  // Dropdown UI State
  const [activeDropdown, setActiveDropdown] = useState(null); // 'subject' | 'time' | null
  
  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const recordsPerPage = 10;

  // Refs for click-outside handling
  const dropdownRef = useRef(null);

  useEffect(() => {
    fetchData();
    
    // Close dropdowns when clicking outside
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setActiveDropdown(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const session = JSON.parse(localStorage.getItem('iipsCurrentSession') || '{}');
      setFacultyName(session.name || "Faculty Member");
      const targetId = session.userId;
      const headers = { 'Authorization': `Bearer ${session.token}` };

      // Fetch History and Allocations concurrently
      const [historyRes, allocationsRes] = await Promise.all([
        api.get(`/attendance/history/${targetId}`),
        api.get(`/attendance/my-allocations/${targetId}`).catch(() => ({ data: { allocations: [] } })) 
      ]);

      if (historyRes.data.success) {
        setHistory(historyRes.data.data || []);
      }
      
      if (allocationsRes.data.success) {
        setAllocations(allocationsRes.data.allocations || []);
      }

    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // --- SINGLE DELETE LOGIC ---
  const promptDelete = (record) => {
    setRecordToDelete(record);
    setDeleteError("");
    setIsDeleteModalOpen(true);
  };

  const executeDelete = async () => {
    if (!recordToDelete) return;

    setDeletingId(recordToDelete.attendance_id);
    setDeleteError("");

    try {
      const session = JSON.parse(localStorage.getItem('iipsCurrentSession') || '{}');
      
      const response = await api.delete(`/attendance/record/${recordToDelete.attendance_id}`);

      if (response.data.success) {
        setHistory(prevHistory => prevHistory.filter(record => record.attendance_id !== recordToDelete.attendance_id));
        setIsDeleteModalOpen(false);
        setRecordToDelete(null);
      }
    } catch (error) {
      console.error("Error deleting record:", error);
      if (error.response?.status === 404) {
        setDeleteError("Record not found. It may have already been deleted.");
      } else {
        setDeleteError(error.response?.data?.message || "Failed to delete the record. It may have already been verified.");
      }
    } finally {
      setDeletingId(null);
    }
  };

  // --- BULK DELETE LOGIC ---
  const promptBulkDelete = () => {
    setBulkDeleteError("");
    setIsBulkDeleteModalOpen(true);
  };

  const executeBulkDelete = async () => {
    setIsBulkDeleting(true);
    setBulkDeleteError("");

    try {
      const session = JSON.parse(localStorage.getItem('iipsCurrentSession') || '{}');
      const targetId = session.userId;
      
     let url = `/attendance/faculty/${targetId}`;
      const today = new Date();

      // Dynamically attach query parameters based on the currently selected UI filter
      if (selectedTimeRange === "Today") {
        const dStr = today.toISOString().split('T')[0];
        url += `?attendance_date=${dStr}`;
      } else if (selectedTimeRange === "This Week") {
        url += `?attendance_period=weekly`;
      } else if (selectedTimeRange === "This Month") {
        const monthName = today.toLocaleString('default', { month: 'long' });
        url += `?month=${monthName}&year=${today.getFullYear()}`;
      }

      const response = await axios.delete(url, {
        headers: { 'Authorization': `Bearer ${session.token}` }
      });

      if (response.data.success) {
        setIsBulkDeleteModalOpen(false);
        fetchData(); // Refresh the entire list
      }
    } catch (error) {
      console.error("Bulk Delete Error:", error);
      if (error.response?.status === 404) {
        setBulkDeleteError(error.response?.data?.message || `No pending records found to delete for ${selectedTimeRange}.`);
      } else {
        setBulkDeleteError(error.response?.data?.message || "Failed to clear records. Some may already be verified.");
      }
    } finally {
      setIsBulkDeleting(false);
    }
  };

  // --- FILTERING & SORTING LOGIC ---
  const processedRecords = useMemo(() => {
    let result = [...history];

    if (selectedSubject !== "All") {
      result = result.filter(r => r.subject_code === selectedSubject);
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (selectedTimeRange === "Today") {
      const todayStr = today.toISOString().split('T')[0];
      result = result.filter(r => r.attendance_date === todayStr);
    } 
    else if (selectedTimeRange === "This Week") {
      const lastWeek = new Date(today);
      lastWeek.setDate(lastWeek.getDate() - 7);
      result = result.filter(r => new Date(r.attendance_date) >= lastWeek);
    } 
    else if (selectedTimeRange === "This Month") {
      const currentMonth = today.getMonth();
      const currentYear = today.getFullYear();
      result = result.filter(r => {
        const d = new Date(r.attendance_date);
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
      });
    }

    result.sort((a, b) => {
      const dateA = new Date(`${a.attendance_date}T${a.start_time}`);
      const dateB = new Date(`${b.attendance_date}T${b.start_time}`);
      return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
    });

    return result;
  }, [history, selectedSubject, selectedTimeRange, sortOrder]);

  // --- UPDATED: SUMMARY CALCULATION (Respects is_billable) ---
  const summary = useMemo(() => {
    const totalEarnings = processedRecords.reduce((sum, record) => {
      // If the backend flagged this as exceeding the cap, it pays ₹0
      if (record.is_billable === false || record.is_billable === 0) {
        return sum;
      }
      const hrs = parseFloat(record.hours) || 0;
      const rate = parseFloat(record.rate_per_hour) || 0;
      return sum + (hrs * rate);
    }, 0);

    const totalHours = processedRecords.reduce((sum, r) => sum + (parseFloat(r.hours) || 0), 0);

    return {
      classes: processedRecords.length,
      hours: totalHours,
      earnings: totalEarnings
    };
  }, [processedRecords]);

  const handleFilterChange = (type, value) => {
    if (type === 'subject') setSelectedSubject(value);
    if (type === 'time') setSelectedTimeRange(value);
    setCurrentPage(1);
    setActiveDropdown(null);
  };

  const toggleSortOrder = () => {
    setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc');
    setCurrentPage(1);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "N/A";
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? dateStr : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const formatTime = (timeStr) => {
    if (!timeStr) return "";
    return timeStr.substring(0, 5);
  };

  // --- EXPORT LOGIC ---
  const handleExport = () => {
    if (processedRecords.length === 0) return;

    // 1. Define CSV Headers
    const headers = ["Date", "Subject Code", "Subject Name", "Type", "Time", "Hours", "Rate", "Amount", "Status"];

    // 2. Map the data into CSV rows
    const rows = processedRecords.map(r => {
      const date = formatDate(r.attendance_date);
      const time = `${formatTime(r.start_time)} - ${formatTime(r.end_time)}`;
      const baseAmount = (parseFloat(r.hours) || 0) * (parseFloat(r.rate_per_hour) || 0);
      const isBillable = r.is_billable !== false && r.is_billable !== 0;
      const typeStr = r.session_type || "Theory";
      
      // Helper to escape strings containing commas
      const escape = (str) => `"${String(str).replace(/"/g, '""')}"`;

      return [
        escape(date),
        escape(r.subject_code),
        escape(r.subject_name),
        escape(typeStr),
        escape(time),
        r.hours,
        r.rate_per_hour,
        isBillable ? baseAmount : 0, // Show 0 if capped
        isBillable ? "Billable" : "Capped"
      ].join(",");
    });

    // 3. Combine headers and rows
    const csvContent = [headers.join(","), ...rows].join("\n");

    // 4. Create a Blob and trigger the download
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    
    // Create a clean filename like: Attendance_John_Doe_2026-08-05.csv
    const safeName = facultyName.replace(/[^a-z0-9]/gi, '_');
    const todayStr = new Date().toISOString().split('T')[0];
    
    link.setAttribute("href", url);
    link.setAttribute("download", `Attendance_${safeName}_${todayStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const indexOfLastRecord = currentPage * recordsPerPage;
  const indexOfFirstRecord = indexOfLastRecord - recordsPerPage;
  const currentRecords = processedRecords.slice(indexOfFirstRecord, indexOfLastRecord);
  const totalPages = Math.max(1, Math.ceil(processedRecords.length / recordsPerPage));

  return (
    <div className="pb-12 relative">
      <PageHeader
        title="Attendance History"
        right={
          <button 
            onClick={handleExport}
            disabled={processedRecords.length === 0}
            className="flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors bg-white shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download className="h-4 w-4" /> Export
          </button>
        }
      />

      <div className="px-4 py-6 sm:px-8">
        <h2 className="text-2xl font-bold text-slate-900">{facultyName}</h2>
        <p className="mt-1 text-sm text-slate-500">
          Complete Attendance Record
        </p>

        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard icon={Calendar} label="Classes Filtered" value={summary.classes} />
          <StatCard icon={Clock} label="Hours Logged" value={summary.hours} />
          <StatCard 
            icon={IndianRupee} 
            label="Calculated Earnings" 
            value={`₹${summary.earnings.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`} 
          />
        </div>

        <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          
          {/* --- FILTER & SORT CONTROLS --- */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-4" ref={dropdownRef}>
            <div className="flex flex-wrap gap-3">
              
              {/* Subject Dropdown */}
              <div className="relative">
                <button 
                  onClick={() => setActiveDropdown(activeDropdown === 'subject' ? null : 'subject')}
                  className={`flex items-center gap-2 rounded-lg border px-3.5 py-2 text-sm transition-colors ${
                    activeDropdown === 'subject' || selectedSubject !== 'All' 
                      ? 'border-brand-300 bg-brand-50 text-brand-700' 
                      : 'border-slate-300 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {selectedSubject === 'All' ? 'All Subjects' : selectedSubject} 
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>
                
                {activeDropdown === 'subject' && (
                  <div className="absolute top-full left-0 mt-1.5 w-56 rounded-xl border border-slate-100 bg-white p-1.5 shadow-xl z-10">
                    <button 
                      onClick={() => handleFilterChange('subject', 'All')}
                      className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm ${selectedSubject === 'All' ? 'bg-brand-50 text-brand-700 font-medium' : 'text-slate-600 hover:bg-slate-50'}`}
                    >
                      All Subjects
                      {selectedSubject === 'All' && <Check className="w-4 h-4" />}
                    </button>
                    
                    {(allocations.length > 0 ? allocations : Array.from(new Set(history.map(h => h.subject_code))).map(code => ({ subject_code: code, subject_name: history.find(h => h.subject_code === code)?.subject_name })))
                      .filter((v, i, a) => a.findIndex(t => (t.subject_code === v.subject_code)) === i)
                      .map((alloc) => (
                      <button 
                        key={alloc.subject_code}
                        onClick={() => handleFilterChange('subject', alloc.subject_code)}
                        className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm text-left ${selectedSubject === alloc.subject_code ? 'bg-brand-50 text-brand-700 font-medium' : 'text-slate-600 hover:bg-slate-50'}`}
                      >
                        <span className="truncate pr-2">{alloc.subject_name} ({alloc.subject_code})</span>
                        {selectedSubject === alloc.subject_code && <Check className="w-4 h-4 shrink-0" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Time Range Dropdown */}
              <div className="relative">
                <button 
                  onClick={() => setActiveDropdown(activeDropdown === 'time' ? null : 'time')}
                  className={`flex items-center gap-2 rounded-lg border px-3.5 py-2 text-sm transition-colors ${
                    activeDropdown === 'time' || selectedTimeRange !== 'All Time' 
                      ? 'border-brand-300 bg-brand-50 text-brand-700' 
                      : 'border-slate-300 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {selectedTimeRange} <ChevronDown className="h-3.5 w-3.5" />
                </button>
                
                {activeDropdown === 'time' && (
                  <div className="absolute top-full left-0 mt-1.5 w-40 rounded-xl border border-slate-100 bg-white p-1.5 shadow-xl z-10">
                    {['All Time', 'Today', 'This Week', 'This Month'].map((range) => (
                      <button 
                        key={range}
                        onClick={() => handleFilterChange('time', range)}
                        className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm ${selectedTimeRange === range ? 'bg-brand-50 text-brand-700 font-medium' : 'text-slate-600 hover:bg-slate-50'}`}
                      >
                        {range}
                        {selectedTimeRange === range && <Check className="w-4 h-4" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Sort & Bulk Delete Controls */}
            <div className="flex items-center gap-3">
              <button 
                onClick={toggleSortOrder}
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors border border-transparent"
              >
                <ArrowUpDown className="h-4 w-4" /> 
                {sortOrder === 'desc' ? 'Newest First' : 'Oldest First'}
              </button>

              {history.length > 0 && (
                <button
                  onClick={promptBulkDelete}
                  className="flex items-center gap-2 rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors shadow-sm"
                >
                  <Trash2 className="h-4 w-4" />
                  Clear {selectedTimeRange === "All Time" ? "All" : selectedTimeRange}
                </button>
              )}
            </div>
          </div>

          {/* --- TABLE / DATA DISPLAY --- */}
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-500">
              <Loader2 className="animate-spin w-8 h-8 text-brand-600 mb-3" />
              Loading history...
            </div>
          ) : processedRecords.length === 0 ? (
            <div className="py-20 flex flex-col items-center justify-center text-slate-500">
              <Filter className="w-8 h-8 text-slate-300 mb-3" />
              <p>No records found matching your filters.</p>
              {(selectedSubject !== 'All' || selectedTimeRange !== 'This Month') && (
                <button 
                  onClick={() => { setSelectedSubject('All'); setSelectedTimeRange('This Month'); }}
                  className="mt-2 text-brand-600 text-sm font-medium hover:underline"
                >
                  Clear all filters
                </button>
              )}
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden overflow-x-auto lg:block min-h-[400px]">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                      <th className="px-4 py-3 font-semibold">Sn.</th>
                      <th className="px-4 py-3 font-semibold">Date</th>
                      <th className="px-4 py-3 font-semibold">Subject Code</th>
                      <th className="px-4 py-3 font-semibold">Subject Name</th>
                      <th className="px-4 py-3 font-semibold">Type</th>
                      <th className="px-4 py-3 font-semibold">Time</th>
                      <th className="px-4 py-3 font-semibold">Hours</th>
                      <th className="px-4 py-3 font-semibold">Amount</th>
                      <th className="px-4 py-3 font-semibold text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentRecords.map((r, index) => {
                      const baseAmount = (parseFloat(r.hours) || 0) * (parseFloat(r.rate_per_hour) || 0);
                      const isBillable = r.is_billable !== false && r.is_billable !== 0;
                      const sessionType = r.session_type || "Theory";
                      const canDelete = r.status === "Pending";
                      
                      return (
                        <tr key={r.attendance_id} className={`border-b border-slate-100 hover:bg-slate-50 transition-colors last:border-b-0 ${!isBillable ? 'bg-orange-50/30' : ''}`}>
                          <td className="px-4 py-4 text-slate-500">{indexOfFirstRecord + index + 1}</td>
                          <td className="px-4 py-4 text-slate-700">{formatDate(r.attendance_date)}</td>
                          <td className="px-4 py-4 font-semibold text-brand-600">{r.subject_code}</td>
                          <td className="px-4 py-4 text-slate-800 truncate max-w-[200px]">{r.subject_name}</td>
                          <td className="px-4 py-4">
                            <span className={`rounded-full px-3 py-1 text-xs font-medium whitespace-nowrap ${typeStyles[sessionType] || typeStyles.Theory}`}>
                              {sessionType}
                            </span>
                          </td>
                          <td className="px-4 py-4 text-slate-600 whitespace-nowrap">
                            {formatTime(r.start_time)} - {formatTime(r.end_time)}
                          </td>
                          <td className="px-4 py-4 font-semibold text-slate-800">{parseFloat(r.hours)}</td>
                          
                          {/* UPDATED AMOUNT RENDER WITH CAP BADGE */}
                          <td className="px-4 py-4 font-bold">
                            {isBillable ? (
                              <span className="text-brand-600">₹{baseAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                            ) : (
                              <div className="flex flex-col">
                                <span className="text-slate-400 line-through text-xs font-normal">₹{baseAmount.toLocaleString('en-IN')}</span>
                                <span className="text-orange-500 text-xs">₹0 (Capped)</span>
                              </div>
                            )}
                          </td>
                          
                          {/* DELETE ACTION COLUMN */}
                          <td className="px-4 py-4 text-center">
                            <button
                              onClick={() => promptDelete(r)}
                              disabled={!canDelete || deletingId === r.attendance_id}
                              title={canDelete ? "Cancel this record" : "Cannot delete verified records"}
                              className="rounded p-2 text-red-500 transition-colors hover:bg-red-50 hover:text-red-700 disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="divide-y divide-slate-100 lg:hidden">
                {currentRecords.map((r) => {
                  const baseAmount = (parseFloat(r.hours) || 0) * (parseFloat(r.rate_per_hour) || 0);
                  const isBillable = r.is_billable !== false && r.is_billable !== 0;
                  const sessionType = r.session_type || "Theory";
                  const canDelete = r.status === "Pending";

                  return (
                    <div key={r.attendance_id} className={`p-4 ${!isBillable ? 'bg-orange-50/30' : ''}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-brand-600">{r.subject_code}</span>
                          <span className={`rounded-full px-3 py-1 text-xs font-medium ${typeStyles[sessionType] || typeStyles.Theory}`}>
                            {sessionType}
                          </span>
                        </div>
                        
                        {/* DELETE ACTION MOBILE */}
                        <button
                          onClick={() => promptDelete(r)}
                          disabled={!canDelete || deletingId === r.attendance_id}
                          title={canDelete ? "Cancel this record" : "Cannot delete verified records"}
                          className="rounded p-1.5 text-red-500 transition-colors hover:bg-red-50 hover:text-red-700 disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                      
                      <p className="mt-1 font-medium text-slate-800 pr-8">{r.subject_name}</p>
                      
                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                        <span>{formatDate(r.attendance_date)}</span>
                        <span>{formatTime(r.start_time)} - {formatTime(r.end_time)}</span>
                        <span>{parseFloat(r.hours)} hrs</span>
                      </div>
                      <div className="mt-2 flex items-center justify-between text-sm">
                        <span className="text-slate-500">Rate ₹{parseFloat(r.rate_per_hour || 0)}</span>
                        
                        {/* UPDATED AMOUNT RENDER WITH CAP BADGE (MOBILE) */}
                        <span className="font-bold">
                          {isBillable ? (
                            <span className="text-brand-600">₹{baseAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                          ) : (
                            <div className="flex flex-col items-end">
                              <span className="text-slate-400 line-through text-xs font-normal">₹{baseAmount.toLocaleString('en-IN')}</span>
                              <span className="text-orange-500 text-xs">₹0 (Capped)</span>
                            </div>
                          )}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* Pagination */}
          {!isLoading && processedRecords.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 p-4 bg-slate-50/50">
              <p className="text-xs text-slate-500">
                Showing {indexOfFirstRecord + 1} to {Math.min(indexOfLastRecord, processedRecords.length)} of {processedRecords.length} records
              </p>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} 
                  disabled={currentPage === 1}
                  className="rounded-md border border-slate-200 p-1.5 text-slate-400 hover:text-slate-600 hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                
                <div className="flex gap-1 overflow-x-auto max-w-[150px] sm:max-w-none">
                  {[...Array(totalPages)].map((_, i) => {
                    if (totalPages > 5 && i !== 0 && i !== totalPages - 1 && Math.abs(currentPage - 1 - i) > 1) {
                      if (Math.abs(currentPage - 1 - i) === 2) return <span key={i} className="px-1 text-slate-400">...</span>;
                      return null;
                    }
                    return (
                      <button 
                        key={i} 
                        onClick={() => setCurrentPage(i + 1)} 
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-xs font-semibold transition-colors ${
                          currentPage === i + 1 
                            ? "bg-brand-600 text-white shadow-sm" 
                            : "text-slate-500 hover:bg-slate-200"
                        }`}
                      >
                        {i + 1}
                      </button>
                    )
                  })}
                </div>

                <button 
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))} 
                  disabled={currentPage === totalPages}
                  className="rounded-md border border-slate-200 p-1.5 text-slate-400 hover:text-slate-600 hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* --- SINGLE DELETE CONFIRMATION MODAL --- */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md scale-100 overflow-hidden rounded-2xl bg-white shadow-xl animate-in zoom-in-95 duration-200">
            <div className="p-6 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-100 text-red-600">
                <AlertTriangle size={28} strokeWidth={2.5} />
              </div>
              <h3 className="mb-2 text-xl font-bold text-slate-800">Cancel Attendance Record?</h3>
              <p className="text-sm text-slate-500 px-2 leading-relaxed">
                Are you sure you want to delete the <strong>{recordToDelete?.subject_code}</strong> record for <strong>{formatDate(recordToDelete?.attendance_date)}</strong>? This action cannot be undone.
              </p>
              {deleteError && (
                <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm font-medium text-red-600 border border-red-100 text-left">
                  {deleteError}
                </div>
              )}
            </div>
            <div className="flex justify-end gap-3 border-t border-slate-100 bg-slate-50 p-4">
              <button
                onClick={() => {
                  setIsDeleteModalOpen(false);
                  setRecordToDelete(null);
                  setDeleteError("");
                }}
                disabled={deletingId !== null}
                className="rounded-lg border border-slate-200 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={executeDelete}
                disabled={deletingId !== null}
                className="flex items-center gap-2 rounded-lg bg-red-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
              >
                {deletingId !== null ? <><Loader2 className="h-4 w-4 animate-spin" /> Deleting...</> : "Yes, Cancel Record"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- BULK DELETE CONFIRMATION MODAL --- */}
      {isBulkDeleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md scale-100 overflow-hidden rounded-2xl bg-white shadow-xl animate-in zoom-in-95 duration-200">
            <div className="p-6 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-100 text-red-600">
                <AlertTriangle size={28} strokeWidth={2.5} />
              </div>
              <h3 className="mb-2 text-xl font-bold text-slate-800">Bulk Delete Records?</h3>
              <p className="text-sm text-slate-500 px-2 leading-relaxed">
                Are you sure you want to delete ALL pending records for <strong>{selectedTimeRange === "All Time" ? "your entire history" : selectedTimeRange}</strong>? 
                {selectedSubject !== "All" && " (This will ignore the Subject filter and delete ALL subjects for this time range)." } This action cannot be undone.
              </p>
              {bulkDeleteError && (
                <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm font-medium text-red-600 border border-red-100 text-left">
                  {bulkDeleteError}
                </div>
              )}
            </div>
            <div className="flex justify-end gap-3 border-t border-slate-100 bg-slate-50 p-4">
              <button
                onClick={() => {
                  setIsBulkDeleteModalOpen(false);
                  setBulkDeleteError("");
                }}
                disabled={isBulkDeleting}
                className="rounded-lg border border-slate-200 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={executeBulkDelete}
                disabled={isBulkDeleting}
                className="flex items-center gap-2 rounded-lg bg-red-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
              >
                {isBulkDeleting ? <><Loader2 className="h-4 w-4 animate-spin" /> Deleting...</> : "Yes, Delete Records"}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}