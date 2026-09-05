const { User, Course, Semester, Section, Subject, Allocation, SubjectGroup } = require('../Schema');
const { Op } = require('sequelize');

class AllocationService {
    // 1. Live Faculty Search
    async searchFaculty(query) {
        const whereClause = {
            role: 'faculty',
            is_approved: true,
            is_active: true
        };

        if (query && query.trim()) {
            whereClause.full_name = { [Op.like]: `%${query.trim()}%` };
        }

        const facultyList = await User.findAll({
            where: whereClause,
            attributes: ['user_id', 'full_name', 'email', 'phone_number'],
            limit: 20
        });

        return facultyList;
    }

    // 2. Get All Courses
    async getCourses() {
        const courses = await Course.findAll({
            where: { is_active: true },
            order: [['course_code', 'ASC']]
        });
        return courses;
    }

    // 3. Get Sections by Course
    async getCourseSections(courseId) {
        const sections = await Section.findAll({
            where: { course_id: courseId, is_active: true },
            order: [['section_name', 'ASC']]
        });
        return sections;
    }

    // 4. Get Semesters by Course
    async getCourseSemesters(courseId) {
        const semesters = await Semester.findAll({
            where: { course_id: courseId, is_active: true },
            order: [['semester_number', 'ASC']]
        });
        return semesters;
    }

    // 5. Get Subjects by Course and Semester
    async getSubjects(courseId, semesterId) {
        const subjects = await Subject.findAll({
            where: {
                course_id: courseId,
                semester_id: semesterId,
                is_active: true
            },
            include: [{
                model: SubjectGroup,
                attributes: ['group_id', 'group_name', 'combined_code'],
                required: false    // LEFT JOIN — subjects without groups still returned
            }],
            order: [['subject_code', 'ASC']]
        });
        
        // Flatten group info into subject object for frontend convenience
        return subjects.map(s => {
            const plain = s.toJSON();
            return {
                ...plain,
                group_id: plain.SubjectGroup?.group_id || null,
                group_name: plain.SubjectGroup?.group_name || null,
                combined_code: plain.SubjectGroup?.combined_code || null,
                SubjectGroup: undefined   // remove nested object
            };
        });
    }

    // 6. Create Subject Allocation
    async createAllocation(data, adminUserId) {
        const {
            user_id,
            course_id,
            semester_id,
            section_id,
            subject_id,
            session_type,
            rate_per_hour,
            academic_year
        } = data;

        if (!user_id || !course_id || !semester_id || !subject_id || !session_type || !rate_per_hour || !academic_year) {
            throw new Error('All required fields (Faculty, Course, Semester, Subject, Type, Rate, Academic Year) must be provided.');
        }

        // rate_per_hour is stored as ENUM('200', '400', '800') — validate before DB insert
        const VALID_RATES = ['200', '400', '800'];
        const rateStr = String(rate_per_hour);
        if (!VALID_RATES.includes(rateStr)) {
            throw new Error(`Invalid rate_per_hour: "${rate_per_hour}". Allowed values are: ${VALID_RATES.join(', ')}.`);
        }

        const allocation = await Allocation.create({
            user_id,
            course_id,
            semester_id,
            section_id: section_id || null,
            subject_id,
            session_type,
            rate_per_hour: rateStr,   // always store as string to match ENUM type
            academic_year,
            created_by: adminUserId,
            is_active: true
        });

        return allocation;
    }

    // 7. Get All Allocations with Relations
    async getAllocations() {
        const allocations = await Allocation.findAll({
            where: { is_active: true },
            include: [
                { model: User, attributes: ['user_id', 'full_name', 'email'] },
                { model: Course, attributes: ['course_id', 'course_code', 'course_name'] },
                { model: Semester, attributes: ['semester_id', 'semester_number'] },
                { model: Section, attributes: ['section_id', 'section_name'] },
                {
                    model: Subject,
                    attributes: ['subject_id', 'subject_code', 'subject_name', 'group_id'],
                    include: [{
                        model: SubjectGroup,
                        attributes: ['combined_code', 'group_name'],
                        required: false
                    }]
                }
            ],
            order: [['allocation_id', 'DESC']]
        });

        return allocations;
    }

    // 8. Update Allocation
    async updateAllocation(allocationId, data) {
        const {
            user_id,
            course_id,
            semester_id,
            section_id,
            subject_id,
            session_type,
            rate_per_hour,
            academic_year
        } = data;

        const allocation = await Allocation.findByPk(allocationId);
        if (!allocation) {
            throw new Error('Allocation record not found.');
        }

        // Validate rate_per_hour if provided
        let rateStr = allocation.rate_per_hour;
        if (rate_per_hour) {
            const VALID_RATES = ['200', '400', '800'];
            rateStr = String(rate_per_hour);
            if (!VALID_RATES.includes(rateStr)) {
                throw new Error(`Invalid rate_per_hour: "${rate_per_hour}". Allowed values are: ${VALID_RATES.join(', ')}.`);
            }
        }

        const oldUserId = allocation.user_id;
        const newUserId = user_id || oldUserId;

        // Update the allocation
        await allocation.update({
            user_id: newUserId,
            course_id: course_id || allocation.course_id,
            semester_id: semester_id || allocation.semester_id,
            section_id: section_id !== undefined ? section_id : allocation.section_id,
            subject_id: subject_id || allocation.subject_id,
            session_type: session_type || allocation.session_type,
            rate_per_hour: rateStr,
            academic_year: academic_year || allocation.academic_year
        });

        const { Attendance } = require('../Schema');
        const attendanceService = require('./attendanceService');

        // Find all distinct months, years, and user_ids for the attendance records of this allocation
        const attendanceRecords = await Attendance.findAll({
            attributes: ['month', 'year', 'user_id'],
            where: { allocation_id: allocationId },
            group: ['month', 'year', 'user_id']
        });

        // Update the user_id in related attendances if it changed
        if (oldUserId !== newUserId) {
            await Attendance.update(
                { user_id: newUserId },
                { where: { allocation_id: allocationId } }
            );
        }

        // Re-sync monthly billable status for all affected months/years/users
        for (const record of attendanceRecords) {
            // Sync for the old user (or current user if user_id didn't change)
            await attendanceService.syncMonthlyBillableStatus(record.user_id, record.month, record.year);
            // If user_id changed, sync for the new user for the same month/year
            if (oldUserId !== newUserId) {
                await attendanceService.syncMonthlyBillableStatus(newUserId, record.month, record.year);
            }
        }

        return allocation;
    }

    // 9. Delete Allocation
    async deleteAllocation(allocationId) {
        const allocation = await Allocation.findByPk(allocationId);
        if (!allocation) {
            throw new Error('Allocation record not found.');
        }

        await allocation.destroy();
        return { success: true, message: 'Allocation deleted successfully.' };
    }
}

module.exports = new AllocationService();
