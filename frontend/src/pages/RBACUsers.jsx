import { useState } from 'react';
import { UserPlus, Shield, MoreVertical } from 'lucide-react';
import AddUserModal from '../components/AddUserModal';

const roles = [
  { name: 'Super Admin', desc: 'Full system access', count: 1, color: 'text-purple-400', bg: 'bg-[#1a2035] border-[#2a3150]' },
  { name: 'Network Admin', desc: 'Manage devices and configurations', count: 3, color: 'text-blue-400', bg: 'bg-[#1a2035] border-[#2a3150]' },
  { name: 'Security Admin', desc: 'Manage security policies', count: 2, color: 'text-teal-400', bg: 'bg-[#1a2035] border-[#2a3150]' },
  { name: 'Auditor', desc: 'View logs and reports', count: 1, color: 'text-yellow-400', bg: 'bg-[#1a2035] border-[#2a3150]' },
  { name: 'Read Only', desc: 'View-only access', count: 4, color: 'text-gray-400', bg: 'bg-[#1a2035] border-[#2a3150]' },
];

const roleColors = {
  'Super Admin': 'bg-purple-900/60 text-purple-300 border border-purple-700',
  'Network Admin': 'bg-blue-900/60 text-blue-300 border border-blue-700',
  'Security Admin': 'bg-teal-900/60 text-teal-300 border border-teal-700',
  'Read Only': 'bg-gray-800/60 text-gray-300 border border-gray-600',
  'Auditor': 'bg-yellow-900/60 text-yellow-300 border border-yellow-700',
};

const avatarColors = {
  AD: 'bg-blue-600',
  JN: 'bg-green-600',
  SS: 'bg-purple-600',
  MM: 'bg-pink-600',
  LL: 'bg-gray-600',
};

const users = [
  { initials: 'AD', name: 'Admin User', email: 'admin@sentrypod.local', role: 'Super Admin', status: 'active', lastLogin: '2 min ago' },
  { initials: 'JN', name: 'John Network', email: 'john.network@sentrypod.local', role: 'Network Admin', status: 'active', lastLogin: '1 hour ago' },
  { initials: 'SS', name: 'Sarah Security', email: 'sarah.security@sentrypod.local', role: 'Security Admin', status: 'active', lastLogin: '3 hours ago' },
  { initials: 'MM', name: 'Mike Monitor', email: 'mike.monitor@sentrypod.local', role: 'Read Only', status: 'active', lastLogin: 'Yesterday' },
  { initials: 'LL', name: 'Lisa Logs', email: 'lisa.logs@sentrypod.local', role: 'Auditor', status: 'inactive', lastLogin: '2 days ago' },
];

export default function RBACUsers() {
  const [showAddUser, setShowAddUser] = useState(false);

  return (
    <div className="flex-1 min-h-screen bg-[#f0f2f5] p-6 overflow-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 mb-1">User Management</h1>
          <p className="text-sm text-gray-500">Manage users and role-based access control (RBAC)</p>
        </div>
        <button
          onClick={() => setShowAddUser(true)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <UserPlus size={14} />
          Add New User
        </button>
      </div>

      {/* Role Cards */}
      <div className="grid grid-cols-5 gap-3 mb-6">
        {roles.map(role => (
          <div key={role.name} className={" bg-[#1D293DED]  border rounded-xl p-4 relative"}>
            <div className="absolute top-3 right-3">
              <span className="w-5 h-5 rounded-full bg-orange-500 text-white text-xs flex items-center justify-center font-bold">
                {role.count}
              </span>
            </div>
            <Shield size={18} className={`${role.color} mb-3`} />
            <p className="text-white font-semibold text-sm mb-1">{role.name}</p>
            <p className="text-gray-500 text-xs leading-relaxed">{role.desc}</p>
          </div>
        ))}
      </div>

      {/* Users Table */}
      <div className="bg-[#1D293DED] border border-[#1e2530] rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[#1e2530]">
          <h2 className="text-sm font-semibold text-white">All Users</h2>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#1e2530]">
              {['User', 'Email', 'Role', 'Status', 'Last Login', 'Actions'].map(h => (
                <th key={h} className="px-5 py-3 text-left text-xs text-gray-500 font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {users.map(user => (
              <tr key={user.email} className="border-b border-[#1e2530] hover:bg-[#1e2530]/50 transition-colors">
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full ${avatarColors[user.initials]} flex items-center justify-center text-xs font-bold text-white`}>
                      {user.initials}
                    </div>
                    <span className="text-white text-sm font-medium">{user.name}</span>
                  </div>
                </td>
                <td className="px-5 py-3.5 text-gray-400 text-sm">{user.email}</td>
                <td className="px-5 py-3.5">
                  <span className={`px-2.5 py-1 rounded-md text-xs font-medium ${roleColors[user.role]}`}>
                    {user.role}
                  </span>
                </td>
                <td className="px-5 py-3.5">
                  <span className={`px-2.5 py-1 rounded-md text-xs font-medium border
                    ${user.status === 'active'
                      ? 'bg-green-900/50 text-green-400 border-green-700'
                      : 'bg-gray-800/50 text-gray-400 border-gray-600'
                    }`}>
                    {user.status}
                  </span>
                </td>
                <td className="px-5 py-3.5 text-gray-400 text-sm">{user.lastLogin}</td>
                <td className="px-5 py-3.5">
                  <button className="text-gray-500 hover:text-white transition-colors">
                    <MoreVertical size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showAddUser && <AddUserModal onClose={() => setShowAddUser(false)} />}
    </div>
  );
}