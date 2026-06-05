import { useState, useEffect } from "react";
import { X, Key, Eye, EyeOff, Loader2, Check, AlertCircle } from "lucide-react";

export default function ApiKeyModal({ onClose, onSave }) {
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [hasKey, setHasKey] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [testLoading, setTestLoading] = useState(false);

  // Load existing API key on mount
  useEffect(() => {
    const loadApiKey = async () => {
      try {
        const response = await fetch("http://localhost:8000/llm/api-key-status");
        if (!response.ok) throw new Error("Failed to fetch key status");
        const data = await response.json();
        setHasKey(data.has_key);
      } catch (err) {
        console.error("Error loading API key status:", err);
      } finally {
        setIsLoading(false);
      }
    };
    loadApiKey();
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!apiKey.trim()) {
      setError("API key cannot be empty");
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch("http://localhost:8000/llm/api-key", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ api_key: apiKey }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || "Failed to save API key");
      }

      setSuccess("API key saved successfully!");
      setHasKey(true);
      setApiKey("");
      setTimeout(() => {
        onClose();
        onSave?.();
      }, 1500);
    } catch (err) {
      setError(err.message || "Failed to save API key");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm("Are you sure you want to delete the API key? The AI chat will stop working.")) {
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch("http://localhost:8000/llm/api-key", {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || "Failed to delete API key");
      }

      setSuccess("API key deleted successfully!");
      setHasKey(false);
      setApiKey("");
      setTimeout(() => {
        onClose();
        onSave?.();
      }, 1500);
    } catch (err) {
      setError(err.message || "Failed to delete API key");
    } finally {
      setIsSaving(false);
    }
  };

  const handleTest = async () => {
    if (!apiKey.trim()) {
      setError("Enter an API key to test");
      return;
    }

    setTestLoading(true);
    setError("");
    try {
      const response = await fetch("http://localhost:8000/llm/api-key-test", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ api_key: apiKey }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || "API key test failed");
      }

      setSuccess("✓ API key is valid and working!");
    } catch (err) {
      setError("✗ " + (err.message || "API key test failed"));
    } finally {
      setTestLoading(false);
    }
  };

  const inputClass =
    "w-full bg-[#0d1117] border border-[#1e2530] rounded-lg pl-9 pr-10 py-2.5 text-sm text-gray-300 placeholder-gray-600 focus:outline-none focus:border-blue-500";

  if (isLoading) {
    return (
      <div className="fixed inset-0 z-50 flex">
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
        <div className="relative z-10 m-auto bg-[#161b22] border border-[#1e2530] rounded-2xl w-[420px] shadow-2xl p-5">
          <div className="flex items-center justify-center gap-2 text-gray-400">
            <Loader2 size={18} className="animate-spin" />
            Loading...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative z-10 m-auto bg-[#161b22] border border-[#1e2530] rounded-2xl w-[420px] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-[#1e2530]">
          <div className="flex items-center gap-2">
            <Key size={18} className="text-blue-400" />
            <h2 className="text-white font-semibold text-base">
              {hasKey ? "Update Hugging Face API Key" : "Add Hugging Face API Key"}
            </h2>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white">
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSave} className="p-5 space-y-4">
          {/* Status Badge */}
          <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium ${
            hasKey
              ? "bg-green-500/20 text-green-300 border border-green-500/30"
              : "bg-amber-500/20 text-amber-300 border border-amber-500/30"
          }`}>
            <div className={`w-2 h-2 rounded-full ${hasKey ? "bg-green-400" : "bg-amber-400"}`} />
            {hasKey ? "API key configured" : "No API key configured"}
          </div>

          {/* Error Message */}
          {error && (
            <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-red-500/20 border border-red-500/30 text-red-300 text-xs">
              <AlertCircle size={14} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Success Message */}
          {success && (
            <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-green-500/20 border border-green-500/30 text-green-300 text-xs">
              <Check size={14} className="mt-0.5 shrink-0" />
              <span>{success}</span>
            </div>
          )}

          {/* API Key Input */}
          <div>
            <label className="text-xs text-gray-400 block mb-2">{hasKey ? "Update API key" : "Hugging Face API Key"}</label>
            <div className="relative">
              <Key className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={14} />
              <input
                type={showKey ? "text" : "password"}
                value={apiKey}
                onChange={(e) => {
                  setApiKey(e.target.value);
                  setError("");
                }}
                placeholder="hf_xxxxxxxxxxxxxxxxxxxxx"
                className={inputClass}
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
              >
                {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-1.5">
              Get your API key from <a href="https://huggingface.co/settings/tokens" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300">huggingface.co/settings/tokens</a>
            </p>
          </div>

          {/* Buttons */}
          <div className="flex items-center justify-between gap-3 pt-4 border-t border-[#1e2530]">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleTest}
                disabled={testLoading || isSaving || !apiKey.trim()}
                className="px-3 py-2 rounded-lg border border-slate-600 bg-slate-700/40 text-white text-xs font-medium hover:bg-slate-700/60 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 transition-all"
              >
                {testLoading && <Loader2 size={12} className="animate-spin" />}
                Test
              </button>
              {hasKey && (
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={isSaving}
                  className="px-3 py-2 rounded-lg border border-red-600/50 bg-red-600/20 text-red-300 text-xs font-medium hover:bg-red-600/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  Delete
                </button>
              )}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="py-2.5 px-4 bg-[#0d1117] border border-[#1e2530] text-gray-400 rounded-lg text-xs font-medium hover:text-gray-300 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving || !apiKey.trim()}
                className="py-2.5 px-4 bg-blue-600 hover:bg-blue-500 text-white rounded-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-medium transition-all"
              >
                {isSaving && <Loader2 size={14} className="animate-spin" />}
                {hasKey ? "Update" : "Save"} Key
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
