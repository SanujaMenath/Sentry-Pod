function Panel({ title, children }) {
  return (
    <div className="rounded-3xl bg-[#1D293DED] border border-slate-700/30 p-6 shadow-[0_5px_15px_rgba(0,0,0,0.6)]">
      <h2 className="mb-6 text-lg font-extrabold text-white">{title}</h2>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

export default Panel;
