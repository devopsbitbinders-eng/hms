"use client";

import React, { useState, useEffect } from "react";

export default function LoginScreen({ onLoginSuccess }: { onLoginSuccess: (user: any) => void }) {
  const [tab, setTab] = useState<"owner" | "staff">("staff");
  const [staffList, setStaffList] = useState<any[]>([]);

  // Owner Login State
  const [ownerUsername, setOwnerUsername] = useState("");
  const [ownerPassword, setOwnerPassword] = useState("");

  // Staff Login State
  const [selectedStaffUsername, setSelectedStaffUsername] = useState("");
  const [staffPin, setStaffPin] = useState("");

  // First Time PIN Setup State
  const [isFirstTime, setIsFirstTime] = useState(false);
  const [newPin, setNewPin] = useState("");
  const [confirmNewPin, setConfirmNewPin] = useState("");
  const [tempAuthToken, setTempAuthToken] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Owner Registration State
  const [isRegisteringOwner, setIsRegisteringOwner] = useState(false);
  const [registerName, setRegisterName] = useState("");
  const [registerUsername, setRegisterUsername] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");

  // Fetch staff list on mount
  useEffect(() => {
    // No longer pre-fetching staff list — staff type username for privacy
  }, []);

  const handleOwnerLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/users/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: ownerUsername, password: ownerPassword }),
      });
      const data = await res.json();
      if (data.success) {
        onLoginSuccess(data.user);
      } else {
        setError(data.error || "Invalid Owner Credentials");
      }
    } catch (err) {
      setError("Server error during login");
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterOwner = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!registerName || !registerUsername || !registerPassword) {
      setError("Please fill in all fields.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: registerName, username: registerUsername, password: registerPassword, role: "Owner", avatar: "👑" }),
      });
      const data = await res.json();
      if (data.success) {
        onLoginSuccess(data.user);
      } else {
        setError(data.error || "Registration failed");
      }
    } catch (err) {
      setError("Server error during registration");
    } finally {
      setLoading(false);
    }
  };

  const handleStaffLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStaffUsername) {
      setError("Please select your name from the list.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/users/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: selectedStaffUsername, password: staffPin }),
      });
      const data = await res.json();
      
      if (data.success) {
        if (data.user.isFirstLogin) {
          // Trigger first time pin setup
          setIsFirstTime(true);
          setTempAuthToken(staffPin); // We need this to authorize the pin change
        } else {
          onLoginSuccess(data.user);
        }
      } else {
        setError(data.error || "Invalid PIN");
      }
    } catch (err) {
      setError("Server error during login");
    } finally {
      setLoading(false);
    }
  };

  const handleSetNewPin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPin !== confirmNewPin) {
      setError("PINs do not match!");
      return;
    }
    if (newPin.length < 4) {
      setError("PIN must be at least 4 characters long.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/users/update-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: selectedStaffUsername,
          currentPin: tempAuthToken,
          newPin: newPin
        }),
      });
      const data = await res.json();
      
      if (data.success) {
        onLoginSuccess(data.user);
      } else {
        setError(data.error || "Failed to update PIN");
      }
    } catch (err) {
      setError("Server error during PIN setup");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: "fixed", top: 0, left: 0, width: "100%", height: "100vh",
      backgroundColor: "var(--bg-primary)",
      display: "flex", alignItems: "center", justifyContent: "center",
      zIndex: 99999,
      backgroundImage: "radial-gradient(circle at 50% -20%, rgba(99, 102, 241, 0.15), transparent 60%)"
    }}>
      <div className="glass-card" style={{ width: "100%", maxWidth: "450px", padding: "40px", borderRadius: "16px", boxShadow: "0 25px 50px -12px rgba(0,0,0,0.5)" }}>
        
        {/* Logo / Header */}
        <div style={{ textAlign: "center", marginBottom: "32px" }}>
          <div style={{ width: "64px", height: "64px", background: "linear-gradient(135deg, #6366f1 0%, #a855f7 100%)", borderRadius: "16px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "2rem", color: "#fff", margin: "0 auto 16px" }}>
            🏨
          </div>
          <h1 style={{ fontSize: "1.75rem", fontWeight: "700", color: "#fff", margin: 0 }}>Aether PMS</h1>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem", marginTop: "4px" }}>Property Management System</p>
        </div>

        {isFirstTime ? (
          /* FIRST TIME PIN SETUP */
          <form onSubmit={handleSetNewPin} style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            <div style={{ textAlign: "center", marginBottom: "8px" }}>
              <h2 style={{ fontSize: "1.25rem", color: "#fff", margin: "0 0 8px 0" }}>Set Your Permanent PIN</h2>
              <p style={{ color: "var(--text-secondary)", fontSize: "0.85rem", margin: 0, lineHeight: 1.5 }}>
                Since this is your first time logging in, you must change your temporary PIN to a new, secure one.
              </p>
            </div>
            
            <div>
              <label style={{ display: "block", fontSize: "0.85rem", color: "var(--text-secondary)", marginBottom: "8px" }}>New PIN</label>
              <input 
                type="password" 
                value={newPin} 
                onChange={(e) => setNewPin(e.target.value)} 
                style={{ width: "100%", padding: "12px", borderRadius: "8px", border: "1px solid var(--border-color)", background: "rgba(255,255,255,0.05)", color: "#fff" }} 
                placeholder="Enter new 4-digit PIN"
                required 
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "0.85rem", color: "var(--text-secondary)", marginBottom: "8px" }}>Confirm New PIN</label>
              <input 
                type="password" 
                value={confirmNewPin} 
                onChange={(e) => setConfirmNewPin(e.target.value)} 
                style={{ width: "100%", padding: "12px", borderRadius: "8px", border: "1px solid var(--border-color)", background: "rgba(255,255,255,0.05)", color: "#fff" }} 
                placeholder="Confirm new PIN"
                required 
              />
            </div>

            {error && <div style={{ color: "#ef4444", fontSize: "0.85rem", textAlign: "center", backgroundColor: "rgba(239, 68, 68, 0.1)", padding: "10px", borderRadius: "8px" }}>{error}</div>}

            <button type="submit" disabled={loading} style={{
              width: "100%", padding: "14px", borderRadius: "8px", border: "none",
              background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
              color: "#fff", fontWeight: "600", fontSize: "1rem", cursor: "pointer",
              opacity: loading ? 0.7 : 1
            }}>
              {loading ? "Saving..." : "Save & Login"}
            </button>
          </form>
        ) : (
          /* STANDARD LOGIN (OWNER vs STAFF) */
          <>
            {/* Tabs */}
            <div style={{ display: "flex", backgroundColor: "rgba(255,255,255,0.05)", borderRadius: "8px", padding: "4px", marginBottom: "24px" }}>
              <button 
                type="button"
                onClick={() => { setTab("staff"); setError(null); }}
                style={{
                  flex: 1, padding: "10px", borderRadius: "6px", border: "none", cursor: "pointer",
                  backgroundColor: tab === "staff" ? "rgba(255,255,255,0.1)" : "transparent",
                  color: tab === "staff" ? "#fff" : "var(--text-secondary)",
                  fontWeight: tab === "staff" ? "600" : "400",
                  transition: "all 0.2s"
                }}
              >
                Staff PIN Login
              </button>
              <button 
                type="button"
                onClick={() => { setTab("owner"); setError(null); }}
                style={{
                  flex: 1, padding: "10px", borderRadius: "6px", border: "none", cursor: "pointer",
                  backgroundColor: tab === "owner" ? "rgba(255,255,255,0.1)" : "transparent",
                  color: tab === "owner" ? "#fff" : "var(--text-secondary)",
                  fontWeight: tab === "owner" ? "600" : "400",
                  transition: "all 0.2s"
                }}
              >
                Owner Login
              </button>
            </div>

            {tab === "staff" ? (
              <form onSubmit={handleStaffLogin} style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.85rem", color: "var(--text-secondary)", marginBottom: "8px" }}>Staff Username</label>
                  <input
                    type="text"
                    value={selectedStaffUsername}
                    onChange={(e) => setSelectedStaffUsername(e.target.value)}
                    style={{ width: "100%", padding: "12px", borderRadius: "8px", border: "1px solid var(--border-color)", background: "rgba(255,255,255,0.05)", color: "#fff" }}
                    placeholder="Enter username"
                    required
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "0.85rem", color: "var(--text-secondary)", marginBottom: "8px" }}>Access PIN</label>
                  <input 
                    type="password" 
                    value={staffPin} 
                    onChange={(e) => setStaffPin(e.target.value)} 
                    style={{ width: "100%", padding: "12px", borderRadius: "8px", border: "1px solid var(--border-color)", background: "rgba(255,255,255,0.05)", color: "#fff", letterSpacing: "4px" }} 
                    placeholder="••••"
                    required 
                  />
                </div>
                {error && <div style={{ color: "#ef4444", fontSize: "0.85rem", textAlign: "center", backgroundColor: "rgba(239, 68, 68, 0.1)", padding: "10px", borderRadius: "8px" }}>{error}</div>}
                
                <button type="submit" disabled={loading} style={{
                  width: "100%", padding: "14px", borderRadius: "8px", border: "none",
                  background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
                  color: "#fff", fontWeight: "600", fontSize: "1rem", cursor: "pointer",
                  opacity: loading ? 0.7 : 1
                }}>
                  {loading ? "Authenticating..." : "Login"}
                </button>
              </form>
            ) : (
              isRegisteringOwner ? (
                /* NEW OWNER REGISTRATION */
                <form onSubmit={handleRegisterOwner} style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                  <div style={{ textAlign: "center", marginBottom: "4px" }}>
                    <h2 style={{ fontSize: "1.1rem", color: "#fff", margin: "0 0 4px 0" }}>Create Owner Account</h2>
                    <p style={{ color: "var(--text-secondary)", fontSize: "0.8rem", margin: 0 }}>First time? Register as the property owner.</p>
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "0.85rem", color: "var(--text-secondary)", marginBottom: "8px" }}>Full Name</label>
                    <input type="text" value={registerName} onChange={(e) => setRegisterName(e.target.value)} style={{ width: "100%", padding: "12px", borderRadius: "8px", border: "1px solid var(--border-color)", background: "rgba(255,255,255,0.05)", color: "#fff" }} placeholder="Your full name" required />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "0.85rem", color: "var(--text-secondary)", marginBottom: "8px" }}>Username</label>
                    <input type="text" value={registerUsername} onChange={(e) => setRegisterUsername(e.target.value)} style={{ width: "100%", padding: "12px", borderRadius: "8px", border: "1px solid var(--border-color)", background: "rgba(255,255,255,0.05)", color: "#fff" }} placeholder="e.g. admin" required />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "0.85rem", color: "var(--text-secondary)", marginBottom: "8px" }}>Password</label>
                    <input type="password" value={registerPassword} onChange={(e) => setRegisterPassword(e.target.value)} style={{ width: "100%", padding: "12px", borderRadius: "8px", border: "1px solid var(--border-color)", background: "rgba(255,255,255,0.05)", color: "#fff" }} placeholder="Set a strong password" required />
                  </div>
                  {error && <div style={{ color: "#ef4444", fontSize: "0.85rem", textAlign: "center", backgroundColor: "rgba(239, 68, 68, 0.1)", padding: "10px", borderRadius: "8px" }}>{error}</div>}
                  <button type="submit" disabled={loading} style={{ width: "100%", padding: "14px", borderRadius: "8px", border: "none", background: "linear-gradient(135deg, #10b981 0%, #059669 100%)", color: "#fff", fontWeight: "600", fontSize: "1rem", cursor: "pointer", opacity: loading ? 0.7 : 1 }}>
                    {loading ? "Creating Account..." : "Create Owner Account"}
                  </button>
                  <p style={{ textAlign: "center", fontSize: "0.85rem", color: "var(--text-secondary)", margin: 0 }}>
                    Already have an account?{" "}
                    <button type="button" onClick={() => { setIsRegisteringOwner(false); setError(null); }} style={{ background: "none", border: "none", color: "#6366f1", cursor: "pointer", fontWeight: "600", fontSize: "0.85rem" }}>Sign In</button>
                  </p>
                </form>
              ) : (
                /* EXISTING OWNER LOGIN */
                <form onSubmit={handleOwnerLogin} style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "0.85rem", color: "var(--text-secondary)", marginBottom: "8px" }}>Owner Username</label>
                    <input type="text" value={ownerUsername} onChange={(e) => setOwnerUsername(e.target.value)} style={{ width: "100%", padding: "12px", borderRadius: "8px", border: "1px solid var(--border-color)", background: "rgba(255,255,255,0.05)", color: "#fff" }} placeholder="admin" required />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "0.85rem", color: "var(--text-secondary)", marginBottom: "8px" }}>Password</label>
                    <input type="password" value={ownerPassword} onChange={(e) => setOwnerPassword(e.target.value)} style={{ width: "100%", padding: "12px", borderRadius: "8px", border: "1px solid var(--border-color)", background: "rgba(255,255,255,0.05)", color: "#fff" }} placeholder="••••••••" required />
                  </div>
                  {error && <div style={{ color: "#ef4444", fontSize: "0.85rem", textAlign: "center", backgroundColor: "rgba(239, 68, 68, 0.1)", padding: "10px", borderRadius: "8px" }}>{error}</div>}
                  <button type="submit" disabled={loading} style={{ width: "100%", padding: "14px", borderRadius: "8px", border: "none", background: "linear-gradient(135deg, #10b981 0%, #059669 100%)", color: "#fff", fontWeight: "600", fontSize: "1rem", cursor: "pointer", opacity: loading ? 0.7 : 1 }}>
                    {loading ? "Authenticating..." : "Owner Login"}
                  </button>
                  <p style={{ textAlign: "center", fontSize: "0.85rem", color: "var(--text-secondary)", margin: 0 }}>
                    New here?{" "}
                    <button type="button" onClick={() => { setIsRegisteringOwner(true); setError(null); }} style={{ background: "none", border: "none", color: "#10b981", cursor: "pointer", fontWeight: "600", fontSize: "0.85rem" }}>Register as Owner</button>
                  </p>
                </form>
              )
            )}
          </>
        )}
      </div>
    </div>
  );
}
