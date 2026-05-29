import React from "react";
import styles from "../app/dashboard/dashboard.module.css";

interface HeaderProps {
  activeProperty: string;
  setActiveProperty: (property: string) => void;
  properties: any[];
  hasProperties: boolean;
  stats: {
    occupancy: number;
    checkedIn: number;
    upcoming: number;
    maintenance: number;
  };
  currentUser?: any;
  notifications?: any[];
  onClearNotifications?: () => void;
  todayAttendance?: any;
  onClockInOut?: (type: "clockIn" | "clockOut") => void;
}

// Helper to map DB property names to frontend property keys
const mapPropertyKey = (name: string): string => {
  const lowercase = name.toLowerCase();
  if (lowercase.includes("goa")) return "goa";
  if (lowercase.includes("manali")) return "manali";
  if (lowercase.includes("delhi")) return "delhi";
  return lowercase.replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
};

// Helper for type emojis
const getPropertyEmoji = (type: string) => {
  switch (type?.toLowerCase()) {
    case "homestay": return "🌴";
    case "hotel": return "🏨";
    case "resort": return "⛰️";
    default: return "🏢";
  }
};

export default function Header({
  activeProperty,
  setActiveProperty,
  properties,
  hasProperties,
  stats,
  currentUser,
  notifications = [],
  onClearNotifications,
  todayAttendance,
  onClockInOut,
}: HeaderProps) {
  const isSuperAdmin = currentUser?.role === "Super Admin";
  const activeProp = properties.find((p) => mapPropertyKey(p.name) === activeProperty);
  const [showNotifications, setShowNotifications] = React.useState(false);

  return (
    <header className={styles.header}>
      <div className={styles.headerLeft}>
        {!isSuperAdmin && activeProp ? (
          <div
            className={styles.propertySelector}
            style={{
              cursor: "default",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              fontWeight: "600",
              color: "#fff",
              backgroundColor: "rgba(255, 255, 255, 0.05)",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              borderRadius: "8px",
              padding: "10px 16px",
            }}
          >
            {getPropertyEmoji(activeProp.type)} {activeProp.name}
          </div>
        ) : hasProperties ? (
          <select
            className={styles.propertySelector}
            value={activeProperty}
            onChange={(e) => setActiveProperty(e.target.value)}
          >
            {properties.map((property) => {
              const key = mapPropertyKey(property.name);
              const emoji = getPropertyEmoji(property.type);
              const roomCount = property.rooms?.length || 0;
              return (
                <option key={property.id} value={key}>
                  {emoji} {property.name} ({roomCount} Rooms)
                </option>
              );
            })}
          </select>
        ) : (
          <div
            className={styles.propertySelector}
            style={{
              cursor: "default",
              opacity: 0.6,
              fontSize: "0.85rem",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            🏢 No Registered Properties
          </div>
        )}
      </div>

      <div className={styles.headerRight}>
        <div style={{ display: "flex", gap: "16px", alignItems: "center", position: "relative" }}>
          
          {/* Clock In / Clock Out Button */}
          {currentUser && onClockInOut && (
            <div style={{ marginRight: "12px", paddingRight: "16px", borderRight: "1px solid rgba(255,255,255,0.1)" }}>
              {todayAttendance ? (
                <button
                  type="button"
                  onClick={() => onClockInOut("clockOut")}
                  className="btn-secondary"
                  style={{ padding: "6px 12px", fontSize: "0.8rem", color: "#fff", borderColor: "rgba(239, 68, 68, 0.5)", backgroundColor: "rgba(239, 68, 68, 0.1)" }}
                >
                  ⏱️ Clock Out
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => onClockInOut("clockIn")}
                  className="btn-primary"
                  style={{ padding: "6px 12px", fontSize: "0.8rem", backgroundColor: "var(--status-checkedin)", border: "none", color: "#fff" }}
                >
                  ⏱️ Clock In
                </button>
              )}
            </div>
          )}

          {/* Glowing Notification Center */}
          {isSuperAdmin && (
            <div style={{ position: "relative" }}>
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                style={{
                  background: "rgba(255, 255, 255, 0.03)",
                  border: "1px solid rgba(255, 255, 255, 0.08)",
                  borderRadius: "8px",
                  width: "36px",
                  height: "36px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  fontSize: "1.1rem",
                  transition: "all 0.2s ease",
                  position: "relative",
                  outline: "none",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.08)";
                  e.currentTarget.style.borderColor = "var(--border-focus)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.03)";
                  e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.08)";
                }}
              >
                🔔
                {notifications.length > 0 && (
                  <span
                    style={{
                      position: "absolute",
                      top: "-2px",
                      right: "-2px",
                      backgroundColor: "#ef4444",
                      color: "#fff",
                      fontSize: "0.65rem",
                      fontWeight: "700",
                      borderRadius: "50%",
                      width: "16px",
                      height: "16px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      boxShadow: "0 0 8px #ef4444",
                    }}
                  >
                    {notifications.length}
                  </span>
                )}
              </button>

              {showNotifications && (
                <>
                  <div
                    onClick={() => setShowNotifications(false)}
                    style={{
                      position: "fixed",
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      zIndex: 999,
                    }}
                  />
                  <div
                    style={{
                      position: "absolute",
                      top: "44px",
                      right: 0,
                      width: "320px",
                      backgroundColor: "rgba(15, 12, 30, 0.95)",
                      backdropFilter: "blur(16px)",
                      border: "1px solid rgba(255, 255, 255, 0.1)",
                      borderRadius: "12px",
                      boxShadow: "0 20px 40px rgba(0,0,0,0.6), inset 0 0 0 1px rgba(255,255,255,0.05)",
                      zIndex: 1000,
                      padding: "16px",
                      display: "flex",
                      flexDirection: "column",
                      gap: "12px",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid rgba(255, 255, 255, 0.08)", paddingBottom: "10px" }}>
                      <strong style={{ fontSize: "0.9rem", color: "#fff" }}>🔔 Notifications ({notifications.length})</strong>
                      {notifications.length > 0 && onClearNotifications && (
                        <button
                          onClick={() => {
                            onClearNotifications();
                            setShowNotifications(false);
                          }}
                          style={{
                            background: "none",
                            border: "none",
                            color: "var(--border-focus)",
                            fontSize: "0.75rem",
                            cursor: "pointer",
                            fontWeight: "600",
                            transition: "opacity 0.2s",
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.opacity = "0.8"}
                          onMouseLeave={(e) => e.currentTarget.style.opacity = "1"}
                        >
                          Clear All
                        </button>
                      )}
                    </div>

                    <div
                      style={{
                        maxHeight: "240px",
                        overflowY: "auto",
                        display: "flex",
                        flexDirection: "column",
                        gap: "8px",
                      }}
                    >
                      {notifications.length === 0 ? (
                        <div style={{ padding: "20px 0", textAlign: "center", color: "var(--text-muted)", fontSize: "0.8rem" }}>
                          No new notifications.
                        </div>
                      ) : (
                        notifications.map((n) => (
                          <div
                            key={n.id}
                            style={{
                              backgroundColor: "rgba(255, 255, 255, 0.02)",
                              border: "1px solid rgba(255, 255, 255, 0.04)",
                              borderRadius: "8px",
                              padding: "10px",
                              display: "flex",
                              flexDirection: "column",
                              gap: "4px",
                            }}
                          >
                            <p style={{ fontSize: "0.8rem", color: "#fff", margin: 0, lineHeight: "1.4" }}>
                              {n.message}
                            </p>
                            <span style={{ fontSize: "0.65rem", color: "var(--text-muted)" }}>
                              {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {new Date(n.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
            <span style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>
              ⚡ Live OTA Sync: <strong style={{ color: "var(--status-checkedin)" }}>Active</strong>
            </span>
            <div
              style={{
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                backgroundColor: "var(--status-checkedin)",
                boxShadow: "0 0 8px var(--status-checkedin)",
              }}
            ></div>
          </div>
        </div>
      </div>
    </header>
  );
}
