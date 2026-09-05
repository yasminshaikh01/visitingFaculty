const sequelize = require('../config/database');

// Import all models
const User = require('./userSchema');
const AdminApproval = require('./adminApprovalSchema');
const FacultyApproval = require('./facultyApprovalSchema');  // ✅ Add this - missing
const Course = require('./courseSchema');
const Semester = require('./semesterSchema');
const Section = require('./sectionSchema');
const Subject = require('./subjectSchema');
const Allocation = require('./allocationSchema');
const Attendance = require('./attendanceSchema');
const Bill = require('./billSchema');
const BillDetail = require('./billDetailsSchema');  // ✅ Add this - missing
const SubjectGroup = require('./subjectGroupSchema');

// ============================================
// 1. USER ASSOCIATIONS
// ============================================

// Admin Approval
User.hasOne(AdminApproval, { foreignKey: 'user_id' });
AdminApproval.belongsTo(User, { foreignKey: 'user_id' });
AdminApproval.belongsTo(User, { foreignKey: 'approved_by', as: 'Approver' });

// Faculty Approval
User.hasOne(FacultyApproval, { foreignKey: 'user_id' });
FacultyApproval.belongsTo(User, { foreignKey: 'user_id' });
FacultyApproval.belongsTo(User, { foreignKey: 'approved_by', as: 'Approver' });

// ============================================
// 2. COURSE ASSOCIATIONS
// ============================================

// Course → Semester
Course.hasMany(Semester, { foreignKey: 'course_id' });
Semester.belongsTo(Course, { foreignKey: 'course_id' });

// Course → Section
Course.hasMany(Section, { foreignKey: 'course_id' });
Section.belongsTo(Course, { foreignKey: 'course_id' });

// Course → Subject
Course.hasMany(Subject, { foreignKey: 'course_id' });
Subject.belongsTo(Course, { foreignKey: 'course_id' });

// Semester → Subject
Semester.hasMany(Subject, { foreignKey: 'semester_id' });
Subject.belongsTo(Semester, { foreignKey: 'semester_id' });

// SubjectGroup → Subject
SubjectGroup.hasMany(Subject, { foreignKey: 'group_id' });
Subject.belongsTo(SubjectGroup, { foreignKey: 'group_id' });

// ============================================
// 3. ALLOCATION ASSOCIATIONS
// ============================================

// Allocation → Faculty (who teaches)
Allocation.belongsTo(User, { foreignKey: 'user_id' });
User.hasMany(Allocation, { foreignKey: 'user_id' });

// Allocation → Admin (who created)
Allocation.belongsTo(User, { foreignKey: 'created_by', as: 'Admin' });
User.hasMany(Allocation, { foreignKey: 'created_by', as: 'CreatedAllocations' });

// Allocation → Course
Allocation.belongsTo(Course, { foreignKey: 'course_id' });
Course.hasMany(Allocation, { foreignKey: 'course_id' });

// Allocation → Semester
Allocation.belongsTo(Semester, { foreignKey: 'semester_id' });
Semester.hasMany(Allocation, { foreignKey: 'semester_id' });

// Allocation → Section
Allocation.belongsTo(Section, { foreignKey: 'section_id' });
Section.hasMany(Allocation, { foreignKey: 'section_id' });

// Allocation → Subject
Allocation.belongsTo(Subject, { foreignKey: 'subject_id' });
Subject.hasMany(Allocation, { foreignKey: 'subject_id' });

// ============================================
// 4. ATTENDANCE ASSOCIATIONS
// ============================================

// Attendance → Allocation
Attendance.belongsTo(Allocation, { foreignKey: 'allocation_id' });
Allocation.hasMany(Attendance, { foreignKey: 'allocation_id' });

// Attendance → User (Faculty)
Attendance.belongsTo(User, { foreignKey: 'user_id' });
User.hasMany(Attendance, { foreignKey: 'user_id' });

// ============================================
// 5. BILL ASSOCIATIONS
// ============================================

// Bill → User (Faculty)
Bill.belongsTo(User, { foreignKey: 'user_id' });
User.hasMany(Bill, { foreignKey: 'user_id' });

// Bill → BillDetail
Bill.hasMany(BillDetail, { foreignKey: 'bill_id' });
BillDetail.belongsTo(Bill, { foreignKey: 'bill_id' });

// ============================================
// 6. EXPORT ALL MODELS
// ============================================

module.exports = {
    sequelize,
    User,
    AdminApproval,
    FacultyApproval,  // ✅ Export this
    Course,
    Semester,
    Section,
    Subject,
    Allocation,
    Attendance,
    SubjectGroup,
    Bill,
    BillDetail  // ✅ Export this
};