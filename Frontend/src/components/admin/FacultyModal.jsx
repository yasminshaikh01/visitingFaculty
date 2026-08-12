// import React, { useEffect, useState } from "react";
// import { 
//   X, 
//   ShieldCheck, 
//   User, 
//   GraduationCap, 
//   CheckCircle2, 
//   XCircle, 
//   Check,
//   Briefcase,
//   AlertTriangle,
//   CreditCard
// } from "lucide-react";
// import adminApi from "../../api/adminApi";
// import LoadingSpinner from "./LoadingSpinner";
// import api from "../../api/axiosInstance"; // Adjust the ../ as needed based on folder depth

// export default function FacultyModal({ userId, onClose, onActionSuccess, initialView = "profile" }) {
//   const [faculty, setFaculty] = useState(null);
//   const [loading, setLoading] = useState(true);
//   const [error, setError] = useState("");
  
//   // Navigation State
//   const [currentView, setCurrentView] = useState(initialView); 
  
//   // Action States (Approvals & Rejections)
//   const [uvfin, setUvfin] = useState("");
//   const [rejectReason, setRejectReason] = useState("");
//   const [actionLoading, setActionLoading] = useState(false);

//   // New Action States (Approved Faculty specific)
//   const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
//   const [showUvfinInput, setShowUvfinInput] = useState(false);
//   const [newUvfin, setNewUvfin] = useState("");
//   const [uvfinLoading, setUvfinLoading] = useState(false);

//   // --- NEW: Inline Notification State ---
//   const [notification, setNotification] = useState(null); // { type: 'success' | 'error', text: '' }

//   // Helper to fetch Auth Token
//   const getAuthHeaders = () => {
//     const session = JSON.parse(localStorage.getItem('iipsCurrentSession') || '{}');
//     return { Authorization: `Bearer ${session.token}` };
//   };

//   useEffect(() => {
//     let active = true;
//     if (!userId) return;

//     (async () => {
//       setLoading(true);
//       try {
//         const data = await adminApi.getFacultyById(userId);
//         if (active) setFaculty(data?.data ?? data?.faculty ?? data);
//       } catch (err) {
//         if (active) setError("Failed to load faculty profile.");
//       } finally {
//         if (active) setLoading(false);
//       }
//     })();
//     return () => { active = false; };
//   }, [userId]);

//   const displayName = faculty?.full_name || faculty?.name || "Unknown Faculty";

//   const formatDate = (dateString) => {
//     if (!dateString) return "—";
//     return new Date(dateString).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
//   };
  
//   const formatDateTime = (dateString) => {
//     if (!dateString) return "—";
//     return new Date(dateString).toLocaleString('en-GB', { 
//       day: '2-digit', month: 'short', year: 'numeric', 
//       hour: '2-digit', minute: '2-digit', hour12: true 
//     });
//   };

// const handleApproveSubmit = async () => {
//     setActionLoading(true);
//     setNotification(null);
//     try {
//       await adminApi.approveFaculty(faculty.id || faculty.user_id, uvfin);
//       onActionSuccess && onActionSuccess({ 
//         action: 'approved',
//         facultyName: displayName,
//         email: faculty?.email,
//         uvfin: uvfin 
//       });
//       onClose();
//     } catch (err) {
//       setNotification({ type: 'error', text: "Approval failed: " + (err.response?.data?.message || err.message || "Unknown Error") });
//     } finally {
//       setActionLoading(false);
//     }
//   };

//   const handleRejectSubmit = async () => {
//     if (!rejectReason.trim()) {
//       setNotification({ type: 'error', text: "Please provide a reason for rejection." });
//       return;
//     }
//     setActionLoading(true);
//     setNotification(null);
//     try {
//       await adminApi.rejectFaculty(faculty.id || faculty.user_id, rejectReason);
//       onActionSuccess && onActionSuccess({ 
//         action: 'rejected',
//         facultyName: displayName,
//         email: faculty?.email
//       });
//       onClose();
//     } catch (err) {
//       setNotification({ type: 'error', text: "Rejection failed: " + (err.response?.data?.message || err.message || "Unknown Error") });
//     } finally {
//       setActionLoading(false);
//     }
//   };

//   // --- NEW HANDLERS: TOGGLE STATUS & UPDATE UVFIN ---
  
//   const handleToggleStatus = async () => {
//     setIsUpdatingStatus(true);
//     setNotification(null);
//     try {
//       const action = faculty.is_active ? "deactivate" : "activate";
//       const facultyId = faculty.id || faculty.user_id;
      
//       await api.put(`/account-status/admin/faculty/${facultyId}/${action}`, {});
      
//       setFaculty(prev => ({ ...prev, is_active: !prev.is_active }));
//       setNotification({ type: 'success', text: `Account successfully ${action}d.` });
//       onActionSuccess && onActionSuccess({ action: 'status_changed' });
      
//       setTimeout(() => setNotification(null), 3000);
//     } catch (err) {
//       setNotification({ type: 'error', text: err.response?.data?.message || "Failed to update account status." });
//     } finally {
//       setIsUpdatingStatus(false);
//     }
//   };

//   const handleUpdateUvfin = async () => {
//     if (!newUvfin.trim()) {
//       setNotification({ type: 'error', text: "Please enter a valid UVFIN." });
//       return;
//     }
//     setUvfinLoading(true);
//     setNotification(null);
//     try {
//       const facultyId = faculty.id || faculty.user_id;
//       const response = await api.put(`/admin/updateFaculty/${facultyId}`, { uvfin: newUvfin });
      
//       // Update local state gracefully 
//       setFaculty(prev => ({
//         ...prev,
//         uvfin: newUvfin,
//         FacultyApproval: { ...prev.FacultyApproval, uvfin: newUvfin }
//       }));
//       setShowUvfinInput(false);
//       setNotification({ type: 'success', text: response.data?.message || "UVFIN updated successfully!" });
//       onActionSuccess && onActionSuccess({ action: 'uvfin_updated' });
      
//       setTimeout(() => setNotification(null), 3000);
//     } catch (err) {
//       setNotification({ type: 'error', text: err.response?.data?.message || "Failed to assign UVFIN." });
//     } finally {
//       setUvfinLoading(false);
//     }
//   };

