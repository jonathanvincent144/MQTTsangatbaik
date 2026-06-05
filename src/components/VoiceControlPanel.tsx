/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import { Mic, MicOff, Volume2, Info, Send, Brain, CornerDownRight } from "lucide-react";
import { VoiceIntentResponse } from "../types";

interface VoiceControlPanelProps {
  currentTemp: number | null;
  currentHumidity: number | null;
  onExecuteCommand: (command: any) => void;
  onSpeechLog: (message: string, source: 'gemini' | 'system', type: 'info' | 'command' | 'warn' | 'success') => void;
  isConnected: boolean;
}

export const VoiceControlPanel: React.FC<VoiceControlPanelProps> = ({
  currentTemp,
  currentHumidity,
  onExecuteCommand,
  onSpeechLog,
  isConnected,
}) => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [manualInput, setManualInput] = useState("");
  const [aiResponseText, setAiResponseText] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [hasSpeechSupport, setHasSpeechSupport] = useState(false);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    // Check Speech Recognition support
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (SpeechRecognition) {
      setHasSpeechSupport(true);
      const rec = new SpeechRecognition();
      rec.continuous = false;
      rec.interimResults = false;
      rec.lang = "id-ID"; // Default to Indonesian

      rec.onstart = () => {
        setIsListening(true);
        setTranscript("");
        onSpeechLog("Mulai mendengarkan...", "system", "info");
      };

      rec.onerror = (event: any) => {
        console.error("Speech recognition error:", event.error);
        setIsListening(false);
        if (event.error === "not-allowed") {
          onSpeechLog("Izin mikrofon ditolak oleh browser.", "system", "warn");
          alert("Izin Microfon ditolak. Anda dapat menggunakan alternatif input ketik perintah di bawah.");
        } else {
          onSpeechLog(`Error pengenalan suara: ${event.error}`, "system", "warn");
        }
      };

      rec.onend = () => {
        setIsListening(false);
      };

      rec.onresult = (event: any) => {
        const speechToText = event.results[0][0].transcript;
        setTranscript(speechToText);
        onSpeechLog(`Suara terdeteksi: "${speechToText}"`, "system", "success");
        processVoiceCommand(speechToText);
      };

      recognitionRef.current = rec;
    }
  }, []);

  // Browser Text-to-Speech function
  const speakText = (textToSpeak: string) => {
    if ("speechSynthesis" in window) {
      // Cancel any ongoing speaking
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(textToSpeak);
      utterance.lang = "id-ID"; // Speak in Indonesian
      utterance.rate = 1.0;
      utterance.pitch = 1.1;
      window.speechSynthesis.speak(utterance);
    } else {
      console.warn("Speech Synthesis not supported in this browser.");
    }
  };

  const processVoiceCommand = async (text: string) => {
    if (!text.trim()) return;
    setIsProcessing(true);
    setAiResponseText("");

    try {
      // Post transcribed text to our Node.js endpoint parsing with Gemini
      const res = await fetch("/api/voice-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });

      if (!res.ok) {
        throw new Error("Gagal menghubungi server asisten suara.");
      }

      const data: VoiceIntentResponse = await res.json();
      const parsed = data.parsedIntent;

      onSpeechLog(`AI memahami niat: [${parsed.command}] "${parsed.actionDescription}"`, "gemini", "command");
      setAiResponseText(parsed.actionDescription);

      // Speak confirmation out loud!
      let speakPrompt = parsed.actionDescription;

      // Handle custom READ_SENSORS report
      if (parsed.command === "READ_SENSORS") {
        const tempText = currentTemp ? `${currentTemp.toFixed(1)} derajat Celsius` : "belum terekam";
        const humText = currentHumidity ? `${currentHumidity.toFixed(1)} persen` : "belum terekam";
        speakPrompt = `Baik, suhu ruangan saat ini adalah ${tempText}, dan tingkat kelembabannya adalah ${humText}.`;
        setAiResponseText(`Laporan Sensor: Suhu ${currentTemp?.toFixed(1) || "--"}°C | Kelembaban ${currentHumidity?.toFixed(1) || "--"}%`);
      }

      speakText(speakPrompt);

      // Execute command on the dashboard!
      onExecuteCommand(parsed);
    } catch (err: any) {
      console.error(err);
      onSpeechLog("Error memproses maksud: " + err.message, "system", "warn");
      setAiResponseText("Maaf, terjadi gangguan saat asisten suara mencoba mengurai maksud Anda.");
      speakText("Mohon maaf, sistem sedang sibuk.");
    } finally {
      setIsProcessing(false);
    }
  };

  const toggleListening = () => {
    if (!hasSpeechSupport) {
      alert("Browser Anda tidak mendukung Web Speech API secara utuh.");
      return;
    }
    if (isListening) {
      recognitionRef.current.stop();
    } else {
      try {
        recognitionRef.current.start();
      } catch (err) {
        // Retry or reset
        setIsListening(false);
      }
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualInput.trim()) return;
    onSpeechLog(`Teks terketik: "${manualInput}"`, "web", "success");
    processVoiceCommand(manualInput);
    setManualInput("");
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm flex flex-col justify-between" id="voice-control-panel-root">
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest">
            Gemini Speech Assistant
          </h2>
          <span className="text-[10px] bg-purple-50 text-purple-600 border border-purple-150 px-2 py-0.5 rounded-full font-mono font-bold">
            GEMINI-3.5-FLASH
          </span>
        </div>

        <p className="text-xs text-slate-400 mb-6">
          Gunakan bahasa sehari-hari untuk mengontrol alat (misal: "tolong nyalakan lampu utama" atau "sebutkan berapa suhu kamar sekarang").
        </p>

        {/* Microfon Trigger Area */}
        <div className="flex flex-col items-center justify-center p-6 border border-slate-100 bg-slate-50/50 rounded-xl text-center mb-6" id="microphone-interaction-hub">
          <button
            onClick={toggleListening}
            id="mic-trigger-button"
            className={`w-20 h-20 rounded-full flex items-center justify-center transition-all focus:outline-none ${
              isListening
                ? "bg-red-500 text-white animate-pulse shadow-lg ring-8 ring-red-100"
                : isProcessing
                ? "bg-purple-100 text-purple-600 animate-bounce cursor-wait"
                : isConnected
                ? "bg-purple-600 text-white hover:bg-purple-700 hover:scale-105 hover:shadow-lg cursor-pointer cursor-semibold"
                : "bg-slate-300 text-slate-500 cursor-not-allowed"
            }`}
            disabled={!isConnected && !isListening}
          >
            {isListening ? (
              <MicOff className="w-8 h-8" />
            ) : (
              <Mic className="w-8 h-8" />
            )}
          </button>

          <span className="text-xs font-semibold text-slate-700 tracking-tight mt-4">
            {isListening
              ? "Silakan Bicara sekarang..."
              : isProcessing
              ? "Menganalisis Niat (Gemini)..."
              : isConnected
              ? "Tekan mic untuk melafalkan perintah"
              : "Menunggu koneksi Broker..."}
          </span>

          {transcript && (
            <div className="mt-4 px-3 py-1.5 bg-white border border-slate-200 rounded-lg max-w-full text-xs text-slate-600 italic">
              "{transcript}"
            </div>
          )}
        </div>

        {/* Manual Command Dropdowns and Backup typed Input */}
        <form onSubmit={handleManualSubmit} className="flex gap-2 items-center text-xs" id="vocal-text-fallback-input">
          <div className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 flex items-center gap-1.5 focus-within:ring-1 focus-within:ring-purple-400 focus-within:border-purple-400 focus-within:bg-white transition-all">
            <CornerDownRight className="w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Atau ketik di sini (misal: 'nyalakan lampu')"
              value={manualInput}
              onChange={(e) => setManualInput(e.target.value)}
              className="bg-transparent focus:outline-none w-full font-sans text-slate-700"
              disabled={isProcessing}
            />
          </div>
          <button
            type="submit"
            id="vocal-text-submit"
            className="p-2 bg-slate-100 hover:bg-purple-600 hover:text-white text-slate-500 rounded-lg transition-colors cursor-pointer"
            disabled={isProcessing}
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </form>

        {/* AI voice feedback visualization if completed */}
        {aiResponseText && (
          <div className="mt-4 p-4 rounded-xl border border-purple-100 bg-purple-50/30 flex items-start gap-2.5 animate-fadeIn" id="ai-voice-response-card">
            <Volume2 className="w-4 h-4 text-purple-600 mt-0.5 shrink-0" />
            <div className="text-xs text-purple-950 font-sans leading-relaxed">
              <span className="text-[10px] text-purple-500 font-mono block mb-1">ASISTEN SUARA RESPONSE:</span>
              <p className="font-semibold italic">"{aiResponseText}"</p>
            </div>
          </div>
        )}
      </div>

      <div className="mt-6 pt-3 border-t border-slate-200 text-[10px] text-slate-400 flex items-start gap-1.5">
        <Info className="w-3.5 h-3.5 shrink-0 text-slate-450 mt-0.5" />
        <span>
          Aplikasi ini memproses audio web langsung dan mengirimkannya ke endpoint aman Gemini v3.5-flash untuk pengenalan multibahasa cerdas. Suara konfirmasi dibacakan melalui Audio Sintetis Web.
        </span>
      </div>
    </div>
  );
};
