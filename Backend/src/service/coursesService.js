const { Course, Section, Subject, Semester } = require('../Schema');

async function showDashboard() {
    try{
        const courses = await Course.findAll({
            include: [
                {
                    model: Section,
                    attributes: ['section_id', 'section_name'],
                    required: false
                }
            ],
            order: [['course_id', 'ASC']]
        });

        return courses;
    }catch(error){
        console.log(error);
        throw new Error('not able to fetch dashboard');
    }
}

async function showDashboardOfCourse(course_id) {
    try{
        const courses = await Course.findAll({
            where: {course_id},
            include: [
                {
                    model: Section,
                    attributes: ['section_id', 'section_name'],
                    required: false
                }
            ],
            order: [['course_id', 'ASC']]
        });

        return courses;
    }catch(error){
        console.log(error);
        throw new Error('not able to fetch course');
    }
}

async function addSections(section_name, course_id) {
    try {
        const course = await Section.create({
            section_name: section_name,
            course_id: course_id
        });
    return course;
    } catch (error) {
        console.log(error);
        throw new Error('not able to add section');
    }

}

async function deleteSection(course_id, section_id) {
    try {
        const result = await Section.findOne({
            where: {
                course_id: course_id,
                section_id: section_id
            }
        });
        if(!result){
            throw new Error('not able to find section');
        }
        await Section.destroy({
            where: {
                course_id: course_id,
                section_id: section_id
            }
        });
        return result;
    } catch (error) {
        console.log(error);
        throw new Error('not able to delete section');
    }
}
async function updateIncharge(program_incharge, course_id) {
    try {
        const result = await Course.findByPk(course_id);
        await result.update({
            program_incharge: program_incharge
        });
        return {message: "Program Incharge updated"};
    } catch (error) {
        console.log(error);
        throw new Error('not able to update Program Incharge');
    }
}

async function semesterSubjectShow(course_id, semester_number) {
    try {
        // Resolve semester_number to actual semester_id
        const semester = await Semester.findOne({
            where: { course_id: course_id, semester_number: semester_number }
        });
        if (!semester) return [];

        const subjects = await Subject.findAll({
            where: {
                course_id: course_id,
                semester_id: semester.semester_id,
                is_active: true
            },
            order: [['subject_code', 'ASC']]
        });
        return subjects;
    } catch (error) {
        console.log(error);
        throw new Error('not able to fetch subjects for the given course and semester');
    }
}

async function deleteSubjects(course_id, semester_number, subject_id) {
    try {
        // Resolve semester_number to actual semester_id
        const semester = await Semester.findOne({
            where: { course_id: course_id, semester_number: semester_number }
        });
        if (!semester) throw new Error('Semester not found for this course');

        const actualSemesterId = semester.semester_id;

        const result = await Subject.findOne({
            where: {
                course_id: course_id,
                semester_id: actualSemesterId,
                subject_id: subject_id
            }
        });
        if(!result){
            throw new Error('not able to find subject');
        }
        await Subject.destroy({
            where: {
                course_id: course_id,
                semester_id: actualSemesterId,
                subject_id: subject_id
            }
        });
        return result;
    } catch (error) {
        console.log(error);
        throw new Error('not able to delete subject');
    }
}

async function addSubjects(course_id, semester_number, Details) {
    try {
        const semester = await Semester.findOne({
            where: {
                course_id: course_id,
                semester_number: semester_number
            }
        });

        if (!semester) {
            throw new Error(`Semester ${semester_number} not found for this course. Please create the semester first.`);
        }

        const result = await Subject.create({
            course_id: course_id,
            semester_id: semester.semester_id,
            subject_code: Details.subject_code,
            subject_name: Details.subject_name
        });

        return result;
    } catch (error) {
        console.log(error);
        throw new Error(error.message || 'not able to add subject');
    }
}

async function addCourse(Details) {
    try {
        const result = await Course.create({
            course_name: Details.course_name,
            program_incharge: Details.program_incharge,
            total_semesters: Details.total_semesters,
            year: Details.year
        });

        // ✅ Auto-create semesters for this course
        const totalSemesters = Number(Details.total_semesters || 1);

        for (let i = 1; i <= totalSemesters; i++) {
            await Semester.findOrCreate({
                where: {
                    course_id: result.course_id,
                    semester_number: i
                },
                defaults: {
                    course_id: result.course_id,
                    semester_number: i,
                    is_active: true
                }
            });
        }

        return result;
    } catch (error) {
        console.log(error);
        throw new Error('not able to add Course');
    }
}

async function deleteCourse(course_id) {
    try {
        const result = await Course.findOne({
            where: {
                course_id: course_id
            }
        });
        if(!result){
            throw new Error('not able to find Course');
        }
        await Course.destroy({
            where: {
                course_id: course_id
            }
        });
        return result;
    } catch (error) {
        console.log(error);
        throw new Error('not able to delete Course');
    }
}

async function deleteSemester(course_id, semester_number) {
    try {
        // Resolve semester_number to actual semester record
        const result = await Semester.findOne({
            where: {
                course_id: course_id,
                semester_number: semester_number
            }
        });
        if(!result){
            throw new Error('not able to find semester');
        }
        await Semester.destroy({
            where: {
                semester_id: result.semester_id
            }
        });
        return result;
    } catch (error) {
        console.log(error);
        throw new Error('not able to delete semester');
    }
}

async function addSemester(course_id, semester_number) {
    try {
        const result = await Semester.create({
            course_id: course_id,
            semester_number: semester_number
        });
        return result;
    } catch (error) {
        console.log(error);
        throw new Error('not able to add semester');
    }
}

module.exports = {
    showDashboard,
    showDashboardOfCourse,
    addSections,
    updateIncharge,
    semesterSubjectShow,
    deleteSubjects,
    addSubjects,
    deleteCourse,
    deleteSemester,
    addSemester,
    addCourse,
    deleteSection
};