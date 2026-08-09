import React, { useState, useEffect } from "react";
import api from "../../api/axiosInstance";
import Sidebar from "./Sidebar"; 
import PendingApprovalsPage from "./PendingApprovals"; 
import AllAdminsPage from './AllAdminsPage'; 
import SettingsPage from "./Settings"; 
import ProgramsPage from "./ProgramPage";
import MonthlySummary from "./MonthlySummary";

export default function SuperAdminDashboard({ onSignOut }) {
  // 1. Bulletproof State Initialization
  const [activeTab, setActiveTab] = useState(() => {
    const savedTab = localStorage.getItem("superAdminActiveTab");
    console.log("On refresh, found saved main tab:", savedTab); // For debugging
    return savedTab || "pending"; 
  });
  const [pendingCount, setPendingCount] = useState(0);

  // NEW: State to control mobile sidebar drawer
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // 2. Save to localStorage whenever the tab changes
  useEffect(() => {
    localStorage.setItem("superAdminActiveTab", activeTab);
  }, [activeTab]);

  // 3. UPDATED: Fetch pending count and listen for global refreshes
  useEffect(() => {
    const fetchPendingCount = async () => {
      try {
        // CLEANED: Manual headers removed!
        const response = await api.get("/super_admin/pendingAdmin");
        setPendingCount(response.data.data.length);
      } catch (err) {
        console.error("Error fetching pending count", err);
      }
    };

    fetchPendingCount(); // Initial fetch on mount or tab change

    // Listen for global refresh events triggered by other components
    window.addEventListener('refresh-dashboard', fetchPendingCount);

    // Cleanup the listener when the component unmounts or before it re-runs
    return () => window.removeEventListener('refresh-dashboard', fetchPendingCount);
  }, [activeTab]);

  const handleSignOut = async () => {
    try {
      // CLEANED: Manual headers removed for your future logout logic!
      /*
      await api.post("/auth/logout", {});
      */

      // Clear all local storage on sign out
      localStorage.removeItem('iipsCurrentSession');
      localStorage.removeItem('superAdminActiveTab'); 
      
      if (onSignOut) onSignOut();
      
    } catch (err) {
      console.error("Error signing out", err);
      localStorage.removeItem('iipsCurrentSession');
      localStorage.removeItem('superAdminActiveTab'); 
      if (onSignOut) onSignOut();
    }
  };

  const renderMainContent = () => {
    switch (activeTab) {
      case "pending":
        return <PendingApprovalsPage onNavigate={setActiveTab} onMenuClick={() => setIsSidebarOpen(true)} />;
        
      case "programincharges":
        return <AllAdminsPage onNavigate={setActiveTab} onMenuClick={() => setIsSidebarOpen(true)} />;
        
      case "programs":
        return <ProgramsPage onNavigate={setActiveTab} onMenuClick={() => setIsSidebarOpen(true)} />;
      case "monthly-summary":
        return <MonthlySummary onMenuClick={() => setIsSidebarOpen(true)} />;
      case "settings":
        return <SettingsPage onNavigate={setActiveTab} onMenuClick={() => setIsSidebarOpen(true)} />;
      default:
        return <PendingApprovalsPage onNavigate={setActiveTab} onMenuClick={() => setIsSidebarOpen(true)} />;
    }
  };

  return (
    // Added 'relative' to the parent wrapper
    <div className="flex w-full h-screen overflow-hidden bg-gray-50 relative">
      <Sidebar 
        active={activeTab} 
        onNavigate={setActiveTab} 
        onSignOut={handleSignOut} 
        pendingCount={pendingCount}
        isOpen={isSidebarOpen}         // Pass state down
        setIsOpen={setIsSidebarOpen}   // Pass setter down
      />

      {/* Added 'w-full' to ensure main content takes full width on mobile */}
      <main className="flex-1 h-screen overflow-y-auto w-full">
        {renderMainContent()}
      </main>
    </div>
  );
}