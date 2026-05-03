import React, { useState } from 'react';
import { Lock, Plus, Server, User, X } from 'lucide-react';

const devices = [
  { name: 'core-sw-01', ip: '192.168.1.1', model: 'Cisco Catalyst 9300', version: 'IOS-XE 17.6.3', uptime: '45 days', cpu: 34, memory: 62, online: true },
  { name: 'router-edge-01', ip: '10.0.0.1', model: 'Cisco ISR 4451', version: 'IOS-XE 16.12.5', uptime: '12 days', cpu: 87, memory: 71, online: true },
  { name: 'access-sw-15', ip: '192.168.1.25', model: 'Cisco Catalyst 2960', version: 'IOS 15.0(2)', uptime: 'N/A', cpu: 0, memory: 0, online: false },
  { name: 'firewall-01', ip: '10.0.0.254', model: 'Cisco ASA 5525-X', version: 'ASA 9.16(3)', uptime: '156 days', cpu: 55, memory: 68, online: true },
];

export default function NetworkDevices() {
  const [modalOpen, setModalOpen] = useState(true);

  return (
    <section>
      <div className="page-heading">
        <div>
          <h1>Network Devices</h1>
          <p className="page-subtitle">Monitor and manage all network devices</p>
        </div>
        <button className="add-button" onClick={() => setModalOpen(true)}>
          <Plus size={17} />
          Add Device
        </button>
      </div>

      <div className="device-grid">
        {devices.map((device) => (
          <article className="device-card" key={device.name}>
            <div className="device-head">
              <div className="device-icon"><Server size={22} /></div>
              <div>
                <h2>{device.name}</h2>
                <p>{device.ip}</p>
              </div>
              <span className={`pill ${device.online ? 'online' : 'offline'}`}>
                {device.online ? 'online' : 'offline'}
              </span>
            </div>

            <div className="device-info">
              <span>Model</span><strong>{device.model}</strong>
              <span>Version</span><strong>{device.version}</strong>
              <span>Uptime</span><strong>{device.uptime}</strong>
            </div>

            {device.online ? (
              <>
                <Meter label="CPU Usage" value={device.cpu} alert={device.cpu > 80} />
                <Meter label="Memory Usage" value={device.memory} />
              </>
            ) : (
              <div className="offline-box">Device Offline</div>
            )}

            <div className="card-actions">
              <button>Configure</button>
              <button>Details</button>
            </div>
          </article>
        ))}
      </div>

      {modalOpen && <AddDeviceModal onClose={() => setModalOpen(false)} />}
    </section>
  );
}

function Meter({ label, value, alert }) {
  return (
    <div className="meter">
      <div>
        <span>{label}</span>
        <strong className={alert ? 'red-text' : ''}>{value}%</strong>
      </div>
      <i><b style={{ width: `${value}%` }} className={alert ? 'danger' : ''} /></i>
    </div>
  );
}

function AddDeviceModal({ onClose }) {
  return (
    <div className="modal-backdrop">
      <div className="device-modal">
        <div className="modal-head">
          <h2>Add Network Device</h2>
          <button onClick={onClose}><X size={18} /></button>
        </div>

        <label>Hostname</label>
        <div className="form-control"><Server size={17} /><input placeholder="core-sw-03" /></div>

        <label>IP Address</label>
        <div className="form-control"><Server size={17} /><input placeholder="10.0.1.3" /></div>

        <label>Device Type</label>
        <div className="form-control"><Server size={17} /><input /></div>

        <label>SSH Username</label>
        <div className="form-control"><User size={17} /><input placeholder="admin" /></div>

        <label>SSH Password</label>
        <div className="form-control"><Lock size={17} /><input type="password" placeholder="••••••••" /></div>

        <button className="test-button">Test Connection</button>

        <div className="modal-actions">
          <button onClick={onClose}>Cancel</button>
          <button>Save Device</button>
        </div>
      </div>
    </div>
  );
}
