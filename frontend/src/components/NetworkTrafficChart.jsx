import React, { useEffect, useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { fetchNetworkTraffic } from '../services/networkService';

export default function NetworkTrafficChart() {
  const [chartData, setChartData] = useState([]);
  const [loading, setLoading] = useState(true);

  const getTelemetryData = async () => {
    try {
      const data = await fetchNetworkTraffic();
      setChartData(data);
    } catch (err) {
      console.error("Failed to load telemetry data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    getTelemetryData();
    const liveInterval = setInterval(() => { getTelemetryData(); }, 30000); 
    return () => clearInterval(liveInterval);
  }, []);

  if (loading) {
    return (
      <div className="p-6 rounded-3xl bg-[#1D293DED] min-h-[300px] flex items-center justify-center text-slate-400 font-medium">
        Loading Telemetry Stream...
      </div>
    );
  }

  return (
    <div className="p-6 rounded-3xl border border-slate-700/30 shadow-[0_5px_15px_rgba(0,0,0,0.6)] bg-[#1D293DED] font-sans">
      <div className="flex justify-between items-center mb-8">
        <h4 className="text-sm font-medium text-slate-300 m-0">
          Network Traffic (24h)
        </h4>
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