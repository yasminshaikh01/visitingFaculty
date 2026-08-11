import React, { useState, useEffect } from "react";
import Topbar from "./Topbar";
import { ChevronLeft, Plus, Trash2, User } from "lucide-react";
import api from "../../api/axiosInstance";

export default function ProgramDetail({ program, onBack, onUpdate }) {
  const [courseData, setCourseData] = useState(null);
  const [subjects, setSubjects] = useState({});
  const [expandedSem, setExpandedSem] = useState(1);
  const [loading, setLoading] = useState(true);

  const courseId = program.course_id;

  // 1. Fetch exact detail from Backend DB
  useEffect(() => {
    const fetchCourseDashboard = async () => {
      try {
        const res = await api.get(`/super_admin/courseDashboard/${courseId}`);
        
        if (res.data.success && res.data.data.length > 0) {
          setCourseData(res.data.data[0]);
        } else {
          throw new Error("API returned no data");
        }
      } catch (error) {
        console.error("Failed to fetch course dashboard:", error);
        setCourseData(program); 
      } finally {
        setLoading(false);
        fetchSubjects(1); 
      }
    };
    fetchCourseDashboard();
  }, [courseId, program]);

  // 2. Fetch Subjects 
  const fetchSubjects = async (semesterId) => {
    try {
      const res = await api.get(`/super_admin/subjects/${courseId}/${semesterId}`);

      if (res.data.success) {
        setSubjects((prev) => ({ ...prev, [semesterId]: res.data.data || [] }));
      }
    } catch (error) {
      console.error(`Failed to fetch subjects for semester ${semesterId}:`, error.message);
      setSubjects((prev) => ({ ...prev, [semesterId]: [] }));
    }
  };

  const handleAccordionClick = (semId) => {
    const isExpanding = expandedSem !== semId;
    setExpandedSem(isExpanding ? semId : null);
    if (isExpanding && !subjects[semId]) {
      fetchSubjects(semId);
    }
  };

  // 3. Update Program Incharge in DB
  const handleChangeIncharge = async () => {
    const newIncharge = prompt("Enter new Program Incharge name:", courseData.program_incharge);
    if (!newIncharge || newIncharge.trim() === "") return;

    try {
      const res = await api.put(`/super_admin/updateIncharge/${courseId}`, {
        program_incharge: newIncharge
      });
      
      const data = res.data;
      
      if (data.success) {
        const updatedCourse = { ...courseData, program_incharge: newIncharge };
        setCourseData(updatedCourse); 
        if (onUpdate) onUpdate(updatedCourse); 
        alert("Program Incharge updated successfully!");
      } else {
        alert("Failed to update incharge: " + data.message);
      }
    } catch (error) {
      console.error("Failed to update incharge:", error);
      alert("Network error: Could not reach backend.");
    }
  };

  // 4a. Add Section 
  const handleAddSection = async () => {
    const sectionName = prompt("Enter new Section Name (e.g., C):");
    if (!sectionName || sectionName.trim() === "") return;

    const formattedSectionName = sectionName.trim().toUpperCase();

    try {
      const res = await api.post(`/super_admin/addSection/${courseId}`, {
        section_name: formattedSectionName
      });
      
      const data = res.data;
      
      if (data.success) {
        const newSection = { section_id: data.data.section_id, section_name: data.data.section_name };
        const updatedCourse = { ...courseData, Sections: [...(courseData.Sections || []), newSection] };
        setCourseData(updatedCourse); 
        if (onUpdate) onUpdate(updatedCourse); 
      } else {
        alert("Failed to add section: " + data.message);
      }
    } catch (error) {
      console.error("Failed to add section:", error);
      alert("Network error: Could not reach backend.");
    }
  };

  // 4b. Delete Section (DELETE /api/super_admin/deleteSection/:course_id/:section_id)
  const handleDeleteSection = async (sectionId) => {
    if (!window.confirm("Are you sure you want to delete this section?")) return;

    try {
      const res = await api.delete(`/super_admin/deleteSection/${courseId}/${sectionId}`);
      
      const data = res.data;

      if (data.success) {
        const updatedCourse = { ...courseData, Sections: courseData.Sections.filter(s => s.section_id !== sectionId) };
        setCourseData(updatedCourse); 
        if (onUpdate) onUpdate(updatedCourse);
      } else {
        alert("Failed to delete section: " + data.message);
      }
    } catch (error) {
      console.error("Failed to delete section:", error);
      alert("Network error: Could not reach backend.");
    }
  };

  // 5a. Add Semester (POST /api/super_admin/addSemester/:course_id)
  const handleAddSemester = async () => {
    const nextSemId = (courseData.total_semesters || 0) + 1;
    try {
      const res = await api.post(`/super_admin/addSemester/${courseId}`, {
        semester_id: nextSemId
      });
      
      const data = res.data;

      if (data.success) {
        const updatedCourse = { ...courseData, total_semesters: nextSemId };
        setCourseData(updatedCourse);
        if (onUpdate) onUpdate(updatedCourse);
      } else {
        alert("Failed to add semester: " + data.message);
      }
    } catch (error) {
      console.error("Failed to add semester:", error);
      alert("Network error: Could not reach backend.");
    }
  };

  // 5b. Delete Semester (DELETE /api/super_admin/deleteSemester/:course_id/:semester_id)
  const handleDeleteSemester = async () => {
    if (courseData.total_semesters <= 1) {
      alert("A program must have at least 1 semester.");
      return;
    }
    if (!window.confirm("Are you sure you want to remove the last semester? All associated subjects will be lost.")) return;

    const semesterToDelete = courseData.total_semesters;

    try {
      const res = await api.delete(`/super_admin/deleteSemester/${courseId}/${semesterToDelete}`);
      
      const data = res.data;

      if (data.success) {
        const updatedCourse = { ...courseData, total_semesters: courseData.total_semesters - 1 };
        setCourseData(updatedCourse);
        if (onUpdate) onUpdate(updatedCourse);
        
        // Remove subjects from local state for the deleted semester
        setSubjects(prev => {
          const newSubjects = { ...prev };
          delete newSubjects[semesterToDelete];
          return newSubjects;
        });
      } else {
        alert("Failed to delete semester: " + data.message);
      }
    } catch (error) {
      console.error("Failed to delete semester:", error);
      alert("Network error: Could not reach backend.");
    }
  };

  // 6. Add Subject
  const handleAddSubject = async (semesterId) => {
    const subjectCode = prompt("Enter Subject Code (e.g., IT-104A):");
    if (!subjectCode) return;
    const subjectName = prompt("Enter Subject Name:");
    if (!subjectName) return;

    try {
      const res = await api.post(`/super_admin/addSubject/${courseId}/${semesterId}`, {
        subject_code: subjectCode, subject_name: subjectName
      });
      const data = res.data;
      if (data.success) {
        fetchSubjects(semesterId);
      } else {
        alert("Failed to add subject: " + data.message);
      }
    } catch (error) {
      console.error("Failed to add subject:", error);
    }
  };

  // 7. Delete Subject
  const handleDeleteSubject = async (semesterId, subjectId) => {
    if (!window.confirm("Are you sure you want to delete this subject?")) return;

    try {
      const res = await api.delete(`/super_admin/deleteSubject/${courseId}/${semesterId}/${subjectId}`);
      const data = res.data;
      if (data.success) {
        fetchSubjects(semesterId);
      } else {
        alert("Failed to delete subject: " + data.message);
      }
    } catch (error) {
      console.error("Failed to delete subject:", error);
    }
  };

  if (loading) return <div className="p-8 text-center text-gray-500">Loading course details from DB...</div>;
  if (!courseData) return <div className="p-8 text-center text-red-500">Error loading course.</div>;

  return (
    <div className="flex flex-col h-full bg-gray-50">
      <Topbar 
        title="Visiting Faculty Management" 
        subtitle="Manage program details and subjects" 
        showSearch={false} 
      />

      <div className="p-8 flex-1 overflow-y-auto space-y-6">
        
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-gray-500 font-medium">
          <button onClick={onBack} className="hover:text-purple-600 transition-colors">Dashboard</button>
          <span>›</span>
          <button onClick={onBack} className="hover:text-purple-600 transition-colors">Programs</button>
          <span>›</span>
          <span className="text-purple-600">{courseData.course_name}</span>
        </div>

        {/* Program Details Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex justify-between">
          <div className="flex-1 grid grid-cols-2 gap-y-6 gap-x-8 pr-8 border-r border-gray-100">
            <div className="col-span-2 flex justify-between">
               <h3 className="text-lg font-bold text-gray-900 flex items-center gap-3">
                  Program Details 
                  {(courseData.is_active === 1 || courseData.is_active === true) ? (
                    <span className="text-[10px] bg-green-100 text-green-700 px-2 py-1 rounded uppercase tracking-wider">Active</span>
                  ) : null}
               </h3>
            </div>

            <div>
              <p className="text-xs text-gray-400 font-semibold mb-1 uppercase">Program Name</p>
              <p className="font-bold text-gray-800">{courseData.course_name}</p>
            </div>

            <div>
              <p className="text-xs text-gray-400 font-semibold mb-1 uppercase">Total Semesters</p>
              <p className="font-bold text-gray-800">{courseData.total_semesters} Semesters</p>
            </div>

            <div>
              <p className="text-xs text-gray-400 font-semibold mb-1 uppercase">Sections</p>
              <div className="flex flex-wrap items-center gap-2 mt-1">
                {courseData.Sections?.length > 0 ? (
                  courseData.Sections.map(s => (
                    <span key={s.section_id} className="bg-gray-100 border border-gray-200 text-gray-700 px-2 py-0.5 rounded text-xs font-semibold flex items-center gap-1">
                      {s.section_name}
                      <button onClick={() => handleDeleteSection(s.section_id)} className="text-red-400 hover:text-red-600 font-bold ml-1 text-sm leading-none">&times;</button>
                    </span>
                  ))
                ) : (
                  <p className="text-sm text-gray-500 mr-2">None</p>
                )}
                <button 
                  onClick={handleAddSection}
                  className="bg-purple-50 text-purple-600 hover:bg-purple-100 px-2 py-0.5 rounded text-xs font-semibold border border-purple-200 transition-colors"
                >
                  + Add
                </button>
              </div>
            </div>
          </div>

          <div className="w-64 pl-8 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mb-3">
              <User className="w-8 h-8 text-blue-500" />
            </div>
            <p className="text-xs text-gray-400 font-semibold uppercase">Program Incharge</p>
            <p className="font-bold text-gray-900">{courseData.program_incharge || "Not Assigned"}</p>
            <button 
              onClick={handleChangeIncharge}
              className="mt-3 text-blue-600 border border-blue-200 px-4 py-1.5 rounded-full text-xs font-semibold hover:bg-blue-50 transition-colors"
            >
              Change Incharge
            </button>
          </div>
        </div>

        {/* Subject Management Accordion */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-gray-900">Subject Management</h3>
            <div className="flex gap-2">
              <button 
                onClick={handleDeleteSemester} 
                className="flex items-center gap-1 border border-red-200 text-red-600 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
              >
                <Trash2 className="w-3 h-3"/> Remove Last Sem
              </button>
              <button 
                onClick={handleAddSemester} 
                className="flex items-center gap-1 border border-blue-200 text-blue-600 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
              >
                <Plus className="w-3 h-3"/> Add Sem
              </button>
            </div>
          </div>
          
          {Array.from({ length: courseData.total_semesters || 0 }, (_, i) => i + 1).map((sem) => (
            <div key={sem} className="mb-4 border border-gray-200 rounded-lg overflow-hidden">
              <button 
                onClick={() => handleAccordionClick(sem)}
                className="w-full flex items-center gap-3 bg-gray-50 p-4 font-bold text-gray-800 hover:bg-gray-100 transition-colors"
              >
                <ChevronLeft className={`w-5 h-5 transition-transform ${expandedSem === sem ? "-rotate-90" : "rotate-180"}`} />
                Semester {sem} 
                <span className="bg-blue-500 text-white text-xs px-2 py-0.5 rounded-full">
                  {subjects[sem] ? subjects[sem].length : 0} Subjects
                </span>
              </button>
              
              {expandedSem === sem && (
                <div className="p-4">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="text-xs text-gray-400 uppercase border-b border-gray-100">
                        <th className="pb-3">Subject Name</th>
                        <th className="pb-3">Code</th>
                        <th className="pb-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {subjects[sem] && subjects[sem].length > 0 ? (
                        subjects[sem].map(sub => (
                          <tr key={sub.subject_id} className="border-b border-gray-50">
                            <td className="py-4 font-semibold text-gray-800">{sub.subject_name}</td>
                            <td className="py-4 text-gray-500">{sub.subject_code}</td>
                            <td className="py-4 text-right">
                              <button 
                                onClick={() => handleDeleteSubject(sem, sub.subject_id)}
                                className="text-red-400 hover:text-red-600 bg-red-50 p-2 rounded-lg transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="3" className="py-4 text-center text-sm text-gray-500">
                            No subjects added for this semester yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                  <div className="mt-4 flex justify-end">
                    <button 
                      onClick={() => handleAddSubject(sem)}
                      className="flex items-center gap-2 border border-blue-600 text-blue-600 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-blue-50 transition-colors"
                    >
                      <Plus className="w-4 h-4" /> Add Subject
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}