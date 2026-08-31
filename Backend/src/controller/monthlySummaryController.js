const {
    getMonthlySummary,
    getAllCoursesMonthlySummary,
    downloadMonthlySummaryPDF,
    generateMonthlySummaryPDF
} = require("../service/monthlySummaryService");

const { runMonthlySummaryJob } = require("../scheduler/monthlySummaryScheduler");

// =================================================================
// GET /api/monthly-summary?month=July&year=2026&courseId=1
// Returns: Summary grouped by Semester → Faculty for ONE course
// courseId is optional — if omitted, returns all courses combined
// =================================================================
const getMonthlySummaryController = async (req, res) => {
    try {
        const { month, year, courseId } = req.query;

        if (!month || !year) {
            return res.status(400).json({
                success: false,
                message: "Query params 'month' and 'year' are required."
            });
        }

        const data = await getMonthlySummary(month, year, courseId || null);

        return res.status(200).json({
            success: true,
            data
        });

    } catch (error) {
        console.error("getMonthlySummaryController:", error);
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// =================================================================
// GET /api/monthly-summary/all?month=July&year=2026
// Returns: Summary for ALL active courses for that month/year
// =================================================================
const getAllCoursesSummaryController = async (req, res) => {
    try {
        const { month, year } = req.query;

        if (!month || !year) {
            return res.status(400).json({
                success: false,
                message: "Query params 'month' and 'year' are required."
            });
        }

        const data = await getAllCoursesMonthlySummary(month, year);

        return res.status(200).json({
            success: true,
            data
        });

    } catch (error) {
        console.error("getAllCoursesSummaryController:", error);
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// =================================================================
// GET /api/monthly-summary/download?month=July&year=2026&courseId=1
// Returns: PDF file (binary download)
// courseId is required for PDF (one course per report like the screenshot)
// =================================================================
const downloadSummaryPDFController = async (req, res) => {
    try {
        const { month, year, courseId } = req.query;

        if (!month || !year || !courseId) {
            return res.status(400).json({
                success: false,
                message: "Query params 'month', 'year', and 'courseId' are required for PDF download."
            });
        }

        const pdfPath = await downloadMonthlySummaryPDF(month, year, courseId);

        // Pass error callback so file-send failures return JSON instead of crashing
        return res.download(pdfPath, (err) => {
            if (err && !res.headersSent) {
                console.error("downloadSummaryPDFController [res.download]:", err);
                return res.status(500).json({
                    success: false,
                    message: "Failed to send PDF file: " + err.message
                });
            }
        });

    } catch (error) {
        console.error("downloadSummaryPDFController:", error);
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// =================================================================
// GET /api/monthly-summary/super-admin-pdf?month=July&year=2026
// Super Admin — Full Monthly Summary PDF
// Format: S.No. | UVFIN | Name of Faculty | Total Amount
//         Grand Total row
//         All 9 Program Incharge blocks (3×3 grid)
//         Director signature
// =================================================================
const generateSummaryPDFController = async (req, res) => {
    try {
        const { month, year } = req.query;

        if (!month || !year) {
            return res.status(400).json({
                success: false,
                message: "Query params 'month' and 'year' are required."
            });
        }

        const pdfPath = await generateMonthlySummaryPDF(month, year);

        return res.download(pdfPath, `Monthly-Summary-${month}-${year}.pdf`, (err) => {
            if (err && !res.headersSent) {
                console.error("generateSummaryPDFController [res.download]:", err);
                return res.status(500).json({
                    success: false,
                    message: "Failed to send PDF file: " + err.message
                });
            }
        });

    } catch (error) {
        console.error("generateSummaryPDFController:", error);
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// =================================================================
// POST /api/monthly-summary/trigger-now
// Manually triggers the cron job (for testing / emergency re-run).
// Body: { month: "June", year: 2026 } — optional; defaults to previous month
// =================================================================
const triggerMonthlySummaryNow = async (req, res) => {
    try {
        // runMonthlySummaryJob() always uses "previous month" internally,
        // so we just fire it and let it handle the date logic.
        res.status(202).json({
            success: true,
            message: "Monthly summary job triggered. Check server logs for progress."
        });

        // Run AFTER responding so the HTTP request doesn't time out
        runMonthlySummaryJob();

    } catch (error) {
        console.error("triggerMonthlySummaryNow:", error);
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

module.exports = {
    getMonthlySummaryController,
    getAllCoursesSummaryController,
    downloadSummaryPDFController,
    generateSummaryPDFController,
    triggerMonthlySummaryNow
};
