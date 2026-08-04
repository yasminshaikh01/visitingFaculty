import React, { useState, useEffect } from "react";
import Topbar from "./Topbar";
import ProgramDetail from "./ProgramDetail";
import { Eye, ChevronDown, Plus, Trash2 } from "lucide-react";
import api from "../../api/axiosInstance";

export default function ProgramsPage() {
  const [programs, setPrograms] = useState([]);
  const [selectedProgram, setSelectedProgram] = useState(null);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState(false);

  // Fetch all programs from the backend DB
  const fetchPrograms = async () => {
    setLoading(true);
    setApiError(false);
    try {
      const res = await api.get('/super_admin/courseDashboard');
      
      if (res.data.success) {
        setPrograms(res.data.data);
      } else {
        throw new Error("Backend returned false for success.");
      }
    } catch (error) {
      console.error("API Error: Could not connect to backend to fetch courses.", error);
      setApiError(true);
      
      // Fallback data
      setPrograms([
        { course_id: 1, course_name: "MCA", program_incharge: "Dr. Shaligram Prajapati", total_semesters: 10, is_active: 1, year: 2026, Sections: [{ section_id: 1, section_name: "A" }, { section_id: 2, section_name: "B" }] },
        { course_id: 2, course_name: "Mtech(IT)", program_incharge: "Dr. Kirti Mathur", total_semesters: 10, is_active: 1, year: 2026, Sections: [{ section_id: 3, section_name: "A" }] }
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPrograms();
  }, []);

  const handleProgramUpdate = (updatedCourse) => {
    setPrograms((prevPrograms) =>
      prevPrograms.map((p) => (p.course_id === updatedCourse.course_id ? updatedCourse : p))
    );
  };

  // 1. Add a new Program (POST /api/super_admin/addCourse)
  const handleAddProgram = async () => {
    const programName = prompt("Enter new Program Name (e.g., BCA):");
    if (!programName || programName.trim() === "") return;

    const totalSemestersStr = prompt("Enter total semesters (e.g., 6):");
    if (!totalSemestersStr || isNaN(totalSemestersStr)) return;
    const totalSemesters = parseInt(totalSemestersStr, 10);

    try {
      const res = await api.post('/super_admin/addCourse', { 
        course_name: programName, 
        program_incharge: "Not Assigned",
        total_semesters: totalSemesters,
        year: new Date().getFullYear()
      });
      const data = res.data;
      
      if (data.success) {
        // Fetch fresh list from DB to ensure accurate IDs
        fetchPrograms();
      } else {
        alert("Failed to add program: " + data.message);
      }
    } catch (error) {
      console.error("Add program error:", error);
      alert("Network error: Could not reach backend.");
    }
  };

  // 2. Delete a Program (DELETE /api/super_admin/deleteCourse/:course_id)
  const handleDeleteProgram = async (id) => {
    if (!window.confirm("Are you sure you want to completely delete this program?")) return;

    try {
      const res = await api.delete(`/super_admin/deleteCourse/${id}`);
      const data = res.data;
      
      if (data.success) {
        setPrograms(prev => prev.filter(p => p.course_id !== id));
      } else {
        alert("Failed to delete program: " + data.message);
      }
    } catch (e) {
      console.error(e);
      alert("Network error: Could not reach backend.");
    }
  };

  if (selectedProgram) {
    return (
      <ProgramDetail 
        program={selectedProgram} 
        onBack={() => {
          setSelectedProgram(null);
          fetchPrograms(); 
        }} 
        onUpdate={handleProgramUpdate} 
      />
    );
  }

  return (
    <div className="flex flex-col h-full bg-gray-50">
      <Topbar 
        title="Programs" 
        subtitle="View and manage all academic programs available in the IIPS." 
        showSearch={false} 
      />

      <div className="p-8 flex-1 overflow-y-auto">
        
        {apiError && (
          <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg mb-6 text-sm font-medium">
            Warning: Could not fetch courses from the backend database. Displaying offline fallback data.
          </div>
        )}

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          
          <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <h2 className="text-lg font-bold text-gray-800">Program List</h2>
              <div className="bg-blue-50 text-blue-600 px-3 py-1 rounded-full text-xs font-semibold">
                {programs.length} Programs
              </div>
            </div>
            <button 
              onClick={handleAddProgram}
              className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-purple-700 transition-colors"
            >
              <Plus className="w-4 h-4" /> Add Program
            </button>
          </div>

          {loading ? (
            <div className="p-8 text-center text-gray-500 font-medium">Loading programs from database...</div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-y border-gray-100 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  <th className="p-4">Program Name</th>
                  <th className="p-4">Semesters</th>
                  <th className="p-4">Sections</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="text-sm text-gray-700">
                {programs.length > 0 ? (
                  programs.map((prog) => (
                    <tr key={prog.course_id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                      <td className="p-4 font-bold text-gray-900">{prog.course_name}</td>
                      <td className="p-4">{prog.total_semesters}</td>
                      <td className="p-4">
                        <button className="flex items-center justify-between min-w-[100px] border border-gray-200 px-3 py-1.5 rounded-lg text-gray-600 hover:bg-gray-50 bg-white">
                          <span className="text-left leading-tight">
                            Section<br/>
                            <span className="font-semibold">{prog.Sections?.length > 0 ? prog.Sections.map(s => s.section_name).join(", ") : "None"}</span>
                          </span>
                          <ChevronDown className="w-4 h-4 ml-2" />
                        </button>
                      </td>
                      <td className="p-4 flex items-center justify-end gap-2 mt-1">
                        <button 
                          onClick={() => setSelectedProgram(prog)}
                          className="flex items-center gap-2 text-blue-600 border border-blue-200 bg-blue-50 hover:bg-blue-100 px-4 py-1.5 rounded-lg font-medium transition-colors"
                        >
                          <Eye className="w-4 h-4" /> View
                        </button>
                        <button 
                          onClick={() => handleDeleteProgram(prog.course_id)}
                          className="text-red-500 border border-red-200 bg-red-50 hover:bg-red-100 p-2 rounded-lg font-medium transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="4" className="p-8 text-center text-gray-500">
                      No programs found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}