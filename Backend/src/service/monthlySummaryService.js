const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");

const {
    sequelize,
    User,
    Course,
    Semester,
    Section,
    Subject,
    Allocation,
    Attendance,
    Bill,
    BillDetail
} = require("../Schema");

// =================================================================
// Helper — resolve courseId → course_name
// =================================================================
const resolveCourse = async (courseId) => {
    const course = await Course.findByPk(courseId);
    if (!course) throw new Error(`Course not found for ID: ${courseId}`);
    return course;
};

// =================================================================
// Core aggregation logic — DIRECTLY FROM LIVE ATTENDANCE RECORDS
// Live calculations ensure Super Admin immediately sees every faculty's
// updated bill/earnings as soon as attendance is submitted, without needing
// any manual action from Program Incharge.
// =================================================================
const aggregateSummary = async ({ month, year, courseId }) => {

    let course = null;
    let courseWhere = {};

    if (courseId) {
        course = await resolveCourse(courseId);
        courseWhere = { course_id: course.course_id };
    }

    // Query all attendance records for this month + year
    const attendanceRecords = await Attendance.findAll({
        where: {
            month,
            year: Number(year),
            status: { [require("sequelize").Op.ne]: "Cancelled" }
        },
        include: [
            {
                model: User,
                attributes: ["user_id", "full_name", "uvfin"]
            },
            {
                model: Allocation,
                where: Object.keys(courseWhere).length > 0 ? courseWhere : undefined,
                include: [
                    { model: Course, attributes: ["course_id", "course_name", "course_code"] },
                    { model: Semester, attributes: ["semester_id", "semester_number"] },
                    { model: Section, attributes: ["section_id", "section_name"] },
                    { model: Subject, attributes: ["subject_id", "subject_code", "subject_name"] }
                ]
            }
        ],
        order: [["attendance_date", "ASC"], ["start_time", "ASC"]]
    });

    const semesterMap = {};
    const facultySet = new Set();
    let grandTotal = 0;
    let grandTotalHours = 0;
    const courseName = course ? course.course_name : null;

    for (const record of attendanceRecords) {
        const user = record.User;
        const alloc = record.Allocation;
        if (!alloc) continue;

        const facultyId   = record.user_id;
        const facultyName = user ? user.full_name : "Unknown";
        const uvfin       = user ? (user.uvfin || "") : "";
        facultySet.add(facultyId);

        const detailCourseName = alloc.Course?.course_name || (course ? course.course_name : "General");
        const semKey           = alloc.Semester?.semester_number || 1;
        const hours            = Number(record.hours || 0);
        const rate             = alloc.rate_per_hour != null ? Number(alloc.rate_per_hour) : 0;
        
        // If is_billable is false (exceeded 30k cap), billable amount is 0
        const isBillable       = record.is_billable !== false;
        const amount           = isBillable ? Number((hours * rate).toFixed(2)) : 0;

        if (!semesterMap[semKey]) semesterMap[semKey] = {};

        const facKey = `${facultyId}__${detailCourseName}`;
        if (!semesterMap[semKey][facKey]) {
            semesterMap[semKey][facKey] = {
                faculty_id:   facultyId,
                faculty_name: facultyName,
                uvfin:        uvfin,
                course_name:  detailCourseName,
                total_amount: 0,
                total_hours:  0
            };
        }

        semesterMap[semKey][facKey].total_amount += amount;
        semesterMap[semKey][facKey].total_hours  += hours;
        grandTotal      += amount;
        grandTotalHours += hours;
    }

    const semesters = Object.keys(semesterMap)
        .map(Number)
        .sort((a, b) => a - b)
        .map(semNum => {
            const faculties = Object.values(semesterMap[semNum]);
            const semesterTotal = faculties.reduce((s, f) => s + f.total_amount, 0);
            return {
                semester_number: semNum,
                faculties: faculties.map(f => ({
                    ...f,
                    total_amount: Number(f.total_amount.toFixed(2)),
                    total_hours:  Number(f.total_hours.toFixed(2))
                })),
                semester_total: Number(semesterTotal.toFixed(2))
            };
        });

    return {
        month,
        year: Number(year),
        course,
        courseName,
        semesters,
        grandTotal:      Number(grandTotal.toFixed(2)),
        grandTotalHours: Number(grandTotalHours.toFixed(2)),
        totalFaculties:  facultySet.size
    };
};

