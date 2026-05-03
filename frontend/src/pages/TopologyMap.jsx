import React from 'react';
import { Maximize2, Router, Search, Server, Shield, ZoomIn } from 'lucide-react';

const nodes = [
  { label: 'Firewall-01', icon: Shield, className: 'node firewall online' },
  { label: 'Router-Edge-01', icon: Router, className: 'node router online' },
  { label: 'Core-SW-01', icon: Server, className: 'node core online' },
  { label: 'Dist-SW-01', icon: Server, className: 'node dist dist-left online' },
  { label: 'Dist-SW-02', icon: Server, className: 'node dist dist-right online' },
  { label: 'Access-SW-01', icon: Server, className: 'node access access-one online' },
  { label: 'Access-SW-02', icon: Server, className: 'node access access-two online' },
  { label: 'Access-SW-03', icon: Server, className: 'node access access-three online' },
  { label: 'Access-SW-04', icon: Server, className: 'node access access-four offline' },
];

export default function TopologyMap() {
  return (
    <section>
      <div className="page-heading text-white">
        <div>
          <h1>Network Topology Map</h1>
          <p className="page-subtitle">Interactive visualization of network infrastructure</p>
        </div>
        <div className="zoom-tools">
          <button><Search size={18} /></button>
          <span>100%</span>
          <button><ZoomIn size={18} /></button>
          <button><Maximize2 size={18} /></button>
        </div>
      </div>

      <div className="topology-layout text-white">
        <div className="map-card">
          <div className="map-board">
            <span className="line line-vertical-top" />
            <span className="line line-vertical-mid" />
            <span className="line line-left" />
            <span className="line line-right" />
            <span className="line line-horizontal" />
            <span className="line line-access-one" />
            <span className="line line-access-two" />
            <span className="line line-access-three" />
            <span className="line line-access-four" />

            {nodes.map(({ label, icon: Icon, className }) => (
              <div className={className} key={label}>
                <i />
                <Icon size={34} strokeWidth={1.4} />
                <span>{label}</span>
              </div>
            ))}
          </div>
        </div>

        <aside className="right-column">
          <div className="info-card">
            <h2>Legend</h2>
            <p><span className="dot green" /> Online</p>
            <p><span className="dot red" /> Offline</p>
            <hr />
            <p><span className="mini-icon" /> Core Switch</p>
            <p><span className="mini-icon" /> Distribution</p>
            <p><span className="mini-icon" /> Access Switch</p>
          </div>

          <div className="info-card">
            <h2>Quick Stats</h2>
            <dl>
              <dt>Total Nodes</dt><dd>9</dd>
              <dt>Online</dt><dd className="green-text">8</dd>
              <dt>Offline</dt><dd className="red-text">1</dd>
              <dt>Connections</dt><dd>9</dd>
            </dl>
          </div>
        </aside>
      </div>
    </section>
  );
}
