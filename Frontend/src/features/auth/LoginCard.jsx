import { useState } from "react";
import { loginUser } from "../../api/authApi";

const DEMO_ADMIN_ACCOUNT = {
  role: "admin",
  userId: "ADMIN-2026-001",
  password: "Admin@123",
};

// Removed the `role` prop requirement so any user can log in here
const LoginCard = ({ onNavigate, initialEmail = "" }) => {
  // Changed state from userId to email to match backend requirements
  const [email, setEmail] = useState(() => initialEmail);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successRole, setSuccessRole] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSignIn = async (e) => {
    e.preventDefault();
    setErrorMessage("");
    setIsLoading(true);

    try {
      // 1. Updated Payload: Sending 'email' instead of 'user_id'
      const response = await loginUser({
        email: email.trim(),
        password: password,
      });

      const userData = response.data.data;

      // 2. Format the role for the UI popup (e.g. 'super_admin' -> 'Super Admin', 'admin' -> 'Program Incharge')
      const formattedRole = userData.role === 'admin'
        ? "Program Incharge"
        : userData.role
            .replace("_", " ")
            .replace(/\b\w/g, (l) => l.toUpperCase());
      setSuccessRole(formattedRole);

      // 3. CRITICAL: Save the token exactly where axiosInstance.js is looking for it!
      localStorage.setItem("token", userData.token);

      // Save the rest of the session data AND THE TOKEN for your UI routing
      // Note: We still save userId here if the backend returns it, as other pages might need it!
      localStorage.setItem(
        "iipsCurrentSession",
        JSON.stringify({
          role: userData.role,
          userId: userData.user_id,
          token: userData.token,
        }),
      );
    } catch (error) {
      console.error("Login error:", error);
      
      // Safely extract the error message from the backend response
      const backendMessage = error.response?.data?.message?.toLowerCase() || error.response?.data?.error?.toLowerCase() || error.message?.toLowerCase() || "";
      const backendData = typeof error.response?.data?.data === 'string' ? error.response.data.data.toLowerCase() : "";
      const fullErrorString = backendMessage + " " + backendData;

      // 1. Check for Pending Approval
      if (fullErrorString.includes("pending approval")) {
        setErrorMessage("Your account is currently not approved. Please wait for the confirmation mail.");
      } 
      // 2. Check for Deactivated Account (from your teammate's code)
      else if (fullErrorString.includes("deactivated")) {
        setErrorMessage("Your account has been deactivated. Please contact the Program Incharge for assistance.");
      } 
      // 3. Fallback to generic invalid credentials
      else {
        setErrorMessage("Invalid credentials. Please check your E-mail and password and try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* Success Pop-up */}
      {successRole && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#141B2B]/40 backdrop-blur-sm px-3 sm:px-4">
          <div className="animate-in fade-in zoom-in duration-200 w-full max-w-sm rounded-2xl border border-[#C3C5D8] bg-white p-6 text-center shadow-2xl sm:p-8">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-[#E1FDEB] text-[#10B981] shadow-sm">
              <svg
                className="h-8 w-8"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={3}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>

            <h3 className="mb-2 text-2xl font-bold text-[#141B2B]">
              Login Successful
            </h3>

            <p className="mb-8 text-sm leading-relaxed text-[#585F6C]">
              Welcome back! You have successfully authenticated to the IIPS
              portal as a{" "}
              <span className="font-bold text-[#004DD2]">{successRole}</span>.
            </p>

            <button
              onClick={() => {
                setSuccessRole(null);
                setEmail("");
                setPassword("");
                // Navigate to dashboard and pass the role so the router knows where to send them
                onNavigate("dashboard");
              }}
              className="w-full rounded-lg bg-[#004DD2] py-3 font-medium text-white shadow-md transition hover:bg-[#003bb3] focus:outline-none focus:ring-4 focus:ring-[#004DD2]/30"
            >
              Continue to Dashboard
            </button>
          </div>
        </div>
      )}

      {/* Main Login UI */}
      <div className="flex min-h-[calc(100vh-68px)] flex-col items-center justify-center bg-[#F8F9FB] px-3 py-8 sm:px-4 sm:py-12">
        <div className="mb-5 flex flex-col items-center sm:mb-6">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[#004DD2] shadow-md">
            <svg
              className="h-7 w-7 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 14l9-5-9-5-9 5 9 5z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-[#141B2B]">Welcome Back</h1>
        </div>

        <div className="w-full max-w-[420px] rounded-2xl border border-[#C3C5D8] bg-white p-5 shadow-sm sm:p-8">
          <div className="mb-5 sm:mb-6">
            <h2 className="mb-1 text-lg font-bold text-[#141B2B] sm:text-xl">
              Sign In to Your Account
            </h2>
            <p className="text-sm text-[#6B7280]">Please fill in the details</p>
          </div>

          <form onSubmit={handleSignIn} className="space-y-5">
            {errorMessage && (
              <div className="mb-2 rounded-xl border border-[#F7C4C4] bg-[#FFF1F1] px-4 py-3 text-center text-sm font-medium leading-relaxed text-[#EF4444]">
                {errorMessage}
              </div>
            )}

            <div>
              <label className="mb-1.5 block text-sm font-medium text-[#424656]">
                E-mail
              </label>
              <input
                type="email"
                placeholder="user@gmail.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setErrorMessage("");
                }}
                disabled={isLoading}
                className={`w-full rounded-lg border px-4 py-2.5 text-[#141B2B] placeholder-[#9CA3AF] transition-colors focus:outline-none focus:ring-2 ${
                  errorMessage
                    ? "border-[#EF4444] focus:border-[#EF4444] focus:ring-[#EF4444]/20"
                    : "border-[#C3C5D8] focus:border-[#004DD2] focus:ring-[#004DD2]/20"
                } ${isLoading ? "cursor-not-allowed bg-gray-50 opacity-50" : "bg-white"}`}
                required
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-[#424656]">
                Password
              </label>
              <div className="relative">
                {/* Left Side Lock Icon */}
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#9CA3AF]">
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                    />
                  </svg>
                </div>

                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setErrorMessage("");
                  }}
                  disabled={isLoading}
                  className={`w-full rounded-lg border pl-10 pr-12 py-2.5 text-[#141B2B] placeholder-[#9CA3AF] transition-colors focus:outline-none focus:ring-2 ${
                    errorMessage
                      ? "border-[#EF4444] focus:border-[#EF4444] focus:ring-[#EF4444]/20"
                      : "border-[#C3C5D8] focus:border-[#004DD2] focus:ring-[#004DD2]/20"
                  } ${isLoading ? "cursor-not-allowed bg-gray-50 opacity-50" : "bg-white"}`}
                  required
                />

                {/* Right Side Bulletproof Eye Toggle */}
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-[#9CA3AF] hover:text-[#004DD2] transition-colors focus:outline-none"
                >
                  {showPassword ? (
                    /* Hide Password (Eye with Slash) */
                    <svg
                      className="h-5 w-5 flex-none"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  ) : (
                    /* Show Password (Open Eye) */
                    <svg
                      className="h-5 w-5 flex-none"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
                      <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
                      <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
                      <line x1="2" y1="2" x2="22" y2="22" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className={`mt-2 flex w-full items-center justify-center rounded-lg py-3 font-medium text-white transition-all focus:outline-none focus:ring-4 focus:ring-[#004DD2]/30 ${
                isLoading
                  ? "cursor-not-allowed bg-[#004DD2]/70"
                  : "bg-[#004DD2] hover:bg-[#003bb3]"
              }`}
            >
              {isLoading ? (
                <>
                  <svg
                    className="-ml-1 mr-2 h-4 w-4 animate-spin text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Signing In...
                </>
              ) : (
                "Sign In"
              )}
            </button>
          </form>

          <div className="text-center mt-4 mb-6 sm:mt-5 sm:mb-8">
            <button
              type="button"
              onClick={() => onNavigate("forgot-password")}
              className="text-sm font-bold text-[#004DD2] hover:underline focus:outline-none"
            >
              Forget Password ?
            </button>
          </div>

          {/* Registration Section */}
          <div className="flex flex-col items-start gap-3 mt-6">
            <p className="ml-1 text-xs font-bold text-[#004DD2]">
              Don't Have an Account ?
            </p>
            <button
              type="button"
              onClick={() => onNavigate("role-selection")}
              className="w-full rounded-lg bg-[#004DD2] py-3 font-medium text-white transition-all hover:bg-[#003bb3] focus:outline-none focus:ring-4 focus:ring-[#004DD2]/30"
            >
              Register Now
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default LoginCard;
