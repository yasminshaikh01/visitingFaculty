const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { Op } = require('sequelize');
const User = require('../Schema/userSchema');
const FacultyApproval = require('../Schema/facultyApprovalSchema');
const AdminApproval = require('../Schema/adminApprovalSchema');
const { sendEmail } = require('../utils/emailService');
require('dotenv').config();

// faculty registration logic
async function registerFaculty(facultyData) {
    // Run all uniqueness checks in parallel for speed (~5x faster)
    const [existingUserEmail, existingUserAadhar, existingUserPan, existingUserMobile] = await Promise.all([
        User.findOne({ where: { email: facultyData.email } }),
        User.findOne({ where: { aadhaar_no: facultyData.aadhaar_no } }),
        User.findOne({ where: { pan_card_no: facultyData.pan_card_no } }),
        User.findOne({ where: { phone_number: facultyData.phone_number } })
    ]);

    if (existingUserEmail) {
        throw new Error('Email already exist');
    }
    if (existingUserAadhar) {
        throw new Error('Aadhaar Number already exist');
    }
    if (existingUserPan) {
        throw new Error('Pan Card Number already exist');
    }
    if (existingUserMobile) {
        throw new Error('Mobile Number already exist');
    }

    const { password, user_id, ...restFacultyData } = facultyData;
    const user = await User.create({
        role: 'faculty',
        password_hash: password,
        is_approved: false,
        is_active: true,
        ...restFacultyData
    });

    await FacultyApproval.create({
        user_id: user.user_id,
        status: 'pending'
    });

    return user;
}

async function registerAdmin(adminData) {
    // Run all uniqueness checks in parallel
    const [existingUser, existingUserMobile] = await Promise.all([
        User.findOne({ where: { email: adminData.email } }),
        User.findOne({ where: { phone_number: adminData.phone_number } })
    ]);

    if (existingUser) {
        throw new Error('Email already exist');
    }
    if (existingUserMobile) {
        throw new Error('Mobile Number already exist');
    }

    const { password, user_id, ...restAdminData } = adminData;
    const user = await User.create({
        role: 'admin',
        password_hash: password,
        is_approved: false,
        is_active: true,
        ...restAdminData
    });

    await AdminApproval.create({
        user_id: user.user_id,
        status: 'pending'
    });

    return user;
}

async function login(Details) {
    try {
        const { email, password } = Details || {};

        if (!email || !password) {
            const error = new Error('Email and password are required');
            error.statusCode = 400;
            throw error;
        }

        const user = await User.findOne({
            where: { email }
        });

        if (!user) {
            throw new Error('Invalid credentials');
        }

        if (!user.is_approved) {
            throw new Error('account is pending approval');
        }

        if (!user.is_active) {
            throw new Error('account is deactivated');
        }

        const isValid = await user.comparePassword(password);
        if (!isValid) {
            throw new Error('Invalid credentials');
        }

        await user.update({ last_login: new Date() });

        const token = jwt.sign(
            { user_id: user.user_id, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRE }
        );

        return { user, token };
    } catch (error) {
        console.log('error in login in userService', error);
        throw error;
    }
}

async function logout(user_id) {
    try {
        const user = await User.findOne({
            where: { user_id }
        });

        if (!user) {
            throw new Error('User not found');
        }

        return { success: true, message: 'Logged out successfully' };
    } catch (error) {
        console.log('error in logout in userService', error);
        throw error;
    }
}

