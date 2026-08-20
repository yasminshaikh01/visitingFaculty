const { Op } = require("sequelize");

const {
    Attendance,
    Allocation,
    Subject,
    Course,
    Semester,
    Section,
    User
} = require("../Schema");

// ==========================
// Helper: resolve faculty user_id from uvfin string OR numeric user_id
// ==========================
const resolveUserId = async (facultyId) => {

    const user =
        await User.findOne({
            where: {
                uvfin: String(facultyId)
            }
        }) ||
        (!isNaN(facultyId)
            ? await User.findByPk(Number(facultyId))
            : null);

    if (!user) {
        throw new Error("Faculty not found");
    }

    return user.user_id;
};

// ==========================
// Helper: auto-calculate hours from HH:MM:SS start/end times
// Matches the "Total Hours (Auto Calculated)" field in the Figma List View.
// Returns a DECIMAL(5,2) compatible float, e.g. 1.5 for 90 minutes.
// ==========================
const calcHours = (start_time, end_time) => {
    const toMinutes = (t) => {
        const [h, m] = String(t).split(':').map(Number);
        return h * 60 + (m || 0);
    };
    const diff = toMinutes(end_time) - toMinutes(start_time);
    if (diff <= 0) throw new Error('end_time must be after start_time.');
    return parseFloat((diff / 60).toFixed(2));
};

// ==========================
// Helper: get ISO week number for a given Date
// ==========================
const getISOWeekNumber = (date) => {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
};

// ==========================
// Helper: get start (Monday) and end (Sunday) of the ISO week
// containing a given YYYY-MM-DD date string
// ==========================
const getWeekBounds = (dateStr) => {
    const d = new Date(dateStr);
    const day = d.getDay(); // 0 = Sunday
    const diffToMonday = (day === 0) ? -6 : 1 - day;
    const monday = new Date(d);
    monday.setDate(d.getDate() + diffToMonday);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    return {
        weekStart: monday.toISOString().split("T")[0],
        weekEnd: sunday.toISOString().split("T")[0],
        weekNumber: getISOWeekNumber(monday)
    };
};

// ==========================
// Helper: Sync is_billable status for a faculty's monthly attendance records
// Evaluates records in chronological order up to ₹30,000 max.
// ==========================
const MONTHLY_BILL_CAP = 30000;

const syncMonthlyBillableStatus = async (userId, month, year, transaction = null) => {
    const records = await Attendance.findAll({
        where: { user_id: userId, month, year: Number(year) },
        include: [{
            model: Allocation,
            attributes: ['rate_per_hour']
        }],
        order: [["attendance_date", "ASC"], ["start_time", "ASC"], ["attendance_id", "ASC"]],
        transaction
    });

    let runningTotal = 0;
    for (const rec of records) {
        const rate = rec.Allocation?.rate_per_hour ? Number(rec.Allocation.rate_per_hour) : 0;
        const amount = Number(rec.hours) * rate;

        let shouldBeBillable = true;
        if (runningTotal + amount > MONTHLY_BILL_CAP) {
            shouldBeBillable = false;
        } else {
            runningTotal += amount;
        }

        if (rec.is_billable !== shouldBeBillable) {
            await rec.update({ is_billable: shouldBeBillable }, { transaction });
        }
    }
    return runningTotal;
};