// =================================================================
// getMonthlySummary — single course JSON
// =================================================================
const getMonthlySummary = async (month, year, courseId) => {
    if (!month || !year) throw new Error("month and year are required.");
    return await aggregateSummary({ month, year, courseId: courseId || null });
};

// =================================================================
// getAllCoursesMonthlySummary — all courses grouped
// =================================================================
const getAllCoursesMonthlySummary = async (month, year) => {
    if (!month || !year) throw new Error("month and year are required.");
    const courses = await Course.findAll({ where: { is_active: true } });
    const results = await Promise.all(
        courses.map(c => aggregateSummary({ month, year, courseId: c.course_id }))
    );
    const grandTotal = results.reduce((s, r) => s + r.grandTotal, 0);
    return {
        month,
        year: Number(year),
        courses: results.filter(r => r.semesters.length > 0),
        grandTotal: Number(grandTotal.toFixed(2))
    };
};

// =================================================================
// generateMonthlySummaryPDF — Super Admin format
//
// Matches the official document:
//   INTERNATIONAL INSTITUTE OF PROFESSIONAL STUDIES
//   DEVI AHILYA UNIVERSITY, INDORE
//   Visiting Faculty Payment
//   Monthly Summary
//
//   Month: July                          Year: 2026
//   +---------+---------+--------------------+--------------+
//   |  S.No.  |  UVFIN  |  Name of Faculty  | Total Amount |
//   +---------+---------+--------------------+--------------+
//   |   1.    |         |  Mr. Prakshep...   |    5600      |
//   |  ...    |  ...    |      ...           |    ...       |
//   +---------+---------+--------------------+--------------+
//   |              Grand Total              |   74,300      |
//   +---------------------------------------+--------------+
//
//   Program Incharge   Program Incharge   Program Incharge
//   MBA (MS) 5 yrs     MBA (MS) 2 yrs     MBA (T) 5 yrs
//   ...
//   Director
// =================================================================
const generateMonthlySummaryPDF = async (month, year) => {
    return new Promise(async (resolve, reject) => {
        try {
            if (!month || !year) throw new Error("month and year are required.");

            // 1. Fetch live attendance records for the month
            const attendanceRecords = await Attendance.findAll({
                where: {
                    month,
                    year: Number(year),
                    status: { [require("sequelize").Op.ne]: "Cancelled" }
                },
                include: [
                    { model: User, attributes: ["user_id", "full_name", "uvfin"] },
                    { model: Allocation, attributes: ["rate_per_hour"] }
                ],
                order: [["attendance_date", "ASC"]]
            });

            // Group by faculty
            const facultyMap = new Map();
            for (const record of attendanceRecords) {
                const uid = record.user_id;
                const hours = Number(record.hours || 0);
                const rate = record.Allocation?.rate_per_hour ? Number(record.Allocation.rate_per_hour) : 0;
                const isBillable = record.is_billable !== false;
                const amount = isBillable ? Number((hours * rate).toFixed(2)) : 0;

                if (!facultyMap.has(uid)) {
                    facultyMap.set(uid, {
                        uvfin: record.User?.uvfin || "",
                        faculty_name: record.User?.full_name || "Unknown",
                        total_amount: 0
                    });
                }
                facultyMap.get(uid).total_amount += amount;
            }

            // 2. Build sorted rows
            const rows = Array.from(facultyMap.values())
                .sort((a, b) => b.total_amount - a.total_amount)
                .map((fac, idx) => ({
                    sno:          idx + 1,
                    uvfin:        fac.uvfin,
                    faculty_name: fac.faculty_name,
                    total_amount: Number(fac.total_amount.toFixed(2))
                }));

            const grandTotal = rows.reduce((s, r) => s + r.total_amount, 0);

            // 3. Fetch all active courses for signature blocks
            const allCourses = await Course.findAll({
                where: { is_active: true },
                order: [["course_id", "ASC"]]
            });

            // 4. PDF setup
            const doc = new PDFDocument({ margin: 50, size: "A4" });

            const uploadDir = path.join(__dirname, "../uploads/summaries");
            if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

            const fileName = `monthly-summary-${month}-${year}.pdf`;
            const pdfPath  = path.join(uploadDir, fileName);
            const stream   = fs.createWriteStream(pdfPath);

            stream.on("finish", () => resolve(pdfPath));
            stream.on("error", reject);
            doc.on("error", reject);
            doc.pipe(stream);

            const PAGE_W = 595.28;
            const MARGIN = 50;
            const USABLE = PAGE_W - MARGIN * 2;

            // 5. HEADER
            doc.font("Helvetica-Bold").fontSize(13)
               .text("INTERNATIONAL INSTITUTE OF PROFESSIONAL STUDIES",
                     MARGIN, 50, { width: USABLE, align: "center" });

            doc.font("Helvetica-Bold").fontSize(11)
               .text("DEVI AHILYA UNIVERSITY, INDORE",
                     MARGIN, doc.y + 3, { width: USABLE, align: "center" });

            doc.moveDown(0.6);

            doc.font("Helvetica-Bold").fontSize(11)
               .text("Visiting Faculty Payment",
                     MARGIN, doc.y, { width: USABLE, align: "center" });

            doc.font("Helvetica-Bold").fontSize(11)
               .text("Monthly Summary",
                     MARGIN, doc.y + 2, { width: USABLE, align: "center" });

            doc.moveDown(0.8);

            // 6. Month / Year line
            const topY = doc.y;
            doc.font("Helvetica-Bold").fontSize(10)
               .text(`Month: ${month}`, MARGIN, topY);
            doc.font("Helvetica-Bold").fontSize(10)
               .text(`Year: ${year}`, MARGIN + USABLE - 80, topY);

            doc.moveDown(0.6);

            // 7. TABLE
            const COL_SNO   = 40;
            const COL_UVFIN = 70;
            const COL_AMT   = 90;
            const COL_NAME  = USABLE - COL_SNO - COL_UVFIN - COL_AMT;
            const ROW_H     = 20;

            let curY = doc.y;

            const drawTableHeader = (y) => {
                doc.rect(MARGIN, y, USABLE, ROW_H)
                   .fillAndStroke("#f0f0f0", "black");

                doc.fillColor("black").font("Helvetica-Bold").fontSize(9);
                doc.text("S. No.",
                         MARGIN + 4, y + 5,
                         { width: COL_SNO - 8, align: "center" });
                doc.text("UVFIN",
                         MARGIN + COL_SNO + 4, y + 5,
                         { width: COL_UVFIN - 8, align: "center" });
                doc.text("Name of Faculty",
                         MARGIN + COL_SNO + COL_UVFIN + 4, y + 5,
                         { width: COL_NAME - 8, align: "center" });
                doc.text("Total Amount",
                         MARGIN + COL_SNO + COL_UVFIN + COL_NAME + 4, y + 5,
                         { width: COL_AMT - 8, align: "center" });
            };

            drawTableHeader(curY);
            curY += ROW_H;

            for (const row of rows) {
                if (curY + ROW_H > 750) {
                    doc.addPage();
                    curY = 50;
                    drawTableHeader(curY);
                    curY += ROW_H;
                }

                doc.rect(MARGIN, curY, COL_SNO, ROW_H).stroke();
                doc.rect(MARGIN + COL_SNO, curY, COL_UVFIN, ROW_H).stroke();
                doc.rect(MARGIN + COL_SNO + COL_UVFIN, curY, COL_NAME, ROW_H).stroke();
                doc.rect(MARGIN + COL_SNO + COL_UVFIN + COL_NAME, curY, COL_AMT, ROW_H).stroke();

                doc.font("Helvetica").fontSize(9).fillColor("black");
                doc.text(`${row.sno}.`,
                         MARGIN + 4, curY + 5,
                         { width: COL_SNO - 8, align: "center" });
                doc.text(row.uvfin,
                         MARGIN + COL_SNO + 4, curY + 5,
                         { width: COL_UVFIN - 8, align: "center" });
                doc.text(row.faculty_name,
                         MARGIN + COL_SNO + COL_UVFIN + 4, curY + 5,
                         { width: COL_NAME - 8 });
                doc.text(row.total_amount.toLocaleString("en-IN"),
                         MARGIN + COL_SNO + COL_UVFIN + COL_NAME + 4, curY + 5,
                         { width: COL_AMT - 8, align: "right" });

                curY += ROW_H;
            }

            // Grand Total row
            if (curY + ROW_H + 4 > 750) { doc.addPage(); curY = 50; }

            const GT_H = ROW_H + 2;
            doc.rect(MARGIN, curY, COL_SNO + COL_UVFIN + COL_NAME, GT_H).stroke();
            doc.rect(MARGIN + COL_SNO + COL_UVFIN + COL_NAME, curY, COL_AMT, GT_H).stroke();

            doc.font("Helvetica-Bold").fontSize(10).fillColor("black")
               .text("Grand Total",
                     MARGIN + 4, curY + 6,
                     { width: COL_SNO + COL_UVFIN + COL_NAME - 8, align: "center" });

            doc.font("Helvetica-Bold").fontSize(10)
               .text(grandTotal.toLocaleString("en-IN"),
                     MARGIN + COL_SNO + COL_UVFIN + COL_NAME + 4, curY + 6,
                     { width: COL_AMT - 8, align: "right" });

            curY += GT_H + 40;

            // 8. Program Incharge blocks — 3 per row
            const SIG_COL_W = USABLE / 3;

            for (let i = 0; i < allCourses.length; i += 3) {
                if (curY + 55 > 780) { doc.addPage(); curY = 50; }

                const chunk = allCourses.slice(i, i + 3);

                chunk.forEach((course, j) => {
                    const x = MARGIN + j * SIG_COL_W;
                    doc.font("Helvetica-Bold").fontSize(10).fillColor("black")
                       .text("Program Incharge", x, curY, { width: SIG_COL_W - 10 });
                    doc.font("Helvetica").fontSize(9)
                       .text(course.course_name, x, curY + 14, { width: SIG_COL_W - 10 });
                });

                curY += 55;
            }

            // 9. Director signature
            if (curY + 30 > 780) { doc.addPage(); curY = 50; }
            curY += 10;
            doc.font("Helvetica-Bold").fontSize(10).fillColor("black")
               .text("Director", MARGIN, curY);

            doc.end();

        } catch (err) {
            reject(err);
        }
    });
};

