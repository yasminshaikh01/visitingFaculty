const { User, FacultyApproval, AdminApproval } = require('../Schema');
const { generateFacultyId } = require('../utils/helper');
const { sendEmail } = require('../utils/emailService');

async function approveFaculty(params, Details, currentUser) {
    try {
        const { user_id } = params;
        const { status, uvfin, rejection_reason } = Details;

        // Fetch user and approval in parallel (2 queries → 1 round-trip)
        const [user, approval] = await Promise.all([
            User.findByPk(user_id),
            FacultyApproval.findOne({ where: { user_id, status: 'pending' } })
        ]);

        if (!user || user.role !== 'faculty') {
            throw new Error("Faculty not found");
        }
        if (!approval) {
            throw new Error("no pending approval found");
        }

        let resultUser = user;

        if (status === 'approved') {
            // Update User and FacultyApproval in parallel (2 queries → 1 round-trip)
            await Promise.all([
                User.update(
                    { is_approved: true, uvfin: uvfin },
                    { where: { user_id } }
                ),
                FacultyApproval.update(
                    {
                        status: 'approved',
                        approved_by: currentUser.user_id,
                        approval_date: new Date(),
                        uvfin: uvfin
                    },
                    { where: { user_id } }
                )
            ]);

            // Fetch the updated user instance
            resultUser = await User.findByPk(user_id);

            // Send email non-blocking – don't make the API wait for SMTP (~1-3s saved)
            sendEmail({
                to: resultUser.email,
                subject: 'Faculty Account Approved - DAVV',
                html: `
                    <h2>Faculty Account Approved</h2>
                    <p>Dear ${resultUser.full_name},</p>
                    <p>Your faculty account has been approved.</p>
                    <p>You can now login to the system.</p>
                    <p>Thank you,<br>DAVV Administration</p>
                `
            }).catch(err => console.error('Email send failed (approve):', err));

        } else if (status === 'rejected') {
            if (!rejection_reason) {
                throw new Error('Rejection reason is required');
            }

            // Update approval and user in parallel
            await Promise.all([
                approval.update({
                    status: 'rejected',
                    approved_by: currentUser.user_id,
                    approval_date: new Date(),
                    rejection_reason
                }),
                user.update({
                    is_approved: false,
                    is_active: false
                })
            ]);

            resultUser = user;

            // Send email non-blocking
            sendEmail({
                to: user.email,
                subject: 'Faculty Account Rejected - DAVV',
                html: `
                    <h2>Faculty Account Rejected</h2>
                    <p>Dear ${user.full_name},</p>
                    <p>Your faculty registration has been rejected.</p>
                    <p><strong>Reason:</strong> ${rejection_reason}</p>
                    <p>Please contact the administration.</p>
                    <p>Thank you,<br>DAVV Administration</p>
                `
            }).catch(err => console.error('Email send failed (reject):', err));
        }

        return resultUser;
    } catch (error) {
        console.error('Approve Faculty Error:', error);
        throw error;
    }
};
async function getPendingFaculty() {
    try {
        const pendingFaculty = await User.findAll({
            where: {
                role: 'faculty',
                is_approved: false
            },
            include: [{
                model: FacultyApproval,
                where: { status: 'pending' },
                required: true
            }],
            attributes: { exclude: ['password_hash'] },
            order: [['created_at', 'ASC']]
        });

        return pendingFaculty;

    } catch (error) {
        console.error('Get Pending Faculty Error:', error);
        throw new Error('Failed to fetch pending faculty');
    }
};

async function getRejectedFaculty() {
    try {
        const RejectedFaculty = await User.findAll({
            where: {
                role: 'faculty',
                is_approved: false
            },
            include: [{
                model: FacultyApproval,
                where: { status: 'rejected' },
                required: true
            }],
            attributes: { exclude: ['password_hash'] },
            order: [['created_at', 'ASC']]
        });
        return RejectedFaculty;
    } catch (error) {
        console.error('Get Rejected Faculty Error:', error);
        throw new Error('Failed to fetch rejected faculty');
    }
}
async function getApprovedFaculty() {
    try {
        const ApprovedFaculty = await User.findAll({
            where: {
                role: 'faculty',
                is_approved: true
            },
            include: [{
                model: FacultyApproval,
                where: { status: 'approved' },
                required: true
            }],
            attributes: { exclude: ['password_hash'] },
            order: [['created_at', 'ASC']]
        });
        return ApprovedFaculty;
    } catch (error) {
        console.error('Get Approved faculty Error:', error);
        throw new Error('Failed to fetch approved faculty');
    }
}

async function getAllFaculty() {
    try {
        const facultys = await User.findAll({
            where: { role: 'faculty' },
            attributes: { exclude: ['password_hash'] },
            include: [{
                model: FacultyApproval,
                required: false
            }],
            order: [['created_at', 'DESC']]
        });

        return facultys;

    } catch (error) {
        console.error('Get All Faculty Error:', error);
        throw new Error('Failed to fetch facultys');
    }
}
async function getFacultyById(user_id) {
    try {
        const faculty = await User.findByPk(user_id, { attributes: { exclude: ['password_hash'] } });
        if (!faculty || faculty.role !== 'faculty') {
            throw new Error('Faculty not found');
        }
        return faculty;
    } catch (error) {
        console.error('Get Faculty By Id Error:', error);
        throw new Error('Failed to fetch faculty by id');
    }
}
async function updateUvfin(user_id, uvfinId) {
    try {
        // Fetch user, approval, and UVFIN duplicate check in parallel (3 queries → 1 round-trip)
        const [user, approved, existingUvfin] = await Promise.all([
            User.findByPk(user_id),
            FacultyApproval.findOne({ where: { user_id, status: 'approved' } }),
            User.findOne({ where: { uvfin: uvfinId } })
        ]);

        if (!user || user.role != 'faculty') {
            throw new Error('Faculty member not found.');
        }
        if (!approved) {
            throw new Error('Cannot assign UVFIN: Faculty member is not approved yet.');
        }
        if (existingUvfin && existingUvfin.user_id !== parseInt(user_id)) {
            throw new Error('This UVFIN is already assigned to another faculty member.');
        }

        // Update BOTH tables in parallel to keep data in sync
        await Promise.all([
            User.update({ uvfin: uvfinId }, { where: { user_id } }),
            FacultyApproval.update({ uvfin: uvfinId }, { where: { user_id } })
        ]);

        return { message: "UVFIN updated successfully!" };
        
    } catch (error) {
        console.error('Update UVFIN Error:', error);
        throw new Error(error.message || 'Failed to update UVFIN.');
    }
}

module.exports = {
    approveFaculty,
    getAllFaculty,
    getApprovedFaculty,
    getPendingFaculty,
    getRejectedFaculty,
    getFacultyById,
    updateUvfin
};