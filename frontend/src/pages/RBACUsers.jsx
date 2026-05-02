import { useState } from 'react';
import { UserPlus, Shield, MoreVertical } from 'lucide-react';
import AddUserModal from '../components/AddUserModal';

const roles = [
  { name: 'Super Admin', desc: 'Full system access', count: 1, color: 'text-purple-400', bg: 'bg-purple-600/10 border-purple-500/20' },
  { name: 'Network Admin', desc: 'Manage devices and configurations', count: 3, color: 'text-blue-400', bg: 'bg-blue-600/10 border-blue-500/20' },
  { name: 'Security Admin', desc: 'Manage security policies', count: 2, color: 'text-teal-400', bg: 'bg-teal-600/10 border-teal-500/20' },
  { name: 'Auditor', desc: 'View logs and reports', count: 1, color: 'text-amber-400', bg: 'bg-amber-600/10 border-amber-500/20' },
  { name: 'Read Only', desc: 'View-only access', count: 4, color: 'text-slate-400', bg: 'bg-slate-600/10 border-slate-500/20' },
];

const roleColors = {
  'Super Admin': 'bg-purple-500/10 text-purple-300 border border-purple-500/20',
  'Network Admin': 'bg-blue-500/10 text-blue-300 border border-blue-500/20',
  'Security Admin': 'bg-teal-500/10 text-teal-300 border border-teal-500/20',
  'Read Only': 'bg-slate-500/10 text-slate-300 border border-slate-500/20',
  'Auditor': 'bg-amber-500/10 text-amber-300 border border-amber-500/20',
};

const avatarColors = {
  AD: 'bg-blue-600',
  JN: 'bg-emerald-600',
  SS: 'bg-purple-600',
  MM: 'bg-pink-600',
  LL: 'bg-slate-600',
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

  const styles = {
    main: {
      background: 'linear-gradient(135deg, #F8FAFC 0%, #D1D5DB 100%)',
      backgroundAttachment: 'fixed',
      fontFamily: '"Inter", sans-serif',
      minHeight: '100%',
    },
    card: { backgroundColor: '#1D293DED', fontFamily: '"Inter", sans-serif' },
    headline: { color: '#0F172A', fontSize: '30px', fontWeight: '800', fontFamily: '"Inter", sans-serif', letterSpacing: '-0.025em' },
    subtext: { color: '#475569', fontSize: '16px', fontWeight: '500', fontFamily: '"Inter", sans-serif' }
  };

  return (
    <div style={styles.main}>
      <div className="p-8 space-y-8">

        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 style={styles.headline}>User Management</h1>
            <p style={styles.subtext}>Manage users and role-based access control (RBAC)</p>
          </div>
          <button
            onClick={() => setShowAddUser(true)}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-colors shadow-lg shadow-blue-600/20"
          >
            <UserPlus size={14} />
            Add New User
          </button>
        </div>

        {/* Role Cards */}
        <div className="grid grid-cols-5 gap-4">
          {roles.map(role => (
            <div key={role.name} className={`${role.bg} border rounded-3xl p-5 relative shadow-[0_5px_15px_rgba(0,0,0,0.4)]`} style={styles.card}>
              <div className="absolute top-4 right-4">
                <span className="w-6 h-6 rounded-full bg-orange-500 text-white text-xs flex items-center justify-center font-bold shadow-lg">
                  {role.count}
                </span>
              </div>
              <Shield size={20} className={`${role.color} mb-3`} strokeWidth={1.5} />
              <p className="text-slate-200 font-bold text-sm mb-1">{role.name}</p>
              <p className="text-slate-500 text-xs leading-relaxed">{role.desc}</p>
            </div>
          ))}
        </div>

        {/* Users Table */}
        <div className="rounded-3xl border border-slate-700/30 shadow-[0_5px_15px_rgba(0,0,0,0.6)] overflow-hidden" style={styles.card}>
          <div className="px-6 py-4 border-b border-slate-800/50">
            <h2 className="text-sm font-medium text-slate-300">All Users</h2>
          </div>
          <div className="overflow-x-auto px-6 pb-6">
            <table className="w-full text-left">
              <thead className="text-slate-500 text-[12px] font-medium border-b border-slate-800/30">
                <tr>
                  {['User', 'Email', 'Role', 'Status', 'Last Login', 'Actions'].map(h => (
                    <th key={h} className="py-5 font-normal">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="text-[13px]">
                {users.map(user => (
                  <tr key={user.email} className="border-b border-slate-800/30 hover:bg-slate-800/20 transition-colors last:border-0">
                    <td className="py-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-full ${avatarColors[user.initials]} flex items-center justify-center text-[11px] font-bold text-white shadow-lg`}>
                          {user.initials}
                        </div>
                        <span className="text-slate-200 font-bold">{user.name}</span>
                      </div>
                    </td>
                    <td className="py-4 text-slate-400 font-medium">{user.email}</td>
                    <td className="py-4">
                      <span className={`px-3 py-1 rounded-lg text-[11px] font-bold ${roleColors[user.role]}`}>
                        {user.role}
                      </span>
                    </td>
                    <td className="py-4">
                      <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-lg border ${
                        user.status === 'active'
                          ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                          : 'bg-slate-500/10 border-slate-500/20 text-slate-400'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${user.status === 'active' ? 'bg-emerald-500' : 'bg-slate-500'}`} />
                        <span className="text-[11px] font-bold capitalize">{user.status}</span>
                      </div>
                    </td>
                    <td className="py-4 text-slate-500 font-medium">{user.lastLogin}</td>
                    <td className="py-4">
                      <button className="text-slate-500 hover:text-white transition-colors">
                        <MoreVertical size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>
      {showAddUser && <AddUserModal onClose={() => setShowAddUser(false)} />}
    </div>
  );
}