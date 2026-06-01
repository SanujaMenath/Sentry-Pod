import React, { useMemo } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { parseDiff, getDiffSummary } from '../utils/diffParser';

/**
 * DiffViewer - Clean git-style diff viewer
 * Shows changes in context with proper formatting
 */
export default function DiffViewer({ diffContent, compact = false, maxLines = null }) {
  const diff = useMemo(() => parseDiff(diffContent), [diffContent]);
  const stats = useMemo(() => getDiffSummary(diff), [diff]);

  if (!diff.hunks.length) {
    return (
      <div className="p-4 text-sm text-slate-400 rounded-lg border border-slate-800 bg-slate-900/50">
        No differences detected
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary Header */}
      <div className="flex items-center gap-6 p-4 rounded-lg bg-slate-900/30 border border-slate-800 text-sm">
        <div>
          <span className="text-emerald-400 font-semibold">
            +{stats.totalAdditions}
          </span>
          <span className="text-slate-400 mx-2">•</span>
          <span className="text-rose-400 font-semibold">
            -{stats.totalRemovals}
          </span>
        </div>
        <div className="text-slate-500">
          {stats.hunksCount} change{stats.hunksCount !== 1 ? 's' : ''}
        </div>
      </div>

      {/* File Headers */}
      <div className="text-xs text-slate-400 space-y-1">
        <div>
          <span className="text-rose-400">−</span> {diff.fromFile}
        </div>
        <div>
          <span className="text-emerald-400">+</span> {diff.toFile}
        </div>
      </div>

      {/* Hunks */}
      <div className="space-y-4">
        {diff.hunks.map((hunk, hunkIdx) => {
          const hunkStats = hunk.getStats();
          const displayLines = maxLines
            ? hunk.lines.slice(0, maxLines)
            : hunk.lines;
          const isLimitedLines =
            maxLines && hunk.lines.length > maxLines;

          return (
            <div
              key={hunkIdx}
              className="border border-slate-800 rounded-lg overflow-hidden bg-slate-900/50"
            >
              {/* Hunk Header */}
              <div className="bg-slate-900 border-b border-slate-800 px-4 py-2 flex items-center justify-between sticky top-0 z-10">
                <code className="text-xs font-mono text-amber-400">
                  {hunk.header}
                </code>
                <div className="text-xs text-slate-500">
                  <span className="text-emerald-400 font-semibold">
                    +{hunkStats.additions}
                  </span>
                  <span className="mx-1">•</span>
                  <span className="text-rose-400 font-semibold">
                    -{hunkStats.removals}
                  </span>
                </div>
              </div>

              {/* Diff Lines */}
              <div className="font-mono text-xs">
                {displayLines.map((diffLine, idx) => {
                  let lineClass = 'bg-slate-900/30 text-slate-300';
                  let prefix = ' ';

                  if (diffLine.type === 'addition') {
                    lineClass = 'bg-emerald-500/10 text-emerald-300';
                    prefix = '+';
                  } else if (diffLine.type === 'removal') {
                    lineClass = 'bg-rose-500/10 text-rose-300';
                    prefix = '−';
                  } else if (diffLine.type === 'context') {
                    lineClass = 'bg-slate-900/20 text-slate-400';
                    prefix = ' ';
                  }

                  return (
                    <div
                      key={`${hunkIdx}-${idx}`}
                      className={`flex gap-3 px-4 py-1 border-l-2 ${
                        diffLine.type === 'addition'
                          ? 'border-emerald-500/30'
                          : diffLine.type === 'removal'
                          ? 'border-rose-500/30'
                          : 'border-slate-700'
                      } ${lineClass}`}
                    >
                      <span className="w-6 text-slate-600 select-none flex-shrink-0">
                        {prefix}
                      </span>
                      <code className="flex-1 whitespace-pre-wrap break-words">
                        {diffLine.content || '\u00A0'}
                      </code>
                    </div>
                  );
                })}

                {isLimitedLines && (
                  <div className="px-4 py-2 text-slate-500 italic text-xs bg-slate-900/30 border-l-2 border-slate-700">
                    ... and {hunk.lines.length - maxLines} more lines
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
