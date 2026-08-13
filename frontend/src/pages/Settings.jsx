import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Bell, Shield, Globe } from 'lucide-react';
import PageHeader from "../components/PageHeader";
import Toggle from "../components/Toggle";
import SettingRow from "../components/SettingRow";
import TerminalConfigCard from "../components/TerminalConfigCard";
import PlaybookStagingGate from "../components/PlaybookStagingGate";
import { getNotificationPreferences, updateNotificationPreferences } from "../services/notificationService";
import { executePlaybookWithVars } from "../services/inventoryService";

const NETWORK_PLAYBOOKS = {
  snmp: {
    filename: "configure_snmp.yml",
    name: "Configure SNMP",
    description: "Configures an SNMPv2c read-only community and enables traps on all hosts.",
    tags: ["snmp", "monitoring", "config"],
    target_devices: ["allHosts"],
    severity: "medium",
  },
  syslog: {
    filename: "configure_syslog.yml",
    name: "Configure Syslog",
    description: "Configures syslog forwarding, trap level, facility, and timestamps. Host/port are parameterized.",
    tags: ["syslog", "logging", "config"],
    target_devices: ["allHosts"],
    severity: "medium",
  },
  ntp: {
    filename: "configure_ntp.yml",
    name: "Configure NTP",
    description: "Configures NTP clients, timezone, and associations on all hosts.",
    tags: ["ntp", "time", "config"],
    target_devices: ["allHosts"],
    severity: "medium",
  },
};

const NETWORK_DEFAULTS = {
  snmp: 's3cur3_r0',
  syslog: '10.0.0.10',
  ntp: 'time.nist.gov',
};

const buildExtraVars = (setting, network) => {
  switch (setting) {
    case "snmp":
      return { extra_snmp_community: network.snmp, extra_snmp_trap_host: network.syslog };
    case "syslog":
      return { extra_syslog_host: network.syslog };
    case "ntp":
      return { extra_ntp_server: network.ntp };
    default:
      return {};
  }
};

const buildDetails = (setting, network) => {
  switch (setting) {
    case "snmp":
      return [
        { key: "SNMP Community", value: network.snmp },
        { key: "SNMP Trap Host", value: network.syslog },
      ];
    case "syslog":
      return [{ key: "Syslog Host", value: network.syslog }];
    case "ntp":
      return [{ key: "NTP Server", value: network.ntp }];
    default:
      return [];
  }
};

