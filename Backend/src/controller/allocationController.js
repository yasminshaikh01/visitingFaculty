const allocationService = require('../service/allocationService');
const { seedSubjects } = require('../utils/seedSubjects');

class AllocationController {
    // Live Search Faculty
    async searchFaculty(req, res) {
        try {
            const query = req.query.q || '';
            const faculty = await allocationService.searchFaculty(query);
            return res.status(200).json({ success: true, data: faculty });
        } catch (error) {
            console.error('Error searching faculty:', error);
            return res.status(500).json({ success: false, message: error.message });
        }
    }

    // Get Courses
    async getCourses(req, res) {
        try {
            const courses = await allocationService.getCourses();
            return res.status(200).json({ success: true, data: courses });
        } catch (error) {
            console.error('Error fetching courses:', error);
            return res.status(500).json({ success: false, message: error.message });
        }
    }

    // Get Sections by Course
    async getCourseSections(req, res) {
        try {
            const { courseId } = req.params;
            const sections = await allocationService.getCourseSections(courseId);
            return res.status(200).json({ success: true, data: sections });
        } catch (error) {
            console.error('Error fetching course sections:', error);
            return res.status(500).json({ success: false, message: error.message });
        }
    }

    // Get Semesters by Course
    async getCourseSemesters(req, res) {
        try {
            const { courseId } = req.params;
            const semesters = await allocationService.getCourseSemesters(courseId);
            return res.status(200).json({ success: true, data: semesters });
        } catch (error) {
            console.error('Error fetching course semesters:', error);
            return res.status(500).json({ success: false, message: error.message });
        }
    }

    // Get Subjects by Course & Semester
    async getSubjects(req, res) {
        try {
            const { courseId, semesterId } = req.params;
            const subjects = await allocationService.getSubjects(courseId, semesterId);
            return res.status(200).json({ success: true, data: subjects });
        } catch (error) {
            console.error('Error fetching subjects:', error);
            return res.status(500).json({ success: false, message: error.message });
        }
    }

    // Create Allocation
    async createAllocation(req, res) {
        try {
            const adminUserId = req.user.user_id;
            const allocation = await allocationService.createAllocation(req.body, adminUserId);
            return res.status(201).json({ success: true, message: 'Subject allocated successfully.', data: allocation });
        } catch (error) {
            console.error('Error creating allocation:', error);
            return res.status(400).json({ success: false, message: error.message });
        }
    }

    // Get All Allocations
    async getAllocations(req, res) {
        try {
            const allocations = await allocationService.getAllocations();
            return res.status(200).json({ success: true, data: allocations });
        } catch (error) {
            console.error('Error fetching allocations:', error);
            return res.status(500).json({ success: false, message: error.message });
        }
    }

    // Delete Allocation
    async deleteAllocation(req, res) {
        try {
            const { id } = req.params;
            const result = await allocationService.deleteAllocation(id);
            return res.status(200).json({ success: true, message: result.message });
        } catch (error) {
            console.error('Error deleting allocation:', error);
            return res.status(400).json({ success: false, message: error.message });
        }
    }

    // Seed Subjects & Course Metadata
    async seedSubjectsData(req, res) {
        try {
            const { importSubjectsFromCSV } = require('../utils/csvImporter');
            const result = await importSubjectsFromCSV();
            return res.status(200).json(result);
        } catch (error) {
            console.error('Error seeding subjects:', error);
            return res.status(500).json({ success: false, message: error.message });
        }
    }

    // Update Allocation
    async updateAllocation(req, res) {
        try {
            const { id } = req.params;
            const result = await allocationService.updateAllocation(id, req.body);
            return res.status(200).json({ success: true, message: 'Allocation updated successfully.', data: result });
        } catch (error) {
            console.error('Error updating allocation:', error);
            return res.status(400).json({ success: false, message: error.message });
        }
    }
}

module.exports = new AllocationController();
