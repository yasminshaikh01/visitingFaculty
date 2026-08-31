const express = require('express');
const authMiddleware = require('../middleware/auth');
const { FacultyApprovalController, getPendingFacultysController, getApprovedFacultyController, getRejectedFacultyController, getAllFacultyController, getFacultyController, updateUvfinController } = require('../controller/adminApprovalController');
const allocationController = require('../controller/allocationController');

const AdminApprovalRouter = express.Router();

// Faculty Approval & Info Routes
AdminApprovalRouter.put('/faculty/:user_id/approve', authMiddleware(['admin']), FacultyApprovalController);
AdminApprovalRouter.get('/pendingFaculty', authMiddleware(['admin']), getPendingFacultysController);
AdminApprovalRouter.get('/approvedFaculty', authMiddleware(['admin']), getApprovedFacultyController);
AdminApprovalRouter.get('/rejectedFaculty', authMiddleware(['admin']), getRejectedFacultyController);
AdminApprovalRouter.get('/allFaculty', authMiddleware(['admin']), getAllFacultyController);
AdminApprovalRouter.get('/faculty/:user_id', authMiddleware(['faculty', 'admin']), getFacultyController);
AdminApprovalRouter.put('/updateFaculty/:user_id', authMiddleware(['admin']), updateUvfinController);

// Subject Allocation & Dependent Metadata Routes
AdminApprovalRouter.get('/search-faculty', authMiddleware(['admin']), (req, res) => allocationController.searchFaculty(req, res));
AdminApprovalRouter.get('/courses', authMiddleware(['admin']), (req, res) => allocationController.getCourses(req, res));
AdminApprovalRouter.get('/courses/:courseId/sections', authMiddleware(['admin']), (req, res) => allocationController.getCourseSections(req, res));
AdminApprovalRouter.get('/courses/:courseId/semesters', authMiddleware(['admin']), (req, res) => allocationController.getCourseSemesters(req, res));
AdminApprovalRouter.get('/courses/:courseId/semesters/:semesterId/subjects', authMiddleware(['admin']), (req, res) => allocationController.getSubjects(req, res));

// Allocation CRUD Routes
AdminApprovalRouter.post('/allocations', authMiddleware(['admin']), (req, res) => allocationController.createAllocation(req, res));
AdminApprovalRouter.get('/allocations', authMiddleware(['admin']), (req, res) => allocationController.getAllocations(req, res));
AdminApprovalRouter.delete('/allocations/:id', authMiddleware(['admin']), (req, res) => allocationController.deleteAllocation(req, res));
AdminApprovalRouter.put('/allocations/:id', authMiddleware(['admin']), (req, res) => allocationController.updateAllocation(req, res));
// Seed Database Endpoint
AdminApprovalRouter.post('/seed-subjects', authMiddleware(['admin']), (req, res) => allocationController.seedSubjectsData(req, res));

module.exports = AdminApprovalRouter;