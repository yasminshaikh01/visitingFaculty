import React, { useState, useEffect } from "react";
import Topbar from "./Topbar";
import { ChevronLeft, Plus, Trash2, User, AlertCircle } from "lucide-react";
import api from "../../api/axiosInstance";

export default function ProgramDetail({ program, onBack, onUpdate }) {
  const [courseData, setCourseData] = useState(null);
  const [subjects, setSubjects] = useState({});
  const [expandedSem, setExpandedSem] = useState(1);
  const [loading, setLoading] = useState(true);
  const [semesterStatus, setSemesterStatus] = useState({});

  // ==========================================
  // CUSTOM MODAL STATE
  // ==========================================
  const [modal, setModal] = useState({
    isOpen: false,
    type: "input", // types: "input", "confirm", "addSubject", "alert"
    title: "",
    message: "",
    placeholder: "",
    defaultValue: "",
    isError: false,
    onConfirm: null,
  });
  const [modalInput1, setModalInput1] = useState("");
  const [modalInput2, setModalInput2] = useState("");

  // Reset inputs when modal opens
  useEffect(() => {
    if (modal.isOpen) {
      setModalInput1(modal.defaultValue || "");
      setModalInput2("");
    }
  }, [modal.isOpen, modal.defaultValue]);

  const closeModal = () => setModal({ ...modal, isOpen: false });

  const showAlert = (title, message, isError = false) => {
    setModal({ isOpen: true, type: "alert", title, message, isError, onConfirm: () => {} });
  };

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

  // 2. Fetch Subjects & Confirm Semester Row Exists
  const fetchSubjects = async (semesterId) => {
    setSemesterStatus((prev) => ({ ...prev, [semesterId]: "loading" }));
    try {
      const res = await api.get(`/super_admin/subjects/${courseId}/${semesterId}`);
      if (res.data.success) {
        setSubjects((prev) => ({ ...prev, [semesterId]: res.data.data || [] }));
        setSemesterStatus((prev) => ({ ...prev, [semesterId]: "exists" }));
      } else {
        setSubjects((prev) => ({ ...prev, [semesterId]: [] }));
        setSemesterStatus((prev) => ({ ...prev, [semesterId]: "missing" }));
      }
    } catch (error) {
      console.error(`Failed to fetch subjects for semester ${semesterId}:`, error.message);
      setSubjects((prev) => ({ ...prev, [semesterId]: [] }));
      setSemesterStatus((prev) => ({ ...prev, [semesterId]: "missing" }));
    }
  };

  const handleAccordionClick = (semId) => {
    const isExpanding = expandedSem !== semId;
    setExpandedSem(isExpanding ? semId : null);
    if (isExpanding && !subjects[semId]) fetchSubjects(semId);
  };

  // 3. Initialize the missing semester row explicitly
  const handleInitializeSemester = async (semesterId) => {
    try {
      const res = await api.post(`/super_admin/addSemester/${courseId}`, { semester_number: semesterId });
      if (res.data.success) {
        setSemesterStatus((prev) => ({ ...prev, [semesterId]: "exists" }));
        showAlert("Success", `Semester ${semesterId} record created successfully! You can now add subjects.`);
      } else {
        showAlert("Error", "Failed to initialize semester: " + res.data.message, true);
      }
    } catch (error) {
      showAlert("Network Error", "Could not reach backend to initialize semester.", true);
    }
  };

  // 4. Update Program Incharge
  const handleChangeIncharge = () => {
    setModal({
      isOpen: true,
      type: "input",
      title: "Change Program Incharge",
      message: "Enter the name of the new program incharge.",
      placeholder: "e.g., Dr. Jane Doe",
      defaultValue: courseData.program_incharge,
      onConfirm: async (newIncharge) => {
        if (!newIncharge || newIncharge.trim() === "") return;
        try {
          const res = await api.put(`/super_admin/updateIncharge/${courseId}`, { program_incharge: newIncharge });
          if (res.data.success) {
            const updatedCourse = { ...courseData, program_incharge: newIncharge };
            setCourseData(updatedCourse);
            if (onUpdate) onUpdate(updatedCourse);
            showAlert("Success", "Program Incharge updated successfully!");
          } else {
            showAlert("Error", "Failed to update incharge: " + res.data.message, true);
          }
        } catch (error) {
          showAlert("Network Error", "Could not reach backend.", true);
        }
      },
    });
  };

  // 5a. Add Section
  const handleAddSection = () => {
    setModal({
      isOpen: true,
      type: "input",
      title: "Add New Section",
      message: "Enter the letter or name for the new section.",
      placeholder: "e.g., C",
      onConfirm: async (sectionName) => {
        if (!sectionName || sectionName.trim() === "") return;
        const formattedSectionName = sectionName.trim().toUpperCase();
        try {
          const res = await api.post(`/super_admin/addSection/${courseId}`, { section_name: formattedSectionName });
          if (res.data.success) {
            const newSection = { section_id: res.data.data.section_id, section_name: res.data.data.section_name };
            const updatedCourse = { ...courseData, Sections: [...(courseData.Sections || []), newSection] };
            setCourseData(updatedCourse);
            if (onUpdate) onUpdate(updatedCourse);
          } else {
            showAlert("Error", "Failed to add section: " + res.data.message, true);
          }
        } catch (error) {
          showAlert("Network Error", "Could not reach backend.", true);
        }
      },
    });
  };

  // 5b. Delete Section
  const handleDeleteSection = (sectionId) => {
    setModal({
      isOpen: true,
      type: "confirm",
      title: "Delete Section",
      message: "Are you sure you want to permanently delete this section?",
      onConfirm: async () => {
        try {
          const res = await api.delete(`/super_admin/deleteSection/${courseId}/${sectionId}`);
          if (res.data.success) {
            const updatedCourse = { ...courseData, Sections: courseData.Sections.filter((s) => s.section_id !== sectionId) };
            setCourseData(updatedCourse);
            if (onUpdate) onUpdate(updatedCourse);
          } else {
            showAlert("Error", "Failed to delete section: " + res.data.message, true);
          }
        } catch (error) {
          showAlert("Network Error", "Could not reach backend.", true);
        }
      },
    });
  };

  // 6a. Add Semester
  const handleAddSemester = async () => {
    const nextSemId = (courseData.total_semesters || 0) + 1;
    try {
      const res = await api.post(`/super_admin/addSemester/${courseId}`, { semester_number: nextSemId });
      if (res.data.success) {
        const updatedCourse = { ...courseData, total_semesters: nextSemId };
        setCourseData(updatedCourse);
        if (onUpdate) onUpdate(updatedCourse);
      } else {
        showAlert("Error", "Failed to add semester: " + res.data.message, true);
      }
    } catch (error) {
      showAlert("Network Error", "Could not reach backend.", true);
    }
  };

  // 6b. Delete Semester
  const handleDeleteSemester = () => {
    if (courseData.total_semesters <= 1) {
      showAlert("Notice", "A program must have at least 1 semester.", true);
      return;
    }
    setModal({
      isOpen: true,
      type: "confirm",
      title: "Remove Last Semester",
      message: "Are you sure you want to remove the last semester? All associated subjects will be permanently lost.",
      onConfirm: async () => {
        const semesterToDelete = courseData.total_semesters;
        try {
          const res = await api.delete(`/super_admin/deleteSemester/${courseId}/${semesterToDelete}`);
          if (res.data.success) {
            const updatedCourse = { ...courseData, total_semesters: courseData.total_semesters - 1 };
            setCourseData(updatedCourse);
            if (onUpdate) onUpdate(updatedCourse);
            setSubjects((prev) => {
              const newSubjects = { ...prev };
              delete newSubjects[semesterToDelete];
              return newSubjects;
            });
          } else {
            showAlert("Error", "Failed to delete semester: " + res.data.message, true);
          }
        } catch (error) {
          showAlert("Network Error", "Could not reach backend.", true);
        }
      },
    });
  };

  // 7. Add Subject
  const handleAddSubject = (semesterId) => {
    setModal({
      isOpen: true,
      type: "addSubject",
      title: "Add New Subject",
      message: `Add a new subject to Semester ${semesterId}.`,
      onConfirm: async ({ subjectCode, subjectName }) => {
        if (!subjectCode || !subjectName) return;
        try {
          const res = await api.post(`/super_admin/addSubject/${courseId}/${semesterId}`, {
            subject_code: subjectCode,
            subject_name: subjectName,
          });
          if (res.data.success) {
            fetchSubjects(semesterId);
          } else {
            showAlert("Error", "Failed to add subject: " + res.data.message, true);
          }
        } catch (error) {
          showAlert("Network Error", "Could not reach backend.", true);
        }
      },
    });
  };

  // 8. Delete Subject
  const handleDeleteSubject = (semesterId, subjectId) => {
    setModal({
      isOpen: true,
      type: "confirm",
      title: "Delete Subject",
      message: "Are you sure you want to delete this subject?",
      onConfirm: async () => {
        try {
          const res = await api.delete(`/super_admin/deleteSubject/${courseId}/${semesterId}/${subjectId}`);
          if (res.data.success) {
            fetchSubjects(semesterId);
          } else {
            showAlert("Error", "Failed to delete subject: " + res.data.message, true);
          }
        } catch (error) {
          showAlert("Network Error", "Could not reach backend.", true);
        }
      },
    });
  };

  if (loading) return <div className="p-8 text-center text-gray-500">Loading course details from DB...</div>;
  if (!courseData) return <div className="p-8 text-center text-red-500">Error loading course.</div>;

  return (
    <div className="flex flex-col h-full bg-gray-50 relative">
      <Topbar title="Visiting Faculty Management" subtitle="Manage program details and subjects" showSearch={false} />

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
                {courseData.is_active === 1 || courseData.is_active === true ? (
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
                  courseData.Sections.map((s) => (
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
                <Trash2 className="w-3 h-3" /> Remove Last Sem
              </button>
              <button
                onClick={handleAddSemester}
                className="flex items-center gap-1 border border-blue-200 text-blue-600 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
              >
                <Plus className="w-3 h-3" /> Add Sem
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
                        subjects[sem].map((sub) => (
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

                  <div className="mt-4 flex justify-end items-center gap-3">
                    {semesterStatus[sem] === "loading" ? (
                      <span className="text-sm text-gray-400 italic">Verifying semester record...</span>
                    ) : semesterStatus[sem] === "missing" ? (
                      <button
                        onClick={() => handleInitializeSemester(sem)}
                        className="flex items-center gap-2 border border-orange-500 text-orange-600 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-orange-50 transition-colors"
                        title="Backend requires semester record before subjects can be added"
                      >
                        <Plus className="w-4 h-4" /> Initialize Semester Record
                      </button>
                    ) : (
                      <button
                        onClick={() => handleAddSubject(sem)}
                        className="flex items-center gap-2 border border-blue-600 text-blue-600 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-blue-50 transition-colors"
                      >
                        <Plus className="w-4 h-4" /> Add Subject
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ========================================== */}
      {/* CUSTOM MODAL OVERLAY */}
      {/* ========================================== */}
      {modal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden transform transition-all">
            <div className="p-6">
              
              <div className="flex items-center gap-3 mb-2">
                {modal.isError && <AlertCircle className="w-6 h-6 text-red-500" />}
                <h2 className={`text-xl font-bold ${modal.isError ? "text-red-600" : "text-gray-900"}`}>
                  {modal.title}
                </h2>
              </div>
              
              {modal.message && <p className="text-sm text-gray-600 mb-4">{modal.message}</p>}

              {/* Single Input Field (Section, Incharge) */}
              {modal.type === "input" && (
                <input
                  type="text"
                  value={modalInput1}
                  onChange={(e) => setModalInput1(e.target.value)}
                  placeholder={modal.placeholder}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  autoFocus
                />
              )}

              {/* Double Input Field (Add Subject) */}
              {modal.type === "addSubject" && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Subject Code</label>
                    <input
                      type="text"
                      value={modalInput1}
                      onChange={(e) => setModalInput1(e.target.value)}
                      placeholder="e.g., IT-104A"
                      className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
                      autoFocus
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Subject Name</label>
                    <input
                      type="text"
                      value={modalInput2}
                      onChange={(e) => setModalInput2(e.target.value)}
                      placeholder="e.g., Data Structures"
                      className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="bg-gray-50 px-6 py-4 flex justify-end gap-3 border-t border-gray-100">
              
              {/* Hide Cancel button if it's just an alert */}
              {modal.type !== "alert" && (
                <button
                  onClick={closeModal}
                  className="px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  Cancel
                </button>
              )}
              
              <button
                onClick={() => {
                  if (modal.type === "input") modal.onConfirm(modalInput1);
                  else if (modal.type === "addSubject") modal.onConfirm({ subjectCode: modalInput1, subjectName: modalInput2 });
                  else if (modal.type === "confirm" || modal.type === "alert") modal.onConfirm();
                  closeModal();
                }}
                className={`px-4 py-2 text-sm font-semibold text-white rounded-lg transition-colors ${
                  modal.type === "confirm" || modal.isError
                    ? "bg-red-600 hover:bg-red-700" 
                    : "bg-purple-600 hover:bg-purple-700"
                }`}
              >
                {modal.type === "confirm" ? "Confirm Delete" : modal.type === "alert" ? "Okay" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}