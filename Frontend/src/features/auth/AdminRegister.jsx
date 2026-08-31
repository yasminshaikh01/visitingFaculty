import { useState } from 'react';
import api from "../../api/axiosInstance";
import AdminRegistrationSuccess from './AdminRegistrationSuccess';

export default function AdminRegister({ onNavigate }) {
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    mobile: '',
    password: '',
    confirmPassword: ''
  });
  
  const [formError, setFormError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const [isSuccess, setIsSuccess] = useState(false);
  const [isDuplicate, setIsDuplicate] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // NEW: Password requirements array linked to formData.password
  const passwordRequirements = [
    { label: 'At least 8 characters', met: formData.password.length >= 8 },
    { label: 'One special symbol (e.g., @, #, $)', met: /[!@#$%^&*(),.?":{}|<>]/.test(formData.password) },
    { label: 'At least one number', met: /\d/.test(formData.password) },
  ];

  const handleChange = (e) => {
    if (e.target.name === 'mobile') {
      const onlyNums = e.target.value.replace(/[^0-9]/g, '');
      setFormData({ ...formData, mobile: onlyNums });
    } else {
      setFormData({ ...formData, [e.target.name]: e.target.value });
    }
    setFormError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (formData.mobile.length !== 10) {
      setFormError('Mobile number must be exactly 10 digits.');
      return;
    }
    // NEW: Check that all password requirements are strictly met
    if (!passwordRequirements.every(r => r.met)) {
      setFormError('Please meet all password requirements.');
      return;
    }
    if (formData.password !== formData.confirmPassword) {
      setFormError('Passwords do not match. Please try again.');
      return;
    }

    setFormError('');
    setIsLoading(true);

    try {
      await api.post('/auth/register/admin', {
        full_name: formData.fullName.trim(),
        email: formData.email.trim().toLowerCase(),
        phone_number: formData.mobile.trim(),
        password: formData.password
      });

      setIsSuccess(true);
      
} catch (error) {
      const responseData = error.response?.data;
      // Safely grab the error message, checking error.message as well for the new backend logic
      const backendMessage = responseData?.message?.toLowerCase() || error.message?.toLowerCase() || '';
      const backendDetails = typeof responseData?.data === 'string' ? responseData.data.toLowerCase() : ''; 
      const fullError = backendMessage + ' ' + backendDetails;

      // 1. Specifically catch the Mobile Number duplicate first
      if (fullError.includes('mobile number already exist')) {
        setFormError('This Mobile Number is already registered. Please use a different number.');
      }
      // 2. Catch Email duplicates (and any generic 409 conflict errors)
      else if (
        error.response?.status === 409 || 
        fullError.includes('email already') ||
        fullError.includes('already') || 
        fullError.includes('exist')
      ) {
        setIsDuplicate(true); // Triggers the full-page Email duplicate UI
      } 
      // 3. Absolute fallback
      else {
        setFormError(responseData?.message || 'Registration failed. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (isDuplicate) {
    return (
      <div className="flex min-h-[calc(100vh-68px)] items-center justify-center bg-[#F8F9FB] px-4 py-12">
        <div className="w-full max-w-[520px] rounded-2xl bg-white p-8 text-center shadow-sm border border-[#C3C5D8]">
          
          {/* Orange Warning Icon */}
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-[#FFF4E5] text-[#F59E0B]">
            <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>

          <h2 className="mb-4 text-2xl font-bold text-[#141B2B]">Email Already Registered</h2>
          <p className="mb-6 text-sm leading-relaxed text-[#6B7280] px-2">
            An account with the email <strong>{formData.email}</strong> has already been submitted to our system. 
          </p>

          <button
            onClick={() => {
              setIsDuplicate(false);
              setIsSuccess(true); 
            }}
            className="mb-4 flex w-full items-center justify-center gap-2 rounded-lg bg-[#004DD2] py-3.5 font-medium text-white transition-colors hover:bg-[#003bb3]"
          >
            View Request Status
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
            </svg>
          </button>
          
          <button 
            onClick={() => setIsDuplicate(false)}
            className="text-sm font-medium text-[#6B7280] hover:text-[#141B2B] transition-colors"
          >
            Use a different email
          </button>

        </div>
      </div>
    );
  }

  if (isSuccess) {
    return <AdminRegistrationSuccess onNavigate={onNavigate} />;
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-68px)] bg-[#F8F9FB] px-4 py-12">
      
      {/* Top Icon & Welcome Text */}
      <div className="flex flex-col items-center mb-6">
        <div className="w-12 h-12 bg-[#004DD2] rounded-xl flex items-center justify-center shadow-md mb-4">
          <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-[#141B2B]">Welcome To IIPS</h1>
      </div>

      {/* Main Registration Card */}
      <div className="w-full max-w-[520px] bg-white border border-[#C3C5D8] rounded-2xl p-8 shadow-sm">
        
        {/* Program Incharge Portal Badge */}
        <div className="mx-auto w-fit bg-[#F1F3FF] border border-[#DBE1FF] text-[#004DD2] text-xs font-semibold px-4 py-1.5 rounded-full flex items-center gap-1.5 shadow-sm mb-5">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
          Program Incharge Portal
        </div>

        <div className="mb-8 text-center">
          <h2 className="text-[22px] font-bold text-[#141B2B] mb-1.5">Create Your Program Incharge Account</h2>
          <p className="text-sm text-[#6B7280]">Enter your professional details to access the university dashboard.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          
          {/* Validation Error Banner */}
          {formError && (
            <div className="bg-[#FEF2F2] border border-[#FCA5A5] text-[#EF4444] text-xs font-medium px-4 py-3 rounded-lg text-center mb-2">
              {formError}
            </div>
          )}

          {/* Full Name */}
          <div>
            <label className="block text-sm font-medium text-[#424656] mb-1.5">Full Name</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#9CA3AF]">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <input 
                type="text" 
                name="fullName"
                placeholder="Full Name" 
                value={formData.fullName}
                onChange={handleChange}
                className="w-full border border-[#C3C5D8] rounded-lg pl-10 pr-4 py-2.5 text-[#141B2B] placeholder-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#004DD2]/20 focus:border-[#004DD2] transition-colors"
                required
              />
            </div>
          </div>

          {/* Email Address */}
          <div>
            <label className="block text-sm font-medium text-[#424656] mb-1.5">Email Address</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#9CA3AF]">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <input 
                type="email" 
                name="email"
                placeholder="admin@davv.ac.in" 
                value={formData.email}
                onChange={handleChange}
                className="w-full border border-[#C3C5D8] rounded-lg pl-10 pr-4 py-2.5 text-[#141B2B] placeholder-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#004DD2]/20 focus:border-[#004DD2] transition-colors"
                required
              />
            </div>
          </div>

          {/* Mobile Number */}
          <div>
            <label className="block text-sm font-medium text-[#424656] mb-1.5">Mobile Number</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#9CA3AF]">
                 <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
              </div>
              <input 
                type="tel" 
                name="mobile"
                placeholder="9876543210" 
                value={formData.mobile}
                onChange={handleChange}
                maxLength={10}
                className="w-full border border-[#C3C5D8] rounded-lg pl-10 pr-4 py-2.5 text-[#141B2B] placeholder-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#004DD2]/20 focus:border-[#004DD2] transition-colors"
                required
              />
            </div>
          </div>

          {/* Password Row */}
          <div className="flex flex-col sm:flex-row gap-5">
            <div className="flex-1">
              <label className="block text-sm font-medium text-[#424656] mb-1.5">Password</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#9CA3AF]">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <input 
                  type={showPassword ? "text" : "password"} 
                  name="password"
                  placeholder="••••••••" 
                  value={formData.password}
                  onChange={handleChange}
                  className="w-full border border-[#C3C5D8] rounded-lg pl-10 pr-12 py-2.5 text-[#141B2B] placeholder-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#004DD2]/20 focus:border-[#004DD2] transition-colors"
                  required
                />
                <button 
                  type="button" 
                  onClick={() => setShowPassword(!showPassword)} 
                  className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-[#9CA3AF] hover:text-[#004DD2] transition-colors focus:outline-none"
                >
                  {showPassword ? (
                    <svg className="h-5 w-5 flex-none" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
                      <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
                      <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
                      <line x1="2" y1="2" x2="22" y2="22" />
                    </svg>
                  ) : (
                    <svg className="h-5 w-5 flex-none" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
            
            <div className="flex-1">
              <label className="block text-sm font-medium text-[#424656] mb-1.5">Confirm Password</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#9CA3AF]">
                   <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
                <input 
                  type={showConfirmPassword ? "text" : "password"} 
                  name="confirmPassword"
                  placeholder="••••••••" 
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  className="w-full border border-[#C3C5D8] rounded-lg pl-10 pr-12 py-2.5 text-[#141B2B] placeholder-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#004DD2]/20 focus:border-[#004DD2] transition-colors"
                  required
                />
                <button 
                  type="button" 
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)} 
                  className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-[#9CA3AF] hover:text-[#004DD2] transition-colors focus:outline-none"
                >
                  {showConfirmPassword ? (
                    <svg className="h-5 w-5 flex-none" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
                      <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
                      <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
                      <line x1="2" y1="2" x2="22" y2="22" />
                    </svg>
                  ) : (
                    <svg className="h-5 w-5 flex-none" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* NEW: Requirements Box placed below the password row */}
          <div className="rounded-xl bg-[#F7F6FF] p-4 text-sm text-[#585F6C] space-y-2 mt-4">
            <p className="font-bold text-[#141B2B] text-xs uppercase mb-2">Password Requirements</p>
            {passwordRequirements.map((req, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className={`h-4 w-4 flex-none rounded-full border-2 transition-colors ${req.met ? 'bg-[#004DD2] border-[#004DD2]' : 'border-[#C3C5D8]'}`} />
                <span className={req.met ? 'text-[#141B2B]' : 'text-[#585F6C]'}>{req.label}</span>
              </div>
            ))}
          </div>

          {/* Submit Button */}
          <button 
            type="submit" 
            disabled={isLoading}
            className="w-full bg-[#004DD2] text-white font-medium rounded-lg py-3 mt-4 hover:bg-[#003bb3] focus:outline-none focus:ring-4 focus:ring-[#004DD2]/30 transition-all flex justify-center items-center gap-2 disabled:opacity-70"
          >
            {isLoading ? 'Submitting...' : 'Submit Registration'}
            {!isLoading && (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            )}
          </button>
        </form>

        {/* Footer Link */}
        <div className="text-center mt-6">
          <p className="text-sm text-[#424656]">
            Already have a Program Incharge account?{' '}
            <button 
              onClick={() => onNavigate('login')}
              className="text-[#004DD2] font-semibold hover:underline focus:outline-none"
              type="button"
            >
              Sign In
            </button>
          </p>
        </div>

      </div>
    </div>
  );
}