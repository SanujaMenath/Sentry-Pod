import { LayoutDashboard, Network, MessageSquare, GitBranch, Server, FileText, Users, Settings } from 'lucide-react';
import logo from '../Images/logo.png';

const navItems = [
  { icon: LayoutDashboard, label: 'Dashboard', id: 'dashboard' },
  { icon: Network, label: 'Topology Map', id: 'topology' },
  { icon: MessageSquare, label: 'AI Chat Console', id: 'ai-chat' },
  { icon: GitBranch, label: 'Staging Gate', id: 'staging' },
  { icon: Server, label: 'Network Devices', id: 'network' },
  { icon: FileText, label: 'Audit Logs', id: 'audit' },
  { icon: Users, label: 'RBAC / Users', id: 'users' },
  { icon: Settings, label: 'Settings', id: 'settings' },
];

export default function Sidebar({ activePage, onNavigate }) {
  return (
    <div className="w-48 min-h-screen bg-[#0d1117] flex flex-col border-r border-[#1e2530]">
      <div className="p-4 border-b border-[#1e2530]">
        <div className="flex items-center gap-2">
          <img src={logo} alt="SentryPod AI" className="h-10 w-auto object-contain" />
        </div>
      </div>
      <nav className="flex-1 py-4">
        {navItems.map(({ icon: Icon, label, id }) => (
          <button
            key={id}
            onClick={() => onNavigate(id)}
            className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-all duration-150 text-left
              ${activePage === id
                ? 'bg-blue-600 text-white font-medium'
                : 'text-gray-400 hover:text-white hover:bg-[#1e2530]'
              }`}
          >
            <Icon size={16} />
            <span>{label}</span>
          </button>
        ))}
      </nav>
      <div className="p-4 text-xs text-gray-600">v2.1.0 • © 2026 Sentry-Pod</div>
    </div>
  );
}
