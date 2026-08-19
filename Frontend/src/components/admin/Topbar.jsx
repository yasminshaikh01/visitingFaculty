import React, { useState, useEffect } from "react";
import { Bell, Menu } from "lucide-react";
import api from "../../api/axiosInstance"; // Adjust the ../ as needed based on folder depth

/**
 * Shared top bar for all admin pages.
 * title: page heading shown top-left (e.g. "Unified Visiting Faculty Management, IIPS, DAVV")
 * breadcrumb: array of strings, e.g. ["Program Incharge", "Faculty Management"]
 */
export default function Topbar({
  title = "Unified Visiting Faculty Management, IIPS, DAVV",
  breadcrumb = [],
  onMenuClick, // NEW: Prop to handle opening the mobile sidebar
}) {
  const [notifOpen, setNotifOpen] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  // Fetch pending faculty count on mount and listen for global refreshes
  useEffect(() => {
    const fetchPendingCount = async () => {
      try {
        const session = JSON.parse(localStorage.getItem('iipsCurrentSession') || '{}');
        // Note: Axios automatically applies headers if configured in axiosInstance, 
        // but we'll leave your manual config if you prefer it.
        const res = await api.get("/admin/pendingFaculty");
        
        // API returns { success: true, count: X, data: [...] }
        setPendingCount(res.data?.count || 0);
      } catch (error) {
        console.error("Failed to fetch pending faculty count", error);
        setPendingCount(0);
      }
    };

    fetchPendingCount(); // Initial fetch

    // NEW: Listen for the global refresh event to instantly update the notification bell
    window.addEventListener('refresh-dashboard', fetchPendingCount);
    
    // Cleanup listener on unmount
    return () => window.removeEventListener('refresh-dashboard', fetchPendingCount);
  }, []);

  return (
    <header className="sticky top-0 z-20 bg-white/90 backdrop-blur border-b border-slate-200 px-4 sm:px-6 py-3">
      <div className="flex items-center justify-between gap-4">
        
        <div className="flex items-center gap-3 min-w-0">
          {/* NEW: Mobile Hamburger Menu Button */}
          <button
            onClick={onMenuClick}
            className="md:hidden p-2 -ml-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors flex-shrink-0"
            aria-label="Open Menu"
          >
            <Menu size={20} />
          </button>

          <div className="min-w-0">
            {breadcrumb.length > 0 && (
              <nav className="text-xs text-slate-400 mb-1 flex items-center gap-1 truncate">
                {breadcrumb.map((crumb, idx) => (
                  <span key={crumb} className="flex items-center gap-1">
                    {idx > 0 && <span>/</span>}
                    <span className={idx === breadcrumb.length - 1 ? "text-slate-600 font-medium" : ""}>
                      {crumb}
                    </span>
                  </span>
                ))}
              </nav>
            )}
            <h1 className="text-[#004DD2] font-semibold text-sm sm:text-base md:text-lg truncate">{title}</h1>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="relative">
            <button
              onClick={() => setNotifOpen((v) => !v)}
              className="h-9 w-9 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-100 relative transition-colors"
              aria-label="Notifications"
            >
              <Bell size={18} />
              {/* Clean, simple red dot without the number - only show if there are pending items */}
              {pendingCount > 0 && (
                <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-red-500 border border-white" />
              )}
            </button>
            
            {notifOpen && (
              <div className="absolute right-0 mt-2 w-72 bg-white border border-slate-200 rounded-xl shadow-lg p-3 text-sm">
                <p className="font-semibold text-slate-700 mb-2 border-b border-slate-100 pb-2">Notifications</p>
                <div className="py-5 text-center">
                  <p className="text-slate-600">
                    You have <strong className="text-[#004DD2] text-base">{pendingCount}</strong> pending faculty approval{pendingCount !== 1 ? 's' : ''}.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}