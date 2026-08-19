const request = require('supertest');
const jwt = require('jsonwebtoken');

// Set up environment variables for testing
process.env.JWT_SECRET = 'test_jwt_secret';
process.env.JWT_EXPIRE = '1h';

// Mock User schema/model
const mockUserInstance = {
  user_id: 1,
  email: 'test@example.com',
  full_name: 'Test User',
  role: 'faculty',
  is_approved: true,
  is_active: true,
  comparePassword: jest.fn(),
  update: jest.fn(),
};

const mockUserModel = {
  findOne: jest.fn(),
  findByPk: jest.fn(),
  create: jest.fn(),
};

jest.mock('../src/Schema/userSchema', () => mockUserModel);

jest.mock('../src/Schema', () => ({
  User: mockUserModel,
  sequelize: {
    authenticate: jest.fn().mockResolvedValue(),
    sync: jest.fn().mockResolvedValue(),
  },
}));

// Mock userService
const mockUserService = {
  registerFaculty: jest.fn(),
  registerAdmin: jest.fn(),
  login: jest.fn(),
  logout: jest.fn(),
  generatePasswordResetToken: jest.fn(),
  resetUserPassword: jest.fn(),
  changePassword: jest.fn(),
  updateProfile: jest.fn(),
};

jest.mock('../src/service/userService', () => mockUserService);

const mockAdminApprovalService = {
  updateUvfin: jest.fn(),
  approveFaculty: jest.fn(),
};
jest.mock('../src/service/adminApprovalService', () => mockAdminApprovalService);

// Import the app
const app = require('../src/app');

// Helper to generate a valid JWT for authenticated routes
function generateToken(userId = 1, role = 'faculty') {
  return jwt.sign({ user_id: userId, role }, process.env.JWT_SECRET);
}

// Helper to mock auth middleware User.findOne to pass auth
function mockAuthPass(userId = 1, role = 'faculty') {
  mockUserModel.findOne.mockResolvedValue({
    user_id: userId,
    role,
    is_approved: true,
    is_active: true,
  });
}

