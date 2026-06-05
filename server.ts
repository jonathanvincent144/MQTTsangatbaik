/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import path from "path";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Lazy-initialized Gemini AI client with metadata header for AI Studio Build
let aiClient: GoogleGenAI | null = null;
function getGemini(): GoogleGenAI {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error("GEMINI_API_KEY environment variable is missing. Please set it in Settings > Secrets.");
    }
    aiClient = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiClient;
}

// API endpoint for processing transcribed voice input and understanding intent
app.post("/api/voice-intent", async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || typeof text !== "string") {
      res.status(400).json({ error: "Missing 'text' inside body of voice-intent request." });
      return;
    }

    const ai = getGemini();
    const systemPrompt = `
      Anda adalah asisten suara pintar untuk sistem IoT kontrol Relay dan Sensor ESP32.
      Tugas Anda adalah menganalisis transkrip perintah suara pengguna (bahasa Indonesia atau Inggris) dan menerjemahkannya menjadi JSON terstruktur untuk dieksekusi secara otomatis oleh antarmuka web MQTT.

      BERIKUT INFORMASI RELAY, BROKER, DAN TOPIK KAMI:
      - Kami memiliki 4 buah Relay (Relay 1, Relay 2, Relay 3, Relay 4).
      - Pengguna seringkali menginstruksikan dengan nama perangkat, contoh: "menyalakan lampu" (biasanya Relay 1), "pompa air" (biasanya Relay 2), "kipas angin" (biasanya Relay 3), atau "pemanas/pendingin" (biasanya Relay 4). Cocokkan istilah ini dengan nomor Relay (1-4).
      - Kata kerja menyalakan: "coba hidupkan", "nyalakan", "tolong nyalakan", "aktifkan", "turn on", "on".
      - Kata kerja mematikan: "matikan", "nonaktifkan", "turn off", "off", "tolong matikan".

      VARIASI RUNNING LED:
      - Variasi Mode 1: sequentially forward 1 -> 2 -> 3 -> 4, dipicu oleh payload "1" ke "kontrol/variasi". Contoh ucapan: "jalankan variasi satu", "running led satu", "nyalakan animasi satu".
      - Variasi Mode 2: sequentially backward 4 -> 3 -> 2 -> 1, dipicu oleh payload "2" ke "kontrol/variasi". Contoh ucapan: "animasi dua", "variasi mundur", "running led dua".
      - Variasi STOP: mengembalikan state ke manual, dipicu oleh payload "STOP" ke "kontrol/variasi". Contoh ucapan: "setop variasi", "matikan variasi", "kembali manual", "hentikan running led".

      BACA SENSOR (SUHU & KELEMBABAN):
      - Jika pengguna bertanya tentang data sensor, contoh: "berapa suhu sekarang?", "bacakan kelembaban", "sebutkan temperatur saat ini", "bagaimana kondisi cuaca kamar?". Maka perintahnya adalah "READ_SENSORS".

      GANTI MQTT PROTOKOL/BROKER:
      - Jika pengguna meminta pergantian broker aktif secara manual, contoh: "ganti ke broker satu", "gunakan ably (broker 2)", "pindah ke broker tiga cedalo", maka perintahnya adalah "SWITCH_BROKER".
      - Target broker:
        * 1 = CloudAMQP (Broker 1)
        * 2 = Ably (Broker 2)
        * 3 = Cedalo (Broker 3)

      Hasilkan format objek JSON murni:
      {
        "command": "RELAY_ON" | "RELAY_OFF" | "VARIASI_MODE" | "VARIASI_STOP" | "READ_SENSORS" | "SWITCH_BROKER" | "UNKNOWN",
        "targetRelay": number // 1, 2, 3, atau 4 (hanya untuk RELAY_ON dan RELAY_OFF)
        "targetVariasi": number // 1 atau 2 (hanya untuk VARIASI_MODE)
        "targetBroker": number // 1, 2, atau 3 (hanya untuk SWITCH_BROKER)
        "actionDescription": string // penjelasan singkat bahasa Indonesia yang natural, sopan dan ramah tentang apa tindakan yang akan diambil (misalnya: "Oke, saya akan menyalakan Relay 1 (Lampu)", "Tentu, saya hentikan mode variasi dan mengembalikan relay ke kontrol manual")
      }
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: `Proses teks berikut: "${text}"`,
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            command: {
              type: Type.STRING,
              enum: ["RELAY_ON", "RELAY_OFF", "VARIASI_MODE", "VARIASI_STOP", "READ_SENSORS", "SWITCH_BROKER", "UNKNOWN"],
              description: "Maksud perintah dari suara"
            },
            targetRelay: {
              type: Type.INTEGER,
              description: "Nomor relay tujuan (1-4)"
            },
            targetVariasi: {
              type: Type.INTEGER,
              description: "Nomor variasi tujuan (1-2)"
            },
            targetBroker: {
              type: Type.INTEGER,
              description: "Nomor broker tujuan (1-3)"
            },
            actionDescription: {
              type: Type.STRING,
              description: "Respons ramah dalam bahasa Indonesia yang mendeskripsikan tindakan yang berhasil diekstraksi."
            }
          },
          required: ["command", "actionDescription"]
        }
      }
    });

    const parsedJson = JSON.parse(response.text || "{}");
    res.json({
      rawText: text,
      parsedIntent: parsedJson,
      aiReport: response.text
    });
  } catch (err: any) {
    console.error("Gemini processing error:", err);
    res.status(500).json({ error: err.message || "Gagal memproses suara menggunakan Gemini AI." });
  }
});

// Configure Vite in dev mode or serve static files in production mode
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Server] running on http://localhost:${PORT}`);
  });
}

startServer();
