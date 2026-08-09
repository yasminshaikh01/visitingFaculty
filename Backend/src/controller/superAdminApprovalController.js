const { approveAdmin, getPendingAdmins, getApprovedAdmin, getRejectedAdmin, getAllAdmins, getAdminById, getDashboardStats } = require("../service/superAdminService");

async function AdminApprovalController(req, res) {
    try {
        const result = await approveAdmin(req.params, req.body, req.user);
        return res.json({
            success: true,
            message: `Admin ${req.body.status === 'approved' ? 'approved' : 'rejected'} successfully`
        });
    } catch (error) {
        console.log('Admin Approval failed', error);
        return res.status(error.statusCode || 500).json({
            success: false,
            message: 'Failed to process Admin approval',
            error: error.message
        });
    }
};

async function getPendingAdminsController(req, res) {
    try {
        const pendingAdmins = await getPendingAdmins();
        return res.json({
            success: true,
            count: pendingAdmins.length,
            data: pendingAdmins
        });
    } catch (error) {
        console.log('Admin pending show failed', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch pending admins',
            error: error.message
        });
    }
};

async function getApprovedAdminsController(req, res) {
    try {
        const ApprovedAdmin = await getApprovedAdmin();
        return res.json({
            success: true,
            count: ApprovedAdmin.length,
            data: ApprovedAdmin
        });
    } catch (error) {
        console.log('Admin Approval failed', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch approved admins',
            error: error.message
        });
    }
};

async function getRejectedAdminsController(req, res) {
    try {
        const RejectedAdmin = await getRejectedAdmin();
        return res.json({
            success: true,
            count: RejectedAdmin.length,
            data: RejectedAdmin
        });
    } catch (error) {
        console.log('Admin Rejection failed', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch rejected admins',
            error: error.message
        });
    }
};

async function getAllAdminsController(req, res) {
    try {
        const Admins = await getAllAdmins();
        return res.json({
            success: true,
            count: Admins.length,
            data: Admins
        });
    } catch (error) {
        console.log('Admin show failed', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch all admins',
            error: error.message
        });
    }
};

async function getAdminController(req, res) {
    try {
        const Admin = await getAdminById(req.params.user_id);
        return res.json({
            success: true,
            data: Admin
        });
    } catch (error) {
        console.log('Admin show failed', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch Admin',
            error: error.message
        });
    }
};

async function getDashboardStatsController(req, res) {
    try {
        const stats = await getDashboardStats(req.user);
        return res.json({
            success: true,
            data: stats
        });
    } catch (error) {
        console.log('Dashboard stats failed', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch dashboard stats',
            error: error.message
        });
    }
};

module.exports = {
    AdminApprovalController,
    getAllAdminsController,
    getApprovedAdminsController,
    getPendingAdminsController,
    getRejectedAdminsController,
    getAdminController,
    getDashboardStatsController
};