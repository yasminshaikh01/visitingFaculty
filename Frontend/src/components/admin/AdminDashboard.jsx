import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowRight } from "lucide-react"; 
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

export default function AdminDashboard({ onSignOut }) {
  const [activeTab, setActiveTab] = useState(() => {
    return localStorage.getItem('adminActiveTab') || 'dashboard';
  });

  useEffect(() => {
    localStorage.setItem('adminActiveTab', activeTab);
  }, [activeTab]);

  const [pendingFaculty, setPendingFaculty] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  
  // State to hold the faculty member when switching to Subject Allocation
  const [selectedFacultyForAllocation, setSelectedFacultyForAllocation] = useState(null);
  
  // Notification Toast State
  const [toastConfig, setToastConfig] = useState(null);

  const admin = JSON.parse(localStorage.getItem("iipsCurrentSession") || "{}") || { name: "Program Incharge" };

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

  useEffect(() => {
    if (activeTab === 'dashboard') {
      fetchPending();
    }
  }, [fetchPending, activeTab]);

  // Unified handler to refresh table and show banner
  // const handleFacultyAction = useCallback((toastData) => {
  //   fetchPending(); // Instantly refresh pending table so the user disappears from the queue
  //   if (toastData) {
  //     setToastConfig(toastData); // Show the toast with the data from the modal
  //   }
  // }, [fetchPending]);
  // Unified handler: instantly remove/update the pending list, no refetch needed
  const handleFacultyAction = useCallback((toastData) => {
    if (toastData?.userId && (toastData.action === 'approved' || toastData.action === 'rejected')) {
      // Remove from pending list immediately — approved/rejected faculty leave this queue
      setPendingFaculty(prev => prev.filter(f => (f.user_id || f.id) !== toastData.userId));
    }
    if (toastData) {
      setToastConfig(toastData);
    }
  }, []);

  const filteredFaculty = useMemo(() => {
    if (!search.trim()) return pendingFaculty;
    const q = search.toLowerCase();
    return pendingFaculty.filter(
      (f) =>
        (f.full_name || f.name)?.toLowerCase().includes(q) || 
        f.email?.toLowerCase().includes(q) ||
        f.uvfin?.toLowerCase().includes(q)
    );
  }, [pendingFaculty, search]);

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
          <main className="p-4 sm:p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h1 className="text-2xl font-bold text-slate-800">
                  Welcome {admin.name || "Program Incharge"}
                </h1>
                <p className="text-sm text-slate-400">Here's the overview for {monthLabel}</p>
              </div>
              <button className="self-start sm:self-auto px-4 py-2 rounded-full border border-slate-200 bg-white text-sm font-medium text-slate-600">
                Session {SESSION}
              </button>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <h2 className="font-semibold text-slate-800">
                    Faculty Remaining for Registration approval
                  </h2>
                  <span className="px-2.5 py-0.5 rounded-md bg-[#FFEDD5] text-[#92400E] text-xs font-bold">
                    {pendingFaculty.length}
                  </span>
                </div>
                <button
                  onClick={() => setActiveTab('faculty-management')}
                  className="flex items-center gap-1 text-sm font-medium text-[#585F6C] hover:text-[#141B2B] transition-colors"
                >
                  View All <ArrowRight size={16} />
                </button>
              </div>

              {error && (
                <p className="text-sm text-red-500 px-6 py-4">{error}</p>
              )}

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
    <div className="flex min-h-screen bg-[#F8F9FA]">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} onSignOut={onSignOut} />
      <div className="flex-1 min-w-0">
        <Topbar onSearch={setSearch} />
        {renderContent()}
      </div>
    </div>
  );
}