import React, { useEffect, useState } from 'react';
import PageHeader from '../components/PageHeader';
import DiffViewer from '../components/DiffViewer';
import { Link, useOutletContext } from 'react-router-dom';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000';

const DriftReports = () => {
  const { search } = useOutletContext() || { search: "" };
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDrift = async () => {
      try {
        const res = await fetch(`${API_BASE}/playbooks/drift`);
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

  const query = search ? search.trim().toLowerCase() : "";

  const filteredReports = reports.filter((r) => {
    if (!query) return true;
    return (
      r.hostname?.toLowerCase().includes(query) ||
      r.diff_content?.toLowerCase().includes(query)
    );
  });

  

 return (
    <div 
  className="min-h-screen w-full flex-1 overflow-y-auto p-8 font-sans" 
  style={{ 
    background: 'linear-gradient(135deg, #F8FAFC 0%, #D1D5DB 100%)',
    backgroundAttachment: 'fixed'
  }}
>
      <PageHeader 
  title="Configuration Drift Reports" 
  description="List of devices with detected configuration drift" 
  isSmallSubtext={true}
  textColor="#0F172A"
  subtextColor="#475569"
/>

      {loading ? (
        <div className="text-slate-400">Loading...</div>
      ) : (
        <div className="grid gap-6">
          {filteredReports.length === 0 ? (
              <div className="bg-[#1D293DED] border border-slate-700/50 rounded-3xl p-12 shadow-[0_5px_15px_rgba(0,0,0,0.6)] text-center">
                <p className="text-slate-400 text-sm font-medium">
                  {query ? `No drift reports matching "${search}"` : "No configuration drift detected"}
                </p>
              </div>
            ) : (
            filteredReports.map((r) => (
              <div 
                key={r.hostname} 
                className="rounded-3xl bg-[#1D293DED] border border-slate-700/50 shadow-[0_5px_15px_rgba(0,0,0,0.6)] overflow-hidden"
              >
                {/* Header */}
                <div className="p-6 border-b border-slate-800/50 flex justify-between items-center">
                  <div>
                    <h4 className="text-slate-100 font-bold text-lg">{r.hostname}</h4>
                    <div className="text-slate-400 text-xs mt-1 font-medium">
                      Updated {new Date(r.mtime * 1000).toLocaleString()}
                    </div>
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
          ))
        )}
        </div>
      )}
    </div>
  );
};

export default DriftReports;
