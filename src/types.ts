/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface BrokerConfig {
  name: string;
  server: string;
  port: number; // TCP TLS port or WebSocket port
  wsPort: number; // Browser WebSocket port
  wsPath: string; // Websocket path (e.g. /ws, /mqtt, or empty)
  user: string;
  pass: string;
  client_id: string;
  vhost?: string | null;
}

export interface RelayState {
  relay1: boolean;
  relay2: boolean;
  relay3: boolean;
  relay4: boolean;
}

export interface SensorRecord {
  timestamp: string; // ISO string or relative
  suhu: number;
  kelembaban: number;
  broker: string;
}

export interface ActivityLog {
  id: string;
  timestamp: string;
  type: 'info' | 'command' | 'warn' | 'success' | 'sensor';
  message: string;
  source: 'web' | 'esp32' | 'gemini' | 'system';
}

export interface VoiceIntentResponse {
  rawText: string;
  parsedIntent: {
    command: 'RELAY_ON' | 'RELAY_OFF' | 'VARIASI_MODE' | 'VARIASI_STOP' | 'READ_SENSORS' | 'SWITCH_BROKER' | 'UNKNOWN';
    targetRelay?: number; // 1, 2, 3, 4
    targetVariasi?: number; // 1, 2
    targetBroker?: number; // 1, 2, 3
    actionDescription?: string;
  };
  aiReport: string;
}