//   // --- REUSABLE NOTIFICATION BANNER COMPONENT ---
//   const NotificationBanner = () => {
//     if (!notification) return null;
//     return (
//       <div className={`p-4 mb-2 rounded-[8px] flex items-center gap-3 text-[13px] font-semibold border animate-in fade-in duration-200 ${
//         notification.type === 'error' 
//           ? 'bg-[#FEF2F2] text-[#DC3545] border-[#FCA5A5]' 
//           : 'bg-[#F0FDF4] text-[#16A34A] border-[#BBF7D0]'
//       }`}>
//         {notification.type === 'error' ? <AlertTriangle size={18} /> : <CheckCircle2 size={18} />}
//         {notification.text}
//       </div>
//     );
//   };

//   // --------------------------------------------------------
//   // VIEW 1: APPROVE REGISTRATION (Figma Match)
//   // --------------------------------------------------------
//   if (currentView === "approve") {
//     return (
//       <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#141B2B]/40 backdrop-blur-sm p-4">
//         <div className="bg-[#FFFFFF] w-full max-w-[480px] rounded-2xl shadow-2xl overflow-hidden flex flex-col">
//           <div className="flex items-center justify-between p-6 border-b border-[#C3C5D8]">
//             <div className="flex items-center gap-3">
//               <div className="bg-[#004DD2] text-white p-1.5 rounded-lg shadow-sm">
//                 <ShieldCheck size={20} />
//               </div>
//               <h2 className="text-[18px] font-semibold text-[#141B2B]">Approve Faculty Registration</h2>
//             </div>
//             <button onClick={onClose} className="text-[#585F6C] hover:bg-slate-100 p-1.5 rounded-full transition-colors">
//               <X size={20} />
//             </button>
//           </div>

//           <div className="p-6 space-y-6">
//             <NotificationBanner />
            
//             <div className="bg-[#F8F9FA] border border-[#C3C5D8] rounded-[12px] p-5">
//               <p className="text-[11px] font-semibold text-[#585F6C] uppercase tracking-wide mb-1">Faculty Member</p>
//               <p className="text-[15px] font-bold text-[#141B2B] capitalize mb-4">{displayName}</p>
              
//               <div className="grid grid-cols-2 gap-y-4">
//                 <div>
//                   <p className="text-[11px] font-semibold text-[#585F6C] uppercase mb-1">Qualification</p>
//                   <p className="text-[14px] font-medium text-[#141B2B]">{faculty?.qualification || "—"}</p>
//                 </div>
//                 <div>
//                   <p className="text-[11px] font-semibold text-[#585F6C] uppercase mb-1">Last Login</p>
//                   <p className="text-[14px] font-medium text-[#141B2B]">{formatDateTime(faculty?.last_login)}</p>
//                 </div>
//                 <div>
//                   <p className="text-[11px] font-semibold text-[#585F6C] uppercase mb-1">Reg. Date</p>
//                   <p className="text-[14px] font-medium text-[#141B2B]">{formatDate(faculty?.created_at)}</p>
//                 </div>
//                 <div>
//                   <p className="text-[11px] font-semibold text-[#585F6C] uppercase mb-1">Status</p>
//                   <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-[#FFEDD5] text-[#92400E]">
//                     Pending Verification
//                   </span>
//                 </div>
//               </div>
//             </div>

//             <div>
//               <div className="flex justify-between items-center mb-2">
//                 <label className="text-[14px] font-semibold text-[#141B2B]">Assign UVFIN ID</label>
//                 <span className="bg-slate-100 text-[#585F6C] text-[10px] font-bold px-2 py-0.5 rounded">OPTIONAL</span>
//               </div>
//               <div className="relative">
//                 <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
//                   <Briefcase size={16} className="text-[#585F6C]" />
//                 </div>
//                 <input
//                   type="text"
//                   value={uvfin}
//                   onChange={(e) => setUvfin(e.target.value)}
//                   placeholder="Can be allocated later..."
//                   className="w-full pl-9 pr-4 py-2.5 rounded-[8px] border border-[#C3C5D8] focus:border-[#004DD2] focus:ring-1 focus:ring-[#004DD2] outline-none text-[14px] transition-all"
//                 />
//               </div>
//               <p className="text-[12px] text-[#585F6C] mt-2">
//                 This unique identifier will be used for all academic and financial records.
//               </p>
//             </div>
//           </div>

//           <div className="flex gap-3 p-6 pt-0">
//             <button 
//               onClick={() => setCurrentView("profile")}
//               className="flex-1 px-4 py-2.5 text-[#585F6C] bg-white border border-[#C3C5D8] hover:bg-slate-50 rounded-[8px] text-[14px] font-semibold transition-colors"
//             >
//               Cancel
//             </button>
//             <button 
//               onClick={handleApproveSubmit}
//               disabled={actionLoading}
//               className="flex-1 px-4 py-2.5 bg-[#004DD2] hover:bg-blue-700 text-white rounded-[8px] text-[14px] font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
//             >
//               Submit Approval <Check size={16} />
//             </button>
//           </div>
//         </div>
//       </div>
//     );
//   }

//   // --------------------------------------------------------
//   // VIEW 2: REJECT REGISTRATION
//   // --------------------------------------------------------
//   if (currentView === "reject") {
//     return (
//       <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#141B2B]/40 backdrop-blur-sm p-4">
//         <div className="bg-[#FFFFFF] w-full max-w-[420px] rounded-2xl shadow-2xl overflow-hidden flex flex-col">
//           <div className="flex items-start justify-between p-6 border-b border-[#C3C5D8]">
//             <div className="flex gap-4">
//               <div className="bg-red-50 text-[#DC3545] p-2.5 rounded-full shrink-0">
//                 <AlertTriangle size={24} strokeWidth={2.5} />
//               </div>
//               <div>
//                 <h2 className="text-[18px] font-bold text-[#141B2B]">Reject Faculty Registration</h2>
//                 <p className="text-[12px] font-medium text-[#585F6C] mt-1">This action cannot be undone easily.</p>
//               </div>
//             </div>
//             <button onClick={onClose} className="text-[#585F6C] hover:bg-slate-100 p-1.5 shrink-0 rounded-full transition-colors">
//               <X size={20} />
//             </button>
//           </div>

//           <div className="p-6 space-y-6">
//             <NotificationBanner />
            
