const {
    markAttendance,
    markDailyAttendance,
    markWeeklyAttendance,
    markMonthlyAttendance,
    getDailyAttendance,
    getWeeklyAttendance,
    getMonthlyAttendance,
    getAttendanceHistory,
    getAdminAttendance,
    verifyAttendance,
    getFacultyAllocations,
    getAttendanceByIdService,
    deleteAttendanceById,
    deleteAttendanceByFaculty
} = require("../service/attendanceService");

const { generateBill, upsertBill } = require("../service/billService");

// ============================================================
// ■  HELPER: Fire-and-forget bill generation
//    Called after every successful attendance insert.
//    Runs asynchronously so it NEVER blocks the API response.
//    "Bill already generated" errors are silently ignored;
//    all other errors are logged for debugging.
// ============================================================
const triggerBillGeneration = (userId, month, year) => {
    // Skip bill generation during unit tests to avoid pending async tasks and connection timeouts
    if (process.env.NODE_ENV === 'test') return;

    // Convert year to the number type expected by generateBill
    const yearStr = String(year);

    // Use setImmediate so the HTTP response is sent first,
    // then bill generation runs in the next event-loop tick.
    setImmediate(async () => {
        try {
            // upsertBill: creates the bill if it doesn't exist yet;
            // if a bill already exists for this faculty+month+year it
            // deletes the old one and regenerates it from all current
            // attendance records — so the Super Admin always sees the
            // latest, accurate amount in the Monthly Summary.
            await upsertBill(userId, month, yearStr);
            console.log(
                `[AutoBill] Bill upserted for faculty ${userId} — ${month} ${yearStr}`
            );
        } catch (err) {
            // Log any unexpected errors without crashing the server.
            console.error(
                `[AutoBill] Failed to upsert bill for faculty ${userId} — ${month} ${yearStr}: ${err.message}`
            );
        }
    });
};

// ============================================================
// ■  HELPERS
// ============================================================

// ── Required fields for GENERIC POST /api/attendance/ ─────────────────────
// attendance_date is required for generic + weekly + monthly;
// hours is now OPTIONAL (auto-calculated in service from start_time / end_time).
const REQUIRED_MARK_FIELDS = [
    'user_id', 'course_id', 'semester_id', 'subject_id',
    'attendance_date', 'start_time', 'end_time'
    // hours  → optional; auto-calculated from start_time / end_time
    // section_id → optional; used for precise allocation lookup
];

const validateMarkBody = (item, index = null) => {
    const missing = REQUIRED_MARK_FIELDS.filter(f => !item[f]);
    if (missing.length > 0) {
        const prefix = index !== null ? `record[${index}]: ` : '';
        return `${prefix}Missing required fields: ${missing.join(', ')}`;
    }
    return null;
};

