import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, Network, MessageSquare, ShieldAlert, 
  Server, ClipboardList, Users, Settings, LogOut,UserCircle
} from 'lucide-react';
import logo from '../images/logo.png'; 

const navItems = [
  { icon: LayoutDashboard, label: 'Dashboard', id: 'dashboard', path: '/dashboard' },
  { icon: Network, label: 'Topology Map', id: 'topology', path: '/topology' },
  { icon: MessageSquare, label: 'AI Chat Console', id: 'ai-chat', path: '/ai-chat' },
  { icon: ShieldAlert, label: 'Staging Gate', id: 'staging', path: '/staging' },
  { icon: Server, label: 'Network Devices', id: 'network', path: '/network-devices' },
  { icon: ClipboardList, label: 'Audit Logs', id: 'audit', path: '/audit-logs' }, 
  { icon: Users, label: 'Users', id: 'users', path: '/users' },
  { icon: UserCircle, label: 'Profile', id: 'profile', path: '/profile' },
  { icon: Settings, label: 'Settings', id: 'settings', path: '/settings' },
];

export default function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    localStorage.removeItem('token'); 
    navigate('/login');
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

          return (
            <button
              key={path}
              onClick={() => navigate(path)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-150 text-left
                ${isActive
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
            >
              <Icon size={18} />
              <span>{label}</span>
            </button>
          );
        })}
      </nav>

      {/* LOGOUT BUTTON */}
      <button 
        onClick={handleLogout} 
        className="mt-auto flex items-center gap-3 px-4 py-3 text-slate-500 hover:text-rose-400 transition-colors group"
      >
        <LogOut size={18} className="group-hover:rotate-12 transition-transform" />
        <span className="text-sm font-medium">Logout</span>
      </button>
      
      <div className="mt-4 px-4 text-[10px] text-slate-600 font-medium uppercase tracking-widest">
        v2.1.0 • © 2026 Sentry-Pod
      </div>
    </aside>
  );
}