//             <div className="bg-[#F8F9FA] border border-[#C3C5D8] rounded-[8px] p-4">
//               <p className="text-[14px] text-[#141B2B] font-bold capitalize">{displayName}</p>
//               <p className="text-[13px] text-[#585F6C] font-medium mt-1">
//                 {faculty?.qualification || "Qualification details missing"}
//               </p>
//             </div>

//             <div>
//               <label className="block text-[14px] font-bold text-[#141B2B] mb-2">
//                 Rejection Remarks <span className="text-[#DC3545]">*</span>
//               </label>
//               <textarea
//                 value={rejectReason}
//                 onChange={(e) => setRejectReason(e.target.value)}
//                 placeholder="Explain the reason for rejection (e.g., 'Incomplete documentation', 'Invalid credentials')..."
//                 className="w-full p-4 rounded-[8px] border border-[#C3C5D8] focus:border-[#DC3545] focus:ring-1 focus:ring-[#DC3545] outline-none text-[14px] min-h-[120px] resize-none transition-all"
//               />
//               <p className="text-[12px] text-[#585F6C] mt-2 font-medium">
//                 Provide a clear explanation that will be sent to the faculty member.
//               </p>
//             </div>
//           </div>

//           <div className="flex gap-3 p-6 pt-0">
//             <button 
//               onClick={() => setCurrentView("profile")}
//               className="flex-1 px-4 py-2.5 text-[#585F6C] bg-white border border-[#C3C5D8] hover:bg-slate-50 rounded-[8px] text-[14px] font-bold transition-colors"
//             >
//               Cancel
//             </button>
//             <button 
//               onClick={handleRejectSubmit}
//               disabled={actionLoading || !rejectReason.trim()}
//               className="flex-1 px-4 py-2.5 bg-[#DC3545] hover:bg-red-700 text-white rounded-[8px] text-[14px] font-bold transition-colors disabled:opacity-50"
//             >
//               Confirm Rejection
//             </button>
//           </div>
//         </div>
//       </div>
//     );
//   }

//   // --------------------------------------------------------
//   // VIEW 3: MAIN PROFILE VIEW (Default)
//   // --------------------------------------------------------
  
//   // Calculate specific conditions for UI rendering
//   const isPending = (!faculty?.is_approved || faculty?.status === 'pending');
//   const isApproved = (faculty?.is_approved || faculty?.status === 'approved' || faculty?.FacultyApproval?.status === 'approved');
//   const missingUvfin = isApproved && !faculty?.FacultyApproval?.uvfin && !faculty?.uvfin;
  
//   return (
//     <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#141B2B]/40 backdrop-blur-sm p-4">
//       <div className="bg-[#FFFFFF] w-full max-w-[540px] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
//         <div className="flex items-center justify-between px-7 py-5 border-b border-[#C3C5D8] shrink-0 z-10">
//           <div className="flex items-center gap-3">
//             <ShieldCheck size={24} className="text-[#004DD2]" />
//             <h2 className="text-[18px] font-semibold text-[#141B2B]">
//               {isApproved ? "Faculty Profile & Actions" : "Approve Faculty Registration"}
//             </h2>
//           </div>
//           <button 
//             onClick={onClose} 
//             className="text-[#585F6C] hover:text-[#141B2B] hover:bg-slate-100 p-1.5 rounded-full transition-colors"
//           >
//             <X size={20} />
//           </button>
//         </div>

//         <div className="overflow-y-auto flex-1 p-7 space-y-6 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:bg-[#C3C5D8] [&::-webkit-scrollbar-thumb]:rounded-full">
//           {loading ? (
//             <div className="py-12 flex justify-center"><LoadingSpinner label="Loading Profile..." /></div>
//           ) : error ? (
//             <div className="py-12 text-center text-[#BA1A1A]">{error}</div>
//           ) : (
//             <>
//               <NotificationBanner />
              
//               <div className="bg-[#F1F3FF] border border-[#C3C5D8] rounded-[12px] p-6">
//                 <div className="mb-6">
//                   <p className="text-[11px] font-semibold text-[#585F6C] uppercase tracking-wide mb-1">Faculty Member</p>
//                   <h3 className="text-[20px] font-bold text-[#141B2B] capitalize">Prof. {displayName}</h3>
                  
//                   {isApproved && (faculty?.FacultyApproval?.uvfin || faculty?.uvfin) && (
//                     <p className="text-[13px] font-semibold text-[#004DD2] mt-1">
//                       UVFIN: {faculty?.FacultyApproval?.uvfin || faculty?.uvfin}
//                     </p>
//                   )}
//                 </div>
                
//                 <div className="grid grid-cols-2 gap-y-5">
//                   <div>
//                     <p className="text-[11px] font-semibold text-[#585F6C] uppercase tracking-wide mb-1">Qualification</p>
//                     <p className="text-[14px] font-medium text-[#141B2B]">{faculty?.qualification || "—"}</p>
//                   </div>
//                   <div>
//                     <p className="text-[11px] font-semibold text-[#585F6C] uppercase tracking-wide mb-1">Last Login</p>
//                     <p className="text-[14px] font-medium text-[#141B2B]">{formatDateTime(faculty?.last_login)}</p>
//                   </div>
//                   <div>
//                     <p className="text-[11px] font-semibold text-[#585F6C] uppercase tracking-wide mb-1">Reg. Date</p>
//                     <p className="text-[14px] font-medium text-[#141B2B]">{formatDate(faculty?.created_at)}</p>
//                   </div>
//                   <div>
//                     <p className="text-[11px] font-semibold text-[#585F6C] uppercase tracking-wide mb-1">Status</p>
//                     {isPending ? (
//                       <span className="inline-flex items-center px-2.5 py-0.5 rounded text-[11px] font-bold bg-[#FFEDD5] text-[#92400E]">
//                         Pending Verification
//                       </span>
//                     ) : (
//                       <span className={`inline-flex items-center px-2.5 py-0.5 rounded text-[11px] font-bold ${faculty?.is_active ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'}`}>
//                         {faculty?.is_active ? 'Active Account' : 'Inactive Account'}
//                       </span>
//                     )}
//                   </div>
//                 </div>
//               </div>

//               <div className="bg-[#FFFFFF] border border-[#C3C5D8] rounded-[12px] p-6">
//                 <div className="flex justify-between items-center mb-6">
//                   <div className="flex items-center gap-2">
//                     <User size={18} className="text-[#004DD2]" />
//                     <h3 className="text-[16px] font-semibold text-[#141B2B]">Personal Information</h3>
//                   </div>
//                 </div>
                
