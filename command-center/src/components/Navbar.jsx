import { Search, Bell, Circle } from 'lucide-react';

export default function Navbar() {
  return (
    <div className="h-14 bg-[#0d1117] border-b border-[#1e2530] flex items-center px-4 gap-4">
      <div className="flex-1 relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
        <input
          type="text"
          placeholder="Search devices, logs, configurations..."
          className="w-full bg-[#161b22] border border-[#1e2530] rounded-lg pl-9 pr-4 py-2 text-sm text-gray-300 placeholder-gray-600 focus:outline-none focus:border-blue-500"
        />
      </div>
      <div className="flex items-center gap-1 bg-[#161b22] border border-[#1e2530] rounded-lg px-3 py-1.5">
        <Circle size={8} className="fill-green-400 text-green-400" />
        <span className="text-xs text-green-400 font-medium">AI Online</span>
      </div>
      <div className="relative">
        <Bell size={18} className="text-gray-400" />
        <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-xs text-white flex items-center justify-center">3</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-xs font-bold text-white">AD</div>
        <div className="text-right">
          <div className="text-xs text-white font-medium">Admin</div>
          <div className="text-xs text-gray-500">System Administrator</div>
        </div>
      </div>
    </div>
  );
}