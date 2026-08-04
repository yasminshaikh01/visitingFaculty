const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const compression = require("compression");

const authRouter = require("./routes/userRoutes");
const billRoutes = require("./routes/billRoutes");
const SuperAdminApprovalRouter = require("./routes/superAdminApprovalRoutes");
const AdminApprovalRouter = require("./routes/adminApprovalRoutes");
const attendanceRoutes = require("./routes/attendanceRoutes");
const accountStatusRoutes = require("./routes/accountStatusRoutes");
const monthlySummaryRoutes = require("./routes/monthlySummaryRoutes");

// Load schemas to register relationships
require("./Schema");

const app = express();

app.use((req, res, next) => {
  console.log(req.method, req.url);
  next();
});

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

app.use(cors({ origin: true, credentials: true }));
app.use(helmet());
app.use(morgan("dev"));
app.use(compression());

app.use("/api/auth", authRouter);
app.use("/api/bills", billRoutes);
app.use("/api/super_admin", SuperAdminApprovalRouter);
app.use("/api/admin", AdminApprovalRouter);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/account-status", accountStatusRoutes);
app.use("/api/monthly-summary", monthlySummaryRoutes);

module.exports = app;
