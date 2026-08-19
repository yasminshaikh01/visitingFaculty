import React, { useState, useEffect, useRef } from "react";
import { Phone, Mail, ChevronDown } from "lucide-react"; 

const Header = ({ onNavigate }) => {
  const [showContact, setShowContact] = useState(false);
  const dropdownRef = useRef(null);

  // Close the dropdown if the user clicks outside of it
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowContact(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

return (
    <header className="w-full bg-white border-b border-[#C3C5D8] px-4 py-3 shadow-sm sm:px-8 md:px-12 md:py-0 md:h-[68px] flex items-center justify-between z-50">
      
      {/* Left side: Institute Title (Clickable) */}
      <div 
        className="flex items-center flex-1 overflow-hidden pr-2 md:pr-4 cursor-pointer group"
        onClick={() => onNavigate('landing')}
      >
        {/* Full title for Desktop */}
        <h1 className="hidden sm:block text-[#004DD2] font-bold text-base tracking-wide truncate group-hover:underline">
          Unified Visiting Faculty Management, IIPS, DAVV
        </h1>
        
        {/* Short title for Mobile */}
        <h1 className="block sm:hidden text-[#004DD2] font-bold text-sm tracking-wide truncate group-hover:underline">
          UVFM, IIPS, DAVV
        </h1>
      </div>

      {/* Right side: Navigation/Actions */}
      <nav className="flex items-center shrink-0 relative" ref={dropdownRef}>
        <button 
          type="button"
          onClick={() => setShowContact(!showContact)}
          className="flex items-center gap-1 text-sm font-medium text-[#004DD2] hover:underline transition-colors focus:outline-none"
        >
          Contact
          <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${showContact ? 'rotate-180' : ''}`} />
        </button>

        {/* Contact Dropdown */}
        {showContact && (
          <div className="absolute top-full right-0 mt-2 w-56 bg-white rounded-xl shadow-lg border border-gray-100 p-2 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
            
            <a 
              href="tel:917312461888" 
              className="flex items-center gap-3 p-3 hover:bg-slate-50 rounded-lg transition-colors group"
            >
              <div className="bg-blue-50 p-2 rounded-full text-[#004DD2] group-hover:bg-[#004DD2] group-hover:text-white transition-colors">
                <Phone className="w-4 h-4" />
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Phone</span>
                <span className="text-sm font-semibold text-slate-700">91-731-2461888</span>
              </div>
            </a>
            
            <a 
              href="mailto:admin@iips.edu.in" 
              className="flex items-center gap-3 p-3 hover:bg-slate-50 rounded-lg transition-colors group"
            >
              <div className="bg-blue-50 p-2 rounded-full text-[#004DD2] group-hover:bg-[#004DD2] group-hover:text-white transition-colors">
                <Mail className="w-4 h-4" />
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Email</span>
                <span className="text-sm font-semibold text-slate-700">admin@iips.edu.in</span>
              </div>
            </a>

          </div>
        )}
      </nav>

    </header>
  );
};

export default Header;