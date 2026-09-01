const { generateBillPDF } = require("../utils/pdfGenerator");
const {
    sequelize,
    User,
    Attendance,
    Allocation,
    Course,
    Semester,
    Section,
    Subject,
    Bill,
    BillDetail
} = require("../Schema");

const { toWords } = require("number-to-words");

const resolveUserId = async (facultyId) => {
    // If facultyId looks like a numeric primary key, resolve it directly.
    if (!isNaN(facultyId)) {
        const userByPk = await User.findByPk(Number(facultyId));
        if (userByPk) return userByPk.user_id;
    }
    // Otherwise treat it as the external UVFIN identifier.
    const user = await User.findOne({ where: { uvfin: facultyId } });
    if (user) return user.user_id;
    throw new Error(`Faculty user not found for ID: ${facultyId}`);
};

// ==========================================================
// Generate Bill
// ==========================================================
// `extraDetails` is optional — pass any of these from the controller/req.body
// if you want them printed on the PDF (Department, Page No., S.No., TDS %,
// Date of Submission). If your Bill model doesn't have these columns yet,
// Sequelize just ignores the extra keys — nothing breaks either way.
//
// extraDetails = {
//   department, attendancePageNo, serialNo, tdsPercent, submissionDate
// }
const generateBill = async (facultyId, month, year, extraDetails = {}) => {

    if (!facultyId || !month || !year) {
        throw new Error("Missing required fields");
    }

    const numericUserId = await resolveUserId(facultyId);

    let transaction;

    try {

        transaction = await sequelize.transaction();

        // ==========================
        // Check Duplicate Bill
        // ==========================
        const existingBill = await Bill.findOne({
            where: {
                user_id: numericUserId,
                month,
                year
            },
            transaction
        });

        if (existingBill) {
            throw new Error("Bill already generated for this month.");
        }

        const { Op } = require("sequelize");

        // ==========================
        // Fetch Attendance
        // ==========================
        const attendanceRecords = await Attendance.findAll({

            where: {
                user_id: numericUserId,
                [Op.and]: [
                    sequelize.where(
                        sequelize.fn('LOWER', sequelize.col('Attendance.month')),
                        String(month).trim().toLowerCase()
                    ),
                    { year: Number(year) },
                    { status: { [Op.ne]: "Cancelled" } }
                ]
            },

            include: [
                {
                    model: Allocation,
                    include: [
                        User,
                        Course,
                        Semester,
                        Section,
                        Subject
                    ]
                }
            ],

            order: [["attendance_date", "ASC"], ["start_time", "ASC"]],

            transaction

        });

        if (attendanceRecords.length === 0) {
            throw new Error("No attendance found for this month.");
        }

        let totalHours = 0;
        let totalAmount = 0;

        const billDetails = [];

        // ==========================
        // ₹30,000 Bill Cap Logic
        // ==========================
        // Faculty CAN always mark attendance freely.
        // However, a single bill must not exceed ₹30,000.
        // We include attendance rows one by one (sorted by date) until
        // the running total would cross ₹30,000 — then we stop adding.
        // Rows beyond the cap are NOT deleted; they remain in the DB
        // and can be billed in the next month's bill.
        const BILL_CAP = 30000;
        let capReached = false;
        let skippedRows = 0;

        // Separate rows into billable and capped
        const billableRows = [];
        const cappedRows   = [];

        for (const attendance of attendanceRecords) {

            const hours  = Number(attendance.hours);
            const rate   = Number(attendance.Allocation.rate_per_hour);
            const amount = hours * rate;

            // If adding this row would exceed the ₹30,000 cap, mark it non-billable
            if (totalAmount + amount > BILL_CAP) {
                capReached = true;
                skippedRows++;
                cappedRows.push(attendance); // collect for DB update
                continue;
            }

            totalHours  += hours;
            totalAmount += amount;
            billableRows.push(attendance);

            billDetails.push({

                attendance_date: attendance.attendance_date,

                course_name:
                    attendance.Allocation.Course.course_name,

                semester_number:
                    attendance.Allocation.Semester.semester_number,

                section_name:
                    attendance.Allocation.Section
                        ? attendance.Allocation.Section.section_name
                        : null,

                subject_code:
                    attendance.Allocation.Subject.subject_code,

                subject_name:
                    attendance.Allocation.Subject.subject_name,

                hours,

                rate_per_hour: rate,

                amount

            });

        }

        // ── Stamp capped rows as is_billable = false in the DB ────────────────
        // This lets the attendance history show these sessions with ₹0 rate.
        // They are NOT deleted — they remain visible in the faculty's history.
        if (cappedRows.length > 0) {
            const cappedIds = cappedRows.map(a => a.attendance_id);
            await Attendance.update(
                { is_billable: false },
                { where: { attendance_id: cappedIds }, transaction }
            );
        }

        if (billDetails.length === 0) {
            throw new Error(
                "No attendance rows could be billed. All sessions exceed the ₹30,000 cap."
            );
        }

        // ==========================
        // Amount In Words
        // ==========================
        const amountInWords =
            `${toWords(Math.round(totalAmount))} Rupees Only`;

        // ==========================
        // Create Bill
        // ==========================
        const bill = await Bill.create({

            user_id: numericUserId,

            month,
            year,

            total_hours: totalHours,

            total_amount: totalAmount,

            amount_in_words: amountInWords,

            bill_date: new Date(),

            pdf_path: null,

            // ---- Optional Annexure-IV fields (ignored by Sequelize if the
            // ---- Bill model doesn't define these columns) ----
            department: extraDetails.department,

            attendance_page_no: extraDetails.attendancePageNo,

            serial_no: extraDetails.serialNo,

            tds_percent: extraDetails.tdsPercent,

            submission_date: extraDetails.submissionDate || new Date()

        }, {
            transaction
        });

        // ==========================
        // Create Bill Details
        // ==========================
        const finalBillDetails = billDetails.map(detail => ({

            ...detail,

            bill_id: bill.bill_id

        }));

        await BillDetail.bulkCreate(
            finalBillDetails,
            {
                transaction
            }
        );

        // ==========================
        // Faculty details for the PDF header/footer
        // ==========================
        try {
            const faculty = attendanceRecords[0]?.Allocation?.User || (await User.findByPk(numericUserId));
            const pdfPath = await generateBillPDF(
                bill,
                finalBillDetails,
                faculty
            );
            await bill.update(
                {
                    pdf_path: pdfPath
                },
                {
                    transaction
                }
            );
        } catch (pdfErr) {
            console.warn(`[generateBill] PDF generation deferred: ${pdfErr.message}`);
        }

        // ==========================
        // Commit Transaction
        // ==========================
        await transaction.commit();

        return {

            success: true,

            message: capReached
                ? `Bill generated with ₹30,000 cap applied. ${skippedRows} attendance session(s) were excluded from this bill.`
                : "Bill generated successfully.",

            capReached,

            skippedRows,

            billId: bill.bill_id,

            totalHours,

            totalAmount,

            amountInWords,

            billDetails: finalBillDetails

        };

    } catch (error) {

        if (transaction) {
            await transaction.rollback();
        }

        throw error;

    }

};

