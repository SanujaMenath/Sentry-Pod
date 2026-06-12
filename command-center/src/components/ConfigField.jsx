export default function ConfigField({ label, children }) {
  return (
    <label className="block text-[11px] font-bold uppercase tracking-wide text-slate-500">
      <span>{label}</span>
      <div className="mt-1 [&_input]:w-full [&_select]:w-full [&_textarea]:w-full [&_input]:rounded-lg [&_select]:rounded-lg [&_textarea]:rounded-lg [&_input]:border [&_select]:border [&_textarea]:border [&_input]:border-slate-700 [&_select]:border-slate-700 [&_textarea]:border-slate-700 [&_input]:bg-[#172337] [&_select]:bg-[#172337] [&_textarea]:bg-[#172337] [&_input]:px-3 [&_select]:px-3 [&_textarea]:px-3 [&_input]:py-2.5 [&_select]:py-2.5 [&_textarea]:py-2.5 [&_input]:text-sm [&_select]:text-sm [&_textarea]:text-sm [&_input]:normal-case [&_select]:normal-case [&_textarea]:normal-case [&_input]:tracking-normal [&_select]:tracking-normal [&_textarea]:tracking-normal [&_input]:text-slate-200 [&_select]:text-slate-200 [&_textarea]:text-slate-200 [&_input]:outline-none [&_select]:outline-none [&_textarea]:outline-none focus-within:[&_input]:border-blue-500 focus-within:[&_select]:border-blue-500 focus-within:[&_textarea]:border-blue-500 [&_textarea]:min-h-20">
        {children}
      </div>
    </label>
  );
}
