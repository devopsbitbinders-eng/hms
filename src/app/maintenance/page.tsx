"use client";

import React, { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";

function MaintenanceContent() {
  const searchParams = useSearchParams();
  const ticketId = searchParams.get("ticketId");
  const room = searchParams.get("room") || "Unknown";
  
  const [resolved, setResolved] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleResolve = async () => {
    if (!ticketId) return;
    
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/tickets/${ticketId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "Resolved" }),
      });
      
      if (res.ok) {
        setResolved(true);
      } else {
        const data = await res.json();
        setError(data.error || "Failed to mark as resolved.");
      }
    } catch (err) {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: "100vh",
      backgroundColor: "#0f172a",
      backgroundImage: "radial-gradient(circle at top right, rgba(16, 185, 129, 0.15), transparent 400px), radial-gradient(circle at bottom left, rgba(56, 189, 248, 0.1), transparent 400px)",
      color: "#f8fafc",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: "20px",
      fontFamily: "'Inter', sans-serif"
    }}>
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
          background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
          width: "60px",
          height: "60px",
          borderRadius: "16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "28px",
          margin: "0 auto 24px auto",
          boxShadow: "0 10px 15px -3px rgba(16, 185, 129, 0.4)"
        }}>
          🔧
        </div>
        
        <h1 style={{ fontSize: "1.5rem", fontWeight: "700", marginBottom: "8px", color: "#fff" }}>Maintenance Work Order</h1>
        <p style={{ color: "#94a3b8", fontSize: "0.95rem", marginBottom: "32px" }}>
          Room <strong style={{ color: "#e2e8f0", fontSize: "1.1rem" }}>{room}</strong>
        </p>
        
        {resolved ? (
          <div style={{
            background: "rgba(16, 185, 129, 0.1)",
            border: "1px solid rgba(16, 185, 129, 0.3)",
            borderRadius: "16px",
            padding: "24px",
            color: "#10b981",
            fontWeight: "600"
          }}>
            <div style={{ fontSize: "32px", marginBottom: "12px" }}>✅</div>
            Ticket successfully resolved!<br/>
            <span style={{ fontSize: "0.85rem", color: "#94a3b8", fontWeight: "400", display: "block", marginTop: "8px" }}>
              The manager's dashboard has been updated automatically. You may close this page.
            </span>
          </div>
        ) : (
          <>
            {error && <div style={{ color: "#ef4444", marginBottom: "16px", fontSize: "0.85rem" }}>{error}</div>}
            <button
              onClick={handleResolve}
              disabled={loading || !ticketId}
              style={{
                background: loading ? "rgba(16, 185, 129, 0.5)" : "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                color: "white",
                border: "none",
                borderRadius: "12px",
                padding: "16px",
                width: "100%",
                fontSize: "1rem",
                fontWeight: "600",
                cursor: loading ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "10px",
                transition: "all 0.2s"
              }}
            >
              {loading ? "Updating..." : "✅ Mark Issue as Resolved"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default function MobileMaintenancePage() {
  return (
    <Suspense fallback={<div style={{ padding: "20px", color: "#fff", textAlign: "center" }}>Loading Ticket Data...</div>}>
      <MaintenanceContent />
    </Suspense>
  );
}
