import React, { useState, useEffect } from "react";
import { Send, Loader2, CheckCircle2, ChevronUp, ChevronDown, AlertCircle, AlertTriangle } from "lucide-react";
import api from "../../api/axiosInstance"; // Adjust the ../ as needed based on folder depth

export default function MarkAttendanceList() {
  const [allocations, setAllocations] = useState([]);
  const [monthlyRecords, setMonthlyRecords] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // --- CUSTOM MODAL STATE ---
  const [modalConfig, setModalConfig] = useState({
    isOpen: false,
    type: "success", 
    title: "",
    message: ""
  });

  const showModal = (type, title, message) => {
    setModalConfig({ isOpen: true, type, title, message });
  };

  // New Cap Warning State
  const [capWarning, setCapWarning] = useState({
    isOpen: false,
    payload: null,
    details: null
  });

  // --- PREVIOUS MONTH OPEN LOGIC ---
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth(); // 0-indexed
  const currentDateNum = now.getDate();

  let minYear = currentYear;
  let minMonth = currentMonth - 1;

  if (minMonth < 0) {
    minMonth = 11;
    minYear -= 1;
  }

  const minDate = `${minYear}-${String(minMonth + 1).padStart(2, '0')}-01`;
  const todayStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(currentDateNum).padStart(2, '0')}`;
  const maxDate = todayStr; // Cannot select future dates!

  // Form State
  const [date, setDate] = useState(todayStr); // YYYY-MM-DD
  const [selectedAllocationId, setSelectedAllocationId] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [remarks, setRemarks] = useState("");
  const [userId, setUserId] = useState(null);
  
  // NEW STATE: Toggle for 30-minute intervals
  const [isHalfHourStep, setIsHalfHourStep] = useState(false);

  // 1. Fetch User & Allocations on Mount
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const session = JSON.parse(sessionStorage.getItem('iipsCurrentSession') || '{}');
        const targetId = session.userId;
        
        if (!targetId) return;
        setUserId(targetId);

        const allocationsRes = await api.get(`/attendance/my-allocations/${targetId}`);

        if (allocationsRes.data.success) {
          setAllocations(allocationsRes.data.allocations || []);
        }
      } catch (error) {
        console.error("Error fetching allocations:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchInitialData();
  }, []);

  // 2. Fetch Monthly Records dynamically based on the Selected Date
  useEffect(() => {
    const fetchMonthlyData = async () => {
      if (!userId || !date) return;
      
      try {
        const session = JSON.parse(sessionStorage.getItem('iipsCurrentSession') || '{}');
        const headers = { 'Authorization': `Bearer ${session.token}` };
        
        const d = new Date(date);
        const monthName = d.toLocaleString('default', { month: 'long' });
        const yearStr = d.getFullYear();

        const monthlyRes = await api.get(`/attendance/monthly/${userId}?month=${monthName}&year=${yearStr}`);
        if (monthlyRes.data.success) {
          setMonthlyRecords(monthlyRes.data.data || []);
        }
      } catch (error) {
        console.error("Error fetching monthly records:", error);
        setMonthlyRecords([]); 
      }
    };
    
    fetchMonthlyData();
  }, [date, userId]);

  // --- CUSTOM TIME HANDLER (Now supports 30 or 60 minute steps) ---
  const handleTimeChange = (type, direction) => {
    const currentTime = type === 'start' ? startTime : endTime;
    const [h, m] = currentTime.split(':').map(Number);
    
    let totalMinutes = h * 60 + m;
    const step = isHalfHourStep ? 30 : 60; // DYNAMIC STEP
    
    if (direction === 'up') {
      totalMinutes += step;
      if (totalMinutes >= 24 * 60) totalMinutes = 0;
    } else if (direction === 'down') {
      totalMinutes -= step;
      if (totalMinutes < 0) totalMinutes = (24 * 60) - step;
    }
    
    const newHour = Math.floor(totalMinutes / 60);
    const newMin = totalMinutes % 60;
    const newTime = `${String(newHour).padStart(2, '0')}:${String(newMin).padStart(2, '0')}`;
    
    if (type === 'start') setStartTime(newTime);
    if (type === 'end') setEndTime(newTime);
  };

  const calculateHours = () => {
    if (!startTime || !endTime) return 0;
    const [sHours, sMinutes] = startTime.split(':').map(Number);
    const [eHours, eMinutes] = endTime.split(':').map(Number);
    
    const start = new Date(0, 0, 0, sHours, sMinutes, 0);
    const end = new Date(0, 0, 0, eHours, eMinutes, 0);
    
    let diff = (end.getTime() - start.getTime()) / 1000 / 60 / 60;
    
    // Return exact decimal, do NOT round it.
    return diff > 0 ? diff : 0; 
  };

  const hours = calculateHours();

  const activeAlloc = allocations.find(a => a.allocation_id.toString() === selectedAllocationId);

  const processSubmission = async (payload) => {
    setIsSubmitting(true);
    setCapWarning({ isOpen: false, payload: null, details: null });
    try {
      const session = JSON.parse(sessionStorage.getItem('iipsCurrentSession') || '{}');
      const response = await api.post("/attendance/", payload);

      if (response.data.success) {
        showModal("success", "Record Saved", `Attendance successfully submitted for ${payload.attendance_date}.`);
        setRemarks(""); 
        setMonthlyRecords(prev => [...prev, response.data.data]);
      }
    } catch (error) {
      console.error("Error submitting attendance:", error);
      showModal("error", "Submission Failed", error.response?.data?.message || "Failed to submit attendance. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async () => {
    if (!selectedAllocationId || hours <= 0 || !date) {
      return showModal("error", "Missing Information", "Please ensure all fields are filled correctly and End Time is after Start Time.");
    }

    // NEW STRICT VALIDATION: Block non-whole hour submissions
    if (!Number.isInteger(hours)) {
      return showModal(
        "error", 
        "Invalid Time Gap", 
        `Total hours must be a whole number. Your selected duration is ${hours} hours. Please adjust Start and End times to create a full hour gap (e.g., 09:30 to 10:30).`
      );
    }

    const selectedDateObj = new Date(date);
    selectedDateObj.setHours(0, 0, 0, 0);
    const todayObj = new Date(now);
    todayObj.setHours(0, 0, 0, 0);

    if (selectedDateObj > todayObj) {
      return showModal("error", "Invalid Date", "You cannot mark attendance for future dates.");
    }

    const isCurrentMonthRec = selectedDateObj.getMonth() === now.getMonth() && selectedDateObj.getFullYear() === now.getFullYear();
    const isPreviousMonthRec = 
      (selectedDateObj.getFullYear() === now.getFullYear() && selectedDateObj.getMonth() === now.getMonth() - 1) ||
      (selectedDateObj.getFullYear() === now.getFullYear() - 1 && selectedDateObj.getMonth() === 11 && now.getMonth() === 0);

    if (!isCurrentMonthRec && !isPreviousMonthRec) {
        return showModal("error", "Action Not Allowed", "You can only mark attendance for the current and previous month.");
    }

    const MAX_MONTHLY_PAY = 30000; 
    const rate = parseFloat(activeAlloc.rate_per_hour) || 0;
    const potentialEarnings = parseFloat(hours) * rate;

    const currentMonthlyEarnings = monthlyRecords.reduce((sum, record) => {
      // Ignore sessions that have already been capped by the backend
      if (record.is_billable === false || record.is_billable === 0) {
        return sum;
      }
      return sum + (parseFloat(record.hours || 0) * parseFloat(record.rate_per_hour || 0));
    }, 0);

    const d = new Date(date);
    const monthName = d.toLocaleString('default', { month: 'long' });
    const yearStr = d.getFullYear();

    const payload = {
      user_id: userId,
      course_id: activeAlloc.course_id,
      semester_id: activeAlloc.semester_id,
      subject_id: activeAlloc.subject_id,
      attendance_date: date,
      start_time: `${startTime}:00`,
      end_time: `${endTime}:00`,
      hours: parseFloat(hours),
      month: monthName,
      year: yearStr,
      status: "Pending",
      remarks: remarks
    };

    if (currentMonthlyEarnings + potentialEarnings > MAX_MONTHLY_PAY) {
      setCapWarning({
        isOpen: true,
        payload: payload,
        details: { potentialEarnings, currentMonthlyEarnings }
      });
      return;
    }

    processSubmission(payload);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-500">
        <Loader2 className="animate-spin h-8 w-8 text-[#004DD2] mb-3" />
        <p>Loading attendance form...</p>
      </div>
    );
  }

  return (
    <div className="px-4 py-6 sm:px-8 relative">
      <div className="mx-auto max-w-2xl rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-8">
        <p className="mt-1 text-sm text-slate-500">
          Please fill in all required fields for the academic record.
        </p>

        <div className="mt-6 space-y-5">
          {/* Date Picker Restricted by New Rules */}
          <div className="w-full">
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Date</label>
            <input
              type="date"
              value={date}
              min={minDate}
              max={maxDate}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-700 focus:border-[#004DD2] focus:outline-none focus:ring-1 focus:ring-[#004DD2]"
            />
          </div>

          {/* Allocation Selection */}
          <div className="w-full">
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Subject & Class</label>
            <select 
              value={selectedAllocationId}
              onChange={(e) => setSelectedAllocationId(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-700 focus:border-[#004DD2] focus:outline-none focus:ring-1 focus:ring-[#004DD2]"
            >
              <option value="">-- Select Allocated Subject --</option>
              {allocations.map(alloc => {
                const secName = alloc.section_name || alloc.Section?.section_name;
                return (
                  <option key={alloc.allocation_id} value={alloc.allocation_id}>
                    {alloc.subject_code} - {alloc.subject_name} ({alloc.course_name}, Sem {alloc.semester_number}{secName ? `, Sec ${secName}` : ""})
                  </option>
                );
              })}
            </select>
          </div>

          {/* CUSTOM Time Pickers (Dynamic Interval) */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Start Time</label>
              <div className="flex items-center w-full rounded-lg border border-slate-300 overflow-hidden bg-white focus-within:border-[#004DD2] focus-within:ring-1 focus-within:ring-[#004DD2]">
                <input
                  type="text"
                  readOnly
                  value={startTime}
                  className="w-full px-3.5 py-2.5 text-sm text-slate-700 bg-transparent outline-none cursor-default select-none tracking-wider font-medium"
                />
                <div className="flex flex-col border-l border-slate-200 bg-slate-50">
                  <button 
                    type="button" 
                    onClick={() => handleTimeChange('start', 'up')}
                    className="p-1 hover:bg-slate-200 text-slate-600 transition-colors"
                  >
                    <ChevronUp className="h-3.5 w-3.5" />
                  </button>
                  <button 
                    type="button" 
                    onClick={() => handleTimeChange('start', 'down')}
                    className="p-1 hover:bg-slate-200 text-slate-600 transition-colors border-t border-slate-200"
                  >
                    <ChevronDown className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
            
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">End Time</label>
              <div className="flex items-center w-full rounded-lg border border-slate-300 overflow-hidden bg-white focus-within:border-[#004DD2] focus-within:ring-1 focus-within:ring-[#004DD2]">
                <input
                  type="text"
                  readOnly
                  value={endTime}
                  className="w-full px-3.5 py-2.5 text-sm text-slate-700 bg-transparent outline-none cursor-default select-none tracking-wider font-medium"
                />
                <div className="flex flex-col border-l border-slate-200 bg-slate-50">
                  <button 
                    type="button" 
                    onClick={() => handleTimeChange('end', 'up')}
                    className="p-1 hover:bg-slate-200 text-slate-600 transition-colors"
                  >
                    <ChevronUp className="h-3.5 w-3.5" />
                  </button>
                  <button 
                    type="button" 
                    onClick={() => handleTimeChange('end', 'down')}
                    className="p-1 hover:bg-slate-200 text-slate-600 transition-colors border-t border-slate-200"
                  >
                    <ChevronDown className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
            
            {/* NEW: 30-Minute Interval Checkbox */}
            <div className="sm:col-span-2 flex items-center gap-2 mt-1">
              <input
                type="checkbox"
                id="halfHourToggle"
                checked={isHalfHourStep}
                onChange={(e) => {
                  const isChecked = e.target.checked;
                  setIsHalfHourStep(isChecked);
                  
                  // If turning off the 30-min interval, force both times to snap back to :00
                  if (!isChecked) {
                    setStartTime(prev => `${prev.split(':')[0]}:00`);
                    setEndTime(prev => `${prev.split(':')[0]}:00`);
                  }
                }}
                className="h-4 w-4 rounded border-slate-300 text-[#004DD2] focus:ring-[#004DD2]"
              />
              <label htmlFor="halfHourToggle" className="text-sm font-medium text-slate-600 cursor-pointer select-none">
                Enable 30-minute intervals (Total hours must still be whole numbers)
              </label>
            </div>
          </div>

          {/* Auto-Calculated Hours (Now forces whole numbers) */}
          <div className="flex items-center justify-between rounded-lg bg-blue-50 px-4 py-3 text-sm border border-blue-100">
            <span className="font-medium text-[#004DD2]">Total Hours (Auto Calculated)</span>
            <span className="font-bold text-[#004DD2]">{hours} hrs</span>
          </div>

          {/* Remarks */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Remarks (Optional)</label>
            <textarea
              rows={3}
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="e.g. Extra class, Guest lecture, Test conducted..."
              className="w-full resize-none rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-700 placeholder:text-slate-400 focus:border-[#004DD2] focus:outline-none focus:ring-1 focus:ring-[#004DD2]"
            />
          </div>

          {/* Submit Button */}
          <button 
            onClick={handleSubmit}
            disabled={isSubmitting || !selectedAllocationId}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#004DD2] py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {isSubmitting ? "Submitting..." : "Submit Attendance"}
          </button>
        </div>
      </div>

      {/* --- CUSTOM CAP EXCEEDED CONFIRMATION MODAL --- */}
      {capWarning.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md scale-100 overflow-hidden rounded-2xl bg-white shadow-xl animate-in zoom-in-95 duration-200 text-center">
            <div className="p-6">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-orange-100 text-orange-600">
                <AlertTriangle size={28} strokeWidth={2.5} />
              </div>
              <h3 className="mb-2 text-xl font-bold text-slate-800">Payment Limit Exceeded</h3>
              <p className="text-sm text-slate-500 leading-relaxed">
                Adding this session (₹{capWarning.details?.potentialEarnings?.toLocaleString('en-IN')}) exceeds the maximum monthly limit of ₹30,000. Current earnings: ₹{capWarning.details?.currentMonthlyEarnings?.toLocaleString('en-IN')}.
              </p>
              <div className="mt-4 p-3 bg-orange-50 border border-orange-100 rounded-lg text-xs text-orange-800 font-medium">
                You can still submit this record for academic tracking, but the excess hours will be marked as non-billable and will not be paid.
              </div>
              <p className="text-sm font-semibold text-slate-700 mt-4">Do you want to proceed?</p>
            </div>
            
            <div className="flex justify-end gap-3 border-t border-slate-100 bg-slate-50 p-4">
              <button
                onClick={() => setCapWarning({ isOpen: false, payload: null, details: null })}
                disabled={isSubmitting}
                className="rounded-lg border border-slate-200 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={() => processSubmission(capWarning.payload)}
                disabled={isSubmitting}
                className="flex items-center gap-2 rounded-lg bg-orange-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-orange-700 disabled:opacity-50"
              >
                {isSubmitting ? <><Loader2 className="h-4 w-4 animate-spin" /> Submitting...</> : "Yes, Submit as Unpaid"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- CUSTOM MODAL FOR ALERTS (Success/Error) --- */}
      {modalConfig.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-sm scale-100 overflow-hidden rounded-2xl bg-white shadow-xl animate-in zoom-in-95 duration-200 text-center">
            <div className="p-6 text-center">
              <div className={`mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full ${
                modalConfig.type === 'success' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
              }`}>
                {modalConfig.type === 'success' ? (
                  <CheckCircle2 size={28} strokeWidth={2.5} />
                ) : (
                  <AlertCircle size={28} strokeWidth={2.5} />
                )}
              </div>
              <h3 className="mb-2 text-xl font-bold text-slate-800">{modalConfig.title}</h3>
              <p className="text-sm text-slate-500 leading-relaxed px-2 whitespace-pre-line">
                {modalConfig.message}
              </p>
            </div>
            
            <div className="border-t border-slate-100 bg-slate-50 p-4">
              <button
                onClick={() => setModalConfig({ ...modalConfig, isOpen: false })}
                className={`w-full rounded-lg px-5 py-2.5 text-sm font-medium text-white transition-colors ${
                  modalConfig.type === 'success' 
                    ? 'bg-green-600 hover:bg-green-700' 
                    : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                Okay
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}