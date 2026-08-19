import React, { useState, useEffect } from "react";
import {
  LayoutGrid,
  Users,
  BookOpen,
  ClipboardCheck,
  FileText,
  LogOut,
  GraduationCap,
  X,
  Edit2,
  Save,
  Loader2,
  User,
  Phone,
  Mail,
  MapPin,
  Landmark,
  CreditCard,
  Briefcase,
  Fingerprint,
  IdCard,
  Wallet,
  Building,
  Shield,
  KeyRound
} from "lucide-react";
import api from "../../api/axiosInstance"; // Adjust the ../ as needed based on folder depth

const navItems = [
  { id: "dashboard", label: "Dashboard", icon: LayoutGrid },
  { id: "faculty-management", label: "Faculty Management", icon: Users },
  { id: "subject-allocation", label: "Subject Allocation", icon: BookOpen },
  { id: "attendance-records", label: "Attendance Records", icon: ClipboardCheck },
  { id: "bill-generation", label: "Bill Generation", icon: FileText },
];

// --- INLINE ADMIN PROFILE MODAL (BALANCED RATIO VERSION) ---
function AdminProfileModal({ isOpen, onClose, userId, token }) {
  const [profileData, setProfileData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  
  // Admin editable fields (reduced)
  const [formData, setFormData] = useState({ 
    full_name: "", 
    phone_number: ""
  });

  // --- PASSWORD STATES ---
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordData, setPasswordData] = useState({ oldPassword: "", newPassword: "", confirmPassword: "" });
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState({ type: "", text: "" });
  
  // --- EYE ICON STATES ---
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useEffect(() => {
    if (isOpen && userId) {
      setIsLoading(true);
      setSaveSuccess(false);
      api
        .get(`/super_admin/admin/${userId}`)
        .then((res) => {
          if (res.data.success) {
            setProfileData(res.data.data);
            setFormData({
              full_name: res.data.data.full_name || "",
              phone_number: res.data.data.phone_number || ""
            });
          }
        })
        .catch((err) => console.error("Error fetching admin profile:", err))
        .finally(() => setIsLoading(false));
    }
  }, [isOpen, userId]);

  if (!isOpen) return null;

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const payload = {
        full_name: formData.full_name.trim(),
        phone_number: formData.phone_number.trim()
      };

      const response = await api.put(`/auth/update/${userId}`, payload);

      if (response.data.success || response.status === 200) {
        setProfileData(prev => ({ ...prev, ...formData }));
        setIsEditing(false);
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000); 
      }
    } catch (error) {
      alert(error.response?.data?.message || "Failed to update profile.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setPasswordMessage({ type: "error", text: "New passwords do not match." });
      return;
    }
    if (passwordData.newPassword.length < 8) {
      setPasswordMessage({ type: "error", text: "Password must be at least 8 characters long." });
      return;
    }

    setPasswordLoading(true);
    setPasswordMessage({ type: "", text: "" });

    try {
      await api.put("/auth/changePassword", {
        user_id: userId,
        oldPassword: passwordData.oldPassword,
        newPassword: passwordData.newPassword
      });

      setPasswordMessage({ type: "success", text: "Password changed successfully!" });
      setPasswordData({ oldPassword: "", newPassword: "", confirmPassword: "" });
      
      // Reset visibility states
      setShowOldPassword(false);
      setShowNewPassword(false);
      setShowConfirmPassword(false);
      
      setTimeout(() => setIsChangingPassword(false), 2000);
    } catch (err) {
      setPasswordMessage({ type: "error", text: err.response?.data?.message || "Failed to change password." });
    } finally {
      setPasswordLoading(false);
    }
  };

  const InfoField = ({ icon: Icon, label, value }) => (
    <div className="flex items-start gap-3 rounded-xl bg-slate-50/50 p-3 border border-slate-100 transition-colors hover:bg-slate-50">
      <div className="mt-0.5 text-slate-400">
        <Icon className="h-[18px] w-[18px]" />
      </div>
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-0.5">{label}</p>
        <p className="text-sm font-medium text-slate-900">{value || "N/A"}</p>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-md transition-all">
      <div className="relative w-full max-w-xl max-h-[92vh] min-h-[550px] overflow-hidden flex flex-col rounded-[24px] bg-white shadow-2xl ring-1 ring-slate-900/5">
        
        {/* Modal Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-6 py-5 sm:px-8 bg-gradient-to-r from-blue-50/50 to-transparent">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white text-[#004DD2] shadow-sm ring-1 ring-slate-200/50">
              <User className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900 tracking-tight">Program Incharge Profile</h2>
              <p className="text-sm text-slate-500 font-medium">Manage your identity</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-full bg-white p-2.5 text-slate-400 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50 hover:text-slate-700 transition-all"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto px-6 py-6 sm:px-8 custom-scrollbar">
          {isLoading ? (
            <div className="flex min-h-[300px] flex-col items-center justify-center text-slate-500">
              <Loader2 className="h-8 w-8 animate-spin text-[#004DD2] mb-4" />
              <p className="font-medium">Retrieving profile data...</p>
            </div>
          ) : profileData ? (
            <div className="space-y-8 pb-4">
              
              {saveSuccess && (
                <div className="rounded-xl bg-green-50 border border-green-200 p-4 flex items-center text-green-700 text-sm font-medium">
                  Profile updated successfully.
                </div>
              )}

              {/* Personal Information Section */}
              <section>
                <div className="mb-5 flex flex-wrap gap-3 items-center justify-between">
                  <h3 className="text-sm font-bold text-[#004DD2] uppercase tracking-wider flex items-center gap-2">
                    <User className="h-4 w-4" /> Personal Details
                  </h3>
                  {!isEditing ? (
                    <button 
                      onClick={() => setIsEditing(true)}
                      className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-4 py-1.5 text-sm font-medium text-slate-700 shadow-sm transition-all hover:bg-slate-50 hover:text-[#004DD2] hover:border-blue-200"
                    >
                      <Edit2 className="h-[14px] w-[14px]" /> Edit Details
                    </button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => {
                          setIsEditing(false);
                          setFormData({ 
                            full_name: profileData.full_name, 
                            phone_number: profileData.phone_number
                          });
                        }}
                        className="text-sm font-medium text-slate-500 hover:text-slate-700 px-3 py-1.5"
                      >
                        Cancel
                      </button>
                      <button 
                        onClick={handleSave}
                        disabled={isSaving}
                        className="flex items-center gap-1.5 rounded-full bg-[#004DD2] px-5 py-1.5 text-sm font-medium text-white shadow-md shadow-blue-500/20 transition-all hover:bg-blue-800 disabled:opacity-70"
                      >
                        {isSaving ? <Loader2 className="h-[14px] w-[14px] animate-spin" /> : <Save className="h-[14px] w-[14px]" />}
                        Save Changes
                      </button>
                    </div>
                  )}
                </div>
                
                <div className="grid gap-4 sm:grid-cols-2 bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
                  {isEditing ? (
                    <>
                      <div>
                        <label className="mb-1.5 block text-xs font-semibold uppercase text-slate-500">Full Name</label>
                        <input 
                          type="text" 
                          value={formData.full_name}
                          onChange={(e) => setFormData({...formData, full_name: e.target.value})}
                          className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-900 transition-shadow focus:border-[#004DD2] focus:outline-none focus:ring-4 focus:ring-[#004DD2]/10"
                        />
                      </div>
                      <div>
                        <label className="mb-1.5 block text-xs font-semibold uppercase text-slate-500">Phone Number</label>
                        <input 
                          type="tel" 
                          maxLength={10}
                          value={formData.phone_number}
                          onChange={(e) => setFormData({...formData, phone_number: e.target.value.replace(/\D/g,'')})}
                          className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-900 transition-shadow focus:border-[#004DD2] focus:outline-none focus:ring-4 focus:ring-[#004DD2]/10"
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      <InfoField icon={User} label="Full Name" value={profileData.full_name} />
                      <InfoField icon={Phone} label="Phone Number" value={profileData.phone_number} />
                    </>
                  )}
                  
                  <div className="sm:col-span-2">
                    <InfoField icon={Mail} label="Email Address" value={profileData.email} />
                  </div>
                </div>
              </section>

              {/* Security & Authentication Section */}
              <section>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold text-[#004DD2] uppercase tracking-wider flex items-center gap-2">
                    <Shield className="h-4 w-4" /> Security
                  </h3>
                </div>
                
                {!isChangingPassword ? (
                  <button 
                    onClick={() => setIsChangingPassword(true)}
                    className="flex items-center gap-3 w-full bg-white border border-slate-200 p-4 rounded-xl hover:border-[#004DD2] hover:bg-blue-50/30 transition-all text-left group"
                  >
                    <div className="h-10 w-10 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-500 group-hover:text-[#004DD2] group-hover:bg-white transition-colors">
                      <KeyRound size={18} />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-800 text-sm">Change Password</p>
                      <p className="text-[11px] font-medium text-slate-500 mt-0.5">Update your Program Incharge login password</p>
                    </div>
                  </button>
                ) : (
                  <form onSubmit={handleChangePassword} className="bg-white border border-slate-200 p-5 rounded-xl space-y-4 shadow-sm">
                    {passwordMessage.text && (
                      <div className={`p-3 rounded-lg text-sm font-medium ${passwordMessage.type === 'error' ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-green-50 text-green-700 border border-green-200'}`}>
                        {passwordMessage.text}
                      </div>
                    )}
                    
                    {/* CURRENT PASSWORD */}
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold uppercase text-slate-500">Current Password</label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#9CA3AF]">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                        </div>
                        <input 
                          type={showOldPassword ? "text" : "password"}
                          required 
                          placeholder="••••••••"
                          value={passwordData.oldPassword} 
                          onChange={(e) => setPasswordData({...passwordData, oldPassword: e.target.value})} 
                          className="w-full rounded-xl border border-slate-300 bg-white pl-10 pr-12 py-2.5 text-sm font-medium text-slate-900 transition-shadow focus:border-[#004DD2] focus:outline-none focus:ring-4 focus:ring-[#004DD2]/10" 
                        />
                        <button
                          type="button"
                          onClick={() => setShowOldPassword(!showOldPassword)}
                          className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-[#9CA3AF] hover:text-[#004DD2] transition-colors focus:outline-none"
                        >
                          {showOldPassword ? (
                            <svg className="h-5 w-5 flex-none" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></svg>
                          ) : (
                            <svg className="h-5 w-5 flex-none" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" /><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" /><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" /><line x1="2" y1="2" x2="22" y2="22" /></svg>
                          )}
                        </button>
                      </div>
                    </div>

                    <div className="grid sm:grid-cols-2 gap-4">
                      {/* NEW PASSWORD */}
                      <div>
                        <label className="mb-1.5 block text-xs font-semibold uppercase text-slate-500">New Password</label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#9CA3AF]">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                          </div>
                          <input 
                            type={showNewPassword ? "text" : "password"}
                            required 
                            placeholder="••••••••"
                            value={passwordData.newPassword} 
                            onChange={(e) => setPasswordData({...passwordData, newPassword: e.target.value})} 
                            className="w-full rounded-xl border border-slate-300 bg-white pl-10 pr-12 py-2.5 text-sm font-medium text-slate-900 transition-shadow focus:border-[#004DD2] focus:outline-none focus:ring-4 focus:ring-[#004DD2]/10" 
                          />
                          <button
                            type="button"
                            onClick={() => setShowNewPassword(!showNewPassword)}
                            className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-[#9CA3AF] hover:text-[#004DD2] transition-colors focus:outline-none"
                          >
                            {showNewPassword ? (
                              <svg className="h-5 w-5 flex-none" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></svg>
                            ) : (
                              <svg className="h-5 w-5 flex-none" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" /><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" /><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" /><line x1="2" y1="2" x2="22" y2="22" /></svg>
                            )}
                          </button>
                        </div>
                      </div>

                      {/* CONFIRM PASSWORD */}
                      <div>
                        <label className="mb-1.5 block text-xs font-semibold uppercase text-slate-500">Confirm Password</label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#9CA3AF]">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                          </div>
                          <input 
                            type={showConfirmPassword ? "text" : "password"}
                            required 
                            placeholder="••••••••"
                            value={passwordData.confirmPassword} 
                            onChange={(e) => setPasswordData({...passwordData, confirmPassword: e.target.value})} 
                            className="w-full rounded-xl border border-slate-300 bg-white pl-10 pr-12 py-2.5 text-sm font-medium text-slate-900 transition-shadow focus:border-[#004DD2] focus:outline-none focus:ring-4 focus:ring-[#004DD2]/10" 
                          />
                          <button
                            type="button"
                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                            className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-[#9CA3AF] hover:text-[#004DD2] transition-colors focus:outline-none"
                          >
                            {showConfirmPassword ? (
                              <svg className="h-5 w-5 flex-none" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></svg>
                            ) : (
                              <svg className="h-5 w-5 flex-none" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" /><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" /><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" /><line x1="2" y1="2" x2="22" y2="22" /></svg>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* NEW: LIVE PASSWORD REQUIREMENTS UI */}
                    <div className="bg-[#F8F9FA] p-4 rounded-xl mt-4">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-800 mb-3">Password Requirements</p>
                      <ul className="space-y-2.5">
                        {[
                          { label: 'At least 8 characters', met: passwordData.newPassword.length >= 8 },
                          { label: 'One special symbol (e.g., @, #, $)', met: /[!@#$%^&*(),.?":{}|<>]/.test(passwordData.newPassword) },
                          { label: 'At least one number', met: /\d/.test(passwordData.newPassword) },
                        ].map((req, index) => (
                          <li key={index} className="flex items-center gap-2.5 text-sm">
                            {req.met ? (
                              <svg className="w-4 h-4 text-green-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
                              </svg>
                            ) : (
                              <div className="w-4 h-4 rounded-full border-[2px] border-slate-300 shrink-0" />
                            )}
                            <span className={req.met ? "text-slate-800 font-medium transition-colors" : "text-slate-500 transition-colors"}>
                              {req.label}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    
                    <div className="flex items-center justify-end gap-3 pt-4">
                      <button 
                        type="button" 
                        onClick={() => { 
                          setIsChangingPassword(false); 
                          setPasswordMessage({type:"", text:""}); 
                          setShowOldPassword(false);
                          setShowNewPassword(false);
                          setShowConfirmPassword(false);
                        }} 
                        className="text-sm font-medium text-slate-500 hover:text-slate-700 px-3 py-1.5"
                      >
                        Cancel
                      </button>
                      <button 
                        type="submit" 
                        disabled={passwordLoading} 
                        className="flex items-center gap-1.5 rounded-full bg-slate-900 px-5 py-2 text-sm font-medium text-white shadow-md transition-all hover:bg-slate-800 disabled:opacity-70"
                      >
                        {passwordLoading ? <Loader2 size={14} className="animate-spin" /> : <Shield size={14} />} 
                        Update Password
                      </button>
                    </div>
                  </form>
                )}
              </section>

            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-slate-500">
              <div className="h-12 w-12 rounded-full bg-red-50 text-red-500 flex items-center justify-center mb-3">
                <X className="h-6 w-6" />
              </div>
              <p className="font-medium">Failed to load profile data.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// --- ADMIN SIDEBAR MAIN COMPONENT ---
// UPDATED: Added isOpen and onClose to manage mobile sidebar drawer
export default function Sidebar({ activeTab, setActiveTab, onSignOut, isOpen, onClose }) {
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [adminName, setAdminName] = useState("Loading...");
  const [adminRole, setAdminRole] = useState("Program Incharge");
  const [sessionData, setSessionData] = useState(null);

  useEffect(() => {
    const sessionStr = localStorage.getItem("iipsCurrentSession");
    if (sessionStr) {
      try {
        const session = JSON.parse(sessionStr);
        setSessionData(session);
        
        // 1. Set temporary fallback from local storage
        setAdminName(session.full_name || session.name || session.user?.full_name || "Loading...");
        
        if (session.role) {
          setAdminRole(session.role === "admin" ? "Program Incharge" : session.role.replace("_", " ").replace(/\b\w/g, l => l.toUpperCase()));
        }

        // 2. Fetch the actual up-to-date name from the API
        const currentUserId = session.userId || session.id || session.user_id;
        if (currentUserId) {
          api.get(`/super_admin/admin/${currentUserId}`)
            .then((res) => {
              if (res.data.success && res.data.data?.full_name) {
                setAdminName(res.data.data.full_name);
                
                // Optional: Update local storage so it's there instantly next time
                const updatedSession = { ...session, full_name: res.data.data.full_name };
                localStorage.setItem("iipsCurrentSession", JSON.stringify(updatedSession));
              } else {
                setAdminName("Program Incharge User"); // Ultimate fallback
              }
            })
            .catch((err) => {
              console.error("Error fetching admin name for sidebar:", err);
              setAdminName("Program Incharge User");
            });
        }
      } catch (e) {
        console.error("Error parsing session data", e);
        setAdminName("Program Incharge User");
      }
    } else {
      setAdminName("Program Incharge User");
    }
  }, []);

  const initials = adminName
    .split(" ")
    .map((w) => w[0])
    .join("")
    .substring(0, 2)
    .toUpperCase() || "A";

  return (
    <>
      {/* UPDATED: Overlay backdrop for mobile */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm md:hidden"
          onClick={onClose}
        />
      )}

      {/* UPDATED: Mobile responsive classes added for the sliding drawer effect */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 flex flex-col w-[260px] shrink-0 h-screen bg-white border-r border-slate-200
        transition-transform duration-300 ease-in-out
        md:relative md:translate-x-0
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        
        {/* Brand */}
        <div className="flex items-center gap-3 px-6 h-20 border-b border-slate-100">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#004DD2] text-white shadow-md shadow-blue-500/20">
            <GraduationCap className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xl font-black leading-tight text-[#004DD2] tracking-tight">IIPS</p>
            <p className="text-xs font-semibold leading-tight text-slate-500 uppercase tracking-wider mt-0.5">Program Incharge</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-4 py-6 custom-scrollbar">
          <p className="px-2 mb-3 text-[11px] font-bold tracking-wider text-slate-400 uppercase">
            Main Menu
          </p>
          <ul className="space-y-1.5">
            {navItems.map(({ id, label, icon: Icon }) => (
              <li key={id}>
                <button
                  onClick={() => {
                    setActiveTab(id);
                    // NEW: Fire the refresh event automatically when switching tabs!
                    window.dispatchEvent(new Event('refresh-dashboard'));
                    // Close the mobile menu automatically upon selection
                    if (onClose) onClose();
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                    activeTab === id
                      ? "bg-[#004DD2] text-white shadow-md shadow-blue-500/20"
                      : "text-slate-600 hover:bg-slate-50 hover:text-[#004DD2]"
                  }`}
                >
                  <Icon className="h-[18px] w-[18px] shrink-0" />
                  <span>{label}</span>
                </button>
              </li>
            ))}
          </ul>
        </nav>

        {/* Footer / Profile */}
        <div className="mt-auto px-4 pb-6">
          <button 
            onClick={() => setIsProfileModalOpen(true)}
            className="group flex w-full items-center gap-3 border-t border-slate-100 pt-5 pb-3 text-left hover:bg-slate-50 rounded-xl px-2 transition-all"
          >
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blue-50 text-sm font-bold text-[#004DD2] ring-2 ring-transparent group-hover:ring-blue-200 transition-all">
              {initials}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-slate-800 group-hover:text-[#004DD2] transition-colors">{adminName}</p>
              <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider mt-0.5">{adminRole}</p>
            </div>
          </button>
          
          <button
            onClick={onSignOut}
            className="mt-1 flex w-full items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50 hover:text-red-700 transition-all"
          >
            <LogOut className="h-[18px] w-[18px] shrink-0" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Render the Inline Modal */}
      <AdminProfileModal 
        isOpen={isProfileModalOpen} 
        onClose={() => setIsProfileModalOpen(false)} 
        userId={sessionData?.userId || sessionData?.id || sessionData?.user_id}
        token={sessionData?.token}
      />
    </>
  );
}