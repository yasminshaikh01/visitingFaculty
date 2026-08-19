import React, { useState, useEffect, useMemo } from "react";
import { ChevronLeft, ChevronRight, Info, CheckCircle2, Plus, Loader2, AlertCircle, Trash2, AlertTriangle, ChevronUp, ChevronDown } from "lucide-react";
import api from "../../api/axiosInstance"; // Adjust the ../ as needed based on folder depth

const daysOfWeek = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

export default function MarkAttendanceGrid() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState(new Date().getDate());
  
  // Data States
  const [monthlyRecords, setMonthlyRecords] = useState([]);
  const [allocations, setAllocations] = useState([]);
  const [userId, setUserId] = useState(null);
  
  // Form States
  const [selectedAllocationId, setSelectedAllocationId] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [remarks, setRemarks] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // NEW STATE: Toggle for 30-minute intervals
  const [isHalfHourStep, setIsHalfHourStep] = useState(false);

  // Custom Modal States
  const [modalConfig, setModalConfig] = useState({
    isOpen: false,
    type: "success", 
    title: "",
    message: ""
  });

  const [deleteConfig, setDeleteConfig] = useState({
    isOpen: false,
    type: "", // 'day' or 'month'
    dateString: "",
    label: ""
  });

  // New Cap Warning State
  const [capWarning, setCapWarning] = useState({
    isOpen: false,
    payload: null,
    details: null
  });

  const year = currentDate.getFullYear();
  const monthName = currentDate.toLocaleString('default', { month: 'long' });
  const monthIndex = currentDate.getMonth();

  const actualCurrentDate = new Date();
  const actualYear = actualCurrentDate.getFullYear();
  const actualMonth = actualCurrentDate.getMonth();
  const actualDay = actualCurrentDate.getDate();

  const isCurrentMonth = year === actualYear && monthIndex === actualMonth;
  const isPreviousMonth = (year === actualYear && monthIndex === actualMonth - 1) || 
                          (year === actualYear - 1 && monthIndex === 11 && actualMonth === 0);
  
  const canEditMonth = isCurrentMonth || isPreviousMonth;

  const isDayAllowed = (day) => {
    if (!day) return false;
    if (isCurrentMonth) return day <= actualDay; 
    if (isPreviousMonth) return true; 
    return false; 
  };

  const showModal = (type, title, message) => {
    setModalConfig({ isOpen: true, type, title, message });
  };

  useEffect(() => {
    const session = JSON.parse(sessionStorage.getItem('iipsCurrentSession') || '{}');
    if (session.userId) setUserId(session.userId);
    
    if (session.userId) {
      api.get(`/attendance/my-allocations/${session.userId}`).then(res => {
        if (res.data.success) setAllocations(res.data.allocations || []);
      }).catch(err => console.error("Error fetching allocations:", err));
    }
  }, []);

  const fetchMonthlyRecords = async () => {
    if (!userId) return;
    try {
      const res = await api.get(`/attendance/monthly/${userId}?month=${monthName}&year=${year}`);
      if (res.data.success) setMonthlyRecords(res.data.data || []);
    } catch (err) {
      console.error("Error fetching monthly attendance:", err);
    }
  };

  useEffect(() => {
    fetchMonthlyRecords();
  }, [userId, monthName, year]);

  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const firstDayOfMonth = new Date(year, monthIndex, 1).getDay();

  const cells = [];
  for (let i = 0; i < firstDayOfMonth; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const eventsByDay = useMemo(() => {
    const grouped = {};
    monthlyRecords.forEach(record => {
      const d = new Date(record.attendance_date).getDate();
      if (!grouped[d]) grouped[d] = [];
      grouped[d].push({
        id: record.attendance_id,
        code: record.subject_code,
        time: `${record.start_time.substring(0,5)} - ${record.end_time.substring(0,5)}`,
        status: record.status
      });
    });
    return grouped;
  }, [monthlyRecords]);

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, monthIndex - 1, 1));
    setSelectedDay(1);
  };
  
  const handleNextMonth = () => {
    setCurrentDate(new Date(year, monthIndex + 1, 1));
    setSelectedDay(1);
  };

  // --- CUSTOM TIME HANDLER (Supports 30 or 60 minute steps) ---
  const handleTimeChange = (type, direction) => {
    if (!isDayAllowed(selectedDay)) return;

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

  // --- CALCULATE EXACT DECIMALS ---
  const calculateHours = () => {
    if (!startTime || !endTime) return 0;
    const [sHours, sMinutes] = startTime.split(':').map(Number);
    const [eHours, eMinutes] = endTime.split(':').map(Number);
    
    const start = new Date(0, 0, 0, sHours, sMinutes, 0);
    const end = new Date(0, 0, 0, eHours, eMinutes, 0);
    
    let diff = (end.getTime() - start.getTime()) / 1000 / 60 / 60;
    return diff > 0 ? diff : 0; 
  };

  const hours = calculateHours();

  const processSubmission = async (payload) => {
    setIsSubmitting(true);
    setCapWarning({ isOpen: false, payload: null, details: null });
    try {
      const res = await api.post("/attendance/", payload);

      if (res.data.success) {
        showModal("success", "Record Saved", `Attendance successfully submitted for ${payload.attendance_date}.`);
        setMonthlyRecords(prev => [...prev, res.data.data]);
        setRemarks("");
      }
    } catch (error) {
      console.error(error);
      showModal("error", "Submission Failed", error.response?.data?.message || "Failed to submit attendance. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async () => {
    if (!canEditMonth) return showModal("error", "Action Not Allowed", "This month is locked. You can only mark attendance for the current and previous month.");
    if (!isDayAllowed(selectedDay)) return showModal("error", "Invalid Date", "You cannot mark attendance for future or locked dates.");
    if (!selectedAllocationId) return showModal("error", "Missing Information", "Please select a subject before submitting.");
    
    if (hours <= 0) return showModal("error", "Invalid Time", "End time must be after the start time.");

    // STRICT VALIDATION: Block non-whole hour submissions
    if (!Number.isInteger(hours)) {
      return showModal(
        "error", 
        "Invalid Time Gap", 
        `Total hours must be a whole number. Your selected duration is ${hours} hours. Please adjust Start and End times to create a full hour gap (e.g., 09:30 to 10:30).`
      );
    }

    const MAX_MONTHLY_PAY = 30000; 
    const activeAlloc = allocations.find(a => a.allocation_id.toString() === selectedAllocationId);
    const rate = parseFloat(activeAlloc.rate_per_hour) || 0;
    const potentialEarnings = hours * rate;

    const currentMonthlyEarnings = monthlyRecords.reduce((sum, record) => {
      if (record.is_billable === false || record.is_billable === 0) {
        return sum;
      }
      return sum + (parseFloat(record.hours || 0) * parseFloat(record.rate_per_hour || 0));
    }, 0);

    const submitDate = new Date(year, monthIndex, selectedDay);
    const dateString = submitDate.getFullYear() + "-" + 
      String(submitDate.getMonth() + 1).padStart(2, '0') + "-" + 
      String(submitDate.getDate()).padStart(2, '0');

    const payload = {
      user_id: userId,
      course_id: activeAlloc.course_id,
      semester_id: activeAlloc.semester_id,
      subject_id: activeAlloc.subject_id,
      attendance_date: dateString,
      start_time: `${startTime}:00`,
      end_time: `${endTime}:00`,
      hours: hours.toFixed(2),
      month: monthName,
      year: year,
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

  const openDayDelete = () => {
    const dStr = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(selectedDay).padStart(2, '0')}`;
    setDeleteConfig({ isOpen: true, type: 'day', dateString: dStr, label: `${selectedDay} ${monthName}` });
  };

  const executeBulkDelete = async () => {
    setIsSubmitting(true);
    try {
      let url = `/attendance/faculty/${userId}`;
      
      if (deleteConfig.type === 'day') {
        url += `?attendance_date=${deleteConfig.dateString}`;
      } else if (deleteConfig.type === 'month') {
        url += `?month=${monthName}&year=${year}`;
      }

      const res = await api.delete(url);

      if (res.data.success) {
        showModal("success", "Records Cleared", res.data.message || "Attendance records successfully deleted.");
        fetchMonthlyRecords(); 
      }
    } catch (error) {
      console.error("Bulk Delete Error:", error);
      
      if (error.response?.status === 404) {
        showModal("error", "No Records Found", error.response?.data?.message || "Could not find any pending records to delete for this selection.");
      } else {
        showModal("error", "Deletion Failed", error.response?.data?.message || "Failed to delete records. Some records may already be verified.");
      }
    } finally {
      setIsSubmitting(false);
      setDeleteConfig({ isOpen: false, type: '', dateString: '', label: '' });
    }
  };

  const hasRecordsToClear = eventsByDay[selectedDay] && eventsByDay[selectedDay].length > 0;

  return (
    <div className="relative">
      <div className="flex flex-col gap-6 px-4 py-6 sm:px-8 xl:flex-row">
        {/* Calendar View */}
        <div className="flex-1 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-slate-900">{monthName} {year}</h2>
              <button onClick={handlePrevMonth} className="rounded-md p-1 text-slate-400 hover:bg-slate-100 transition-colors">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button onClick={handleNextMonth} className="rounded-md p-1 text-slate-400 hover:bg-slate-100 transition-colors">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
            
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-[#004DD2]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#004DD2]" />
                {monthlyRecords.length} Sessions Logged
              </span>
              {monthlyRecords.length > 0 && (
                <button
                  onClick={() => setDeleteConfig({ isOpen: true, type: 'month', dateString: '', label: `${monthName} ${year}` })}
                  className="flex items-center gap-1.5 rounded-full border border-red-200 bg-white px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors shadow-sm"
                  title="Clear entire month"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Clear Month
                </button>
              )}
            </div>
          </div>

          <div className="mt-4 grid grid-cols-7 overflow-hidden rounded-xl border border-slate-200 text-xs">
            {daysOfWeek.map((d) => (
              <div key={d} className="border-b border-slate-200 bg-slate-50 py-2 text-center font-semibold tracking-wide text-slate-500">
                {d}
              </div>
            ))}

            {cells.map((day, idx) => {
              const events = day ? eventsByDay[day] : null;
              const isSelected = day === selectedDay;
              const isAllowed = isDayAllowed(day);

              return (
                <div
                  key={idx}
                  onClick={() => {
                    if (day) {
                      setSelectedDay(day);
                      if (!isDayAllowed(day) && isCurrentMonth && day > actualDay) {
                        showModal("error", "Future Date", "You cannot mark attendance for a date that hasn't happened yet.");
                      }
                    }
                  }}
                  className={`min-h-[70px] border-b border-r border-slate-100 p-1.5 last:border-r-0 sm:min-h-[92px] sm:p-2 transition-colors ${
                    !day 
                      ? "bg-slate-50/50" 
                      : isSelected && isAllowed
                        ? "bg-blue-50 border-blue-200 cursor-pointer" 
                        : isAllowed
                          ? "bg-white hover:bg-slate-50 cursor-pointer"
                          : "bg-slate-50/50 cursor-pointer opacity-60" 
                  }`}
                >
                  {day && (
                    <>
                      <span className={`text-xs font-medium ${isSelected ? "text-[#004DD2]" : "text-slate-700"}`}>
                        {day}
                      </span>
                      <div className="mt-1 space-y-1">
                        {events?.map((ev, i) => (
                          <div
                            key={i}
                            className={`rounded-md border-l-2 px-1.5 py-1 text-[10px] leading-tight ${
                              ev.status === "Cancelled"
                                ? "border-slate-300 bg-slate-50 text-slate-400 line-through"
                                : "border-green-500 bg-green-50 text-green-700"
                            }`}
                          >
                            <p className="font-semibold truncate">{ev.code}</p>
                            <p className="truncate">{ev.status === "Cancelled" ? "Cancelled" : "Marked"}</p>
                          </div>
                        ))}
                        {isSelected && isAllowed && (
                          <button className="flex w-full justify-center items-center gap-1 rounded-md bg-[#004DD2] px-1.5 py-1 text-[10px] font-medium text-white shadow-sm mt-1">
                            <Plus className="h-2.5 w-2.5" /> Select
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Action Side Panel */}
        <div className="w-full shrink-0 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm xl:w-80">
          <div className="flex items-start gap-2">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#004DD2]" />
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                {canEditMonth ? `Record for ${selectedDay} ${monthName}` : `Viewing ${monthName} ${year}`}
              </h3>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">
                {isDayAllowed(selectedDay) 
                  ? "Select a day on the calendar, fill the details below, and submit the attendance."
                  : "This date is locked. You are viewing a past or future date where marking is disabled."}
              </p>
            </div>
          </div>

          {!isDayAllowed(selectedDay) && (
            <div className="mt-4 flex items-center gap-2 rounded-lg bg-orange-50 p-3 text-xs font-medium text-orange-700 border border-orange-200">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {isCurrentMonth && selectedDay > actualDay 
                ? "You cannot mark attendance for future dates." 
                : "This date is from a locked past month. Only the current and previous months are editable."}
            </div>
          )}

          <div className="mt-6 w-full">
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Allocated Subject</label>
            <select 
              value={selectedAllocationId}
              onChange={(e) => setSelectedAllocationId(e.target.value)}
              disabled={!isDayAllowed(selectedDay)}
              className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-700 focus:border-[#004DD2] focus:outline-none focus:ring-1 focus:ring-[#004DD2] disabled:bg-slate-50 disabled:text-slate-400"
            >
              <option value="">Select a Subject...</option>
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

          <div className="mt-5">
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Session Duration</label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="mb-1 text-[11px] font-medium uppercase text-slate-400">Start</p>
                <div className={`flex items-center w-full rounded-lg border border-slate-300 overflow-hidden bg-white focus-within:border-[#004DD2] focus-within:ring-1 focus-within:ring-[#004DD2] ${!isDayAllowed(selectedDay) ? 'opacity-60 bg-slate-50' : ''}`}>
                  <input
                    type="text"
                    readOnly
                    value={startTime}
                    disabled={!isDayAllowed(selectedDay)}
                    className="w-full px-3 py-2 text-sm text-slate-700 bg-transparent outline-none cursor-default select-none tracking-wider font-medium disabled:text-slate-400"
                  />
                  <div className="flex flex-col border-l border-slate-200 bg-slate-50">
                    <button 
                      type="button" 
                      onClick={() => handleTimeChange('start', 'up')}
                      disabled={!isDayAllowed(selectedDay)}
                      className="p-0.5 hover:bg-slate-200 text-slate-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ChevronUp className="h-3.5 w-3.5" />
                    </button>
                    <button 
                      type="button" 
                      onClick={() => handleTimeChange('start', 'down')}
                      disabled={!isDayAllowed(selectedDay)}
                      className="p-0.5 hover:bg-slate-200 text-slate-600 transition-colors border-t border-slate-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ChevronDown className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
              
              <div>
                <p className="mb-1 text-[11px] font-medium uppercase text-slate-400">End</p>
                <div className={`flex items-center w-full rounded-lg border border-slate-300 overflow-hidden bg-white focus-within:border-[#004DD2] focus-within:ring-1 focus-within:ring-[#004DD2] ${!isDayAllowed(selectedDay) ? 'opacity-60 bg-slate-50' : ''}`}>
                  <input
                    type="text"
                    readOnly
                    value={endTime}
                    disabled={!isDayAllowed(selectedDay)}
                    className="w-full px-3 py-2 text-sm text-slate-700 bg-transparent outline-none cursor-default select-none tracking-wider font-medium disabled:text-slate-400"
                  />
                  <div className="flex flex-col border-l border-slate-200 bg-slate-50">
                    <button 
                      type="button" 
                      onClick={() => handleTimeChange('end', 'up')}
                      disabled={!isDayAllowed(selectedDay)}
                      className="p-0.5 hover:bg-slate-200 text-slate-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ChevronUp className="h-3.5 w-3.5" />
                    </button>
                    <button 
                      type="button" 
                      onClick={() => handleTimeChange('end', 'down')}
                      disabled={!isDayAllowed(selectedDay)}
                      className="p-0.5 hover:bg-slate-200 text-slate-600 transition-colors border-t border-slate-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ChevronDown className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>

              {/* NEW: 30-Minute Checkbox for Grid */}
              <div className="col-span-2 flex items-center gap-2 mt-1">
                <input
                  type="checkbox"
                  id="halfHourToggleGrid"
                  checked={isHalfHourStep}
                  disabled={!isDayAllowed(selectedDay)}
                  onChange={(e) => {
                    const isChecked = e.target.checked;
                    setIsHalfHourStep(isChecked);
                    
                    if (!isChecked) {
                      setStartTime(prev => `${prev.split(':')[0]}:00`);
                      setEndTime(prev => `${prev.split(':')[0]}:00`);
                    }
                  }}
                  className="h-4 w-4 rounded border-slate-300 text-[#004DD2] focus:ring-[#004DD2] disabled:opacity-50"
                />
                <label htmlFor="halfHourToggleGrid" className={`text-xs font-medium cursor-pointer select-none ${!isDayAllowed(selectedDay) ? 'text-slate-400' : 'text-slate-600'}`}>
                  Enable 30-minute intervals (Total hours must still be whole numbers)
                </label>
              </div>

            </div>
          </div>

          {/* NEW: Auto-Calculated Hours Banner (Matched from the List View) */}
          <div className="mt-3 flex items-center justify-between rounded-lg bg-blue-50 px-4 py-3 text-sm border border-blue-100">
            <span className="font-medium text-[#004DD2]">Total Hours</span>
            <span className="font-bold text-[#004DD2]">{hours} hrs</span>
          </div>
          
          <div className="mt-5">
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Remarks</label>
            <input
              type="text"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Optional notes..."
              disabled={!isDayAllowed(selectedDay)}
              className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-700 focus:border-[#004DD2] focus:outline-none focus:ring-1 focus:ring-[#004DD2] disabled:bg-slate-50 disabled:text-slate-400"
            />
          </div>

          <button 
            onClick={handleSubmit}
            disabled={isSubmitting || !selectedAllocationId || !isDayAllowed(selectedDay)}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-[#004DD2] py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSubmitting && !deleteConfig.isOpen ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            {isSubmitting && !deleteConfig.isOpen ? "Submitting..." : "Submit Attendance"}
          </button>

          {hasRecordsToClear && (
            <div className="mt-4 border-t border-slate-100 pt-4">
              <button 
                onClick={openDayDelete}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-red-200 bg-red-50 py-3 text-sm font-semibold text-red-600 shadow-sm hover:bg-red-100 transition-colors"
              >
                <Trash2 className="h-4 w-4" /> Clear Records for {selectedDay} {monthName}
              </button>
            </div>
          )}
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

      {/* --- CUSTOM DELETE CONFIRMATION MODAL --- */}
      {deleteConfig.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md scale-100 overflow-hidden rounded-2xl bg-white shadow-xl animate-in zoom-in-95 duration-200">
            <div className="p-6 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-100 text-red-600">
                <AlertTriangle size={28} strokeWidth={2.5} />
              </div>
              <h3 className="mb-2 text-xl font-bold text-slate-800">Clear Attendance Records?</h3>
              <p className="text-sm text-slate-500 px-2 leading-relaxed">
                Are you sure you want to delete {deleteConfig.type === 'month' ? "ALL records for" : "the records for"} <strong>{deleteConfig.label}</strong>? This action cannot be undone.
              </p>
            </div>
            <div className="flex justify-end gap-3 border-t border-slate-100 bg-slate-50 p-4">
              <button
                onClick={() => setDeleteConfig({ isOpen: false, type: '', dateString: '', label: '' })}
                disabled={isSubmitting}
                className="rounded-lg border border-slate-200 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={executeBulkDelete}
                disabled={isSubmitting}
                className="flex items-center gap-2 rounded-lg bg-red-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
              >
                {isSubmitting ? <><Loader2 className="h-4 w-4 animate-spin" /> Deleting...</> : "Yes, Delete Records"}
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
              <p className="text-sm text-slate-500 leading-relaxed px-2">
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