// =================================================================
// Download Summary PDF (per-course — kept for backward compat)
// =================================================================
const downloadMonthlySummaryPDF = async (month, year, courseId) => {
    const summaryData = await getMonthlySummary(month, year, courseId);
    if (summaryData.semesters.length === 0) {
        throw new Error("No bill data found for this month/year/course combination.");
    }
    return await _legacyGenerateSummaryPDF(summaryData);
};

// =================================================================
// Legacy per-course PDF
// =================================================================
const _legacyGenerateSummaryPDF = (summaryData) => {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({ margin: 40, size: "A4" });
            const uploadDir = path.join(__dirname, "../uploads/summaries");
            if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

            const safeMonth  = summaryData.month.replace(/\s/g, "_");
            const safeCourse = (summaryData.courseName || "all")
                .replace(/[^a-z0-9]/gi, "_").toLowerCase();
            const fileName = `summary-${safeCourse}-${safeMonth}-${summaryData.year}.pdf`;
            const pdfPath  = path.join(uploadDir, fileName);
            const stream   = fs.createWriteStream(pdfPath);

            stream.on("finish", () => resolve(pdfPath));
            stream.on("error", reject);
            doc.on("error", reject);
            doc.pipe(stream);

            const PAGE_WIDTH = 595.28;
            const MARGIN     = 60;
            const USABLE_W   = PAGE_WIDTH - MARGIN * 2;
            const COL_NAME_W = USABLE_W - 120;
            const COL_AMT_W  = 120;

            doc.font("Helvetica-Bold").fontSize(12)
               .text("International Institute of Professional Studies",
                     MARGIN, 50, { width: USABLE_W, align: "center" });
            doc.font("Helvetica-Bold").fontSize(11)
               .text("Devi Ahilya Vishwavidyalaya, Indore",
                     MARGIN, doc.y + 2, { width: USABLE_W, align: "center" });
            doc.font("Helvetica-Bold").fontSize(11)
               .text("Summary Report", MARGIN, doc.y + 4,
                     { width: USABLE_W, align: "center", underline: true });
            doc.moveDown(1);

            doc.font("Helvetica-Bold").fontSize(10)
               .text(`Month & Year: ${summaryData.month}, ${summaryData.year}`, MARGIN, doc.y);
            if (summaryData.courseName) {
                doc.font("Helvetica-Bold").fontSize(10)
                   .text(`Program Name: ${summaryData.courseName}`, MARGIN, doc.y + 4);
            }
            doc.moveDown(1);

            const headerY = doc.y;
            doc.rect(MARGIN, headerY, COL_NAME_W, 20).stroke();
            doc.rect(MARGIN + COL_NAME_W, headerY, COL_AMT_W, 20).stroke();
            doc.font("Helvetica-Bold").fontSize(10)
               .text("Faculty / Semester", MARGIN + 4, headerY + 5, { width: COL_NAME_W - 8 });
            doc.font("Helvetica-Bold").fontSize(10)
               .text("Amount", MARGIN + COL_NAME_W + 4, headerY + 5,
                     { width: COL_AMT_W - 8, align: "right" });

            let currentY = headerY + 20;

            for (const sem of summaryData.semesters) {
                if (currentY + 22 > 750) { doc.addPage(); currentY = 50; }
                doc.rect(MARGIN, currentY, COL_NAME_W + COL_AMT_W, 20).stroke();
                doc.font("Helvetica-Bold").fontSize(10)
                   .text(`Semester ${sem.semester_number}`, MARGIN + 4, currentY + 5,
                         { width: COL_NAME_W + COL_AMT_W - 8 });
                currentY += 20;

                for (const fac of sem.faculties) {
                    if (currentY + 18 > 750) { doc.addPage(); currentY = 50; }
                    doc.rect(MARGIN, currentY, COL_NAME_W, 18).stroke();
                    doc.rect(MARGIN + COL_NAME_W, currentY, COL_AMT_W, 18).stroke();
                    doc.font("Helvetica").fontSize(10)
                       .text(fac.faculty_name, MARGIN + 4, currentY + 4, { width: COL_NAME_W - 8 });
                    doc.font("Helvetica").fontSize(10)
                       .text(String(fac.total_amount), MARGIN + COL_NAME_W + 4, currentY + 4,
                             { width: COL_AMT_W - 8, align: "right" });
                    currentY += 18;
                }
            }

            if (currentY + 22 > 750) { doc.addPage(); currentY = 50; }
            doc.moveTo(MARGIN, currentY).lineTo(MARGIN + USABLE_W, currentY).stroke();
            currentY += 8;
            doc.rect(MARGIN, currentY, COL_NAME_W, 22).stroke();
            doc.rect(MARGIN + COL_NAME_W, currentY, COL_AMT_W, 22).stroke();
            doc.font("Helvetica-Bold").fontSize(11)
               .text("Total", MARGIN + 4, currentY + 5,
                     { width: COL_NAME_W - 8, align: "center" });
            doc.font("Helvetica-Bold").fontSize(11)
               .text(String(summaryData.grandTotal), MARGIN + COL_NAME_W + 4, currentY + 5,
                     { width: COL_AMT_W - 8, align: "right" });
            currentY += 22 + 40;

            if (summaryData.course && summaryData.course.program_incharge) {
                doc.font("Helvetica-Bold").fontSize(10)
                   .text(summaryData.course.program_incharge, MARGIN, currentY);
                currentY += 16;
                doc.font("Helvetica-Bold").fontSize(10).text("Program In-charge", MARGIN, currentY);
                currentY += 14;
                doc.font("Helvetica-Bold").fontSize(10)
                   .text(summaryData.courseName || "", MARGIN, currentY);
            }

            doc.end();
        } catch (err) {
            reject(err);
        }
    });
};

module.exports = {
    getMonthlySummary,
    getAllCoursesMonthlySummary,
    downloadMonthlySummaryPDF,
    generateMonthlySummaryPDF   // NEW — super admin format
};
