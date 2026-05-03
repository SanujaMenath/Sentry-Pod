import React, { useState } from 'react';
import { User, Lock, ShieldCheck, CheckCircle2 } from 'lucide-react';

export default function Profile() {
  const [name, setName] = useState('Admin User');
  const [email, setEmail] = useState('admin@sentrypod.ai');

  const styles = {
    main: {
      background: "linear-gradient(135deg, #F8FAFC 0%, #D1D5DB 100%)",
      backgroundAttachment: "fixed",
      fontFamily: '"Inter", sans-serif',
    },
    card: { 
      backgroundColor: "#1D293DED", 
      fontFamily: '"Inter", sans-serif' 
    },
    headline: {
      color: "#0F172A",
      fontWeight: "800",
      fontFamily: '"Inter", sans-serif',
      letterSpacing: "-0.025em",
    },
    subtext: {
      color: "#475569",
      fontWeight: "500",
      fontFamily: '"Inter", sans-serif',
    },
  };

  return (
    <div className="flex min-h-screen" style={styles.main}>
    <main className="flex-1 overflow-y-auto p-8 space-y-8">

      {/* HEADER */}
      <div>
        <h1 className="text-3xl" style={styles.headline}>User Settings</h1>
        <p className="text-base" style={styles.subtext}>
          Manage your profile information and security preferences
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

      {/* LEFT COLUMN: PROFILE SUMMARY & ACTIVITY */}
<div className="lg:col-span-1 space-y-[1.5rem]">
  
  {/* PROFILE SUMMARY CARD */}
  <div 
    className="p-[2.5rem] rounded-[1.5rem] border border-slate-700/30 shadow-[0_0.5rem_2rem_rgba(0,0,0,0.2)] text-center transition-transform hover:scale-[1.01]"
    style={styles.card}
  >
    <div className="w-[6rem] h-[6rem] bg-blue-600 rounded-full mx-auto mb-[1.5rem] flex items-center justify-center text-[2.5rem] font-bold text-white shadow-[0_0.5rem_1.5rem_rgba(37,99,235,0.4)]">
      {name.charAt(0)}
    </div>
    <h2 className="text-[1.25rem] font-bold text-slate-200 mb-[0.25rem]">{name}</h2>
    <p className="text-slate-400 text-[0.875rem] mb-[1.5rem] font-medium">Security Administrator</p>
    <div className="inline-flex items-center gap-[0.5rem] px-[1rem] py-[0.4rem] bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-[0.75rem] text-[0.75rem] font-bold">
      <ShieldCheck className="w-[1rem] h-[1rem]" />
      Verified Account
    </div>
  </div>

  {/* ACCOUNT STATUS CARD */}
  <div className="p-[1.5rem] rounded-[1.5rem] border border-slate-700/30 shadow-[0_0.5rem_2rem_rgba(0,0,0,0.2)]" style={styles.card}>
    <h4 className="text-[0.75rem] font-black text-slate-500 uppercase tracking-[0.15em] mb-[1rem] px-[0.5rem]">
      Account Status
    </h4>
    <div className="space-y-[0.75rem]">
      <div className="flex justify-between items-center p-[0.75rem] bg-[#0D121F]/40 rounded-[0.75rem] border border-slate-800/50">
        <span className="text-slate-400 text-[0.8rem]">Two-Factor Auth</span>
        <span className="text-emerald-400 text-[0.7rem] font-bold uppercase">Active</span>
      </div>
      <div className="flex justify-between items-center p-[0.75rem] bg-[#0D121F]/40 rounded-[0.75rem] border border-slate-800/50">
        <span className="text-slate-400 text-[0.8rem]">Role Permissions</span>
        <span className="text-blue-400 text-[0.8rem] font-medium">Full Access</span>
      </div>
    </div>
  </div>

  {/*RECENT ACTIVITY CARD */}
  <div className="p-[1.5rem] rounded-[1.5rem] border border-slate-700/30 shadow-[0_0.5rem_2rem_rgba(0,0,0,0.2)]" style={styles.card}>
    <h4 className="text-[0.75rem] font-black text-slate-500 uppercase tracking-[0.15em] mb-[1rem] px-[0.5rem]">
      Recent Security Activity
    </h4>
    <div className="space-y-[0.5rem]">
      {[
        { event: "Password Changed", time: "2 days ago", color: "text-slate-300" },
        { event: "New Login: Chrome / Windows", time: "Yesterday", color: "text-slate-300" },
        { event: "2FA Verified", time: "2 hours ago", color: "text-emerald-400" }
      ].map((item, idx) => (
        <div key={idx} className="flex flex-col p-[0.75rem] hover:bg-[#0D121F]/30 rounded-[0.75rem] transition-colors border border-transparent hover:border-slate-800/50">
          <span className={`text-[0.8rem] font-medium ${item.color}`}>{item.event}</span>
          <span className="text-[0.7rem] text-slate-500">{item.time}</span>
        </div>
      ))}
    </div>
  </div>

</div>
        {/* RIGHT COLUMN: EDIT FORMS */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* GENERAL INFORMATION CARD */}
<div className="rounded-[1.5rem] border border-slate-700/30 shadow-[0_0.5rem_2rem_rgba(0,0,0,0.2)] overflow-hidden transition-all hover:shadow-[0_0.8rem_2.5rem_rgba(0,0,0,0.3)]" style={styles.card}>

  <div className="p-[2rem]">
    <div className="flex items-center gap-[0.75rem] mb-[2rem] text-slate-200 border-b border-slate-800/50 pb-[1rem]">
      <User className="w-[1.2rem] h-[1.2rem] text-blue-400" />
      <h4 className="text-[0.9rem] font-bold tracking-tight text-slate-100">General Information</h4>
    </div>
    
    <div className="space-y-[1.5rem]">
      {/* Row 1: Full Name */}
      <div className="group">
        <label className="block text-[0.7rem] font-black text-slate-500 uppercase tracking-[0.15em] mb-[0.5rem] group-focus-within:text-blue-400 transition-colors">
          Full Name
        </label>
        <input 
          type="text" 
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full bg-[#0D121F]/60 border border-slate-800 rounded-[0.8rem] px-[1.2rem] py-[0.9rem] text-[1rem] text-slate-200 outline-none ring-[0.125rem] ring-transparent focus:ring-blue-600/40 focus:border-blue-500/50 transition-all shadow-inner"
        />
      </div>

      {/* Row 2: Email and Phone */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-[1rem]">
        <div className="group">
          <label className="block text-[0.7rem] font-black text-slate-500 uppercase tracking-[0.15em] mb-[0.5rem] group-focus-within:text-blue-400 transition-colors">
            Email Address
          </label>
          <input 
            type="email" 
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-[#0D121F]/60 border border-slate-800 rounded-[0.8rem] px-[1.2rem] py-[0.9rem] text-[1rem] text-slate-200 outline-none ring-[0.125rem] ring-transparent focus:ring-blue-600/40 focus:border-blue-500/50 transition-all shadow-inner"
          />
        </div>
        <div className="group">
          <label className="block text-[0.7rem] font-black text-slate-500 uppercase tracking-[0.15em] mb-[0.5rem] group-focus-within:text-blue-400 transition-colors">
            Phone Number
          </label>
          <input 
            type="tel" 
            placeholder="+1 (555) 000-0000"
            className="w-full bg-[#0D121F]/60 border border-slate-800 rounded-[0.8rem] px-[1.2rem] py-[0.9rem] text-[1rem] text-slate-200 outline-none ring-[0.125rem] ring-transparent focus:ring-blue-600/40 focus:border-blue-500/50 transition-all shadow-inner"
          />
        </div>
      </div>

      {/* Row 3: Bio / Department */}
      <div className="group">
        <label className="block text-[0.7rem] font-black text-slate-500 uppercase tracking-[0.15em] mb-[0.5rem] group-focus-within:text-blue-400 transition-colors">
          Bio / Department
        </label>
        <textarea 
          rows="3"
          placeholder="Brief description of your role..."
          className="w-full bg-[#0D121F]/60 border border-slate-800 rounded-[0.8rem] px-[1.2rem] py-[0.9rem] text-[1rem] text-slate-200 outline-none ring-[0.125rem] ring-transparent focus:ring-blue-600/40 focus:border-blue-500/50 transition-all shadow-inner resize-none"
        ></textarea>
      </div>

      <button className="bg-blue-600 hover:bg-blue-500 text-white px-[2rem] py-[0.75rem] rounded-[0.8rem] text-[0.85rem] font-black flex items-center gap-[0.6rem] transition-all active:scale-[0.97] shadow-[0_0.4rem_1.2rem_rgba(37,99,235,0.3)]">
        <CheckCircle2 className="w-[1.1rem] h-[1.1rem]" /> SAVE CHANGES
      </button>
    </div>
  </div>
</div>

          {/* SECURITY & PASSWORD */}
            <div className="rounded-[1.5rem] border border-slate-700/30 shadow-[0_0.5rem_2rem_rgba(0,0,0,0.2)] overflow-hidden" style={styles.card}>
            
              <div className="p-[2rem]">
                <div className="flex items-center gap-[0.75rem] mb-[2rem] text-slate-200 border-b border-slate-800/50 pb-[1rem]">
                  <Lock className="w-[1.2rem] h-[1.2rem] text-rose-400" />
                  <h4 className="text-[0.9rem] font-bold tracking-tight">Security & Password</h4>
                </div>
                
                <div className="space-y-[1.5rem]">
                
                  <div>
                    <label className="block text-[0.7rem] font-black text-slate-500 uppercase tracking-[0.15em] mb-[0.5rem]">Current Password</label>
                    <input 
                      type="password" 
                      placeholder="••••••••" 
                      className="w-full bg-[#0D121F]/60 border border-slate-800 rounded-[0.8rem] px-[1.2rem] py-[0.9rem] text-[1rem] text-slate-200 outline-none focus:ring-[0.125rem] focus:ring-rose-500/40" 
                    />
                  </div>

                
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-[1rem]">
                    <div>
                      <label className="block text-[0.7rem] font-black text-slate-500 uppercase tracking-[0.15em] mb-[0.5rem]">New Password</label>
                      <input 
                        type="password" 
                        placeholder="New Password" 
                        className="w-full bg-[#0D121F]/60 border border-slate-800 rounded-[0.8rem] px-[1.2rem] py-[0.9rem] text-[1rem] text-slate-200 outline-none focus:ring-[0.125rem] focus:ring-rose-500/40" 
                      />
                    </div>
                    <div>
                      <label className="block text-[0.7rem] font-black text-slate-500 uppercase tracking-[0.15em] mb-[0.5rem]">Confirm New Password</label>
                      <input 
                        type="password" 
                        placeholder="Confirm Password" 
                        className="w-full bg-[#0D121F]/60 border border-slate-800 rounded-[0.8rem] px-[1.2rem] py-[0.9rem] text-[1rem] text-slate-200 outline-none focus:ring-[0.125rem] focus:ring-rose-500/40" 
                      />
                    </div>
                  </div>

                  <button className="bg-blue-600 hover:bg-blue-500 text-white px-[2rem] py-[0.75rem] rounded-[0.8rem] text-[0.85rem] font-black transition-all active:scale-[0.97] shadow-[0_0.4rem_1.2rem_rgba(37,99,235,0.3)]">
                    UPDATE PASSWORD
                  </button>
                </div>
              </div>
            </div>
        
        </div>
    </div>
</main>
</div> 
  );
}