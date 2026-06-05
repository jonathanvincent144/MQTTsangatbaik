/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { Thermometer, Droplets, Clock, Activity } from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { SensorRecord } from "../types";

interface SensoryPanelProps {
  currentTemp: number | null;
  currentHumidity: number | null;
  sensorHistory: SensorRecord[];
  lastUpdate: Date | null;
  activeBrokerName: string;
}

export const SensoryPanel: React.FC<SensoryPanelProps> = ({
  currentTemp,
  currentHumidity,
  sensorHistory,
  lastUpdate,
  activeBrokerName,
}) => {
  // Format history for recharts
  const chartData = sensorHistory.map((item) => ({
    time: new Date(item.timestamp).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }),
    Suhu: parseFloat(item.suhu.toFixed(1)),
    Kelembaban: parseFloat(item.kelembaban.toFixed(1)),
  }));

  const formattedTime = lastUpdate
    ? lastUpdate.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
    : "--:--:--";

  const tempPercent = currentTemp !== null ? Math.min(100, Math.max(0, (currentTemp / 50) * 100)) : 0;
  const humPercent = currentHumidity !== null ? Math.min(100, Math.max(0, currentHumidity)) : 0;

  return (
    <div className="flex flex-col gap-6" id="sensory-panel-root">
      {/* Temperature Card */}
      <div
        className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm flex flex-col justify-between transition-all hover:shadow-md hover:border-slate-300 group"
        id="temp-card"
      >
        <div className="flex justify-between items-start mb-4">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">
            Ambient Temperature
          </div>
          <span className="text-[10px] font-mono text-slate-400 bg-slate-50 px-2 py-0.5 rounded border border-slate-100">
            DHT11 Celsius
          </span>
        </div>
        <div>
          <div className="flex items-end gap-1">
            <span className="text-5xl font-light text-slate-800 tracking-tight">
              {currentTemp !== null ? currentTemp.toFixed(1) : "28.5"}
            </span>
            <span className="text-2xl text-slate-400 mb-1 font-light font-sans">°C</span>
          </div>
          
          {/* Dynamic Progress Line */}
          <div className="mt-4 h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
            <div 
              className="h-full bg-amber-500 rounded-full transition-all duration-500 ease-out" 
              style={{ width: `${currentTemp !== null ? tempPercent : 57}%` }}
            />
          </div>
          
          <p className="text-[11px] text-slate-400 mt-2 flex justify-between">
            <span>Suhu lingkungan aktual</span>
            <span className="font-mono text-slate-500 text-[10px]">{formattedTime}</span>
          </p>
        </div>
      </div>

      {/* Humidity Card */}
      <div
        className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm flex flex-col justify-between transition-all hover:shadow-md hover:border-slate-300 group"
        id="humidity-card"
      >
        <div className="flex justify-between items-start mb-4">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">
            Relative Humidity
          </div>
          <span className="text-[10px] font-mono text-slate-400 bg-slate-50 px-2 py-0.5 rounded border border-slate-100">
            DHT11 Percent
          </span>
        </div>
        <div>
          <div className="flex items-end gap-1">
            <span className="text-5xl font-light text-slate-800 tracking-tight">
              {currentHumidity !== null ? currentHumidity.toFixed(1) : "64.0"}
            </span>
            <span className="text-2xl text-slate-400 mb-1 font-light font-sans">%</span>
          </div>

          {/* Dynamic Progress Line */}
          <div className="mt-4 h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
            <div 
              className="h-full bg-blue-500 rounded-full transition-all duration-500 ease-out" 
              style={{ width: `${currentHumidity !== null ? humPercent : 64}%` }}
            />
          </div>

          <p className="text-[11px] text-slate-400 mt-2 flex justify-between">
            <span>Kelembaban udara relatif</span>
            <span className="font-semibold text-slate-500 truncate max-w-[130px]" title={activeBrokerName}>
              {activeBrokerName.split(" ")[1] || "Broker"}
            </span>
          </p>
        </div>
      </div>

      {/* Real-time Trend Chart */}
      <div
        className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm flex flex-col justify-between transition-all hover:shadow-md"
        id="realtime-trend-chart"
      >
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">
            Real-time Metrics Trend
          </div>
          <span className="flex items-center gap-1.5 text-[10px] font-mono font-medium text-emerald-500 bg-emerald-50 px-2 py-0.5 rounded-full animate-pulse border border-emerald-100">
            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span> LIVE
          </span>
        </div>
        <p className="text-[11px] text-slate-400 mb-4">
          Grafik fluktuasi 15 data suhu (°C) dan kelembaban (%) terakhir
        </p>

        <div className="h-44 w-full">
          {chartData.length === 0 ? (
            <div className="w-full h-full flex flex-col items-center justify-center border border-dashed border-slate-200 rounded-xl bg-slate-50/50 p-4 text-center">
              <span className="text-xs font-sans text-slate-400">
                Hubungkan MQTT broker dan tunggu sensor mengirim data...
              </span>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorTemp" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f97316" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorHum" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="time" tick={{ fontSize: 9 }} stroke="#94a3b8" />
                <YAxis domain={["auto", "auto"]} tick={{ fontSize: 9 }} stroke="#94a3b8" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "rgba(255, 255, 255, 0.95)",
                    borderRadius: "12px",
                    border: "1px solid #e2e8f0",
                    boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.05)",
                    fontSize: "11px",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="Suhu"
                  stroke="#f97316"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorTemp)"
                />
                <Area
                  type="monotone"
                  dataKey="Kelembaban"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorHum)"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
};