// ============================================================
// ■  GENERIC: POST /api/attendance/
//    Mark attendance — single OR bulk array.
//    Accepts optional `attendance_period` in body.
// ============================================================
const markAttendanceController = async (req, res) => {
    try {
        const isArray = Array.isArray(req.body);
        const items   = isArray ? req.body : [req.body];

        // 1. Validate all records first
        for (let i = 0; i < items.length; i++) {
            const err = validateMarkBody(items[i], isArray ? i : null);
            if (err) return res.status(400).json({ success: false, message: err });
        }

        // 2. Insert all
        const results = [];
        for (const item of items) {
            const attendance = await markAttendance(item);
            results.push(attendance);
        }

        // 3. Auto-generate bill for each unique faculty+month+year combination
        const seen = new Set();
        for (let i = 0; i < results.length; i++) {
            const rec = results[i];
            const uid = items[i].user_id;   // user_id is always in the request body
            const key = `${uid}|${rec.month}|${rec.year}`;
            if (!seen.has(key)) {
                seen.add(key);
                if (uid && rec.month && rec.year) {
                    triggerBillGeneration(uid, rec.month, rec.year);
                }
            }
        }

        return res.status(201).json({
            success: true,
            message: isArray
                ? `Successfully marked ${results.length} attendance records.`
                : "Attendance submitted successfully.",
            data: isArray ? results : results[0]
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

// ============================================================
// ■  DAILY: POST /api/attendance/mark/daily
//    Faculty marks attendance for today (or a specific date).
//    `attendance_date` is optional — defaults to today (pre-filled in Figma List View).
//
//    Required body fields:
//      user_id
//      course_id, semester_id, subject_id
//        └─ OR ─┘ allocation_id  (direct, skips lookup)
//      start_time, end_time
//    Optional:
//      attendance_date  (defaults to today)
//      section_id       (for precise lookup when faculty has multiple sections)
//      hours            (auto-calculated from start_time / end_time if omitted)
//      month, year      (auto-derived from date if omitted)
//      status           ('Marked' default | 'Cancelled')
//      remarks
// ============================================================
const markDailyAttendanceController = async (req, res) => {
    try {
        const isArray = Array.isArray(req.body);
        const items   = isArray ? req.body : [req.body];

        // Required fields for daily (attendance_date optional — defaults to today)
        const DAILY_REQUIRED = ['user_id', 'start_time', 'end_time'];
        // Must have EITHER allocation_id OR (course_id + semester_id + subject_id)
        const needsLookup = (item) => !item.allocation_id;

        for (let i = 0; i < items.length; i++) {
            const item    = items[i];
            const missing = DAILY_REQUIRED.filter(f => !item[f]);

            // If no allocation_id, also require course/semester/subject for lookup
            if (needsLookup(item)) {
                ['course_id', 'semester_id', 'subject_id'].forEach(f => {
                    if (!item[f]) missing.push(f);
                });
            }

            if (missing.length > 0) {
                return res.status(400).json({
                    success: false,
                    message: `${isArray ? `record[${i}]: ` : ''}Missing required fields: ${missing.join(', ')}`
                });
            }
        }

        const results = [];
        for (const item of items) {
            results.push(await markDailyAttendance(item));
        }

        // Auto-generate bill for each unique faculty+month+year
        const seen = new Set();
        for (let i = 0; i < results.length; i++) {
            const rec = results[i];
            const uid = items[i].user_id;
            const key = `${uid}|${rec.month}|${rec.year}`;
            if (!seen.has(key)) {
                seen.add(key);
                if (uid && rec.month && rec.year) {
                    triggerBillGeneration(uid, rec.month, rec.year);
                }
            }
        }

        return res.status(201).json({
            success:           true,
            attendance_period: 'daily',
            message:           isArray
                                 ? `${results.length} daily attendance record(s) submitted.`
                                 : "Daily attendance submitted successfully.",
            data: isArray ? results : results[0]
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

// ============================================================
// ■  WEEKLY: POST /api/attendance/mark/weekly
//    Faculty marks a class session for a date within a specific week.
//    The calendar panel on the Figma Grid View sends this when the faculty
//    clicks a date, fills the right-panel form, and hits Submit Attendance.
//
//    Required body fields:
//      user_id
//      course_id, semester_id, subject_id
//        └─ OR ─┘ allocation_id  (direct, skips lookup)
//      attendance_date  (the date clicked on the Figma calendar)
//      start_time, end_time
//    Optional:
//      section_id     (Section A / B toggle in Figma right-panel)
//      hours          (auto-calculated from start_time / end_time)
//      week_number    (auto-calculated from attendance_date if omitted)
//      month, year    (auto-derived from attendance_date if omitted)
//      status         ('Marked' default | 'Cancelled')
//      remarks
// ============================================================
const markWeeklyAttendanceController = async (req, res) => {
    try {
        const isArray = Array.isArray(req.body);
        const items   = isArray ? req.body : [req.body];

        // attendance_date is required for weekly (it is the clicked calendar date)
        const WEEKLY_REQUIRED = ['user_id', 'attendance_date', 'start_time', 'end_time'];
        const needsLookup = (item) => !item.allocation_id;

        for (let i = 0; i < items.length; i++) {
            const item    = items[i];
            const missing = WEEKLY_REQUIRED.filter(f => !item[f]);

            if (needsLookup(item)) {
                ['course_id', 'semester_id', 'subject_id'].forEach(f => {
                    if (!item[f]) missing.push(f);
                });
            }

            if (missing.length > 0) {
                return res.status(400).json({
                    success: false,
                    message: `${isArray ? `record[${i}]: ` : ''}Missing required fields: ${missing.join(', ')}`
                });
            }
        }

        const results = [];
        for (const item of items) {
            results.push(await markWeeklyAttendance(item));
        }

        // Auto-generate bill for each unique faculty+month+year
        const seen = new Set();
        for (let i = 0; i < results.length; i++) {
            const rec = results[i];
            const uid = items[i].user_id;
            const key = `${uid}|${rec.month}|${rec.year}`;
            if (!seen.has(key)) {
                seen.add(key);
                if (uid && rec.month && rec.year) {
                    triggerBillGeneration(uid, rec.month, rec.year);
                }
            }
        }

        return res.status(201).json({
            success:           true,
            attendance_period: 'weekly',
            message:           isArray
                                 ? `${results.length} weekly attendance record(s) submitted.`
                                 : "Weekly attendance submitted successfully.",
            data: isArray ? results : results[0]
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

// ============================================================
// ■  MONTHLY: POST /api/attendance/mark/monthly
//    Faculty marks a class session for a date within a month.
//    This is the Figma Grid/Calendar View — faculty clicks a date on the
//    monthly calendar, fills the right-panel form, and hits Submit Attendance.
//
//    Required body fields:
//      user_id
//      course_id, semester_id, subject_id
//        └─ OR ─┘ allocation_id  (direct, skips lookup)
//      attendance_date  (the date clicked on the Figma calendar)
//      start_time, end_time
//      month            (e.g. "December"  — drives calendar grouping)
//      year             (e.g. 2024)
//    Optional:
//      section_id     (Section A / B toggle in Figma right-panel)
//      hours          (auto-calculated from start_time / end_time)
//      status         ('Marked' default | 'Cancelled')
//      remarks
// ============================================================
const markMonthlyAttendanceController = async (req, res) => {
    try {
        const isArray = Array.isArray(req.body);
        const items   = isArray ? req.body : [req.body];

        // attendance_date, month and year are required for monthly
        const MONTHLY_REQUIRED = ['user_id', 'attendance_date', 'start_time', 'end_time', 'month', 'year'];
        const needsLookup = (item) => !item.allocation_id;

        for (let i = 0; i < items.length; i++) {
            const item    = items[i];
            const missing = MONTHLY_REQUIRED.filter(f => !item[f]);

            if (needsLookup(item)) {
                ['course_id', 'semester_id', 'subject_id'].forEach(f => {
                    if (!item[f]) missing.push(f);
                });
            }

            if (missing.length > 0) {
                return res.status(400).json({
                    success: false,
                    message: `${isArray ? `record[${i}]: ` : ''}Missing required fields: ${missing.join(', ')}`
                });
            }
        }

        const results = [];
        for (const item of items) {
            results.push(await markMonthlyAttendance(item));
        }

        // Auto-generate bill for each unique faculty+month+year
        const seen = new Set();
        for (let i = 0; i < results.length; i++) {
            const rec = results[i];
            const uid = items[i].user_id;
            const key = `${uid}|${rec.month}|${rec.year}`;
            if (!seen.has(key)) {
                seen.add(key);
                if (uid && rec.month && rec.year) {
                    triggerBillGeneration(uid, rec.month, rec.year);
                }
            }
        }

        return res.status(201).json({
            success:           true,
            attendance_period: 'monthly',
            message:           isArray
                                 ? `${results.length} monthly attendance record(s) submitted.`
                                 : "Monthly attendance submitted successfully.",
            data: isArray ? results : results[0]
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

// ============================================================
// ■  VIEW: GET /api/attendance/daily/:facultyId?date=YYYY-MM-DD
//    Returns attendance records for a single day.
//    date defaults to today if not supplied.
// ============================================================
const getDailyAttendanceController = async (req, res) => {
    try {
        const { facultyId } = req.params;
        const dateStr       = req.query.date || null;   // optional ?date=YYYY-MM-DD

        const result = await getDailyAttendance(facultyId, dateStr);

        return res.status(200).json({
            success:        true,
            attendanceDate: result.attendanceDate,
            totalClasses:   result.totalClasses,
            totalHours:     result.totalHours,
            data:           result.data
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

// ============================================================
// ■  VIEW: GET /api/attendance/weekly/:facultyId?date=YYYY-MM-DD
//    Returns attendance for the ISO week containing `date`.
//    Defaults to the current week if `date` is omitted.
// ============================================================
const getWeeklyAttendanceController = async (req, res) => {
    try {
        const { facultyId } = req.params;
        const dateStr       = req.query.date || null;   // optional ?date=YYYY-MM-DD

        const result = await getWeeklyAttendance(facultyId, dateStr);

        return res.status(200).json({
            success:      true,
            weekStart:    result.weekStart,
            weekEnd:      result.weekEnd,
            weekNumber:   result.weekNumber,
            workingDays:  result.workingDays,
            daysPresent:  result.daysPresent,
            daysAbsent:   result.daysAbsent,
            totalClasses: result.totalClasses,
            totalHours:   result.totalHours,
            data:         result.data
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

// ============================================================
// ■  VIEW: GET /api/attendance/monthly/:facultyId?month=July&year=2026
// ============================================================
const getMonthlyAttendanceController = async (req, res) => {
    try {
        const { facultyId }   = req.params;
        const { month, year } = req.query;

        if (!month || !year) {
            return res.status(400).json({
                success: false,
                message: "month and year query params are required."
            });
        }

        const result = await getMonthlyAttendance(facultyId, month, year);

        return res.status(200).json({
            success:      true,
            month:        result.month,
            year:         result.year,
            workingDays:  result.workingDays,
            daysPresent:  result.daysPresent,
            daysAbsent:   result.daysAbsent,
            totalClasses: result.totalClasses,
            totalHours:   result.totalHours,
            data:         result.data
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

// ============================================================
// ■  VIEW: GET /api/attendance/history/:facultyId
// ============================================================
const attendanceHistoryController = async (req, res) => {
    try {
        const { facultyId } = req.params;

        const result = await getAttendanceHistory(facultyId);

        return res.status(200).json({
            success:      true,
            totalClasses: result.totalClasses,
            totalHours:   result.totalHours,
            daysPresent:  result.daysPresent,
            data:         result.data
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

// ============================================================
// ■  ADMIN: GET /api/attendance/admin
//    Supports ?facultyId=, ?month=, ?year=, ?status=, ?attendance_period=
// ============================================================
const getAdminAttendanceController = async (req, res) => {
    try {
        const result = await getAdminAttendance(req.query);

        return res.status(200).json({
            success:      true,
            totalRecords: result.totalRecords,
            data:         result.data
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

// ============================================================
// ■  ADMIN: PATCH /api/attendance/verify/:attendanceId
// ============================================================
const verifyAttendanceController = async (req, res) => {
    try {
        const { attendanceId }   = req.params;
        const { status, remarks } = req.body;

        if (!status) {
            return res.status(400).json({
                success: false,
                message: "status is required. Allowed values: Present | Absent | Pending | Marked | Cancelled"
            });
        }

        const updated = await verifyAttendance(attendanceId, status, remarks);

        if (updated && updated.user_id && updated.month && updated.year) {
            triggerBillGeneration(updated.user_id, updated.month, updated.year);
        }

        return res.status(200).json({
            success: true,
            message: "Attendance status updated successfully.",
            data:    updated
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

// ============================================================
// ■  GET /api/attendance/my-allocations/:facultyId
// ============================================================
const getFacultyAllocationsController = async (req, res) => {
    try {
        const { facultyId } = req.params;

        const result = await getFacultyAllocations(facultyId);

        return res.status(200).json({
            success:    true,
            faculty_id: result.faculty_id,
            total:      result.total,
            allocations: result.allocations
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

// ============================================================
// ■  GET /api/attendance/record/:attendanceId  (strict)
// ============================================================
const getAttendanceByIdStrictController = async (req, res) => {
    try {
        const { attendanceId } = req.params;

        if (isNaN(attendanceId) || !Number.isInteger(Number(attendanceId))) {
            return res.status(400).json({
                success: false,
                message: "attendance_id must be a valid integer."
            });
        }

        const attendance = await getAttendanceByIdService(Number(attendanceId));

        if (!attendance) {
            return res.status(404).json({
                success: false,
                message: `No attendance record found with attendance_id = ${attendanceId}.`
            });
        }

        return res.status(200).json({ success: true, data: attendance });

    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false, message: err.message });
    }
};

// ============================================================
// ■  GET /api/attendance/:attendanceId  (smart lookup)
// ============================================================
const getAttendanceByIdController = async (req, res) => {
    try {
        const { attendanceId } = req.params;

        // Numeric → single record
        if (!isNaN(attendanceId) && Number.isInteger(Number(attendanceId))) {
            const attendance = await getAttendanceByIdService(Number(attendanceId));
            if (attendance) {
                return res.status(200).json({
                    success: true,
                    type:    "single_attendance_record",
                    data:    attendance
                });
            }
        }

        // Non-numeric → faculty history
        try {
            const history = await getAttendanceHistory(attendanceId);
            if (history && history.data) {
                return res.status(200).json({
                    success:      true,
                    type:         "faculty_attendance_history",
                    totalClasses: history.totalClasses,
                    totalHours:   history.totalHours,
                    daysPresent:  history.daysPresent,
                    data:         history.data
                });
            }
        } catch (_) {
            // swallow — not a valid faculty ID either
        }

        return res.status(404).json({
            success: false,
            message: "No record found. The ID does not match any attendance_id or active faculty."
        });

    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false, message: err.message });
    }
};

// ============================================================
// ■  DELETE /api/attendance/faculty/:facultyId
//    Hard-deletes attendance records for a given faculty.
//
//    Path param:
//      facultyId  — numeric user_id  OR  uvfin string (e.g. "VF-2024-001")
//
//    Optional query filters (all combinable):
//      ?attendance_period=daily|weekly|monthly
//      ?month=July
//      ?year=2026
//      ?attendance_date=YYYY-MM-DD
//
//    Responses:
//      200  — deletion succeeded (deletedCount may be 0 = no matching rows)
//      404  — facultyId resolves to no user
//      500  — unexpected DB error
// ============================================================
const deleteAttendanceByFacultyController = async (req, res) => {
    try {
        const { facultyId } = req.params;

        const filters = {
            attendance_period: req.query.attendance_period || null,
            month:             req.query.month             || null,
            year:              req.query.year              || null,
            attendance_date:   req.query.attendance_date   || null
        };

        // Remove null keys so service receives a clean object
        Object.keys(filters).forEach(k => filters[k] == null && delete filters[k]);

        const result = await deleteAttendanceByFaculty(facultyId, filters);

        if (result.user_id && filters.month && filters.year) {
            triggerBillGeneration(result.user_id, filters.month, filters.year);
        }

        return res.status(200).json({
            success:      true,
            message:      result.deletedCount > 0
                            ? `${result.deletedCount} attendance record(s) deleted successfully.`
                            : "No matching attendance records found to delete.",
            faculty_id:   result.faculty_id,
            user_id:      result.user_id,
            deletedCount: result.deletedCount,
            filters:      result.filters
        });

    } catch (error) {
        console.error(error);
        const isFacultyNotFound = error.message === 'Faculty not found';
        return res.status(isFacultyNotFound ? 404 : 500).json({
            success: false,
            message: error.message
        });
    }
};

// ============================================================
// ■  DELETE /api/attendance/record/:attendanceId
//    Deletes a SINGLE attendance record by its attendance_id.
//
//    Example: DELETE /api/attendance/record/23
//      → deletes only attendance_id=23, keeps 24 and 26 untouched
//
//    Responses:
//      200  — deleted successfully, returns the deleted record
//      400  — attendanceId is not a valid number
//      404  — no record found with that id
//      500  — unexpected DB error
// ============================================================
const deleteAttendanceByIdController = async (req, res) => {
    try {
        const { attendanceId } = req.params;

        // Validate: must be a positive integer
        if (isNaN(attendanceId) || !Number.isInteger(Number(attendanceId))) {
            return res.status(400).json({
                success: false,
                message: "attendance_id must be a valid integer. Example: DELETE /api/attendance/record/23"
            });
        }

        const deleted = await deleteAttendanceById(Number(attendanceId));

        if (deleted && deleted.user_id && deleted.month && deleted.year) {
            triggerBillGeneration(deleted.user_id, deleted.month, deleted.year);
        }

        return res.status(200).json({
            success: true,
            message: `Attendance record #${attendanceId} deleted successfully.`,
            data:    deleted   // returns the deleted row so frontend can confirm
        });

    } catch (error) {
        console.error(error);
        const isNotFound = error.message.includes('not found');
        return res.status(isNotFound ? 404 : 500).json({
            success: false,
            message: error.message
        });
    }
};


module.exports = {
    markAttendanceController,
    markDailyAttendanceController,
    markWeeklyAttendanceController,
    markMonthlyAttendanceController,
    getDailyAttendanceController,
    getWeeklyAttendanceController,
    getMonthlyAttendanceController,
    attendanceHistoryController,
    getAdminAttendanceController,
    verifyAttendanceController,
    getFacultyAllocationsController,
    getAttendanceByIdStrictController,
    getAttendanceByIdController,
    deleteAttendanceByIdController,         // DELETE /record/:attendanceId  (single)
    deleteAttendanceByFacultyController     // DELETE /faculty/:facultyId    (bulk)
};