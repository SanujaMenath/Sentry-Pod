import React, { useState } from "react";
import { AlertTriangle, Check, Clock, X } from "lucide-react";
import PageHeader from "../components/PageHeader";

const initialChanges = [
  {
    id: "CHG-001",
    severity: "medium",
    title: "Block Social Media on Guest VLAN",
    requestedBy: "Admin User",
    device: "access-sw-02",
    time: "2026-03-05 14:23",
    code: `access-list 101 deny tcp any any eq 443 log
access-list 101 deny tcp any any eq 80 log
access-list 101 permit ip any any
!
interface Vlan20
description Guest-VLAN
ip access-group 101 in`,
  },
  {
    id: "CHG-002",
    severity: "high",
    title: "Enable Port Security on Access Ports",
    requestedBy: "Security Team",
    device: "Multiple (8 devices)",
    time: "2026-03-05 13:45",
    code: `interface range GigabitEthernet1/0/1-24
switchport mode access
switchport port-security
switchport port-security maximum 3
switchport port-security violation restrict
switchport port-security aging time 2`,
  },
  {
    id: "CHG-003",
    severity: "critical",
    title: "Update SNMP Community Strings",
    requestedBy: "NOC Team",
    device: "All devices",
    time: "2026-03-05 12:10",
    code: `no snmp-server community public RO
snmp-server community s3cur3_r0 RO
snmp-server community s3cur3_rw RW`,
  },
];

export default function StagingGate() {
  const [changes, setChanges] = useState(initialChanges);

  const removeChange = (id) => {
    setChanges(changes.filter((change) => change.id !== id));
  };

  return (
    <div className="min-h-full bg-linear-to-br from-[#F8FAFC] to-[#D1D5DB] p-8 font-sans">
      <PageHeader 
        title="Staging Gate" 
        description="Review and approve configuration changes before deployment" 
        isSmallSubtext={true}
      />

      <div className="mb-6 flex w-fit rounded-xl bg-slate-400 p-1 shadow">
        <button className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white">
          Pending Approval <span className="rounded-full bg-yellow-400 px-2 text-xs text-white">{changes.length}</span>
        </button>
        <button className="px-4 py-2 text-sm font-bold text-slate-900">Approved Changes</button>
        <button className="px-4 py-2 text-sm font-bold text-slate-900">Rejected</button>
      </div>

      <div className="space-y-7">
        {changes.map((change) => (
          <article key={change.id} className="rounded-2xl bg-[#1D293DED] border border-slate-700/50 p-7 shadow-lg">
            <div className="mb-3 flex items-center gap-3">
              <span className="rounded-lg border border-blue-400/30 bg-blue-600/20 px-3 py-1 text-xs font-bold text-blue-300">
                {change.id}
              </span>
              <SeverityBadge severity={change.severity} />
            </div>

            <h2 className="text-2xl font-bold text-white">{change.title}</h2>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-slate-400">
              <span>Requested by: {change.requestedBy}</span>
              <span>•</span>
              <span>Device: {change.device}</span>
              <span>•</span>
              <span className="flex items-center gap-1"><Clock size={14} /> {change.time}</span>
            </div>

            <p className="mt-8 mb-3 text-sm text-slate-400">Configuration Changes:</p>
            <pre className="overflow-auto rounded-xl bg-[#172231] p-5 font-mono text-sm leading-relaxed text-emerald-400">
              {change.code}
            </pre>

            <div className="mt-7 flex flex-wrap gap-3">
              <button onClick={() => removeChange(change.id)} className="flex items-center gap-2 rounded-xl bg-emerald-700 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-emerald-700/20">
                <Check size={17} /> Approve & Deploy
              </button>
              <button onClick={() => removeChange(change.id)} className="flex items-center gap-2 rounded-xl bg-white px-5 py-2.5 text-sm font-bold text-rose-500">
                <X size={17} /> Reject
              </button>
              <button className="rounded-xl bg-white px-5 py-2.5 text-sm font-bold text-slate-600">
                Request Changes
              </button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

function SeverityBadge({ severity }) {
  const styles = {
    medium: "border-yellow-400/40 bg-yellow-500/10 text-yellow-300",
    high: "border-orange-400/40 bg-orange-500/10 text-orange-300",
    critical: "border-rose-400/40 bg-rose-500/10 text-rose-300",
  };

  return (
    <span className={`flex items-center gap-1 rounded-lg border px-3 py-1 text-xs font-bold uppercase ${styles[severity]}`}>
      <AlertTriangle size={12} /> {severity}
    </span>
  );
}