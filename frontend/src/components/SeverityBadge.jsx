import { AlertTriangle } from "lucide-react";

function SeverityBadge({ severity }) {
  const styles = {
    medium: "border-yellow-400/40 bg-yellow-500/10 text-yellow-300",
    high: "border-orange-400/40 bg-orange-500/10 text-orange-300",
    critical: "border-rose-400/40 bg-rose-500/10 text-rose-300",
  };

  return (
    <span className={`flex items-center gap-1 rounded-lg border px-3 py-1 text-xs font-bold uppercase ${styles[severity]}`}>
      <AlertTriangle size={12} /> {severity}
    </span>
  );
}

export default SeverityBadge;
