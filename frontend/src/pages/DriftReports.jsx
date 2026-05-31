import React, { useEffect, useState } from 'react';
import PageHeader from '../components/PageHeader';
import { Link } from 'react-router-dom';

const DriftReports = () => {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDrift = async () => {
      try {
        const res = await fetch('http://127.0.0.1:8000/playbooks/drift');
        const data = await res.json();
        setReports(data.reports || []);
      } catch (e) {
        console.error('Failed to load drift reports', e);
      } finally {
        setLoading(false);
      }
    };
    fetchDrift();
  }, []);

  return (
    <div className="flex-1 overflow-y-auto p-8" style={{ background: 'linear-gradient(135deg, #F8FAFC 0%, #D1D5DB 100%)' }}>
      <PageHeader title="Configuration Drift Reports" description="List of devices with detected configuration drift" />

      {loading ? (
        <div className="text-slate-400">Loading...</div>
      ) : (
        <div className="grid gap-4">
          {reports.length === 0 && <div className="text-slate-400">No drifts detected</div>}
          {reports.map((r) => (
            <div key={r.hostname} className="p-4 rounded-lg bg-slate-900 border border-slate-800">
              <div className="flex justify-between">
                <div>
                  <h4 className="text-slate-200 font-bold">{r.hostname}</h4>
                  <div className="text-slate-500 text-sm">Updated {new Date(r.mtime * 1000).toLocaleString()}</div>
                </div>
                <div className="text-sm text-slate-400">Added: {r.additions.length} • Removed: {r.removals.length}</div>
              </div>
              <div className="mt-3">
                <Link to={`/drift-reports/${r.hostname}`} className="text-xs text-amber-300 underline">View full diff</Link>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-4 text-[12px] font-mono">
                <div className="bg-slate-800 p-3 rounded">
                  <div className="text-emerald-400 text-xs mb-2">Additions</div>
                  <div className="max-h-48 overflow-auto">
                    {r.additions.length === 0 && <div className="text-slate-500">(none)</div>}
                    {r.additions.map((l, i) => (
                      <div key={i} className="text-emerald-300 mb-1">+ {l}</div>
                    ))}
                  </div>
                </div>

                <div className="bg-slate-800 p-3 rounded">
                  <div className="text-rose-400 text-xs mb-2">Removals</div>
                  <div className="max-h-48 overflow-auto">
                    {r.removals.length === 0 && <div className="text-slate-500">(none)</div>}
                    {r.removals.map((l, i) => (
                      <div key={i} className="text-rose-300 mb-1">- {l}</div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default DriftReports;
