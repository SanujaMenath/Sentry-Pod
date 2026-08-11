function LegendDot({ color, label }) {
  return <div className="flex items-center gap-3 text-sm text-slate-300"><span className={`h-3 w-3 rounded-full ${color}`} />{label}</div>;
}

export default LegendDot;