export default function SettingsPage() {
  const { search } = useOutletContext() || { search: "" };
  const [settings, setSettings] = useState({
    emailAlerts: true,
    criticalOnly: false,
    slackIntegration: true,
    twoFactor: true,
    sessionTimeout: true,
    auditLogging: true,
    autoBackup: true,
    requireConsolePassword: localStorage.getItem('requireConsolePassword') !== 'false',
  });

  const [network, setNetwork] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('networkSettings'));
      if (saved && saved.snmp !== undefined && saved.syslog !== undefined && saved.ntp !== undefined) {
        return { ...NETWORK_DEFAULTS, ...saved };
      }
    } catch (error) {
      console.error("Failed to load network settings", error);
    }
    return NETWORK_DEFAULTS;
  });
  const [applying, setApplying] = useState(null);
  const [applyResult, setApplyResult] = useState({});
  const [pendingApply, setPendingApply] = useState(null);
  const [notificationPreferences, setNotificationPreferences] = useState({
    enabled: true, sound_enabled: true, topology_refresh: true, syslog_alerts: true, playbook_updates: true, critical_only: false,
  });

  useEffect(() => {
    getNotificationPreferences()
      .then(({ data }) => setNotificationPreferences(data))
      .catch((error) => console.error("Failed to load notification preferences", error));
  }, []);

  const query = search ? search.trim().toLowerCase() : "";

  const matches = (keywords = []) => {
    if (!query) return true;
    return keywords.some(k => k.toLowerCase().includes(query));
  };

  const showNotifications = matches(["Notifications", "Notification Sound", "Topology Refresh", "Syslog Alerts", "Playbook Updates", "Critical Only", "alert", "notification"]);
  const showSecurity = matches(["Security", "Two-Factor Authentication", "2FA", "Session Timeout", "Audit Logging", "Console Password Prompt", "Console Password"]);
  const showNetwork = matches(["Network Settings", "SNMP", "Syslog", "NTP", "Server", "Community String"]);
  const showTerminal = matches(["Terminal Customization", "Terminal", "Theme", "Font", "Appearance"]);

  const hasResults = showNotifications || showSecurity || showNetwork || showTerminal;

  const toggle = (key) => setSettings(prev => ({ ...prev, [key]: !prev[key] }));
  const toggleConsolePassword = () => {
    setSettings(prev => {
      const next = !prev.requireConsolePassword;
      localStorage.setItem('requireConsolePassword', String(next));
      return { ...prev, requireConsolePassword: next };
    });
  };
  const toggleNotificationPreference = async (key) => {
    const previous = notificationPreferences;
    const next = { ...previous, [key]: !previous[key] };
    setNotificationPreferences(next);
    try {
      const { data } = await updateNotificationPreferences(next);
      setNotificationPreferences(data);
    } catch (error) {
      setNotificationPreferences(previous);
      console.error("Failed to save notification preferences", error);
    }
  };

  const updateNetwork = (key, value) => {
    setNetwork(prev => {
      const next = { ...prev, [key]: value };
      try {
        localStorage.setItem('networkSettings', JSON.stringify(next));
      } catch (error) {
        console.error("Failed to persist network settings", error);
      }
      return next;
    });
  };

  const handleApplyClick = (setting) => {
    setPendingApply({
      setting,
      playbook: NETWORK_PLAYBOOKS[setting],
      details: buildDetails(setting, network),
      extraVars: buildExtraVars(setting, network),
    });
  };

  const handleStagingGateApprove = async () => {
    const { setting, playbook, extraVars } = pendingApply;
    setPendingApply(null);
    setApplying(setting);
    setApplyResult(prev => ({ ...prev, [setting]: "Applying…" }));
    try {
      const data = await executePlaybookWithVars(playbook.filename, extraVars);
      setApplyResult(prev => ({ ...prev, [setting]: data.status === "success" ? "Applied" : "Failed" }));
    } catch (error) {
      setApplyResult(prev => ({ ...prev, [setting]: typeof error === "string" ? error : "Apply failed" }));
    } finally {
      setApplying(null);
    }
  };

  const handleStagingGateReject = () => {
    setPendingApply(null);
  };

  const renderApplyStatus = (setting) => {
    if (applying === setting) {
      return <p className="text-xs text-blue-400 font-medium mt-1.5">Applying…</p>;
    }
    const status = applyResult[setting];
    if (!status || status === "Applying…") return null;
    const ok = status === "Applied";
    return (
      <p className={`text-xs font-medium mt-1.5 ${ok ? "text-emerald-400" : "text-rose-400"}`}>
        {ok ? "✓ Applied" : status}
      </p>
    );
  };

  const renderApplyButton = (setting) => (
    <button
      onClick={() => handleApplyClick(setting)}
      disabled={applying !== null}
      className="w-full mt-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white py-2.5 rounded-xl text-sm font-bold transition-colors shadow-lg shadow-blue-600/20"
    >
      Apply
    </button>
  );

  const styles = {
    main: {
      background: 'linear-gradient(135deg, #F8FAFC 0%, #D1D5DB 100%)',
      backgroundAttachment: 'fixed',
      fontFamily: '"Inter", sans-serif',
      minHeight: '100%',
    },
    card: { backgroundColor: '#1D293DED', fontFamily: '"Inter", sans-serif' },
    headline: { color: '#0F172A', fontSize: '30px', fontWeight: '800', fontFamily: '"Inter", sans-serif', letterSpacing: '-0.025em' },
    subtext: { color: '#475569', fontSize: '16px', fontWeight: '500', fontFamily: '"Inter", sans-serif' }
  };

  return (
    <div style={styles.main}>
      <div className="p-8 space-y-8">

        {/* Header */}
        <div>
          <h1 style={styles.headline}>Settings</h1>
          <p style={styles.subtext}>Manage system configuration and preferences</p>
        </div>

        {!hasResults ? (
          <div className="py-16 text-center text-slate-500 font-medium">
            No settings matching "{search}"
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-6">

          {/* Notifications */}
          {showNotifications && (
            <div className="p-6 rounded-3xl border border-slate-700/30 shadow-[0_5px_15px_rgba(0,0,0,0.6)]" style={styles.card}>
              <div className="flex items-center gap-2 mb-1">
                <Bell size={18} className="text-blue-400" strokeWidth={1.5} />
                <h2 className="text-base font-bold text-slate-200">Notifications</h2>
              </div>
              <p className="text-xs text-slate-500 mb-5">Choose which system activity appears in your notification bell</p>
              <div>
                <SettingRow label="In-app Notifications" desc="Show system notifications in the bell" enabled={notificationPreferences.enabled} onChange={() => toggleNotificationPreference('enabled')} />
                <SettingRow label="Notification Sound" desc="Play a chime when a new notification arrives" enabled={notificationPreferences.sound_enabled} onChange={() => toggleNotificationPreference('sound_enabled')} />
                <SettingRow label="Topology Refresh" desc="Notify when topology discovery finishes" enabled={notificationPreferences.topology_refresh} onChange={() => toggleNotificationPreference('topology_refresh')} />
                <SettingRow label="Syslog Alerts" desc="Show device syslog alert notifications" enabled={notificationPreferences.syslog_alerts} onChange={() => toggleNotificationPreference('syslog_alerts')} />
                <SettingRow label="Playbook Updates" desc="Notify when a playbook completes or fails" enabled={notificationPreferences.playbook_updates} onChange={() => toggleNotificationPreference('playbook_updates')} />
                <SettingRow label="Critical Only" desc="Only show critical-severity notifications" enabled={notificationPreferences.critical_only} onChange={() => toggleNotificationPreference('critical_only')} />
              </div>
            </div>
          )}

          {/* Security */}
          {showSecurity && (
            <div className="p-6 rounded-3xl border border-slate-700/30 shadow-[0_5px_15px_rgba(0,0,0,0.6)]" style={styles.card}>
              <div className="flex items-center gap-2 mb-1">
                <Shield size={18} className="text-emerald-400" strokeWidth={1.5} />
                <h2 className="text-base font-bold text-slate-200">Security</h2>
              </div>
              <p className="text-xs text-slate-500 mb-5">Security and access control settings</p>
              <div>
                <SettingRow label="Two-Factor Authentication" desc="Enable 2FA for all users" enabled={settings.twoFactor} onChange={() => toggle('twoFactor')} />
                <SettingRow label="Session Timeout" desc="Auto logout after inactivity" enabled={settings.sessionTimeout} onChange={() => toggle('sessionTimeout')} />
                <SettingRow label="Audit Logging" desc="Log all system activities" enabled={settings.auditLogging} onChange={() => toggle('auditLogging')} />
                <SettingRow label="Console Password Prompt" desc="Require password re-entry before opening the network console" enabled={settings.requireConsolePassword} onChange={toggleConsolePassword} />
              </div>
            </div>
          )}

          {/* Network Settings */}
          {showNetwork && (
            <div className="p-6 rounded-3xl border border-slate-700/30 shadow-[0_5px_15px_rgba(0,0,0,0.6)]" style={styles.card}>
              <div className="flex items-center gap-2 mb-1">
                <Globe size={18} className="text-purple-400" strokeWidth={1.5} />
                <h2 className="text-base font-bold text-slate-200">Network Settings</h2>
              </div>
              <p className="text-xs text-slate-500 mb-5">Configure network parameters</p>
            <div className="space-y-4">
              <div>
                <label className="text-xs text-slate-500 mb-1.5 block font-medium">SNMP Community String</label>
                <input value={network.snmp} onChange={e => updateNetwork('snmp', e.target.value)}
                  className="w-full bg-[#0D121F] border border-slate-700/50 rounded-xl px-4 py-2.5 text-sm text-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500/30" />
                {renderApplyButton("snmp")}
                {renderApplyStatus("snmp")}
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1.5 block font-medium">Syslog Server</label>
                <input value={network.syslog} onChange={e => updateNetwork('syslog', e.target.value)}
                  className="w-full bg-[#0D121F] border border-slate-700/50 rounded-xl px-4 py-2.5 text-sm text-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500/30" />
                {renderApplyButton("syslog")}
                {renderApplyStatus("syslog")}
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1.5 block font-medium">NTP Server</label>
                <input value={network.ntp} onChange={e => updateNetwork('ntp', e.target.value)}
                  className="w-full bg-[#0D121F] border border-slate-700/50 rounded-xl px-4 py-2.5 text-sm text-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500/30" />
                {renderApplyButton("ntp")}
                {renderApplyStatus("ntp")}
              </div>
            </div>
          </div>
          )}

          {/* Backup & Restore */}
          {showBackup && (
            <div className="p-6 rounded-3xl border border-slate-700/30 shadow-[0_5px_15px_rgba(0,0,0,0.6)]" style={styles.card}>
            <div className="flex items-center gap-2 mb-1">
              <Database size={18} className="text-amber-400" strokeWidth={1.5} />
              <h2 className="text-base font-bold text-slate-200">Backup & Restore</h2>
            </div>
            <p className="text-xs text-slate-500 mb-5">Manage system backups</p>
            <div className="space-y-4">
              <div className="flex items-center justify-between py-3 border-b border-slate-800/50">
                <div>
                  <label className="text-xs text-slate-500 mb-1.5 block font-medium">SNMP Community String</label>
                  <input value={network.snmp} onChange={e => setNetwork({ ...network, snmp: e.target.value })}
                    className="w-full bg-[#0D121F] border border-slate-700/50 rounded-xl px-4 py-2.5 text-sm text-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500/30" />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1.5 block font-medium">Syslog Server</label>
                  <input value={network.syslog} onChange={e => setNetwork({ ...network, syslog: e.target.value })}
                    className="w-full bg-[#0D121F] border border-slate-700/50 rounded-xl px-4 py-2.5 text-sm text-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500/30" />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1.5 block font-medium">NTP Server</label>
                  <input value={network.ntp} onChange={e => setNetwork({ ...network, ntp: e.target.value })}
                    className="w-full bg-[#0D121F] border border-slate-700/50 rounded-xl px-4 py-2.5 text-sm text-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500/30" />
                </div>
                <button className="w-full bg-blue-600 hover:bg-blue-500 text-white py-2.5 rounded-xl text-sm font-bold transition-colors shadow-lg shadow-blue-600/20">
                  Save Changes
                </button>
              </div>
            </div>
          )}

          {/* Terminal Customization */}
          {showTerminal && (
            <div>
              <TerminalConfigCard />
            </div>
          )}

          </div>
        )}
      </div>

      <PlaybookStagingGate
        playbook={pendingApply?.playbook}
        details={pendingApply?.details}
        onApprove={handleStagingGateApprove}
        onReject={handleStagingGateReject}
        isOpen={!!pendingApply}
      />
    </div>
  );
}