// ==========================
// Helper: Flatten a raw Attendance Sequelize record
// Extracts Subject, Course, Semester, Section from nested Allocation
// ==========================
const flattenAttendance = (item) => {
    const alloc = item.Allocation || {};
    const user = item.User || null;
    const rate = alloc.rate_per_hour != null ? Number(alloc.rate_per_hour) : null;
    const hours = Number(item.hours);
    const is_billable = item.is_billable ?? true;

    const uncapped_amount = rate !== null ? Number((hours * rate).toFixed(2)) : 0;
    const billable_amount = is_billable ? uncapped_amount : 0;

    return {
        // --- Core attendance fields ---
        attendance_id: item.attendance_id,
        attendance_date: item.attendance_date,
        start_time: item.start_time,
        end_time: item.end_time,
        hours: hours,
        status: item.status,
        remarks: item.remarks,
        month: item.month,
        year: item.year,
        attendance_period: item.attendance_period,
        week_number: item.week_number,
        is_billable: is_billable,
        billable_amount: billable_amount,
        uncapped_amount: uncapped_amount,
        amount: billable_amount,

        // --- Faculty (only present in admin queries) ---
        ...(user ? {
            user_id: user.user_id,
            full_name: user.full_name,
            email: user.email,
            uvfin: user.uvfin
        } : {}),

        // --- Allocation ---
        allocation_id: alloc.allocation_id ?? null,
        session_type: alloc.session_type ?? null,
        // rate_per_hour is ENUM('200','400','800') — always return as Number
        rate_per_hour: rate,

        // --- Course ---
        course_id: alloc.Course?.course_id ?? null,
        course_name: alloc.Course?.course_name ?? null,
        course_code: alloc.Course?.course_code ?? null,

        // --- Semester ---
        semester_id: alloc.Semester?.semester_id ?? null,
        semester_number: alloc.Semester?.semester_number ?? null,

        // --- Section ---
        section_id: alloc.Section?.section_id ?? null,
        section_name: alloc.Section?.section_name ?? null,

        // --- Subject ---
        subject_id: alloc.Subject?.subject_id ?? null,
        subject_code: alloc.Subject?.subject_code ?? null,
        subject_name: alloc.Subject?.subject_name ?? null
    };
};

// ==========================
// Helper: find active allocation for a faculty + course/semester/subject
//
// Accepts:
//   allocation_id  (optional) — pass it directly from the frontend to skip the
//                               course/semester/subject lookup entirely. Fastest path.
//   course_id      (optional) — used for lookup when allocation_id is unknown
//   semester_id    (optional) — used for lookup
//   section_id     (optional) — used for lookup; matches the "Section" toggle in the Figma form
//   subject_id     (optional) — used for lookup
// ==========================
const findAllocation = async (numericUserId, { allocation_id, course_id, semester_id, section_id, subject_id }) => {
    const includeBlock = [
        { model: Subject, attributes: ["subject_id", "subject_code", "subject_name"] },
        { model: Course, attributes: ["course_id", "course_name", "course_code"] },
        { model: Semester, attributes: ["semester_id", "semester_number"] },
        { model: Section, attributes: ["section_id", "section_name"] }
    ];

    // ── Fast path: allocation_id provided directly from the frontend ────────────
    if (allocation_id) {
        const allocation = await Allocation.findOne({
            where: { allocation_id, user_id: numericUserId, is_active: true },
            include: includeBlock
        });
        if (!allocation) {
            throw new Error(
                `No active allocation found with allocation_id=${allocation_id} for this faculty.`
            );
        }
        return allocation;
    }

    // ── Lookup path: match by course / semester / section / subject ─────────────
    const whereClause = { user_id: numericUserId, is_active: true };
    if (course_id) whereClause.course_id = course_id;
    if (semester_id) whereClause.semester_id = semester_id;
    if (section_id) whereClause.section_id = section_id;  // Figma: Section A / B toggle
    if (subject_id) whereClause.subject_id = subject_id;

    const allocation = await Allocation.findOne({
        where: whereClause,
        include: includeBlock
    });

    if (!allocation) {
        throw new Error(
            "No active allocation found for this faculty with the given course, semester, section, and subject."
        );
    }

    return allocation;
};