//                 <div className="grid grid-cols-2 gap-y-5 gap-x-4">
//                   <div>
//                     <p className="text-[12px] text-[#585F6C] mb-1">Full Name</p>
//                     <p className="text-[14px] font-medium text-[#141B2B] capitalize">{displayName}</p>
//                   </div>
//                   <div>
//                     <p className="text-[12px] text-[#585F6C] mb-1">Phone Number</p>
//                     <p className="text-[14px] font-medium text-[#141B2B]">{faculty?.phone_number ? `+91 ${faculty.phone_number}` : "—"}</p>
//                   </div>
//                   <div>
//                     <p className="text-[12px] text-[#585F6C] mb-1">Email Address</p>
//                     <p className="text-[14px] font-medium text-[#141B2B]">{faculty?.email || "—"}</p>
//                   </div>
//                   <div>
//                     <p className="text-[12px] text-[#585F6C] mb-1">Aadhaar Number</p>
//                     <p className="text-[14px] font-medium text-[#141B2B]">{faculty?.aadhaar_no || "—"}</p>
//                   </div>
//                   <div className="col-span-2">
//                     <p className="text-[12px] text-[#585F6C] mb-1">Residential Address</p>
//                     <p className="text-[14px] font-medium text-[#141B2B] leading-relaxed">{faculty?.address || "—"}</p>
//                   </div>
//                 </div>
//               </div>

//               <div className="bg-[#FFFFFF] border border-[#C3C5D8] rounded-[12px] p-6">
//                 <div className="flex justify-between items-center mb-6">
//                   <div className="flex items-center gap-2">
//                     <GraduationCap size={18} className="text-[#004DD2]" />
//                     <h3 className="text-[16px] font-semibold text-[#141B2B]">Academic & Professional</h3>
//                   </div>
//                 </div>
                
//                 <div className="grid grid-cols-1 gap-y-5 gap-x-4">
//                   <div>
//                     <p className="text-[12px] text-[#585F6C] mb-1">Highest Qualification</p>
//                     <p className="text-[14px] font-medium text-[#141B2B]">{faculty?.qualification || "—"}</p>
//                   </div>
//                 </div>
//               </div>

//               {/* NEW BANK INFORMATION SECTION */}
//               <div className="bg-[#FFFFFF] border border-[#C3C5D8] rounded-[12px] p-6">
//                 <div className="flex justify-between items-center mb-6">
//                   <div className="flex items-center gap-2">
//                     <CreditCard size={18} className="text-[#004DD2]" />
//                     <h3 className="text-[16px] font-semibold text-[#141B2B]">Bank Information</h3>
//                   </div>
//                 </div>
                
//                 <div className="grid grid-cols-2 gap-y-5 gap-x-4">
//                   <div>
//                     <p className="text-[12px] text-[#585F6C] mb-1">Bank Name</p>
//                     <p className="text-[14px] font-medium text-[#141B2B]">{faculty?.bank_name || "—"}</p>
//                   </div>
//                   <div>
//                     <p className="text-[12px] text-[#585F6C] mb-1">Account Number</p>
//                     <p className="text-[14px] font-medium text-[#141B2B]">{faculty?.account_no || "—"}</p>
//                   </div>
//                   <div>
//                     <p className="text-[12px] text-[#585F6C] mb-1">IFSC Code</p>
//                     <p className="text-[14px] font-medium text-[#141B2B] uppercase">{faculty?.ifsc_code || "—"}</p>
//                   </div>
//                   <div>
//                     <p className="text-[12px] text-[#585F6C] mb-1">PAN Card No</p>
//                     <p className="text-[14px] font-medium text-[#141B2B] uppercase">{faculty?.pan_card_no || "—"}</p>
//                   </div>
//                 </div>
//               </div>

//             </>
//           )}
//         </div>

//         {/* --- FOOTER: PENDING ACTIONS --- */}
//         {!loading && !error && isPending && (
//           <div className="border-t border-[#C3C5D8] bg-[#FFFFFF] p-5 px-7 shrink-0 rounded-b-2xl flex gap-4">
//             <button 
//               onClick={() => setCurrentView("approve")}
//               className="px-6 py-2.5 bg-[#004DD2] hover:bg-blue-700 text-[#FFFFFF] font-semibold rounded-[8px] text-[14px] flex items-center gap-2 transition-colors"
//             >
//               <CheckCircle2 size={18} /> Approve Profile
//             </button>
//             <button 
//               onClick={() => setCurrentView("reject")}
//               className="px-6 py-2.5 bg-[#FFFFFF] border border-[#BA1A1A] hover:bg-red-50 text-[#BA1A1A] font-semibold rounded-[8px] text-[14px] flex items-center gap-2 transition-colors"
//             >
//               <XCircle size={18} /> Reject & Feedback
//             </button>
//           </div>
//         )}

//         {/* --- FOOTER: APPROVED ACTIONS (STATUS & UVFIN) --- */}
//         {!loading && !error && isApproved && (
//           <div className="border-t border-[#C3C5D8] bg-[#F8F9FA] p-5 px-7 shrink-0 rounded-b-2xl flex flex-wrap items-center justify-between gap-4">
            
//             {/* Status Toggle Button */}
//             <button 
//               onClick={handleToggleStatus}
//               disabled={isUpdatingStatus}
//               className={`px-5 py-2.5 rounded-[8px] text-[14px] font-semibold flex items-center gap-2 transition-colors ${
//                 faculty?.is_active 
//                   ? "bg-white border border-[#BA1A1A] text-[#BA1A1A] hover:bg-red-50" 
//                   : "bg-white border border-[#16A34A] text-[#16A34A] hover:bg-green-50"
//               }`}
//             >
//               {isUpdatingStatus ? (
//                 <LoadingSpinner size="sm" />
//               ) : faculty?.is_active ? (
//                 <XCircle size={18} /> 
//               ) : (
//                 <CheckCircle2 size={18} />
//               )}
//               {faculty?.is_active ? "Deactivate Faculty" : "Activate Faculty"}
//             </button>