// ==========================================================
// Get Bill Details (single bill + line items)
// ==========================================================
const getBillDetails = async (billId) => {

    const bill = await Bill.findByPk(billId, {
        include: [
            {
                model: BillDetail
            }
        ]
    });

    if (!bill) {
        throw new Error("Bill Not Found");
    }

    return bill;
};

// ==========================================================
// Get Bill History (per faculty) — includes faculty info
// ==========================================================
const getBillHistory = async (facultyId) => {

    const numericUserId = await resolveUserId(facultyId);
    const { Op } = require("sequelize");

    const bills = await Bill.findAll({
        where: {
            user_id: numericUserId
        },
        include: [
            {
                model: User,
                attributes: [
                    "user_id",
                    "full_name",
                    "email",
                    "uvfin",
                    "phone_number"
                ]
            },
            {
                model: BillDetail
            }
        ],
        order: [
            ["generated_at", "DESC"]
        ]
    });

    // Dynamic sync of bill total and hours with live attendance records
    for (const b of bills) {
        try {
            const attendanceRecords = await Attendance.findAll({
                where: {
                    user_id: b.user_id,
                    [Op.and]: [
                        sequelize.where(
                            sequelize.fn('LOWER', sequelize.col('Attendance.month')),
                            String(b.month).trim().toLowerCase()
                        ),
                        { year: Number(b.year) },
                        { status: { [Op.ne]: "Cancelled" } }
                    ]
                },
                include: [{ model: Allocation, attributes: ["rate_per_hour"] }]
            });

            if (attendanceRecords.length > 0) {
                let liveTotal = 0;
                let liveHours = 0;
                const BILL_CAP = 30000;

                for (const att of attendanceRecords) {
                    const hours = Number(att.hours || 0);
                    const rate = att.Allocation?.rate_per_hour ? Number(att.Allocation.rate_per_hour) : 0;
                    const isBillable = att.is_billable !== false;
                    const amount = isBillable ? Number((hours * rate).toFixed(2)) : 0;

                    if (liveTotal + amount <= BILL_CAP) {
                        liveTotal += amount;
                        liveHours += hours;
                    }
                }

                liveTotal = Number(liveTotal.toFixed(2));
                liveHours = Number(liveHours.toFixed(2));

                if (Number(b.total_amount) !== liveTotal || Number(b.total_hours) !== liveHours) {
                    await b.update({ total_amount: liveTotal, total_hours: liveHours });
                    b.total_amount = liveTotal;
                    b.total_hours = liveHours;
                }
            }
        } catch (syncErr) {
            console.error(`[getBillHistory] sync error for bill ${b.bill_id}:`, syncErr.message);
        }
    }

    return bills;
};