// ==========================
// Helper: build a rich return object after saving an attendance row
// ==========================
const buildAttendanceResult = (newAttendance, allocation) => {
    const rate = allocation.rate_per_hour != null ? Number(allocation.rate_per_hour) : 0;
    const hours = Number(newAttendance.hours);
    const is_billable = newAttendance.is_billable ?? true;
    const uncapped_amount = Number((hours * rate).toFixed(2));
    const billable_amount = is_billable ? uncapped_amount : 0;

    return {
        attendance_id: newAttendance.attendance_id,
        attendance_date: newAttendance.attendance_date,
        start_time: newAttendance.start_time,
        end_time: newAttendance.end_time,
        hours: hours,
        status: newAttendance.status,
        remarks: newAttendance.remarks,
        month: newAttendance.month,
        year: newAttendance.year,
        attendance_period: newAttendance.attendance_period,
        week_number: newAttendance.week_number ?? null,
        // ── ₹30k cap flag — true = counted in bill, false = beyond cap ────────
        is_billable: is_billable,
        billable_amount: billable_amount,
        uncapped_amount: uncapped_amount,
        amount: billable_amount,

        // Allocation details — flat for easy frontend use
        // rate_per_hour is ENUM string ('200'/'400'/'800') — cast to Number
        allocation_id: allocation.allocation_id,
        session_type: allocation.session_type,
        rate_per_hour: rate,

        // Course
        course_id: allocation.Course ? allocation.Course.course_id : null,
        course_name: allocation.Course ? allocation.Course.course_name : null,
        course_code: allocation.Course ? allocation.Course.course_code : null,

        // Semester
        semester_id: allocation.Semester ? allocation.Semester.semester_id : null,
        semester_number: allocation.Semester ? allocation.Semester.semester_number : null,

        // Section
        section_id: allocation.Section ? allocation.Section.section_id : null,
        section_name: allocation.Section ? allocation.Section.section_name : null,

        // Subject
        subject_id: allocation.Subject ? allocation.Subject.subject_id : null,
        subject_code: allocation.Subject ? allocation.Subject.subject_code : null,
        subject_name: allocation.Subject ? allocation.Subject.subject_name : null
    };
};

// ==========================
// Standard include block (reused in all findAll queries)
// ==========================
const allocationInclude = [
    {
        model: Allocation,
        attributes: ["allocation_id", "session_type", "rate_per_hour"],
        include: [
            { model: Subject, attributes: ["subject_id", "subject_code", "subject_name"] },
            { model: Course, attributes: ["course_id", "course_name", "course_code"] },
            { model: Semester, attributes: ["semester_id", "semester_number"] },
            { model: Section, attributes: ["section_id", "section_name"] }
        ]
    }
];

// ============================================================
// ■  CORE: Mark a SINGLE attendance row (used by all three
//    period-specific helpers below)
// ============================================================
const _insertAttendanceRow = async ({
    numericUserId,
    allocation,
    attendance_date,
    start_time,
    end_time,
    hours,              // optional — auto-calculated from start_time/end_time if omitted
    remarks,
    status,
    month,
    year,
    attendance_period,  // 'daily' | 'weekly' | 'monthly'
    week_number         // null unless weekly
}) => {
    // Auto-calculate hours from start/end if not provided by the client.
    // Matches the "Total Hours (Auto Calculated)" display in the Figma List View.
    const finalHours = (hours !== undefined && hours !== null && hours !== '')
        ? parseFloat(hours)
        : calcHours(start_time, end_time);

    // Duplicate check: same allocation + date + start_time
    const existing = await Attendance.findOne({
        where: { allocation_id: allocation.allocation_id, attendance_date, start_time }
    });
    if (existing) {
        throw new Error(
            `Attendance already submitted for this subject at ${start_time} on ${attendance_date}.`
        );
    }

    // Default status per period:
    //   'Marked'  → faculty confirmed the class happened   (calendar toggle)
    //   'Pending' → admin not yet verified
    // The Figma shows "Marked" / "Cancelled" on the form status toggle.
    // We store whatever the faculty sends; admin later sets Present/Absent.
    const finalStatus = status || 'Marked';

    const newAttendance = await Attendance.create({
        user_id: numericUserId,
        allocation_id: allocation.allocation_id,
        attendance_date,
        start_time,
        end_time,
        hours: finalHours,
        remarks: remarks || null,
        status: finalStatus,
        month,
        year,
        attendance_period,
        week_number: week_number ?? null
    });

    await syncMonthlyBillableStatus(numericUserId, month, year);
    await newAttendance.reload();

    return buildAttendanceResult(newAttendance, allocation);
};