describe('Auth Routes – Comprehensive Edge Case Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ========================================================
  // POST /api/auth/register/faculty
  // ========================================================
  describe('POST /api/auth/register/faculty', () => {
    const validFacultyData = {
      email: 'faculty@example.com',
      full_name: 'Faculty Member',
      phone_number: '9876543210',
      password: 'StrongPass1',
      aadhaar_no: '123456789012',
      pan_card_no: 'ABCDE1234F',
      account_no: '12345678901234',
      bank_name: 'State Bank',
      ifsc_code: 'SBIN0001234',
      address: '123 Street',
      qualification: 'PhD',
    };

    it('should register faculty successfully with valid data', async () => {
      mockUserService.registerFaculty.mockResolvedValue({
        user_id: 10,
        email: validFacultyData.email,
        full_name: validFacultyData.full_name,
      });

      const res = await request(app)
        .post('/api/auth/register/faculty')
        .send(validFacultyData);

      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user_id).toBe(10);
      expect(res.body.data.email).toBe('faculty@example.com');
    });

    it('should return 400 when email already exists', async () => {
      mockUserService.registerFaculty.mockRejectedValue(new Error('Email already exist'));

      const res = await request(app)
        .post('/api/auth/register/faculty')
        .send(validFacultyData);

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.data).toContain('Email already exist');
    });

    it('should return 400 when aadhaar number already exists', async () => {
      mockUserService.registerFaculty.mockRejectedValue(new Error('Aadhaar Number already exist'));

      const res = await request(app)
        .post('/api/auth/register/faculty')
        .send(validFacultyData);

      expect(res.statusCode).toBe(400);
      expect(res.body.data).toContain('Aadhaar Number already exist');
    });

    it('should return 400 when PAN card number already exists', async () => {
      mockUserService.registerFaculty.mockRejectedValue(new Error('Pan Card Number already exist'));

      const res = await request(app)
        .post('/api/auth/register/faculty')
        .send(validFacultyData);

      expect(res.statusCode).toBe(400);
      expect(res.body.data).toContain('Pan Card Number already exist');
    });

    it('should return 400 when account number already exists', async () => {
      mockUserService.registerFaculty.mockRejectedValue(new Error('Account Number already exist'));

      const res = await request(app)
        .post('/api/auth/register/faculty')
        .send(validFacultyData);

      expect(res.statusCode).toBe(400);
      expect(res.body.data).toContain('Account Number already exist');
    });

    it('should return 400 when mobile number already exists', async () => {
      mockUserService.registerFaculty.mockRejectedValue(new Error('Mobile Number already exist'));

      const res = await request(app)
        .post('/api/auth/register/faculty')
        .send(validFacultyData);

      expect(res.statusCode).toBe(400);
      expect(res.body.data).toContain('Mobile Number already exist');
    });

    it('should return 400 when sending empty body', async () => {
      mockUserService.registerFaculty.mockRejectedValue(new Error('email is required'));

      const res = await request(app)
        .post('/api/auth/register/faculty')
        .send({});

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should return 400 when sending only partial data (missing password)', async () => {
      mockUserService.registerFaculty.mockRejectedValue(new Error('password is required'));

      const res = await request(app)
        .post('/api/auth/register/faculty')
        .send({ email: 'test@example.com', full_name: 'Test' });

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should use statusCode from error if set', async () => {
      const err = new Error('Conflict');
      err.statusCode = 409;
      mockUserService.registerFaculty.mockRejectedValue(err);

      const res = await request(app)
        .post('/api/auth/register/faculty')
        .send(validFacultyData);

      expect(res.statusCode).toBe(409);
    });
  });

  // ========================================================
  // POST /api/auth/register/admin
  // ========================================================
  describe('POST /api/auth/register/admin', () => {
    const validAdminData = {
      email: 'admin@example.com',
      full_name: 'Admin User',
      phone_number: '9876543210',
      password: 'AdminPass1',
    };

    it('should register admin successfully', async () => {
      mockUserService.registerAdmin.mockResolvedValue({
        user_id: 20,
        email: validAdminData.email,
        full_name: validAdminData.full_name,
      });

      const res = await request(app)
        .post('/api/auth/register/admin')
        .send(validAdminData);

      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user_id).toBe(20);
    });

    it('should return 400 when email already exists', async () => {
      mockUserService.registerAdmin.mockRejectedValue(new Error('Email already exist'));

      const res = await request(app)
        .post('/api/auth/register/admin')
        .send(validAdminData);

      expect(res.statusCode).toBe(400);
      expect(res.body.data).toContain('Email already exist');
    });

    it('should return 400 when mobile number already exists', async () => {
      mockUserService.registerAdmin.mockRejectedValue(new Error('Mobile Number already exist'));

      const res = await request(app)
        .post('/api/auth/register/admin')
        .send(validAdminData);

      expect(res.statusCode).toBe(400);
      expect(res.body.data).toContain('Mobile Number already exist');
    });

    it('should return 400 when sending empty body', async () => {
      mockUserService.registerAdmin.mockRejectedValue(new Error('email is required'));

      const res = await request(app)
        .post('/api/auth/register/admin')
        .send({});

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should return 400 when sending invalid email format', async () => {
      mockUserService.registerAdmin.mockRejectedValue(new Error('Invalid email format'));

      const res = await request(app)
        .post('/api/auth/register/admin')
        .send({ ...validAdminData, email: 'not-an-email' });

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  // ========================================================
  // POST /api/auth/login
  // ========================================================
  describe('POST /api/auth/login', () => {
    it('should login successfully with valid credentials', async () => {
      mockUserService.login.mockResolvedValue({
        user: {
          user_id: 1,
          role: 'faculty',
          full_name: 'Test User',
          email: 'test@example.com',
          uvfin: 'UV001',
        },
        token: 'jwt_token_here',
      });

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com', password: 'password123' });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.token).toBe('jwt_token_here');
      expect(res.body.data.user_id).toBe(1);
      expect(res.body.data.role).toBe('faculty');
    });

    it('should return 400 when email is missing', async () => {
      const err = new Error('Email and password are required');
      err.statusCode = 400;
      mockUserService.login.mockRejectedValue(err);

      const res = await request(app)
        .post('/api/auth/login')
        .send({ password: 'password123' });

      expect(res.statusCode).toBe(400);
      expect(res.body.data).toContain('Email and password are required');
    });

    it('should return 400 when password is missing', async () => {
      const err = new Error('Email and password are required');
      err.statusCode = 400;
      mockUserService.login.mockRejectedValue(err);

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com' });

      expect(res.statusCode).toBe(400);
      expect(res.body.data).toContain('Email and password are required');
    });

    it('should return 400 when sending empty body', async () => {
      const err = new Error('Email and password are required');
      err.statusCode = 400;
      mockUserService.login.mockRejectedValue(err);

      const res = await request(app)
        .post('/api/auth/login')
        .send({});

      expect(res.statusCode).toBe(400);
    });

    it('should return 401 when email does not exist', async () => {
      mockUserService.login.mockRejectedValue(new Error('Invalid credentials'));

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'nonexistent@example.com', password: 'password123' });

      expect(res.statusCode).toBe(401);
      expect(res.body.data).toContain('Invalid credentials');
    });

    it('should return 401 when password is wrong', async () => {
      mockUserService.login.mockRejectedValue(new Error('Invalid credentials'));

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com', password: 'wrongpassword' });

      expect(res.statusCode).toBe(401);
      expect(res.body.data).toContain('Invalid credentials');
    });

    it('should return 401 when account is pending approval', async () => {
      mockUserService.login.mockRejectedValue(new Error('account is pending approval'));

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com', password: 'password123' });

      expect(res.statusCode).toBe(401);
      expect(res.body.data).toContain('account is pending approval');
    });

    it('should return 401 when account is deactivated', async () => {
      mockUserService.login.mockRejectedValue(new Error('account is deactivated'));

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com', password: 'password123' });

      expect(res.statusCode).toBe(401);
      expect(res.body.data).toContain('account is deactivated');
    });

    it('should return uvfin as null when user has no uvfin', async () => {
      mockUserService.login.mockResolvedValue({
        user: {
          user_id: 1,
          role: 'faculty',
          full_name: 'Test User',
          email: 'test@example.com',
          uvfin: undefined,
        },
        token: 'jwt_token',
      });

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com', password: 'password123' });

      expect(res.statusCode).toBe(200);
      expect(res.body.data.uvfin).toBeNull();
    });
  });

  // ========================================================
  // POST /api/auth/logout
  // ========================================================
  describe('POST /api/auth/logout', () => {
    it('should return 401 when no token is provided', async () => {
      const res = await request(app).post('/api/auth/logout');

      expect(res.statusCode).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Authentication required');
    });

    it('should return 401 when token is invalid/malformed', async () => {
      const res = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', 'Bearer invalid_garbage_token');

      expect(res.statusCode).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should return 401 when token is expired', async () => {
      const expiredToken = jwt.sign(
        { user_id: 1, role: 'faculty' },
        process.env.JWT_SECRET,
        { expiresIn: '0s' }
      );
      // wait tiny bit for it to expire
      await new Promise(r => setTimeout(r, 100));

      const res = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${expiredToken}`);

      expect(res.statusCode).toBe(401);
      expect(res.body.message).toContain('expired');
    });

    it('should return 401 when user from token is not found/inactive', async () => {
      const token = generateToken(999, 'faculty');
      mockUserModel.findOne.mockResolvedValue(null);

      const res = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${token}`);

      expect(res.statusCode).toBe(401);
      expect(res.body.message).toContain('User not found');
    });

    it('should return 403 when user is not approved', async () => {
      const token = generateToken(1, 'faculty');
      mockUserModel.findOne.mockResolvedValue({
        user_id: 1,
        role: 'faculty',
        is_approved: false,
        is_active: true,
      });

      const res = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${token}`);

      expect(res.statusCode).toBe(403);
      expect(res.body.message).toContain('pending approval');
    });

    it('should logout successfully with valid token', async () => {
      const token = generateToken(1, 'faculty');
      mockAuthPass(1, 'faculty');
      mockUserService.logout.mockResolvedValue({ success: true });

      const res = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${token}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Logout successful');
      expect(mockUserService.logout).toHaveBeenCalledWith(1);
    });

    it('should return 400 when logout service throws (user not found)', async () => {
      const token = generateToken(1, 'faculty');
      mockAuthPass(1, 'faculty');
      mockUserService.logout.mockRejectedValue(new Error('User not found'));

      const res = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${token}`);

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  // ========================================================
  // POST /api/auth/forgotPassword
  // ========================================================
  describe('POST /api/auth/forgotPassword', () => {
    it('should send reset link successfully', async () => {
      mockUserService.generatePasswordResetToken.mockResolvedValue({
        message: 'Reset link has been sent to your email.',
      });

      const res = await request(app)
        .post('/api/auth/forgotPassword')
        .send({ email: 'test@example.com' });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Reset link has been sent to your email.');
    });

    it('should return 400 when email is missing', async () => {
      const res = await request(app)
        .post('/api/auth/forgotPassword')
        .send({});

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toBe('Email is required.');
    });

    it('should return 400 when email is empty string', async () => {
      const res = await request(app)
        .post('/api/auth/forgotPassword')
        .send({ email: '' });

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toBe('Email is required.');
    });

    it('should return 500 when user not found with email', async () => {
      mockUserService.generatePasswordResetToken.mockRejectedValue(
        new Error('User not found with this email.')
      );

      const res = await request(app)
        .post('/api/auth/forgotPassword')
        .send({ email: 'nonexistent@example.com' });

      expect(res.statusCode).toBe(500);
      expect(res.body.message).toBe('User not found with this email.');
    });

    it('should return 500 when email sending fails', async () => {
      mockUserService.generatePasswordResetToken.mockRejectedValue(
        new Error('Failed to send reset email. Please try again.')
      );

      const res = await request(app)
        .post('/api/auth/forgotPassword')
        .send({ email: 'test@example.com' });

      expect(res.statusCode).toBe(500);
      expect(res.body.message).toContain('Failed to send reset email');
    });
  });

  // ========================================================
  // POST /api/auth/resetPassword
  // ========================================================
  describe('POST /api/auth/resetPassword', () => {
    it('should reset password successfully', async () => {
      mockUserService.resetUserPassword.mockResolvedValue({
        message: 'Your password has been successfully reset.',
      });

      const res = await request(app)
        .post('/api/auth/resetPassword')
        .send({ token: 'valid_reset_token', newPassword: 'NewPass123' });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Your password has been successfully reset.');
    });

    it('should return 400 when token is missing', async () => {
      const res = await request(app)
        .post('/api/auth/resetPassword')
        .send({ newPassword: 'NewPass123' });

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toBe('Token and new password are required.');
    });

    it('should return 400 when newPassword is missing', async () => {
      const res = await request(app)
        .post('/api/auth/resetPassword')
        .send({ token: 'some_token' });

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toBe('Token and new password are required.');
    });

    it('should return 400 when both token and newPassword are missing', async () => {
      const res = await request(app)
        .post('/api/auth/resetPassword')
        .send({});

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toBe('Token and new password are required.');
    });

    it('should return 500 when token is invalid or expired', async () => {
      mockUserService.resetUserPassword.mockRejectedValue(
        new Error('Password reset token is invalid or has expired.')
      );

      const res = await request(app)
        .post('/api/auth/resetPassword')
        .send({ token: 'expired_token', newPassword: 'NewPass123' });

      expect(res.statusCode).toBe(500);
      expect(res.body.message).toBe('Password reset token is invalid or has expired.');
    });

    it('should return 500 when token is a random garbage string', async () => {
      mockUserService.resetUserPassword.mockRejectedValue(
        new Error('Password reset token is invalid or has expired.')
      );

      const res = await request(app)
        .post('/api/auth/resetPassword')
        .send({ token: 'xyzgarbage123', newPassword: 'NewPass123' });

      expect(res.statusCode).toBe(500);
      expect(res.body.message).toContain('invalid or has expired');
    });
  });

  // ========================================================
  // PUT /api/auth/changePassword
  // ========================================================
  describe('PUT /api/auth/changePassword', () => {
    it('should return 401 when not authenticated (no token)', async () => {
      const res = await request(app)
        .put('/api/auth/changePassword')
        .send({ oldPassword: 'old', newPassword: 'new' });

      expect(res.statusCode).toBe(401);
    });

    it('should return 401 when token is invalid', async () => {
      const res = await request(app)
        .put('/api/auth/changePassword')
        .set('Authorization', 'Bearer garbage')
        .send({ oldPassword: 'old', newPassword: 'new' });

      expect(res.statusCode).toBe(401);
    });

    it('should change password successfully with oldPassword', async () => {
      const token = generateToken(1, 'faculty');
      mockAuthPass(1, 'faculty');
      mockUserService.changePassword.mockResolvedValue({
        message: 'password changed successfully',
      });

      const res = await request(app)
        .put('/api/auth/changePassword')
        .set('Authorization', `Bearer ${token}`)
        .send({ oldPassword: 'OldPass123', newPassword: 'NewPass456' });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('password changed successfully');
      // Verify it was called with auth user_id (from token), not from body
      expect(mockUserService.changePassword).toHaveBeenCalledWith(
        expect.any(Number),
        'OldPass123',
        'NewPass456'
      );
    });

    it('should change password when using currentPassword instead of oldPassword', async () => {
      const token = generateToken(1, 'faculty');
      mockAuthPass(1, 'faculty');
      mockUserService.changePassword.mockResolvedValue({
        message: 'password changed successfully',
      });

      const res = await request(app)
        .put('/api/auth/changePassword')
        .set('Authorization', `Bearer ${token}`)
        .send({ currentPassword: 'OldPass123', newPassword: 'NewPass456' });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should return 500 when old password does not match', async () => {
      const token = generateToken(1, 'faculty');
      mockAuthPass(1, 'faculty');
      mockUserService.changePassword.mockRejectedValue(
        new Error('password does not match')
      );

      const res = await request(app)
        .put('/api/auth/changePassword')
        .set('Authorization', `Bearer ${token}`)
        .send({ oldPassword: 'WrongPass', newPassword: 'NewPass456' });

      expect(res.statusCode).toBe(500);
      expect(res.body.message).toContain('password does not match');
    });

    it('should return 500 when user not found', async () => {
      const token = generateToken(1, 'faculty');
      mockAuthPass(1, 'faculty');
      mockUserService.changePassword.mockRejectedValue(
        new Error('user not found')
      );

      const res = await request(app)
        .put('/api/auth/changePassword')
        .set('Authorization', `Bearer ${token}`)
        .send({ oldPassword: 'OldPass', newPassword: 'NewPass' });

      expect(res.statusCode).toBe(500);
      expect(res.body.message).toContain('user not found');
    });

    it('should handle sending empty body when authenticated', async () => {
      const token = generateToken(1, 'faculty');
      mockAuthPass(1, 'faculty');
      // With no oldPassword/currentPassword, the controller sends undefined to service
      mockUserService.changePassword.mockRejectedValue(
        new Error('password does not match')
      );

      const res = await request(app)
        .put('/api/auth/changePassword')
        .set('Authorization', `Bearer ${token}`)
        .send({});

      expect(res.statusCode).toBe(500);
      expect(res.body.success).toBe(false);
    });

    // ⚠️ PRIVILEGE ESCALATION TEST – This tests the CURRENT (unfixed) behavior
    it('should accept user_id from body (privilege escalation risk in current code)', async () => {
      const token = generateToken(1, 'faculty');
      mockAuthPass(1, 'faculty');
      mockUserService.changePassword.mockResolvedValue({
        message: 'password changed successfully',
      });

      const res = await request(app)
        .put('/api/auth/changePassword')
        .set('Authorization', `Bearer ${token}`)
        .send({
          user_id: 999, // trying to change another user's password
          oldPassword: 'OldPass',
          newPassword: 'NewPass',
        });

      expect(res.statusCode).toBe(200);
      // BUG: changePassword was called with user_id=999 (from body), not 1 (from token)
      expect(mockUserService.changePassword).toHaveBeenCalledWith(
        999, // THIS IS THE BUG – should be 1 from the auth token
        'OldPass',
        'NewPass'
      );
    });
  });

  // ========================================================
  // PUT /api/auth/update/:user_id
  // ========================================================
  describe('PUT /api/auth/update/:user_id', () => {
    it('should return 401 when not authenticated', async () => {
      const res = await request(app)
        .put('/api/auth/update/1')
        .send({ full_name: 'Updated' });

      expect(res.statusCode).toBe(401);
    });

    it('should return 401 when token is invalid', async () => {
      const res = await request(app)
        .put('/api/auth/update/1')
        .set('Authorization', 'Bearer invalid_token')
        .send({ full_name: 'Updated' });

      expect(res.statusCode).toBe(401);
    });

    it('should update profile successfully', async () => {
      const token = generateToken(1, 'faculty');
      mockAuthPass(1, 'faculty');
      mockUserService.updateProfile.mockResolvedValue({
        user_id: 1,
        full_name: 'Updated Name',
        email: 'test@example.com',
      });

      const res = await request(app)
        .put('/api/auth/update/1')
        .set('Authorization', `Bearer ${token}`)
        .send({ full_name: 'Updated Name' });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Profile updated successfully');
    });

    it('should pass user_id as string from URL params', async () => {
      const token = generateToken(1, 'faculty');
      mockAuthPass(1, 'faculty');
      mockUserService.updateProfile.mockResolvedValue({ message: 'updated' });

      await request(app)
        .put('/api/auth/update/1')
        .set('Authorization', `Bearer ${token}`)
        .send({ full_name: 'Test' });

      // Note: user_id from req.params is always a string
      expect(mockUserService.updateProfile).toHaveBeenCalledWith('1', { full_name: 'Test' });
    });

    it('should return 500 when user not found', async () => {
      const token = generateToken(1, 'faculty');
      mockAuthPass(1, 'faculty');
      mockUserService.updateProfile.mockRejectedValue(new Error('User not found.'));

      const res = await request(app)
        .put('/api/auth/update/999')
        .set('Authorization', `Bearer ${token}`)
        .send({ full_name: 'Test' });

      expect(res.statusCode).toBe(500);
      expect(res.body.message).toContain('User not found');
    });

    it('should handle update with non-allowed fields (they should be filtered)', async () => {
      const token = generateToken(1, 'faculty');
      mockAuthPass(1, 'faculty');
      mockUserService.updateProfile.mockResolvedValue({ user_id: 1 });

      const res = await request(app)
        .put('/api/auth/update/1')
        .set('Authorization', `Bearer ${token}`)
        .send({
          role: 'super_admin',       // should NOT be updatable
          is_approved: true,         // should NOT be updatable
          password_hash: 'hacked',   // should NOT be updatable
          full_name: 'Legit Update', // allowed
        });

      expect(res.statusCode).toBe(200);
      // The service receives the full body, but internally filters allowed fields
      expect(mockUserService.updateProfile).toHaveBeenCalledWith(
        '1',
        expect.objectContaining({
          role: 'super_admin',
          full_name: 'Legit Update',
        })
      );
    });

    it('should handle empty update body', async () => {
      const token = generateToken(1, 'faculty');
      mockAuthPass(1, 'faculty');
      mockUserService.updateProfile.mockResolvedValue({ user_id: 1 });

      const res = await request(app)
        .put('/api/auth/update/1')
        .set('Authorization', `Bearer ${token}`)
        .send({});

      expect(res.statusCode).toBe(200);
    });

    // ⚠️ PRIVILEGE ESCALATION TEST – any user can update any other user's profile
    it('should allow user to update another user profile (privilege escalation risk)', async () => {
      const token = generateToken(1, 'faculty'); // user 1 is logged in
      mockAuthPass(1, 'faculty');
      mockUserService.updateProfile.mockResolvedValue({ user_id: 50 });

      const res = await request(app)
        .put('/api/auth/update/50') // but updating user 50's profile
        .set('Authorization', `Bearer ${token}`)
        .send({ full_name: 'Hacked Name' });

      // BUG: This should be 403, but current code allows it
      expect(res.statusCode).toBe(200);
      expect(mockUserService.updateProfile).toHaveBeenCalledWith('50', { full_name: 'Hacked Name' });
    });

    it('should handle non-numeric user_id in params', async () => {
      const token = generateToken(1, 'faculty');
      mockAuthPass(1, 'faculty');
      mockUserService.updateProfile.mockResolvedValue({ user_id: 1 });

      const res = await request(app)
        .put('/api/auth/update/abc')
        .set('Authorization', `Bearer ${token}`)
        .send({ full_name: 'Test' });

      // Current code doesn't validate user_id format – service will receive 'abc'
      expect(mockUserService.updateProfile).toHaveBeenCalledWith('abc', { full_name: 'Test' });
    });
  });

  // ========================================================
  // AUTH MIDDLEWARE EDGE CASES (applies to all protected routes)
  // ========================================================
  describe('Auth Middleware Edge Cases', () => {
    it('should return 401 when Authorization header has no Bearer prefix', async () => {
      const token = generateToken(1, 'faculty');

      const res = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', token); // Missing "Bearer " prefix

      expect(res.statusCode).toBe(401);
    });

    it('should return 401 when Authorization header is "Bearer " with empty token', async () => {
      const res = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', 'Bearer ');

      expect(res.statusCode).toBe(401);
    });

    it('should return 401 when JWT_SECRET is wrong (token signed with different secret)', async () => {
      const wrongSecretToken = jwt.sign(
        { user_id: 1, role: 'faculty' },
        'wrong_secret'
      );

      const res = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${wrongSecretToken}`);

      expect(res.statusCode).toBe(401);
      expect(res.body.message).toContain('Invalid token');
    });
  });
});
