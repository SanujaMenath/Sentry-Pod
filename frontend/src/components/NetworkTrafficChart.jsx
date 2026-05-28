import React, { useEffect, useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { fetchNetworkTrafficFor, fetchTelemetryHosts } from '../services/networkService';

export default function NetworkTrafficChart() {
  const [chartData, setChartData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [devices, setDevices] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState("");
  const [selectedIf, setSelectedIf] = useState(null);
  const [allInterfaces, setAllInterfaces] = useState(false);
  const [openDeviceMenu, setOpenDeviceMenu] = useState(false);
  const [openInterfaceMenu, setOpenInterfaceMenu] = useState(false);

  const getTelemetryData = async (opts = {}) => {
    try {
      setLoading(true);
      const data = await fetchNetworkTrafficFor(opts);
      setChartData(data);
    } catch (err) {
      console.error("Failed to load telemetry data.");
    } finally {
      setLoading(false);
    }
  };

  const loadTelemetryHosts = async () => {
    const list = await fetchTelemetryHosts();
    const mapped = list.map((item) => ({
      device: item.host,
      name: item.name || item.host,
      interfaces: item.interfaces || [],
      totalInterfacesTracked: item.total_interfaces_tracked || 0,
    }));

    setDevices(mapped);

    if (mapped.length && !selectedDevice) {
      setSelectedDevice(mapped[0].device);
    }
  };

  useEffect(() => {
    (async () => {
      await loadTelemetryHosts();
    })();
  }, []);

  useEffect(() => {
    const params = {};
    if (selectedDevice) params.device = selectedDevice;
    if (selectedIf) params.ifIndex = selectedIf;
    if (allInterfaces) params.allInterfaces = true;
    getTelemetryData(params);

    const liveInterval = setInterval(() => {
      getTelemetryData(params);
    }, 30000);

    return () => clearInterval(liveInterval);
  }, [selectedDevice, selectedIf, allInterfaces]);

  const selectedTelemetryHost = devices.find((device) => device.device === selectedDevice);

  const selectedDeviceLabel = selectedTelemetryHost?.name || selectedDevice || "Select device";
  const selectedInterfaceLabel = selectedIf ? (selectedTelemetryHost?.interfaces?.find((ifc) => ifc.ifIndex === selectedIf)?.name || `if${selectedIf}`) : "All interfaces";

  if (loading) {
    return (
      <div className="p-6 rounded-3xl bg-[#1D293DED] min-h-[300px] flex items-center justify-center text-slate-400 font-medium">
        Loading Network Baseline...
      </div>
    );
  }

  return (
    <div className="p-6 rounded-3xl border border-slate-700/30 shadow-[0_5px_15px_rgba(0,0,0,0.6)] bg-[#1D293DED] font-sans">
      <div className="flex justify-between items-center mb-8 overflow-visible">
        <h4 className="text-sm font-medium text-slate-300 m-0">
          Network Baseline
        </h4>
        <div className="flex items-center gap-2 overflow-visible">
          <div className="relative">
            <button
              type="button"
              className="min-w-[150px] bg-[#0D121F] text-slate-300 rounded px-3 py-1 text-sm text-left border border-slate-700/50 hover:border-slate-500/60 transition-colors"
              onClick={() => {
                setOpenDeviceMenu((current) => !current);
                setOpenInterfaceMenu(false);
              }}
            >
              {selectedDeviceLabel}
            </button>
            {openDeviceMenu && (
              <div className="absolute left-0 top-full mt-2 z-50 min-w-[150px] max-h-64 overflow-y-auto rounded-xl border border-slate-700/70 bg-[#0D121F] shadow-[0_18px_40px_rgba(0,0,0,0.45)]">
                <button
                  type="button"
                  className="block w-full px-3 py-2 text-left text-sm text-slate-300 hover:bg-slate-800/80"
                  onClick={() => {
                    setSelectedDevice("");
                    setSelectedIf(null);
                    setAllInterfaces(false);
                    setOpenDeviceMenu(false);
                  }}
                >
                  Select device
                </button>
                {devices.map((device) => (
                  <button
                    type="button"
                    key={device.device}
                    className="block w-full px-3 py-2 text-left text-sm text-slate-300 hover:bg-slate-800/80"
                    onClick={() => {
                      setSelectedDevice(device.device);
                      setSelectedIf(null);
                      setAllInterfaces(false);
                      setOpenDeviceMenu(false);
                    }}
                  >
                    {device.name || device.device}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="relative">
            <button
              type="button"
              className="min-w-[170px] bg-[#0D121F] text-slate-300 rounded px-3 py-1 text-sm text-left border border-slate-700/50 hover:border-slate-500/60 transition-colors"
              onClick={() => {
                setOpenInterfaceMenu((current) => !current);
                setOpenDeviceMenu(false);
              }}
            >
              {selectedInterfaceLabel}
            </button>
            {openInterfaceMenu && (
              <div className="absolute left-0 top-full mt-2 z-50 min-w-[170px] max-h-64 overflow-y-auto rounded-xl border border-slate-700/70 bg-[#0D121F] shadow-[0_18px_40px_rgba(0,0,0,0.45)]">
                <button
                  type="button"
                  className="block w-full px-3 py-2 text-left text-sm text-slate-300 hover:bg-slate-800/80"
                  onClick={() => {
                    setSelectedIf(null);
                    setAllInterfaces(true);
                    setOpenInterfaceMenu(false);
                  }}
                >
                  All interfaces
                </button>
                {selectedTelemetryHost?.interfaces?.map((ifc) => (
                  <button
                    type="button"
                    key={ifc.ifIndex}
                    className="block w-full px-3 py-2 text-left text-sm text-slate-300 hover:bg-slate-800/80"
                    onClick={() => {
                      setSelectedIf(ifc.ifIndex);
                      setAllInterfaces(false);
                      setOpenInterfaceMenu(false);
                    }}
                  >
                    {ifc.name || `if${ifc.ifIndex}`}
                  </button>
                ))}
              </div>
            )}
          </div>

          <label className="text-sm text-slate-300">
            <input type="checkbox" className="mr-1" checked={allInterfaces} onChange={e=>setAllInterfaces(e.target.checked)} /> allInterfaces
          </label>
        </div>
        <span className="flex h-2 w-2 relative">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
        </span>
      </div>

      <div className="h-56 relative px-2">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -30, bottom: 0 }}>
            <defs>
              <linearGradient id="trafficGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3B82F6" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#3B82F6" stopOpacity={0} />
              </linearGradient>
            </defs>

            <XAxis 
              dataKey="time" 
              tickLine={false} 
              axisLine={false} 
              stroke="#475569" 
              style={{ fontSize: '10px', fontWeight: 500 }} 
            />
            
            <YAxis 
              domain={[0, 100]} 
              tickCount={5} 
              tickLine={false} 
              axisLine={false} 
              stroke="#475569" 
              style={{ fontSize: '10px', fontWeight: 500 }} 
            />

            <Tooltip 
              contentStyle={{ backgroundColor: '#0D121F', border: '1px solid #334155', borderRadius: '12px', color: '#fff', fontSize: '12px' }}
              itemStyle={{ color: '#3B82F6' }}
            />

            <Area 
              type="monotone" 
              dataKey="traffic" 
              stroke="#3B82F6" 
              strokeWidth={2} 
              fillOpacity={1} 
              fill="url(#trafficGrad)" 
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}