// ==========================
// Mark Attendance (legacy / generic — accepts attendance_period in body)
// POST /api/attendance/
// ==========================
const markAttendance = async (attendanceData) => {
    try {
        const {
            user_id,
            allocation_id,
            course_id,
            semester_id,
            section_id,
            subject_id,
            attendance_date,
            start_time,
            end_time,
            hours,
            remarks,
            status,
            month,
            year,
            attendance_period = 'daily',
            week_number = null
        } = attendanceData;

        const numericUserId = await resolveUserId(user_id);
        const allocation = await findAllocation(numericUserId, { allocation_id, course_id, semester_id, section_id, subject_id });

        return await _insertAttendanceRow({
            numericUserId,
            allocation,
            attendance_date,
            start_time,
            end_time,
            hours,
            remarks,
            status,
            month,
            year,
            attendance_period,
            week_number
        });

    } catch (error) {
        throw error;
    }
};

// ============================================================
// ■  DAILY: Mark attendance for TODAY (or a given date)
//    POST /api/attendance/mark/daily
//
//    Body:
//      user_id, course_id, semester_id, subject_id
//      attendance_date  (optional – defaults to today)
//      start_time, end_time, hours
//      month, year      (optional – auto-derived from date)
//      remarks, status
// ============================================================
const markDailyAttendance = async (attendanceData) => {
    try {
        const {
            user_id,
            allocation_id,      // optional — pass to skip course/subject lookup
            course_id,
            semester_id,
            section_id,         // optional — matches the Section toggle in the Figma form
            subject_id,
            start_time,
            end_time,
            hours,              // optional — auto-calculated from start_time/end_time
            remarks,
            status              // optional — defaults to 'Marked' in _insertAttendanceRow
        } = attendanceData;

        // Default date → today (Figma List View shows today's date pre-filled)
        const today = attendanceData.attendance_date
            || new Date().toISOString().split("T")[0];

        const dateObj = new Date(today);
        const monthName = dateObj.toLocaleString('en-US', { month: 'long' });
        const year = attendanceData.year || dateObj.getFullYear();

        const numericUserId = await resolveUserId(user_id);
        const allocation = await findAllocation(numericUserId, { allocation_id, course_id, semester_id, section_id, subject_id });

        return await _insertAttendanceRow({
            numericUserId,
            allocation,
            attendance_date: today,
            start_time,
            end_time,
            hours,
            remarks,
            status,
            month: attendanceData.month || monthName,
            year,
            attendance_period: 'daily',
            week_number: null
        });

    } catch (error) {
        throw error;
    }
};

// ============================================================
// ■  WEEKLY: Mark attendance for a date within a specific week
//    POST /api/attendance/mark/weekly
//
//    Body:
//      user_id, course_id, semester_id, subject_id
//      attendance_date  — the actual lecture date (within the week)
//      start_time, end_time, hours
//      week_number      (optional – auto-calculated from attendance_date)
//      month, year      (optional – auto-derived from date)
//      remarks, status
// ============================================================
const markWeeklyAttendance = async (attendanceData) => {
    try {
        const {
            user_id,
            allocation_id,      // optional — direct allocation bypass
            course_id,
            semester_id,
            section_id,         // optional — Section A / B toggle from Figma calendar panel
            subject_id,
            attendance_date,    // the specific date clicked on the Figma calendar
            start_time,
            end_time,
            hours,              // optional — auto-calculated from start_time/end_time
            remarks,
            status              // optional — Figma toggle: 'Marked' | 'Cancelled'
        } = attendanceData;

        const dateObj = new Date(attendance_date);
        const monthName = dateObj.toLocaleString('en-US', { month: 'long' });
        const year = attendanceData.year || dateObj.getFullYear();
        // Auto-calculate week_number from the clicked date (ISO week)
        const weekNum = attendanceData.week_number || getISOWeekNumber(dateObj);

        const numericUserId = await resolveUserId(user_id);
        const allocation = await findAllocation(numericUserId, { allocation_id, course_id, semester_id, section_id, subject_id });

        return await _insertAttendanceRow({
            numericUserId,
            allocation,
            attendance_date,
            start_time,
            end_time,
            hours,
            remarks,
            status,
            month: attendanceData.month || monthName,
            year,
            attendance_period: 'weekly',
            week_number: weekNum
        });

    } catch (error) {
        throw error;
    }
};

