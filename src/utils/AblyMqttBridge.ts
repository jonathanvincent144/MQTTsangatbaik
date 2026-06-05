import * as Ably from "ably";

/**
 * AblyMqttBridge serves as an MQTT-compatible wrapper around Ably's Realtime SDK.
 * This allows the React web application to connect to Ably's real-time channels
 * over standard WebSockets using Ably's SDK (which is fully supported in browsers),
 * while mapping subscriptions and publishes to look like MQTT.
 * 
 * Slashes '/' in MQTT topic names are mapped to colons ':' in Ably channel names.
 * For example: 'sensor/suhu' maps to the Ably channel 'sensor:suhu'.
 */
export class AblyMqttBridge {
  private ablyClient: Ably.Realtime;
  private listeners: { [event: string]: Function[] } = {};
  private activeSubscriptions = new Map<string, { channel: Ably.RealtimeChannel; subscription: (msg: any) => void }>();
  private isConnected = false;

  constructor(apiKey: string) {
    this.ablyClient = new Ably.Realtime({
      key: apiKey,
      clientId: `AblyWebClient_${Math.random().toString(16).substring(2, 6)}`,
    });

    // Mirror connection states
    this.ablyClient.connection.on("connected", () => {
      this.isConnected = true;
      this.trigger("connect");
    });

    this.ablyClient.connection.on("closed", () => {
      this.isConnected = false;
      this.trigger("close");
    });

    this.ablyClient.connection.on("disconnected", () => {
      this.isConnected = false;
      this.trigger("close");
    });

    this.ablyClient.connection.on("failed", (stateChange) => {
      this.isConnected = false;
      const errMsg = stateChange?.reason?.message || "Ably connection failed";
      this.trigger("error", new Error(errMsg));
    });
  }

  // Register MQTT-style event listeners
  on(event: string, callback: Function) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);

    // If already connected and listener is registered, trigger immediately in next tick
    if (event === "connect" && this.isConnected) {
      setTimeout(() => callback(), 0);
    }

    return this;
  }

  // MQTT-style subscription wrapper
  subscribe(topics: string[], options: any, callback?: (err?: Error | null) => void) {
    try {
      topics.forEach((topic) => {
        // Convert MQTT topic path (e.g. sensor/suhu) to Ably namespace format (sensor:suhu)
        const channelName = topic.replace(/\//g, ":");
        const channel = this.ablyClient.channels.get(channelName);

        if (!this.activeSubscriptions.has(topic)) {
          const subscription = (message: any) => {
            // Buffer-compatible payload mock to align with mqtt.js signature
            const dataString = typeof message.data === "object"
              ? JSON.stringify(message.data)
              : String(message.data);

            const payloadBytes = {
              toString: () => dataString,
              trim: () => dataString.trim(),
            };

            this.trigger("message", topic, payloadBytes);
          };

          channel.subscribe(subscription);
          this.activeSubscriptions.set(topic, { channel, subscription });
        }
      });

      if (callback) {
        setTimeout(() => callback(null), 0);
      }
    } catch (err: any) {
      if (callback) {
        setTimeout(() => callback(err), 0);
      } else {
        this.trigger("error", err);
      }
    }

    return this;
  }

  // MQTT-style publish wrapper
  publish(topic: string, message: string, options?: any, callback?: (err?: Error | null) => void) {
    try {
      const channelName = topic.replace(/\//g, ":");
      const channel = this.ablyClient.channels.get(channelName);

      channel.publish("update", message)
        .then(() => {
          if (callback) callback(null);
        })
        .catch((err) => {
          if (callback) callback(err);
          else this.trigger("error", err);
        });
    } catch (err: any) {
      if (callback) callback(err);
      else this.trigger("error", err);
    }

    return this;
  }

  // Clean closure matching mqtt.js end method
  end(force?: boolean, options?: any, callback?: Function) {
    try {
      this.activeSubscriptions.forEach((sub) => {
        try {
          sub.channel.unsubscribe(sub.subscription);
        } catch (e) {
          console.warn("Error unsubscribing channel during end:", e);
        }
      });
      this.activeSubscriptions.clear();

      this.ablyClient.close();
      this.isConnected = false;

      if (callback) {
        setTimeout(() => callback(), 0);
      }
    } catch (err) {
      if (callback) {
        setTimeout(() => callback(), 0);
      }
    }

    return this;
  }

  private trigger(event: string, ...args: any[]) {
    const list = this.listeners[event];
    if (list) {
      list.forEach((cb) => {
        try {
          cb(...args);
        } catch (e) {
          console.error(`Error in event callback '${event}':`, e);
        }
      });
    }
  }
}
