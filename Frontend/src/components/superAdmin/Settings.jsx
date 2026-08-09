import React, { useState, useEffect } from "react";
import Topbar from "./Topbar";
import {
  Download,
  Printer,
  ClipboardList,
  CheckCircle2,
  XCircle,
  X,
} from "lucide-react";
import api from "../../api/axiosInstance"; // Adjust the ../ as needed based on folder depth

const tabs = ["General", "Security", "Audit Log"];

// UPDATED: Added onMenuClick prop
export default function Settings({ onMenuClick }) {
  const [searchQuery, setSearchQuery] = useState("");

  const [activeTab, setActiveTab] = useState(() => {
    const savedSettingsTab = localStorage.getItem("iipsSettingsTab");
    return savedSettingsTab || "General";
  });

  useEffect(() => {
    localStorage.setItem("iipsSettingsTab", activeTab);
  }, [activeTab]);

  const [toast, setToast] = useState({
    show: false,
    message: "",
    type: "success",
  });

  const showToast = (message, type = "success") => {
    setToast({ show: true, message, type });
    setTimeout(() => {
      setToast((prev) => ({ ...prev, show: false }));
    }, 3500);
  };

  const [auditFilter, setAuditFilter] = useState("Select...");
  const [logs, setLogs] = useState([]);

  // NEW: Dynamic System Stats State
  const [sysStats, setSysStats] = useState([
    { label: "System Version", value: "VFM 1.0" },
    { label: "Total Program Incharge Requests", value: "..." },
    { label: "Approved Program Incharges", value: "..." },
    { label: "Pending Reviews", value: "..." },
    { label: "Last Activity", value: "..." },
  ]);

  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [passwords, setPasswords] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  const [profileData, setProfileData] = useState({
    full_name: "",
    email: "",
    phone_number: "",
  });
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);

  useEffect(() => {
    const session = JSON.parse(
      localStorage.getItem("iipsCurrentSession") || "{}",
    );
    if (session && Object.keys(session).length > 0) {
      setProfileData({
        full_name: session.name || session.full_name || "",
        email: session.email || "",
        phone_number: session.phone_number || "",
      });
    }
  }, []);

  const handleProfileUpdate = async () => {
    setIsUpdatingProfile(true);
    try {
      const session = JSON.parse(
        localStorage.getItem("iipsCurrentSession") || "{}",
      );

      const currentUserId = session.userId || session.user_id || session.id;

      if (!session.token || !currentUserId) {
        throw new Error("No active session found. Please log in again.");
      }

      const response = await api.put(
        `/auth/update/${currentUserId}`,
        profileData,
      );

      if (response.data.success) {
        showToast("Profile updated successfully!", "success");
        session.name = profileData.full_name;
        localStorage.setItem("iipsCurrentSession", JSON.stringify(session));
        
        // Dispatch event so sidebar instantly updates your name
        window.dispatchEvent(new Event('refresh-dashboard'));
      }
    } catch (err) {
      console.error("Error updating profile:", err);
      showToast(
        err.response?.data?.message ||
          err.message ||
          "Failed to update profile.",
        "error",
      );
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  const handleChangePassword = async () => {
    if (
      !passwords.currentPassword ||
      !passwords.newPassword ||
      !passwords.confirmPassword
    ) {
      return showToast("Please fill in all password fields.", "error");
    }
    if (passwords.newPassword !== passwords.confirmPassword) {
      return showToast("New passwords do not match!", "error");
    }
    if (passwords.newPassword.length < 8) {
      return showToast("New password must be at least 8 characters.", "error");
    }

    setIsUpdatingPassword(true);
    try {
      const session = JSON.parse(
        localStorage.getItem("iipsCurrentSession") || "{}",
      );

      const currentUserId = session.userId || session.user_id || session.id;

      if (!session.token || !currentUserId) {
        throw new Error("No active session found. Please log in again.");
      }

      const response = await api.put(`/auth/changePassword`, {
        user_id: currentUserId,
        oldPassword: passwords.currentPassword,
        newPassword: passwords.newPassword,
      });

      if (response.data.success) {
        showToast("Password changed successfully!", "success");
        setPasswords({
          currentPassword: "",
          newPassword: "",
          confirmPassword: "",
        });
      }
    } catch (err) {
      console.error("Error changing password:", err);
      showToast(
        err.response?.data?.message ||
          err.message ||
          "Failed to change password.",
        "error",
      );
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const fetchAuditLogs = async () => {
    try {
      const session = JSON.parse(
        localStorage.getItem("iipsCurrentSession") || "{}",
      );
      if (!session.token) return;

      const response = await api.get("/super_admin/allAdmin");
      const processedLogs = response.data.data.filter(
        (admin) =>
          admin.AdminApproval?.status === "approved" ||
          admin.AdminApproval?.status === "rejected" ||
          admin.is_approved,
      );
      setLogs(processedLogs);
    } catch (err) {
      console.error("Error loading logs", err);
    }
  };

  // NEW: Fetch dynamic system stats from API
  const fetchSystemStats = async () => {
    try {
      const session = JSON.parse(localStorage.getItem('iipsCurrentSession') || '{}');
      if (!session.token) return;

      const response = await api.get("/super_admin/dashboardStats");
      if (response.data && response.data.success) {
        const d = response.data.data;
        
        let lastLoginStr = "N/A";
        if (d.superAdminActivity?.last_login) {
          const dateObj = new Date(d.superAdminActivity.last_login);
          if (!isNaN(dateObj.getTime())) {
            lastLoginStr = dateObj.toLocaleString("en-GB", {
              day: "2-digit", month: "short", year: "numeric",
              hour: "2-digit", minute: "2-digit", hour12: true
            }).toUpperCase();
          }
        }

        setSysStats([
          { label: "System Version", value: "VFM 1.0" },
          { label: "Total Program Incharge Requests", value: String(d.totalAdmin || 0) },
          { label: "Approved Program Incharges", value: String(d.approvedAdmin || 0) },
          { label: "Pending Reviews", value: String(d.pendingAdmin || 0) },
          { label: "Last Activity", value: lastLoginStr },
        ]);
      }
    } catch (err) {
      console.error("Error fetching system stats", err);
    }
  };

  useEffect(() => {
    if (activeTab === "Audit Log") fetchAuditLogs();
    if (activeTab === "General") fetchSystemStats();
  }, [activeTab]);

  // Listen for global refresh events to auto-update the audit logs AND system stats
  useEffect(() => {
    const handleRefresh = () => {
      if (activeTab === "Audit Log") fetchAuditLogs();
      if (activeTab === "General") fetchSystemStats();
    };
    window.addEventListener('refresh-dashboard', handleRefresh);
    return () => window.removeEventListener('refresh-dashboard', handleRefresh);
  }, [activeTab]);

  // Bulletproofed status logic
  const getLogStatus = (log) => {
    if (log.AdminApproval && log.AdminApproval.status) {
      const stat = String(log.AdminApproval.status);
      return stat.charAt(0).toUpperCase() + stat.slice(1);
    }
    return log.is_approved ? "Approved" : "Rejected";
  };

  // Bulletproofed search filtering logic
  const filteredLogs = logs.filter((log) => {
    const status = getLogStatus(log);

    const matchesDropdown =
      auditFilter === "Select..." || status === auditFilter;

    const lowerQuery = (searchQuery || "").toLowerCase();
    const matchesSearch =
      !searchQuery ||
      (log.full_name &&
        String(log.full_name).toLowerCase().includes(lowerQuery)) ||
      String(status).toLowerCase().includes(lowerQuery);

    return matchesDropdown && matchesSearch;
  });

  const exportToCSV = () => {
    const headers = [
      "Sr.",
      "Action",
      "Program Incharge Name",
      "Performed By",
      "Date",
    ];
    const csvContent = [
      headers.join(","),
      ...filteredLogs.map((l, i) => {
        // Used a shorter DD/MM/YYYY format so it fits in Excel without the "########" issue
        const dateStr = l.updated_at
          ? new Date(l.updated_at).toLocaleDateString("en-GB")
          : "-";

        return [
          i + 1,
          getLogStatus(l),
          l.full_name || "Unknown",
          "Super Admin",
          dateStr,
        ].join(",");
      }),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit_log_${new Date().toLocaleDateString("en-GB").replace(/\//g, "-")}.csv`;
    a.click();
  };

  const handlePrint = () => window.print();

  return (
    <div className="flex-1 bg-gray-50 min-h-screen relative overflow-hidden">
      {/* Extensive print CSS to enforce consistent, full-width mobile view during printing */}
      <style>{`
        @media print {
          @page { margin: 0.5cm; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          
          body * { visibility: hidden; }
          #audit-log-container, #audit-log-container * { visibility: visible; }
          .no-print { display: none !important; }
          
          #audit-log-container { 
            position: absolute; 
            left: 0; 
            top: 0; 
            width: 100% !important; 
            margin: 0 !important;
            padding: 10px !important;
            border: none !important; 
            box-shadow: none !important; 
          }

          /* Force overflow visible so table isn't cut off on the right */
          .print-table-wrapper {
            overflow: visible !important;
          }

          table {
            width: 100% !important;
            table-layout: auto !important;
            font-size: 12px !important;
          }

          th, td {
            white-space: normal !important;
            word-break: break-word !important;
            padding: 8px !important;
          }
        }
      `}</style>

      {toast.show && (
        <div
          className={`fixed top-6 right-6 z-[9999] flex items-center gap-3 px-4 py-3.5 rounded-xl shadow-xl border animate-in slide-in-from-top-4 fade-in duration-300 ${
            toast.type === "success"
              ? "bg-white border-green-100 text-green-800"
              : "bg-white border-red-100 text-red-800"
          }`}
        >
          {toast.type === "success" ? (
            <div className="bg-green-100 text-green-600 rounded-full p-1">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          ) : (
            <div className="bg-red-100 text-red-600 rounded-full p-1">
              <XCircle className="w-5 h-5" />
            </div>
          )}
          <p className="text-sm font-semibold pr-4">{toast.message}</p>
          <button
            onClick={() => setToast({ ...toast, show: false })}
            className="text-gray-400 hover:text-gray-600 transition-colors ml-auto shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="no-print">
        {/* Passed onMenuClick to Topbar */}
        <Topbar
          title="Settings"
          subtitle="System-wide configuration, security and audit log"
          showSearch={activeTab === "Audit Log"}
          onSearch={setSearchQuery}
          onMenuClick={onMenuClick}
        />
      </div>

      <div className="px-4 sm:px-8 py-8 pb-24 max-w-full">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-1 no-print">
          Settings
        </h1>
        <p className="text-sm sm:text-base text-gray-400 mb-6 no-print">
          System-wide configuration, security and audit log
        </p>

        <div className="overflow-x-auto hide-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0 mb-6 no-print">
          <div className="inline-flex bg-gray-100 rounded-full p-1 whitespace-nowrap min-w-max">
            {tabs.map((tab) => {
              const isAudit = tab === "Audit Log";
              const isActive = activeTab === tab;
              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 sm:px-5 py-2 rounded-full text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-white text-gray-900 shadow-sm"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {tab}
                  {isAudit && (
                    <span className="text-gray-400 font-normal">
                      {" "}
                      ({filteredLogs.length})
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {activeTab === "General" && (
          <div className="flex flex-col lg:flex-row gap-6">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-8 flex-1 max-w-2xl">
              <h3 className="font-bold text-gray-900 mb-6">
                Super Admin Account
              </h3>

              <div className="space-y-5">
                <div>
                  <label className="text-sm font-semibold text-gray-700 mb-2 block">
                    Display Name
                  </label>
                  <input
                    value={profileData.full_name}
                    onChange={(e) =>
                      setProfileData({
                        ...profileData,
                        full_name: e.target.value,
                      })
                    }
                    placeholder="Enter full name"
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-gray-800 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-gray-400"
                  />
                </div>

                <div>
                  <label className="text-sm font-semibold text-gray-700 mb-2 block">
                    Email Address
                  </label>
                  <input
                    value={profileData.email}
                    onChange={(e) =>
                      setProfileData({ ...profileData, email: e.target.value })
                    }
                    placeholder="Enter email address"
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-gray-800 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-gray-400"
                  />
                </div>

                <div>
                  <label className="text-sm font-semibold text-gray-700 mb-2 block">
                    Mobile
                  </label>
                  <input
                    value={profileData.phone_number}
                    onChange={(e) =>
                      setProfileData({
                        ...profileData,
                        phone_number: e.target.value,
                      })
                    }
                    placeholder="Enter mobile number"
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-gray-800 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-gray-400"
                  />
                </div>

                <button
                  onClick={handleProfileUpdate}
                  disabled={isUpdatingProfile}
                  className="w-full sm:w-auto justify-center bg-[#004DD2] hover:bg-[#003bb3] text-white font-semibold px-6 py-3 rounded-xl transition-all shadow-md mt-2 disabled:opacity-70 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isUpdatingProfile ? "Updating..." : "Update Profile"}
                </button>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-8 flex-1 max-w-md h-fit">
              <h3 className="font-bold text-gray-900 mb-6">
                System Information
              </h3>
              <div className="flex flex-col divide-y divide-gray-100">
                {/* UPDATED: Dynamic System Stats mapping */}
                {sysStats.map((item) => (
                  <div
                    key={item.label}
                    className="flex flex-col sm:flex-row sm:items-center justify-between py-3.5 first:pt-0 gap-1 sm:gap-0"
                  >
                    <span className="text-gray-400 text-sm">{item.label}</span>
                    <span className="text-gray-900 font-semibold text-sm text-right">
                      {item.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === "Security" && (
          <div className="flex flex-col lg:flex-row gap-6">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-8 flex-1 max-w-2xl">
              <h3 className="font-bold text-gray-900 mb-6">Change Password</h3>
              <div className="space-y-5">
                <div>
                  <label className="text-sm font-semibold text-gray-700 mb-2 block">
                    Current Password
                  </label>
                  <div className="relative">
                    <input
                      type={showCurrentPassword ? "text" : "password"}
                      value={passwords.currentPassword}
                      onChange={(e) =>
                        setPasswords({
                          ...passwords,
                          currentPassword: e.target.value,
                        })
                      }
                      placeholder="••••••••"
                      className="w-full border border-gray-200 rounded-xl px-4 py-3 pr-12 text-gray-800 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setShowCurrentPassword(!showCurrentPassword)
                      }
                      className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-gray-400 hover:text-[#004DD2] transition-colors focus:outline-none"
                    >
                      {showCurrentPassword ? (
                        <svg
                          className="h-5 w-5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
                          <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
                          <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
                          <line x1="2" y1="2" x2="22" y2="22" />
                        </svg>
                      ) : (
                        <svg
                          className="h-5 w-5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-semibold text-gray-700 mb-2 block">
                    New Password
                  </label>
                  <div className="relative">
                    <input
                      type={showNewPassword ? "text" : "password"}
                      value={passwords.newPassword}
                      onChange={(e) =>
                        setPasswords({
                          ...passwords,
                          newPassword: e.target.value,
                        })
                      }
                      placeholder="Minimum 8 characters"
                      className="w-full border border-gray-200 rounded-xl px-4 py-3 pr-12 text-gray-800 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-gray-400 hover:text-[#004DD2] transition-colors focus:outline-none"
                    >
                      {showNewPassword ? (
                        <svg
                          className="h-5 w-5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
                          <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
                          <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
                          <line x1="2" y1="2" x2="22" y2="22" />
                        </svg>
                      ) : (
                        <svg
                          className="h-5 w-5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-semibold text-gray-700 mb-2 block">
                    Confirm New Password
                  </label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      value={passwords.confirmPassword}
                      onChange={(e) =>
                        setPasswords({
                          ...passwords,
                          confirmPassword: e.target.value,
                        })
                      }
                      placeholder="Re-enter password"
                      className="w-full border border-gray-200 rounded-xl px-4 py-3 pr-12 text-gray-800 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setShowConfirmPassword(!showConfirmPassword)
                      }
                      className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-gray-400 hover:text-[#004DD2] transition-colors focus:outline-none"
                    >
                      {showConfirmPassword ? (
                        <svg
                          className="h-5 w-5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
                          <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
                          <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
                          <line x1="2" y1="2" x2="22" y2="22" />
                        </svg>
                      ) : (
                        <svg
                          className="h-5 w-5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>

                <button
                  onClick={handleChangePassword}
                  disabled={isUpdatingPassword}
                  className="w-full sm:w-auto justify-center bg-[#004DD2] hover:bg-[#003bb3] text-white font-semibold px-6 py-3 rounded-xl transition-all shadow-md disabled:opacity-70 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isUpdatingPassword ? "Changing..." : "Change Password"}
                </button>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-8 flex-1 max-w-md h-fit">
              <h3 className="font-bold text-gray-900 mb-6">Session & Access</h3>
              <div className="space-y-6">
                {[
                  {
                    label: "Session Timeout",
                    sub: "Auto-logout after inactivity",
                  },
                  { label: "Two-Factor Auth", sub: "OTP via registered email" },
                  {
                    label: "Login Attempts",
                    sub: "Lock after 5 failed attempts",
                  },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="flex items-center justify-between gap-4"
                  >
                    <div>
                      <p className="text-sm font-semibold text-gray-900">
                        {item.label}
                      </p>
                      <p className="text-xs text-gray-400">{item.sub}</p>
                    </div>
                    <input
                      type="checkbox"
                      defaultChecked
                      className="w-5 h-5 accent-[#8B5CF6] text-[#8B5CF6] rounded cursor-pointer shrink-0"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === "Audit Log" && (
          <div
            id="audit-log-container"
            className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-8"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4 no-print">
              <h3 className="font-bold text-gray-900">Audit Log</h3>
              <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
                <select
                  value={auditFilter}
                  onChange={(e) => setAuditFilter(e.target.value)}
                  className="flex-1 sm:flex-none border px-4 py-2 rounded-full text-sm outline-none focus:border-blue-500"
                >
                  <option>Select...</option>
                  <option>Approved</option>
                  <option>Rejected</option>
                </select>
                <button
                  onClick={exportToCSV}
                  className="flex-1 sm:flex-none justify-center flex items-center gap-2 border rounded-full px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                >
                  <Download className="w-4 h-4 shrink-0" /> Export CSV
                </button>
                <button
                  onClick={handlePrint}
                  className="flex-1 sm:flex-none justify-center flex items-center gap-2 border rounded-full px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                >
                  <Printer className="w-4 h-4 shrink-0" /> Print
                </button>
              </div>
            </div>

            <div className="overflow-x-auto hide-scrollbar print-table-wrapper">
              <table className="w-full text-left min-w-[500px]">
                <thead>
                  <tr className="text-xs font-semibold text-gray-400 border-b border-gray-100 uppercase">
                    <th className="py-3 whitespace-nowrap pr-4">Sr.</th>
                    <th className="py-3 whitespace-nowrap pr-4">Action</th>
                    <th className="py-3 whitespace-nowrap pr-4">
                      Program Incharge Name
                    </th>
                    <th className="py-3 whitespace-nowrap pr-4">
                      Performed By
                    </th>
                    <th className="py-3 whitespace-nowrap">Date</th>
                  </tr>
                </thead>
                <tbody className="text-sm">
                  {filteredLogs.length === 0 ? (
                    <tr>
                      <td
                        colSpan="5"
                        className="py-16 text-center text-gray-500 text-sm"
                      >
                        {searchQuery ? (
                          <span>
                            No Program Incharges found matching "{searchQuery}".
                          </span>
                        ) : (
                          <span>No audit logs found in the system.</span>
                        )}
                      </td>
                    </tr>
                  ) : (
                    filteredLogs.map((log, i) => {
                      const status = getLogStatus(log);
                      return (
                        <tr
                          key={log.user_id || i}
                          className="border-b border-gray-50"
                        >
                          <td className="py-4 text-gray-500 whitespace-nowrap pr-4">
                            {i + 1}
                          </td>
                          <td className="py-4 whitespace-nowrap pr-4">
                            <span
                              className={`px-3 py-1 rounded-full text-xs font-semibold inline-block ${
                                status === "Approved"
                                  ? "bg-green-50 text-green-600"
                                  : "bg-red-50 text-red-600"
                              }`}
                            >
                              {status}
                            </span>
                          </td>
                          <td className="py-4 font-medium text-gray-900 whitespace-nowrap pr-4">
                            {log.full_name || "Unknown"}
                          </td>
                          <td className="py-4 text-gray-600 whitespace-nowrap pr-4">
                            Super Admin
                          </td>
                          <td className="py-4 text-gray-600 whitespace-nowrap">
                            {log.updated_at
                              ? new Date(log.updated_at).toLocaleDateString(
                                  "en-GB",
                                  {
                                    day: "2-digit",
                                    month: "short",
                                    year: "numeric",
                                  },
                                )
                              : "-"}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}