// ============================================================
// ■  MONTHLY: Mark attendance entry for a date within a month
//    POST /api/attendance/mark/monthly
//
//    Body:
//      user_id, course_id, semester_id, subject_id
//      attendance_date  — the actual lecture date
//      start_time, end_time, hours
//      month, year      — REQUIRED (e.g. "July", 2026)
//      remarks, status
// ============================================================
const markMonthlyAttendance = async (attendanceData) => {
    try {
        const {
            user_id,
            allocation_id,      // optional — direct allocation bypass
            course_id,
            semester_id,
            section_id,         // optional — Section toggle from Figma calendar right-panel
            subject_id,
            attendance_date,    // the specific date clicked on the Figma calendar grid
            start_time,
            end_time,
            hours,              // optional — auto-calculated from start_time/end_time
            month,              // REQUIRED for monthly — e.g. "December"
            year,               // REQUIRED for monthly — e.g. 2024
            remarks,
            status              // optional — Figma toggle: 'Marked' | 'Cancelled'
        } = attendanceData;

        const numericUserId = await resolveUserId(user_id);
        const allocation = await findAllocation(numericUserId, { allocation_id, course_id, semester_id, section_id, subject_id });

        return await _insertAttendanceRow({
            numericUserId,
            allocation,
            attendance_date,
            start_time,
            end_time,
            hours,
            remarks,
            status,
            month,
            year,
            attendance_period: 'monthly',
            week_number: null
        });

    } catch (error) {
        throw error;
    }
};

// ==========================
// Daily Attendance VIEW
// GET /api/attendance/daily/:facultyId
// ==========================
const getDailyAttendance = async (facultyId, dateStr) => {
    try {
        const numericUserId = await resolveUserId(facultyId);

        // Use provided date OR today
        const today = dateStr || new Date().toISOString().split("T")[0];

        const attendance = await Attendance.findAll({
            where: { user_id: numericUserId, attendance_date: today },
            include: allocationInclude,
            order: [["start_time", "ASC"]]
        });

        const totalHours = attendance.reduce((sum, item) => sum + Number(item.hours), 0);
        const totalClasses = attendance.length;

        return {
            attendanceDate: today,
            totalClasses,
            totalHours,
            data: attendance.map(flattenAttendance)
        };

    } catch (error) {
        throw error;
    }
};

// ==========================
// Weekly Attendance VIEW
// GET /api/attendance/weekly/:facultyId?date=YYYY-MM-DD
// ==========================
const getWeeklyAttendance = async (facultyId, dateStr) => {
    try {
        const numericUserId = await resolveUserId(facultyId);

        // Default to current week
        const referenceDate = dateStr || new Date().toISOString().split("T")[0];
        const { weekStart, weekEnd, weekNumber } = getWeekBounds(referenceDate);

        const attendance = await Attendance.findAll({
            where: {
                user_id: numericUserId,
                attendance_date: { [Op.between]: [weekStart, weekEnd] }
            },
            include: allocationInclude,
            order: [["attendance_date", "ASC"], ["start_time", "ASC"]]
        });

        const totalHours = attendance.reduce((sum, item) => sum + Number(item.hours), 0);
        const totalClasses = attendance.length;
        const daysPresent = new Set(attendance.map(item => item.attendance_date)).size;
        const workingDays = 6; // Mon-Sat
        const daysAbsent = Math.max(workingDays - daysPresent, 0);

        return {
            weekStart,
            weekEnd,
            weekNumber,
            workingDays,
            daysPresent,
            daysAbsent,
            totalClasses,
            totalHours,
            data: attendance.map(flattenAttendance)
        };

    } catch (error) {
        throw error;
    }
};

