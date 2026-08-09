const getProgressColor = (value) => {
  if (value >= 80) return "bg-rose-500";
  if (value >= 55) return "bg-amber-500";
  return "bg-blue-500";
};

export default function UsageBar({ label, value }) {
  const safeValue = Number.isFinite(value) ? value : 0;

  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-[11px] font-bold">
        <span className="text-slate-500 uppercase tracking-wider">{label}</span>
        <span className={safeValue >= 80 ? "text-rose-400" : "text-slate-300"}>{safeValue}%</span>
      </div>
      <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
        <div
          className={`h-full transition-all duration-500 ${getProgressColor(safeValue)}`}
          style={{ width: `${safeValue}%` }}
        />
      </div>
    </div>
  );
}
