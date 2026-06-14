import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, Network, MessageSquare, ShieldAlert, 
  Server, ClipboardList, Users, Settings, LogOut, UserCircle, Terminal
} from 'lucide-react';
import { logout } from "../services/authService";
import logo from '../images/logo.png'; 
import PermissionModal from "./PermissionModal"; // <-- Import the modal you created

const navItems = [
  { icon: LayoutDashboard, label: 'Dashboard', id: 'dashboard', path: '/dashboard' },
  { icon: Network, label: 'Topology Map', id: 'topology', path: '/topology' },
  { icon: MessageSquare, label: 'AI Chat Console', id: 'ai-chat', path: '/ai-chat' },
  { icon: Terminal, label: 'Console', id: 'console', path: '/console' },
  { icon: Server, label: 'Network Devices', id: 'network', path: '/network-devices' },
  { icon: ClipboardList, label: 'Audit Logs', id: 'audit', path: '/audit-logs' }, 
  { icon: ShieldAlert, label: 'Drift Reports', id: 'drift', path: '/drift-reports' },
  { icon: Users, label: 'Users', id: 'users', path: '/users' },
  { icon: ShieldAlert, label: 'Playbook Manage', id: 'playbooks', path: '/playbooks' },
  { icon: UserCircle, label: 'Profile', id: 'profile', path: '/profile' },
  { icon: Settings, label: 'Settings', id: 'settings', path: '/settings' },
];

// 1. ADD THIS MATRIX: Define which roles can access each route
const PAGE_PERMISSIONS = {
  '/dashboard': ['System Administrator', 'Network Engineer', 'Operator', 'Security Analyst', 'Guest'],
  '/topology': ['System Administrator', 'Network Engineer'],
  '/ai-chat': ['System Administrator', 'Network Engineer', 'Operator', 'Security Analyst'],
  '/network-devices': ['System Administrator', 'Network Engineer', 'Operator'],
  '/audit-logs': ['System Administrator', 'Auditor'],
  '/drift-reports': ['System Administrator', 'Security Analyst', 'Network Engineer'],
  '/users': ['System Administrator'],
  '/playbooks': ['System Administrator', 'Network Engineer'],
  '/profile': ['System Administrator', 'Network Engineer', 'Operator', 'Auditor', 'Security Analyst', 'Guest'],
  '/console': ['System Administrator', 'Network Engineer', 'Operator'],
  '/settings': ['System Administrator'],
};

const MOCK_TEST_USERS = [
  { username: 'super_admin', role: 'System Administrator' },
  { username: 'net_eng_alan', role: 'Network Engineer' },
  { username: 'operator_max', role: 'Operator' },
  { username: 'auditor_steph', role: 'Auditor' },
  { username: 'sec_eng_val', role: 'Security Analyst' },
  { username: 'guest_user', role: 'Guest' }
];

export default function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();

  // 3. Track active simulation user and control the modal
  const [currentUser, setCurrentUser] = useState(MOCK_TEST_USERS[0]); // Defaults to Super Admin
  const [modalState, setModalState] = useState({ isOpen: false, requiredRole: "" });

  const handleLogout = () => {
     logout();
  };

  // 4. Handles access validation
  const handleNavigation = (path) => {
    const allowedRoles = PAGE_PERMISSIONS[path] || [];
    
    if (allowedRoles.includes(currentUser.role)) {
      navigate(path);
    } else {
      setModalState({
        isOpen: true,
        requiredRole: allowedRoles.join(", ")
      });
    }
  };

  return (
    <aside 
      className="w-64 border-r border-slate-800 p-6 hidden lg:flex flex-col shrink-0 min-h-screen" 
      style={{ backgroundColor: '#020618ED', fontFamily: '"Inter", sans-serif' }}
    >
      {/* BRAND LOGO */}
      <div className="mb-10 px-2">
        <img src={logo} alt="SentryPod AI" className="h-12 w-auto object-contain" />
      </div>

      {/* NAVIGATION ITEMS */}
      <nav className="space-y-2 flex-1">
        {navItems.map(({ icon: Icon, label, path }) => {
          const isActive = location.pathname === path;
          const allowedRoles = PAGE_PERMISSIONS[path] || [];
          const hasAccess = allowedRoles.includes(currentUser.role);

          return (
            <button
              key={path}
              // Change from onClick={() => navigate(path)} to use our handler:
              onClick={() => handleNavigation(path)}
              // Visual polish: dim elements the simulated user cannot access
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-150 text-left
                ${isActive
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                  : hasAccess 
                    ? 'text-slate-400 hover:text-white hover:bg-slate-800'
                    : 'text-slate-600 hover:bg-red-950/10 cursor-not-allowed' // Indicates locked state
                }`}
            >
              <Icon size={18} className={!hasAccess ? 'text-slate-700' : ''} />
              <span>{label}</span>
            </button>
          );
        })}
      </nav>

      {/* 5. Allows you to switch test profiles on the fly */}
      <div className="mt-auto mb-4 p-3 bg-slate-900/50 rounded-lg border border-slate-800">
        <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
          Simulate Test User
        </label>
        <select 
          value={currentUser.username}
          onChange={(e) => {
            const selected = MOCK_TEST_USERS.find(u => u.username === e.target.value);
            if (selected) setCurrentUser(selected);
          }}
          className="w-full bg-[#0b1329] border border-slate-700 text-xs rounded p-1.5 text-slate-300 focus:outline-none focus:border-blue-500"
        >
          {MOCK_TEST_USERS.map(user => (
            <option key={user.username} value={user.username}>
              {user.username} ({user.role})
            </option>
          ))}
        </select>
      </div>

      {/* LOGOUT BUTTON */}
      <button 
        onClick={handleLogout} 
        className="flex items-center gap-3 px-4 py-3 text-slate-500 hover:text-rose-400 transition-colors group"
      >
        <LogOut size={18} className="group-hover:rotate-12 transition-transform" />
        <span className="text-sm font-medium">Logout</span>
      </button>
      
      <div className="mt-4 px-4 text-[10px] text-slate-600 font-medium uppercase tracking-widest">
        v2.1.0 • © 2026 Sentry-Pod
      </div>

      {/* 6. RENDER THE DIALOG GUARDIAN COMPONENT */}
      <PermissionModal 
        isOpen={modalState.isOpen}
        onClose={() => setModalState({ ...modalState, isOpen: false })}
        requiredRole={modalState.requiredRole}
      />
    </aside>
  );
}