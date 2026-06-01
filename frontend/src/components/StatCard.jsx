import React from 'react';

const StatCard = ({ title, value, subValue, icon: Icon, iconBg, iconColor, onClick }) => (
  <div 
    onClick={onClick}
    className={`p-6 rounded-3xl border border-slate-700/50 shadow-[0_5px_15px_rgba(0,0,0,0.6)] flex justify-between items-center relative overflow-hidden bg-[#1D293DED] font-sans ${onClick ? 'cursor-pointer hover:shadow-lg transition-shadow' : ''}`}
  >
    <div className="z-10">
      <p className="text-slate-400 text-sm font-medium mb-2">{title}</p>
      <h3 className="text-4xl font-extrabold text-white drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)] tracking-tight">
        {value}
      </h3>
      <p className="text-xs text-slate-500 mt-2 font-medium">{subValue}</p>
    </div>
    <div className={`w-16 h-16 rounded-2xl flex items-center justify-center border border-white/10 shadow-[inset_0_1px_1px_rgba(255,255,255,0.2)] ${iconBg}`}>
      <Icon className={iconColor} size={32} strokeWidth={1.5} />
    </div>
  </div>
);

export default StatCard;