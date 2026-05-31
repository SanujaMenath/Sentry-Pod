import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import { useNavigate } from 'react-router-dom';

const DriftReportDetail = () => {
  const { hostname } = useParams();
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchDetail = async () => {
      try {
        const res = await fetch(`http://127.0.0.1:8000/playbooks/drift/${hostname}`);
        const data = await res.json();
        setContent(data.content || '');
      } catch (e) {
        console.error('Failed to load diff', e);
        setContent('Error loading diff');
      } finally {
        setLoading(false);
      }
    };
    if (hostname) fetchDetail();
  }, [hostname]);

  const renderDiff = (text) => {
    const lines = text.split(/\r?\n/);
    return (
      <div className="overflow-auto rounded border border-slate-800 bg-slate-900">
        <div className="sticky top-0 bg-slate-900 border-b border-slate-800 p-3 flex justify-between items-center">
          <div className="text-slate-100 text-sm font-bold">Diff: {hostname}</div>
          <div className="text-xs text-slate-400">{lines.length} lines</div>
        </div>
        <div className="p-4 font-mono text-sm text-slate-100">
          {lines.map((ln, idx) => {
            let lineTextClass = 'text-slate-300';
            let bgClass = '';

            if (ln.startsWith('+') && !ln.startsWith('+++')) {
              lineTextClass = 'text-emerald-400';
              bgClass = 'bg-emerald-500/6';
            }
            if (ln.startsWith('-') && !ln.startsWith('---')) {
              lineTextClass = 'text-rose-400';
              bgClass = 'bg-rose-500/6';
            }
            if (ln.startsWith('@@')) {
              lineTextClass = 'text-amber-400';
              bgClass = 'bg-amber-500/6';
            }
            if (ln.startsWith('+++') || ln.startsWith('---')) {
              lineTextClass = 'text-slate-400 italic';
            }

            return (
              <div key={idx} className={`flex gap-4 items-start py-1 ${bgClass} rounded-sm`}>
                <div className="w-12 text-slate-500 text-xs select-none">{String(idx+1).padStart(4,' ')}</div>
                <div className={`whitespace-pre-wrap break-words ${lineTextClass}`}>{ln === '' ? '\u00A0' : ln}</div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="flex-1 overflow-y-auto p-8" style={{ background: 'linear-gradient(135deg, #F8FAFC 0%, #D1D5DB 100%)' }}>
      <PageHeader title={`Drift: ${hostname}`} description={`Full diff report for ${hostname}`} />

      {loading ? (
        <div className="text-slate-400">Loading...</div>
      ) : (
        <>
          <div className="mb-4 flex gap-2">
            <button
              onClick={() => navigate('/drift-reports')}
              className="text-xs px-3 py-1 rounded bg-slate-800 text-amber-300 hover:bg-slate-700"
            >
              Close
            </button>
            <button
              onClick={() => navigator.clipboard?.writeText(content)}
              className="text-xs px-3 py-1 rounded bg-slate-800 text-slate-200 hover:bg-slate-700"
            >
              Copy
            </button>
          </div>

          {renderDiff(content)}
        </>
      )}
    </div>
  );
};

export default DriftReportDetail;
