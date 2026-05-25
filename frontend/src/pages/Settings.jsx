import { useState } from 'react';
import { Bell, Shield, Globe, Database } from 'lucide-react';
import PageHeader from "../components/PageHeader";

function Toggle({ enabled, onChange }) {
  return (
    <button
      onClick={() => onChange(!enabled)}
      className={`relative w-10 h-5 rounded-full transition-colors duration-200 focus:outline-none
        ${enabled ? 'bg-gray-600' : 'bg-gray-700'}`}
    >
      <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200
        ${enabled ? 'translate-x-5' : 'translate-x-0'}`} />
    </button>
  );
}

function SettingRow({ label, desc, enabled, onChange }) {
  return (
    <div className="flex items-center justify-between py-3">
      <div>
        <p className="text-sm text-white font-medium">{label}</p>
        <p className="text-xs text-gray-400 mt-0.5">{desc}</p>
      </div>
      <Toggle enabled={enabled} onChange={onChange} />
    </div>
  );
}

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

  return (
    <div className="flex-1 min-h-screen p-8 overflow-y-auto space-y-8" style={{ background: "linear-gradient(135deg, #F8FAFC 0%, #D1D5DB 100%)", backgroundAttachment: "fixed", fontFamily: '"Inter", sans-serif' }}>
      {/* Header */}
      <div className="mb-6">
        <PageHeader 
          title="Settings" 
          description="Manage system configuration and preferences" 
          isSmallSubtext={true}
        />
      </div>

      <div className="grid grid-cols-2 gap-5">
        {/* Notifications */}
        <div className="bg-[#1D293DED] border border-[#2a3150] rounded-xl p-5">
          <div className="flex items-center gap-2 mb-1">
            <Bell size={16} className="text-blue-400" />
            <h2 className="text-sm font-semibold text-white">Notifications</h2>
          </div>
          <p className="text-xs text-gray-500 mb-4">Configure alert and notification preferences</p>
          <div className="divide-y divide-[#2a3150]">
            <SettingRow label="Email Alerts" desc="Receive alerts via email" enabled={settings.emailAlerts} onChange={() => toggle('emailAlerts')} />
            <SettingRow label="Critical Only" desc="Only send critical alerts" enabled={settings.criticalOnly} onChange={() => toggle('criticalOnly')} />
            <SettingRow label="Slack Integration" desc="Send alerts to Slack" enabled={settings.slackIntegration} onChange={() => toggle('slackIntegration')} />
          </div>
        </div>

        {/* Security */}
        <div className="bg-[#1D293DED] border border-[#2a3150] rounded-xl p-5">
          <div className="flex items-center gap-2 mb-1">
            <Shield size={16} className="text-green-400" />
            <h2 className="text-sm font-semibold text-white">Security</h2>
          </div>
          <p className="text-xs text-gray-500 mb-4">Security and access control settings</p>
          <div className="divide-y divide-[#2a3150]">
            <SettingRow label="Two-Factor Authentication" desc="Enable 2FA for all users" enabled={settings.twoFactor} onChange={() => toggle('twoFactor')} />
            <SettingRow label="Session Timeout" desc="Auto logout after inactivity" enabled={settings.sessionTimeout} onChange={() => toggle('sessionTimeout')} />
            <SettingRow label="Audit Logging" desc="Log all system activities" enabled={settings.auditLogging} onChange={() => toggle('auditLogging')} />
          </div>
        </div>

        {/* Network Settings */}
        <div className="bg-[#1D293DED] border border-[#2a3150] rounded-xl p-5">
          <div className="flex items-center gap-2 mb-1">
            <Globe size={16} className="text-purple-400" />
            <h2 className="text-sm font-semibold text-white">Network Settings</h2>
          </div>
          <p className="text-xs text-gray-500 mb-4">Configure network parameters</p>
          <div className="space-y-4">
            <div>
              <label className="text-xs text-gray-400 mb-1.5 block">SNMP Community String</label>
              <input
                value={network.snmp}
                onChange={e => setNetwork({ ...network, snmp: e.target.value })}
                className="w-full bg-[#1D293DED] border border-[#2a3150] rounded-lg px-3 py-2.5 text-sm text-gray-300 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1.5 block">Syslog Server</label>
              <input
                value={network.syslog}
                onChange={e => setNetwork({ ...network, syslog: e.target.value })}
                className="w-full bg-[#1D293DED] border border-[#2a3150] rounded-lg px-3 py-2.5 text-sm text-gray-300 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1.5 block">NTP Server</label>
              <input
                value={network.ntp}
                onChange={e => setNetwork({ ...network, ntp: e.target.value })}
                className="w-full bg-[#1D293DED] border border-[#2a3150] rounded-lg px-3 py-2.5 text-sm text-gray-300 focus:outline-none focus:border-blue-500"
              />
            </div>
            <button className="w-full bg-blue-600 hover:bg-blue-500 text-white py-2.5 rounded-lg text-sm font-medium transition-colors mt-2">
              Save Changes
            </button>
          </div>
        </div>

        {/* Backup & Restore */}
        <div className="bg-[#1D293DED] border border-[#2a3150] rounded-xl p-5">
          <div className="flex items-center gap-2 mb-1">
            <Database size={16} className="text-yellow-400" />
            <h2 className="text-sm font-semibold text-white">Backup & Restore</h2>
          </div>
          <p className="text-xs text-gray-500 mb-4">Manage system backups</p>
          <div className="space-y-4">
            <div className="flex items-center justify-between py-2">
              <div>
                <p className="text-sm text-white font-medium">Automatic Backup</p>
                <p className="text-xs text-gray-500 mt-0.5">Daily at 2:00 AM</p>
              </div>
              <Toggle enabled={settings.autoBackup} onChange={() => toggle('autoBackup')} />
            </div>
            <div className="border-t border-[#2a3150] pt-4">
              <p className="text-xs text-gray-500 mb-1">Last Backup</p>
              <p className="text-sm text-white font-mono">2026-03-05 02:00:15</p>
            </div>
            <div className="grid grid-cols-2 gap-3 pt-2">
              <button className="py-2.5 rounded-lg text-sm font-medium bg-[#1D293DED] border border-[#2a3150] text-gray-300 hover:text-white transition-colors">
                Backup Now
              </button>
              <button className="py-2.5 rounded-lg text-sm font-medium bg-[#1D293DED] border border-[#2a3150] text-gray-300 hover:text-white transition-colors">
                Restore
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}