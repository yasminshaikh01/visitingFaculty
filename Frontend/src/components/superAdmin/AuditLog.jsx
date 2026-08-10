import React, { useState, useEffect } from "react";
import { Download, Printer } from "lucide-react";
import axios from "axios";

// Notice we added { searchQuery } here as a prop!
export default function AuditLog({ searchQuery = "" }) {
  const [logs, setLogs] = useState([]);
  const [filter, setFilter] = useState("Select...");

  useEffect(() => {
    // Replace with your actual Audit Log endpoint
    // const fetchLogs = async () => { ... }
    // fetchLogs(); 
  }, []);

  // 1. Define the status checker
  const getLogStatus = (log) => {
    if (log.AdminApproval?.status) {
      return log.AdminApproval.status.charAt(0).toUpperCase() + log.AdminApproval.status.slice(1);
    }
    return log.is_approved ? "Approved" : "Rejected";
  };

  // 2. Define the filtered logs logic so the component doesn't crash
  const filteredLogs = logs.filter((log) => {
    const status = getLogStatus(log);
    
    // Check dropdown filter
    const matchesDropdown = filter === "Select..." || status === filter;
    
    // Check search query
    const lowerQuery = (searchQuery || "").toLowerCase();
    const matchesSearch = !searchQuery || (
      (log.full_name && log.full_name.toLowerCase().includes(lowerQuery)) ||
      (status.toLowerCase().includes(lowerQuery))
    );

    return matchesDropdown && matchesSearch;
  });

  const handlePrint = () => window.print();

  const exportToCSV = () => {
    // 1. Removed User ID and Remarks
    const headers = ["Sr.", "Action", "Program Incharge Name", "Performed By", "Date"];
    
    const csvContent = "data:text/csv;charset=utf-8," + 
      headers.join(",") + "\n" +
      filteredLogs.map((l, i) => {
        // Format the date nicely
        const dateStr = l.updated_at 
          ? new Date(l.updated_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) 
          : "-";
          
        // 2. Wrap the date in ="..." to force Excel to treat it as text, preventing the ### width issue
        const safeDateForExcel = `="${dateStr}"`;

        return [
          i + 1, 
          getLogStatus(l), 
          l.full_name || "Unknown", 
          "Super Admin",
          safeDateForExcel
        ].join(",");
      }).join("\n");
      
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "audit_log.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div id="audit-log-print" className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-8">
      {/* 3. Print CSS to enforce consistent, mobile-preferred view */}
      <style>{`
        @media print {
          @page { margin: 0.5cm; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          
          /* Hide everything outside this component and hide interactive buttons */
          body * { visibility: hidden; }
          #audit-log-print, #audit-log-print * { visibility: visible; }
          .no-print { display: none !important; }
          
          /* Force standard, full-width mobile view layout for print */
          #audit-log-print {
            position: absolute;
            left: 0;
            top: 0;
            width: 100% !important;
            margin: 0 !important;
            padding: 10px !important;
            border: none !important;
            box-shadow: none !important;
          }

          /* Ensure table cells don't get cut off horizontally */
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

      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4 no-print">
        <h3 className="font-bold text-gray-900">Audit Log</h3>
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          <select 
            value={filter} 
            onChange={(e) => setFilter(e.target.value)}
            className="flex-1 sm:flex-none border border-gray-200 rounded-full px-4 py-2 text-sm text-gray-600 outline-none focus:border-[#004DD2]"
          >
            <option>Select...</option>
            <option>Approved</option>
            <option>Rejected</option>
          </select>
          <button onClick={exportToCSV} className="flex-1 sm:flex-none justify-center flex items-center gap-2 border border-gray-200 rounded-full px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors">
            <Download className="w-4 h-4 shrink-0" /> Export CSV
          </button>
          <button onClick={handlePrint} className="flex-1 sm:flex-none justify-center flex items-center gap-2 border border-gray-200 rounded-full px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors">
            <Printer className="w-4 h-4 shrink-0" /> Print
          </button>
        </div>
      </div>

      <div className="overflow-x-auto print-table-wrapper hide-scrollbar">
        <table className="w-full text-left min-w-[500px]">
          <thead>
            <tr className="text-xs font-semibold text-gray-400 border-b border-gray-100 uppercase">
              <th className="py-3 whitespace-nowrap pr-4">Sr.</th>
              <th className="py-3 whitespace-nowrap pr-4">Action</th>
              <th className="py-3 whitespace-nowrap pr-4">Program Incharge Name</th>
              <th className="py-3 whitespace-nowrap pr-4">Performed By</th>
              <th className="py-3 whitespace-nowrap">Date</th>
            </tr>
          </thead>
          <tbody className="text-sm">
            {filteredLogs.length === 0 ? (
              <tr>
                <td colSpan="5" className="py-16 text-center text-gray-500 text-sm">
                  {searchQuery ? (
                    <>No Program Incharges found matching "{searchQuery}".</>
                  ) : (
                    "No audit logs found in the system."
                  )}
                </td>
              </tr>
            ) : (
              filteredLogs.map((log, i) => {
                const status = getLogStatus(log);
                return (
                  <tr key={log.user_id || i} className="border-b border-gray-50">
                    <td className="py-4 text-gray-500 whitespace-nowrap pr-4">{i + 1}</td>
                    <td className="py-4 whitespace-nowrap pr-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold inline-block ${
                        status === 'Approved' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'
                      }`}>
                        {status}
                      </span>
                    </td>
                    <td className="py-4 font-medium text-gray-900 whitespace-nowrap pr-4">{log.full_name || "Unknown"}</td>
                    <td className="py-4 text-gray-600 whitespace-nowrap pr-4">Super Admin</td>
                    <td className="py-4 text-gray-600 whitespace-nowrap">
                      {log.updated_at ? new Date(log.updated_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : "-"}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}