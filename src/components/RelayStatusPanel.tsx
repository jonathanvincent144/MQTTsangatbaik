/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { Play, Square, AlertCircle, Zap } from "lucide-react";
import { RelayState } from "../types";

interface RelayStatusPanelProps {
  relayState: RelayState;
  variasiMode: number; // 0 = STOP, 1 = Mode 1, 2 = Mode 2
  onToggleRelay: (index: number) => void;
  onStartVariasi: (mode: number) => void;
  onStopVariasi: () => void;
  isConnected: boolean;
}

export const RelayStatusPanel: React.FC<RelayStatusPanelProps> = ({
  relayState,
  variasiMode,
  onToggleRelay,
  onStartVariasi,
  onStopVariasi,
  isConnected,
}) => {
  const relays = [
    { id: 1, name: "Relay 01", state: relayState.relay1, desc: "Lampu Utama / Kendali Utama" },
    { id: 2, name: "Relay 02", state: relayState.relay2, desc: "Pompa Air / Kendali Irigasi" },
    { id: 3, name: "Relay 03", state: relayState.relay3, desc: "Kipas Angin / Ventilasi" },
    { id: 4, name: "Relay 04", state: relayState.relay4, desc: "Pemanas Cairan / Heater" },
  ];

  return (
    <div className="flex flex-col gap-6" id="relay-status-panel-root">
      {/* Relays Grid Card */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm" id="relays-grid">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest">
            Manual Relay Actuators
          </h2>
          {variasiMode !== 0 && (
            <span className="flex items-center gap-1.5 text-[10px] text-amber-700 bg-amber-50 border border-amber-100 px-2.5 py-1 rounded-full font-mono font-medium animate-pulse">
              <AlertCircle className="w-3.5 h-3.5" /> Led Sequence Active (Locked)
            </span>
          )}
        </div>

        <p className="text-xs text-slate-400 mb-6 font-sans">
          Klik saklar di bawah ini untuk mengontrol alat secara instan. Fitur manual terkunci aman saat mode variasi berjalan.
        </p>

        {/* 2x2 Clean Widget Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {relays.map((relay) => {
            const isActive = relay.state && variasiMode === 0;
            const isLocked = variasiMode !== 0 || !isConnected;

            return (
              <div
                key={relay.id}
                onClick={() => !isLocked && onToggleRelay(relay.id)}
                id={`relay-card-${relay.id}`}
                className={`p-6 rounded-xl border flex flex-col justify-between h-44 shadow-xs transition-all duration-200 ${
                  isLocked
                    ? "opacity-60 bg-slate-50/50 border-slate-200 cursor-not-allowed"
                    : isActive
                    ? "bg-white border-blue-500 shadow-md ring-4 ring-blue-50 cursor-pointer hover:shadow-lg"
                    : "bg-white border-slate-200 cursor-pointer hover:border-slate-350 hover:shadow-sm"
                }`}
              >
                {/* Header Row: Boxed Icon + Sliding Toggle */}
                <div className="flex justify-between items-start">
                  <div 
                    className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all ${
                      isActive 
                        ? "bg-blue-600 text-white" 
                        : "bg-blue-50 text-blue-600"
                    }`}
                  >
                    <Zap className="w-5 h-5 fill-current" />
                  </div>

                  <div 
                    className={`flex h-6 w-11 items-center rounded-full p-1 cursor-pointer transition-colors duration-200 ${
                      isActive ? "bg-blue-600 justify-end" : "bg-slate-200 justify-start"
                    }`}
                  >
                    <div className="h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200"></div>
                  </div>
                </div>

                {/* Footer Row: Name + Detailed Status */}
                <div>
                  <h3 className="text-lg font-bold text-slate-900 font-display">
                    {relay.name}
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5 truncate" title={relay.desc}>
                    {relay.desc}
                  </p>
                  <p className="text-xs mt-2.5 font-medium">
                    Status:{" "}
                    {isActive ? (
                      <span className="text-blue-600 font-bold uppercase tracking-wider">Active</span>
                    ) : (
                      <span className="text-slate-400 uppercase tracking-wider font-semibold">Inactive</span>
                    )}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {variasiMode !== 0 && (
          <div className="mt-5 p-3.5 bg-amber-50/70 border border-amber-250/20 rounded-xl text-[11px] text-amber-800 flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <span className="leading-relaxed font-sans">
              <strong>Info Keamanan Panel:</strong> Saklar manual di atas dinonaktifkan di peramban karena papan ESP32 sedang mengeksekusi rutin running LED secara independen. Matikan variasi terlebih dahulu di panel sirkuit bawah ini.
            </span>
          </div>
        )}
      </div>

      {/* Variation Sequences Card */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm" id="variation-sequences">
        <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">
          Sequence Patterns (Variasi LED)
        </h2>
        
        <p className="text-xs text-slate-400 mb-6 font-sans">
          Picu sekuen otomatis running LED untuk mengalirkan sinyal pensaklaran dari relay 1 ke 4 secara berkala.
        </p>

        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={() => isConnected && onStartVariasi(1)}
            disabled={!isConnected}
            id="btn-variasi-1"
            className={`flex-1 py-3.5 px-4 rounded-lg font-bold text-sm transition-all flex items-center justify-center gap-2 cursor-pointer ${
              variasiMode === 1
                ? "bg-blue-600 text-white shadow-sm ring-2 ring-blue-100"
                : "bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900"
            }`}
          >
            <Play className="w-4 h-4" />
            PATTERN 01 (1&rarr;4)
          </button>
          
          <button
            onClick={() => isConnected && onStartVariasi(2)}
            disabled={!isConnected}
            id="btn-variasi-2"
            className={`flex-1 py-3.5 px-4 rounded-lg font-bold text-sm transition-all flex items-center justify-center gap-2 cursor-pointer ${
              variasiMode === 2
                ? "bg-blue-600 text-white shadow-sm ring-2 ring-blue-100"
                : "bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900"
            }`}
          >
            <Play className="w-4 h-4" />
            PATTERN 02 (4&rarr;1)
          </button>
          
          <button
            onClick={() => isConnected && onStopVariasi()}
            disabled={!isConnected || variasiMode === 0}
            id="btn-stop-variasi"
            className={`flex-1 py-3.5 px-4 rounded-lg font-bold text-sm transition-all flex items-center justify-center gap-2 ${
              variasiMode === 0
                ? "bg-slate-100 text-slate-350 cursor-not-allowed border border-slate-200/55"
                : "bg-red-600 hover:bg-red-700 text-white cursor-pointer hover:shadow-md"
            }`}
          >
            <Square className="w-4 h-4 fill-current" />
            EMERGENCY STOP
          </button>
        </div>

        <p className="text-[10px] text-center text-slate-400 font-mono mt-4">
          Publishes: <code className="text-slate-500 font-bold bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100">kontrol/variasi</code>
        </p>
      </div>
    </div>
  );
};
