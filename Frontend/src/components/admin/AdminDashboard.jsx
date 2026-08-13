import React, { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { ArrowRight, Filter, Check } from "lucide-react"; 
import NotificationToast from './NotificationToast';

// Components
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import PendingFacultyTable from "./PendingFacultyTable";
import adminApi from "../../api/adminApi";

// Other Pages
import FacultyManagement from "./FacultyManagement";
import SubjectAllocation from "./SubjectAllocation";
import AttendanceRecords from "./AttendanceRecords";
import BillGeneration from "./BillGeneration";

const SESSION = "2026-27";

// Helper to read a faculty record's registration date regardless of field naming
const getFacultyDate = (f) =>
  new Date(
    f.created_at || f.createdAt || f.registered_at || f.registeredAt || f.updated_at || 0
  ).getTime();

// Helper to sort faculty list by date, direction controlled by `order`
const sortByDate = (list, order) => {
  return [...list].sort((a, b) => {
    const dateA = getFacultyDate(a);
    const dateB = getFacultyDate(b);
    return order === "newest" ? dateB - dateA : dateA - dateB;
  });
};

// NEW: Small dropdown filter component matching the "Sort by Date" UI
function DateFilterDropdown({ sortOrder, setSortOrder }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const options = [
    { value: "newest", label: "Date: Newest to Oldest" },
    { value: "oldest", label: "Date: Oldest to Newest" },
  ];

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setOpen((prev) => !prev)}
        className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-semibold transition-colors ${
          open
            ? "border-slate-800 text-slate-800"
            : "border-slate-200 text-slate-600 hover:border-slate-300"
        }`}
      >
        <Filter size={16} />
        Filter
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl border border-slate-200 shadow-lg z-20 overflow-hidden">
          <div className="px-4 pt-3 pb-2">
            <p className="text-xs font-semibold tracking-wide text-slate-400">
              SORT BY DATE
            </p>
          </div>
          <div className="pb-2">
            {options.map((opt) => {
              const isActive = sortOrder === opt.value;
              return (
                <button
                  key={opt.value}
                  onClick={() => {
                    setSortOrder(opt.value);
                    setOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-4 py-2.5 text-sm text-left transition-colors ${
                    isActive
                      ? "text-blue-600 font-semibold bg-blue-50"
                      : "text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {opt.label}
                  {isActive && <Check size={16} className="text-blue-600" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminDashboard({ onSignOut }) {
  const [activeTab, setActiveTab] = useState(() => {
    return sessionStorage.getItem('adminActiveTab') || 'dashboard';
  });

  // State to control mobile sidebar drawer
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    sessionStorage.setItem('adminActiveTab', activeTab);
  }, [activeTab]);

  const [pendingFaculty, setPendingFaculty] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  // NEW: Sort order state for the Filter dropdown ("newest" | "oldest")
  const [sortOrder, setSortOrder] = useState("newest");
  
  // State to hold the faculty member when switching to Subject Allocation
  const [selectedFacultyForAllocation, setSelectedFacultyForAllocation] = useState(null);
  
  // Notification Toast State
  const [toastConfig, setToastConfig] = useState(null);

  const admin = JSON.parse(sessionStorage.getItem("iipsCurrentSession") || "{}") || { name: "Program Incharge" };

  const fetchPending = useCallback(async () => {
      setLoading(true);
      setError("");
      try {
        const response = await adminApi.getPendingFaculty();
        if (response && response.success !== false) {
          setPendingFaculty(Array.isArray(response.data) ? response.data : []);
        } else {
          setError(response?.message || "Failed to load pending faculty from server.");
        }
      } catch (err) {
        setError(err?.response?.data?.message || "Failed to connect to the server.");
      } finally {
        setLoading(false);
      }
    }, []);

  // 1. Fetch when tab becomes 'dashboard'
  useEffect(() => {
    if (activeTab === 'dashboard') {
      fetchPending();
    }
  }, [fetchPending, activeTab]);

  // 2. Global Event Listener for automatic background refreshing
  useEffect(() => {
    const handleGlobalRefresh = () => {
      if (activeTab === 'dashboard') {
        fetchPending();
      }
    };

    window.addEventListener('refresh-dashboard', handleGlobalRefresh);
    return () => window.removeEventListener('refresh-dashboard', handleGlobalRefresh);
  }, [fetchPending, activeTab]);

  // Unified handler: instantly remove/update the pending list, no refetch needed
  const handleFacultyAction = useCallback((toastData) => {
    if (toastData?.userId && (toastData.action === 'approved' || toastData.action === 'rejected')) {
      // Remove from pending list immediately — approved/rejected faculty leave this queue
      setPendingFaculty(prev => prev.filter(f => (f.user_id || f.id) !== toastData.userId));
      
      // Tell the rest of the app to refresh its data globally
      window.dispatchEvent(new Event('refresh-dashboard'));
    }
    if (toastData) {
      setToastConfig(toastData);
    }
  }, []);

  // UPDATED: search filter + date sort applied together
  const filteredFaculty = useMemo(() => {
    let list = pendingFaculty;

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (f) =>
          (f.full_name || f.name)?.toLowerCase().includes(q) || 
          f.email?.toLowerCase().includes(q) ||
          f.uvfin?.toLowerCase().includes(q)
      );
    }

    return sortByDate(list, sortOrder);
  }, [pendingFaculty, search, sortOrder]);

  const monthLabel = useMemo(
    () => new Date().toLocaleString("en-US", { month: "long", year: "numeric" }),
    []
  );

  const renderContent = () => {
    switch (activeTab) {
      case 'faculty-management': 
        return (
          <FacultyManagement 
            setActiveTab={setActiveTab} 
            onAllocateSubject={(faculty) => {
              setSelectedFacultyForAllocation(faculty);
              setActiveTab('subject-allocation');
            }}
          />
        );
      case 'subject-allocation': 
        return (
          <SubjectAllocation 
            prefilledFaculty={selectedFacultyForAllocation} 
          />
        );
      case 'attendance-records': 
        return <AttendanceRecords />;
      case 'bill-generation': 
        return <BillGeneration />;
      case 'dashboard':
      default:
        return (
          <main className="p-4 sm:p-6 space-y-6 max-w-full overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-slate-800">
                  Welcome {admin.name || "Program Incharge"}
                </h1>
                <p className="text-sm text-slate-400">Here's the overview for {monthLabel}</p>
              </div>
              <button className="w-full sm:w-auto px-4 py-2 rounded-full border border-slate-200 bg-white text-sm font-medium text-slate-600">
                Session {SESSION}
              </button>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm w-full overflow-hidden">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between px-4 sm:px-6 py-4 border-b border-slate-100 gap-3 sm:gap-0">
                <div className="flex items-center gap-2">
                  <h2 className="font-semibold text-slate-800 text-sm sm:text-base">
                    Faculty Remaining for Registration approval
                  </h2>
                  <span className="px-2.5 py-0.5 rounded-md bg-[#FFEDD5] text-[#92400E] text-xs font-bold">
                    {pendingFaculty.length}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {/* NEW: Filter dropdown for sorting by date */}
                  <DateFilterDropdown sortOrder={sortOrder} setSortOrder={setSortOrder} />

                  <button
                    onClick={() => setActiveTab('faculty-management')}
                    className="flex items-center justify-center sm:justify-start gap-1 text-sm font-medium text-[#585F6C] hover:text-[#141B2B] transition-colors"
                  >
                    View All <ArrowRight size={16} />
                  </button>
                </div>
              </div>

              {error && (
                <p className="text-sm text-red-500 px-4 sm:px-6 py-4">{error}</p>
              )}

              {/* Ensure this child table component handles responsive overflow internally */}
              <PendingFacultyTable
                faculty={filteredFaculty}
                loading={loading}
                onChanged={handleFacultyAction}
              />
            </div>

            {/* NOTIFICATION TOAST BANNER */}
            {toastConfig && (
              <NotificationToast 
                action={toastConfig.action}
                facultyName={toastConfig.facultyName}
                email={toastConfig.email}
                uvfin={toastConfig.uvfin}
                onClose={() => setToastConfig(null)}
              />
            )}
          </main>
        );
    }
  };

  return (
    <div className="flex min-h-screen bg-[#F8F9FA] relative">
      {/* Pass mobile control props to the Sidebar */}
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={(tab) => {
          setActiveTab(tab);
          setIsMobileMenuOpen(false); // Close sidebar on mobile when changing tabs
        }} 
        onSignOut={onSignOut} 
        isOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
      />
      
      <div className="flex-1 min-w-0 w-full flex flex-col">
        {/* Pass the hamburger menu click handler to Topbar */}
        <Topbar 
          onSearch={setSearch} 
          onMenuClick={() => setIsMobileMenuOpen(true)}
        />
        {renderContent()}
      </div>
    </div>
  );
}