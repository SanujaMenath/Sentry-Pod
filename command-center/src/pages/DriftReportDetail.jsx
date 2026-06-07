import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import DiffViewer from '../components/DiffViewer';
import { useNavigate } from 'react-router-dom';
import { Copy, ArrowLeft } from 'lucide-react';

const DriftReportDetail = () => {
  const { hostname } = useParams();
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
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

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-8" style={{ background: 'linear-gradient(135deg, #F8FAFC 0%, #D1D5DB 100%)' }}>
      <div className="mb-6">
        <PageHeader title={`Configuration Report: ${hostname}`} description={`Full diff report for ${hostname}`} />
      </div>

      {loading ? (
        <div className="text-slate-400">Loading...</div>
      ) : (
        <>
          {/* Actions */}
          <div className="mb-6 flex gap-2">
            <button
              onClick={() => navigate('/drift-reports')}
              className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg bg-slate-800 text-slate-200 hover:bg-slate-700 transition-colors border border-slate-700"
            >
              <ArrowLeft size={14} />
              Back to Reports
            </button>
            <button
              onClick={handleCopy}
              className={`flex items-center gap-2 text-xs px-3 py-2 rounded-lg transition-colors border ${
                copied
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                  : 'bg-slate-800 text-slate-200 hover:bg-slate-700 border-slate-700'
              }`}
            >
              <Copy size={14} />
              {copied ? 'Copied!' : 'Copy Diff'}
            </button>
          </div>

          {/* Full Diff Viewer */}
          <div className="bg-slate-900 rounded-lg border border-slate-800 p-4">
            {content ? (
              <DiffViewer diffContent={content} />
            ) : (
              <div className="text-slate-400 text-center py-8">No diff content available</div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default DriftReportDetail;