//             {/* Optional UVFIN Addition */}
//             {missingUvfin && (
//               showUvfinInput ? (
//                 <div className="flex items-center gap-2">
//                   <input 
//                     type="text" 
//                     value={newUvfin} 
//                     onChange={e => setNewUvfin(e.target.value)} 
//                     placeholder="Enter UVFIN..."
//                     autoFocus
//                     className="w-36 px-3 py-2 border border-[#C3C5D8] rounded-[6px] text-[13px] font-medium focus:outline-none focus:border-[#004DD2]"
//                   />
//                   <button 
//                     onClick={handleUpdateUvfin}
//                     disabled={uvfinLoading || !newUvfin.trim()}
//                     className="px-4 py-2 bg-[#004DD2] text-white text-[13px] font-medium rounded-[6px] hover:bg-blue-700 disabled:opacity-50 transition-colors"
//                   >
//                     {uvfinLoading ? "Saving..." : "Save"}
//                   </button>
//                   <button 
//                     onClick={() => { setShowUvfinInput(false); setNewUvfin(""); }}
//                     className="p-1.5 text-[#585F6C] hover:bg-slate-200 rounded-md transition-colors"
//                   >
//                     <X size={16} />
//                   </button>
//                 </div>
//               ) : (
//                 <button 
//                   onClick={() => setShowUvfinInput(true)}
//                   className="px-5 py-2.5 bg-[#004DD2] hover:bg-blue-700 text-[#FFFFFF] font-semibold rounded-[8px] text-[14px] flex items-center gap-2 transition-colors"
//                 >
//                   <Briefcase size={16} /> Assign UVFIN
//                 </button>
//               )
//             )}
//           </div>
//         )}
//       </div>
//     </div>
//   );
// }












import React, { useEffect, useState } from "react";
import { 
  X, 
  ShieldCheck, 
  User, 
  GraduationCap, 
  CheckCircle2, 
  XCircle, 
  Check,
  Briefcase,
  AlertTriangle,
  CreditCard
} from "lucide-react";
import adminApi from "../../api/adminApi";
import LoadingSpinner from "./LoadingSpinner";
import api from "../../api/axiosInstance"; // Adjust the ../ as needed based on folder depth

