/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from "react";
import mqtt from "mqtt";
import { Cpu, Wifi, Radio, Server, MessageSquare, Plus, Check } from "lucide-react";
import { BrokerConfig, RelayState, SensorRecord, ActivityLog } from "./types";
import { SensoryPanel } from "./components/SensoryPanel";
import { RelayStatusPanel } from "./components/RelayStatusPanel";
import { BrokerConfigPanel } from "./components/BrokerConfigPanel";
import { VoiceControlPanel } from "./components/VoiceControlPanel";
import { ActivityLogPanel } from "./components/ActivityLogPanel";
import { AblyMqttBridge } from "./utils/AblyMqttBridge";

const DEFAULT_BROKERS: BrokerConfig[] = [
  {
    name: "Broker 1 (CloudAMQP - RabbitMQ)",
    server: "kingfisher.lmq.cloudamqp.com",
    port: 8883,
    wsPort: 443,
    wsPath: "/ws",
    user: "lziinrjb",
    pass: "NwNopYcfW7CU8oujNwvSH5HMcDO8toQj",
    client_id: "ESP32AMQPWeb",
    vhost: "lziinrjb"
  },
  {
    name: "Broker 2 (Ably - AblyWeb)",
    server: "mqtt.ably.io",
    port: 8883,
    wsPort: 443,
    wsPath: "/",
    user: "2Hz50g.IkSfbw",
    pass: "zwBzMos1xeBawVKWvWDlSbcxzijDa-jQViBMPWN7HRQ",
    client_id: "AblyWeb",
    vhost: null
  },
  {
    name: "Broker 3 (Cedalo - Pro Mosquitto)",
    server: "pf-l6rvh5uuefqnek6dwyef.cedalo.cloud",
    port: 8883,
    wsPort: 443,
    wsPath: "/mqtt",
    user: "Web",
    pass: "a",
    client_id: "WebClient",
    vhost: null
  }
];

