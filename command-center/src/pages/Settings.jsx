import { useState } from 'react';
import { Bell, Shield, Globe, Database } from 'lucide-react';
import PageHeader from "../components/PageHeader";
import Toggle from "../components/Toggle";
import SettingRow from "../components/SettingRow";
import TerminalConfigCard from "../components/TerminalConfigCard";

export default function SettingsPage() {
  const [settings, setSettings] = useState({
    emailAlerts: true,
    criticalOnly: false,
    slackIntegration: true,
    twoFactor: true,
    sessionTimeout: true,
    auditLogging: true,
    autoBackup: true,
  });

  const [network, setNetwork] = useState({
    snmp: 's3cur3_r0',
    syslog: '10.0.0.10',
    ntp: 'time.nist.gov',
  });

  const toggle = (key) => setSettings(prev => ({ ...prev, [key]: !prev[key] }));

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

        <div className="grid grid-cols-2 gap-6">
          {/* Notifications */}
          <div className="p-6 rounded-3xl border border-slate-700/30 shadow-[0_5px_15px_rgba(0,0,0,0.6)]" style={styles.card}>
            <div className="flex items-center gap-2 mb-1">
              <Bell size={18} className="text-blue-400" strokeWidth={1.5} />
              <h2 className="text-base font-bold text-slate-200">Notifications</h2>
            </div>
            <p className="text-xs text-slate-500 mb-5">Configure alert and notification preferences</p>
            <div>
              <SettingRow label="Email Alerts" desc="Receive alerts via email" enabled={settings.emailAlerts} onChange={() => toggle('emailAlerts')} />
              <SettingRow label="Critical Only" desc="Only send critical alerts" enabled={settings.criticalOnly} onChange={() => toggle('criticalOnly')} />
              <SettingRow label="Slack Integration" desc="Send alerts to Slack" enabled={settings.slackIntegration} onChange={() => toggle('slackIntegration')} />
            </div>
          </div>

          {/* Security */}
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
            </div>
          </div>

          {/* Network Settings */}
          <div className="p-6 rounded-3xl border border-slate-700/30 shadow-[0_5px_15px_rgba(0,0,0,0.6)]" style={styles.card}>
            <div className="flex items-center gap-2 mb-1">
              <Globe size={18} className="text-purple-400" strokeWidth={1.5} />
              <h2 className="text-base font-bold text-slate-200">Network Settings</h2>
            </div>
            <p className="text-xs text-slate-500 mb-5">Configure network parameters</p>
            <div className="space-y-4">
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

          {/* Backup & Restore */}
          <div className="p-6 rounded-3xl border border-slate-700/30 shadow-[0_5px_15px_rgba(0,0,0,0.6)]" style={styles.card}>
            <div className="flex items-center gap-2 mb-1">
              <Database size={18} className="text-amber-400" strokeWidth={1.5} />
              <h2 className="text-base font-bold text-slate-200">Backup & Restore</h2>
            </div>
            <p className="text-xs text-slate-500 mb-5">Manage system backups</p>
            <div className="space-y-4">
              <div className="flex items-center justify-between py-3 border-b border-slate-800/50">
                <div>
                  <p className="text-sm text-slate-200 font-medium">Automatic Backup</p>
                  <p className="text-xs text-slate-500 mt-0.5">Daily at 2:00 AM</p>
                </div>
                <Toggle enabled={settings.autoBackup} onChange={() => toggle('autoBackup')} />
              </div>
              <div className="pt-2">
                <p className="text-xs text-slate-500 mb-1 font-medium">Last Backup</p>
                <p className="text-sm text-slate-200 font-mono font-bold">2026-03-05 02:00:15</p>
              </div>
              <div className="grid grid-cols-2 gap-3 pt-2">
                <button className="py-2.5 rounded-xl text-sm font-bold bg-[#0D121F] border border-slate-700/50 text-slate-300 hover:text-white hover:border-slate-500 transition-all">
                  Backup Now
                </button>
                <button className="py-2.5 rounded-xl text-sm font-bold bg-[#0D121F] border border-slate-700/50 text-slate-300 hover:text-white hover:border-slate-500 transition-all">
                  Restore
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Terminal Customization — full-width row */}
        <div className="col-span-2">
          <TerminalConfigCard />
        </div>
      </div>
    </div>
  );
}
