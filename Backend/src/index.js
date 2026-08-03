console.log("===== THIS IS SRC/INDEX.JS =====");
require("dotenv").config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');

const authRouter = require('./routes/userRoutes');
const billRoutes = require('./routes/billRoutes');
const SuperAdminApprovalRouter = require('./routes/superAdminApprovalRoutes');
const AdminApprovalRouter = require('./routes/adminApprovalRoutes');
const attendanceRoutes = require('./routes/attendanceRoutes');
const accountStatusRoutes = require('./routes/accountStatusRoutes');
const monthlySummaryRoutes = require('./routes/monthlySummaryRoutes');
const { startMonthlySummaryScheduler } = require('./scheduler/monthlySummaryScheduler');

// Load schemas to register relationships
require('./Schema');

const app = express();

app.use((req, res, next) => {
    console.log(req.method, req.url);
    next();
});

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use(cors({ origin: true, credentials: true, maxAge: 86400 }));
app.use(helmet());
app.use(morgan('dev'));
app.use(compression());

app.use('/api/auth', authRouter);
app.use('/api/bills', billRoutes);
app.use('/api/super_admin', SuperAdminApprovalRouter);
app.use('/api/admin', AdminApprovalRouter);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/account-status', accountStatusRoutes);
app.use('/api/monthly-summary', monthlySummaryRoutes);

const sequelize = require('./config/database');
const { User, Subject } = require('./Schema');
const PORT = process.env.PORT || 5000;

(async () => {
  try {
    await sequelize.authenticate();
    console.log('Database connected');
    // alter:{drop:false} — add/modify columns but NEVER drop FKs or constraints.
    // This prevents "constraint does not exist" errors on PostgreSQL during hot-reload.
    await sequelize.sync({ alter: { drop: false } });
    console.log('Database models synced');

    // Seed super admin
    const superAdminId = parseInt(process.env.SUPER_ADMIN_USER_ID || '1', 10);
    const superAdminEmail = process.env.SUPER_ADMIN_EMAIL || 'abc@gmail.com';
    const superAdminPassword = process.env.SUPER_ADMIN_PASSWORD || 'ADMIN';

    await User.findOrCreate({
      where: { user_id: superAdminId },
      defaults: {
        role: 'super_admin',
        email: superAdminEmail,
        password_hash: superAdminPassword,
        full_name: 'Super Admin',
        phone_number: '0000000000',
        is_approved: true,
        is_active: true,
      },
    });
    console.log('Super Admin seeded successfully');

    // Attempt CSV import if database is empty, else skip to save startup time
    const subjectCount = await Subject.count();
    if (subjectCount > 0) {
      console.log(`Database already has ${subjectCount} subjects. Skipping startup CSV import.`);
    } else {
      console.log("Database has no subjects. Running CSV import...");
      const { importSubjectsFromCSV } = require("./utils/csvImporter");
      const { seedSubjects } = require("./utils/seedSubjects");
      
      const csvResult = await importSubjectsFromCSV();
      if (!csvResult.success) {
        await seedSubjects();
      }
      console.log("Subject database initialized successfully");
    }

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);

      // ── Start the monthly summary auto-scheduler ────────────────────
      // Fires at 00:05 AM IST on the 1st of every month.
      // Generates PDF summaries for all active courses (previous month).
      startMonthlySummaryScheduler();
    });
  } catch (err) {
    console.error('Failed to start server:', err);
  }
})();
