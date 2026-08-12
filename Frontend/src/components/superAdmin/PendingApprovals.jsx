import React, { useState, useEffect } from "react";
import Topbar from "./Topbar";
import { Search, Eye, CheckCircle, XCircle, X, ChevronLeft, ChevronRight, Loader2, Mail } from "lucide-react";
import api from "../../api/axiosInstance";

const tabs = [
  { key: "pendingAdmin", label: "Pending" },
  { key: "approvedAdmin", label: "Approved" },
  { key: "rejectedAdmin", label: "Rejected" },
  { key: "allAdmin", label: "All" },
];

export default function PendingApprovalsPage() {
  const [activeTab, setActiveTab] = useState("pendingAdmin");
  
  const [admins, setAdmins] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const [currentPage, setCurrentPage] = useState(1);
  const recordsPerPage = 5;

  const [selectedAdmin, setSelectedAdmin] = useState(null);
  const [modalType, setModalType] = useState(null); 
  const [rejectReason, setRejectReason] = useState("");
  
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateError, setUpdateError] = useState("");

  const [toast, setToast] = useState(null);

  useEffect(() => {
    setCurrentPage(1); 
    fetchAdmins(activeTab);
  }, [activeTab]);

  const fetchAdmins = async (endpointKey) => {
    setIsLoading(true);
    setError("");
    try {
      const session = JSON.parse(localStorage.getItem('iipsCurrentSession') || '{}');
      const response = await api.get(`/super_admin/${endpointKey}`);
      setAdmins(response.data.data || []); 
    } catch (err) {
      console.error("Error fetching admins:", err);
      setError("Failed to load data. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    return isNaN(date.getTime()) ? dateString : date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const showToast = (type, title, message) => {
    setToast({ type, title, message });
    setTimeout(() => setToast(null), 5000); 
  };

  const getAdminStatus = (admin) => {
    if (admin?.AdminApproval?.status) return admin.AdminApproval.status.toLowerCase();
    if (admin?.status) return admin.status.toLowerCase();
    return "pending";
  };

  const getAdminRejectionReason = (admin) => {
    if (admin?.AdminApproval?.rejection_reason) return admin.AdminApproval.rejection_reason;
    if (admin?.rejection_reason) return admin.rejection_reason;
    return null;
  };

  // const handleStatusUpdate = async (status) => {
  //   if (status === 'rejected' && !rejectReason.trim()) {
  //     setUpdateError("Please provide a reason for rejection.");
  //     return;
  //   }

  //   if (!selectedAdmin) {
  //     setUpdateError("No admin selected.");
  //     return;
  //   }

  //   setIsUpdating(true);
  //   setUpdateError("");

  //   try {
  //     const session = JSON.parse(localStorage.getItem('iipsCurrentSession') || '{}');
  //     const targetUserId = selectedAdmin.user_id || selectedAdmin.id || selectedAdmin.userId;

  //     if (!targetUserId) {
  //       throw new Error("Could not identify the User ID.");
  //     }

  //     const payload = { status: status };
  //     if (status === 'rejected') payload.rejection_reason = rejectReason;

  //     await api.put(`/super_admin/admin/${targetUserId}/approve`, payload);

  //     if (status === 'approved') {
  //       showToast('success', 'Program Incharge Approved', `Credentials emailed to ${selectedAdmin.email}`);
  //     } else {
  //       showToast('error', 'Application Rejected', `Rejection notice sent to ${selectedAdmin.email}`);
  //     }

  //     closeModal();
  //     fetchAdmins(activeTab); 

  //   } catch (err) {
  //     console.error(`Error updating status to ${status}:`, err);
  //     setUpdateError(err.response?.data?.message || err.message || "An error occurred while updating.");
  //   } finally {
  //     setIsUpdating(false);
  //   }
  // };
  const handleStatusUpdate = async (status) => {
    if (status === 'rejected' && !rejectReason.trim()) {
      setUpdateError("Please provide a reason for rejection.");
      return;
    }

    if (!selectedAdmin) {
      setUpdateError("No admin selected.");
      return;
    }

    setIsUpdating(true);
    setUpdateError("");

    try {
      const targetUserId = selectedAdmin.user_id || selectedAdmin.id || selectedAdmin.userId;

      if (!targetUserId) {
        throw new Error("Could not identify the User ID.");
      }

      const payload = { status: status };
      if (status === 'rejected') payload.rejection_reason = rejectReason;

      await api.put(`/super_admin/admin/${targetUserId}/approve`, payload);

      if (status === 'approved') {
        showToast('success', 'Program Incharge Approved', `Credentials emailed to ${selectedAdmin.email}`);
      } else {
        showToast('error', 'Application Rejected', `Rejection notice sent to ${selectedAdmin.email}`);
      }

      // Instantly update local state instead of refetching
      setAdmins(prevAdmins =>
        prevAdmins
          .map(admin => {
            const id = admin.user_id || admin.id || admin.userId;
            if (id !== targetUserId) return admin;
            return {
              ...admin,
              status: status,
              AdminApproval: {
                ...admin.AdminApproval,
                status: status,
                rejection_reason: status === 'rejected' ? rejectReason : admin.AdminApproval?.rejection_reason,
              },
            };
          })
          // If viewing the "pending" tab, the item should disappear immediately
          .filter(admin => activeTab !== 'pendingAdmin' || getAdminStatus(admin) === 'pending')
      );

      closeModal();

    } catch (err) {
      console.error(`Error updating status to ${status}:`, err);
      setUpdateError(err.response?.data?.message || err.message || "An error occurred while updating.");
    } finally {
      setIsUpdating(false);
    }
  };

  const openModal = (admin, type) => {
    setSelectedAdmin(admin);
    setModalType(type);
    setRejectReason("");
    setUpdateError(""); 
  };

  const closeModal = () => {
    if (!isUpdating) {
      setSelectedAdmin(null);
      setModalType(null);
      setUpdateError("");
    }
  };

  const indexOfLastRecord = currentPage * recordsPerPage;
  const indexOfFirstRecord = indexOfLastRecord - recordsPerPage;
  const currentRecords = admins.slice(indexOfFirstRecord, indexOfLastRecord);
  const totalPages = Math.ceil(admins.length / recordsPerPage);

  const getPreviewMode = () => {
    if (modalType === 'approve') return 'approve';
    if (modalType === 'reject') return 'reject';
    return getAdminStatus(selectedAdmin) === 'rejected' ? 'reject' : 'approve';
  };

  // Helper for rendering the dynamic status box in the modal
  const renderStatusBox = () => {
    const status = getAdminStatus(selectedAdmin);
    let boxStyles, iconStyles, title, subtitle, Icon;

    if (status === 'approved') {
      boxStyles = "border-green-200 bg-green-50/30";
      iconStyles = "bg-green-100 text-green-600";
      title = "Approved Program Incharge";
      subtitle = "This PI account is active and has portal access.";
      Icon = <CheckCircle className="w-5 h-5" />;
    } else if (status === 'rejected') {
      boxStyles = "border-red-200 bg-red-50/30";
      iconStyles = "bg-red-100 text-red-600";
      title = "Rejected Program Incharge";
      subtitle = "This registration application was declined.";
      Icon = <XCircle className="w-5 h-5" />;
    } else {
      boxStyles = "border-[#D1B8E8] bg-white";
      iconStyles = "bg-[#F5EDFB] text-[#7E22CE]";
      title = "Pending Approval";
      subtitle = "This application is waiting for your review.";
      Icon = (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
    }

    return (
      <div className={`mb-6 border-2 rounded-xl p-4 flex items-center gap-4 shadow-sm ${boxStyles}`}>
        <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${iconStyles}`}>
          {Icon}
        </div>
        <div>
          <p className={`text-[10px] font-bold uppercase tracking-widest mb-0.5 ${status === 'approved' ? 'text-green-600' : status === 'rejected' ? 'text-red-600' : 'text-[#7E22CE]'}`}>
            {title}
          </p>
          <p className="text-sm font-bold text-[#1F2937]">
            {selectedAdmin.full_name || 'Program Incharge Candidate'}
          </p>
          <p className={`text-[10px] mt-0.5 font-medium ${status === 'approved' ? 'text-green-600' : status === 'rejected' ? 'text-red-600' : 'text-[#7E22CE]'}`}>
            {subtitle}
          </p>
        </div>
      </div>
    );
  };

  return (
    <div className="flex-1 bg-gray-50 min-h-screen relative overflow-hidden">
      
      {/* TOAST NOTIFICATION POP-UP */}
      {toast && (
        <div className={`fixed top-6 right-6 z-[100] max-w-sm w-full p-4 rounded-xl shadow-2xl flex items-start gap-3 animate-in slide-in-from-right-8 fade-in duration-300 ${
          toast.type === 'success' ? 'bg-[#059669] text-white' : 'bg-red-500 text-white'
        }`}>
          <div className="mt-0.5">
            {toast.type === 'success' ? <Mail className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
          </div>
          <div className="flex-1">
            <h4 className="font-bold text-sm">{toast.title}</h4>
            <p className="text-xs opacity-90 mt-0.5">{toast.message}</p>
          </div>
          <button onClick={() => setToast(null)} className="opacity-70 hover:opacity-100 transition-opacity">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <Topbar title="Pending Program Incharge Approvals" subtitle="Review, approve or reject PI registration requests" showSearch={false} />

      <div className="px-8 py-8 pb-24">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Program Incharge Registration Approvals</h1>
        <p className="text-gray-400 mb-6">Review, approve, or reject pending PI account requests</p>

        <div className="inline-flex bg-gray-100 rounded-full p-1 mb-6">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-5 py-2 rounded-full text-sm font-medium transition-colors ${
                activeTab === tab.key ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
            <div className="flex items-center flex-1 min-w-[260px] border border-gray-200 rounded-full px-4 py-2.5 gap-2">
              <Search className="w-4 h-4 text-gray-400" />
              <input 
                type="text" 
                placeholder="Search by name, email or Employee ID..." 
                className="w-full text-sm text-gray-700 outline-none bg-transparent placeholder-gray-400"
              />
            </div>
            <span className="text-sm text-gray-400 whitespace-nowrap">{admins.length} records found</span>
          </div>

          <div className="overflow-x-auto min-h-[400px]">
            {isLoading ? (
              <div className="py-20 flex flex-col items-center text-gray-500">
                <Loader2 className="w-8 h-8 animate-spin text-[#004DD2] mb-3" /> Loading records...
              </div>
            ) : error ? (
              <div className="py-20 text-center text-red-500">{error}</div>
            ) : admins.length === 0 ? (
              <div className="py-20 text-center text-gray-500">No records found.</div>
            ) : (
              <table className="w-full text-left">
                <thead>
                  <tr className="text-xs font-semibold text-gray-400 border-b border-gray-100">
                    <th className="py-3 pr-4 font-semibold uppercase">Registration ID</th>
                    <th className="py-3 pr-4 font-semibold uppercase">Program Incharge Name</th>
                    <th className="py-3 pr-4 font-semibold uppercase">Designation</th>
                    <th className="py-3 pr-4 font-semibold uppercase">Employee ID</th>
                    <th className="py-3 pr-4 font-semibold uppercase">Submitted</th>
                    <th className="py-3 pr-4 font-semibold uppercase">Status</th>
                    <th className="py-3 pr-4 font-semibold uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {currentRecords.map((r, index) => {
                    const currentStatus = getAdminStatus(r);
                    
                    return (
                      <tr key={index} className="border-b border-gray-50 last:border-0 align-middle hover:bg-gray-50 transition-colors">
                        <td className="py-4 pr-4 text-gray-700 text-sm font-medium">{r.user_id || `AR00${indexOfFirstRecord + index + 1}`}</td>
                        <td className="py-4 pr-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center font-semibold text-sm shrink-0 uppercase">
                              {r.full_name ? r.full_name[0] : 'U'}
                            </div>
                            <div>
                              <div className="font-semibold text-gray-900 text-sm">{r.full_name || "Unknown Name"}</div>
                              <div className="text-gray-400 text-xs">{r.email || "No email provided"}</div>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 pr-4 text-sm">
                          <div className="text-gray-800 font-medium">Program Incharge</div>
                          <div className="text-gray-400 text-xs">{r.department || "N/A"}</div>
                        </td>
                        <td className="py-4 pr-4 text-gray-700 text-sm">{r.employee_id || "Unassigned"}</td>
                        <td className="py-4 pr-4 text-gray-700 text-sm">{formatDate(r.created_at || r.submitted_date)}</td>
                        <td className="py-4 pr-4">
                          <span className={`text-xs font-semibold px-3 py-1.5 rounded-full capitalize border ${
                            currentStatus === 'approved' ? 'bg-green-50 text-green-600 border-green-200' :
                            currentStatus === 'rejected' ? 'bg-red-50 text-red-600 border-red-200' :
                            'bg-amber-50 text-amber-600 border-amber-200'
                          }`}>
                            {currentStatus}
                          </span>
                        </td>
                        <td className="py-4 pr-4">
                          <div className="flex items-center gap-3">
                            <button 
                              onClick={() => openModal(r, currentStatus === 'pending' ? 'approve' : 'details')}
                              className="flex items-center gap-1 text-gray-500 text-sm font-medium hover:text-gray-700 transition-colors"
                            >
                              <Eye className="w-4 h-4" /> Details
                            </button>
                            
                            {currentStatus === 'pending' && (
                              <>
                                <button 
                                  onClick={() => openModal(r, 'approve')}
                                  className="flex items-center gap-1.5 bg-[#10B981] hover:bg-[#059669] text-white text-sm font-semibold px-4 py-2 rounded-full transition-colors"
                                >
                                  <CheckCircle className="w-4 h-4" /> Approve
                                </button>
                                <button 
                                  onClick={() => openModal(r, 'reject')}
                                  className="flex items-center gap-1.5 border border-red-200 text-red-500 hover:bg-red-50 text-sm font-semibold px-4 py-2 rounded-full transition-colors"
                                >
                                  <XCircle className="w-4 h-4" /> Reject
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
          
          {/* Functional Pagination Bar */}
          {!isLoading && admins.length > 0 && (
            <div className="mt-6 border-t border-gray-100 pt-4 flex items-center justify-between">
              <div className="text-sm text-gray-400">
                Showing {indexOfFirstRecord + 1} to {Math.min(indexOfLastRecord, admins.length)} of {admins.length} records
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} disabled={currentPage === 1} className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <div className="flex gap-1">
                  {[...Array(totalPages)].map((_, i) => (
                    <button key={i} onClick={() => setCurrentPage(i + 1)} className={`w-7 h-7 rounded-full text-xs font-bold transition-colors ${ currentPage === i + 1 ? "bg-[#004DD2] text-white" : "text-gray-500 hover:bg-gray-100" }`}>
                      {i + 1}
                    </button>
                  ))}
                </div>
                <button onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))} disabled={currentPage === totalPages} className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* --- MODALS --- */}
      {selectedAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
            
            <div className="flex items-start justify-between p-6 border-b border-gray-100">
              <div>
                <h2 className="text-xl font-bold text-gray-900">
                  {modalType === 'details' ? 'Program Incharge Application Details' : modalType === 'approve' ? 'Review Program Incharge Application' : 'Reject Program Incharge Application'}
                </h2>
                <p className="text-sm text-gray-500 mt-1">Ref: {selectedAdmin.user_id || 'AR00X'} - Submitted {formatDate(selectedAdmin.created_at || selectedAdmin.submitted_date)}</p>
              </div>
              <button onClick={closeModal} disabled={isUpdating} className="p-2 text-gray-400 hover:bg-gray-100 rounded-full transition-colors disabled:opacity-50">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              {updateError && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-600 rounded-xl text-sm font-medium">
                  {updateError}
                </div>
              )}

              {/* Warning Banner for Reject Mode */}
              {(modalType === 'reject' || (modalType === 'details' && getAdminStatus(selectedAdmin) === 'rejected')) && (
                <div className="mb-6 border border-red-200 bg-red-50/50 rounded-xl p-4 flex gap-3 items-start text-red-600">
                  <XCircle className="w-5 h-5 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-sm">{selectedAdmin.full_name || 'Unknown Name'}</p>
                    <p className="text-xs">{selectedAdmin.email} - {selectedAdmin.department || 'N/A'}</p>
                  </div>
                </div>
              )}

              {(modalType === 'approve' || modalType === 'details') && (
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                    <p className="text-xs text-gray-400 mb-1">Full Name</p>
                    <p className="text-sm font-semibold text-gray-900">{selectedAdmin.full_name || 'Unknown'}</p>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                    <p className="text-xs text-gray-400 mb-1">Email Address</p>
                    <p className="text-sm font-semibold text-gray-900">{selectedAdmin.email || 'Unknown'}</p>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                    <p className="text-xs text-gray-400 mb-1">Mobile</p>
                    <p className="text-sm font-semibold text-gray-900">{selectedAdmin.phone_number || 'Unknown'}</p>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                    <p className="text-xs text-gray-400 mb-1">Designation</p>
                    <p className="text-sm font-semibold text-gray-900">Program Incharge</p>
                    <p className="text-xs text-gray-500 mt-0.5">{selectedAdmin.department || 'N/A'}</p>
                  </div>
                </div>
              )}

              {/* DYNAMIC STATUS BOX */}
              {renderStatusBox()}

              {modalType === 'reject' && (
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Reason for Rejection <span className="text-red-500">*</span></label>
                  <textarea
                    value={rejectReason}
                    onChange={(e) => { setRejectReason(e.target.value); if (updateError) setUpdateError(""); }}
                    placeholder="Explain why this Program Incharge application is being rejected..."
                    disabled={isUpdating}
                    className="w-full border border-gray-200 rounded-xl p-4 text-sm outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 min-h-[100px] resize-none disabled:bg-gray-50"
                  ></textarea>
                </div>
              )}

              {/* Show Rejection Reason if viewing a rejected user */}
              {modalType === 'details' && getAdminStatus(selectedAdmin) === 'rejected' && getAdminRejectionReason(selectedAdmin) && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl">
                  <p className="text-xs font-bold text-red-600 mb-1">Reason for Rejection Provided</p>
                  <p className="text-sm text-red-800">{getAdminRejectionReason(selectedAdmin)}</p>
                </div>
              )}

             {/* Email Preview */}
              <div className="border border-gray-200 rounded-xl overflow-hidden mt-2">
                <div className="bg-gray-50 px-4 py-2 border-b border-gray-200 flex items-center gap-2 text-xs font-medium text-gray-600">
                  <Mail className="w-4 h-4" />
                  Email Preview — {getPreviewMode() === 'approve' ? 'Approval' : 'Rejection'} Notification
                </div>
                <div className="p-4 text-sm text-gray-600 space-y-4 opacity-90">
                  <div className="grid grid-cols-[40px_1fr] gap-2 text-xs border-b border-gray-100 pb-3">
                    <span className="text-gray-400">To:</span>
                    <span className="font-medium text-gray-900">{selectedAdmin.email}</span>
                    <span className="text-gray-400">Subj:</span>
                    <span className="font-medium text-gray-900">DAVV VFM System — Program Incharge Registration Update</span>
                  </div>
                  <p>Dear {selectedAdmin.full_name},</p>
                  
                  {getPreviewMode() === 'approve' ? (
                    <>
                      <p>Your Program Incharge registration request for the DAVV Visiting Faculty Management System has been <strong>approved</strong>.</p>
                      <p>Your login credentials are as follows:</p>
                      
                      {/* UPDATED: Removed User ID, showing Email instead */}
                      <div className="bg-gray-50 p-4 rounded-xl font-mono text-xs text-gray-800 space-y-2 border border-gray-100">
                        <div>
                          <span className="text-gray-500 font-sans font-semibold w-16 inline-block">Email:</span> 
                          {selectedAdmin.email}
                        </div>
                        <div>
                          <span className="text-gray-500 font-sans font-semibold w-16 inline-block">Portal:</span> 
                          https://vfm.davv.ac.in
                        </div>
                      </div>

                      <p>Please login and set your password at the earliest. For assistance, contact the IT Cell.</p>
                    </>
                  ) : (
                    <>
                      <p>After review, your Program Incharge registration for the DAVV VFM System has not been approved at this time.</p>
                      {(rejectReason || getAdminRejectionReason(selectedAdmin)) && (
                        <div className="p-3 bg-red-50 border-l-4 border-red-500 text-red-700 my-2 italic">
                          "{rejectReason || getAdminRejectionReason(selectedAdmin)}"
                        </div>
                      )}
                      <p>You may re-apply after addressing the above. Contact the IT Cell for assistance.</p>
                    </>
                  )}
                  <p>Regards,<br/>IT Cell, DAVV</p>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-gray-100 bg-gray-50 flex items-center justify-end gap-3">
              <button 
                onClick={closeModal}
                disabled={isUpdating}
                className="px-5 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-200 rounded-full transition-colors disabled:opacity-50"
              >
                {modalType === 'details' ? 'Close' : 'Cancel'}
              </button>
              
              {modalType === 'approve' && (
                <>
                  <button 
                    onClick={() => setModalType('reject')}
                    disabled={isUpdating}
                    className="px-5 py-2.5 text-sm font-semibold text-red-500 border border-red-200 bg-white hover:bg-red-50 rounded-full transition-colors flex items-center gap-2 disabled:opacity-50"
                  >
                    <XCircle className="w-4 h-4" /> Reject Instead
                  </button>
                  <button 
                    onClick={() => handleStatusUpdate('approved')} 
                    disabled={isUpdating}
                    className="px-5 py-2.5 text-sm font-semibold text-white bg-[#10B981] hover:bg-[#059669] rounded-full transition-colors flex items-center gap-2 shadow-sm disabled:opacity-70"
                  >
                    {isUpdating ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                    Confirm Approval & Send Email
                  </button>
                </>
              )}

              {modalType === 'reject' && (
                <button 
                  onClick={() => handleStatusUpdate('rejected')}
                  disabled={isUpdating}
                  className="px-5 py-2.5 text-sm font-semibold text-white bg-red-500 hover:bg-red-600 rounded-full transition-colors flex items-center gap-2 shadow-sm disabled:opacity-70"
                >
                  {isUpdating ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                  Confirm Rejection & Notify
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}