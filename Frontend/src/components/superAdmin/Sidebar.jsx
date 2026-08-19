import React, { useState, useEffect } from "react";
import {
  ShieldCheck,
  ClipboardList,
  Users,
  Settings,
  LogOut,
  BookOpen,
  CalendarDays,
  X
} from "lucide-react";
import api from "../../api/axiosInstance";

export default function Sidebar({
  active,
  onNavigate,
  onSignOut,
  pendingCount = 3,
  isOpen,     // Prop for mobile drawer state
  setIsOpen   // Prop to close the drawer
}) {
  const navItems = [
    {
      key: "pending",
      label: "Pending Approvals",
      icon: ClipboardList,
      badge: pendingCount,
    },
    { key: "programincharges", label: "All Program Incharge", icon: Users },
    { key: "programs", label: "Programs", icon: BookOpen },
    { key: "monthly-summary", label: "Monthly Summary", icon: CalendarDays },
    { key: "settings", label: "Settings", icon: Settings },
  ];

  const [adminName, setAdminName] = useState("Super Admin");

  // UPDATED: Listen for global auto-refresh to update the admin name instantly if changed in Settings
  useEffect(() => {
    const fetchAdminData = () => {
      const session = JSON.parse(localStorage.getItem("iipsCurrentSession") || "{}");
      if (session.name || session.full_name) {
        setAdminName(session.name || session.full_name);
      }
    };

    fetchAdminData(); // Initial load

    // Listen to storage changes (cross-tab) and our custom global refresh event
    window.addEventListener("storage", fetchAdminData);
    window.addEventListener("refresh-dashboard", fetchAdminData);

    return () => {
      window.removeEventListener("storage", fetchAdminData);
      window.removeEventListener("refresh-dashboard", fetchAdminData);
    };
  }, []);

  const handleLogout = async () => {
    try {
      const session = JSON.parse(
        localStorage.getItem("iipsCurrentSession") || "{}"
      );
      if (session.token) {
        await api.post("/auth/logout", {});
      }
    } catch (err) {
      console.error(
        "Backend logout failed, proceeding with local sign out",
        err
      );
    } finally {
      if (onSignOut) onSignOut();
    }
  };

  return (
    <>
      {/* Mobile Backdrop Layer */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm lg:hidden" 
          onClick={() => setIsOpen(false)} 
        />
      )}

      {/* Dynamic classes for mobile sliding and desktop static */}
      <aside 
        className={`fixed inset-y-0 left-0 z-50 w-[280px] shrink-0 bg-white border-r border-gray-200 flex flex-col justify-between h-screen transition-transform duration-300 ease-in-out lg:static lg:translate-x-0 ${
          isOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full"
        }`}
      >
        <div>
          <div className="flex items-center justify-between px-6 py-6 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-purple-600 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-6 h-6 text-white" />
              </div>
              <div>
                <div className="text-purple-600 font-bold text-lg leading-tight">
                  IIPS DAVV
                </div>
                <div className="text-gray-400 text-sm leading-tight">
                  Super Admin
                </div>
              </div>
            </div>
            {/* Mobile Close Button */}
            <button 
              onClick={() => setIsOpen(false)}
              className="lg:hidden p-2 -mr-2 text-slate-400 hover:bg-slate-100 rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="px-4 pt-5">
            <p className="text-xs font-semibold tracking-wider text-gray-400 px-2 mb-3">
              SUPER ADMIN MENU
            </p>
            <nav className="flex flex-col gap-1">
              {navItems.map((item) => {
                const isActive = active === item.key;
                const Icon = item.icon;
                return (
                  <button
                    key={item.key}
                    onClick={() => {
                      onNavigate(item.key);
                      setIsOpen(false); // Automatically close sidebar on mobile
                      window.dispatchEvent(new Event('refresh-dashboard')); // Trigger global sync instantly
                    }}
                    className={`flex items-center justify-between px-3 py-2.5 rounded-full border text-[15px] font-medium transition-colors ${
                      isActive
                        ? "bg-purple-50 border-gray-900 text-purple-600"
                        : "bg-white border-transparent text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    <span className="flex items-center gap-3">
                      <Icon
                        className={`w-5 h-5 ${isActive ? "text-purple-600" : "text-gray-400"}`}
                      />
                      {item.label}
                    </span>

                    <div className="flex items-center gap-2">
                      {item.badge > 0 && (
                        <span className="bg-amber-400 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                          {item.badge}
                        </span>
                      )}
                      {isActive && (
                        <span className="w-2 h-2 rounded-full bg-purple-500" />
                      )}
                    </div>
                  </button>
                );
              })}
            </nav>
          </div>
        </div>

        <div className="px-4 pb-6 border-t border-gray-100 pt-5 bg-white">
          <div className="flex items-center gap-3 px-2 mb-4">
            <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5 text-purple-600" />
            </div>
            <div className="overflow-hidden">
              <div className="text-gray-900 font-semibold text-sm leading-tight truncate">
                {adminName}
              </div>
              <div className="text-gray-400 text-xs leading-tight truncate">
                System Administrator
              </div>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-2 text-red-500 font-semibold text-sm hover:text-red-600 w-full transition-colors"
          >
            <LogOut className="w-4 h-4" /> Sign Out
          </button>
        </div>
      </aside>
    </>
  );
}