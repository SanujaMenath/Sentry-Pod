import { useState } from 'react';
import { X, User, Mail, Lock, Shield } from 'lucide-react';

export default function AddUserModal({ onClose }) {
  const [form, setForm] = useState({ fullName: '', email: '', username: '', password: '', role: '' });

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative z-10 m-auto bg-[#161b22] border border-[#1e2530] rounded-2xl w-[400px] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-[#1e2530]">
          <h2 className="text-white font-semibold text-base">Add New User</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Full Name */}
          <div>
            <label className="text-xs text-gray-400 mb-1.5 block">Full Name</label>
            <div className="relative">
              <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                type="text"
                name="fullName"
                placeholder="John Doe"
                value={form.fullName}
                onChange={handleChange}
                className="w-full bg-[#0d1117] border border-[#1e2530] rounded-lg pl-9 pr-3 py-2.5 text-sm text-gray-300 placeholder-gray-600 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* Email */}
          <div>
            <label className="text-xs text-gray-400 mb-1.5 block">Email Address</label>
            <div className="relative">
              <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                type="email"
                name="email"
                placeholder="john.doe@sentrypod.io"
                value={form.email}
                onChange={handleChange}
                className="w-full bg-[#0d1117] border border-[#1e2530] rounded-lg pl-9 pr-3 py-2.5 text-sm text-gray-300 placeholder-gray-600 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* Username */}
          <div>
            <label className="text-xs text-gray-400 mb-1.5 block">Username</label>
            <div className="relative">
              <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                type="text"
                name="username"
                placeholder="jdoe"
                value={form.username}
                onChange={handleChange}
                className="w-full bg-[#0d1117] border border-[#1e2530] rounded-lg pl-9 pr-3 py-2.5 text-sm text-gray-300 placeholder-gray-600 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label className="text-xs text-gray-400 mb-1.5 block">Password</label>
            <div className="relative">
              <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                type="password"
                name="password"
                placeholder="••••••••"
                value={form.password}
                onChange={handleChange}
                className="w-full bg-[#0d1117] border border-[#1e2530] rounded-lg pl-9 pr-3 py-2.5 text-sm text-gray-300 placeholder-gray-600 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* Role */}
          <div>
            <label className="text-xs text-gray-400 mb-1.5 block">Role</label>
            <div className="relative">
              <Shield size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <select
                name="role"
                value={form.role}
                onChange={handleChange}
                className="w-full bg-[#0d1117] border border-[#1e2530] rounded-lg pl-9 pr-3 py-2.5 text-sm text-gray-300 focus:outline-none focus:border-blue-500 appearance-none"
              >
                <option value="">Select role...</option>
                <option>Super Admin</option>
                <option>Network Admin</option>
                <option>Security Admin</option>
                <option>Auditor</option>
                <option>Read Only</option>
              </select>
            </div>
          </div>

          {/* Actions */}
          <div className="grid grid-cols-2 gap-3 pt-2">
            <button
              onClick={onClose}
              className="py-2.5 rounded-lg text-sm font-medium bg-[#0d1117] border border-[#1e2530] text-gray-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button className="py-2.5 rounded-lg text-sm font-medium bg-blue-600 hover:bg-blue-500 text-white transition-colors">
              Save User
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}