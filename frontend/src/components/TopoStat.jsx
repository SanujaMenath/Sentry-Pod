function Stat({ label, value, color = "text-white" }) {
  return <div className="flex justify-between text-sm"><span className="text-slate-400">{label}</span><strong className={color}>{value}</strong></div>;
}

export default Stat;