// ==========================
// Monthly Attendance VIEW
// GET /api/attendance/monthly/:facultyId?month=July&year=2026
// ==========================
const getMonthlyAttendance = async (facultyId, month, year) => {
    try {
        const numericUserId = await resolveUserId(facultyId);

        await syncMonthlyBillableStatus(numericUserId, month, year);

        const attendance = await Attendance.findAll({
            where: { user_id: numericUserId, month, year: Number(year) },
            include: allocationInclude,
            order: [["attendance_date", "ASC"], ["start_time", "ASC"]]
        });

        const totalHours = attendance.reduce((sum, item) => sum + Number(item.hours), 0);
        const totalClasses = attendance.length;
        const daysPresent = new Set(attendance.map(item => item.attendance_date)).size;
        const workingDays = 26; // Adjust per college calendar
        const daysAbsent = Math.max(workingDays - daysPresent, 0);

        const totalBillableEarnings = attendance.reduce((sum, item) => {
            const isB = item.is_billable ?? true;
            const r = item.Allocation?.rate_per_hour ? Number(item.Allocation.rate_per_hour) : 0;
            return sum + (isB ? Number(item.hours) * r : 0);
        }, 0);

        return {
            month,
            year: Number(year),
            workingDays,
            daysPresent,
            daysAbsent,
            totalClasses,
            totalHours,
            totalEarnings: Number(totalBillableEarnings.toFixed(2)),
            data: attendance.map(flattenAttendance)
        };

    } catch (error) {
        throw error;
    }
};

// ==========================
// Attendance History (all-time)
// GET /api/attendance/history/:facultyId
// ==========================
const getAttendanceHistory = async (facultyId) => {
    try {
        const numericUserId = await resolveUserId(facultyId);

        const monthsYears = await Attendance.findAll({
            where: { user_id: numericUserId },
            attributes: ['month', 'year'],
            group: ['month', 'year']
        });

        for (const my of monthsYears) {
            await syncMonthlyBillableStatus(numericUserId, my.month, my.year);
        }

        const attendance = await Attendance.findAll({
            where: { user_id: numericUserId },
            include: allocationInclude,
            order: [["attendance_date", "DESC"]]
        });

        const totalHours = attendance.reduce((sum, item) => sum + Number(item.hours), 0);
        const totalClasses = attendance.length;
        const daysPresent = new Set(attendance.map(item => item.attendance_date)).size;

        const totalBillableEarnings = attendance.reduce((sum, item) => {
            const isB = item.is_billable ?? true;
            const r = item.Allocation?.rate_per_hour ? Number(item.Allocation.rate_per_hour) : 0;
            return sum + (isB ? Number(item.hours) * r : 0);
        }, 0);

        return {
            totalClasses,
            totalHours,
            daysPresent,
            totalEarnings: Number(totalBillableEarnings.toFixed(2)),
            data: attendance.map(flattenAttendance)
        };

    } catch (error) {
        throw error;
    }
};

// ==========================
// Admin: Get All Attendance (with filters)
// filters: { facultyId, month, year, status, attendance_period }
// GET /api/attendance/admin
// ==========================
const getAdminAttendance = async (filters = {}) => {
    try {
        const whereClause = {};

        if (filters.month) whereClause.month = filters.month;
        if (filters.year) whereClause.year = filters.year;
        if (filters.status) whereClause.status = filters.status;
        if (filters.attendance_period) whereClause.attendance_period = filters.attendance_period;

        if (filters.facultyId) {
            const numericUserId = await resolveUserId(filters.facultyId);
            whereClause.user_id = numericUserId;
        }

        const attendance = await Attendance.findAll({
            where: whereClause,
            include: [
                {
                    model: User,
                    attributes: ["user_id", "full_name", "email", "uvfin"]
                },
                ...allocationInclude
            ],
            order: [["attendance_date", "DESC"], ["start_time", "DESC"]]
        });

        return {
            totalRecords: attendance.length,
            data: attendance.map(flattenAttendance)
        };

    } catch (error) {
        throw error;
    }
};