// ==========================================================
// Get Bill Summary (stats for a faculty)
// ==========================================================
const getBillSummary = async (facultyId) => {

    const numericUserId = await resolveUserId(facultyId);

    const faculty = await User.findByPk(numericUserId, {
        attributes: ["user_id", "full_name", "email", "uvfin", "phone_number", "qualification"]
    });

    if (!faculty) {
        throw new Error(`Faculty not found for ID: ${facultyId}`);
    }

    const bills = await Bill.findAll({
        where: { user_id: numericUserId },
        order: [["generated_at", "DESC"]]
    });

    const totalBills   = bills.length;
    const totalAmount  = bills.reduce((sum, b) => sum + Number(b.total_amount), 0);
    const totalHours   = bills.reduce((sum, b) => sum + Number(b.total_hours),  0);

    // Months for which bills exist
    const billedMonths = bills.map(b => ({ month: b.month, year: b.year, billId: b.bill_id }));

    return {
        faculty,
        totalBills,
        totalAmount: Number(totalAmount.toFixed(2)),
        totalHours:  Number(totalHours.toFixed(2)),
        billedMonths,
        bills
    };
};

// ==========================================================
// Get Bills By Month (admin view — filter by month + year)
// ==========================================================
const getBillsByMonth = async (month, year) => {

    if (!month || !year) {
        throw new Error("Month and Year are required.");
    }

    const bills = await Bill.findAll({
        where: { month, year },
        include: [
            {
                model: User,
                attributes: [
                    "user_id",
                    "full_name",
                    "email",
                    "uvfin",
                    "phone_number"
                ]
            },
            {
                model: BillDetail
            }
        ],
        order: [["generated_at", "DESC"]]
    });

    const totalAmount = bills.reduce((sum, b) => sum + Number(b.total_amount), 0);
    const totalHours  = bills.reduce((sum, b) => sum + Number(b.total_hours),  0);

    return {
        month,
        year,
        count: bills.length,
        totalAmount: Number(totalAmount.toFixed(2)),
        totalHours:  Number(totalHours.toFixed(2)),
        bills
    };
};

// ==========================================================
// Regenerate Bill PDF (for an existing bill)
// ==========================================================
const regenerateBillPDF = async (billId) => {

    const bill = await Bill.findByPk(billId, {
        include: [{ model: BillDetail }]
    });

    if (!bill) {
        throw new Error("Bill not found.");
    }

    const faculty = await User.findByPk(bill.user_id);

    if (!faculty) {
        throw new Error("Faculty not found for this bill.");
    }

    const finalBillDetails = bill.BillDetails.map(d => d.dataValues);

    const pdfPath = await generateBillPDF(bill, finalBillDetails, faculty);

    await bill.update({ pdf_path: pdfPath });

    return {
        success:  true,
        message:  "Bill PDF regenerated successfully.",
        billId:   bill.bill_id,
        pdf_path: pdfPath
    };
};

