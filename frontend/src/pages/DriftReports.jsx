import React, { useEffect, useState } from 'react';
import PageHeader from '../components/PageHeader';
import DiffViewer from '../components/DiffViewer';
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
        <div className="grid gap-6">
          {reports.length === 0 && <div className="text-slate-400">No drifts detected</div>}
          {reports.map((r) => (
            <div key={r.hostname} className="rounded-lg bg-slate-900 border border-slate-800 overflow-hidden">
              {/* Header */}
              <div className="p-4 border-b border-slate-800 flex justify-between items-start">
                <div>
                  <h4 className="text-slate-200 font-bold text-lg">{r.hostname}</h4>
                  <div className="text-slate-500 text-sm mt-1">Updated {new Date(r.mtime * 1000).toLocaleString()}</div>
                </div>
                <Link to={`/drift-reports/${r.hostname}`} className="text-xs text-amber-300 hover:text-amber-200 underline whitespace-nowrap ml-4">
                  View full report →
                </Link>
              </div>

              {/* Compact Diff Preview */}
              <div className="p-4">
                {r.diff_content ? (
                  <DiffViewer diffContent={r.diff_content} compact={true} maxLines={8} />
                ) : (
                  <div className="text-slate-400 text-sm">Diff content unavailable</div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default DriftReports;
