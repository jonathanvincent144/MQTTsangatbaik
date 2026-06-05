/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { Wifi, WifiOff, Settings, Check, AlertCircle, Plus, RefreshCw } from "lucide-react";
import { BrokerConfig } from "../types";

interface BrokerConfigPanelProps {
  brokers: BrokerConfig[];
  activeIndex: number;
  connectionStatus: "disconnected" | "connecting" | "connected" | "failed";
  onSelectBroker: (index: number) => void;
  onUpdateBroker: (index: number, updated: BrokerConfig) => void;
  activeBrokerIP: string; // The Broker IP received from ESP32 status/broker topic
}

export const BrokerConfigPanel: React.FC<BrokerConfigPanelProps> = ({
  brokers,
  activeIndex,
  connectionStatus,
  onSelectBroker,
  onUpdateBroker,
  activeBrokerIP,
}) => {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editedConfig, setEditedConfig] = useState<BrokerConfig | null>(null);

  const startEdit = (index: number) => {
    setEditingIndex(index);
    setEditedConfig({ ...brokers[index] });
  };

  const saveEdit = () => {
    if (editingIndex !== null && editedConfig !== null) {
      onUpdateBroker(editingIndex, editedConfig);
      setEditingIndex(null);
      setEditedConfig(null);
    }
  };

  const cancelEdit = () => {
    setEditingIndex(null);
    setEditedConfig(null);
  };

  const getStatusBadge = () => {
    switch (connectionStatus) {
      case "connected":
        return (
          <span className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1 bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-full">
            <Wifi className="w-3.5 h-3.5 animate-pulse" /> Terhubung
          </span>
        );
      case "connecting":
        return (
          <span className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1 bg-amber-50 text-amber-600 border border-amber-100 rounded-full animate-pulse">
            <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Menghubungkan...
          </span>
        );
      case "failed":
        return (
          <span className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1 bg-red-50 text-red-600 border border-red-100 rounded-full">
            <AlertCircle className="w-3.5 h-3.5" /> Gagal Koneksi
          </span>
        );
      default:
        return (
          <span className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1 bg-slate-50 text-slate-500 border border-slate-100 rounded-full">
            <WifiOff className="w-3.5 h-3.5" /> Terputus
          </span>
        );
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm flex flex-col justify-between h-full" id="broker-config-panel-root">
      <div>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest">
            MQTT Connection Cluster
          </h2>
          {getStatusBadge()}
        </div>

        <p className="text-xs text-slate-400 mb-6 font-sans">
          Sistem mendukung 3 broker secara bersamaan. Pilih broker aktif yang ingin Anda dengar dan kendalikan dari browser.
        </p>

        {/* Broker List */}
        <div className="flex flex-col gap-3" id="brokers-list-group">
          {brokers.map((broker, idx) => {
            const isActive = idx === activeIndex;
            const isEditing = idx === editingIndex;

            if (isEditing && editedConfig) {
              return (
                <div
                  key={idx}
                  className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs flex flex-col gap-3"
                  id={`broker-edit-card-${idx}`}
                >
                  <div className="flex items-center justify-between border-b pb-2 border-slate-200">
                    <span className="font-semibold text-slate-700">Ubah Konfigurasi {broker.name}</span>
                    <span className="text-[10px] font-mono text-slate-400">WebSockets wss:// protocol</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] text-slate-400">Host Server</label>
                      <input
                        type="text"
                        value={editedConfig.server}
                        onChange={(e) => setEditedConfig({ ...editedConfig, server: e.target.value })}
                        className="p-1 px-2 border rounded font-mono bg-white text-slate-800"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] text-slate-400">WebSocket Port</label>
                      <input
                        type="number"
                        value={editedConfig.wsPort}
                        onChange={(e) => setEditedConfig({ ...editedConfig, wsPort: parseInt(e.target.value) || 443 })}
                        className="p-1 px-2 border rounded font-mono bg-white text-slate-800"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] text-slate-400">Username</label>
                      <input
                        type="text"
                        value={editedConfig.user}
                        onChange={(e) => setEditedConfig({ ...editedConfig, user: e.target.value })}
                        className="p-1 px-2 border rounded font-mono bg-white text-slate-800"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] text-slate-400">Password</label>
                      <input
                        type="password"
                        value={editedConfig.pass}
                        onChange={(e) => setEditedConfig({ ...editedConfig, pass: e.target.value })}
                        className="p-1 px-2 border rounded font-mono bg-white text-slate-800"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] text-slate-400">WS Path (e.g. /ws, /mqtt)</label>
                      <input
                        type="text"
                        value={editedConfig.wsPath}
                        onChange={(e) => setEditedConfig({ ...editedConfig, wsPath: e.target.value })}
                        className="p-1 px-2 border rounded font-mono bg-white text-slate-800"
                      />
                    </div>
                    {editedConfig.vhost !== undefined && (
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] text-slate-400">VHost (RabbitMQ)</label>
                        <input
                          type="text"
                          value={editedConfig.vhost || ""}
                          onChange={(e) => setEditedConfig({ ...editedConfig, vhost: e.target.value || null })}
                          className="p-1 px-2 border rounded font-mono bg-white text-slate-800"
                        />
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2 justify-end mt-2">
                    <button
                      onClick={cancelEdit}
                      className="px-2.5 py-1 text-slate-500 rounded hover:bg-slate-200 font-semibold cursor-pointer"
                    >
                      Batal
                    </button>
                    <button
                      onClick={saveEdit}
                      className="px-2.5 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 font-semibold cursor-pointer"
                    >
                      Simpan
                    </button>
                  </div>
                </div>
              );
            }

            return (
              <div
                key={idx}
                className={`p-3.5 rounded-xl border flex items-center justify-between transition-all ${
                  isActive
                    ? "bg-blue-50/50 border-blue-200 ring-4 ring-blue-50"
                    : "bg-white border-slate-200 hover:border-slate-350 hover:bg-slate-50/30"
                }`}
                id={`broker-card-${idx}`}
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <button
                    onClick={() => onSelectBroker(idx)}
                    className={`p-2 rounded-full border transition-all shrink-0 cursor-pointer ${
                      isActive
                        ? "bg-blue-600 text-white border-blue-600"
                        : "bg-slate-50 hover:bg-slate-100 text-slate-400 border-slate-200"
                    }`}
                  >
                    <Check className={`w-3.5 h-3.5 ${isActive ? "opacity-100" : "opacity-0"}`} />
                  </button>

                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-sans font-bold text-slate-800 truncate" title={broker.name}>
                      {broker.name}
                    </div>
                    <div className="text-[10px] font-mono text-slate-400 truncate mt-0.5" title={broker.server}>
                      wss://{broker.server}:{broker.wsPort}{broker.wsPath}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 ml-2">
                  <button
                    onClick={() => startEdit(idx)}
                    className="p-1.5 text-slate-400 hover:text-slate-600 rounded hover:bg-slate-100 cursor-pointer transition-colors"
                    title="Ubah konfigurasi broker"
                  >
                    <Settings className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {activeBrokerIP && (
        <div className="mt-6 p-3.5 bg-blue-50/40 rounded-xl border border-blue-100 text-[10px] text-blue-800 flex items-start gap-2 leading-normal font-sans">
          <Wifi className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
          <div>
            <strong>Info Sinkronisasi Alat:</strong> ESP32 saat ini mempublikasikan status bahwa ia terhubung dengan broker: <code className="bg-white px-1.5 py-0.5 border border-blue-150 rounded text-blue-950 font-bold font-mono">{activeBrokerIP}</code>. Pastikan web panel ini tersambung ke broker yang sama untuk mengontrol relay secara real-time.
          </div>
        </div>
      )}
    </div>
  );
};
