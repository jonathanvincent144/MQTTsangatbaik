/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { Terminal, Trash2, Filter, AlertCircle, CheckCircle, Info, Radio, Brain } from "lucide-react";
import { ActivityLog } from "../types";

interface ActivityLogPanelProps {
  logs: ActivityLog[];
  onClearLogs: () => void;
}

export const ActivityLogPanel: React.FC<ActivityLogPanelProps> = ({ logs, onClearLogs }) => {
  const [filterType, setFilterType] = useState<string>("all");
  const [filterSource, setFilterSource] = useState<string>("all");

  const filteredLogs = logs.filter((log) => {
    const matchesType = filterType === "all" || log.type === filterType;
    const matchesSource = filterSource === "all" || log.source === filterSource;
    return matchesType && matchesSource;
  });

  const getLogIcon = (type: string) => {
    switch (type) {
      case "success":
        return <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />;
      case "warn":
        return <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />;
      case "command":
        return <Radio className="w-4 h-4 text-blue-500 shrink-0" />;
      case "sensor":
        return <Info className="w-4 h-4 text-indigo-500 shrink-0" />;
      default:
        return <Info className="w-4 h-4 text-slate-400 shrink-0" />;
    }
  };

  const getSourceBadge = (source: string) => {
    switch (source) {
      case "esp32":
        return (
          <span className="text-[10px] font-mono font-bold bg-amber-50 text-amber-700 border border-amber-150 px-1.5 py-0.5 rounded">
            ESP32
          </span>
        );
      case "gemini":
        return (
          <span className="text-[10px] font-mono font-bold bg-purple-50 text-purple-700 border border-purple-150 px-1.5 py-0.5 rounded flex items-center gap-0.5">
            <Brain className="w-2.5 h-2.5" /> GEMINI AI
          </span>
        );
      case "web":
        return (
          <span className="text-[10px] font-mono font-bold bg-sky-50 text-sky-700 border border-sky-150 px-1.5 py-0.5 rounded">
            WEB
          </span>
        );
      default:
        return (
          <span className="text-[10px] font-mono font-bold bg-slate-50 text-slate-600 border border-slate-150 px-1.5 py-0.5 rounded">
            SYSTEM
          </span>
        );
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm flex flex-col h-[480px]" id="activity-log-root">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4 shrink-0">
        <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest">
          Live Activity Timeline
        </h2>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          {/* Type Filter */}
          <div className="flex items-center gap-1.5 text-[10px] text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1">
            <Filter className="w-3 h-3 text-slate-400" />
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="bg-transparent focus:outline-none cursor-pointer text-slate-600 font-sans font-medium"
            >
              <option value="all">Semua Tipe</option>
              <option value="command">Perintah</option>
              <option value="sensor">Sensor</option>
              <option value="success">Sukses</option>
              <option value="warn">Peringatan</option>
            </select>
          </div>

          {/* Source Filter */}
          <div className="flex items-center gap-1.5 text-[10px] text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1">
            <Filter className="w-3 h-3 text-slate-400" />
            <select
              value={filterSource}
              onChange={(e) => setFilterSource(e.target.value)}
              className="bg-transparent focus:outline-none cursor-pointer text-slate-600 font-sans font-medium"
            >
              <option value="all">Semua Sumber</option>
              <option value="esp32">ESP32</option>
              <option value="gemini">Gemini AI</option>
              <option value="web">Web Panel</option>
              <option value="system">Sistem</option>
            </select>
          </div>

          {/* Reset button */}
          <button
            onClick={onClearLogs}
            id="btn-clear-logs"
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-red-100 hover:border-red-200 hover:bg-red-50 text-red-600 text-[10px] font-bold cursor-pointer transition-all ml-auto sm:ml-0 uppercase tracking-wider"
          >
            <Trash2 className="w-3 h-3" /> Bersihkan
          </button>
        </div>
      </div>

      {/* Log list terminal-like */}
      <div
        className="flex-1 overflow-y-auto bg-slate-950 rounded-xl p-4 font-mono text-xs text-slate-300 border border-slate-850 flex flex-col-reverse divide-y divide-slate-900/45 scrollbar-thin scrollbar-thumb-slate-800"
        id="logs-terminal-viewport"
      >
        {filteredLogs.length === 0 ? (
          <div className="m-auto text-slate-500 text-center py-10 font-sans leading-relaxed">
            <p>Tidak ada baris log yang terekam.</p>
            <p className="text-[11px] text-slate-600 mt-1">
              Data atau perintah IoT akan muncul secara dinamis di sini.
            </p>
          </div>
        ) : (
          filteredLogs.map((log) => (
            <div
              key={log.id}
              className={`py-2 px-1 flex items-start sm:items-center justify-between gap-4 transition-colors hover:bg-slate-900/30 first:border-0`}
              id={`log-row-${log.id}`}
            >
              <div className="flex items-start sm:items-center gap-2.5 min-w-0 flex-1">
                {getLogIcon(log.type)}
                <span className="text-[10px] text-slate-500 whitespace-nowrap hidden sm:inline">
                  [{new Date(log.timestamp).toLocaleTimeString()}]
                </span>
                <span className="text-[10px] text-slate-500 whitespace-nowrap sm:hidden">
                  {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
                <p className="text-slate-200 leading-normal truncate">{log.message}</p>
              </div>
              <div className="shrink-0">{getSourceBadge(log.source)}</div>
            </div>
          )).reverse() // Show newest at the top, or bottom based on scrolling (flex-col-reverse handles appending at bottom visually)
        )}
      </div>
    </div>
  );
};
