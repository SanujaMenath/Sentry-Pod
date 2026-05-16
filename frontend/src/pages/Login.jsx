import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import logo from '../images/logo.png'; 
import { Eye, EyeOff, ShieldCheck, Loader2 } from 'lucide-react';
import { login, register } from '../services/authService';

const Login = () => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [successMessage, setSuccessMessage] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // ✅ QA Fix 1: Added fullName and email to the state tracker
  const [credentials, setCredentials] = useState({
    fullName: '',
    email: '',
    username: '',
    password: '',
    confirmPassword: ''
  });

  const navigate = useNavigate();

  const pageStyle = {
    background: 'linear-gradient(135deg, #020618 0%, #1D293D 45%, #475569 100%)',
    backgroundAttachment: 'fixed'
  };

  const handleChange = (e) => {
    setCredentials({ ...credentials, [e.target.name]: e.target.value });
  };

  const handleSignIn = async (e) => {
    e.preventDefault(); 
    setIsLoading(true);
    setError(null);

    if (isSignUp && credentials.password !== credentials.confirmPassword) {
      setError("Passwords do not match.");
      setIsLoading(false);
      return;
    }

    try {
      if (isSignUp) {
        // ✅ QA Fix 2: Passing all 4 required arguments to the updated register service
        await register(
          credentials.fullName, 
          credentials.email, 
          credentials.username, 
          credentials.password
        );
        setSuccessMessage("Account created successfully! Please wait for Admin approval.");
        setIsSignUp(false); 
        setCredentials({ fullName: '', email: '', username: '', password: '', confirmPassword: '' });
      } else {
        await login(credentials.username, credentials.password);
        navigate('/dashboard'); 
      }
    } catch (err) {
      setError(err?.response?.data?.detail || err?.message || "Authentication failed.");
    } finally {
      setIsLoading(false);
    }
  };
    
  const toggleMode = () => {
    setIsSignUp(!isSignUp);
    setError(null);
    setSuccessMessage(null);
    // ✅ QA Fix 3: Resetting all form elements upon switching modes
    setCredentials({ fullName: '', email: '', username: '', password: '', confirmPassword: '' });
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6" style={pageStyle}>
      
      {/* LOGO & HEADER */}
      <div className="mb-8 text-center">
        <img src={logo} alt="SentryPod AI" className="h-24 w-auto object-contain mx-auto mb-4" />
        <p className="text-slate-400 font-medium tracking-wide">Enterprise Network AI Dashboard</p>
      </div>

      {/* LOGIN CARD */}
      <div className="w-full max-w-md bg-[#111827]/80 backdrop-blur-xl p-8 rounded-2xl border border-slate-800 shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
       
        <h2 className="text-xl font-bold text-white mb-6 text-center">
          {isSignUp ? "Create Your Account" : "Sign In to SentryPod"}
        </h2> 

        <form className="space-y-6" onSubmit={handleSignIn}>
          
          {error && (
            <div className="p-3 text-sm bg-red-500/10 border border-red-500/50 text-red-500 rounded-lg animate-in fade-in zoom-in-95">
              {error}
            </div>
          )}

          {successMessage && (
            <div className="p-3 text-sm bg-emerald-500/10 border border-emerald-500/50 text-emerald-400 rounded-lg animate-in fade-in zoom-in-95">
              {successMessage}
            </div>
          )}

          {/* ✅ QA Fix 4: Conditional registration input fields (Full Name & Email) */}
          {isSignUp && (
            <div className="space-y-6 animate-in fade-in slide-in-from-top-2 duration-200">
              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-2">Full Name</label>
                <input 
                  name="fullName" 
                  type="text" 
                  required={isSignUp}
                  value={credentials.fullName}
                  onChange={handleChange}
                  placeholder="John Doe"
                  className="w-full bg-[#0D121F] border border-slate-700 rounded-lg px-4 py-3 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-2">Email Address</label>
                <input 
                  name="email" 
                  type="email" 
                  required={isSignUp}
                  value={credentials.email}
                  onChange={handleChange}
                  placeholder="john.doe@sentrypod.io"
                  className="w-full bg-[#0D121F] border border-slate-700 rounded-lg px-4 py-3 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                />
              </div>
            </div>
          )}

          {/* Username Field */}
          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-2">Username</label>
            <input 
              name="username" 
              type="text" 
              required
              value={credentials.username}
              onChange={handleChange}
              placeholder="sanuja_admin"
              className="w-full bg-[#0D121F] border border-slate-700 rounded-lg px-4 py-3 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
            />
          </div>

          {/* Password Field */}
          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-2">Password</label>
            <div className="relative">
              <input 
                name="password" 
                type={showPassword ? "text" : "password"} 
                required
                value={credentials.password}
                onChange={handleChange}
                placeholder="••••••••"
                className="w-full bg-[#0D121F] border border-slate-700 rounded-lg px-4 py-3 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
              />
              <button 
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>

          {/* Confirm Password Field */}
          {isSignUp && (
            <div className="animate-in fade-in slide-in-from-top-2 duration-200">
              <label className="block text-sm font-semibold text-slate-300 mb-2">Confirm Password</label>
              <div className="relative">
                <input 
                  name="confirmPassword" 
                  type={showConfirmPassword ? "text" : "password"} 
                  required={isSignUp}
                  value={credentials.confirmPassword}
                  onChange={handleChange}
                  placeholder="••••••••"
                  className="w-full bg-[#0D121F] border border-slate-700 rounded-lg px-4 py-3 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                />
                <button 
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                >
                  {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>
          )}

          {/* Submit Button */}
          <button 
            type="submit"
            disabled={isLoading} 
            className="w-full bg-[#155DFC] hover:bg-blue-600 text-white font-bold py-4 rounded-lg shadow-lg shadow-blue-500/20 transition-all flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <>
                <Loader2 size={20} className="mr-2 animate-spin" />
                {isSignUp ? "Creating Account..." : "Authenticating..."}
              </>
            ) : (
              isSignUp ? "Create Account" : "Sign In"
            )}   
          </button>
        </form>

        <div className="mt-6 text-center text-sm">
          <p className="text-slate-400">
            {isSignUp ? "Already have an account?" : "Don't have an account yet?"}{' '}
            <button 
              type="button" 
              onClick={toggleMode}
              className="text-blue-500 hover:text-blue-400 font-semibold focus:outline-none transition-colors ml-1"
            >
              {isSignUp ? "Sign In" : "Create Account"}
            </button>
          </p>
        </div>

        {/* SECURITY FOOTNOTE */}
        <div className="mt-8 pt-6 border-t border-slate-800/50 flex gap-3">
          <ShieldCheck className="text-emerald-500 shrink-0" size={18} />
          <p className="text-[12px] leading-relaxed text-slate-400">
            Secure login using <span className="text-emerald-500">JWT authentication</span> and <span className="text-emerald-500">RBAC</span> for enterprise-grade security.
          </p>
        </div>
      </div>

      <footer className="mt-12 text-slate-500 text-sm">
        © 2026 Sentry-Pod Enterprise. All rights reserved.
      </footer>
    </div>
  );
};

export default Login;