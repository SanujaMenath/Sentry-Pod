import React, { useState } from "react";
import { ChevronDown, ChevronUp, Copy, Check } from "lucide-react";
import { classifyLine } from "../utils/playbookOutput";
import { useCopyToClipboard } from "../hooks/useCopyToClipboard";

const ExpandableOutput = ({ output }) => {
  const [expanded, setExpanded] = useState(false);
  const { copied, handleCopy } = useCopyToClipboard();

  if (!output) return null;

  const lines = output.split("\n");
  const preview = lines.slice(0, 10);
  const hasMore = lines.length > preview.length;

  return (
    <div className="mt-3 rounded-xl border border-[#45475a] bg-[#1e1e2e] p-4 shadow-inner shadow-black/20">
      <div className="mb-3 flex items-center justify-between">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-2 text-sm text-[#cdd6f4] transition-colors hover:text-white"
        >
          {hasMore && (expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />)}
          <span className="font-mono text-xs">{lines.length} lines of output</span>
        </button>

        <button
          onClick={() => handleCopy(output)}
          className="flex items-center gap-2 rounded-lg bg-[#45475a]/50 px-3 py-1.5 text-xs text-[#cdd6f4] transition-all hover:bg-[#45475a] hover:text-white"
          title="Copy output to clipboard"
        >
          {copied ? (
            <>
              <Check size={14} />
              <span>Copied!</span>
            </>
          ) : (
            <>
              <Copy size={14} />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>

      <div className="max-h-72 overflow-auto rounded-lg border border-[#313244] bg-[#181825] p-3 font-mono text-xs leading-5">
        {(expanded ? lines : preview).map((line, index) => {
          const style = classifyLine(line);
          return (
            <div
              key={`${index}-${line}`}
              style={{ color: style.color, fontWeight: style.weight || 400 }}
              className="whitespace-pre-wrap-break-words"
            >
              {line}
            </div>
          );
        })}
        {hasMore && !expanded && (
          <div style={{ color: "#bac2de" }} className="mt-2 italic">
            ...expand to view the rest of the playbook output
          </div>
        )}
      </div>
    </div>
  );
};

export default ExpandableOutput;