async function generatePasswordResetToken(email) {
    try {
        const user = await User.findOne({
            where: { email }
        });

        if (!user) {
            throw new Error('User not found with this email.');
        }
        //secure random token generation
        const resetToken = crypto.randomBytes(20).toString('hex');

        let resetDuration = 3600000;
        const expireEnv = process.env.PASSWORD_RESET_EXPIRE;
        if (expireEnv) {
            if (typeof expireEnv === 'string' && expireEnv.endsWith('h')) {
                resetDuration = parseInt(expireEnv) * 3600 * 1000;
            } else if (typeof expireEnv === 'string' && expireEnv.endsWith('m')) {
                resetDuration = parseInt(expireEnv) * 60 * 1000;
            } else if (typeof expireEnv === 'string' && expireEnv.endsWith('s')) {
                resetDuration = parseInt(expireEnv) * 1000;
            } else {
                resetDuration = parseInt(expireEnv) || 3600000;
            }
        }
        const resetExpire = new Date(Date.now() + resetDuration);

        await user.update({
            reset_password_token: resetToken,
            reset_password_expires: resetExpire
        });

        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
        const resetUrl = `${frontendUrl}/reset-password?token=${resetToken}`;

        const emailOptions = {
            to: user.email,
            subject: 'DAVV Visiting Faculty - Password Reset Request',
            html: `
                <div style="font-family: Arial, sans-serif; line-height: 1.6; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; padding: 20px; border-radius: 8px;">
                    <h2 style="color: #007bff; text-align: center;">Password Reset Request</h2>
                    <p>Hello ${user.full_name},</p>
                    <p>We received a request to reset your password for your DAVV Visiting Faculty Portal account.</p>
                    <p style="text-align: center; margin: 30px 0;">
                        <a href="${resetUrl}" target="_blank" style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold;">Reset Password</a>
                    </p>
                    <p>Or copy and paste this URL into your browser:</p>
                    <p style="word-break: break-all; color: #555;">${resetUrl}</p>
                    <hr style="border: 0; border-top: 1px solid #eee;" />
                    <p style="font-size: 12px; color: #888;">This link will automatically expire in 1 hour. If you did not request this reset, please ignore this email.</p>
                </div>
            `
        };
        const emailResult = await sendEmail(emailOptions);
        if (!emailResult.success) {
            throw new Error('Failed to send reset email. Please try again.');
        }
        return { message: 'Reset link has been sent to your email.' };

    } catch (error) {
        console.log('error in generatePasswordResetToken in userService', error);
        throw error;
    }
}

async function resetUserPassword(token, newPassword) {
    try {
        const user = await User.findOne({
            where: {
                reset_password_token: token,
                reset_password_expires: {
                    [Op.gt]: new Date()
                }
            }
        });
        if (!user) {
            throw new Error('Password reset token is invalid or has expired.');
        }
        await user.update({
            password_hash: newPassword,
            reset_password_token: null,
            reset_password_expires: null
        });
        return { message: 'Your password has been successfully reset.' };
    } catch (error) {
        console.log('error in resetUserPassword in userService', error);
        throw error;
    }
}
async function changePassword(user_id, oldPassword, newPassword) {
    try {
        const user = await User.findByPk(user_id);
        if (!user) {
            throw new Error('user not found');
        }
        const isMatch = await user.comparePassword(oldPassword);
        if (!isMatch) {
            throw new Error('password does not match');
        }
        await user.update({
            password_hash: newPassword
        });
        return { message: 'password changed successfully' };
    } catch (error) {
        console.log('error in changePassword in userService', error);
        throw error;
    }
}
async function updateProfile(user_id, updateData) {
    try {
        const user = await User.findByPk(user_id);
        if (!user) {
            throw new Error('User not found.');
        }
        const allowedUpdate = [
            'full_name',
            'phone_number',
            'address',
            'qualification',
            'aadhaar_no',
            'account_no',
            'bank_name',
            'ifsc_code',
            'pan_card_no'
        ];
        const filteredUpdates = {};
        allowedUpdate.forEach(field => {
            if (updateData[field] !== undefined) {
                filteredUpdates[field] = updateData[field];
            }
        });

        await user.update(filteredUpdates);
        return user;
    } catch (error) {
        console.log('error in updateProfile in userService', error);
        throw error;
    }
}

module.exports = {
    registerFaculty,
    registerAdmin,
    login,
    logout,
    generatePasswordResetToken,
    resetUserPassword,
    changePassword,
    updateProfile
};