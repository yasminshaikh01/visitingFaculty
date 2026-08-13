import { useState, useEffect } from 'react';
import Header from './components/Header';
import FirstPage1 from './pages/FirstPage1';
import LoginCard from './features/auth/LoginCard';
import RoleSelection from './features/auth/RoleSelection';
import AdminRegister from './features/auth/AdminRegister';
import FacultyRegister from './components/faculty/FacultyRegister';
import ForgotPassword from './features/auth/ForgotPassword';
import CheckEmail from './features/auth/CheckEmail';
import ResetPassword from './features/auth/ResetPassword';
import PasswordUpdated from './features/auth/PasswordUpdated';
import SuperAdminDashboard from './components/superAdmin/SuperAdminDashboard'; 
import AdminDashboard from './components/admin/AdminDashboard';
import FacultyDashboard from './components/faculty/FacultyDashboard';

function App() {
  // 1. BULLETPROOF ROUTER MEMORY
  const [view, setView] = useState(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const pathname = window.location.pathname;
    if (pathname.includes('reset-password') || urlParams.has('token')) {
      return 'reset-password';
    }

    const session = sessionStorage.getItem('iipsCurrentSession');
    if (session) return 'dashboard';

    const savedView = sessionStorage.getItem('iipsCurrentView');
    return savedView || 'landing';
  });

  const [authOptions, setAuthOptions] = useState({ userId: '', role: null });

  // 2. WATCHER
  useEffect(() => {
    sessionStorage.setItem('iipsCurrentView', view);
  }, [view]);

  const navigate = (nextView, options = {}) => {
    if (options.role) {
      setAuthOptions({
        userId: options.initialUserId || '',
        role: options.role
      });
    }
    setView(nextView);
  };

  const handleLoginSuccess = (user) => {
    navigate('dashboard');
  };

  // 3. MASTER LOGOUT HANDLER (Clean & DRY)
  const handleGlobalSignOut = () => {
    // sessionStorage.clear() is the safest way to guarantee the token, session, and tabs are wiped!
    sessionStorage.clear();
    
    // Reset React's memory to force the login screen
    navigate('login');
  };

  const renderContent = () => {
    switch (view) {
      case 'landing': return <FirstPage1 onProceed={() => navigate('login')} />;
      case 'login': return <LoginCard onNavigate={navigate} onSuccess={handleLoginSuccess} role={authOptions.role} initialEmail={authOptions.userId} />;
      case 'role-selection': return <RoleSelection onNavigate={navigate} />;
      case 'admin-register': return <AdminRegister onNavigate={navigate} />;
      case 'faculty-register': return <FacultyRegister onNavigate={navigate} />;
      case 'forgot-password': return <ForgotPassword onNavigate={navigate} />;  
      case 'reset-code': return <CheckEmail onNavigate={navigate} />;
      case 'reset-password': return <ResetPassword onNavigate={navigate} />;
      case 'password-updated': return <PasswordUpdated onNavigate={navigate} />;
      
      case 'dashboard': {
        const session = JSON.parse(sessionStorage.getItem('iipsCurrentSession') || '{}');
        
        if (session.role === 'super_admin' || session.role === 'superadmin') {
          return <SuperAdminDashboard onSignOut={handleGlobalSignOut} />;
        }
        
        if (session.role === 'admin') {
          return <AdminDashboard onSignOut={handleGlobalSignOut} />;
        }
        
        if (session.role === 'faculty') {
          return <FacultyDashboard onSignOut={handleGlobalSignOut} />;
        }
        
        return <LoginCard onNavigate={navigate} />;
      }
        
      default: return <FirstPage1 onProceed={() => navigate('login')} />;
    }
  };

  const isDashboard = view.includes('dashboard');

  return (
    <div className="min-h-screen bg-[#F8F9FB] flex flex-col font-sans">
      {!isDashboard && <Header onNavigate={navigate} />}
      
      <main className={isDashboard ? "" : "flex-grow"}>
        {renderContent()}
      </main>
    </div>
  );
}

export default App;