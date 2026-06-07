import React from 'react';

const StatCard = ({ title, value, subValue, icon: Icon, iconBg, iconColor, onClick, children }) => (
  <div 
    onClick={onClick}
    className={`p-6 rounded-3xl border border-slate-700/50 shadow-[0_5px_15px_rgba(0,0,0,0.6)] 
      flex flex-col justify-between h-full relative overflow-hidden bg-[#1D293DED] font-sans 
      ${onClick ? 'cursor-pointer hover:shadow-lg transition-shadow' : ''}`}
  >
    {/* Top Row: Main Content (Text + Icon side-by-side) */}
    <div className="flex justify-between items-start w-full z-10 mb-4">
      <div className="flex flex-col justify-between h-full min-h-[110px]">
        <div>
          <p className="text-slate-400 text-sm font-medium mb-2 capitalize">{title}</p>
          
          {value !== undefined && value !== null && value !== '' ? (
            /* Added 'capitalize' here too, so text values like "pending" auto-capitalize */
            <h3 className="text-4xl font-extrabold text-white drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)] tracking-tight capitalize">
              {value}
            </h3>
          ) : (
            <div className="text-4xl font-extrabold opacity-0 select-none h-10">0</div>
          )}
        </div>
        
        <p className="text-xs text-slate-500 mt-2 font-medium">{subValue}</p>
      </div>
      
      {/* Icon Wrapper */}
      <div className={`w-16 h-16 rounded-2xl flex items-center justify-center shrink-0 border border-white/10 shadow-[inset_0_1px_1px_rgba(255,255,255,0.2)] ${iconBg}`}>
        <Icon className={iconColor} size={32} strokeWidth={1.5} />
      </div>
    </div>

    {/* Bottom Row: Optional Refresh Button or Footers */}
    {children && (
      <div className="w-full mt-auto z-10">
        {children}
      </div>
    )}
  </div>
);

export default StatCard;