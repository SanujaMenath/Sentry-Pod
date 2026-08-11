export default function ConfigSection({ icon: Icon, title, className = "", children }) {
  return (
    <section className={`rounded-2xl border border-slate-800 bg-slate-900/50 p-4 ${className}`}>
      <h3 className="mb-4 flex items-center gap-2 text-sm font-bold text-slate-100">
        <Icon size={15} />
        {title}
      </h3>
      <div className="space-y-3">{children}</div>
    </section>
  );
}
