import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, Network, MessageSquare, ShieldAlert, 
  Server, ClipboardList, Users, Settings, LogOut, UserCircle, Terminal
} from 'lucide-react';
import { logout } from "../services/authService";
import logo from '../images/logo.png'; 
import PermissionModal from "./PermissionModal";
import { PAGE_PERMISSIONS, getCurrentUserRole } from "../constants/roles";

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

export default function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();

  // Real role from the JWT stored at login time
  const currentRole = getCurrentUserRole();
  const [modalState, setModalState] = useState({ isOpen: false, requiredRole: "" });

  const handleLogout = () => {
     logout();
  };

  // Handles access validation against the authenticated user's real role
  const handleNavigation = (path) => {
    const allowedRoles = PAGE_PERMISSIONS[path] || [];
    
    if (allowedRoles.includes(currentRole)) {
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
  className="w-64 border-r border-slate-800 p-4 hidden lg:flex flex-col shrink-0 h-screen overflow-y-auto" 
  style={{ backgroundColor: '#020618ED', fontFamily: '"Inter", sans-serif' }}
>
      {/* BRAND LOGO */}
      <div className="mb-6 px-1 flex items-center justify-start">
  <img src={logo} alt="SentryPod AI" className="h-24 w-auto max-w-full object-contain" />
</div>

      {/* NAVIGATION ITEMS */}
      <nav className="space-y-2 flex-1">
        {navItems.map(({ icon: Icon, label, path }) => {
          const isActive = location.pathname === path;
          const allowedRoles = PAGE_PERMISSIONS[path] || [];
          const hasAccess = allowedRoles.includes(currentRole);

          return (
            <button
              key={path}
              onClick={() => handleNavigation(path)}
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

      {/*  RENDER THE DIALOG GUARDIAN COMPONENT */}
      <PermissionModal 
        isOpen={modalState.isOpen}
        onClose={() => setModalState({ ...modalState, isOpen: false })}
        requiredRole={modalState.requiredRole}
      />
    </aside>
  );
}