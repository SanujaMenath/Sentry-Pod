import { useNavigate } from "react-router-dom";
import { ShieldAlert, ArrowLeft } from "lucide-react";

const AccessDenied = ({ requiredRole }) => {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[60vh] px-6">
      <div className="flex items-center gap-4 mb-6">
        <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
          <ShieldAlert size={28} className="text-rose-400" />
        </div>
      </div>

      <h1 className="text-4xl font-bold text-white mb-3">403</h1>
      <h2 className="text-lg font-semibold text-slate-200 mb-2">
        Access Denied
      </h2>
      <p className="text-sm text-slate-400 max-w-md text-center leading-relaxed mb-6">
        Your current role does not have permission to view this page.
        {requiredRole
          ? ` This area requires: ${requiredRole}.`
          : ""}
      </p>

      <button
        onClick={() => navigate("/dashboard")}
        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors"
      >
        <ArrowLeft size={16} />
        Back to Dashboard
      </button>
    </div>
  );
};

export default AccessDenied;