// ==========================
// Admin: Verify / Update Attendance Status
// PATCH /api/attendance/verify/:attendanceId
// ==========================
const verifyAttendance = async (attendanceId, status, remarks) => {
    try {
        const attendance = await Attendance.findByPk(attendanceId);

        if (!attendance) {
            throw new Error("Attendance record not found.");
        }

        // All valid status values (admin verifies Marked → Present/Absent/Pending)
        const validStatuses = ['Present', 'Absent', 'Pending', 'Marked', 'Cancelled'];
        if (!validStatuses.includes(status)) {
            throw new Error(`Invalid status. Must be one of: ${validStatuses.join(', ')}.`);
        }

        await attendance.update({
            status,
            remarks: remarks !== undefined ? remarks : attendance.remarks
        });

        return attendance;

    } catch (error) {
        throw error;
    }
};

// ==========================
// Get Faculty Allocations (My Subjects)
// GET /api/attendance/my-allocations/:facultyId
// ==========================
const getFacultyAllocations = async (facultyId) => {
    try {
        const numericUserId = await resolveUserId(facultyId);

        const allocations = await Allocation.findAll({
            where: { user_id: numericUserId, is_active: true },
            include: [
                { model: Course, attributes: ["course_id", "course_name", "course_code"] },
                { model: Semester, attributes: ["semester_id", "semester_number"] },
                { model: Section, attributes: ["section_id", "section_name"] },
                { model: Subject, attributes: ["subject_id", "subject_code", "subject_name"] }
            ],
            order: [["allocation_id", "ASC"]]
        });

        const result = allocations.map(a => ({
            allocation_id: a.allocation_id,
            session_type: a.session_type,
            // rate_per_hour is ENUM string ('200'/'400'/'800') — return as Number
            rate_per_hour: Number(a.rate_per_hour),
            academic_year: a.academic_year,
            course_id: a.Course ? a.Course.course_id : null,
            course_name: a.Course ? a.Course.course_name : null,
            course_code: a.Course ? a.Course.course_code : null,
            semester_id: a.Semester ? a.Semester.semester_id : null,
            semester_number: a.Semester ? a.Semester.semester_number : null,
            section_id: a.Section ? a.Section.section_id : null,
            section_name: a.Section ? a.Section.section_name : null,
            subject_id: a.Subject ? a.Subject.subject_id : null,
            subject_code: a.Subject ? a.Subject.subject_code : null,
            subject_name: a.Subject ? a.Subject.subject_name : null
        }));

        return {
            faculty_id: numericUserId,
            total: result.length,
            allocations: result
        };

    } catch (error) {
        throw error;
    }
};

// ==========================
// Get Attendance By ID (strict)
// GET /api/attendance/record/:attendanceId
// ==========================
const getAttendanceByIdService = async (attendanceId) => {
    const record = await Attendance.findByPk(attendanceId, {
        include: [
            { model: User, attributes: ["user_id", "full_name", "email", "uvfin"] },
            {
                model: Allocation,
                attributes: ["allocation_id", "session_type", "rate_per_hour"],
                include: [
                    { model: Course, attributes: ["course_id", "course_name", "course_code"] },
                    { model: Semester, attributes: ["semester_id", "semester_number"] },
                    { model: Section, attributes: ["section_id", "section_name"] },
                    { model: Subject, attributes: ["subject_id", "subject_code", "subject_name"] }
                ]
            }
        ]
    });

    if (!record) return null;

    return {
        attendance_id: record.attendance_id,
        attendance_date: record.attendance_date,
        start_time: record.start_time,
        end_time: record.end_time,
        hours: Number(record.hours),
        status: record.status,
        remarks: record.remarks,
        month: record.month,
        year: record.year,
        attendance_period: record.attendance_period,
        week_number: record.week_number,

        // User
        user_id: record.User ? record.User.user_id : null,
        full_name: record.User ? record.User.full_name : null,
        email: record.User ? record.User.email : null,
        uvfin: record.User ? record.User.uvfin : null,

        // Allocation
        // rate_per_hour is ENUM string ('200'/'400'/'800') — cast to Number
        allocation_id: record.Allocation ? record.Allocation.allocation_id : null,
        session_type: record.Allocation ? record.Allocation.session_type : null,
        rate_per_hour: record.Allocation ? Number(record.Allocation.rate_per_hour) : null,

        // Course
        course_id: record.Allocation?.Course ? record.Allocation.Course.course_id : null,
        course_name: record.Allocation?.Course ? record.Allocation.Course.course_name : null,
        course_code: record.Allocation?.Course ? record.Allocation.Course.course_code : null,

        // Semester
        semester_id: record.Allocation?.Semester ? record.Allocation.Semester.semester_id : null,
        semester_number: record.Allocation?.Semester ? record.Allocation.Semester.semester_number : null,

        // Section
        section_id: record.Allocation?.Section ? record.Allocation.Section.section_id : null,
        section_name: record.Allocation?.Section ? record.Allocation.Section.section_name : null,

        // Subject
        subject_id: record.Allocation?.Subject ? record.Allocation.Subject.subject_id : null,
        subject_code: record.Allocation?.Subject ? record.Allocation.Subject.subject_code : null,
        subject_name: record.Allocation?.Subject ? record.Allocation.Subject.subject_name : null
    };
};

