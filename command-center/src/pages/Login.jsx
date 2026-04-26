import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import logo from '../images/logo.png'; 
import { Eye, EyeOff, ShieldCheck } from 'lucide-react';

const Login = () => {
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();

  const pageStyle = {
    background: 'linear-gradient(135deg, #020618 0%, #1D293D 45%, #475569 100%)',
    backgroundAttachment: 'fixed'
  };

  const handleSignIn = (e) => {
    e.preventDefault(); 
    navigate('/dashboard'); 
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6" style={pageStyle}>
      
      {/* LOGO & HEADER */}
      <div className="mb-8 text-center animate-in fade-in slide-in-from-top-4 duration-700">
        <img src={logo} alt="SentryPod AI" className="h-26 w-auto object-contain mx-auto mb-4" />
        <p className="text-slate-400 font-medium tracking-wide">Enterprise Network AI Dashboard</p>
      </div>

      {/* LOGIN CARD */}
      <div className="w-full max-w-md bg-[#111827]/80 backdrop-blur-xl p-8 rounded-2xl border border-slate-800 shadow-[0_20px_50px_rgba(0,0,0,0.5)] animate-in zoom-in-95 duration-500">
        <form className="space-y-6" onSubmit={handleSignIn}>
          
          {/* Username Field */}
          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-2">Username / Email</label>
            <input 
              type="email" 
              required
              placeholder="admin@sentrypod.io"
              className="w-full bg-[#0D121F] border border-slate-700 rounded-lg px-4 py-3 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
            />
          </div>

          {/* Password Field */}
          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-2">Password</label>
            <div className="relative">
              <input 
                type={showPassword ? "text" : "password"} 
                required
                placeholder="••••••••"
                className="w-full bg-[#0D121F] border border-slate-700 rounded-lg px-4 py-3 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
              />
              <button 
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>

          {/* Remember Me & Forgot Password */}
          <div className="flex items-center justify-between text-sm">
            <label className="flex items-center gap-2 text-slate-400 cursor-pointer group">
              <input type="checkbox" className="w-4 h-4 rounded border-slate-700 bg-slate-800 checked:bg-blue-600 transition-all cursor-pointer" />
              <span className="group-hover:text-slate-300 transition-colors">Remember me</span>
            </label>
            <a href="#" className="text-blue-500 hover:text-blue-400 font-medium transition-colors">Forgot Password?</a>
          </div>

          {/* Sign In Button */}
          <button 
            type="submit"
            className="w-full bg-[#155DFC] hover:bg-blue-600 text-white font-bold py-4 rounded-lg shadow-lg shadow-blue-500/20 transition-all hover:-translate-y-0.5 active:scale-[0.98]"
          >
            Sign In
          </button>
        </form>

        {/* SECURITY FOOTNOTE */}
        <div className="mt-8 pt-6 border-t border-slate-800/50 flex gap-3">
          <ShieldCheck className="text-emerald-500 shrink-0" size={18} />
          <p className="text-[12px] leading-relaxed text-slate-400">
            Secure login using <span className="text-emerald-500">JWT authentication</span> and <span className="text-emerald-500">RBAC</span> (Role-Based Access Control) for enterprise-grade security.
          </p>
        </div>
      </div>

      {/* FOOTER */}
      <footer className="mt-12 text-slate-500 text-sm">
        © 2026 Sentry-Pod Enterprise. All rights reserved.
      </footer>
    </div>
  );
};

export default Login;