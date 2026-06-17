import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, CheckCircle, AlertTriangle, ChevronLeft, ChevronRight, ShieldCheck, Key, Database, UserPlus, KeyRound } from "lucide-react";
import { getSetupStatus, previewSetup, applySetup, initUser, initCollections, generateSecret } from "../services/setupService";

const EMPTY_ROW = { hostname: "", ip: "", vlan_id: "", vlan_name: "", default_gateway: "" };
const INITIAL_CREDS = { ansible_user: "admin", ansible_password: "cisco", ansible_become_password: "", snmp_community: "public" };

const STEP_LABELS = ["Environment Setup", "Credentials", "Core Topology", "Access Layer", "Review & Apply"];

export default function SetupWizard() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  const [creds, setCreds] = useState(INITIAL_CREDS);
  const [edgeRouters, setEdgeRouters] = useState([{ hostname: "", ip: "" }]);
  const [coreSwitches, setCoreSwitches] = useState([{ hostname: "", ip: "" }]);
  const [distSwitches, setDistSwitches] = useState([{ hostname: "", ip: "" }]);
  const [hsrpPairs, setHsrpPairs] = useState([]);
  const [accessSwitches, setAccessSwitches] = useState([{ ...EMPTY_ROW }]);

  const [envUser, setEnvUser] = useState({ username: "", password: "", email: "", full_name: "" });
  const [envUserResult, setEnvUserResult] = useState(null);
  const [envUserBusy, setEnvUserBusy] = useState(false);
  const [envCollectionsResult, setEnvCollectionsResult] = useState(null);
  const [envCollectionsBusy, setEnvCollectionsBusy] = useState(false);
  const [envHfKey, setEnvHfKey] = useState("");
  const [envHfResult, setEnvHfResult] = useState(null);
  const [envHfBusy, setEnvHfBusy] = useState(false);
  const [envSecretResult, setEnvSecretResult] = useState(null);
  const [envSecretBusy, setEnvSecretBusy] = useState(false);

  useEffect(() => {
    getSetupStatus()
      .then((data) => {
        if (data.setup_complete && !data.is_demo) {
          navigate("/dashboard", { replace: true });
          return;
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [navigate]);

  const buildPayload = useCallback(() => ({
    global_creds: creds,
    edge_routers: edgeRouters.filter((r) => r.hostname && r.ip),
    core_switches: coreSwitches.filter((r) => r.hostname && r.ip),
    distribution_switches: distSwitches.filter((r) => r.hostname && r.ip),
    hsrp_pairs: hsrpPairs,
    access_switches: accessSwitches.filter((r) => r.hostname && r.ip).map((r) => ({
      hostname: r.hostname,
      ip: r.ip,
      vlan_id: r.vlan_id ? Number(r.vlan_id) : null,
      vlan_name: r.vlan_name || null,
      default_gateway: r.default_gateway || null,
    })),
  }), [creds, edgeRouters, coreSwitches, distSwitches, hsrpPairs, accessSwitches]);

  const handlePreview = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const data = await previewSetup(buildPayload());
      setResult(data);
      setStep(4);
    } catch (err) {
      setError(err?.message || "Preview failed");
    } finally {
      setSubmitting(false);
    }
  };

  const handleApply = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const payload = { ...buildPayload(), flush_mongo: true, flush_disk: true };
      const data = await applySetup(payload);
      setResult((prev) => ({ ...prev, apply_result: data }));
    } catch (err) {
      setError(err?.message || "Apply failed");
    } finally {
      setSubmitting(false);
    }
  };

  const addRow = (setter, template) => setter((prev) => [...prev, { ...template }]);
  const removeRow = (setter, idx) => setter((prev) => prev.filter((_, i) => i !== idx));
  const updateRow = (setter, idx, field, value) =>
    setter((prev) => prev.map((r, i) => (i === idx ? { ...r, [field]: value } : r)));

  const toggleHsrp = (hostname) =>
    setHsrpPairs((prev) =>
      prev.includes(hostname) ? prev.filter((h) => h !== hostname) : [...prev, hostname]
    );

  const markdownToHtml = (md) => {
    let html = md
      .replace(/^### (.+)$/gm, "<h3 class='text-lg font-bold text-white mt-6 mb-2'>$1</h3>")
      .replace(/^## (.+)$/gm, "<h2 class='text-xl font-bold text-white mt-6 mb-3'>$1</h2>")
      .replace(/^# (.+)$/gm, "<h1 class='text-2xl font-bold text-white mt-6 mb-3'>$1</h1>")
      .replace(/\*\*(.+?)\*\*/g, "<strong class='text-white'>$1</strong>")
      .replace(/^(\|.+\|)$/gm, (m) => {
        const rows = m.split("\n").filter((l) => l.trim());
        const tableRows = rows.map((r) => {
          const cells = r.split("|").filter((c) => c.trim());
          if (cells.every((c) => /^[-]+$/.test(c.trim()))) return null;
          return `<tr>${cells.map((c) => `<td class='px-3 py-1 text-slate-300'>${c.trim()}</td>`).join("")}</tr>`;
        }).filter(Boolean);
        return `<table class='w-full text-sm mb-4'>${tableRows.join("")}</table>`;
      })
      .replace(/^- (.+)$/gm, "<li class='text-slate-300 ml-4 list-disc'>$1</li>")
      .replace(/^```ini\n([\s\S]*?)```$/gm, "<pre class='bg-[#0D121F] p-4 rounded-lg text-sm text-green-400 overflow-x-auto mb-4'>$1</pre>")
      .replace(/^---$/gm, "<hr class='border-slate-700 my-6' />")
      .replace(/\n\n/g, "<br/><br/>");
    return html;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#020618]">
        <Loader2 className="animate-spin text-blue-500" size={40} />
      </div>
    );
  }

  const pageStyle = { background: "linear-gradient(135deg, #020618 0%, #1D293D 45%, #475569 100%)", backgroundAttachment: "fixed" };

  return (
    <div className="min-h-screen flex flex-col" style={pageStyle}>
      <div className="flex-1 overflow-auto px-6 py-8 max-w-5xl mx-auto w-full">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-white">Welcome to Sentry-Pod</h1>
          <p className="text-slate-400 mt-1">Configure your network in a few steps</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/50 text-red-500 rounded-lg text-sm">
            {error}
          </div>
        )}

        {result?.apply_result?.status === "success" ? (
          <div className="text-center py-12">
            <CheckCircle className="mx-auto text-emerald-500" size={64} />
            <h2 className="text-2xl font-bold text-white mt-4">Setup Complete</h2>
            <p className="text-slate-400 mt-2">{result.apply_result.message}</p>
            <p className="text-slate-500 text-sm mt-1">Report saved to {result.apply_result.report_path}</p>
            <button
              onClick={() => navigate("/dashboard")}
              className="mt-8 px-8 py-3 bg-[#155DFC] hover:bg-blue-600 text-white font-bold rounded-lg transition-all"
            >
              Go to Dashboard
            </button>
          </div>
        ) : result && step === 4 ? (
          <div>
            <div
              className="bg-[#111827]/80 backdrop-blur-xl p-6 rounded-2xl border border-slate-800 prose prose-invert max-w-none overflow-auto max-h-[60vh]"
              dangerouslySetInnerHTML={{ __html: markdownToHtml(result.report_markdown) }}
            />
            <div className="flex justify-between mt-6">
              <button onClick={() => setStep(3)} className="px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-all flex items-center gap-2">
                <ChevronLeft size={18} /> Back
              </button>
              <button
                onClick={handleApply}
                disabled={submitting}
                className="px-8 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg transition-all flex items-center gap-2 disabled:opacity-50"
              >
                {submitting ? <Loader2 className="animate-spin" size={18} /> : <CheckCircle size={18} />}
                Apply Configuration
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-[#111827]/80 backdrop-blur-xl p-8 rounded-2xl border border-slate-800">
            <div className="flex items-center justify-between mb-8">
              {STEP_LABELS.map((label, i) => (
                <div key={label} className="flex items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                    i === step ? "bg-[#155DFC] text-white" : i < step ? "bg-emerald-600 text-white" : "bg-slate-700 text-slate-400"
                  }`}>
                    {i < step ? <CheckCircle size={16} /> : i + 1}
                  </div>
                  <span className={`ml-2 text-sm hidden sm:inline ${i === step ? "text-white font-semibold" : "text-slate-500"}`}>
                    {label}
                  </span>
                  {i < STEP_LABELS.length - 1 && <div className="w-12 h-px bg-slate-700 mx-3 hidden sm:block" />}
                </div>
              ))}
            </div>

            {step === 0 && (
              <div className="space-y-5">
                <h2 className="text-lg font-bold text-white">Environment Setup</h2>
                <p className="text-slate-400 text-sm">Optional pre-flight checks. Each section is independent — check what you need and apply.</p>

                <div className="p-4 bg-[#0D121F] border border-slate-700 rounded-lg">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <UserPlus className="text-blue-400" size={18} />
                      <h3 className="text-sm font-bold text-white">Create Admin User</h3>
                    </div>
                    {envUserResult?.status === "created" && <CheckCircle className="text-emerald-500" size={18} />}
                  </div>
                  {envUserResult?.status === "skipped" ? (
                    <p className="text-xs text-slate-400">{envUserResult.message}</p>
                  ) : envUserResult?.status === "created" ? (
                    <p className="text-xs text-emerald-400">{envUserResult.message}</p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <input placeholder="Username" value={envUser.username} onChange={(e) => setEnvUser((u) => ({ ...u, username: e.target.value }))}
                        className="bg-[#111827] border border-slate-700 rounded px-3 py-2 text-white text-sm" />
                      <input type="password" placeholder="Password" value={envUser.password} onChange={(e) => setEnvUser((u) => ({ ...u, password: e.target.value }))}
                        className="bg-[#111827] border border-slate-700 rounded px-3 py-2 text-white text-sm" />
                      <input placeholder="Email" value={envUser.email} onChange={(e) => setEnvUser((u) => ({ ...u, email: e.target.value }))}
                        className="bg-[#111827] border border-slate-700 rounded px-3 py-2 text-white text-sm" />
                      <input placeholder="Full Name" value={envUser.full_name} onChange={(e) => setEnvUser((u) => ({ ...u, full_name: e.target.value }))}
                        className="bg-[#111827] border border-slate-700 rounded px-3 py-2 text-white text-sm" />
                      <button onClick={async () => {
                        setEnvUserBusy(true); setEnvUserResult(null);
                        try { setEnvUserResult(await initUser(envUser)); } catch (e) { setEnvUserResult({ status: "error", message: e.message }); }
                        finally { setEnvUserBusy(false); }
                      }} disabled={envUserBusy || !envUser.username || !envUser.password}
                        className="col-span-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold rounded-lg disabled:opacity-50 transition-all">
                        {envUserBusy ? <Loader2 className="animate-spin inline" size={14} /> : "Create Admin User"}
                      </button>
                    </div>
                  )}
                </div>

                <div className="p-4 bg-[#0D121F] border border-slate-700 rounded-lg">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Database className="text-emerald-400" size={18} />
                      <h3 className="text-sm font-bold text-white">Initialize Database</h3>
                    </div>
                    {envCollectionsResult?.status === "success" && <CheckCircle className="text-emerald-500" size={18} />}
                  </div>
                  <p className="text-xs text-slate-400 mb-3">Ensures all required MongoDB collections and indexes exist.</p>
                  {envCollectionsResult ? (
                    <div className="text-xs space-y-1">
                      {envCollectionsResult.collections_created?.length > 0 && (
                        <p className="text-emerald-400">Collections created: {envCollectionsResult.collections_created.join(", ")}</p>
                      )}
                      {envCollectionsResult.indexes_created?.length > 0 && (
                        <p className="text-emerald-400">Indexes created: {envCollectionsResult.indexes_created.join(", ")}</p>
                      )}
                      {!envCollectionsResult.collections_created?.length && !envCollectionsResult.indexes_created?.length && (
                        <p className="text-slate-400">All collections and indexes already exist.</p>
                      )}
                    </div>
                  ) : (
                    <button onClick={async () => {
                      setEnvCollectionsBusy(true);
                      try { setEnvCollectionsResult(await initCollections()); } catch (e) { setEnvCollectionsResult({ status: "error", message: e.message }); }
                      finally { setEnvCollectionsBusy(false); }
                    }} disabled={envCollectionsBusy}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold rounded-lg disabled:opacity-50 transition-all">
                      {envCollectionsBusy ? <Loader2 className="animate-spin inline" size={14} /> : "Initialize Collections"}
                    </button>
                  )}
                </div>

                <div className="p-4 bg-[#0D121F] border border-slate-700 rounded-lg">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Key className="text-purple-400" size={18} />
                      <h3 className="text-sm font-bold text-white">HuggingFace API Key</h3>
                    </div>
                    {envHfResult?.status === "success" && <CheckCircle className="text-emerald-500" size={18} />}
                  </div>
                  <p className="text-xs text-slate-400 mb-3">Required for LLM chat to work. Stored in both MongoDB and .env.</p>
                  {envHfResult?.status === "success" ? (
                    <p className="text-xs text-emerald-400">API key configured successfully!</p>
                  ) : (
                    <div className="flex gap-2">
                      <input type="password" placeholder="hf_..." value={envHfKey} onChange={(e) => setEnvHfKey(e.target.value)}
                        className="flex-1 bg-[#111827] border border-slate-700 rounded px-3 py-2 text-white text-sm" />
                      <button onClick={async () => {
                        setEnvHfBusy(true); setEnvHfResult(null);
                        try {
                          const res = await fetch(`${import.meta.env.VITE_API_BASE_URL || "http://localhost:8000"}/llm/api-key-test`, {
                            method: "POST", headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ api_key: envHfKey }),
                          });
                          const data = await res.json();
                          if (res.ok) {
                            await fetch(`${import.meta.env.VITE_API_BASE_URL || "http://localhost:8000"}/llm/api-key`, {
                              method: "POST", headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ api_key: envHfKey }),
                            });
                            setEnvHfResult({ status: "success", message: "API key tested and saved" });
                          } else {
                            setEnvHfResult({ status: "error", message: data.detail || "Key rejected" });
                          }
                        } catch (e) { setEnvHfResult({ status: "error", message: e.message }); }
                        finally { setEnvHfBusy(false); }
                      }} disabled={envHfBusy || !envHfKey}
                        className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-sm font-bold rounded-lg disabled:opacity-50 transition-all">
                        {envHfBusy ? <Loader2 className="animate-spin inline" size={14} /> : "Test & Save"}
                      </button>
                    </div>
                  )}
                  {envHfResult?.status === "error" && (
                    <p className="text-xs text-red-400 mt-2">{envHfResult.message}</p>
                  )}
                </div>

                <div className="p-4 bg-[#0D121F] border border-slate-700 rounded-lg">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <KeyRound className="text-amber-400" size={18} />
                      <h3 className="text-sm font-bold text-white">JWT Secret</h3>
                    </div>
                    {envSecretResult?.status === "generated" && <CheckCircle className="text-emerald-500" size={18} />}
                  </div>
                  <p className="text-xs text-slate-400 mb-3">Generate a random secret key for JWT token signing.</p>
                  {envSecretResult?.status === "generated" ? (
                    <p className="text-xs text-emerald-400">New JWT secret generated and saved to .env</p>
                  ) : (
                    <button onClick={async () => {
                      setEnvSecretBusy(true);
                      try { setEnvSecretResult(await generateSecret()); } catch (e) { setEnvSecretResult({ status: "error", message: e.message }); }
                      finally { setEnvSecretBusy(false); }
                    }} disabled={envSecretBusy}
                      className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white text-sm font-bold rounded-lg disabled:opacity-50 transition-all">
                      {envSecretBusy ? <Loader2 className="animate-spin inline" size={14} /> : "Generate Secret"}
                    </button>
                  )}
                </div>
              </div>
            )}

            {step === 1 && (
              <div className="space-y-5">
                <h2 className="text-lg font-bold text-white">Global Credentials</h2>
                <p className="text-slate-400 text-sm">These credentials are used for all devices. You can override per-device later.</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-300 mb-1">SSH Username</label>
                    <input value={creds.ansible_user} onChange={(e) => setCreds((c) => ({ ...c, ansible_user: e.target.value }))}
                      className="w-full bg-[#0D121F] border border-slate-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-300 mb-1">SSH Password</label>
                    <input type="password" value={creds.ansible_password} onChange={(e) => setCreds((c) => ({ ...c, ansible_password: e.target.value }))}
                      className="w-full bg-[#0D121F] border border-slate-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-300 mb-1">Enable Secret (optional)</label>
                    <input type="password" value={creds.ansible_become_password} onChange={(e) => setCreds((c) => ({ ...c, ansible_become_password: e.target.value }))}
                      className="w-full bg-[#0D121F] border border-slate-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-300 mb-1">SNMP Read Community</label>
                    <input value={creds.snmp_community} onChange={(e) => setCreds((c) => ({ ...c, snmp_community: e.target.value }))}
                      className="w-full bg-[#0D121F] border border-slate-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50" />
                  </div>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-8">
                <h2 className="text-lg font-bold text-white">Core Topology</h2>
                <p className="text-slate-400 text-sm">Map your network into the three-tier model. Hostnames and IPs only — vars come later.</p>

                <Section title="Edge Routers" onAdd={() => addRow(setEdgeRouters, { hostname: "", ip: "" })}>
                  <TableHeader />
                  {edgeRouters.map((r, i) => (
                    <DeviceRow key={i} idx={i} row={r} onChange={(f, v) => updateRow(setEdgeRouters, i, f, v)}
                      onRemove={() => removeRow(setEdgeRouters, i)} canRemove={edgeRouters.length > 1} />
                  ))}
                </Section>

                <Section title="Core Switches" onAdd={() => addRow(setCoreSwitches, { hostname: "", ip: "" })}>
                  <TableHeader />
                  {coreSwitches.map((r, i) => (
                    <DeviceRow key={i} idx={i} row={r} onChange={(f, v) => updateRow(setCoreSwitches, i, f, v)}
                      onRemove={() => removeRow(setCoreSwitches, i)} canRemove={coreSwitches.length > 1} />
                  ))}
                </Section>

                <Section title="Distribution Switches" onAdd={() => addRow(setDistSwitches, { hostname: "", ip: "" })}>
                  <TableHeader />
                  {distSwitches.map((r, i) => (
                    <DeviceRow key={i} idx={i} row={r} onChange={(f, v) => updateRow(setDistSwitches, i, f, v)}
                      onRemove={() => removeRow(setDistSwitches, i)} canRemove={distSwitches.length > 1} />
                  ))}
                  <div className="mt-4 p-4 bg-[#0D121F] border border-slate-700 rounded-lg">
                    <h4 className="text-sm font-semibold text-slate-300 mb-2">HSRP Pairs</h4>
                    <p className="text-slate-500 text-xs mb-3">Check the distribution switches that are HSRP pairs for redundancy.</p>
                    <div className="flex flex-wrap gap-3">
                      {distSwitches.filter((d) => d.hostname).map((d) => (
                        <label key={d.hostname} className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                          <input type="checkbox" checked={hsrpPairs.includes(d.hostname)}
                            onChange={() => toggleHsrp(d.hostname)}
                            className="accent-[#155DFC]" />
                          {d.hostname}
                        </label>
                      ))}
                    </div>
                  </div>
                </Section>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-5">
                <Section title="Access Switches" onAdd={() => addRow(setAccessSwitches, { ...EMPTY_ROW })}>
                  <div className="grid grid-cols-5 gap-2 text-xs font-semibold text-slate-500 uppercase mb-2 px-2">
                    <span>Hostname</span>
                    <span>IP</span>
                    <span>VLAN ID</span>
                    <span>VLAN Name</span>
                    <span>Default Gateway</span>
                  </div>
                  {accessSwitches.map((r, i) => (
                    <div key={i} className="grid grid-cols-5 gap-2 mb-2">
                      <input placeholder="ESW7" value={r.hostname} onChange={(e) => updateRow(setAccessSwitches, i, "hostname", e.target.value)}
                        className="bg-[#0D121F] border border-slate-700 rounded px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50" />
                      <input placeholder="10.1.99.7" value={r.ip} onChange={(e) => updateRow(setAccessSwitches, i, "ip", e.target.value)}
                        className="bg-[#0D121F] border border-slate-700 rounded px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50" />
                      <input placeholder="7" value={r.vlan_id} onChange={(e) => updateRow(setAccessSwitches, i, "vlan_id", e.target.value)}
                        className="bg-[#0D121F] border border-slate-700 rounded px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50" />
                      <input placeholder="Computing" value={r.vlan_name} onChange={(e) => updateRow(setAccessSwitches, i, "vlan_name", e.target.value)}
                        className="bg-[#0D121F] border border-slate-700 rounded px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50" />
                      <div className="flex gap-1">
                        <input placeholder="10.1.7.3" value={r.default_gateway} onChange={(e) => updateRow(setAccessSwitches, i, "default_gateway", e.target.value)}
                          className="flex-1 bg-[#0D121F] border border-slate-700 rounded px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50" />
                        {accessSwitches.length > 1 && (
                          <button onClick={() => removeRow(setAccessSwitches, i)}
                            className="text-red-500 hover:text-red-400 px-1 text-lg leading-none">&times;</button>
                        )}
                      </div>
                    </div>
                  ))}
                </Section>
              </div>
            )}

            <div className="flex justify-between mt-8">
              {step > 0 ? (
                <button onClick={() => setStep(step - 1)} className="px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-all flex items-center gap-2">
                  <ChevronLeft size={18} /> Back
                </button>
              ) : (
                <div />
              )}
              {step < 3 ? (
                <button onClick={() => setStep(step + 1)} className="px-6 py-3 bg-[#155DFC] hover:bg-blue-600 text-white font-bold rounded-lg transition-all flex items-center gap-2">
                  Next <ChevronRight size={18} />
                </button>
              ) : step === 3 ? (
                <button onClick={handlePreview} disabled={submitting}
                  className="px-6 py-3 bg-[#155DFC] hover:bg-blue-600 text-white font-bold rounded-lg transition-all flex items-center gap-2 disabled:opacity-50">
                  {submitting ? <Loader2 className="animate-spin" size={18} /> : null}
                  Preview Configuration
                </button>
              ) : null}
            </div>
          </div>
        )}

        {result?.apply_result?.status !== "success" && (
          <div className="mt-8 pt-6 border-t border-slate-800/50 flex gap-3 justify-center">
            <ShieldCheck className="text-emerald-500 shrink-0" size={18} />
            <p className="text-xs text-slate-500">All changes are previewed before applying. Report saved to <code className="text-slate-400">docs/</code>.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function Section({ title, onAdd, children }) {
  return (
    <div className="p-4 bg-[#0D121F] border border-slate-700 rounded-lg">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-white">{title}</h3>
        <button onClick={onAdd} className="text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 px-3 py-1 rounded transition-all">
          + Add Device
        </button>
      </div>
      {children}
    </div>
  );
}

function TableHeader() {
  return (
    <div className="grid grid-cols-2 gap-2 text-xs font-semibold text-slate-500 uppercase mb-2 px-2">
      <span>Hostname</span>
      <span>IP Address</span>
    </div>
  );
}

function DeviceRow({ row, onChange, onRemove, canRemove }) {
  return (
    <div className="grid grid-cols-2 gap-2 mb-2">
      <input placeholder="R1" value={row.hostname} onChange={(e) => onChange("hostname", e.target.value)}
        className="bg-[#111827] border border-slate-700 rounded px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50" />
      <div className="flex gap-1">
        <input placeholder="192.168.1.1" value={row.ip} onChange={(e) => onChange("ip", e.target.value)}
          className="flex-1 bg-[#111827] border border-slate-700 rounded px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50" />
        {canRemove && (
          <button onClick={onRemove} className="text-red-500 hover:text-red-400 px-1 text-lg leading-none">&times;</button>
        )}
      </div>
    </div>
  );
}
