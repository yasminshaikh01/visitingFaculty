import {
  LayoutGrid,
  CalendarCheck,
  History,
  FileText,
  LogOut,
  GraduationCap,
  Menu,
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
import { useState, useEffect } from "react";
import api from "../../../api/axiosInstance";

const navItems = [
  { view: "dashboard", label: "Dashboard", icon: LayoutGrid },
  { view: "mark-attendance", label: "Mark Attendance", icon: CalendarCheck },
  { view: "attendance-history", label: "Attendance History", icon: History },
  { view: "view-bill", label: "View Bill", icon: FileText },
];

function NavItems({ onNavigate, currentView, onClose }) {
  return (
    <nav className="flex flex-col gap-1">
      {navItems.map(({ view, label, icon: Icon }) => (
        <button
          key={view}
          onClick={() => {
            onNavigate(view);
            if (onClose) onClose();
          }}
          className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200 ${
            currentView === view
              ? "bg-[#004DD2] text-white shadow-md shadow-blue-500/20"
              : "text-slate-600 hover:bg-slate-50 hover:text-[#004DD2]"
          }`}
        >
          <Icon className="h-[18px] w-[18px] shrink-0" />
          <span>{label}</span>
        </button>
      ))}
    </nav>
  );
}

// Reusable component for displaying read-only info
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

// Reusable component for Input Fields during edit mode
const EditField = ({ label, value, onChange, type = "text", maxLength, colSpan = false }) => (
  <div className={colSpan ? "sm:col-span-2" : ""}>
    <label className="mb-1.5 block text-xs font-semibold uppercase text-slate-500">{label}</label>
    <input
      type={type}
      maxLength={maxLength}
      value={value || ""}
      onChange={onChange}
      className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-900 transition-shadow focus:border-[#004DD2] focus:outline-none focus:ring-4 focus:ring-[#004DD2]/10"
    />
  </div>
);

// --- ELEGANT PROFILE MODAL ---
function ProfileModal({ isOpen, onClose, userId, token }) {
  const [profileData, setProfileData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // EXPANDED: Form Data State for all editable fields
  const [formData, setFormData] = useState({ 
    full_name: "", 
    phone_number: "",
    address: "",
    qualification: "",
    aadhaar_no: "",
    account_no: "",
    bank_name: "",
    ifsc_code: "",
    pan_card_no: ""
  });

  // --- ERROR/SUCCESS STATE FOR PROFILE VALIDATION ---
  const [profileMessage, setProfileMessage] = useState({ type: "", text: "" });

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
      setProfileMessage({ type: "", text: "" });
      api
        .get(`/admin/faculty/${userId}`)
        .then((res) => {
          if (res.data.success) {
            setProfileData(res.data.data);
            setFormData({
              full_name: res.data.data.full_name || "",
              phone_number: res.data.data.phone_number || "",
              address: res.data.data.address || "",
              qualification: res.data.data.qualification || "",
              aadhaar_no: res.data.data.aadhaar_no || "",
              account_no: res.data.data.account_no || "",
              bank_name: res.data.data.bank_name || "",
              ifsc_code: res.data.data.ifsc_code || "",
              pan_card_no: res.data.data.pan_card_no || ""
            });
          }
        })
        .catch((err) => console.error("Error fetching profile:", err))
        .finally(() => setIsLoading(false));
    }
  }, [isOpen, userId]);

  if (!isOpen) return null;

  const handleSave = async () => {
    setProfileMessage({ type: "", text: "" });

    if (!formData.full_name.trim()) {
      return setProfileMessage({ type: "error", text: "Full Name is required." });
    }
    if (formData.phone_number && !/^\d{10}$/.test(formData.phone_number)) {
      return setProfileMessage({ type: "error", text: "Phone Number must be exactly 10 digits." });
    }
    if (formData.aadhaar_no && !/^\d{12}$/.test(formData.aadhaar_no)) {
      return setProfileMessage({ type: "error", text: "Aadhaar Number must be exactly 12 numeric digits." });
    }
    if (formData.pan_card_no && !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/i.test(formData.pan_card_no)) {
      return setProfileMessage({ type: "error", text: "Invalid PAN Card format (e.g., ABCDE1234F)." });
    }
    if (formData.account_no && !/^\d{8,18}$/.test(formData.account_no)) {
      return setProfileMessage({ type: "error", text: "Account Number must be between 8 and 18 digits." });
    }
    if (formData.ifsc_code && !/^[A-Z]{4}0[A-Z0-9]{6}$/i.test(formData.ifsc_code)) {
      return setProfileMessage({ type: "error", text: "Invalid IFSC Code format (e.g., SBIN0001234)." });
    }

    setIsSaving(true);
    try {
      const payload = {
        full_name: formData.full_name.trim(),
        phone_number: formData.phone_number.trim(),
        address: formData.address.trim(),
        qualification: formData.qualification.trim(),
        aadhaar_no: formData.aadhaar_no.trim(),
        account_no: formData.account_no.trim(),
        bank_name: formData.bank_name.trim(),
        ifsc_code: formData.ifsc_code.trim().toUpperCase(),
        pan_card_no: formData.pan_card_no.trim().toUpperCase()
      };

     const response = await api.put(`/auth/update/${userId}`, payload);

      if (response.data.success) {
        setProfileData(prev => ({ ...prev, ...formData }));
        setIsEditing(false);
        setProfileMessage({ type: "success", text: "Profile updated successfully." });
        setTimeout(() => setProfileMessage({ type: "", text: "" }), 3000); 
      }
    } catch (error) {
      const errorMsg = error.response?.data?.message?.toLowerCase() || error.response?.data?.error?.toLowerCase() || "";
      const errorDetails = typeof error.response?.data?.data === 'string' ? error.response.data.data.toLowerCase() : '';
      const fullError = errorMsg + " " + errorDetails;

      if (fullError.includes("aadhaar")) {
        setProfileMessage({ type: "error", text: "This Aadhaar Number is already registered to another user." });
      } else if (fullError.includes("pan")) {
        setProfileMessage({ type: "error", text: "This PAN Card Number is already registered to another user." });
      } else if (fullError.includes("mobile") || fullError.includes("phone")) {
        setProfileMessage({ type: "error", text: "This Phone Number is already in use." });
      } else {
        setProfileMessage({ type: "error", text: error.response?.data?.message || "Failed to update profile." });
      }
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
    
    if (passwordData.newPassword.length < 8 || 
        !/[!@#$%^&*(),.?":{}|<>]/.test(passwordData.newPassword) || 
        !/\d/.test(passwordData.newPassword)) {
      setPasswordMessage({ type: "error", text: "Please meet all password requirements." });
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

  const handleCancelEdit = () => {
    setIsEditing(false);
    setProfileMessage({ type: "", text: "" });
    setFormData({ 
      full_name: profileData.full_name || "", 
      phone_number: profileData.phone_number || "",
      address: profileData.address || "",
      qualification: profileData.qualification || "",
      aadhaar_no: profileData.aadhaar_no || "",
      account_no: profileData.account_no || "",
      bank_name: profileData.bank_name || "",
      ifsc_code: profileData.ifsc_code || "",
      pan_card_no: profileData.pan_card_no || ""
    });
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-md transition-all">
      <div className="relative w-full max-w-3xl max-h-[92vh] overflow-hidden flex flex-col rounded-[24px] bg-white shadow-2xl ring-1 ring-slate-900/5">
        
        {/* Modal Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-6 py-5 sm:px-8 bg-gradient-to-r from-blue-50/50 to-transparent">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white text-[#004DD2] shadow-sm ring-1 ring-slate-200/50">
              <User className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900 tracking-tight">Faculty Profile</h2>
              <p className="text-sm text-slate-500 font-medium">Manage your university identity and security</p>
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
              
              {profileMessage.text && (
                <div className={`p-3 rounded-xl text-sm font-medium ${profileMessage.type === 'error' ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-green-50 text-green-700 border border-green-200'}`}>
                  {profileMessage.text}
                </div>
              )}

              {/* Personal Information Section */}
              <section>
                <div className="mb-5 flex flex-wrap gap-4 items-center justify-between">
                  <h3 className="text-sm font-bold text-[#004DD2] uppercase tracking-wider flex items-center gap-2">
                    <User className="h-4 w-4" /> Personal Details
                  </h3>
                  {!isEditing ? (
                    <button 
                      onClick={() => setIsEditing(true)}
                      className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-4 py-1.5 text-sm font-medium text-slate-700 shadow-sm transition-all hover:bg-slate-50 hover:text-[#004DD2] hover:border-blue-200"
                    >
                      <Edit2 className="h-[14px] w-[14px]" /> Edit Profile
                    </button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={handleCancelEdit}
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
                      <EditField label="Full Name" value={formData.full_name} onChange={(e) => setFormData({...formData, full_name: e.target.value})} />
                      <EditField label="Phone Number" type="tel" maxLength={10} value={formData.phone_number} onChange={(e) => setFormData({...formData, phone_number: e.target.value.replace(/\D/g,'')})} />
                      
                      <div className="sm:col-span-2">
                        <InfoField icon={Mail} label="Email Address" value={profileData.email} />
                      </div>
                      
                      <EditField label="Residential Address" value={formData.address} onChange={(e) => setFormData({...formData, address: e.target.value})} colSpan={true} />
                    </>
                  ) : (
                    <>
                      <InfoField icon={User} label="Full Name" value={profileData.full_name} />
                      <InfoField icon={Phone} label="Phone Number" value={profileData.phone_number} />
                      <div className="sm:col-span-2">
                        <InfoField icon={Mail} label="Email Address" value={profileData.email} />
                      </div>
                      <div className="sm:col-span-2">
                        <InfoField icon={MapPin} label="Residential Address" value={profileData.address} />
                      </div>
                    </>
                  )}
                </div>
              </section>

              <div className="grid gap-8 sm:grid-cols-2">
                {/* Academic & ID Section */}
                <section>
                  <h3 className="mb-5 text-sm font-bold text-[#004DD2] uppercase tracking-wider flex items-center gap-2">
                    <GraduationCap className="h-4 w-4" /> Academic & ID
                  </h3>
                  <div className="flex flex-col gap-3">
                    {isEditing ? (
                      <>
                        <EditField label="Qualification" value={formData.qualification} onChange={(e) => setFormData({...formData, qualification: e.target.value})} />
                        <InfoField icon={IdCard} label="UVFIN / Employee ID" value={profileData.uvfin} />
                        <EditField label="PAN Card No" maxLength={10} value={formData.pan_card_no} onChange={(e) => setFormData({...formData, pan_card_no: e.target.value.toUpperCase()})} />
                        <EditField label="Aadhaar No" type="tel" maxLength={12} value={formData.aadhaar_no} onChange={(e) => setFormData({...formData, aadhaar_no: e.target.value.replace(/\D/g,'')})} />
                      </>
                    ) : (
                      <>
                        <InfoField icon={Briefcase} label="Qualification" value={profileData.qualification} />
                        <InfoField icon={IdCard} label="UVFIN / Employee ID" value={profileData.uvfin} />
                        <InfoField icon={CreditCard} label="PAN Card No" value={profileData.pan_card_no} />
                        <InfoField icon={Fingerprint} label="Aadhaar No" value={profileData.aadhaar_no} />
                      </>
                    )}
                  </div>
                </section>

                {/* Banking Section */}
                <section>
                  <h3 className="mb-5 text-sm font-bold text-[#004DD2] uppercase tracking-wider flex items-center gap-2">
                    <Landmark className="h-4 w-4" /> Banking Information
                  </h3>
                  <div className="flex flex-col gap-3">
                    {isEditing ? (
                      <>
                        <EditField label="Bank Name" value={formData.bank_name} onChange={(e) => setFormData({...formData, bank_name: e.target.value})} />
                        <EditField label="Account Number" type="tel" value={formData.account_no} onChange={(e) => setFormData({...formData, account_no: e.target.value.replace(/\D/g,'')})} />
                        <EditField label="IFSC Code" maxLength={11} value={formData.ifsc_code} onChange={(e) => setFormData({...formData, ifsc_code: e.target.value.toUpperCase()})} />
                      </>
                    ) : (
                      <>
                        <InfoField icon={Landmark} label="Bank Name" value={profileData.bank_name} />
                        <InfoField icon={Wallet} label="Account Number" value={profileData.account_no} />
                        <InfoField icon={Building} label="IFSC Code" value={profileData.ifsc_code} />
                      </>
                    )}
                  </div>
                </section>
              </div>

              {/* Security & Authentication Section */}
              <section>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                    <Shield className="h-4 w-4" /> Security & Authentication
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
                      <p className="text-[11px] font-medium text-slate-500">Update your account login password</p>
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

                    {/* LIVE PASSWORD REQUIREMENTS UI */}
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
                    
                    <div className="flex items-center justify-end gap-3 pt-2">
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

export default function Sidebar({ onNavigate, currentView = "dashboard", onSignOut }) {
  const [open, setOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [facultyName, setFacultyName] = useState("Loading...");
  const [facultyRole, setFacultyRole] = useState("Faculty");
  const [sessionData, setSessionData] = useState(null);

 useEffect(() => {
    const sessionStr = sessionStorage.getItem('iipsCurrentSession');
    if (sessionStr) {
      try {
        const session = JSON.parse(sessionStr);
        setSessionData(session);
        
        let fallbackName = session.fullName || session.name || "Loading...";
        setFacultyName(fallbackName);
        
        if (session.role) {
          setFacultyRole(session.role.charAt(0).toUpperCase() + session.role.slice(1));
        }

        const currentUserId = session.userId || session.id || session.user_id;
        if (currentUserId) {
          api.get(`/admin/faculty/${currentUserId}`)
            .then((res) => {
              if (res.data.success && res.data.data?.full_name) {
                let finalName = res.data.data.full_name;
                
                if (!finalName.toLowerCase().startsWith("dr.") && !finalName.toLowerCase().startsWith("prof.")) {
                  finalName = "Prof. " + finalName;
                }
                
                setFacultyName(finalName);
                
                const updatedSession = { ...session, fullName: finalName };
                sessionStorage.setItem("iipsCurrentSession", JSON.stringify(updatedSession));
              } else {
                setFacultyName("Visiting Faculty");
              }
            })
            .catch((err) => {
              console.error("Error fetching faculty name for sidebar:", err);
              setFacultyName(fallbackName !== "Loading..." ? fallbackName : "Visiting Faculty");
            });
        }
      } catch (e) {
        console.error("Error parsing session data", e);
        setFacultyName("Visiting Faculty");
      }
    } else {
      setFacultyName("Visiting Faculty");
    }
  }, []);

  const initials = facultyName
    .replace("Dr. ", "")
    .replace("Prof. ", "")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();

  return (
    <>
      {/* Mobile top bar */}
      <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 lg:hidden">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#004DD2] text-white shadow-sm">
            <GraduationCap className="h-5 w-5" />
          </div>
          <div>
            <p className="text-base font-bold leading-tight text-[#004DD2]">IIPS</p>
            <p className="text-[11px] font-medium leading-tight text-slate-500">Faculty Portal</p>
          </div>
        </div>
        <button
          onClick={() => setOpen((v) => !v)}
          className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50 transition-colors"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile drawer */}
      {open && (
        <div className="absolute inset-x-0 top-[61px] z-50 border-b border-slate-200 bg-white px-4 pb-4 shadow-lg lg:hidden">
          <NavItems onNavigate={onNavigate} currentView={currentView} onClose={() => setOpen(false)} />
          
          <div className="mt-4 border-t border-slate-200 pt-2">
            <button 
              onClick={() => { setIsProfileModalOpen(true); setOpen(false); }}
              className="flex w-full items-center gap-3 rounded-xl p-3 hover:bg-blue-50 transition-colors text-left"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-[#004DD2]">
                {initials}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-slate-800">{facultyName}</p>
                <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">{facultyRole}</p>
              </div>
            </button>
          </div>
          
          <button onClick={onSignOut} className="mt-1 flex w-full items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors">
            <LogOut className="h-4 w-4 shrink-0" /> Sign Out
          </button>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="hidden w-[260px] shrink-0 flex-col border-r border-slate-200 bg-white px-4 py-6 lg:flex z-10 relative h-screen sticky top-0">
        <div className="mb-8 flex items-center gap-3 px-2">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#004DD2] text-white shadow-md shadow-blue-500/20">
            <GraduationCap className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xl font-black leading-tight text-[#004DD2] tracking-tight">IIPS</p>
            <p className="text-xs font-semibold leading-tight text-slate-500 uppercase tracking-wider mt-0.5">Faculty Portal</p>
          </div>
        </div>

        <NavItems onNavigate={onNavigate} currentView={currentView} />

        <div className="mt-auto">
          {/* Profile Section Button */}
          <button 
            onClick={() => setIsProfileModalOpen(true)}
            className="group flex w-full items-center gap-3 border-t border-slate-200 pt-5 pb-3 text-left hover:bg-slate-50 rounded-xl px-2 transition-all"
          >
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blue-50 text-sm font-bold text-[#004DD2] ring-2 ring-transparent group-hover:ring-blue-200 transition-all">
              {initials}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-slate-800 group-hover:text-[#004DD2] transition-colors">{facultyName}</p>
              <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider mt-0.5">{facultyRole}</p>
            </div>
          </button>
          
          <button onClick={onSignOut} className="mt-1 flex w-full items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50 hover:text-red-700 transition-all">
            <LogOut className="h-[18px] w-[18px] shrink-0" /> Sign Out
          </button>
        </div>
      </aside>

      {/* Render Profile Modal */}
      <ProfileModal 
        isOpen={isProfileModalOpen} 
        onClose={() => setIsProfileModalOpen(false)} 
        userId={sessionData?.userId || sessionData?.id || sessionData?.user_id}
        token={sessionData?.token}
      />
    </>
  );
}