// ==========================================================
// Get All Bills (admin view)
// ==========================================================
const getAllBills = async () => {
    const { Op } = require("sequelize");
    const bills = await Bill.findAll({
        include: [
            {
                model: User,
                attributes: [
                    "user_id",
                    "full_name",
                    "email"
                ]
            }
        ],
        order: [
            ["generated_at", "DESC"]
        ]
    });

    // Dynamic sync of bill total and hours with live attendance records
    for (const b of bills) {
        try {
            const attendanceRecords = await Attendance.findAll({
                where: {
                    user_id: b.user_id,
                    [Op.and]: [
                        sequelize.where(
                            sequelize.fn('LOWER', sequelize.col('Attendance.month')),
                            String(b.month).trim().toLowerCase()
                        ),
                        { year: Number(b.year) },
                        { status: { [Op.ne]: "Cancelled" } }
                    ]
                },
                include: [{ model: Allocation, attributes: ["rate_per_hour"] }]
            });

            if (attendanceRecords.length > 0) {
                let liveTotal = 0;
                let liveHours = 0;
                const BILL_CAP = 30000;

                for (const att of attendanceRecords) {
                    const hours = Number(att.hours || 0);
                    const rate = att.Allocation?.rate_per_hour ? Number(att.Allocation.rate_per_hour) : 0;
                    const isBillable = att.is_billable !== false;
                    const amount = isBillable ? Number((hours * rate).toFixed(2)) : 0;

                    if (liveTotal + amount <= BILL_CAP) {
                        liveTotal += amount;
                        liveHours += hours;
                    }
                }

                liveTotal = Number(liveTotal.toFixed(2));
                liveHours = Number(liveHours.toFixed(2));

                if (Number(b.total_amount) !== liveTotal || Number(b.total_hours) !== liveHours) {
                    await b.update({ total_amount: liveTotal, total_hours: liveHours });
                    b.total_amount = liveTotal;
                    b.total_hours = liveHours;
                }
            }
        } catch (syncErr) {
            console.error(`[getAllBills] sync error for bill ${b.bill_id}:`, syncErr.message);
        }
    }

    return bills;
};

// ==========================================================
// Delete Bill
// ==========================================================
const deleteBill = async (billId) => {
    const transaction = await sequelize.transaction();
    try {
        const bill = await Bill.findByPk(billId, {
            transaction
        });
        if (!bill) {
            throw new Error("Bill not Found");
        }
        await BillDetail.destroy({
            where: {
                bill_id: billId
            },
            transaction
        });
        await Bill.destroy({
            where: {
                bill_id: billId
            },
            transaction
        });
        await transaction.commit();

        return {
            success: true,
            message: "Bill deleted Successfully."
        };
    } catch (error) {
        await transaction.rollback();
        throw error;
    }
};

const path = require("path");
const fs = require("fs");

// ==========================================================
// Download Bill PDF
// ==========================================================
const downloadBill = async (billId) => {

    const bill = await Bill.findByPk(billId);

    if (!bill) {
        throw new Error("Bill not found.");
    }

    if (!bill.pdf_path) {
        throw new Error("PDF not generated.");
    }

    const resolvedPath = path.resolve(bill.pdf_path);

    if (!fs.existsSync(resolvedPath)) {
        throw new Error("PDF file is missing on the server. Please regenerate the bill.");
    }

    return resolvedPath;
};

// ==========================================================
// Upsert Bill (create or regenerate)
// ==========================================================
// Called automatically every time a faculty marks attendance.
// If no bill exists for that faculty+month+year it creates one.
// If a bill already exists it removes the old bill (+ details) and
// rebuilds it from the latest attendance records, so the Super Admin
// always sees the up-to-date amount in the Monthly Summary.
// ==========================================================
const upsertBill = async (facultyId, month, year, extraDetails = {}) => {

    if (!facultyId || !month || !year) {
        throw new Error("Missing required fields");
    }

    const numericUserId = await resolveUserId(facultyId);
    const parsedYear = Number(year);

    // ── Step 1: Delete any existing bill so generateBill won't hit
    //   the "Bill already generated" duplicate guard.
    const existingBill = await Bill.findOne({
        where: { user_id: numericUserId, month, year: parsedYear }
    });

    if (existingBill) {
        const t = await sequelize.transaction();
        try {
            await BillDetail.destroy({
                where: { bill_id: existingBill.bill_id },
                transaction: t
            });
            await Bill.destroy({
                where: { bill_id: existingBill.bill_id },
                transaction: t
            });
            await t.commit();
            console.log(
                `[upsertBill] Removed old bill #${existingBill.bill_id} for faculty ${numericUserId} — ${month} ${parsedYear}`
            );
        } catch (err) {
            await t.rollback();
            throw err;
        }
    }

    // ── Step 2: Regenerate bill from scratch (now safe — no duplicate)
    return await generateBill(numericUserId, month, parsedYear, extraDetails);
};

module.exports = {
    generateBill,
    upsertBill,
    getBillDetails,
    getBillHistory,
    getBillSummary,
    getBillsByMonth,
    regenerateBillPDF,
    getAllBills,
    deleteBill,
    downloadBill
};