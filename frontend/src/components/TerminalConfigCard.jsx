import { useState } from "react";
import { useTerminalConfig } from "../hooks/useTerminalConfig";
import { COLOR_SCHEMES, FONT_FAMILIES, CURSOR_STYLES, resolveTheme, getSwatchColors } from "../config/terminalThemes";
import { Terminal, Monitor, Minus, Plus, ChevronDown } from "lucide-react";

const TABS = [
  { key: "ssh", label: "SSH Terminal", icon: Terminal },
  { key: "console", label: "Console", icon: Monitor },
];

function Swatch({ colors }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: colors[0] }} />
      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: colors[1] }} />
      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: colors[2] }} />
      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: colors[3] }} />
    </div>
  );
}

export default function TerminalConfigCard() {
  const { sshConfig, consoleConfig, updateSshConfig, updateConsoleConfig } = useTerminalConfig();
  const [activeTab, setActiveTab] = useState("ssh");
  const [flavorScheme, setFlavorScheme] = useState(null);

  const config = activeTab === "ssh" ? sshConfig : consoleConfig;
  const updateConfig = activeTab === "ssh" ? updateSshConfig : updateConsoleConfig;
  const resolved = resolveTheme(config.colorScheme);

  function handleSchemeClick(key, entry) {
    if (entry.flavors) {
      setFlavorScheme(flavorScheme === key ? null : key);
    } else {
      setFlavorScheme(null);
      updateConfig({ colorScheme: key });
    }
  }

  function handleFlavorClick(schemeKey, flavorKey) {
    setFlavorScheme(null);
    updateConfig({ colorScheme: `${schemeKey}-${flavorKey}` });
  }

  return (
    <div className="p-6 rounded-3xl border border-slate-700/30 shadow-[0_5px_15px_rgba(0,0,0,0.6)]" style={{ backgroundColor: '#1D293DED', fontFamily: '"Inter", sans-serif' }}>
      <div className="flex items-center gap-2 mb-1">
        <Terminal size={18} className="text-cyan-400" strokeWidth={1.5} />
        <h2 className="text-base font-bold text-slate-200">Terminal Customization</h2>
      </div>
      <p className="text-xs text-slate-500 mb-5">Configure appearance for SSH and Console terminals</p>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-[#0D121F] rounded-xl p-1">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all flex-1 justify-center
              ${activeTab === key
                ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20"
                : "text-slate-400 hover:text-white"
              }`}
          >
            <Icon size={16} />
            {label}
          </button>
        ))}
      </div>

      <div className="space-y-6">
        {/* Font Size */}
        <div>
          <label className="text-xs text-slate-500 font-medium block mb-2">Font Size</label>
          <div className="flex items-center gap-3">
            <button
              onClick={() => updateConfig({ fontSize: Math.max(10, config.fontSize - 1) })}
              className="p-2 rounded-lg bg-[#0D121F] border border-slate-700/50 text-slate-300 hover:text-white hover:border-slate-500 transition-all"
            >
              <Minus size={16} />
            </button>
            <span className="text-lg font-bold text-slate-200 w-10 text-center tabular-nums">{config.fontSize}</span>
            <button
              onClick={() => updateConfig({ fontSize: Math.min(28, config.fontSize + 1) })}
              className="p-2 rounded-lg bg-[#0D121F] border border-slate-700/50 text-slate-300 hover:text-white hover:border-slate-500 transition-all"
            >
              <Plus size={16} />
            </button>
          </div>
        </div>

        {/* Font Family */}
        <div>
          <label className="text-xs text-slate-500 font-medium block mb-2">Font Family</label>
          <select
            value={config.fontFamily}
            onChange={(e) => updateConfig({ fontFamily: e.target.value })}
            className="w-full bg-[#0D121F] border border-slate-700/50 rounded-xl px-4 py-2.5 text-sm text-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500/30"
          >
            {FONT_FAMILIES.map((f) => (
              <option key={f.value} value={f.value} style={{ fontFamily: f.value }}>
                {f.label}
              </option>
            ))}
          </select>
        </div>

        {/* Color Scheme */}
        <div>
          <label className="text-xs text-slate-500 font-medium block mb-2">Color Scheme</label>
          <div className="grid grid-cols-3 gap-2">
            {Object.entries(COLOR_SCHEMES).map(([key, entry]) => {
              const isActive = resolved.schemeKey === key;
              const theme = entry.flavors
                ? entry.flavors[entry.defaultFlavor]
                : entry.theme;
              const activeFlavor = isActive ? resolved.flavorName : null;
              const swatchColors = getSwatchColors(isActive ? config.colorScheme : `${key}-${entry.defaultFlavor}`);

              return (
                <div key={key} className="relative">
                  <button
                    onClick={() => handleSchemeClick(key, entry)}
                    className={`w-full rounded-xl border-2 p-3 text-left transition-all
                      ${isActive
                        ? "border-blue-500 ring-1 ring-blue-500/30"
                        : "border-slate-700/30 hover:border-slate-500"
                      }`}
                    style={{ backgroundColor: theme.background }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <Swatch colors={swatchColors} />
                      {isActive && !entry.flavors && (
                        <span className="w-2 h-2 rounded-full bg-blue-500" />
                      )}
                      {entry.flavors && (
                        <ChevronDown size={14} style={{ color: theme.foreground }} />
                      )}
                    </div>
                    <p className="text-xs font-medium truncate" style={{ color: theme.foreground }}>
                      {entry.name}
                    </p>
                    {entry.flavors && activeFlavor && (
                      <p className="text-[10px] mt-0.5 opacity-70 truncate" style={{ color: theme.foreground }}>
                        {activeFlavor}
                      </p>
                    )}
                  </button>

                  {/* Flavor popover */}
                  {flavorScheme === key && entry.flavors && (
                    <div className="absolute z-10 left-0 right-0 mt-1 rounded-xl border border-slate-700 bg-[#0D121F] shadow-xl p-2 space-y-1">
                      {Object.entries(entry.flavors).map(([fk, flavor]) => {
                        const isFlavorActive = isActive && resolved.flavorKey === fk;
                        return (
                          <button
                            key={fk}
                            onClick={() => handleFlavorClick(key, fk)}
                            className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all text-left
                              ${isFlavorActive
                                ? "bg-blue-600/20 text-blue-300"
                                : "text-slate-400 hover:text-white hover:bg-slate-800"
                              }`}
                          >
                            <span
                              className="w-4 h-4 rounded border border-slate-600 shrink-0"
                              style={{ backgroundColor: flavor.background }}
                            />
                            <span className="flex-1">{flavor.name}</span>
                            {isFlavorActive && (
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Cursor Style & Blink */}
        <div className="grid grid-cols-2 gap-6">
          <div>
            <label className="text-xs text-slate-500 font-medium block mb-2">Cursor Style</label>
            <div className="flex gap-1 bg-[#0D121F] rounded-xl p-1">
              {CURSOR_STYLES.map(({ label, value }) => (
                <button
                  key={value}
                  onClick={() => updateConfig({ cursorStyle: value })}
                  className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-all
                    ${config.cursorStyle === value
                      ? "bg-blue-600 text-white"
                      : "text-slate-400 hover:text-white"
                    }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs text-slate-500 font-medium block mb-2">Cursor Blink</label>
            <button
              onClick={() => updateConfig({ cursorBlink: !config.cursorBlink })}
              className={`relative w-10 h-5 rounded-full transition-colors duration-200 focus:outline-none
                ${config.cursorBlink ? 'bg-blue-600' : 'bg-slate-700'}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200
                ${config.cursorBlink ? 'translate-x-5' : 'translate-x-0'}`} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
