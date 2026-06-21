import React from "react";
import { Zap, Play, Edit3 } from "lucide-react";

const PlaybookSuggestions = ({ suggestions, onExecute, onModify }) => {
  if (!suggestions || suggestions.length === 0) return null;

  return (
    <div className="mt-4 rounded-xl border border-[#45475a] bg-[#313244]/40 p-4">
      <div className="mb-3 flex items-center gap-2">
        <Zap size={16} className="text-[#f9e2af]" />
        <span className="text-sm font-semibold text-[#f9e2af]">Available Playbooks</span>
      </div>
      <div className="space-y-2">
        {suggestions.map((suggestion) => (
          <div
            key={suggestion.filename}
            className="flex items-start justify-between rounded-lg border border-[#45475a]/50 bg-[#1e1e2e] p-3"
          >
            <div className="flex-1 min-w-0">
              <h4 className="mb-1 text-sm font-semibold text-[#cdd6f4]">{suggestion.name}</h4>
              <p className="mb-2 text-xs text-[#bac2de]">{suggestion.description}</p>
              {suggestion.playbook_preview && (
                <p className="mb-2 text-xs text-[#a6e3a1] italic">{suggestion.playbook_preview}</p>
              )}
              <div className="flex flex-wrap gap-1">
                {(suggestion.tags || []).slice(0, 3).map((tag) => (
                  <span key={tag} className="inline-block rounded bg-[#45475a]/50 px-2 py-0.5 text-xs text-[#89dceb]">
                    {tag}
                  </span>
                ))}
              </div>
              <p className="mt-2 text-xs text-[#6c7086]">Match: {suggestion.reason}</p>
            </div>
            <div className="ml-3 flex shrink-0 flex-col gap-2">
              <button
                onClick={() => onExecute(suggestion)}
                className="flex items-center gap-2 whitespace-nowrap rounded-lg border border-blue-600/50 bg-blue-600/20 px-3 py-2 text-xs text-blue-300 transition-colors hover:bg-blue-600/30"
              >
                <Play size={14} />
                <span>Run</span>
              </button>
              {onModify && suggestion.modification_potential && (
                <button
                  onClick={() => onModify(suggestion)}
                  className="flex items-center gap-2 whitespace-nowrap rounded-lg border border-violet-600/50 bg-violet-600/20 px-3 py-2 text-xs text-violet-300 transition-colors hover:bg-violet-600/30"
                >
                  <Edit3 size={14} />
                  <span>Modify</span>
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PlaybookSuggestions;
