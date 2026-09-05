const { SubjectGroup, Subject, Course, Semester } = require("../Schema");

async function getAllGroups() {
    const groups = await SubjectGroup.findAll({
        where: { is_active: true },
        include: [{
            model: Subject,
            attributes: ['subject_id', 'subject_code', 'subject_name', 'course_id', 'semester_id'],
            include: [{
                model: Course, attributes: ['course_id', 'course_name']
            },
            { model: Semester, attributes: ['semester_id', 'semester_number'] }]
        }],
        order: [['group_id', 'ASC']]
    });
    return groups;
}

async function createGroup(subject_ids) {
    if (!subject_ids || subject_ids.length < 2) {
        throw new Error('At least 2 subjects are required to create a group');
    }
    // Fetch the subjects to build combined_code
    const subjects = await Subject.findAll({
        where: { subject_id: subject_ids },
        order: [['subject_id', 'ASC']]
    });
    if (subjects.length !== subject_ids.length) {
        throw new Error('One or more subject_ids are invalid');
    }
    // Check none are already in a group
    const alreadyGrouped = subjects.filter(s => s.group_id !== null);
    if (alreadyGrouped.length > 0) {
        const codes = alreadyGrouped.map(s => s.subject_code).join(', ');
        throw new Error(`Subjects already in a group: ${codes}`);
    }
    // Build combined code: "IM-706FB / FT-316FB"
    const combined_code = subjects.map(s => s.subject_code).join(' / ');
    // Create the group
    const group = await SubjectGroup.create({
        group_name: subjects[0].subject_name,
        combined_code
    });
    // Update all subjects to point to this group
    await Subject.update(
        { group_id: group.group_id },
        { where: { subject_id: subject_ids } }
    );
    return group;
}
// 3. Delete a group (unlink subjects)
async function deleteGroup(group_id) {
    const group = await SubjectGroup.findByPk(group_id);
    if (!group) throw new Error('Group not found');
    // Remove group_id from all subjects in this group
    await Subject.update(
        { group_id: null },
        { where: { group_id: group_id } }
    );
    // Delete the group
    await group.destroy();
    return { message: 'Group removed, subjects unlinked' };
}
module.exports = { getAllGroups, createGroup, deleteGroup };