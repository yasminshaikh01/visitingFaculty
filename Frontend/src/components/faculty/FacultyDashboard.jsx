import React, { useState, useEffect } from "react";
import { FileText, BookX, Loader2 } from "lucide-react";
import api from "../../api/axiosInstance"; // Adjust the ../ as needed based on folder depth;

import PageHeader from "./shared/PageHeader";
import Sidebar from "./shared/Sidebar"; 

// Import your sub-pages here:
import MarkAttendance from "./MarkAttendance";
import AttendanceHistory from "./AttendanceHistory";
import ViewBill from "./ViewBill";

// 1. Dashboard Homepage UI
function DashboardOverview({ facultyInfo, allocatedSubjects, isLoading }) {
  return (
    <div className="flex flex-1 flex-col min-w-0">
      <PageHeader title="Unified Visiting Faculty Management, IIPS, DAVV" />
      
      <div className="px-4 py-6 sm:px-8">
        <h2 className="text-2xl font-bold text-slate-900">{facultyInfo.name}</h2>
        <p className="mt-1 text-sm text-slate-500">
          {facultyInfo.month} · Session {facultyInfo.session}
        </p>

        <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-6 py-5">
            <h3 className="text-lg font-bold text-slate-900">My Allocated Subjects</h3>
            <span className="rounded-full bg-slate-100 px-4 py-1 text-xs font-medium text-slate-600">
              Session {facultyInfo.session}
            </span>
          </div>

          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-500">
              <Loader2 className="animate-spin h-8 w-8 text-[#004DD2] mb-3" />
              <p>Loading your allocated subjects...</p>
            </div>
          ) : allocatedSubjects.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-4 py-16 text-center sm:px-6">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-slate-100 bg-slate-50">
                <BookX className="h-8 w-8 text-slate-400" />
              </div>
              <h3 className="text-base font-bold text-slate-900">No Subjects Allocated</h3>
              <p className="mt-2 max-w-sm text-sm leading-relaxed text-slate-500">
                You have not been assigned any subjects for the current session yet. Please check back later once the Program Incharge has allocated your courses.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <th className="px-6 py-3 font-semibold">Course</th>
                    <th className="px-6 py-3 font-semibold">Sem</th>
                    <th className="px-6 py-3 font-semibold">Sec</th>
                    <th className="px-6 py-3 font-semibold">Subject</th>
                    <th className="px-6 py-3 font-semibold">Type</th>
                    <th className="px-6 py-3 font-semibold">Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {allocatedSubjects.map((subject) => (
                    <tr key={subject.allocation_id} className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4">
                        <p className="font-semibold text-slate-800">{subject.course_name}</p>
                        <p className="text-xs text-slate-500">{subject.course_code}</p>
                      </td>
                      <td className="px-6 py-4 text-slate-600">{subject.semester_number}</td>
                      <td className="px-6 py-4 text-slate-600">{subject.section_name || "-"}</td>
                      <td className="px-6 py-4">
                        <p className="font-semibold text-[#004DD2]">{subject.subject_code}</p>
                        <p className="text-slate-800">{subject.subject_name}</p>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`rounded-full px-3 py-1 text-xs font-medium whitespace-nowrap ${
                          subject.session_type === 'Practical' 
                            ? 'bg-blue-50 text-blue-600' 
                            : 'bg-indigo-50 text-indigo-700'
                        }`}>
                          {subject.session_type || 'Theory'}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-semibold text-slate-700">
                        ₹{parseFloat(subject.rate_per_hour || 0)}/hr
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        {/*

        <button 
          disabled={allocatedSubjects.length === 0}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-4 text-sm font-semibold text-[#004DD2] transition-colors hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:px-8"
        >
          <FileText className="h-4 w-4" />
          Download Schedule PDF
        </button>
        */}
      </div>
    </div>
  );
}


// 2. The Main Layout Container
export default function FacultyDashboard({ onSignOut }) {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [allocatedSubjects, setAllocatedSubjects] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [facultyInfo, setFacultyInfo] = useState({
    id: null,
    name: "Loading...",
    role: "Faculty",
    month: new Date().toLocaleString('default', { month: 'long', year: 'numeric' }),
    session: "2026-27"
  });

  // Fetch data on mount
  useEffect(() => {
    const fetchDashboardData = async () => {
      setIsLoading(true);
      try {
        const sessionStr = sessionStorage.getItem('iipsCurrentSession');
        if (!sessionStr) {
          setIsLoading(false);
          return;
        }

        const session = JSON.parse(sessionStr);
        const targetId = session.userId;

        if (!targetId) {
          console.error("No userId found in session!");
          setIsLoading(false);
          return;
        }

        // 1. Fetch Profile Details to get accurate Name/Role
        let finalName = session.fullName || session.name || "Visiting Faculty";
        let finalRole = session.role || "Faculty";

try {
          const profileRes = await api.get(`/admin/faculty/${targetId}`);
          
          if (profileRes.data.success) {
            const data = profileRes.data.data;
            finalName = data.full_name;
            finalRole = data.role ? data.role.charAt(0).toUpperCase() + data.role.slice(1) : finalRole;

            // Format with "Prof." if it doesn't already have a title
            if (!finalName.toLowerCase().startsWith("dr.") && !finalName.toLowerCase().startsWith("prof.")) {
              finalName = "Prof. " + finalName;
            }
          }
        } catch (profileErr) {
          console.error("Could not fetch profile details", profileErr);
          // Fallback title formatting if API fails
          if (finalName !== "Visiting Faculty" && !finalName.toLowerCase().startsWith("dr.") && !finalName.toLowerCase().startsWith("prof.")) {
            finalName = "Prof. " + finalName;
          }
        }

        setFacultyInfo(prev => ({ 
          ...prev, 
          id: targetId,
          name: finalName,
          role: finalRole
        }));

        // 2. Fetch Allocations
        const allocRes = await api.get(`/attendance/my-allocations/${targetId}`);

        if (allocRes.data.success) {
          if (allocRes.data.allocations && allocRes.data.allocations.length > 0) {
            setFacultyInfo(prev => ({ ...prev, session: allocRes.data.allocations[0].academic_year || prev.session }));
          }
          setAllocatedSubjects(allocRes.data.allocations || []);
        }
      } catch (error) {
        console.error("Error fetching dashboard allocations:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  const renderContent = () => {
    switch (activeTab) {
      case "dashboard":
        return <DashboardOverview facultyInfo={facultyInfo} allocatedSubjects={allocatedSubjects} isLoading={isLoading} />;
      case "mark-attendance":
        return <MarkAttendance />;
      case "attendance-history":
        return <AttendanceHistory />;
      case "view-bill":
        return <ViewBill />;
      default:
        return <DashboardOverview facultyInfo={facultyInfo} allocatedSubjects={allocatedSubjects} isLoading={isLoading} />;
    }
  };

  return (
    <div className="flex min-h-screen w-full flex-col lg:flex-row bg-[#F8F9FB]">
      <Sidebar 
        onNavigate={setActiveTab} 
        currentView={activeTab} 
        onSignOut={onSignOut}
        // Pass dynamic data as props so it stays synced
        facultyName={facultyInfo.name}
        facultyRole={facultyInfo.role}
      />
      
      <div className="flex flex-1 flex-col min-w-0">
        {renderContent()}
      </div>
    </div>
  );
}