import Toggle from "./Toggle";

function SettingRow({ label, desc, enabled, onChange }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-slate-800/50 last:border-0">
      <div>
        <p className="text-sm text-slate-200 font-medium">{label}</p>
        <p className="text-xs text-slate-500 mt-0.5">{desc}</p>
      </div>
      <Toggle enabled={enabled} onChange={onChange} />
    </div>
  );
}

export default SettingRow;
