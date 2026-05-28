"use client";

import React, { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

const translations = {
  en: {
    room: "Room",
    assignedTo: "Assigned to",
    statusTitle: "Status",
    instructionsTitle: "Instructions",
    playVoice: "▶️ Play AetherVoice Assist",
    playing: "🔊 Playing Narration...",
    langSwitch: "हिंदी (Hindi)",
    instructionText: "Perform clean turnover. Replace sheets and towels.",
    markClean: "✅ Mark Room as Clean",
    markingClean: "⏳ Updating...",
    cleanSuccess: "Room successfully marked as Clean!",
    voiceText: (room: string, status: string, hk: string) => `Room ${room}. Status: ${status}. Assigned to ${hk}. Instructions: Please perform a clean turnover and replace sheets and towels.`,
    langCode: "en-IN"
  },
  hi: {
    room: "कमरा",
    assignedTo: "कर्मचारी",
    statusTitle: "स्थिति",
    instructionsTitle: "निर्देश",
    playVoice: "▶️ निर्देश सुनें",
    playing: "🔊 निर्देश बज रहा है...",
    langSwitch: "English",
    instructionText: "कमरे की पूरी सफाई करें। चादर और तौलिये बदलें।",
    markClean: "✅ कमरे को 'साफ' चिह्नित करें",
    markingClean: "⏳ अपडेट हो रहा है...",
    cleanSuccess: "कमरे को सफलतापूर्वक 'साफ' चिह्नित किया गया!",
    voiceText: (room: string, status: string, hk: string) => `कमरा नंबर ${room}. स्थिति है: ${status === 'Dirty' ? 'गंदा' : 'सफाई की जरूरत'}. सफाई कर्मचारी: ${hk}. निर्देश है: कृपया कमरे की अच्छी तरह सफाई करें, और चादर और तौलिये बदल दें।`,
    langCode: "hi-IN"
  }
};

function AlertContent() {
  const searchParams = useSearchParams();
  const roomId = searchParams.get("roomId");
  const room = searchParams.get("room") || "Unknown";
  const hk = searchParams.get("hk") || "Staff";
  const status = searchParams.get("status") || "Turnover Needed";
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [lang, setLang] = useState<"en" | "hi">("en");
  const [isCleaning, setIsCleaning] = useState(false);
  const [cleanDone, setCleanDone] = useState(false);

  const t = translations[lang];

  const handleMarkClean = async () => {
    if (!roomId) return;
    setIsCleaning(true);
    try {
      const res = await fetch(`/api/rooms/${roomId}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cleanStatus: "Clean", hkLastUpdated: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) })
      });
      if (res.ok) {
        setCleanDone(true);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsCleaning(false);
    }
  };

  const handlePlayVoice = () => {
    if (!("speechSynthesis" in window)) {
      alert("Text-to-speech is not supported on this device.");
      return;
    }
    
    // Stop any existing speech
    window.speechSynthesis.cancel();
    
    const utterance = new SpeechSynthesisUtterance(t.voiceText(room, status, hk));
    utterance.lang = t.langCode;
    utterance.rate = 0.9;
    
    utterance.onstart = () => setIsPlaying(true);
    utterance.onend = () => setIsPlaying(false);
    utterance.onerror = () => setIsPlaying(false);
    
    window.speechSynthesis.speak(utterance);
  };

  useEffect(() => {
    return () => {
      if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  return (
    <div style={{
      minHeight: "100vh",
      backgroundColor: "#0f172a",
      backgroundImage: "radial-gradient(circle at top right, rgba(99, 102, 241, 0.15), transparent 400px), radial-gradient(circle at bottom left, rgba(236, 72, 153, 0.1), transparent 400px)",
      color: "#f8fafc",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: "20px",
      fontFamily: "'Inter', sans-serif"
    }}>
      <div style={{ width: "100%", maxWidth: "400px", display: "flex", justifyContent: "flex-end", marginBottom: "16px" }}>
        <button
          onClick={() => setLang(lang === "en" ? "hi" : "en")}
          style={{
            background: "rgba(255, 255, 255, 0.1)",
            border: "1px solid rgba(255, 255, 255, 0.2)",
            color: "#fff",
            padding: "8px 16px",
            borderRadius: "20px",
            cursor: "pointer",
            fontSize: "0.85rem",
            fontWeight: "600",
            backdropFilter: "blur(10px)"
          }}
        >
          🌐 {t.langSwitch}
        </button>
      </div>

      <div style={{
        background: "rgba(30, 41, 59, 0.7)",
        backdropFilter: "blur(16px)",
        borderRadius: "24px",
        border: "1px solid rgba(255, 255, 255, 0.1)",
        padding: "32px",
        width: "100%",
        maxWidth: "400px",
        boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
        textAlign: "center"
      }}>
        <div style={{
          background: "linear-gradient(135deg, #6366f1 0%, #ec4899 100%)",
          width: "60px",
          height: "60px",
          borderRadius: "16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "28px",
          margin: "0 auto 24px auto",
          boxShadow: "0 10px 15px -3px rgba(99, 102, 241, 0.4)"
        }}>
          🧹
        </div>
        
        <h1 style={{ fontSize: "1.5rem", fontWeight: "700", marginBottom: "8px", color: "#fff" }}>{t.room} {room}</h1>
        <p style={{ color: "#94a3b8", fontSize: "0.95rem", marginBottom: "24px" }}>
          {t.assignedTo}: <strong style={{ color: "#e2e8f0" }}>{hk}</strong>
        </p>
        
        <div style={{
          background: "rgba(15, 23, 42, 0.6)",
          borderRadius: "16px",
          padding: "20px",
          marginBottom: "32px",
          textAlign: "left",
          border: "1px solid rgba(255, 255, 255, 0.05)"
        }}>
          <div style={{ marginBottom: "12px" }}>
            <span style={{ fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "1px", color: "#64748b", fontWeight: "600" }}>{t.statusTitle}</span>
            <div style={{ color: "#f87171", fontWeight: "600", marginTop: "4px" }}>{status}</div>
          </div>
          <div>
            <span style={{ fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "1px", color: "#64748b", fontWeight: "600" }}>{t.instructionsTitle}</span>
            <div style={{ color: "#e2e8f0", lineHeight: "1.5", marginTop: "4px", fontSize: "0.95rem" }}>
              {t.instructionText}
            </div>
          </div>
        </div>
        
        <button
          onClick={handlePlayVoice}
          style={{
            background: isPlaying ? "rgba(99, 102, 241, 0.2)" : "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)",
            color: isPlaying ? "#818cf8" : "white",
            border: isPlaying ? "1px solid rgba(99, 102, 241, 0.5)" : "none",
            borderRadius: "12px",
            padding: "16px",
            width: "100%",
            fontSize: "1rem",
            fontWeight: "600",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "10px",
            transition: "all 0.2s",
            marginBottom: "16px"
          }}
        >
          {isPlaying ? t.playing : t.playVoice}
        </button>

        {cleanDone ? (
          <div style={{
            background: "rgba(16, 185, 129, 0.1)",
            border: "1px solid rgba(16, 185, 129, 0.3)",
            borderRadius: "12px",
            padding: "16px",
            color: "#10b981",
            fontWeight: "600",
            fontSize: "0.95rem"
          }}>
            {t.cleanSuccess}
          </div>
        ) : (
          <button
            onClick={handleMarkClean}
            disabled={isCleaning || !roomId}
            style={{
              background: isCleaning ? "rgba(16, 185, 129, 0.5)" : "linear-gradient(135deg, #10b981 0%, #059669 100%)",
              color: "white",
              border: "none",
              borderRadius: "12px",
              padding: "16px",
              width: "100%",
              fontSize: "1rem",
              fontWeight: "600",
              cursor: isCleaning ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "10px",
              transition: "all 0.2s"
            }}
          >
            {isCleaning ? t.markingClean : t.markClean}
          </button>
        )}
      </div>
    </div>
  );
}

export default function MobileAlertPage() {
  return (
    <Suspense fallback={<div style={{ padding: "20px", color: "#fff", textAlign: "center" }}>Loading Alert...</div>}>
      <AlertContent />
    </Suspense>
  );
}
