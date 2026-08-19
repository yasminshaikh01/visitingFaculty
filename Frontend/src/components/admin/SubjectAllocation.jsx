import React, { useEffect, useMemo, useState, useRef } from "react";
import {
  ClipboardCheck,
  ListChecks,
  Save,
  Trash2,
  Check,
  AlertTriangle,
  X,
} from "lucide-react";
import LoadingSpinner from "./LoadingSpinner";
import api from "../../api/axiosInstance"; // Adjust the ../ as needed based on folder depth

const PAGE_SIZE = 6;
const TYPES = ["Theory", "Practical"];
const RATES = ["200", "400", "800"];

const emptyForm = {
  user_id: "",
  course_id: "",
  section_id: "",
  semester_id: "",
  subject_id: "",
  session_type: "",
  rate_per_hour: "",
  academic_year: "2026-27",
};

export default function SubjectAllocation({ prefilledFaculty }) {
  // --- STATE: Data from APIs ---
  const [facultyOptions, setFacultyOptions] = useState([]);
  const [courses, setCourses] = useState([]);
  const [sections, setSections] = useState([]);
  const [semesters, setSemesters] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [allocations, setAllocations] = useState([]);

  // --- STATE: UI & Form ---
  const [loadingAllocations, setLoadingAllocations] = useState(true);
  const [facultySearch, setFacultySearch] = useState("");
  const [showFacultyDropdown, setShowFacultyDropdown] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  // --- STATE: Custom Modals ---
  const [successModal, setSuccessModal] = useState(false);
  const [errorModal, setErrorModal] = useState("");
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const dropdownRef = useRef(null);

  // ==========================================
  // 1. DATA FETCHING & AUTO-FILL
  // ==========================================
  useEffect(() => {
    fetchCourses();
    fetchAllocations();

    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowFacultyDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Listen for the global refresh event to instantly update allocations
  useEffect(() => {
    const handleRefresh = () => fetchAllocations();
    window.addEventListener('refresh-dashboard', handleRefresh);
    return () => window.removeEventListener('refresh-dashboard', handleRefresh);
  }, []);

  // --- Auto-fill logic when clicking from Faculty Management ---
  useEffect(() => {
    if (prefilledFaculty) {
      const nestedData = prefilledFaculty.User || prefilledFaculty.user || {};

      const targetId =
        prefilledFaculty.user_id ||
        prefilledFaculty.id ||
        nestedData.user_id ||
        nestedData.id ||
        "";
      const targetName =
        prefilledFaculty.full_name ||
        prefilledFaculty.name ||
        nestedData.full_name ||
        nestedData.name ||
        "Unknown Name";
      const targetEmail =
        prefilledFaculty.email || nestedData.email || "No Email";

      setForm((prev) => ({ ...prev, user_id: targetId }));
      setFacultySearch(`${targetName} (${targetEmail})`);
    }
  }, [prefilledFaculty]);

  const fetchCourses = async () => {
    try {
      const res = await api.get("/admin/courses");
      setCourses(res.data.data || []);
    } catch (err) {
      console.error("Failed to load courses", err);
    }
  };

  const fetchAllocations = async () => {
    setLoadingAllocations(true);
    try {
      const res = await api.get("/admin/allocations");
      setAllocations(res.data.data || []);
    } catch (err) {
      console.error("Failed to load allocations", err);
    } finally {
      setLoadingAllocations(false);
    }
  };

  // ==========================================
  // 2. LIVE FACULTY SEARCH (DEBOUNCED)
  // ==========================================
  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (
        !facultySearch.trim() ||
        (prefilledFaculty && facultySearch.includes(prefilledFaculty.email))
      ) {
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
  }, [facultySearch, prefilledFaculty]);

  // ==========================================
  // 3. CASCADING DROPDOWNS LOGIC
  // ==========================================
  useEffect(() => {
    if (form.course_id) {
      api
        .get(`/admin/courses/${form.course_id}/sections`)
        .then((res) => setSections(res.data.data || []))
        .catch(() => setSections([]));

      api
        .get(`/admin/courses/${form.course_id}/semesters`)
        .then((res) => setSemesters(res.data.data || []))
        .catch(() => setSemesters([]));
    } else {
      setSections([]);
      setSemesters([]);
    }
    setForm((prev) => ({
      ...prev,
      section_id: "",
      semester_id: "",
      subject_id: "",
    }));
    setSubjects([]);
  }, [form.course_id]);

  useEffect(() => {
    if (form.course_id && form.semester_id) {
      api
        .get(`/admin/courses/${form.course_id}/semesters/${form.semester_id}/subjects`)
        .then((res) => setSubjects(res.data.data || []))
        .catch(() => setSubjects([]));
    } else {
      setSubjects([]);
    }
    setForm((prev) => ({ ...prev, subject_id: "" }));
  }, [form.semester_id, form.course_id]);

  // ==========================================
  // 4. FORM SUBMISSION & DELETION
  // ==========================================
  const handleChange = (field) => (e) => {
    setForm((f) => ({ ...f, [field]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError("");

    if (
      !form.user_id ||
      !form.course_id ||
      !form.semester_id ||
      !form.subject_id ||
      !form.session_type ||
      !form.rate_per_hour
    ) {
      setFormError("Please fill all required fields.");
      return;
    }

    // --- NEW: FRONTEND DUPLICATE ALLOCATION PREVENTION ---
    const isDuplicate = allocations.find((a) => {
      const matchCourse = String(a.course_id) === String(form.course_id);
      const matchSemester = String(a.semester_id) === String(form.semester_id);
      const matchSubject = String(a.subject_id) === String(form.subject_id);
      // Section can be empty/null, so we fallback to empty strings for comparison
      const matchSection = String(a.section_id || "") === String(form.section_id || "");
      const matchType = String(a.session_type).toLowerCase() === String(form.session_type).toLowerCase();
      
      return matchCourse && matchSemester && matchSubject && matchSection && matchType;
    });

    if (isDuplicate) {
      const assignedTo = isDuplicate.User?.full_name || "another faculty member";
      setErrorModal(
        `This ${form.session_type} subject is already allocated to ${assignedTo} for this specific section. Please remove the existing allocation first if you need to reassign it.`
      );
      return; // Stop execution here
    }
    // -----------------------------------------------------

    setSubmitting(true);
    try {
      const payload = { ...form, section_id: form.section_id || null };
      await api.post("/admin/allocations", payload);

      setSuccessModal(true); 
      setForm(emptyForm);
      setFacultySearch("");
      fetchAllocations();
      
      // Tell the rest of the app to refresh globally
      window.dispatchEvent(new Event('refresh-dashboard'));
    } catch (err) {
      setFormError(err?.response?.data?.message || "Failed to assign subject.");
    } finally {
      setSubmitting(false);
    }
  };

  const confirmDelete = (id) => {
    setDeleteConfirmId(id);
  };

  const executeDelete = async () => {
    if (!deleteConfirmId) return;
    setDeleting(true);
    try {
      await api.delete(`/admin/allocations/${deleteConfirmId}`);
      setDeleteConfirmId(null);
      fetchAllocations();
      
      // Tell the rest of the app to refresh globally
      window.dispatchEvent(new Event('refresh-dashboard'));
    } catch (err) {
      setDeleteConfirmId(null);
      setErrorModal("Failed to delete allocation. Please try again.");
    } finally {
      setDeleting(false);
    }
  };

  // ==========================================
  // 5. TABLE FILTERING
  // ==========================================
  const filteredAllocations = useMemo(() => {
    if (!search.trim()) return allocations;
    const q = search.toLowerCase();
    return allocations.filter(
      (a) =>
        a.User?.full_name?.toLowerCase().includes(q) ||
        a.Subject?.subject_name?.toLowerCase().includes(q) ||
        a.Subject?.subject_code?.toLowerCase().includes(q),
    );
  }, [allocations, search]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredAllocations.length / PAGE_SIZE),
  );
  const paginated = filteredAllocations.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE,
  );

  useEffect(() => setPage(1), [search]);

  return (
    <main className="p-4 sm:p-6 w-full relative max-w-full overflow-hidden">
      <div className="mb-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-800">
            Subject Allocation
          </h1>
          <p className="text-sm text-slate-400">
            Assign courses and subjects to faculty members
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[400px_1fr] gap-6 items-start w-full">
        
        {/* ASSIGNMENT FORM */}
        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-xl border border-slate-200 p-4 sm:p-6 shadow-sm w-full"
        >
          <div className="flex items-center gap-2 mb-6">
            <ClipboardCheck size={20} className="text-blue-600" />
            <h2 className="text-lg font-semibold text-slate-800">
              Assign New Subject
            </h2>
          </div>

          <div className="space-y-4">
            <div ref={dropdownRef}>
              <Field label="Select Faculty (Name or ID)">
                <div className="relative">
                  <input
                    type="text"
                    value={facultySearch}
                    onChange={(e) => {
                      setFacultySearch(e.target.value);
                      setShowFacultyDropdown(true);
                      setForm((prev) => ({ ...prev, user_id: "" }));
                    }}
                    onFocus={() => setShowFacultyDropdown(true)}
                    placeholder="Select..."
                    className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                  />
                  {showFacultyDropdown && facultyOptions.length > 0 && (
                    <ul className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                      {facultyOptions.map((f) => (
                        <li
                          key={f.user_id}
                          onClick={() => {
                            setForm((prev) => ({
                              ...prev,
                              user_id: f.user_id,
                            }));
                            setFacultySearch(`${f.full_name} (${f.email})`);
                            setShowFacultyDropdown(false);
                          }}
                          className="px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 cursor-pointer border-b border-slate-50 last:border-0"
                        >
                          {f.full_name} ({f.email})
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </Field>
            </div>

            <Field label="Program Name">
              <select
                value={form.course_id}
                onChange={handleChange("course_id")}
                className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm bg-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
              >
                <option value="">Select Program</option>
                {courses.map((c) => (
                  <option key={c.course_id} value={c.course_id}>
                    {c.course_name}
                  </option>
                ))}
              </select>
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Semester">
                <select
                  value={form.semester_id}
                  onChange={handleChange("semester_id")}
                  disabled={!form.course_id || semesters.length === 0}
                  className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm bg-white disabled:bg-slate-50 disabled:text-slate-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                >
                  <option value="">Select Sem</option>
                  {semesters.map((s) => (
                    <option key={s.semester_id} value={s.semester_id}>
                      Semester {s.semester_number}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Section">
                <select
                  value={form.section_id}
                  onChange={handleChange("section_id")}
                  disabled={!form.course_id || sections.length === 0}
                  className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm bg-white disabled:bg-slate-50 disabled:text-slate-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                >
                  <option value="">
                    {sections.length === 0 ? "N/A" : "Select Section"}
                  </option>
                  {sections.map((sec) => (
                    <option key={sec.section_id} value={sec.section_id}>
                      Section {sec.section_name}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <Field label="Academic Session">
              <select
                value={form.academic_year}
                onChange={handleChange("academic_year")}
                className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm bg-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
              >
                <option value="2026-27">2026-27</option>
              </select>
            </Field>

            <Field label="Subject Name">
              <select
                value={form.subject_id}
                onChange={handleChange("subject_id")}
                disabled={!form.semester_id || subjects.length === 0}
                className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm bg-white disabled:bg-slate-50 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
              >
                <option value="">Select Subject</option>
                {subjects.map((sub) => (
                  <option key={`name-${sub.subject_id}`} value={sub.subject_id}>
                    {sub.subject_name}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Subject Code">
              <select
                value={form.subject_id}
                onChange={handleChange("subject_id")}
                disabled={!form.semester_id || subjects.length === 0}
                className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm bg-white disabled:bg-slate-50 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
              >
                <option value="">Select Code</option>
                {subjects.map((sub) => (
                  <option key={`code-${sub.subject_id}`} value={sub.subject_id}>
                    {sub.subject_code}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Type">
              <select
                value={form.session_type}
                onChange={handleChange("session_type")}
                className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm bg-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
              >
                <option value="">Select...</option>
                {TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Per Hour Rate (₹)">
              <select
                value={form.rate_per_hour}
                onChange={handleChange("rate_per_hour")}
                className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm bg-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
              >
                <option value="">Select Rate...</option>
                {RATES.map((r) => (
                  <option key={r} value={r}>
                    ₹ {r}
                  </option>
                ))}
              </select>
            </Field>

            {formError && (
              <p className="text-sm text-red-500 bg-red-50 p-2 rounded">
                {formError}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full mt-2 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#0b57d0] text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-60 transition-colors shadow-sm"
            >
              <Save size={16} />
              {submitting ? "Assigning..." : "Assign Subject"}
            </button>
          </div>
        </form>

        {/* ALLOCATIONS HISTORY TABLE */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col h-full w-full overflow-hidden">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between px-4 sm:px-6 py-4 border-b border-slate-100 gap-3">
            <div className="flex items-center gap-2">
              <ListChecks size={18} className="text-blue-600 shrink-0" />
              <h2 className="font-semibold text-slate-800">
                Current Allocations ({filteredAllocations.length})
              </h2>
            </div>
            <input
              type="text"
              placeholder="Search allocations..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full sm:w-48 px-3 py-1.5 text-sm border border-slate-200 rounded-md focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
            />
          </div>

          <div className="overflow-x-auto flex-1 hide-scrollbar w-full">
            <table className="w-full text-sm min-w-[700px]">
              <thead>
                <tr className="text-left text-xs font-medium text-slate-400 border-b border-slate-100 bg-slate-50/50">
                  <th className="px-5 py-3 whitespace-nowrap">Faculty</th>
                  <th className="px-5 py-3 whitespace-nowrap">Course Details</th>
                  <th className="px-5 py-3 whitespace-nowrap">Subject</th>
                  <th className="px-5 py-3 whitespace-nowrap">Details</th>
                  <th className="px-5 py-3 text-right whitespace-nowrap">Action</th>
                </tr>
              </thead>
              <tbody>
                {loadingAllocations && (
                  <tr>
                    <td colSpan={5} className="py-10">
                      <LoadingSpinner label="Loading allocations..." />
                    </td>
                  </tr>
                )}

                {!loadingAllocations && paginated.length === 0 && (
                  <tr>
                    <td
                      colSpan={5}
                      className="py-12 text-center text-slate-400 text-sm"
                    >
                      No subject allocations match your search.
                    </td>
                  </tr>
                )}

                {!loadingAllocations &&
                  paginated.map((a) => (
                    <tr
                      key={a.allocation_id}
                      className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors last:border-0"
                    >
                      <td className="px-5 py-3 whitespace-nowrap">
                        <p className="font-medium text-slate-800">
                          {a.User?.full_name}
                        </p>
                        <p className="text-xs text-slate-400">
                          {a.User?.email}
                        </p>
                      </td>
                      <td className="px-5 py-3 whitespace-nowrap">
                        <p className="font-medium text-slate-700">
                          {a.Course?.course_name}
                        </p>
                        <p className="text-xs text-slate-400">
                          Sem {a.Semester?.semester_number}{" "}
                          {a.Section ? `• Sec ${a.Section.section_name}` : ""}
                        </p>
                      </td>
                      <td className="px-5 py-3 whitespace-nowrap">
                        <p className="text-xs text-slate-400">
                          {a.Subject?.subject_code}
                        </p>
                        <p className="font-medium text-slate-700">
                          {a.Subject?.subject_name}
                        </p>
                      </td>
                      <td className="px-5 py-3 whitespace-nowrap">
                        <div className="flex flex-col items-start gap-1">
                          <span
                            className={`px-2 py-0.5 rounded text-[11px] font-semibold tracking-wide inline-block ${
                              a.session_type?.toLowerCase() === "practical"
                                ? "bg-purple-50 text-purple-600"
                                : "bg-blue-50 text-blue-600"
                            }`}
                          >
                            {a.session_type?.toUpperCase()}
                          </span>
                          <span className="text-xs text-slate-500 font-medium">
                            ₹{a.rate_per_hour}/hr
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-right whitespace-nowrap">
                        <button
                          onClick={() => confirmDelete(a.allocation_id)}
                          className="p-1.5 text-red-400 hover:bg-red-50 hover:text-red-600 rounded-md transition-colors"
                          title="Revoke Allocation"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-4 sm:px-6 py-4 border-t border-slate-100 bg-white">
            <span className="text-slate-500 text-sm text-center sm:text-left">
              Showing {paginated.length} of {filteredAllocations.length} records
            </span>
            <div className="flex flex-wrap items-center justify-center gap-1">
              <button
                disabled={page === 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="h-8 w-8 flex items-center justify-center rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50 transition-colors shrink-0 text-slate-600"
              >
                ‹
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`h-8 w-8 flex items-center justify-center rounded-lg text-sm font-medium transition-colors shrink-0 ${
                    p === page
                      ? "bg-[#0b57d0] text-white"
                      : "border border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {p}
                </button>
              ))}
              <button
                disabled={page === totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="h-8 w-8 flex items-center justify-center rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50 transition-colors shrink-0 text-slate-600"
              >
                ›
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* --- CUSTOM MODALS --- */}

      {/* Success Modal */}
      {successModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden scale-100 animate-in zoom-in-95 duration-200">
            <div className="p-6 text-center">
              <div className="h-14 w-14 rounded-full bg-green-100 text-green-600 flex items-center justify-center mx-auto mb-4">
                <Check size={28} strokeWidth={2.5} />
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-2">
                Subject Allocated!
              </h3>
              <p className="text-slate-500 text-sm">
                The faculty member has been successfully assigned to this
                subject.
              </p>
            </div>
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-center">
              <button
                onClick={() => setSuccessModal(false)}
                className="w-full px-6 py-2.5 bg-[#0b57d0] text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden scale-100 animate-in zoom-in-95 duration-200">
            <div className="p-6 text-center">
              <div className="h-14 w-14 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-4">
                <AlertTriangle size={28} strokeWidth={2.5} />
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-2">
                Remove Allocation?
              </h3>
              <p className="text-slate-500 text-sm">
                Are you sure you want to revoke this subject assignment? This
                action cannot be undone.
              </p>
            </div>
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
              <button
                onClick={() => setDeleteConfirmId(null)}
                disabled={deleting}
                className="w-full sm:w-auto px-5 py-2.5 bg-white border border-slate-200 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={executeDelete}
                disabled={deleting}
                className="w-full sm:w-auto px-5 py-2.5 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {deleting ? "Removing..." : "Remove"}
              </button>
            </div>
          </div>
        </div>
      )}

{/* Error Modal */}
      {errorModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden scale-100 animate-in zoom-in-95 duration-200">
            <div className="p-6 sm:p-8 text-center">
              <div className="h-16 w-16 rounded-full bg-red-50 text-red-500 flex items-center justify-center mx-auto mb-5 ring-4 ring-red-50/50">
                <AlertTriangle size={32} strokeWidth={2} />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-3">
                Action Failed
              </h3>
              <p className="text-slate-500 text-sm leading-relaxed">
                {errorModal}
              </p>
            </div>
            <div className="p-4 sm:p-6 bg-slate-50 border-t border-slate-100 flex justify-center">
              <button
                onClick={() => setErrorModal("")}
                className="w-full sm:w-auto min-w-[140px] px-6 py-3 bg-slate-900 text-white text-sm font-semibold rounded-xl hover:bg-slate-800 transition-all shadow-md hover:shadow-lg focus:ring-2 focus:ring-slate-400 focus:ring-offset-2"
              >
                Understood
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function Field({ label, children }) {
  return (
    <div className="w-full">
      <label className="block text-sm font-medium text-slate-700 mb-1">
        {label}
      </label>
      {children}
    </div>
  );
}