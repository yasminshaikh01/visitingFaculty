import React, { useState, useEffect } from "react";
import Topbar from "./Topbar";
import { Users, UserCheck, ClipboardList, Download, ChevronLeft, ChevronRight, Loader2, Eye, CheckCircle, X, AlertCircle } from "lucide-react";
import api from "../../api/axiosInstance"; // Adjust the ../ as needed based on folder depth

// UPDATED: Added onMenuClick prop
export default function AllAdminsPage({ onNavigate, onMenuClick }) {
  const [admins, setAdmins] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const recordsPerPage = 5;

  // Modal & Action states
  const [selectedAdmin, setSelectedAdmin] = useState(null);
  const [isTogglingStatus, setIsTogglingStatus] = useState(false);

  useEffect(() => {
    fetchAllAdmins();
  }, []);

  // NEW: Listen for global refresh events to auto-update data from other tabs
  useEffect(() => {
    const handleRefresh = () => fetchAllAdmins();
    window.addEventListener('refresh-dashboard', handleRefresh);
    return () => window.removeEventListener('refresh-dashboard', handleRefresh);
  }, []);

  const fetchAllAdmins = async () => {
    try {
      const session = JSON.parse(localStorage.getItem('iipsCurrentSession') || '{}');
      const response = await api.get("/super_admin/approvedAdmin");
      setAdmins(response.data.data || []);
    } catch (err) {
      console.error("Error fetching all admins:", err);
    } finally {
      setIsLoading(false);
    }
  };

  // --- TOGGLE ACTIVE/INACTIVE STATUS ---
  const handleToggleStatus = async () => {
    if (!selectedAdmin) return;
    setIsTogglingStatus(true);
    
    try {
      const session = JSON.parse(localStorage.getItem('iipsCurrentSession') || '{}');
      // Default to true if is_active is undefined in your DB schema
      const currentlyActive = selectedAdmin.is_active !== false; 
      const action = currentlyActive ? 'deactivate' : 'activate';
      const targetId = selectedAdmin.user_id;

      await api.put(`/account-status/super_admin/admin/${targetId}/${action}`, {});

      // Instantly update the local state so the UI reflects the change without a full reload
      const updatedAdmin = { ...selectedAdmin, is_active: !currentlyActive };
      setSelectedAdmin(updatedAdmin);
      setAdmins(admins.map(a => a.user_id === targetId ? updatedAdmin : a));

      // NEW: Dispatch event so sidebar/topbar and other tabs sync instantly
      window.dispatchEvent(new Event('refresh-dashboard'));

    } catch (err) {
      console.error(`Error trying to ${selectedAdmin.is_active !== false ? 'deactivate' : 'activate'} admin:`, err);
      alert("Failed to update admin account status.");
    } finally {
      setIsTogglingStatus(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    return isNaN(date.getTime()) ? dateString : date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  // Filter admins based on the search term
  const filteredAdmins = admins.filter(admin => {
    if (!searchTerm) return true;
    const adminName = admin.full_name || "";
    const adminEmail = admin.email || "";
    return adminName.toLowerCase().includes(searchTerm.toLowerCase()) || 
           adminEmail.toLowerCase().includes(searchTerm.toLowerCase());
  });

  // Pagination Logic
  const indexOfLastRecord = currentPage * recordsPerPage;
  const indexOfFirstRecord = indexOfLastRecord - recordsPerPage;
  const currentRecords = filteredAdmins.slice(indexOfFirstRecord, indexOfLastRecord);
  const totalPages = Math.ceil(filteredAdmins.length / recordsPerPage);

  // Modal Handlers
  const openModal = (admin) => {
    setSelectedAdmin(admin);
  };

  const closeModal = () => {
    setSelectedAdmin(null);
  };

  // --- CSV Export Logic ---
  const exportToCSV = () => {
    const headers = ["Name", "Email", "Department", "Approved On", "Role", "Status"];
    
    // NEW: Compact date format just for CSV to prevent Excel ######## column width issue
    const formatDateForCSV = (dateString) => {
      if (!dateString) return "N/A";
      const date = new Date(dateString);
      return isNaN(date.getTime()) ? dateString : date.toLocaleDateString('en-GB'); // Outputs DD/MM/YYYY
    };

    const csvContent = [
      headers.join(","),
      ...filteredAdmins.map(a => [
        a.full_name, 
        a.email, 
        a.department || "N/A", 
        formatDateForCSV(a.updated_at || a.created_at), 
        "Program Incharge",
        a.is_active !== false ? "Active" : "Inactive"
      ].join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `approved_admins_list_${new Date().toLocaleDateString('en-GB').replace(/\//g, '-')}.csv`;
    a.click();
  };

  // Calculate Stats Dynamically based on TOTAL fetched admins
  const totalAdmins = admins.length;
  const activeAdmins = admins.filter(a => a.is_active !== false).length;
  const pendingAdmins = 0; // Since this endpoint only fetches approved, this is 0 visually.

  return (
    <div className="flex-1 bg-gray-50 min-h-screen relative overflow-hidden">
      {/* UPDATED: Passed onMenuClick to Topbar */}
      <Topbar 
        title="All Program Incharge Accounts" 
        subtitle="Active and approved VFM System administrators"
        showSearch={true}
        onPendingClick={() => onNavigate("pending")} 
        onSearch={(value) => {
          setSearchTerm(value);
          setCurrentPage(1); // Reset to page 1 on search
        }} 
        onMenuClick={onMenuClick}
      />
      
      {/* UPDATED: Adjusted px padding to match mobile */}
      <div className="px-4 sm:px-8 py-8 pb-24 max-w-full">
        {/* UPDATED: Flex-col on mobile, full width button */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-1">All Program Incharge</h1>
            <p className="text-sm sm:text-base text-gray-400">Active and approved VFM System administrators</p>
          </div>
          <button 
            onClick={exportToCSV}
            className="w-full sm:w-auto flex items-center justify-center gap-2 border border-gray-200 rounded-full px-5 py-2.5 text-sm font-semibold text-gray-700 bg-white hover:bg-gray-50 transition-colors shadow-sm"
          >
            <Download className="w-4 h-4" /> Export
          </button>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-6">
          <StatCard label="Total Program Incharge" value={totalAdmins} icon={Users} bg="bg-blue-50" color="text-blue-500" />
          <StatCard label="Active Accounts" value={activeAdmins} icon={UserCheck} bg="bg-green-50" color="text-green-500" />
          <StatCard label="Pending Review" value={pendingAdmins} icon={ClipboardList} bg="bg-amber-50" color="text-amber-500" />
        </div>

        {/* Table card */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-6">
          <div className="overflow-x-auto min-h-[400px]">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-20 text-gray-500">
                <Loader2 className="animate-spin w-8 h-8 text-[#004DD2] mb-3" />
                Loading records...
              </div>
            ) : (
              <table className="w-full text-left">
                <thead>
                  <tr className="text-xs font-semibold text-gray-400 border-b border-gray-100 uppercase tracking-wider">
                    <th className="py-3 pr-4">Program Incharge NAME</th>
                    <th className="py-3 pr-4">APPROVED ON</th>
                    <th className="py-3 pr-4">ROLE</th>
                    <th className="py-3 pr-4">STATUS</th>
                    <th className="py-3 pr-4">ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {currentRecords.length > 0 ? (
                    currentRecords.map((a) => {
                      const isActive = a.is_active !== false;
                      return (
                        <tr key={a.user_id || a.email} className="border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors align-middle">
                          <td className="py-4 pr-4 min-w-[200px]">
                            <div className="flex items-center gap-3">
                              <div className={`w-9 h-9 rounded-full flex items-center justify-center font-semibold text-sm uppercase shrink-0 ${isActive ? 'bg-purple-100 text-purple-600' : 'bg-gray-200 text-gray-500'}`}>
                                {a.full_name ? a.full_name[0] : 'A'}
                              </div>
                              <div>
                                <div className={`font-semibold text-sm ${isActive ? 'text-gray-900' : 'text-gray-500 line-through decoration-gray-300'}`}>
                                  {a.full_name || "Unknown"}
                                </div>
                                <div className="text-gray-400 text-xs">{a.email || "No email provided"}</div>
                              </div>
                            </div>
                          </td>
                          <td className="py-4 pr-4 text-gray-700 text-sm font-medium">
                            {formatDate(a.updated_at || a.created_at)}
                          </td>
                          <td className="py-4 pr-4">
                            <span className="text-xs font-semibold px-3 py-1.5 rounded-full bg-blue-50 text-blue-600 border border-blue-200 inline-block">
                              Program Incharge
                            </span>
                          </td>
                          <td className="py-4 pr-4">
                            <span className={`text-xs font-semibold px-3 py-1.5 rounded-full border inline-block ${
                              isActive ? 'bg-green-50 text-green-600 border-green-200' : 'bg-slate-100 text-slate-500 border-slate-200'
                            }`}>
                              {isActive ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td className="py-4 pr-4">
                            <button 
                              onClick={() => openModal(a)}
                              className="flex items-center gap-1.5 text-gray-500 text-sm font-medium hover:text-gray-900 transition-colors bg-white border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50 shadow-sm"
                            >
                              <Eye className="w-4 h-4" /> Details
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan="5" className="py-16 text-center text-gray-500 text-sm">
                        No Program Incharges found matching "{searchTerm}".
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
          
          {/* UPDATED: Mobile responsive flex layout for Pagination */}
          {!isLoading && filteredAdmins.length > 0 && (
            <div className="mt-6 border-t border-gray-100 pt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="text-sm text-gray-400 text-center sm:text-left">
                Showing {indexOfFirstRecord + 1} to {Math.min(indexOfLastRecord, filteredAdmins.length)} of {filteredAdmins.length} records
              </div>
              <div className="flex items-center justify-center gap-2">
                <button onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} disabled={currentPage === 1} className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <div className="flex gap-1 overflow-x-auto hide-scrollbar max-w-[150px] sm:max-w-none">
                  {[...Array(totalPages)].map((_, i) => (
                    <button key={i} onClick={() => setCurrentPage(i + 1)} className={`shrink-0 w-7 h-7 rounded-full text-xs font-bold transition-colors ${ currentPage === i + 1 ? "bg-[#004DD2] text-white" : "text-gray-500 hover:bg-gray-100" }`}>
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

      {/* --- DETAILS MODAL --- */}
      {selectedAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
            
            {/* UPDATED: Adjusted modal padding */}
            <div className="flex items-start justify-between p-4 sm:p-6 border-b border-gray-100">
              <div>
                <h2 className="text-lg sm:text-xl font-bold text-gray-900">Program Incharge Application Details</h2>
                <p className="text-xs sm:text-sm text-gray-500 mt-1">Submitted: {formatDate(selectedAdmin.created_at || selectedAdmin.submitted_date)}</p>
              </div>
              <button onClick={closeModal} className="p-2 text-gray-400 hover:bg-gray-100 rounded-full transition-colors shrink-0">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 sm:p-6 overflow-y-auto flex-1">
              {/* UPDATED: grid-cols-1 on small screens, grid-cols-2 on sm */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                  <p className="text-xs text-gray-400 mb-1">Full Name</p>
                  <p className="text-sm font-semibold text-gray-900">{selectedAdmin.full_name || 'Unknown'}</p>
                </div>
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 overflow-hidden">
                  <p className="text-xs text-gray-400 mb-1">Email Address</p>
                  <p className="text-sm font-semibold text-gray-900 truncate">{selectedAdmin.email || 'Unknown'}</p>
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

              {/* DYNAMIC STATUS BOX based on Active/Inactive */}
              {selectedAdmin.is_active !== false ? (
                <div className="mb-6 border-2 border-green-200 bg-green-50/30 rounded-xl p-4 flex items-center gap-4 shadow-sm">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 bg-green-100 text-green-600">
                    <CheckCircle className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest mb-0.5 text-green-600">
                      Active Program Incharge
                    </p>
                    <p className="text-sm font-bold text-[#1F2937]">
                      {selectedAdmin.full_name || 'Program Incharge Candidate'}
                    </p>
                    <p className="text-[10px] mt-0.5 font-medium text-green-600">
                      This PI account is active and has full portal access.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="mb-6 border-2 border-slate-200 bg-slate-50/50 rounded-xl p-4 flex items-center gap-4 shadow-sm">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 bg-slate-200 text-slate-500">
                    <AlertCircle className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest mb-0.5 text-slate-500">
                      Inactive Program Incharge
                    </p>
                    <p className="text-sm font-bold text-[#1F2937]">
                      {selectedAdmin.full_name || 'Program Incharge Candidate'}
                    </p>
                    <p className="text-[10px] mt-0.5 font-medium text-slate-500">
                      This PI account is deactivated. Portal access is currently restricted.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* UPDATED: Flex wrapping and widths for buttons on mobile */}
            <div className="p-4 sm:p-6 border-t border-gray-100 bg-gray-50 flex flex-col sm:flex-row items-center justify-between gap-3">
              <button 
                onClick={handleToggleStatus}
                disabled={isTogglingStatus}
                className={`w-full sm:w-auto px-5 py-2.5 text-sm font-semibold rounded-full transition-colors flex items-center justify-center gap-2 border bg-white shadow-sm disabled:opacity-50 ${
                  selectedAdmin.is_active !== false 
                    ? 'border-red-200 text-red-600 hover:bg-red-50' 
                    : 'border-green-200 text-green-600 hover:bg-green-50'
                }`}
              >
                {isTogglingStatus && <Loader2 className="w-4 h-4 animate-spin" />}
                {!isTogglingStatus && (selectedAdmin.is_active !== false ? <AlertCircle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />)}
                {selectedAdmin.is_active !== false ? "Deactivate Account" : "Activate Account"}
              </button>

              <button 
                onClick={closeModal}
                className="w-full sm:w-auto px-5 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-200 rounded-full transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Helper Component for Stats
function StatCard({ label, value, icon: Icon, bg, color }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-6 flex items-center gap-4 w-full">
      <div className={`w-12 h-12 rounded-xl ${bg} flex items-center justify-center shrink-0`}>
        <Icon className={`w-6 h-6 ${color}`} />
      </div>
      <div className="min-w-0">
        <p className="text-gray-400 text-xs sm:text-sm truncate">{label}</p>
        <p className="text-xl sm:text-2xl font-bold text-gray-900 truncate">{value}</p>
      </div>
    </div>
  );
}