export default function FacultyModal({ userId, onClose, onActionSuccess, initialView = "profile" }) {
  const [faculty, setFaculty] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  
  // Navigation State
  const [currentView, setCurrentView] = useState(initialView); 
  
  // Action States (Approvals & Rejections)
  const [uvfin, setUvfin] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  // New Action States (Approved Faculty specific)
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [showUvfinInput, setShowUvfinInput] = useState(false);
  const [newUvfin, setNewUvfin] = useState("");
  const [uvfinLoading, setUvfinLoading] = useState(false);

  // --- NEW: Inline Notification State ---
  const [notification, setNotification] = useState(null); // { type: 'success' | 'error', text: '' }

  // Helper to fetch Auth Token
  const getAuthHeaders = () => {
    const session = JSON.parse(localStorage.getItem('iipsCurrentSession') || '{}');
    return { Authorization: `Bearer ${session.token}` };
  };

  useEffect(() => {
    let active = true;
    if (!userId) return;

    (async () => {
      setLoading(true);
      try {
        const data = await adminApi.getFacultyById(userId);
        if (active) setFaculty(data?.data ?? data?.faculty ?? data);
      } catch (err) {
        if (active) setError("Failed to load faculty profile.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [userId]);

  const displayName = faculty?.full_name || faculty?.name || "Unknown Faculty";

  const formatDate = (dateString) => {
    if (!dateString) return "—";
    return new Date(dateString).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };
  
  const formatDateTime = (dateString) => {
    if (!dateString) return "—";
    return new Date(dateString).toLocaleString('en-GB', { 
      day: '2-digit', month: 'short', year: 'numeric', 
      hour: '2-digit', minute: '2-digit', hour12: true 
    });
  };

  const handleApproveSubmit = async () => {
    setActionLoading(true);
    setNotification(null);
    try {
      await adminApi.approveFaculty(faculty.id || faculty.user_id, uvfin);
      onActionSuccess && onActionSuccess({ 
        action: 'approved',
        userId: faculty.id || faculty.user_id,
        facultyName: displayName,
        email: faculty?.email,
        uvfin: uvfin ? uvfin.trim() : null
      });
      onClose();
    } catch (err) {
      setNotification({ type: 'error', text: "Approval failed: " + (err.response?.data?.message || err.message || "Unknown Error") });
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejectSubmit = async () => {
    if (!rejectReason.trim()) {
      setNotification({ type: 'error', text: "Please provide a reason for rejection." });
      return;
    }
    setActionLoading(true);
    setNotification(null);
    try {
      await adminApi.rejectFaculty(faculty.id || faculty.user_id, rejectReason);
      onActionSuccess && onActionSuccess({ 
        action: 'rejected',
        userId: faculty.id || faculty.user_id,
        facultyName: displayName,
        email: faculty?.email,
        rejection_reason: rejectReason
      });
      onClose();
    } catch (err) {
      setNotification({ type: 'error', text: "Rejection failed: " + (err.response?.data?.message || err.message || "Unknown Error") });
    } finally {
      setActionLoading(false);
    }
  };

  // --- NEW HANDLERS: TOGGLE STATUS & UPDATE UVFIN ---
  
  const handleToggleStatus = async () => {
    setIsUpdatingStatus(true);
    setNotification(null);
    try {
      const action = faculty.is_active ? "deactivate" : "activate";
      const facultyId = faculty.id || faculty.user_id;
      const nextIsActive = !faculty.is_active;
      
      await api.put(`/account-status/admin/faculty/${facultyId}/${action}`, {});
      
      setFaculty(prev => ({ ...prev, is_active: nextIsActive }));
      setNotification({ type: 'success', text: `Account successfully ${action}d.` });
      onActionSuccess && onActionSuccess({ 
        action: 'status_changed', 
        userId: facultyId, 
        is_active: nextIsActive 
      });
      
      setTimeout(() => setNotification(null), 3000);
    } catch (err) {
      setNotification({ type: 'error', text: err.response?.data?.message || "Failed to update account status." });
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleUpdateUvfin = async () => {
    if (!newUvfin.trim()) {
      setNotification({ type: 'error', text: "Please enter a valid UVFIN." });
      return;
    }
    setUvfinLoading(true);
    setNotification(null);
    try {
      const facultyId = faculty.id || faculty.user_id;
      const response = await api.put(`/admin/updateFaculty/${facultyId}`, { uvfin: newUvfin });
      
      // Update local state gracefully 
      setFaculty(prev => ({
        ...prev,
        uvfin: newUvfin,
        FacultyApproval: { ...prev.FacultyApproval, uvfin: newUvfin }
      }));
      setShowUvfinInput(false);
      setNotification({ type: 'success', text: response.data?.message || "UVFIN updated successfully!" });
      onActionSuccess && onActionSuccess({ 
        action: 'uvfin_updated', 
        userId: facultyId, 
        uvfin: newUvfin 
      });
      
      setTimeout(() => setNotification(null), 3000);
    } catch (err) {
      setNotification({ type: 'error', text: err.response?.data?.message || "Failed to assign UVFIN." });
    } finally {
      setUvfinLoading(false);
    }
  };

  // --- REUSABLE NOTIFICATION BANNER COMPONENT ---
  const NotificationBanner = () => {
    if (!notification) return null;
    return (
      <div className={`p-4 mb-2 rounded-[8px] flex items-center gap-3 text-[13px] font-semibold border animate-in fade-in duration-200 ${
        notification.type === 'error' 
          ? 'bg-[#FEF2F2] text-[#DC3545] border-[#FCA5A5]' 
          : 'bg-[#F0FDF4] text-[#16A34A] border-[#BBF7D0]'
      }`}>
        {notification.type === 'error' ? <AlertTriangle size={18} /> : <CheckCircle2 size={18} />}
        {notification.text}
      </div>
    );
  };

  // --------------------------------------------------------
  // VIEW 1: APPROVE REGISTRATION (Figma Match)
  // --------------------------------------------------------
  if (currentView === "approve") {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#141B2B]/40 backdrop-blur-sm p-4">
        <div className="bg-[#FFFFFF] w-full max-w-[480px] rounded-2xl shadow-2xl overflow-hidden flex flex-col">
          <div className="flex items-center justify-between p-6 border-b border-[#C3C5D8]">
            <div className="flex items-center gap-3">
              <div className="bg-[#004DD2] text-white p-1.5 rounded-lg shadow-sm">
                <ShieldCheck size={20} />
              </div>
              <h2 className="text-[18px] font-semibold text-[#141B2B]">Approve Faculty Registration</h2>
            </div>
            <button onClick={onClose} className="text-[#585F6C] hover:bg-slate-100 p-1.5 rounded-full transition-colors">
              <X size={20} />
            </button>
          </div>

          <div className="p-6 space-y-6">
            <NotificationBanner />
            
            <div className="bg-[#F8F9FA] border border-[#C3C5D8] rounded-[12px] p-5">
              <p className="text-[11px] font-semibold text-[#585F6C] uppercase tracking-wide mb-1">Faculty Member</p>
              <p className="text-[15px] font-bold text-[#141B2B] capitalize mb-4">{displayName}</p>
              
              <div className="grid grid-cols-2 gap-y-4">
                <div>
                  <p className="text-[11px] font-semibold text-[#585F6C] uppercase mb-1">Qualification</p>
                  <p className="text-[14px] font-medium text-[#141B2B]">{faculty?.qualification || "—"}</p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-[#585F6C] uppercase mb-1">Last Login</p>
                  <p className="text-[14px] font-medium text-[#141B2B]">{formatDateTime(faculty?.last_login)}</p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-[#585F6C] uppercase mb-1">Reg. Date</p>
                  <p className="text-[14px] font-medium text-[#141B2B]">{formatDate(faculty?.created_at)}</p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-[#585F6C] uppercase mb-1">Status</p>
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-[#FFEDD5] text-[#92400E]">
                    Pending Verification
                  </span>
                </div>
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-[14px] font-semibold text-[#141B2B]">Assign UVFIN ID</label>
                <span className="bg-slate-100 text-[#585F6C] text-[10px] font-bold px-2 py-0.5 rounded">OPTIONAL</span>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Briefcase size={16} className="text-[#585F6C]" />
                </div>
                <input
                  type="text"
                  value={uvfin}
                  onChange={(e) => setUvfin(e.target.value)}
                  placeholder="Can be allocated later..."
                  className="w-full pl-9 pr-4 py-2.5 rounded-[8px] border border-[#C3C5D8] focus:border-[#004DD2] focus:ring-1 focus:ring-[#004DD2] outline-none text-[14px] transition-all"
                />
              </div>
              <p className="text-[12px] text-[#585F6C] mt-2">
                This unique identifier will be used for all academic and financial records.
              </p>
            </div>
          </div>

          <div className="flex gap-3 p-6 pt-0">
            <button 
              onClick={() => setCurrentView("profile")}
              className="flex-1 px-4 py-2.5 text-[#585F6C] bg-white border border-[#C3C5D8] hover:bg-slate-50 rounded-[8px] text-[14px] font-semibold transition-colors"
            >
              Cancel
            </button>
            <button 
              onClick={handleApproveSubmit}
              disabled={actionLoading}
              className="flex-1 px-4 py-2.5 bg-[#004DD2] hover:bg-blue-700 text-white rounded-[8px] text-[14px] font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
            >
              Submit Approval <Check size={16} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --------------------------------------------------------
  // VIEW 2: REJECT REGISTRATION
  // --------------------------------------------------------
  if (currentView === "reject") {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#141B2B]/40 backdrop-blur-sm p-4">
        <div className="bg-[#FFFFFF] w-full max-w-[420px] rounded-2xl shadow-2xl overflow-hidden flex flex-col">
          <div className="flex items-start justify-between p-6 border-b border-[#C3C5D8]">
            <div className="flex gap-4">
              <div className="bg-red-50 text-[#DC3545] p-2.5 rounded-full shrink-0">
                <AlertTriangle size={24} strokeWidth={2.5} />
              </div>
              <div>
                <h2 className="text-[18px] font-bold text-[#141B2B]">Reject Faculty Registration</h2>
                <p className="text-[12px] font-medium text-[#585F6C] mt-1">This action cannot be undone easily.</p>
              </div>
            </div>
            <button onClick={onClose} className="text-[#585F6C] hover:bg-slate-100 p-1.5 shrink-0 rounded-full transition-colors">
              <X size={20} />
            </button>
          </div>

          <div className="p-6 space-y-6">
            <NotificationBanner />
            
            <div className="bg-[#F8F9FA] border border-[#C3C5D8] rounded-[8px] p-4">
              <p className="text-[14px] text-[#141B2B] font-bold capitalize">{displayName}</p>
              <p className="text-[13px] text-[#585F6C] font-medium mt-1">
                {faculty?.qualification || "Qualification details missing"}
              </p>
            </div>

            <div>
              <label className="block text-[14px] font-bold text-[#141B2B] mb-2">
                Rejection Remarks <span className="text-[#DC3545]">*</span>
              </label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Explain the reason for rejection (e.g., 'Incomplete documentation', 'Invalid credentials')..."
                className="w-full p-4 rounded-[8px] border border-[#C3C5D8] focus:border-[#DC3545] focus:ring-1 focus:ring-[#DC3545] outline-none text-[14px] min-h-[120px] resize-none transition-all"
              />
              <p className="text-[12px] text-[#585F6C] mt-2 font-medium">
                Provide a clear explanation that will be sent to the faculty member.
              </p>
            </div>
          </div>

          <div className="flex gap-3 p-6 pt-0">
            <button 
              onClick={() => setCurrentView("profile")}
              className="flex-1 px-4 py-2.5 text-[#585F6C] bg-white border border-[#C3C5D8] hover:bg-slate-50 rounded-[8px] text-[14px] font-bold transition-colors"
            >
              Cancel
            </button>
            <button 
              onClick={handleRejectSubmit}
              disabled={actionLoading || !rejectReason.trim()}
              className="flex-1 px-4 py-2.5 bg-[#DC3545] hover:bg-red-700 text-white rounded-[8px] text-[14px] font-bold transition-colors disabled:opacity-50"
            >
              Confirm Rejection
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --------------------------------------------------------
  // VIEW 3: MAIN PROFILE VIEW (Default)
  // --------------------------------------------------------
  
  // Calculate specific conditions for UI rendering
  const isPending = (!faculty?.is_approved || faculty?.status === 'pending');
  const isApproved = (faculty?.is_approved || faculty?.status === 'approved' || faculty?.FacultyApproval?.status === 'approved');
  const missingUvfin = isApproved && !faculty?.FacultyApproval?.uvfin && !faculty?.uvfin;
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#141B2B]/40 backdrop-blur-sm p-4">
      <div className="bg-[#FFFFFF] w-full max-w-[540px] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        <div className="flex items-center justify-between px-7 py-5 border-b border-[#C3C5D8] shrink-0 z-10">
          <div className="flex items-center gap-3">
            <ShieldCheck size={24} className="text-[#004DD2]" />
            <h2 className="text-[18px] font-semibold text-[#141B2B]">
              {isApproved ? "Faculty Profile & Actions" : "Approve Faculty Registration"}
            </h2>
          </div>
          <button 
            onClick={onClose} 
            className="text-[#585F6C] hover:text-[#141B2B] hover:bg-slate-100 p-1.5 rounded-full transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-7 space-y-6 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:bg-[#C3C5D8] [&::-webkit-scrollbar-thumb]:rounded-full">
          {loading ? (
            <div className="py-12 flex justify-center"><LoadingSpinner label="Loading Profile..." /></div>
          ) : error ? (
            <div className="py-12 text-center text-[#BA1A1A]">{error}</div>
          ) : (
            <>
              <NotificationBanner />
              
              <div className="bg-[#F1F3FF] border border-[#C3C5D8] rounded-[12px] p-6">
                <div className="mb-6">
                  <p className="text-[11px] font-semibold text-[#585F6C] uppercase tracking-wide mb-1">Faculty Member</p>
                  <h3 className="text-[20px] font-bold text-[#141B2B] capitalize">Prof. {displayName}</h3>
                  
                  {isApproved && (faculty?.FacultyApproval?.uvfin || faculty?.uvfin) && (
                    <p className="text-[13px] font-semibold text-[#004DD2] mt-1">
                      UVFIN: {faculty?.FacultyApproval?.uvfin || faculty?.uvfin}
                    </p>
                  )}
                </div>
                
                <div className="grid grid-cols-2 gap-y-5">
                  <div>
                    <p className="text-[11px] font-semibold text-[#585F6C] uppercase tracking-wide mb-1">Qualification</p>
                    <p className="text-[14px] font-medium text-[#141B2B]">{faculty?.qualification || "—"}</p>
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold text-[#585F6C] uppercase tracking-wide mb-1">Last Login</p>
                    <p className="text-[14px] font-medium text-[#141B2B]">{formatDateTime(faculty?.last_login)}</p>
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold text-[#585F6C] uppercase tracking-wide mb-1">Reg. Date</p>
                    <p className="text-[14px] font-medium text-[#141B2B]">{formatDate(faculty?.created_at)}</p>
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold text-[#585F6C] uppercase tracking-wide mb-1">Status</p>
                    {isPending ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded text-[11px] font-bold bg-[#FFEDD5] text-[#92400E]">
                        Pending Verification
                      </span>
                    ) : (
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded text-[11px] font-bold ${faculty?.is_active ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'}`}>
                        {faculty?.is_active ? 'Active Account' : 'Inactive Account'}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="bg-[#FFFFFF] border border-[#C3C5D8] rounded-[12px] p-6">
                <div className="flex justify-between items-center mb-6">
                  <div className="flex items-center gap-2">
                    <User size={18} className="text-[#004DD2]" />
                    <h3 className="text-[16px] font-semibold text-[#141B2B]">Personal Information</h3>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-y-5 gap-x-4">
                  <div>
                    <p className="text-[12px] text-[#585F6C] mb-1">Full Name</p>
                    <p className="text-[14px] font-medium text-[#141B2B] capitalize">{displayName}</p>
                  </div>
                  <div>
                    <p className="text-[12px] text-[#585F6C] mb-1">Phone Number</p>
                    <p className="text-[14px] font-medium text-[#141B2B]">{faculty?.phone_number ? `+91 ${faculty.phone_number}` : "—"}</p>
                  </div>
                  <div>
                    <p className="text-[12px] text-[#585F6C] mb-1">Email Address</p>
                    <p className="text-[14px] font-medium text-[#141B2B]">{faculty?.email || "—"}</p>
                  </div>
                  <div>
                    <p className="text-[12px] text-[#585F6C] mb-1">Aadhaar Number</p>
                    <p className="text-[14px] font-medium text-[#141B2B]">{faculty?.aadhaar_no || "—"}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-[12px] text-[#585F6C] mb-1">Residential Address</p>
                    <p className="text-[14px] font-medium text-[#141B2B] leading-relaxed">{faculty?.address || "—"}</p>
                  </div>
                </div>
              </div>

              <div className="bg-[#FFFFFF] border border-[#C3C5D8] rounded-[12px] p-6">
                <div className="flex justify-between items-center mb-6">
                  <div className="flex items-center gap-2">
                    <GraduationCap size={18} className="text-[#004DD2]" />
                    <h3 className="text-[16px] font-semibold text-[#141B2B]">Academic & Professional</h3>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 gap-y-5 gap-x-4">
                  <div>
                    <p className="text-[12px] text-[#585F6C] mb-1">Highest Qualification</p>
                    <p className="text-[14px] font-medium text-[#141B2B]">{faculty?.qualification || "—"}</p>
                  </div>
                </div>
              </div>

              {/* NEW BANK INFORMATION SECTION */}
              <div className="bg-[#FFFFFF] border border-[#C3C5D8] rounded-[12px] p-6">
                <div className="flex justify-between items-center mb-6">
                  <div className="flex items-center gap-2">
                    <CreditCard size={18} className="text-[#004DD2]" />
                    <h3 className="text-[16px] font-semibold text-[#141B2B]">Bank Information</h3>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-y-5 gap-x-4">
                  <div>
                    <p className="text-[12px] text-[#585F6C] mb-1">Bank Name</p>
                    <p className="text-[14px] font-medium text-[#141B2B]">{faculty?.bank_name || "—"}</p>
                  </div>
                  <div>
                    <p className="text-[12px] text-[#585F6C] mb-1">Account Number</p>
                    <p className="text-[14px] font-medium text-[#141B2B]">{faculty?.account_no || "—"}</p>
                  </div>
                  <div>
                    <p className="text-[12px] text-[#585F6C] mb-1">IFSC Code</p>
                    <p className="text-[14px] font-medium text-[#141B2B] uppercase">{faculty?.ifsc_code || "—"}</p>
                  </div>
                  <div>
                    <p className="text-[12px] text-[#585F6C] mb-1">PAN Card No</p>
                    <p className="text-[14px] font-medium text-[#141B2B] uppercase">{faculty?.pan_card_no || "—"}</p>
                  </div>
                </div>
              </div>

            </>
          )}
        </div>

        {/* --- FOOTER: PENDING ACTIONS --- */}
        {!loading && !error && isPending && (
          <div className="border-t border-[#C3C5D8] bg-[#FFFFFF] p-5 px-7 shrink-0 rounded-b-2xl flex gap-4">
            <button 
              onClick={() => setCurrentView("approve")}
              className="px-6 py-2.5 bg-[#004DD2] hover:bg-blue-700 text-[#FFFFFF] font-semibold rounded-[8px] text-[14px] flex items-center gap-2 transition-colors"
            >
              <CheckCircle2 size={18} /> Approve Profile
            </button>
            <button 
              onClick={() => setCurrentView("reject")}
              className="px-6 py-2.5 bg-[#FFFFFF] border border-[#BA1A1A] hover:bg-red-50 text-[#BA1A1A] font-semibold rounded-[8px] text-[14px] flex items-center gap-2 transition-colors"
            >
              <XCircle size={18} /> Reject & Feedback
            </button>
          </div>
        )}

        {/* --- FOOTER: APPROVED ACTIONS (STATUS & UVFIN) --- */}
        {!loading && !error && isApproved && (
          <div className="border-t border-[#C3C5D8] bg-[#F8F9FA] p-5 px-7 shrink-0 rounded-b-2xl flex flex-wrap items-center justify-between gap-4">
            
            {/* Status Toggle Button */}
            <button 
              onClick={handleToggleStatus}
              disabled={isUpdatingStatus}
              className={`px-5 py-2.5 rounded-[8px] text-[14px] font-semibold flex items-center gap-2 transition-colors ${
                faculty?.is_active 
                  ? "bg-white border border-[#BA1A1A] text-[#BA1A1A] hover:bg-red-50" 
                  : "bg-white border border-[#16A34A] text-[#16A34A] hover:bg-green-50"
              }`}
            >
              {isUpdatingStatus ? (
                <LoadingSpinner size="sm" />
              ) : faculty?.is_active ? (
                <XCircle size={18} /> 
              ) : (
                <CheckCircle2 size={18} />
              )}
              {faculty?.is_active ? "Deactivate Faculty" : "Activate Faculty"}
            </button>

            {/* Optional UVFIN Addition */}
            {missingUvfin && (
              showUvfinInput ? (
                <div className="flex items-center gap-2">
                  <input 
                    type="text" 
                    value={newUvfin} 
                    onChange={e => setNewUvfin(e.target.value)} 
                    placeholder="Enter UVFIN..."
                    autoFocus
                    className="w-36 px-3 py-2 border border-[#C3C5D8] rounded-[6px] text-[13px] font-medium focus:outline-none focus:border-[#004DD2]"
                  />
                  <button 
                    onClick={handleUpdateUvfin}
                    disabled={uvfinLoading || !newUvfin.trim()}
                    className="px-4 py-2 bg-[#004DD2] text-white text-[13px] font-medium rounded-[6px] hover:bg-blue-700 disabled:opacity-50 transition-colors"
                  >
                    {uvfinLoading ? "Saving..." : "Save"}
                  </button>
                  <button 
                    onClick={() => { setShowUvfinInput(false); setNewUvfin(""); }}
                    className="p-1.5 text-[#585F6C] hover:bg-slate-200 rounded-md transition-colors"
                  >
                    <X size={16} />
                  </button>
                </div>
              ) : (
                <button 
                  onClick={() => setShowUvfinInput(true)}
                  className="px-5 py-2.5 bg-[#004DD2] hover:bg-blue-700 text-[#FFFFFF] font-semibold rounded-[8px] text-[14px] flex items-center gap-2 transition-colors"
                >
                  <Briefcase size={16} /> Assign UVFIN
                </button>
              )
            )}
          </div>
        )}
      </div>
    </div>
  );
}