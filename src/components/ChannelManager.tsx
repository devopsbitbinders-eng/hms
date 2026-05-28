import React, { useState, useEffect } from "react";

interface Room {
  id?: string;
  number: string;
  name: string;
  type: string;
  basePrice?: number;
}

interface Channel {
  id: string;
  name: string;
  status: string;
  markupType: string;
  markupValue: number;
  connected: boolean;
  listingId: string | null;
  apiKey: string | null;
  lastSynced: string | null;
  syncType: string;
  externalIcalUrl: string | null;
  localIcalUrl: string | null;
  isCustom: boolean;
}

interface ChannelLog {
  id: string;
  channelName: string;
  type: string;
  status: string;
  message: string;
  timestamp: string;
}

interface ChannelManagerProps {
  activePropertyId: string;
  currentRooms: Room[];
  addToast: (msg: string, type?: "success" | "error" | "warning") => void;
  refreshCalendar: () => void;
}

export default function ChannelManager({
  activePropertyId,
  currentRooms,
  addToast,
  refreshCalendar,
}: ChannelManagerProps) {
  // Lists
  const [channels, setChannels] = useState<Channel[]>([]);
  const [logs, setLogs] = useState<ChannelLog[]>([]);
  
  // Loading states
  const [loading, setLoading] = useState(true);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [syncingId, setSyncingId] = useState<string | null>(null);

  // Credentials Modal State
  const [showCredsModal, setShowCredsModal] = useState(false);
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [listingIdVal, setListingIdVal] = useState("");
  const [apiKeyVal, setApiKeyVal] = useState("");
  const [savingCreds, setSavingCreds] = useState(false);

  // Markup state updates
  const [markupValues, setMarkupValues] = useState<{ [key: string]: { type: string; val: string } }>({});

  // Webhook Simulator State
  const [simChannel, setSimChannel] = useState("Booking.com");
  const [simRoomId, setSimRoomId] = useState("");
  const [simDate, setSimDate] = useState("2026-05-23");
  const [simDuration, setSimDuration] = useState("2");
  const [simGuestName, setSimGuestName] = useState("");
  const [simulating, setSimulating] = useState(false);

  // Custom Channel Registration State
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [customName, setCustomName] = useState("");
  const [customSyncType, setCustomSyncType] = useState("ical");
  const [customExternalUrl, setCustomExternalUrl] = useState("");
  const [registeringCustom, setRegisteringCustom] = useState(false);

  // iCal Education Modal State
  const [showIcalEducation, setShowIcalEducation] = useState(false);
  const [selectedIcsLine, setSelectedIcsLine] = useState<string | null>("BEGIN:VCALENDAR");
  const [activeOtaTab, setActiveOtaTab] = useState("airbnb");
  const [sandboxIcsText, setSandboxIcsText] = useState("");
  const [sandboxParseResult, setSandboxParseResult] = useState<any>(null);

  const formatParsedIcsDate = (dateStr: string) => {
    if (!dateStr || dateStr.length < 8) return dateStr;
    const y = dateStr.substring(0, 4);
    const m = dateStr.substring(4, 6);
    const d = dateStr.substring(6, 8);
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const monthName = months[parseInt(m, 10) - 1] || m;
    return `${monthName} ${parseInt(d, 10)}, ${y}`;
  };

  const parseIcsContent = (text: string) => {
    if (!text.trim()) {
      return { success: false, error: "Please enter or load some iCal (.ics) data first!" };
    }
    const lines = text.split(/\r?\n/);
    let isValid = false;
    let events: any[] = [];
    let currentEvent: any = null;
    let errors: string[] = [];

    const hasBeginCalendar = lines.some(l => l.trim().startsWith("BEGIN:VCALENDAR"));
    const hasEndCalendar = lines.some(l => l.trim().startsWith("END:VCALENDAR"));
    const hasVersion = lines.some(l => l.trim().startsWith("VERSION:"));

    if (!hasBeginCalendar) errors.push("Missing required 'BEGIN:VCALENDAR' header container.");
    if (!hasEndCalendar) errors.push("Missing required 'END:VCALENDAR' footer container.");
    if (!hasVersion) errors.push("Missing 'VERSION' parameter (typically VERSION:2.0).");

    if (hasBeginCalendar && hasEndCalendar) {
      isValid = true;
    }

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      if (line === "BEGIN:VEVENT") {
        currentEvent = {
          uid: "N/A",
          summary: "Untitled Block",
          start: "",
          end: "",
          description: ""
        };
      } else if (line === "END:VEVENT") {
        if (currentEvent) {
          events.push(currentEvent);
          currentEvent = null;
        }
      } else if (currentEvent) {
        if (line.startsWith("UID:")) {
          currentEvent.uid = line.substring(4);
        } else if (line.startsWith("SUMMARY:")) {
          currentEvent.summary = line.substring(8);
        } else if (line.startsWith("DESCRIPTION:")) {
          currentEvent.description = line.substring(12);
        } else if (line.startsWith("DTSTART")) {
          const parts = line.split(":");
          const dateStr = parts[parts.length - 1];
          currentEvent.start = formatParsedIcsDate(dateStr);
        } else if (line.startsWith("DTEND")) {
          const parts = line.split(":");
          const dateStr = parts[parts.length - 1];
          currentEvent.end = formatParsedIcsDate(dateStr);
        }
      }
    }

    if (isValid && errors.length === 0) {
      return {
        success: true,
        eventsCount: events.length,
        events,
        warnings: events.length === 0 ? ["Valid calendar envelope, but contains 0 VEVENT booking blocks."] : []
      };
    } else {
      return {
        success: false,
        error: "Formatting issues found in RFC 5545 envelope syntax.",
        errors,
        eventsCount: events.length,
        events
      };
    }
  };

  const loadSampleIcs = (type: "aether" | "airbnb") => {
    if (type === "aether") {
      setSandboxIcsText(`BEGIN:VCALENDAR\r
VERSION:2.0\r
PRODID:-//AetherHMS//ChannelManager//EN\r
CALSCALE:GREGORIAN\r
METHOD:PUBLISH\r
X-WR-CALNAME:AetherHMS Room locks - Airbnb Export\r
X-WR-TIMEZONE:Asia/Kolkata\r
BEGIN:VEVENT\r
UID:res-77291@aetherhms.com\r
DTSTAMP:20260521T000000Z\r
DTSTART;VALUE=DATE:20260525\r
DTEND;VALUE=DATE:20260528\r
SUMMARY:AetherHMS Block [Room 102]\r
DESCRIPTION:Reserved for Kajal Agarwal (Vacation stay)\r
STATUS:CONFIRMED\r
END:VEVENT\r
BEGIN:VEVENT\r
UID:res-99120@aetherhms.com\r
DTSTAMP:20260521T000000Z\r
DTSTART;VALUE=DATE:20260529\r
DTEND;VALUE=DATE:20260601\r
SUMMARY:AetherHMS Block [Room 105]\r
DESCRIPTION:Reserved for Vikram Malhotra (Business trip)\r
STATUS:CONFIRMED\r
END:VEVENT\r
END:VCALENDAR`);
    } else {
      setSandboxIcsText(`BEGIN:VCALENDAR\r
PRODID:-//Airbnb Inc//Hosting Calendar 1.0//EN\r
VERSION:2.0\r
METHOD:PUBLISH\r
X-WR-CALNAME:Airbnb Calendar - Cozy Penthouse\r
BEGIN:VEVENT\r
DTSTART;VALUE=DATE:20260526\r
DTEND;VALUE=DATE:20260528\r
UID:airbnb-reservation-1234567@airbnb.com\r
DESCRIPTION:Checkout: 2026-05-28\\nPhone: +1 555-0199\\nGuest: Samantha Miller\\nListing: Cozy Penthouse\\nPlan: Direct OTA Dynamic Tariff\r
SUMMARY:Airbnb Lock (Samantha Miller)\r
END:VEVENT\r
END:VCALENDAR`);
    }
  };

  // Fetch Channels
  const fetchChannels = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/channels?propertyId=${activePropertyId}`);
      const data = await res.json();
      if (data.success) {
        setChannels(data.channels);
        // Pre-fill markup inputs
        const initialMarkups: { [key: string]: { type: string; val: string } } = {};
        data.channels.forEach((c: Channel) => {
          initialMarkups[c.id] = { type: c.markupType, val: String(c.markupValue) };
        });
        setMarkupValues(initialMarkups);

        const firstConnected = data.channels.find((c: Channel) => c.connected);
        if (firstConnected) {
          setSimChannel(firstConnected.name);
        }
      } else {
        addToast(data.error || "Failed to load channel configurations", "error");
      }
    } catch (err: any) {
      console.error(err);
      addToast("Network error loading channels", "error");
    } finally {
      setLoading(false);
    }
  };

  // Fetch Logs
  const fetchLogs = async () => {
    try {
      setLoadingLogs(true);
      const res = await fetch(`/api/channels/logs?propertyId=${activePropertyId}`);
      const data = await res.json();
      if (data.success) {
        setLogs(data.logs);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingLogs(false);
    }
  };

  // Trigger Full Load on mount / property change
  useEffect(() => {
    if (activePropertyId) {
      fetchChannels();
      fetchLogs();
    }
    
    // Set default simulator room if available
    if (currentRooms.length > 0) {
      setSimRoomId(currentRooms[0].id || "");
    }
  }, [activePropertyId, currentRooms]);

  // Custom Channels Handler
  const handleRegisterCustom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customName) {
      addToast("⚠️ Channel Name is required!", "warning");
      return;
    }

    try {
      setRegisteringCustom(true);
      const res = await fetch("/api/channels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "register_custom",
          propertyId: activePropertyId,
          name: customName,
          syncType: customSyncType,
          externalIcalUrl: customSyncType === "ical" ? customExternalUrl : null
        })
      });
      const data = await res.json();
      if (data.success) {
        addToast(`✅ Custom OTA channel "${customName}" registered successfully!`, "success");
        setCustomName("");
        setCustomExternalUrl("");
        setShowCustomModal(false);
        fetchChannels();
        fetchLogs();
      } else {
        addToast(data.error || "Failed to register custom channel", "error");
      }
    } catch (err) {
      addToast("Network error registering custom channel", "error");
    } finally {
      setRegisteringCustom(false);
    }
  };

  const handleDeleteCustom = async (channelId: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete custom channel "${name}"? This will wipe all mapping blocks.`)) return;

    try {
      const res = await fetch("/api/channels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "delete_custom",
          propertyId: activePropertyId,
          channelId
        })
      });
      const data = await res.json();
      if (data.success) {
        addToast(`🗑️ Custom channel "${name}" removed.`, "success");
        fetchChannels();
        fetchLogs();
      } else {
        addToast(data.error || "Failed to delete custom channel", "error");
      }
    } catch (err) {
      addToast("Network error deleting custom channel", "error");
    }
  };

  const handleSyncIcal = async (channel: Channel) => {
    try {
      setSyncingId(channel.id);
      const res = await fetch("/api/channels/ical-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channelId: channel.id,
          propertyId: activePropertyId
        })
      });
      const data = await res.json();
      if (data.success) {
        addToast(
          `🔄 iCal Sync complete! Imported ${data.successCount} vacant blocks. Prevented ${data.blockedCount} collisions.`,
          data.blockedCount > 0 ? "warning" : "success"
        );
        refreshCalendar();
        fetchChannels();
        fetchLogs();
      } else {
        addToast(data.error || "Failed to complete iCal calendar sync", "error");
      }
    } catch (err) {
      addToast("Network error during calendar pull", "error");
    } finally {
      setSyncingId(null);
    }
  };

  // Handle Credentials Setup Opening
  const handleOpenCredentials = (channel: Channel) => {
    setSelectedChannel(channel);
    setListingIdVal(channel.listingId || "");
    setApiKeyVal(channel.apiKey || "");
    setShowCredsModal(true);
  };

  // Save Credentials (Mapping)
  const handleSaveCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedChannel || !listingIdVal || !apiKeyVal) {
      addToast("⚠️ Listing ID and API token are required!", "warning");
      return;
    }

    try {
      setSavingCreds(true);
      const res = await fetch("/api/channels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channelId: selectedChannel.id,
          action: "save_credentials",
          propertyId: activePropertyId,
          listingId: listingIdVal,
          apiKey: apiKeyVal
        })
      });
      const data = await res.json();
      if (data.success) {
        addToast(`✅ Mapped successfully! Connected AetherHMS to ${selectedChannel.name}.`, "success");
        setShowCredsModal(false);
        fetchChannels();
        fetchLogs();
      } else {
        addToast(data.error || "Credentials save failed", "error");
      }
    } catch (err) {
      addToast("Network error linking listing", "error");
    } finally {
      setSavingCreds(false);
    }
  };

  // Toggle Connection State
  const handleToggleConnection = async (channel: Channel) => {
    // If not connected and has no listing ID, force setup first
    if (!channel.connected && !channel.listingId) {
      handleOpenCredentials(channel);
      return;
    }

    try {
      const res = await fetch("/api/channels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channelId: channel.id,
          action: "toggle",
          propertyId: activePropertyId
        })
      });
      const data = await res.json();
      if (data.success) {
        addToast(
          data.channel.connected 
            ? `🟢 Connected & mapped sync to ${channel.name}!` 
            : `🔴 Disconnected and locked ${channel.name} sync.`,
          "success"
        );
        fetchChannels();
        fetchLogs();
      } else {
        addToast(data.error || "Connection toggle failed", "error");
      }
    } catch (err) {
      addToast("Network error toggling channel state", "error");
    }
  };

  // Save Pricing Strategy Markup
  const handleSaveMarkup = async (channelId: string, channelName: string) => {
    const markup = markupValues[channelId];
    if (!markup) return;

    try {
      const res = await fetch("/api/channels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channelId,
          action: "update_markup",
          propertyId: activePropertyId,
          markupType: markup.type,
          markupValue: markup.val
        })
      });
      const data = await res.json();
      if (data.success) {
        addToast(`⚡ Price parity Strategy applied to ${channelName}!`, "success");
        fetchChannels();
        fetchLogs();
      } else {
        addToast(data.error || "Markup update failed", "error");
      }
    } catch (err) {
      addToast("Network error setting rate parity rules", "error");
    }
  };

  // Sync Now Manual Outbound Sync Trigger
  const handleManualSync = async (channel: Channel) => {
    if (!channel.connected) {
      addToast("⚠️ Connect this channel first before syncing rates!", "warning");
      return;
    }

    try {
      setSyncingId(channel.id);
      
      // Perform outbound HTTP handshake to mock gateway
      const res = await fetch("/api/channels/mock-ota-gateway", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${channel.apiKey}`
        },
        body: JSON.stringify({
          channelName: channel.name,
          listingId: channel.listingId,
          apiKey: channel.apiKey,
          action: "push_rate",
          roomName: "All Property Room Units",
          dates: ["2026-05-20", "2026-06-02"],
          value: channel.markupType === "percentage" ? `Base tariff + ${channel.markupValue}%` : `Base tariff + ${channel.markupValue} INR`
        })
      });

      const data = await res.json();

      if (res.status === 200 && data.success) {
        addToast(`🚀 Rates pushed successfully to ${channel.name}!`, "success");
        
        // Log manual sync inside DB logs
        await fetch("/api/channels", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            channelId: channel.id,
            action: "update_markup", // Re-save to log a push update trace
            propertyId: activePropertyId,
            markupType: channel.markupType,
            markupValue: channel.markupValue
          })
        });

        fetchLogs();
      } else {
        addToast(data.error || "Mock Gateway API rejected push handshake", "error");
      }
    } catch (err) {
      addToast("Outbound OTA Gateway offline", "error");
    } finally {
      setSyncingId(null);
    }
  };

  // Simulating incoming booking webhook
  const handleSimulateWebhook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!simRoomId || !simGuestName) {
      addToast("⚠️ Guest Name and Assigned Room are required for testing!", "warning");
      return;
    }

    try {
      setSimulating(true);
      const res = await fetch("/api/channels/simulate-booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channelName: simChannel,
          roomId: simRoomId,
          startDateStr: simDate,
          duration: simDuration,
          guestName: simGuestName,
          propertyId: activePropertyId
        })
      });

      const data = await res.json();

      if (res.status === 200 && data.success) {
        addToast(`📥 Successful webhook from ${simChannel}! Booking confirmed locally.`, "success");
        setSimGuestName("");
        refreshCalendar(); // Update grid room listings
        fetchLogs(); // Reload transaction activity logs
      } else {
        // High contrast collision warning
        addToast(data.error || "Inbound Webhook Sync Collision Alert", "error");
        fetchLogs(); // Refresh activity log showing blocked warning
      }
    } catch (err: any) {
      addToast("Webhook simulator route failure", "error");
    } finally {
      setSimulating(false);
    }
  };

  // Wipe Logs
  const handleWipeLogs = async () => {
    if (!window.confirm("Are you sure you want to wipe all channel activity logs persistently?")) return;
    try {
      const res = await fetch(`/api/channels/logs?propertyId=${activePropertyId}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        addToast("🗑️ Activity logs cleared successfully.", "success");
        fetchLogs();
      }
    } catch (err) {
      addToast("Error clearing logs", "error");
    }
  };

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: "0.75rem",
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    color: "var(--text-secondary)",
    marginBottom: "6px",
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "10px 12px",
    borderRadius: "6px",
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    border: "1px solid var(--border-color)",
    color: "#fff",
    fontSize: "0.85rem",
    outline: "none",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "28px" }}>
      
      {/* 1. Header Grid Summary */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h2 style={{ fontSize: "1.5rem", fontWeight: "700", display: "flex", alignItems: "center", gap: "8px" }}>
            🌐 Channel Management Integration Console
          </h2>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.85rem", marginTop: "4px" }}>
            Synchronize pricing configurations, mapping nodes, and inventory updates dynamically across Booking.com, Airbnb, Agoda, and Expedia.
          </p>
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
          <button 
            className="btn-secondary" 
            style={{ 
              padding: "8px 14px", 
              fontSize: "0.85rem", 
              fontWeight: "600",
              background: "linear-gradient(135deg, rgba(99, 102, 241, 0.15), rgba(168, 85, 247, 0.15))",
              border: "1px solid rgba(139, 92, 246, 0.4)",
              color: "#c084fc",
              display: "flex",
              alignItems: "center",
              gap: "6px"
            }} 
            onClick={() => setShowIcalEducation(true)}
          >
            💡 Learn & Test .ics iCal
          </button>
          <button className="btn-primary" style={{ padding: "8px 14px", fontSize: "0.85rem", fontWeight: "600" }} onClick={() => setShowCustomModal(true)}>
            ➕ Register Custom OTA Channel
          </button>
          <button className="btn-secondary" style={{ padding: "8px 14px", fontSize: "0.85rem" }} onClick={fetchChannels}>
            🔄 Refresh Channels
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: "64px" }}>
          <div className="loading-spinner" style={{ margin: "0 auto 12px auto" }}></div>
          <span style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>Fetching persistent OTA channel adapters...</span>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "28px" }}>
          
          {/* 2. OTA Channels Status Grid */}
          <div>
            <h3 style={{ fontSize: "1rem", fontWeight: "600", color: "#fff", marginBottom: "14px" }}>🛰️ Connected OTA Sales Channels</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "16px" }}>
              {channels.map((channel) => (
                <div key={channel.id} className="glass-card" style={{ padding: "20px", display: "flex", flexDirection: "column", justifyContent: "space-between", gap: "16px", border: "1px solid var(--border-color)", position: "relative", overflow: "hidden" }}>
                  
                  {/* Glowing background status */}
                  <div style={{
                    position: "absolute",
                    top: "-15px",
                    right: "-15px",
                    width: "40px",
                    height: "40px",
                    borderRadius: "50%",
                    backgroundColor: channel.connected ? "rgba(74, 222, 128, 0.08)" : "rgba(255,255,255,0.02)",
                    filter: "blur(10px)"
                  }} />

                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                      <strong style={{ fontSize: "1.05rem", color: "#fff", display: "flex", alignItems: "center", gap: "6px" }}>
                        {channel.name === "Booking.com" && "🔵"}
                        {channel.name === "Airbnb" && "🔴"}
                        {channel.name === "Agoda" && "🟢"}
                        {channel.name === "Expedia" && "🟡"}
                        {channel.isCustom && "🌟"}
                        {channel.name}
                      </strong>
                      
                      {/* Connection Pulse Badge */}
                      <span style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        fontSize: "0.75rem",
                        fontWeight: "600",
                        padding: "4px 8px",
                        borderRadius: "20px",
                        backgroundColor: channel.connected ? "rgba(74, 222, 128, 0.1)" : "rgba(255,255,255,0.04)",
                        color: channel.connected ? "#4ade80" : "var(--text-muted)",
                        border: `1px solid ${channel.connected ? "rgba(74, 222, 128, 0.2)" : "var(--border-color)"}`
                      }}>
                        <span style={{
                          width: "6px",
                          height: "6px",
                          borderRadius: "50%",
                          backgroundColor: channel.connected ? "#4ade80" : "#9ca3af",
                          boxShadow: channel.connected ? "0 0 8px #4ade80" : "none"
                        }} />
                        {channel.connected ? "CONNECTED" : "DISCONNECTED"}
                      </span>
                    </div>

                    <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)", minHeight: "38px" }}>
                      {channel.syncType === "ical" ? (
                        <div>
                          <p style={{ margin: 0 }}>🔗 Sync Mode: <span style={{ color: "#818cf8", fontWeight: "bold" }}>iCal Calendar Link</span></p>
                          <p style={{ margin: "2px 0 0 0", fontSize: "0.7rem", color: "var(--text-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={channel.externalIcalUrl || ""}>
                            Import URL: {channel.externalIcalUrl ? channel.externalIcalUrl : "No import link set"}
                          </p>
                          <p style={{ margin: "2px 0 0 0", fontSize: "0.7rem", color: "var(--text-muted)" }}>Last Pulled: {channel.lastSynced ? new Date(channel.lastSynced).toLocaleTimeString() : "Never"}</p>
                        </div>
                      ) : channel.connected ? (
                        <div>
                          <p style={{ margin: 0 }}>📍 Mapped ID: <span style={{ fontFamily: "monospace", color: "#fff" }}>{channel.listingId}</span></p>
                          <p style={{ margin: "2px 0 0 0", fontSize: "0.7rem", color: "var(--text-muted)" }}>Last Synced: {channel.lastSynced ? new Date(channel.lastSynced).toLocaleTimeString() : "Never"}</p>
                        </div>
                      ) : (
                        <p style={{ margin: 0, color: "var(--text-muted)" }}>No listing linked. Connect mapping credentials to synchronize property rates.</p>
                      )}
                    </div>
                  </div>

                  {/* Actions footer */}
                  <div style={{ display: "flex", gap: "8px", borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: "12px" }}>
                    {channel.syncType === "ical" ? (
                      <>
                        <button 
                          className="btn-primary" 
                          style={{ flexGrow: 1, padding: "8px", fontSize: "0.75rem", display: "flex", alignItems: "center", justifyContent: "center", gap: "4px" }}
                          onClick={() => handleSyncIcal(channel)}
                          disabled={syncingId === channel.id}
                        >
                          {syncingId === channel.id ? "⏳ Pulling..." : "🔄 Pull iCal Calendar"}
                        </button>
                        <button
                          className="btn-secondary"
                          style={{ padding: "8px 10px", fontSize: "0.75rem" }}
                          title="Copy local export iCal link to paste into OTA"
                          onClick={() => {
                            const exportUrl = `${window.location.origin}${channel.localIcalUrl}`;
                            navigator.clipboard.writeText(exportUrl);
                            addToast("📋 Export iCal Link copied to clipboard! Paste it into MakeMyTrip/Airbnb to lock dates on their side.", "success");
                          }}
                        >
                          📋 Link
                        </button>
                      </>
                    ) : (
                      <>
                        <button 
                          className={channel.connected ? "btn-secondary" : "btn-primary"} 
                          style={{ flexGrow: 1, padding: "8px", fontSize: "0.75rem" }} 
                          onClick={() => handleToggleConnection(channel)}
                        >
                          {channel.connected ? "🔌 Disconnect" : "🔌 Connect Mapping"}
                        </button>
                        {channel.connected && (
                          <button 
                            className="btn-primary" 
                            style={{ padding: "8px 12px", fontSize: "0.75rem" }}
                            disabled={syncingId === channel.id}
                            onClick={() => handleManualSync(channel)}
                          >
                            {syncingId === channel.id ? "⏳ Pushing..." : "⚡ Sync Rates"}
                          </button>
                        )}
                        <button 
                          style={{ 
                            padding: "8px", 
                            borderRadius: "6px", 
                            backgroundColor: "rgba(255, 255, 255, 0.05)", 
                            border: "1px solid var(--border-color)",
                            color: "var(--text-secondary)",
                            cursor: "pointer" 
                          }} 
                          title="Edit listing configurations"
                          onClick={() => handleOpenCredentials(channel)}
                        >
                          ⚙️
                        </button>
                      </>
                    )}
                    
                    {channel.isCustom && (
                      <button 
                        style={{ 
                          padding: "8px 10px", 
                          borderRadius: "6px", 
                          backgroundColor: "rgba(239, 68, 68, 0.15)", 
                          border: "1px solid rgba(239, 68, 68, 0.3)",
                          color: "#f87171",
                          cursor: "pointer" 
                        }} 
                        title="Delete custom channel"
                        onClick={() => handleDeleteCustom(channel.id, channel.name)}
                      >
                        🗑️
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: "24px" }}>
            
            {/* 3. Unified Rate Parity Control Panel */}
            <div className="glass-card" style={{ padding: "24px", border: "1px solid var(--border-color)", display: "flex", flexDirection: "column", gap: "16px" }}>
              <div>
                <h3 style={{ fontSize: "1.05rem", fontWeight: "700", color: "#fff", display: "flex", alignItems: "center", gap: "6px" }}>
                  📈 Dynamic Rate Parity strategies
                </h3>
                <p style={{ color: "var(--text-secondary)", fontSize: "0.8rem", marginTop: "2px" }}>
                  Maintain unified control over OTA listings. Increase values to offset commission rates per platform.
                </p>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {channels.filter(c => c.connected).length === 0 ? (
                  <div style={{ textAlign: "center", padding: "32px 0", color: "var(--text-muted)", fontSize: "0.85rem", border: "1px dashed var(--border-color)", borderRadius: "6px" }}>
                    No connected OTA sales channels. Links must be set up to enable dynamic pricing adjustments.
                  </div>
                ) : (
                  channels.filter(c => c.connected).map((channel) => {
                    const markup = markupValues[channel.id] || { type: "percentage", val: "0.0" };
                    return (
                      <div key={channel.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", padding: "10px 14px", backgroundColor: "rgba(255,255,255,0.02)", borderRadius: "6px", border: "1px solid rgba(255,255,255,0.03)" }}>
                        <div style={{ display: "flex", flexDirection: "column" }}>
                          <span style={{ fontSize: "0.85rem", fontWeight: "600", color: "#fff" }}>{channel.name}</span>
                          <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>ID Mapped: {channel.listingId}</span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <select 
                            style={{ ...inputStyle, width: "105px", padding: "6px 8px" }}
                            value={markup.type}
                            onChange={(e) => setMarkupValues(prev => ({
                              ...prev,
                              [channel.id]: { ...prev[channel.id], type: e.target.value }
                            }))}
                          >
                            <option value="percentage">% Markup</option>
                            <option value="fixed">Fixed INR</option>
                          </select>
                          <input 
                            type="number" 
                            step="any"
                            style={{ ...inputStyle, width: "80px", padding: "6px 8px", textAlign: "right" }}
                            value={markup.val}
                            onChange={(e) => setMarkupValues(prev => ({
                              ...prev,
                              [channel.id]: { ...prev[channel.id], val: e.target.value }
                            }))}
                          />
                          <button 
                            className="btn-primary" 
                            style={{ padding: "6px 12px", fontSize: "0.75rem" }}
                            onClick={() => handleSaveMarkup(channel.id, channel.name)}
                          >
                            Apply 🚀
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* 4. Real-time Inventory & Rooms Mapping Indicator */}
            <div className="glass-card" style={{ padding: "24px", border: "1px solid var(--border-color)", display: "flex", flexDirection: "column", gap: "16px" }}>
              <div>
                <h3 style={{ fontSize: "1.05rem", fontWeight: "700", color: "#fff", display: "flex", alignItems: "center", gap: "6px" }}>
                  📊 Real-Time Dynamic Inventory Monitor
                </h3>
                <p style={{ color: "var(--text-secondary)", fontSize: "0.8rem", marginTop: "2px" }}>
                  Current visual allocation in AetherHMS vs external active listing nodes.
                </p>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {currentRooms.length === 0 ? (
                  <span style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>No room keys added.</span>
                ) : (
                  currentRooms.map((room) => (
                    <div key={room.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", backgroundColor: "rgba(255,255,255,0.01)", borderRadius: "6px" }}>
                      <span style={{ fontSize: "0.8rem", color: "#fff" }}>Room {room.number} ({room.name})</span>
                      <span style={{
                        fontSize: "0.75rem",
                        fontWeight: "600",
                        color: channels.some(c => c.connected) ? "#4ade80" : "var(--text-muted)",
                        padding: "2px 8px",
                        backgroundColor: channels.some(c => c.connected) ? "rgba(74, 222, 128, 0.08)" : "transparent",
                        borderRadius: "4px",
                        border: channels.some(c => c.connected) ? "1px solid rgba(74, 222, 128, 0.15)" : "none"
                      }}>
                        {channels.some(c => c.connected) ? "Sync Parity Enforced ✓" : "Offline"}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>

          <div style={{ display: "grid", gridTemplateColumns: "0.95fr 1.05fr", gap: "24px" }}>
            
            {/* 5. Webhook Simulator Control Panel */}
            <div className="glass-card" style={{ padding: "24px", border: "1px solid var(--border-color)", borderLeft: "4px solid #818cf8" }}>
              <div style={{ marginBottom: "16px" }}>
                <span style={{
                  fontSize: "0.65rem",
                  fontWeight: "700",
                  backgroundColor: "rgba(129, 140, 248, 0.15)",
                  color: "#c7d2fe",
                  padding: "4px 8px",
                  borderRadius: "4px",
                  textTransform: "uppercase"
                }}>Integration Testing sandbox</span>
                <h3 style={{ fontSize: "1.1rem", fontWeight: "700", color: "#fff", marginTop: "8px" }}>📥 Inbound OTA Webhook Simulator</h3>
                <p style={{ color: "var(--text-secondary)", fontSize: "0.8rem", marginTop: "2px" }}>
                  Fire a virtual webhook representing Booking.com or Airbnb. Tests local inventory locks and **Zero-Lag Collision Prevention** in real time.
                </p>
              </div>

              <form onSubmit={handleSimulateWebhook} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <div>
                    <label style={labelStyle}>Source Channel</label>
                    <select style={inputStyle} value={simChannel} onChange={(e) => setSimChannel(e.target.value)}>
                      {channels.filter(c => c.connected && c.syncType !== "ical").map(c => (
                        <option key={c.id} value={c.name}>{c.name}</option>
                      ))}
                      {channels.filter(c => c.connected && c.syncType === "ical").map(c => (
                        <option key={c.id} value={c.name}>{c.name}</option>
                      ))}
                      {channels.filter(c => c.connected).length === 0 && (
                        <option value="">-- No Connected Channels --</option>
                      )}
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>Assigned Room</label>
                    <select style={inputStyle} value={simRoomId} onChange={(e) => setSimRoomId(e.target.value)} required>
                      <option value="">-- Choose Target Room --</option>
                      {currentRooms.map(r => (
                        <option key={r.id} value={r.id}>Room {r.number} ({r.type})</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <div>
                    <label style={labelStyle}>📆 Arrival Date</label>
                    <input 
                      type="date" 
                      style={inputStyle} 
                      min="2026-05-20" 
                      max="2026-06-02" 
                      value={simDate} 
                      onChange={(e) => setSimDate(e.target.value)}
                      onClick={(e) => { try { e.currentTarget.showPicker(); } catch(err){} }}
                      onFocus={(e) => { try { e.currentTarget.showPicker(); } catch(err){} }}
                      required
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>🌙 Duration (Nights)</label>
                    <input type="number" style={inputStyle} min="1" max="10" value={simDuration} onChange={(e) => setSimDuration(e.target.value)} required />
                  </div>
                </div>

                <div>
                  <label style={labelStyle}>👤 Guest Full Name (Government Match)</label>
                  <input 
                    type="text" 
                    placeholder="e.g. Kajal Agarwal" 
                    style={inputStyle} 
                    value={simGuestName} 
                    onChange={(e) => setSimGuestName(e.target.value)}
                    required 
                  />
                </div>

                <button 
                  type="submit" 
                  className="btn-primary" 
                  style={{ width: "100%", padding: "10px", marginTop: "8px", fontWeight: "600" }}
                  disabled={simulating}
                >
                  {simulating ? "⏳ Processing Transaction handshake..." : "🔌 Simulate Inbound Webhook Booking ⚡"}
                </button>
              </form>
            </div>

            {/* 6. Live Activity Sync Feed Terminal */}
            <div className="glass-card" style={{ padding: "24px", border: "1px solid var(--border-color)", display: "flex", flexDirection: "column", gap: "12px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <h3 style={{ fontSize: "1rem", fontWeight: "600", color: "#fff", display: "flex", alignItems: "center", gap: "6px" }}>
                    📜 Zero-Lag Sync Activity logs
                  </h3>
                  <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Fires reactively on webhooks & direct guest additions.</span>
                </div>
                <div style={{ display: "flex", gap: "8px" }}>
                  <button className="btn-secondary" style={{ padding: "4px 8px", fontSize: "0.7rem" }} onClick={fetchLogs} disabled={loadingLogs}>
                    {loadingLogs ? "..." : "🔄 Refresh"}
                  </button>
                  <button className="btn-secondary" style={{ padding: "4px 8px", fontSize: "0.7rem", color: "var(--status-maintenance)" }} onClick={handleWipeLogs}>
                    🗑️ Wipe
                  </button>
                </div>
              </div>

              {/* Console log list */}
              <div style={{ 
                flexGrow: 1, 
                backgroundColor: "rgba(0,0,0,0.2)", 
                border: "1px solid rgba(255,255,255,0.03)", 
                borderRadius: "6px", 
                padding: "12px", 
                height: "260px", 
                overflowY: "auto",
                fontFamily: "monospace",
                fontSize: "0.75rem",
                lineHeight: "1.5",
                display: "flex",
                flexDirection: "column",
                gap: "8px"
              }}>
                {logs.length === 0 ? (
                  <span style={{ color: "var(--text-muted)", fontStyle: "italic", textAlign: "center", display: "block", marginTop: "96px" }}>
                    No sync transactions recorded. Connect a channel or simulate a booking to populate the log feed.
                  </span>
                ) : (
                  logs.map((log) => (
                    <div 
                      key={log.id} 
                      style={{ 
                        paddingBottom: "8px", 
                        borderBottom: "1px solid rgba(255,255,255,0.02)", 
                        color: log.status === "blocked" ? "#f87171" : log.status === "warning" ? "#fbbf24" : "#e5e7eb"
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "3px", fontSize: "0.7rem" }}>
                        <span style={{ 
                          fontWeight: "bold", 
                          color: log.status === "blocked" ? "#ef4444" : log.status === "warning" ? "#f59e0b" : "#10b981" 
                        }}>
                          [{log.channelName} • {log.type.toUpperCase()}]
                        </span>
                        <span style={{ color: "var(--text-muted)" }}>{new Date(log.timestamp).toLocaleTimeString()}</span>
                      </div>
                      <span style={{ whiteSpace: "pre-wrap", display: "block" }}>{log.message}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>

        </div>
      )}

      {/* 7. Credentials Modal Popup */}
      {showCredsModal && selectedChannel && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(0, 0, 0, 0.6)",
          backdropFilter: "blur(4px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1000
        }}>
          <div className="glass-card" style={{
            padding: "28px",
            width: "100%",
            maxWidth: "460px",
            border: "1px solid var(--border-color)",
            boxShadow: "0 20px 40px rgba(0,0,0,0.4)"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h3 style={{ fontSize: "1.1rem", fontWeight: "700", color: "#fff" }}>
                🔑 Link Credentials: {selectedChannel.name}
              </h3>
              <button 
                onClick={() => setShowCredsModal(false)}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--text-muted)",
                  fontSize: "1.1rem",
                  cursor: "pointer"
                }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveCredentials} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div>
                <label style={labelStyle}>OTA Listing / Hotel ID</label>
                <input 
                  type="text" 
                  style={inputStyle} 
                  placeholder={selectedChannel.name === "Booking.com" ? "e.g. Booking.com Hotel ID (e.g. 882031)" : "e.g. Listing ID / Listing URL Key"} 
                  value={listingIdVal}
                  onChange={(e) => setListingIdVal(e.target.value)}
                  required 
                />
              </div>

              <div>
                <label style={labelStyle}>Connectivity Authorization API Key / Token</label>
                <input 
                  type="password" 
                  style={inputStyle} 
                  placeholder="e.g. API Bearer token key" 
                  value={apiKeyVal}
                  onChange={(e) => setApiKeyVal(e.target.value)}
                  required 
                />
              </div>

              <div style={{ backgroundColor: "rgba(251, 191, 36, 0.05)", border: "1px solid rgba(251, 191, 36, 0.1)", borderRadius: "6px", padding: "10px", fontSize: "0.75rem", color: "#fcd34d", lineHeight: "1.4" }}>
                💡 <strong>PMS Integration Credentials:</strong> Entering listing credentials connects AetherHMS's internal calendar availability pushes and rate adapters dynamically. Wiping connections resets local coordinates.
              </div>

              <div style={{ display: "flex", gap: "12px", marginTop: "4px" }}>
                <button 
                  type="button" 
                  className="btn-secondary" 
                  style={{ flexGrow: 1, padding: "10px" }}
                  onClick={() => setShowCredsModal(false)}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn-primary" 
                  style={{ flexGrow: 1, padding: "10px" }}
                  disabled={savingCreds}
                >
                  {savingCreds ? "Processing..." : "Save Connection ✓"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* 8. Register Custom Channel Modal Popup */}
      {showCustomModal && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(0, 0, 0, 0.6)",
          backdropFilter: "blur(4px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1000
        }}>
          <div className="glass-card" style={{
            padding: "28px",
            width: "100%",
            maxWidth: "480px",
            border: "1px solid var(--border-color)",
            boxShadow: "0 20px 40px rgba(0,0,0,0.4)"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h3 style={{ fontSize: "1.1rem", fontWeight: "700", color: "#fff" }}>
                ➕ Register Custom OTA Channel
              </h3>
              <button 
                onClick={() => setShowCustomModal(false)}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--text-muted)",
                  fontSize: "1.1rem",
                  cursor: "pointer"
                }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleRegisterCustom} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div>
                <label style={labelStyle}>Channel Name</label>
                <input 
                  type="text" 
                  style={inputStyle} 
                  placeholder="e.g. MakeMyTrip, Direct Website, Yatra" 
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  required 
                />
              </div>

              <div>
                <label style={labelStyle}>Connectivity Sync Type</label>
                <select 
                  style={inputStyle} 
                  value={customSyncType} 
                  onChange={(e) => setCustomSyncType(e.target.value)}
                >
                  <option value="ical">Universal iCal Calendar Sync (.ics Link)</option>
                  <option value="api">Mock Direct API Integration (Simulator Only)</option>
                </select>
              </div>

              {customSyncType === "ical" && (
                <div>
                  <label style={labelStyle}>External iCal Import Feed URL (From OTA)</label>
                  <input 
                    type="url" 
                    style={inputStyle} 
                    placeholder="e.g. https://www.makemytrip.com/calendar/export/1234" 
                    value={customExternalUrl}
                    onChange={(e) => setCustomExternalUrl(e.target.value)}
                  />
                  <p style={{ margin: "4px 0 0 0", fontSize: "0.7rem", color: "var(--text-muted)", lineHeight: "1.3" }}>
                    💡 <strong>How to get this:</strong> Paste the calendar export link provided by MakeMyTrip, Agoda, or Airbnb here. AetherHMS will pull locked bookings from this URL.
                  </p>
                </div>
              )}

              {customSyncType === "ical" && (
                <div style={{ backgroundColor: "rgba(129, 140, 248, 0.05)", border: "1px solid rgba(129, 140, 248, 0.1)", borderRadius: "6px", padding: "10px", fontSize: "0.75rem", color: "#c7d2fe", lineHeight: "1.4" }}>
                  ℹ️ <strong>Auto-Generated Exporter:</strong> Once registered, AetherHMS generates a secure, unique `.ics` address. You paste that address into the external platform so they lock rooms booked on AetherHMS!
                  <span 
                    onClick={() => {
                      setShowCustomModal(false);
                      setShowIcalEducation(true);
                    }} 
                    style={{ color: "#c084fc", textDecoration: "underline", cursor: "pointer", marginLeft: "4px", fontWeight: "bold" }}
                  >
                    Learn more & test `.ics` files.
                  </span>
                </div>
              )}

              <div style={{ display: "flex", gap: "12px", marginTop: "4px" }}>
                <button 
                  type="button" 
                  className="btn-secondary" 
                  style={{ flexGrow: 1, padding: "10px" }}
                  onClick={() => setShowCustomModal(false)}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn-primary" 
                  style={{ flexGrow: 1, padding: "10px" }}
                  disabled={registeringCustom}
                >
                  {registeringCustom ? "Registering..." : "Add Channel ✓"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 9. Premium .ics iCal Synchronization & Education Hub Modal */}
      {showIcalEducation && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(10, 10, 15, 0.85)",
          backdropFilter: "blur(8px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1100,
          padding: "20px"
        }}>
          <div className="glass-card" style={{
            width: "100%",
            maxWidth: "1150px",
            height: "90vh",
            maxHeight: "850px",
            border: "1px solid rgba(255, 255, 255, 0.08)",
            boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.7)",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            position: "relative",
            background: "rgba(17, 17, 24, 0.95)"
          }}>
            
            {/* Modal Header */}
            <div style={{
              padding: "24px 28px",
              borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              background: "linear-gradient(90deg, rgba(30, 27, 75, 0.4), rgba(49, 46, 129, 0.2))"
            }}>
              <div>
                <h3 style={{
                  fontSize: "1.3rem",
                  fontWeight: "800",
                  color: "#fff",
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  margin: 0
                }}>
                  <span style={{ fontSize: "1.5rem" }}>📅</span> Universal iCal (.ics) Sync & Education Hub
                </h3>
                <p style={{ color: "var(--text-secondary)", fontSize: "0.85rem", margin: "4px 0 0 0" }}>
                  Understand RFC 5545 specifications, inspect raw payloads, and test calendar feed synchronization.
                </p>
              </div>
              <button 
                onClick={() => {
                  setShowIcalEducation(false);
                  setSandboxParseResult(null);
                }}
                style={{
                  background: "rgba(255, 255, 255, 0.05)",
                  border: "1px solid rgba(255, 255, 255, 0.1)",
                  borderRadius: "50%",
                  color: "#fff",
                  width: "36px",
                  height: "36px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  fontSize: "1rem",
                  transition: "all 0.2s"
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = "rgba(239, 68, 68, 0.2)";
                  e.currentTarget.style.borderColor = "rgba(239, 68, 68, 0.4)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.05)";
                  e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.1)";
                }}
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div style={{
              flexGrow: 1,
              overflowY: "auto",
              padding: "28px",
              display: "grid",
              gridTemplateColumns: "1.1fr 0.9fr",
              gap: "28px",
              backgroundColor: "rgba(0,0,0,0.15)"
            }}>
              
              {/* Left Column: Educational Content & RFC Inspector */}
              <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
                
                {/* 1. What is iCal Block */}
                <div className="glass-card" style={{
                  padding: "20px",
                  border: "1px solid rgba(255, 255, 255, 0.04)",
                  background: "rgba(255, 255, 255, 0.01)"
                }}>
                  <h4 style={{ fontSize: "0.95rem", fontWeight: "700", color: "#818cf8", margin: "0 0 10px 0", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    📚 Conceptual Overview: What is `.ics`?
                  </h4>
                  <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", lineHeight: "1.5", margin: 0 }}>
                    An <strong>iCalendar (.ics)</strong> file is an industry-standard plain-text format (specifically defined by <strong>RFC 5545</strong>) used to store calendar events. 
                    Unlike complex direct API channels, `.ics` functions as a <strong>universal bridge</strong>: any software (Airbnb, Booking.com, Agoda, Google Calendar, Apple Calendar) can read this feed to establish booking block coordinates.
                  </p>
                  <div style={{
                    marginTop: "14px",
                    padding: "10px 14px",
                    borderRadius: "6px",
                    background: "rgba(99, 102, 241, 0.06)",
                    border: "1px solid rgba(99, 102, 241, 0.15)",
                    fontSize: "0.8rem",
                    color: "#a5b4fc",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px"
                  }}>
                    <span>🛡️</span>
                    <span>
                      <strong>Dynamic 2-Way Sync Flow:</strong> AetherHMS exports its locks to the OTA, while simultaneously pulling the OTA's feed to lock calendars locally with <strong>Zero-Lag overbooking prevention</strong>.
                    </span>
                  </div>
                </div>

                {/* 2. Interactive RFC 5545 .ics Inspector */}
                <div className="glass-card" style={{
                  padding: "20px",
                  border: "1px solid rgba(255, 255, 255, 0.04)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "14px"
                }}>
                  <div>
                    <h4 style={{ fontSize: "0.95rem", fontWeight: "700", color: "#c084fc", margin: "0 0 4px 0", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      🔍 Interactive RFC 5545 .ics Inspector
                    </h4>
                    <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", margin: 0 }}>
                      Click on any line of the raw calendar output to decode its standard definition and rules.
                    </p>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", minHeight: "260px" }}>
                    
                    {/* Interactive Code Area */}
                    <div style={{
                      backgroundColor: "rgba(0, 0, 0, 0.35)",
                      border: "1px solid rgba(255, 255, 255, 0.05)",
                      borderRadius: "6px",
                      padding: "14px",
                      fontFamily: "monospace",
                      fontSize: "0.75rem",
                      lineHeight: "1.45",
                      overflowY: "auto",
                      maxHeight: "300px"
                    }}>
                      {[
                        "BEGIN:VCALENDAR",
                        "VERSION:2.0",
                        "PRODID:-//AetherHMS//ChannelManager//EN",
                        "CALSCALE:GREGORIAN",
                        "METHOD:PUBLISH",
                        "X-WR-CALNAME:AetherHMS Room locks",
                        "BEGIN:VEVENT",
                        "UID:res-102@aetherhms.com",
                        "DTSTAMP:20260521T000000Z",
                        "DTSTART;VALUE=DATE:20260526",
                        "DTEND;VALUE=DATE:20260528",
                        "SUMMARY:AetherHMS Block [Room 101]",
                        "DESCRIPTION:Reserved for Samantha Miller",
                        "STATUS:CONFIRMED",
                        "END:VEVENT",
                        "END:VCALENDAR"
                      ].map((line, idx) => {
                        const key = line.split(/[;:]/)[0];
                        const isSelected = selectedIcsLine === key;
                        return (
                          <div 
                            key={idx}
                            onClick={() => setSelectedIcsLine(key)}
                            style={{
                              padding: "2px 6px",
                              borderRadius: "4px",
                              cursor: "pointer",
                              backgroundColor: isSelected ? "rgba(139, 92, 246, 0.15)" : "transparent",
                              borderLeft: isSelected ? "2px solid #a855f7" : "2px solid transparent",
                              color: isSelected ? "#fff" : "rgba(255,255,255,0.75)",
                              transition: "all 0.15s"
                            }}
                            onMouseEnter={(e) => {
                              if (!isSelected) e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.03)";
                            }}
                            onMouseLeave={(e) => {
                              if (!isSelected) e.currentTarget.style.backgroundColor = "transparent";
                            }}
                          >
                            <span style={{ color: "#a855f7", marginRight: "8px" }}>{(idx + 1).toString().padStart(2, "0")}</span>
                            <span>{line}</span>
                          </div>
                        );
                      })}
                    </div>

                    {/* Explanation Box */}
                    <div style={{
                      backgroundColor: "rgba(255, 255, 255, 0.01)",
                      border: "1px solid rgba(255, 255, 255, 0.04)",
                      borderRadius: "6px",
                      padding: "16px",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between"
                    }}>
                      <div>
                        <span style={{
                          fontSize: "0.65rem",
                          fontWeight: "700",
                          backgroundColor: "rgba(168, 85, 247, 0.15)",
                          color: "#d8b4fe",
                          padding: "3px 8px",
                          borderRadius: "4px",
                          textTransform: "uppercase"
                        }}>Line Key: {selectedIcsLine || "SELECT A LINE"}</span>
                        
                        <div style={{ marginTop: "12px", fontSize: "0.85rem", color: "#fff", lineHeight: "1.5" }}>
                          {selectedIcsLine === "BEGIN" && (
                            <p><strong>BEGIN:VCALENDAR / BEGIN:VEVENT</strong> starts a container envelope block. It instructs the calendar client that all subsequent nodes belong inside this standard object until the corresponding <strong>END</strong> is reached.</p>
                          )}
                          {selectedIcsLine === "VERSION" && (
                            <p><strong>VERSION:2.0</strong> defines the protocol version. This is the global standard for iCalendar syntax. Version 1.0 is deprecated, and 2.0 is expected by all modern OTAs.</p>
                          )}
                          {selectedIcsLine === "PRODID" && (
                            <p><strong>PRODID</strong> is the Product Identifier. It uniquely identifies the generating software program. Here, AetherHMS stamps outbound feeds so subscribing OTAs know the source of the calendar engine.</p>
                          )}
                          {selectedIcsLine === "CALSCALE" && (
                            <p><strong>CALSCALE:GREGORIAN</strong> declares the calendar system. The Gregorian calendar is the standard timezone-independent Gregorian system used worldwide by all OTAs.</p>
                          )}
                          {selectedIcsLine === "METHOD" && (
                            <p><strong>METHOD:PUBLISH</strong> tells the parser how to process the calendar. PUBLISH declares a read-only stream subscription. The subscribing platform should pull updates at regular intervals to synchronize.</p>
                          )}
                          {selectedIcsLine === "X-WR-CALNAME" && (
                            <p><strong>X-WR-CALNAME</strong> is a non-standard but universally supported vendor tag. It represents the calendar name displayed inside subscribing interfaces (e.g. Booking.com, Airbnb, Apple Calendar).</p>
                          )}
                          {selectedIcsLine === "UID" && (
                            <p><strong>UID (Unique Identifier)</strong> is arguably the most critical tag. Every reservation has a globally unique code. If the OTA pulls the file repeatedly, the UID prevents duplicate locks and updates the event smoothly.</p>
                          )}
                          {selectedIcsLine === "DTSTAMP" && (
                            <p><strong>DTSTAMP</strong> stands for Date/Time Stamp. It represents the precise UTC moment when the `.ics` file stream was compiled. OTAs use this to ensure they are parsing the latest sync cycle.</p>
                          )}
                          {selectedIcsLine === "DTSTART" && (
                            <p><strong>DTSTART;VALUE=DATE:20260526</strong> establishes the booking arrival check-in date. The <code>VALUE=DATE</code> standard indicator tells the system that this is an all-day block, which blocks the entire room on that date.</p>
                          )}
                          {selectedIcsLine === "DTEND" && (
                            <p><strong>DTEND;VALUE=DATE:20260528</strong> represents the check-out date. In iCalendar standards, DTEND represents the day the block releases. In this example, the guest checks out on May 28, making the room vacant for incoming guests on that afternoon.</p>
                          )}
                          {selectedIcsLine === "SUMMARY" && (
                            <p><strong>SUMMARY</strong> serves as the event title visible on the OTA calendar. AetherHMS formats this clearly as <code>AetherHMS Block [Room Number]</code> to avoid confusion.</p>
                          )}
                          {selectedIcsLine === "DESCRIPTION" && (
                            <p><strong>DESCRIPTION</strong> contains supplementary plain text reservation details. In our sync pipeline, we include the guest name and stay types here to assist the property owner.</p>
                          )}
                          {selectedIcsLine === "STATUS" && (
                            <p><strong>STATUS:CONFIRMED</strong> defines the booking confirmation state. OTAs interpret CONFIRMED status as a firm schedule block, meaning they must immediately block matching dates from bookings on their side.</p>
                          )}
                          {selectedIcsLine === "END" && (
                            <p><strong>END:VEVENT / END:VCALENDAR</strong> marks the closing boundary. It signals to the calendar parser that the respective event or file envelope has concluded and is ready to be compiled.</p>
                          )}
                          {!selectedIcsLine && (
                            <p style={{ color: "var(--text-muted)", fontStyle: "italic" }}>Click any line in the code box to reveal its deep technical definition.</p>
                          )}
                        </div>
                      </div>

                      <div style={{ borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: "10px", fontSize: "0.75rem", color: "var(--text-muted)" }}>
                        📌 Complies with the <strong>Internet Engineering Task Force (IETF) RFC 5545</strong> protocol.
                      </div>
                    </div>

                  </div>
                </div>

                {/* 3. OTA Guides */}
                <div className="glass-card" style={{
                  padding: "20px",
                  border: "1px solid rgba(255, 255, 255, 0.04)"
                }}>
                  <h4 style={{ fontSize: "0.95rem", fontWeight: "700", color: "#38bdf8", margin: "0 0 12px 0", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    🗺️ Setup Guide: Pasting Links Into Major OTAs
                  </h4>

                  <div style={{ display: "flex", gap: "8px", marginBottom: "14px" }}>
                    {["airbnb", "booking", "agoda", "makemytrip"].map((ota) => (
                      <button
                        key={ota}
                        onClick={() => setActiveOtaTab(ota)}
                        style={{
                          padding: "6px 12px",
                          borderRadius: "4px",
                          fontSize: "0.75rem",
                          fontWeight: "600",
                          cursor: "pointer",
                          backgroundColor: activeOtaTab === ota ? "rgba(56, 189, 248, 0.15)" : "rgba(255, 255, 255, 0.03)",
                          border: `1px solid ${activeOtaTab === ota ? "rgba(56, 189, 248, 0.4)" : "rgba(255, 255, 255, 0.06)"}`,
                          color: activeOtaTab === ota ? "#38bdf8" : "var(--text-secondary)",
                          textTransform: "capitalize",
                          transition: "all 0.15s"
                        }}
                      >
                        {ota === "makemytrip" ? "MakeMyTrip" : ota}
                      </button>
                    ))}
                  </div>

                  <div style={{
                    padding: "14px",
                    borderRadius: "6px",
                    backgroundColor: "rgba(0,0,0,0.15)",
                    border: "1px solid rgba(255,255,255,0.02)",
                    fontSize: "0.8rem",
                    lineHeight: "1.45",
                    color: "var(--text-secondary)"
                  }}>
                    {activeOtaTab === "airbnb" && (
                      <ol style={{ paddingLeft: "18px", margin: 0, display: "flex", flexDirection: "column", gap: "6px" }}>
                        <li>Login to your <strong>Airbnb Host Portal</strong> and click on <strong>Calendar</strong>.</li>
                        <li>In your listing's settings, navigate to the <strong>Pricing & Availability</strong> tab.</li>
                        <li>Scroll down to <strong>Calendar Sync</strong> and click <strong>Export Calendar</strong>. Copy this link and paste it as the <em>External iCal Import Feed URL</em> inside AetherHMS's Custom Channel Registration modal.</li>
                        <li>Click <strong>Import Calendar</strong> on Airbnb. Paste the unique <em>AetherHMS Outbound Link</em> (copyable using the 📋 button on the Channel card) and name it "AetherHMS Sync".</li>
                      </ol>
                    )}
                    {activeOtaTab === "booking" && (
                      <ol style={{ paddingLeft: "18px", margin: 0, display: "flex", flexDirection: "column", gap: "6px" }}>
                        <li>Log in to your <strong>Booking.com Extranet</strong>.</li>
                        <li>Navigate to <strong>Calendar & Pricing</strong> (or <strong>Rates & Availability</strong>) &gt; <strong>Sync Calendars</strong>.</li>
                        <li>Click <strong>Add calendar connection</strong>. Paste the <em>AetherHMS Outbound Link</em> (copied from our console card) to export bookings to Booking.com.</li>
                        <li>Booking.com will provide an export calendar link. Copy it and paste it when registering the custom channel on AetherHMS.</li>
                      </ol>
                    )}
                    {activeOtaTab === "agoda" && (
                      <ol style={{ paddingLeft: "18px", margin: 0, display: "flex", flexDirection: "column", gap: "6px" }}>
                        <li>Sign into your <strong>Agoda Homes</strong> host dashboard.</li>
                        <li>Select the property listing, navigate to <strong>Calendar</strong>, and click <strong>Calendar Sync</strong>.</li>
                        <li>Click <strong>Export Calendar</strong> to copy Agoda's feed. Paste it into the <em>External iCal Import Feed URL</em> inside AetherHMS's registration console.</li>
                        <li>Click <strong>Import Calendar</strong>. Paste the unique <em>AetherHMS Outbound Link</em>, name it "AetherHMS Link", and click save.</li>
                      </ol>
                    )}
                    {activeOtaTab === "makemytrip" && (
                      <ol style={{ paddingLeft: "18px", margin: 0, display: "flex", flexDirection: "column", gap: "6px" }}>
                        <li>Access your <strong>MakeMyTrip In-Extranet</strong> console.</li>
                        <li>Under property setup / pricing settings, go to the <strong>iCal Settings / Channel Sync</strong> tab.</li>
                        <li>Select <strong>Register External iCal Sync</strong>. Paste the <em>AetherHMS Outbound Link</em> here. MakeMyTrip will lock rates based on local entries.</li>
                        <li>Copy the export calendar feed provided by MakeMyTrip and save it into our Custom Channel import link so AetherHMS pulls room locks automatically.</li>
                      </ol>
                    )}
                  </div>
                </div>

              </div>

              {/* Right Column: Live .ics Sandbox & Validator */}
              <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
                
                <div className="glass-card" style={{
                  padding: "24px",
                  border: "1px solid rgba(255, 255, 255, 0.05)",
                  background: "rgba(20, 20, 30, 0.4)",
                  height: "100%",
                  display: "flex",
                  flexDirection: "column",
                  gap: "16px"
                }}>
                  
                  <div>
                    <h4 style={{ fontSize: "1.05rem", fontWeight: "700", color: "#4ade80", margin: "0 0 4px 0", display: "flex", alignItems: "center", gap: "8px" }}>
                      🧪 Live .ics Sandbox Parser & Validator
                    </h4>
                    <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)", margin: 0 }}>
                      Paste any OTA iCalendar feed text block (or load a sample) to validate syntax and parse event properties client-side.
                    </p>
                  </div>

                  {/* Sample Loaders */}
                  <div style={{ display: "flex", gap: "8px" }}>
                    <button
                      className="btn-secondary"
                      style={{ padding: "6px 12px", fontSize: "0.75rem", display: "flex", alignItems: "center", gap: "4px" }}
                      onClick={() => loadSampleIcs("aether")}
                    >
                      📂 Load Sample AetherHMS Payload
                    </button>
                    <button
                      className="btn-secondary"
                      style={{ padding: "6px 12px", fontSize: "0.75rem", display: "flex", alignItems: "center", gap: "4px" }}
                      onClick={() => loadSampleIcs("airbnb")}
                    >
                      📂 Load Sample Airbnb Payload
                    </button>
                  </div>

                  {/* Code Textarea */}
                  <div style={{ flexGrow: 1, minHeight: "220px", display: "flex", flexDirection: "column" }}>
                    <label style={{ ...labelStyle, color: "var(--text-muted)" }}>Raw iCal Data String Input</label>
                    <textarea
                      style={{
                        flexGrow: 1,
                        width: "100%",
                        padding: "12px",
                        backgroundColor: "rgba(0, 0, 0, 0.4)",
                        border: "1px solid rgba(255, 255, 255, 0.08)",
                        borderRadius: "6px",
                        fontFamily: "monospace",
                        fontSize: "0.75rem",
                        color: "#34d399",
                        outline: "none",
                        resize: "none",
                        minHeight: "220px",
                        lineHeight: "1.4"
                      }}
                      placeholder="BEGIN:VCALENDAR&#10;VERSION:2.0&#10;...&#10;END:VCALENDAR"
                      value={sandboxIcsText}
                      onChange={(e) => setSandboxIcsText(e.target.value)}
                    />
                  </div>

                  {/* Parse Button */}
                  <button
                    className="btn-primary"
                    style={{
                      width: "100%",
                      padding: "10px",
                      fontWeight: "700",
                      background: "linear-gradient(135deg, #10b981, #059669)",
                      border: "none",
                      color: "#fff",
                      cursor: "pointer"
                    }}
                    onClick={() => {
                      const res = parseIcsContent(sandboxIcsText);
                      setSandboxParseResult(res);
                    }}
                  >
                    🧪 Parse & Validate .ics Calendar
                  </button>

                  {/* Parse Results Display */}
                  {sandboxParseResult && (
                    <div style={{
                      padding: "16px",
                      borderRadius: "6px",
                      backgroundColor: sandboxParseResult.success ? "rgba(16, 185, 129, 0.06)" : "rgba(239, 68, 68, 0.06)",
                      border: `1px solid ${sandboxParseResult.success ? "rgba(16, 185, 129, 0.2)" : "rgba(239, 68, 68, 0.2)"}`,
                      maxHeight: "240px",
                      overflowY: "auto"
                    }}>
                      
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                        <span style={{
                          fontSize: "0.75rem",
                          fontWeight: "800",
                          padding: "4px 10px",
                          borderRadius: "4px",
                          backgroundColor: sandboxParseResult.success ? "#10b981" : "#ef4444",
                          color: "#fff"
                        }}>
                          {sandboxParseResult.success ? "✓ CALENDAR VALID" : "✗ VALIDATION FAILURE"}
                        </span>
                        
                        <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                          Events Found: <strong>{sandboxParseResult.eventsCount}</strong>
                        </span>
                      </div>

                      {/* Display parsing errors if any */}
                      {!sandboxParseResult.success && sandboxParseResult.errors && (
                        <div style={{ fontSize: "0.75rem", color: "#f87171" }}>
                          <strong style={{ display: "block", marginBottom: "4px" }}>Syntax issues found:</strong>
                          <ul style={{ margin: 0, paddingLeft: "16px" }}>
                            {sandboxParseResult.errors.map((err: string, i: number) => (
                              <li key={i}>{err}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Display event details if parsed */}
                      {sandboxParseResult.success && (
                        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                          {sandboxParseResult.events.length === 0 ? (
                            <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontStyle: "italic", margin: 0 }}>
                              Calendar header valid, but contains no actual block elements.
                            </p>
                          ) : (
                            sandboxParseResult.events.map((evt: any, i: number) => (
                              <div key={i} style={{
                                padding: "10px",
                                borderRadius: "4px",
                                backgroundColor: "rgba(255, 255, 255, 0.02)",
                                border: "1px solid rgba(255,255,255,0.03)"
                              }}>
                                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem", fontWeight: "600", color: "#fff" }}>
                                  <span>{evt.summary}</span>
                                  <span style={{ color: "#34d399" }}>Block {i + 1}</span>
                                </div>
                                <div style={{ fontSize: "0.7rem", color: "var(--text-secondary)", marginTop: "4px" }}>
                                  <strong>Duration:</strong> {evt.start} ➔ {evt.end}
                                </div>
                                {evt.description && (
                                  <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginTop: "2px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                    <strong>Description:</strong> {evt.description}
                                  </div>
                                )}
                                <div style={{ fontSize: "0.6rem", color: "var(--text-muted)", fontFamily: "monospace", marginTop: "2px" }}>
                                  <strong>UID:</strong> {evt.uid}
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      )}

                    </div>
                  )}

                </div>

              </div>

            </div>

            {/* Modal Footer */}
            <div style={{
              padding: "16px 28px",
              borderTop: "1px solid rgba(255, 255, 255, 0.06)",
              display: "flex",
              justifyContent: "flex-end",
              background: "rgba(10, 10, 15, 0.4)"
            }}>
              <button
                className="btn-secondary"
                style={{ padding: "10px 20px", fontWeight: "600" }}
                onClick={() => {
                  setShowIcalEducation(false);
                  setSandboxParseResult(null);
                }}
              >
                Close Hub Dashboard
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