// ============================================================
// ■  DELETE: Remove a SINGLE attendance record by attendance_id
//    Example: delete attendance_id = 23 but keep 24 and 26
//    Returns the deleted row's data for frontend confirmation.
// ============================================================
const deleteAttendanceById = async (attendanceId) => {
    // 1. Find the record first (so we can return its data)
    const record = await Attendance.findByPk(attendanceId);

    if (!record) {
        throw new Error(`Attendance record with id=${attendanceId} not found.`);
    }

    const { user_id, month, year } = record;

    // 2. Delete only THIS specific row
    await record.destroy();

    // 3. Sync billable status after deletion
    await syncMonthlyBillableStatus(user_id, month, year);

    // 4. Return the deleted record's key info
    return {
        attendance_id: record.attendance_id,
        attendance_date: record.attendance_date,
        user_id: record.user_id,
        allocation_id: record.allocation_id,
        hours: Number(record.hours),
        status: record.status,
        month: record.month,
        year: record.year
    };
};

// ============================================================
// ■  DELETE: Remove attendance records by Faculty ID
//    Accepts numeric user_id OR uvfin string.
//    Optional filters: attendance_period, month, year, attendance_date
//    Returns count of deleted rows.
// ============================================================
const deleteAttendanceByFaculty = async (facultyId, filters = {}) => {
    // 1. Resolve to numeric user_id (throws 'Faculty not found' if invalid)
    const userId = await resolveUserId(facultyId);

    // 2. Build WHERE clause
    const where = { user_id: userId };

    if (filters.attendance_period) {
        const allowed = ['daily', 'weekly', 'monthly'];
        if (!allowed.includes(filters.attendance_period)) {
            throw new Error(
                `Invalid attendance_period. Allowed values: ${allowed.join(', ')}`
            );
        }
        where.attendance_period = filters.attendance_period;
    }

    if (filters.month) {
        where.month = filters.month;
    }

    if (filters.year) {
        where.year = Number(filters.year);
    }

    if (filters.attendance_date) {
        where.attendance_date = filters.attendance_date;
    }

    // 3. Delete matching rows
    const deletedCount = await Attendance.destroy({ where });

    // 4. Re-sync billable status after bulk delete
    if (filters.month && filters.year) {
        await syncMonthlyBillableStatus(userId, filters.month, filters.year);
    } else {
        const remainingMonthsYears = await Attendance.findAll({
            where: { user_id: userId },
            attributes: ['month', 'year'],
            group: ['month', 'year']
        });
        for (const my of remainingMonthsYears) {
            await syncMonthlyBillableStatus(userId, my.month, my.year);
        }
    }

    return {
        user_id: userId,
        faculty_id: facultyId,
        deletedCount,
        filters
    };
};

module.exports = {
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
    deleteAttendanceById,       // single record delete by attendance_id
    deleteAttendanceByFaculty,  // bulk delete by faculty + optional filters
    // expose helpers for tests
    getISOWeekNumber,
    getWeekBounds
};