export default function App() {
  // ---- Localstorage Initialization ----
  const [brokers, setBrokers] = useState<BrokerConfig[]>(() => {
    const saved = localStorage.getItem("iot_brokers");
    const parsed = saved ? JSON.parse(saved) : DEFAULT_BROKERS;
    // Migrate Ably broker URL if it's still using the old URL
    if (parsed) {
      parsed.forEach((b: BrokerConfig) => {
        if (b.server === "main.mqtt.ably.net") {
          b.server = "mqtt.ably.io";
        }
        if (b.server === "mqtt.ably.io" && (!b.wsPath || b.wsPath.trim() === "")) {
          b.wsPath = "/";
        }
      });
    }
    // Force Broker 3 (index 2) to always have client_id as "WebClient"
    if (parsed && parsed[2]) {
      parsed[2].client_id = "WebClient";
    }
    return parsed;
  });

  const [activeIndex, setActiveIndex] = useState<number>(() => {
    const saved = localStorage.getItem("iot_active_idx");
    return saved ? parseInt(saved, 10) : 0;
  });

  const [sensorHistory, setSensorHistory] = useState<SensorRecord[]>(() => {
    const saved = localStorage.getItem("iot_sensor_history");
    return saved ? JSON.parse(saved) : [];
  });

  const [logs, setLogs] = useState<ActivityLog[]>(() => {
    const saved = localStorage.getItem("iot_activity_logs");
    return saved ? JSON.parse(saved) : [
      {
        id: "initial",
        timestamp: new Date().toISOString(),
        type: "info",
        message: "Sistem web panel diinisialisasi.",
        source: "system"
      }
    ];
  });

  // ---- Shared States ----
  const [connectionStatus, setConnectionStatus] = useState<"disconnected" | "connecting" | "connected" | "failed">("disconnected");
  
  const [relayState, setRelayState] = useState<RelayState>({
    relay1: false,
    relay2: false,
    relay3: false,
    relay4: false,
  });

  const [variasiMode, setVariasiMode] = useState<number>(0);
  const [currentTemp, setCurrentTemp] = useState<number | null>(null);
  const [currentHumidity, setCurrentHumidity] = useState<number | null>(null);
  const currentHumidityRef = useRef<number | null>(null);
  
  useEffect(() => {
    currentHumidityRef.current = currentHumidity;
  }, [currentHumidity]);

  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [activeBrokerIP, setActiveBrokerIP] = useState<string>("");

  const mqttClientRef = useRef<any>(null);

  // ---- Sync State with LocalStorage ----
  useEffect(() => {
    localStorage.setItem("iot_brokers", JSON.stringify(brokers));
  }, [brokers]);

  useEffect(() => {
    localStorage.setItem("iot_active_idx", String(activeIndex));
  }, [activeIndex]);

  useEffect(() => {
    localStorage.setItem("iot_sensor_history", JSON.stringify(sensorHistory.slice(-50))); // Cap at 50 in storage
  }, [sensorHistory]);

  useEffect(() => {
    localStorage.setItem("iot_activity_logs", JSON.stringify(logs.slice(-100))); // Cap at 100 in storage
  }, [logs]);

  // ---- Helper for Logging ----
  const addLog = useCallback((message: string, type: ActivityLog["type"] = "info", source: ActivityLog["source"] = "system") => {
    const newLog: ActivityLog = {
      id: Math.random().toString(36).substr(2, 9),
      timestamp: new Date().toISOString(),
      type,
      message,
      source,
    };
    setLogs((prev) => [...prev, newLog].slice(-100)); // Maintain rolling active buffer
  }, []);

  // ---- WebSocket MQTT Connection Setup ----
  const connectToActiveBroker = useCallback(() => {
    // 1. Clean up existing client
    if (mqttClientRef.current) {
      addLog(`Disconnecting dari broker sebelumnya...`, "info", "system");
      mqttClientRef.current.end();
      mqttClientRef.current = null;
    }

    const broker = brokers[activeIndex];
    setConnectionStatus("connecting");
    addLog(`Menghubungkan ke ${broker.name}...`, "info", "system");

    // Construct WebSocket client URL
    const wsUrl = `wss://${broker.server}:${broker.wsPort}${broker.wsPath}`;
    
    // Configure username & password according to broker provider requirements
    let username = broker.user;
    let password = broker.pass;

    if (broker.server.includes("ably")) {
      // Ably basic authentication requires the full API key as the username, and the password MUST be left empty or blank
      username = `${broker.user}:${broker.pass}`;
      password = "";
    } else if (broker.vhost && broker.vhost.trim() !== "") {
      // CloudAMQP (RabbitMQ) requires user:pass logins with strict vhost formatting
      username = `${broker.vhost}:${broker.user}`;
    }

    // Use exactly "WebClient" as the clientId for Broker 3. For others, give a randomized suffix to avoid client_id collision with the physical ESP32.
    const clientId = broker.client_id === "WebClient" || activeIndex === 2
      ? "WebClient"
      : `${broker.client_id}_Web_${Math.random().toString(16).substring(2, 6)}`;

    const clientOptions = {
      clientId,
      username,
      password,
      keepalive: 60,
      clean: true,          // Force clean session to discard any stored QoS 1 or QoS 2 packet handshaking residues
      cleanSession: true,   // Backwards compatibility with standard WebSocket gateways
      protocolVersion: 4 as const, // Explicitly use MQTT v3.1.1 to bypass MQTT v5 packet handshake irregularities
      reconnectPeriod: 5000, // Try to reconnect every 5s if drops
      connectTimeout: 10 * 1000,
    };

    try {
      let client;
      if (broker.server.includes("ably")) {
        const apiKey = `${broker.user}:${broker.pass}`;
        client = new AblyMqttBridge(apiKey);
      } else {
        client = mqtt.connect(wsUrl, clientOptions);
      }
      mqttClientRef.current = client;

      client.on("connect", () => {
        setConnectionStatus("connected");
        addLog(`Koneksi Sukses! Terbuka pada URI: ${broker.server}`, "success", "system");

        // Subscribe to standard telemetry, controls, and active broker statuses (forced to QoS 0)
        client.subscribe([
          "sensor/suhu",
          "sensor/kelembaban",
          "status/broker",
          "kontrol/relay1",
          "kontrol/relay2",
          "kontrol/relay3",
          "kontrol/relay4",
          "kontrol/variasi",
          "kontrol/broker",
        ], { qos: 0 }, (err) => {
          if (!err) {
            addLog("Berhasil mendengarkan semua topik sensor & kontrol.", "success", "system");
          } else {
            addLog("Gagal langganan topik: " + err.message, "warn", "system");
          }
        });
      });

      client.on("message", (topic, payload) => {
        const message = payload.toString().trim();

        // 1. Temperature Telemetry
        if (topic === "sensor/suhu") {
          const val = parseFloat(message);
          if (!isNaN(val)) {
            setCurrentTemp(val);
            setLastUpdate(new Date());
            setSensorHistory((prev) => {
              const newRecord: SensorRecord = {
                timestamp: new Date().toISOString(),
                suhu: val,
                kelembaban: currentHumidityRef.current || 0,
                broker: broker.name,
              };
              return [...prev, newRecord].slice(-15); // visual cap 15 on current browser trend
            });
            addLog(`Suhu terupdate: ${val.toFixed(1)}°C`, "sensor", "esp32");
          }
        }

        // 2. Humidity Telemetry
        else if (topic === "sensor/kelembaban") {
          const val = parseFloat(message);
          if (!isNaN(val)) {
            setCurrentHumidity(val);
            setLastUpdate(new Date());
            addLog(`Kelembaban terupdate: ${val.toFixed(1)}%`, "sensor", "esp32");
          }
        }

        // 3. Physical ESP32 Target Broker Confirmation
        else if (topic === "status/broker") {
          // Payload format: BROKER:1|kingfisher.lmq.cloudamqp.com
          setActiveBrokerIP(message);
          addLog(`Alat fisik melaporkan status koneksi: "${message}"`, "info", "esp32");
        }

        // 4. Synchronization of Controls (if changed by another browser/voice command)
        else if (topic === "kontrol/variasi") {
          if (message === "1") {
            setVariasiMode(1);
            addLog("Sinkronisasi: Variasi Mode 1 diaktifkan.", "info", "esp32");
          } else if (message === "2") {
            setVariasiMode(2);
            addLog("Sinkronisasi: Variasi Mode 2 diaktifkan.", "info", "esp32");
          } else if (message === "STOP") {
            setVariasiMode(0);
            addLog("Sinkronisasi: Variasi dihentikan. Kembali ke manual.", "success", "esp32");
          }
        } 
        
        else if (topic.startsWith("kontrol/relay")) {
          const matchIdx = topic.match(/kontrol\/relay(\d)/);
          if (matchIdx) {
            const num = parseInt(matchIdx[1], 10);
            const isOn = message === "ON";
            setRelayState((prev) => {
              const stateKey = `relay${num}` as keyof RelayState;
              return { ...prev, [stateKey]: isOn };
            });
            addLog(`Sinkronisasi: Switch Relay ${num} dipicu ke [${message}]`, "info", "esp32");
          }
        }
      });

      client.on("error", (err) => {
        setConnectionStatus("failed");
        const errMsg = err.message || "";
        const isHeaderFlagErr = errMsg.toLowerCase().includes("header flag bits") || 
                                errMsg.toLowerCase().includes("both qos bits") || 
                                errMsg.toLowerCase().includes("qos") || 
                                errMsg.toLowerCase().includes("pubcomp");

        if (isHeaderFlagErr) {
          console.warn("MQTT Handled Protocol Warning:", errMsg);
          addLog(`Kesalahan Protokol (QoS / Flag Bits): Terdeteksi perilaku paket non-standar di broker ini. Mencoba menghubungkan kembali otomatis...`, "warn", "system");
        } else if (errMsg.toLowerCase().includes("not authorized") || errMsg.toLowerCase().includes("credentials") || errMsg.toLowerCase().includes("auth")) {
          console.warn("MQTT Auth Warning:", err);
          addLog(`Gagal Otorisasi: Username atau Password salah untuk broker ini. Silakan periksa & perbarui rincian login di panel kiri.`, "warn", "system");
          try {
            client.end(true); // Force end connection and clear reconnect timers of the unauthorized broker client
          } catch (e) {
            console.warn("Gagal menutup client setelah deotorisasi:", e);
          }
        } else {
          console.warn("MQTT Connection Warning:", err);
          addLog(`Peringatan: Gagal terhubung ke MQTT websocket (${errMsg}). Periksa keamanan port sertifikat SSL Anda.`, "warn", "system");
        }
      });

      client.on("close", () => {
        setConnectionStatus("disconnected");
        addLog("Koneksi ditutup.", "info", "system");
      });

    } catch (error: any) {
      console.error(error);
      setConnectionStatus("failed");
      addLog("Gagal instansiasi client MQTT: " + error.message, "warn", "system");
    }
  }, [brokers, activeIndex, addLog]);

  // Run on active index change
  useEffect(() => {
    connectToActiveBroker();
    return () => {
      if (mqttClientRef.current) {
        mqttClientRef.current.end();
      }
    };
  }, [activeIndex]);

  // ---- Command Publisher ----
  const publishCommand = useCallback((topic: string, message: string) => {
    if (mqttClientRef.current && connectionStatus === "connected") {
      mqttClientRef.current.publish(topic, message, { qos: 0 });
      addLog(`Mempublikasi ke ${topic}: "${message}"`, "command", "web");
    } else {
      addLog(`Perintah gagal dikirim: Browser sedang luring dari broker!`, "warn", "system");
      alert("Browser sedang terputus dari MQTT broker. Silakan hubungkan kembali.");
    }
  }, [connectionStatus, addLog]);

  // ---- Control Handler Callbacks ----
  const handleToggleRelay = useCallback((relayNum: number) => {
    if (variasiMode !== 0) return; // Ignore if variasi is running

    const relayKey = `relay${relayNum}` as keyof RelayState;
    const nextState = !relayState[relayKey];
    const payload = nextState ? "ON" : "OFF";
    
    // Update locally immediately for instantaneous UI snappy response
    setRelayState((prev) => ({ ...prev, [relayKey]: nextState }));
    
    // Publish
    publishCommand(`kontrol/relay${relayNum}`, payload);
  }, [relayState, variasiMode, publishCommand]);

  const handleStartVariasi = useCallback((mode: number) => {
    setVariasiMode(mode);
    publishCommand("kontrol/variasi", String(mode));
  }, [publishCommand]);

  const handleStopVariasi = useCallback(() => {
    setVariasiMode(0);
    publishCommand("kontrol/variasi", "STOP");
  }, [publishCommand]);

  const handleSelectBroker = useCallback((idx: number) => {
    if (idx === activeIndex) return;

    if (mqttClientRef.current && connectionStatus === "connected") {
      addLog(`Menghubungi alat fisik untuk beralih ke Broker ${idx + 1}...`, "command", "web");
      
      let hasTransitioned = false;
      const transitionToNewBroker = () => {
        if (hasTransitioned) return;
        hasTransitioned = true;
        setActiveIndex(idx);
        addLog(`Browser aktif beralih ke Broker ${idx + 1}...`, "info", "system");
      };

      // 800ms fallback/guarantee timer so we don't block the UI forever
      const fallbackTimer = setTimeout(() => {
        transitionToNewBroker();
      }, 800);

      try {
        mqttClientRef.current.publish("kontrol/broker", String(idx + 1), { qos: 0 }, (err: any) => {
          clearTimeout(fallbackTimer);
          if (err) {
            addLog(`Gagal mengirim sinyal beralih ke ESP32: ${err.message || err}`, "warn", "system");
          } else {
            addLog(`Perintah beralih berhasil terkirim. Mengizinkan jeda transmisi WiFi...`, "success", "system");
          }
          // Brief 200ms additional breathing room for buffer flush before closing client
          setTimeout(transitionToNewBroker, 200);
        });
      } catch (err: any) {
        clearTimeout(fallbackTimer);
        addLog(`Pengecualian saat mengirim perintah beralih: ${err.message || err}`, "warn", "system");
        transitionToNewBroker();
      }
    } else {
      setActiveIndex(idx);
      addLog(`Mengganti browser aktif ke Broker ${idx + 1}...`, "info", "system");
    }
  }, [activeIndex, connectionStatus, addLog]);

  const handleUpdateBroker = useCallback((idx: number, updated: BrokerConfig) => {
    setBrokers((prev) => {
      const copy = [...prev];
      copy[idx] = updated;
      return copy;
    });
    addLog(`Konfigurasi Broker ${idx + 1} berhasil diperbarui.`, "success", "system");
    
    // Re-connect if it is the current active index!
    if (idx === activeIndex) {
      setTimeout(() => connectToActiveBroker(), 200);
    }
  }, [activeIndex, connectToActiveBroker, addLog]);

  // ---- Speech Command execution callback ----
  const handleVoiceCommandExecute = useCallback((parsed: any) => {
    const { command, targetRelay, targetVariasi, targetBroker } = parsed;

    switch (command) {
      case "RELAY_ON":
        if (targetRelay >= 1 && targetRelay <= 4) {
          const relayKey = `relay${targetRelay}` as keyof RelayState;
          if (variasiMode !== 0) {
            addLog("Instruksi manual ditolak karena run led (variasi) aktif.", "warn", "gemini");
            break;
          }
          setRelayState((prev) => ({ ...prev, [relayKey]: true }));
          publishCommand(`kontrol/relay${targetRelay}`, "ON");
        }
        break;

      case "RELAY_OFF":
        if (targetRelay >= 1 && targetRelay <= 4) {
          const relayKey = `relay${targetRelay}` as keyof RelayState;
          if (variasiMode !== 0) {
            addLog("Instruksi manual ditolak karena run led (variasi) aktif.", "warn", "gemini");
            break;
          }
          setRelayState((prev) => ({ ...prev, [relayKey]: false }));
          publishCommand(`kontrol/relay${targetRelay}`, "OFF");
        }
        break;

      case "VARIASI_MODE":
        if (targetVariasi === 1 || targetVariasi === 2) {
          setVariasiMode(targetVariasi);
          publishCommand("kontrol/variasi", String(targetVariasi));
        }
        break;

      case "VARIASI_STOP":
        setVariasiMode(0);
        publishCommand("kontrol/variasi", "STOP");
        break;

      case "SWITCH_BROKER":
        if (targetBroker >= 1 && targetBroker <= 3) {
          handleSelectBroker(targetBroker - 1);
        }
        break;
      
      case "READ_SENSORS":
        // Voiced feedback generated inside component itself safely!
        break;

      default:
        addLog("Suara dipahami namun tidak ada perintah eksekusi yang valid.", "info", "gemini");
    }
  }, [variasiMode, publishCommand, handleSelectBroker, addLog]);

  return (
    <div className="min-h-screen bg-[#f1f5f9] text-slate-800 font-sans antialiased" id="main-app-container">
      {/* Elegant Fixed Dashboard Navigation Header */}
      <header className="sticky top-0 bg-white/80 backdrop-blur-md border-b border-slate-200 z-50 py-4 px-6 md:px-8 shadow-sm" id="nav-header">
        <div className="max-w-[1600px] mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center text-white shadow-xs">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg md:text-xl font-bold text-slate-900 tracking-tight font-display flex items-center gap-1.5">
                ESP32 MQTT Relay Console
              </h1>
              <p className="text-[10px] text-slate-500 font-mono uppercase tracking-wider block mt-0.5">
                System Version 4.2.1-PRO &bull; Voice System
              </p>
            </div>
          </div>

          <div className="flex items-center gap-6 shrink-0">
            {connectionStatus === "connected" ? (
              <div className="flex items-center gap-2 px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-full">
                <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                <span className="text-[10px] font-bold uppercase tracking-wider">System Online</span>
              </div>
            ) : connectionStatus === "connecting" ? (
              <div className="flex items-center gap-2 px-3 py-1 bg-amber-50 text-amber-700 border border-amber-100 rounded-full">
                <span className="w-2 h-2 bg-amber-500 rounded-full animate-ping"></span>
                <span className="text-[10px] font-bold uppercase tracking-wider">Connecting...</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 px-3 py-1 bg-rose-50 text-rose-700 border border-rose-100 rounded-full">
                <span className="w-2 h-2 bg-rose-500 rounded-full"></span>
                <span className="text-[10px] font-bold uppercase tracking-wider">System Offline</span>
              </div>
            )}

            <div className="text-right hidden md:block">
              <div className="text-sm font-semibold text-slate-700 font-sans">
                {brokers[activeIndex].name.split(" ")[1] || "Broker"} (Active)
              </div>
              <div className="text-[10px] text-slate-400 font-mono">
                {brokers[activeIndex].server}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Dashboard Wrapper */}
      <main className="max-w-[1600px] mx-auto p-4 md:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 pb-16" id="dashboard-main-view">
        {/* Column 1 (Left): Broker Configuration & Voice inputs */}
        <div className="lg:col-span-3 flex flex-col gap-6" id="sidebar-left">
          <BrokerConfigPanel
            brokers={brokers}
            activeIndex={activeIndex}
            connectionStatus={connectionStatus}
            onSelectBroker={handleSelectBroker}
            onUpdateBroker={handleUpdateBroker}
            activeBrokerIP={activeBrokerIP}
          />
          <VoiceControlPanel
            currentTemp={currentTemp}
            currentHumidity={currentHumidity}
            onExecuteCommand={handleVoiceCommandExecute}
            onSpeechLog={(msg, source, type) => addLog(msg, type, source)}
            isConnected={connectionStatus === "connected"}
          />
        </div>

        {/* Column 2 (Middle): Relay switches grid & Animation patterns */}
        <div className="lg:col-span-6 flex flex-col gap-6" id="middle-content">
          <RelayStatusPanel
            relayState={relayState}
            variasiMode={variasiMode}
            onToggleRelay={handleToggleRelay}
            onStartVariasi={handleStartVariasi}
            onStopVariasi={handleStopVariasi}
            isConnected={connectionStatus === "connected"}
          />
        </div>

        {/* Column 3 (Right): Sensory Metrics & Live Activity Timeline */}
        <div className="lg:col-span-3 flex flex-col gap-6" id="sidebar-right">
          <SensoryPanel
            currentTemp={currentTemp}
            currentHumidity={currentHumidity}
            sensorHistory={sensorHistory}
            lastUpdate={lastUpdate}
            activeBrokerName={brokers[activeIndex].name}
          />
          <ActivityLogPanel
            logs={logs}
            onClearLogs={() => setLogs([])}
          />
        </div>
      </main>

      {/* Small Elegant Footer */}
      <footer className="w-full bg-white border-t border-slate-200 py-4 px-8 flex flex-col sm:flex-row justify-between items-center gap-2 select-none" id="dashboard-footer">
        <div className="flex gap-4 text-[10px] font-mono text-slate-400">
          <span>SSID: ESP32_HOTSPOT</span>
          <span>IP: {activeBrokerIP ? activeBrokerIP.split("|")[1] || "192.168.1.100" : "192.168.1.104"}</span>
          <span>RSSI: -54 dBm</span>
        </div>
        <div className="text-[10px] text-slate-400 uppercase tracking-widest font-mono">
          Ready | Powered by Gemini-3.5-flash
        </div>
      </footer>
    </div>
  );
}
