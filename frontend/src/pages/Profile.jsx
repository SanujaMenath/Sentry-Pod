import React, { useState, useEffect } from 'react';
import { User, Lock, ShieldCheck, CheckCircle2, Loader2 } from 'lucide-react';
import { getUserProfile, updateProfile, updatePassword } from '../services/profileService';
import PageHeader from "../components/PageHeader";

export default function Profile() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [bio, setBio] = useState('');
  const [role, setRole] = useState('User');

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');

  const [profileLoading, setProfileLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  useEffect(() => {
    const loadProfileData = async () => {
      try {
        const data = await getUserProfile();
        setName(data.full_name || '');
        setEmail(data.email || '');
        setPhone(data.phone || '');
        setBio(data.bio || '');
        setRole(data.role || 'User');
      } catch (err) {
        setError(err);
      }
    };
    loadProfileData();
  }, []);

  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    setProfileLoading(true);
    setError(null);
    setSuccess(null);

    try {
      await updateProfile({
        full_name: name, 
        email,
        phone,
        bio
      });
      setSuccess("Profile information saved successfully!");
    } catch (err) {
      setError(err);
    } finally {
      setProfileLoading(false);
    }
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setPasswordLoading(true);
    setError(null);
    setSuccess(null);

    if (newPassword !== confirmNewPassword) {
      setError("New passwords do not match.");
      setPasswordLoading(false);
      return;
    }

    try {
      await updatePassword({
        current_password: currentPassword,
        new_password: newPassword
      });
      setSuccess("Password updated successfully!");
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
    } catch (err) {
      setError(err);
    } finally {
      setPasswordLoading(false);
    }
  };

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

        {/* Header */}
        <div className="flex items-start justify-between">
           <PageHeader 
            title="Playbook Management" 
             description="Network automated configurations and core code blueprints" 
             isSmallSubtext={true}
        />
        </div>

        {/* Notification Status Banners */}
        {error && (
          <div className="p-4 text-sm bg-red-500/10 border border-red-500/30 text-red-500 rounded-xl max-w-5xl">
            {error}
          </div>
        )}
        {success && (
          <div className="p-4 text-sm bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-xl max-w-5xl">
            {success}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* LEFT COLUMN: PROFILE SUMMARY & ACTIVITY */}
          <div className="lg:col-span-1 space-y-11">
            
            {/* PROFILE SUMMARY CARD */}
            <div 
              className="p-8 rounded-3xl border border-slate-700/30 shadow-[0_0.5rem_2rem_rgba(0,0,0,0.2)] text-center transition-transform hover:scale-[1.01]"
              style={styles.card}
            >
              <div className="w-24 h-24 bg-blue-600 rounded-full mx-auto mb-6 flex items-center justify-center text-[2.5rem] font-bold text-white shadow-[0_0.5rem_1.5rem_rgba(37,99,235,0.4)]">
                {name ? name.charAt(0).toUpperCase() : 'U'}
              </div>
              <h2 className="text-[1.25rem] font-bold text-slate-200 mb-1">{name || 'User Profile'}</h2>
              <p className="text-slate-400 text-[0.875rem] mb-6 font-medium">{role}</p>
              <div className="inline-flex items-center gap-2 px-4 py-[0.4rem] bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl text-[0.75rem] font-bold">
                <ShieldCheck className="w-4 h-4" />
                Verified Account
              </div>
            </div>

            {/* ACCOUNT STATUS CARD */}
            <div className="p-6 rounded-3xl border border-slate-700/30 shadow-[0_0.5rem_2rem_rgba(0,0,0,0.2)]" style={styles.card}>
              <h4 className="text-[0.75rem] font-black text-slate-500 uppercase tracking-[0.15em] mb-4 px-2">
                Account Status
              </h4>
              <div className="space-y-3">
                <div className="flex justify-between items-center p-3 bg-[#0D121F]/40 rounded-xl border border-slate-800/50">
                  <span className="text-slate-400 text-[0.8rem]">Two-Factor Auth</span>
                  <span className="text-emerald-400 text-[0.7rem] font-bold uppercase">Active</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-[#0D121F]/40 rounded-xl border border-slate-800/50">
                  <span className="text-slate-400 text-[0.8rem]">Role Permissions</span>
                  <span className="text-blue-400 text-[0.8rem] font-medium">Full Access</span>
                </div>
              </div>
            </div>

            {/* RECENT ACTIVITY CARD */}
            <div className="p-6 rounded-3xl border border-slate-700/30 shadow-[0_0.5rem_2rem_rgba(0,0,0,0.2)]" style={styles.card}>
              <h4 className="text-[0.75rem] font-black text-slate-500 uppercase tracking-[0.15em] mb-4 px-2">
                Recent Security Activity
              </h4>
              <div className="space-y-4">
                {[
                  { event: "Password Changed", time: "2 days ago", color: "text-slate-300" },
                  { event: "New Login: Chrome / Windows", time: "Yesterday", color: "text-slate-300" },
                  { event: "2FA Verified", time: "2 hours ago", color: "text-emerald-400" }
                ].map((item, idx) => (
                  <div key={idx} className="flex flex-col p-4 hover:bg-[#0D121F]/30 rounded-xl transition-colors border border-transparent hover:border-slate-800/50">
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
            <form onSubmit={handleProfileSubmit} className="rounded-3xl border border-slate-700/30 shadow-[0_0.5rem_2rem_rgba(0,0,0,0.2)] overflow-hidden transition-all hover:shadow-[0_0.8rem_2.5rem_rgba(0,0,0,0.3)]" style={styles.card}>
              <div className="p-8">
                <div className="flex items-center gap-3 mb-8 text-slate-200 border-b border-slate-800/50 pb-4">
                  <User className="w-[1.2rem] h-[1.2rem] text-blue-400" />
                  <h4 className="text-[0.9rem] font-bold tracking-tight text-slate-100">General Information</h4>
                </div>
                
                <div className="space-y-6">
                  {/* Row 1: Full Name */}
                  <div className="group">
                    <label className="block text-[0.7rem] font-black text-slate-500 uppercase tracking-[0.15em] mb-2 group-focus-within:text-blue-400 transition-colors">
                      Full Name
                    </label>
                    <input 
                      type="text" 
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full bg-[#0D121F]/60 border border-slate-800 rounded-[0.8rem] px-[1.2rem] py-[0.9rem] text-[1rem] text-slate-200 outline-none ring-2 ring-transparent focus:ring-blue-600/40 focus:border-blue-500/50 transition-all shadow-inner"
                    />
                  </div>

                  {/* Row 2: Email and Phone */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="group">
                      <label className="block text-[0.7rem] font-black text-slate-500 uppercase tracking-[0.15em] mb-2 group-focus-within:text-blue-400 transition-colors">
                        Email Address
                      </label>
                      <input 
                        type="email" 
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full bg-[#0D121F]/60 border border-slate-800 rounded-[0.8rem] px-[1.2rem] py-[0.9rem] text-[1rem] text-slate-200 outline-none ring-2 ring-transparent focus:ring-blue-600/40 focus:border-blue-500/50 transition-all shadow-inner"
                      />
                    </div>
                    <div className="group">
                      <label className="block text-[0.7rem] font-black text-slate-500 uppercase tracking-[0.15em] mb-2 group-focus-within:text-blue-400 transition-colors">
                        Phone Number
                      </label>
                      <input 
                        type="tel" 
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="+1 (555) 000-0000"
                        className="w-full bg-[#0D121F]/60 border border-slate-800 rounded-[0.8rem] px-[1.2rem] py-[0.9rem] text-[1rem] text-slate-200 outline-none ring-2 ring-transparent focus:ring-blue-600/40 focus:border-blue-500/50 transition-all shadow-inner"
                      />
                    </div>
                  </div>

                  {/* Row 3: Bio / Department */}
                  <div className="group">
                    <label className="block text-[0.7rem] font-black text-slate-500 uppercase tracking-[0.15em] mb-2 group-focus-within:text-blue-400 transition-colors">
                      Bio / Department
                    </label>
                    <textarea 
                      rows="3"
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                      placeholder="Brief description of your role..."
                      className="w-full bg-[#0D121F]/60 border border-slate-800 rounded-[0.8rem] px-[1.2rem] py-[0.9rem] text-[1rem] text-slate-200 outline-none ring-2 ring-transparent focus:ring-blue-600/40 focus:border-blue-500/50 transition-all shadow-inner resize-none"
                    ></textarea>
                  </div>

                  <button 
                    type="submit"
                    disabled={profileLoading}
                    className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-3 rounded-[0.8rem] text-[0.85rem] font-black flex items-center gap-2 transition-all active:scale-[0.97] shadow-[0_0.4rem_1.2rem_rgba(37,99,235,0.3)] disabled:opacity-50"
                  >
                    {profileLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} 
                    SAVE CHANGES
                  </button>
                </div>
              </div>
            </form>

            {/* SECURITY & PASSWORD */}
            <form onSubmit={handlePasswordSubmit} className="rounded-3xl border border-slate-700/30 shadow-[0_0.5rem_2rem_rgba(0,0,0,0.2)] overflow-hidden" style={styles.card}>
              <div className="p-8">
                <div className="flex items-center gap-3 mb-8 text-slate-200 border-b border-slate-800/50 pb-4">
                  <Lock className="w-[1.2rem] h-[1.2rem] text-rose-400" />
                  <h4 className="text-[0.9rem] font-bold tracking-tight">Security & Password</h4>
                </div>
                
                <div className="space-y-6">
                  <div>
                    <label className="block text-[0.7rem] font-black text-slate-500 uppercase tracking-[0.15em] mb-2">Current Password</label>
                    <input 
                      type="password" 
                      required
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="••••••••" 
                      className="w-full bg-[#0D121F]/60 border border-slate-800 rounded-[0.8rem] px-[1.2rem] py-[0.9rem] text-[1rem] text-slate-200 outline-none focus:ring-2 focus:ring-rose-500/40" 
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[0.7rem] font-black text-slate-500 uppercase tracking-[0.15em] mb-2">New Password</label>
                      <input 
                        type="password" 
                        required
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="New Password" 
                        className="w-full bg-[#0D121F]/60 border border-slate-800 rounded-[0.8rem] px-[1.2rem] py-[0.9rem] text-[1rem] text-slate-200 outline-none focus:ring-2 focus:ring-rose-500/40" 
                      />
                    </div>
                    <div>
                      <label className="block text-[0.7rem] font-black text-slate-500 uppercase tracking-[0.15em] mb-2">Confirm New Password</label>
                      <input 
                        type="password" 
                        required
                        value={confirmNewPassword}
                        onChange={(e) => setConfirmNewPassword(e.target.value)}
                        placeholder="Confirm Password" 
                        className="w-full bg-[#0D121F]/60 border border-slate-800 rounded-[0.8rem] px-[1.2rem] py-[0.9rem] text-[1rem] text-slate-200 outline-none focus:ring-2 focus:ring-rose-500/40" 
                      />
                    </div>
                  </div>

                  <button 
                    type="submit"
                    disabled={passwordLoading}
                    className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-3 rounded-[0.8rem] text-[0.85rem] font-black transition-all active:scale-[0.97] shadow-[0_0.4rem_1.2rem_rgba(37,99,235,0.3)] disabled:opacity-50 flex items-center gap-2"
                  >
                    {passwordLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                    UPDATE PASSWORD
                  </button>
                </div>
              </div>
            </form>
          
          </div>
        </div>
      </main>
    </div> 
  );
}