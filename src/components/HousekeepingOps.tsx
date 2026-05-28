import React, { useState, useEffect, useRef } from "react";

interface Room {
  id: string;
  number: string;
  name: string;
  type: string;
  basePrice?: number;
}

interface Reservation {
  id: string;
  roomId: string;
  guestName: string;
  startIndex: number;
  duration: number;
  status: string;
  details: string;
  isGroup: boolean;
  groupName: string;
}

interface HousekeepingOpsProps {
  currentRooms: Room[];
  currentReservations: Reservation[];
  activePropertyId: string;
  addToast: (msg: string, type?: "success" | "error" | "warning") => void;
  activePropertyType?: string;
}

interface Housekeeper {
  id: string;
  name: string;
  phone: string;
  status: "active" | "off-duty";
}

interface MaintenanceTicket {
  id: string;
  roomNumber: string;
  issue: string;
  priority: "low" | "medium" | "high";
  status: "Reported" | "In Progress" | "Resolved";
  reportedAt: string;
}

export default function HousekeepingOps({
  currentRooms,
  currentReservations,
  activePropertyId,
  addToast,
  activePropertyType,
}: HousekeepingOpsProps) {
  // --- View States ---
  const [viewMode, setViewMode] = useState<"desktop" | "mobile">("desktop");
  
  // --- Housekeepers Roster ---
  const [housekeepers, setHousekeepers] = useState<Housekeeper[]>([]);
  const [newHkName, setNewHkName] = useState("");
  const [newHkPhone, setNewHkPhone] = useState("");

  // --- Room Turnover Statuses ---
  const [roomStatuses, setRoomStatuses] = useState<Record<string, {
    status: "Clean" | "Dirty" | "In Progress" | "Inspecting";
    assignedTo: string; // housekeeper id
    lastUpdated: string;
  }>>({});

  // --- Maintenance Tickets ---
  const [tickets, setTickets] = useState<MaintenanceTicket[]>([]);
  const [newTicketRoom, setNewTicketRoom] = useState("");
  const [newTicketIssue, setNewTicketIssue] = useState("");
  const [newTicketPriority, setNewTicketPriority] = useState<"low" | "medium" | "high">("medium");
  const [dispatchTicketId, setDispatchTicketId] = useState<string | null>(null);
  const [techPhone, setTechPhone] = useState("");

  // --- Laundry & Linen Tracker States ---
  const [inventoryItems, setInventoryItems] = useState([
    { id: "sheets", name: "Double Sheets", count: 0 },
    { id: "towels", name: "Plush Hand Towels", count: 0 },
    { id: "pillowcases", name: "Pillow Cases", count: 0 },
  ]);
  const [laundryActive, setLaundryActive] = useState(false);
  const [laundryTimer, setLaundryTimer] = useState(0);
  const [laundryLoadSize, setLaundryLoadSize] = useState(5); // number of items to clean
  const [laundryType, setLaundryType] = useState<string>("sheets");

  // Custom Item Creation state
  const [showAddCustom, setShowAddCustom] = useState(false);
  const [customItemName, setCustomItemName] = useState("");

  // --- MediaRecorder (Voice Memos) ---
  const [recording, setRecording] = useState(false);
  const [recordingRoomId, setRecordingRoomId] = useState<string | null>(null);
  const [voiceMemos, setVoiceMemos] = useState<Record<string, string>>({}); // roomId -> Audio Blob URL
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const isInitialMount = useRef(true);

  // --- Load Data from Database ---
  useEffect(() => {
    const loadData = async () => {
      if (!activePropertyId) return;

      try {
        const hkRes = await fetch(`/api/housekeepers?propertyId=${activePropertyId}`);
        const ticketRes = await fetch(`/api/tickets?propertyId=${activePropertyId}`);
        const invRes = await fetch(`/api/inventory?propertyId=${activePropertyId}`);

        if (hkRes.ok) setHousekeepers(await hkRes.json());
        if (ticketRes.ok) setTickets(await ticketRes.json());
        
        if (invRes.ok) {
          const invData = await invRes.json();
          if (invData.length > 0) {
            setInventoryItems(invData.map((item: any) => ({
              id: item.itemId,
              name: item.name,
              count: item.count
            })));
          }
        }
      } catch (err) {
        console.error("Failed to load backend data", err);
      }
    };
    loadData();
  }, [activePropertyId]);

  // --- Real-time Polling for Maintenance Tickets and Rooms ---
  useEffect(() => {
    if (!activePropertyId) return;
    const intervalId = setInterval(async () => {
      try {
        const ticketRes = await fetch(`/api/tickets?propertyId=${activePropertyId}`);
        if (ticketRes.ok) {
          const freshTickets = await ticketRes.json();
          setTickets(freshTickets);
        }
        
        const roomRes = await fetch(`/api/rooms?propertyId=${activePropertyId}`);
        if (roomRes.ok) {
          const freshRooms = await roomRes.json();
          setRoomStatuses((prev) => {
            let updated = false;
            const next = { ...prev };
            freshRooms.forEach((r: any) => {
              if (r.cleanStatus && r.cleanStatus !== "Pending" && prev[r.id]?.status !== r.cleanStatus) {
                next[r.id] = { ...next[r.id], status: r.cleanStatus, lastUpdated: r.hkLastUpdated || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) };
                updated = true;
              }
            });
            return updated ? next : prev;
          });
        }
      } catch (e) {
        // ignore fetch errors during polling
      }
    }, 3000); // Poll every 3 seconds for instant UX
    return () => clearInterval(intervalId);
  }, [activePropertyId]);

  // --- Initialize Room Cleanliness States ---
  useEffect(() => {
    const initial: Record<string, any> = {};
    currentRooms.forEach((room, idx) => {
      const hasMaint = currentReservations.some(
        (res) => res.roomId === room.id && res.status === "maintenance"
      );
      // Seed initial dirty/clean states reactively
      const isDirty = hasMaint ? true : (idx % 2 === 0);
      initial[room.id] = {
        status: isDirty ? "Dirty" : "Clean",
        assignedTo: isDirty ? (idx % 4 === 0 ? "hk-1" : "hk-2") : "",
        lastUpdated: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
    });

    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("aether_room_housekeeping_statuses");
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          if (parsed && Object.keys(parsed).length > 0) {
            // Check if all currentRooms have statuses mapped, if not merge with initial
            const merged = { ...initial, ...parsed };
            // For any room that has an active maintenance block, if its status is "Clean", override it to "Dirty"
            currentRooms.forEach((room) => {
              const hasMaint = currentReservations.some(
                (res) => res.roomId === room.id && res.status === "maintenance"
              );
              if (hasMaint && merged[room.id]?.status === "Clean") {
                merged[room.id] = {
                  ...merged[room.id],
                  status: "Dirty",
                  lastUpdated: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                };
              }
            });
            setRoomStatuses(merged);
            return;
          }
        } catch (e) {
          console.error("Failed to parse housekeeping statuses from localStorage", e);
        }
      }
    }
    setRoomStatuses((prev) => {
      const base = Object.keys(prev).length === 0 ? initial : { ...prev };
      currentRooms.forEach((room) => {
        const hasMaint = currentReservations.some(
          (res) => res.roomId === room.id && res.status === "maintenance"
        );
        if (hasMaint && base[room.id]?.status === "Clean") {
          base[room.id] = {
            ...base[room.id],
            status: "Dirty",
            lastUpdated: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          };
        }
      });
      return base;
    });
  }, [currentRooms, currentReservations]);

  // --- Save Room Cleanliness States to localStorage ---
  useEffect(() => {
    if (typeof window !== "undefined" && Object.keys(roomStatuses).length > 0) {
      localStorage.setItem("aether_room_housekeeping_statuses", JSON.stringify(roomStatuses));
    }
  }, [roomStatuses]);

  // --- Text-to-Speech (TTS) Voice Synthesis Engine ---
  const speakText = (text: string, lang: "en-IN" | "hi-IN") => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      addToast("⚠️ Text-to-Speech is not supported in this browser.", "error");
      return;
    }
    
    window.speechSynthesis.cancel(); // Stop any active speech
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    utterance.rate = 0.9; // Spoken slightly slower for absolute clarity
    utterance.pitch = 1.0;

    // Fetch voices and set matching accent if available
    const voices = window.speechSynthesis.getVoices();
    const voice = voices.find(v => v.lang.startsWith(lang.split("-")[0]));
    if (voice) {
      utterance.voice = voice;
    }

    window.speechSynthesis.speak(utterance);
    addToast(`🔊 Speaking task in ${lang === "hi-IN" ? "Hindi" : "English"}...`, "success");
  };

  // --- MediaRecorder Microphone Capture Engine ---
  const startRecording = async (roomId: string) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        const audioUrl = URL.createObjectURL(audioBlob);
        setVoiceMemos((prev) => ({ ...prev, [roomId]: audioUrl }));
        addToast("🎙️ Spoken voice instruction successfully saved!", "success");
      };

      setRecordingRoomId(roomId);
      setRecording(true);
      recorder.start();
    } catch (err) {
      console.error(err);
      addToast("🚫 Microphone permission denied or not found.", "error");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.stop();
      // Stop all mic stream tracks cleanly
      mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop());
      setRecording(false);
      setRecordingRoomId(null);
    }
  };

  // --- WhatsApp click-to-chat sync ---
  const handleSendWhatsApp = (room: Room, statusData: any) => {
    const hk = housekeepers.find((h) => h.id === statusData.assignedTo);
    if (!hk) {
      addToast("⚠️ Please assign a housekeeper to this room first.", "warning");
      return;
    }
    if (!hk.phone) {
      addToast("⚠️ Housekeeper does not have a registered phone number.", "warning");
      return;
    }

    const reservation = currentReservations.find((res) => res.roomId === room.id);
    const guestNotes = reservation ? ` | Special Requests: ${reservation.details || "None"}` : "";

    // Formulate a beautiful, highly structured instruction template
    const textMsg = `*AETHER HMS ROOM TURNOVER ALERT* 🧹\n\n` +
      `• *Room:* Room ${room.number} (${room.type})\n` +
      `• *Status:* Turnover Needed (${statusData.status})\n` +
      `• *Staff Assigned:* ${hk.name}\n` +
      `• *Instructions:* Perform clean turnover. Replace sheets and towels.${guestNotes}\n\n` +
      `*AetherVoice Assist Option:* If you cannot read, tap the link below on your phone to open the console and play the audio narration:\n` +
      `👉 ${window.location.origin}/alert?roomId=${room.id}&room=${room.number}&hk=${encodeURIComponent(hk.name)}&status=${encodeURIComponent(statusData.status)}`;

    const encodedMsg = encodeURIComponent(textMsg);
    const waUrl = `https://api.whatsapp.com/send?phone=${hk.phone}&text=${encodedMsg}`;
    
    // Safely trigger standard WhatsApp protocol
    window.open(waUrl, "_blank");
    addToast(`💬 Launching WhatsApp dispatcher to ${hk.name}!`, "success");
  };

  // --- Handle Room Status Changes ---
  const handleStatusChange = async (roomId: string, newStatus: "Clean" | "Dirty" | "In Progress" | "Inspecting") => {
    const lastUpdated = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    setRoomStatuses((prev) => ({
      ...prev,
      [roomId]: {
        ...prev[roomId],
        status: newStatus,
        lastUpdated,
      },
    }));

    // Update via API
    fetch(`/api/rooms/${roomId}/status`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cleanStatus: newStatus, hkLastUpdated: lastUpdated }),
    }).catch(console.error);

    if (newStatus === "Clean") {
      const maintBlocks = currentReservations.filter(
        (res) => res.roomId === roomId && res.status === "maintenance"
      );
      
      if (maintBlocks.length > 0) {
        // Automatically release dummy maintenance blocks, and check-out real guests
        Promise.all(maintBlocks.map(block => {
          if (block.guestName === "Room Maintenance Block") {
            return fetch(`/api/reservations/${block.id}`, {
              method: "DELETE",
            });
          } else {
            return fetch(`/api/reservations/${block.id}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ status: "checked-out" }),
            });
          }
        }))
        .then(() => {
          addToast(`🧹 Housekeeping turnover completed: Room has been released from Out-of-Order maintenance state.`, "success");
          // Reload page context to refresh the front office grid
          setTimeout(() => {
            window.location.reload();
          }, 1200);
        })
        .catch((err) => {
          console.error("Failed to automatically release room from maintenance", err);
          addToast(`⚠️ Failed to fully release maintenance. Room status updated to CLEAN locally.`, "warning");
        });
      } else {
        addToast(`Room updated to ${newStatus.toUpperCase()} successfully!`, "success");
      }
    } else {
      addToast(`Room updated to ${newStatus.toUpperCase()} successfully!`, "success");
    }
  };

  // --- Handle Task Assignment ---
  const handleAssignHousekeeper = (roomId: string, hkId: string) => {
    const lastUpdated = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setRoomStatuses((prev) => ({
      ...prev,
      [roomId]: {
        ...prev[roomId],
        assignedTo: hkId,
        lastUpdated,
      },
    }));
    
    // Update via API
    fetch(`/api/rooms/${roomId}/status`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hkAssignedTo: hkId, hkLastUpdated: lastUpdated }),
    }).catch(console.error);

    const hkName = housekeepers.find((h) => h.id === hkId)?.name || "Unassigned";
    addToast(`Room assigned to ${hkName}.`, "success");
  };

  // Helper for Inventory Updates
  const updateInventoryAPI = async (itemId: string, name: string, addedCount: number) => {
    if (!activePropertyId) return;
    try {
      await fetch("/api/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId, name, count: addedCount, propertyId: activePropertyId }),
      });
    } catch (e) {
      console.error(e);
    }
  };

  // --- Laundry Washer Timer Countdown Simulator ---
  useEffect(() => {
    let interval: any;
    if (laundryActive && laundryTimer > 0) {
      interval = setInterval(() => {
        setLaundryTimer((prev) => prev - 1);
      }, 1000);
    } else if (laundryActive && laundryTimer === 0) {
      setLaundryActive(false);
      // Wash complete! Add cleaned items to inventory stock
      setInventoryItems((prev) => 
        prev.map(item => item.id === laundryType ? { ...item, count: item.count + laundryLoadSize } : item)
      );
      
      const itemName = inventoryItems.find(i => i.id === laundryType)?.name || laundryType;
      updateInventoryAPI(laundryType, itemName, laundryLoadSize);
      
      addToast(`🎉 Laundry wash complete! +${laundryLoadSize} ${itemName} added to active linen stock.`, "success");
    }
    return () => clearInterval(interval);
  }, [laundryActive, laundryTimer]);

  const startLaundryCycle = () => {
    if (laundryActive) return;
    setLaundryActive(true);
    setLaundryTimer(10); // Simulated 10 second quick-cycle wash
    const itemName = inventoryItems.find(i => i.id === laundryType)?.name || laundryType;
    addToast(`🧺 Commencing wash cycle: 10s countdown initiated for ${laundryLoadSize} ${itemName}.`, "success");
  };

  // --- Maintenance Ticket Creator ---
  const handleAddTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTicketRoom || !newTicketIssue || !activePropertyId) {
      addToast("❓ Please enter a room number and describe the maintenance issue.", "warning");
      return;
    }

    try {
      const res = await fetch("/api/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomNumber: newTicketRoom,
          issue: newTicketIssue,
          priority: newTicketPriority,
          propertyId: activePropertyId,
        }),
      });
      if (res.ok) {
        const { data } = await res.json();
        setTickets((prev) => [data, ...prev]);
        setNewTicketRoom("");
        setNewTicketIssue("");
        addToast(`🔧 Maintenance ticket successfully registered for Room ${newTicketRoom}!`, "success");
      }
    } catch (err) {
      addToast("Failed to register ticket.", "error");
    }
  };

  const handleUpdateTicketStatus = async (id: string, newStatus: "Reported" | "In Progress" | "Resolved") => {
    try {
      const res = await fetch(`/api/tickets/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        setTickets((prev) =>
          prev.map((t) => (t.id === id ? { ...t, status: newStatus } : t))
        );
      }
    } catch (err) {
      addToast("Failed to update ticket.", "error");
    }
  };

  // --- Dispatch Maintenance Ticket via WhatsApp ---
  const executeDispatchTicket = (ticket: MaintenanceTicket) => {
    if (!techPhone) {
      addToast("Please enter a valid phone number.", "warning");
      return;
    }

    const textMsg = `*AETHER HMS MAINTENANCE ALERT* 🔧\n\n` +
      `• *Room:* Room ${ticket.roomNumber}\n` +
      `• *Priority:* ${ticket.priority.toUpperCase()}\n` +
      `• *Issue:* ${ticket.issue}\n\n` +
      `Please report to this room immediately.\n\n` + 
      `*When finished, tap here to mark as Resolved:*\n` +
      `👉 ${window.location.origin}/maintenance?ticketId=${ticket.id}&room=${ticket.roomNumber}`;

    const encodedMsg = encodeURIComponent(textMsg);
    const waUrl = `https://api.whatsapp.com/send?phone=${techPhone.replace(/\D/g, '')}&text=${encodedMsg}`;
    
    window.open(waUrl, "_blank");
    addToast(`🚀 Launching WhatsApp dispatcher for Maintenance!`, "success");
    setDispatchTicketId(null);
    setTechPhone("");
  };

  // --- Register Staff Housekeeper ---
  const handleAddHousekeeper = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHkName || !newHkPhone || !activePropertyId) {
      addToast("Please fill in housekeeper details.", "warning");
      return;
    }
    
    try {
      const res = await fetch("/api/housekeepers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newHkName,
          phone: newHkPhone,
          propertyId: activePropertyId,
        }),
      });
      if (res.ok) {
        const { data } = await res.json();
        setHousekeepers((prev) => [...prev, data]);
        setNewHkName("");
        setNewHkPhone("");
        addToast(`Staff member ${data.name} registered.`, "success");
      }
    } catch (err) {
      addToast("Failed to register staff.", "error");
    }
  };

  // --- Style Constants ---
  const glassCardStyle: React.CSSProperties = {
    background: "rgba(30, 27, 75, 0.25)",
    backdropFilter: "blur(12px)",
    WebkitBackdropFilter: "blur(12px)",
    border: "1px solid rgba(255,255,255,0.06)",
    borderRadius: "16px",
    padding: "24px",
    boxShadow: "0 10px 30px rgba(0,0,0,0.3)",
    display: "flex",
    flexDirection: "column",
    gap: "16px",
  };

  const badgeStyle = (status: string) => {
    const styles: Record<string, React.CSSProperties> = {
      Clean: { backgroundColor: "rgba(16, 185, 129, 0.15)", color: "#10b981", border: "1px solid rgba(16, 185, 129, 0.3)" },
      Dirty: { backgroundColor: "rgba(239, 68, 68, 0.15)", color: "#ef4444", border: "1px solid rgba(239, 68, 68, 0.3)" },
      "In Progress": { backgroundColor: "rgba(245, 158, 11, 0.15)", color: "#f59e0b", border: "1px solid rgba(245, 158, 11, 0.3)" },
      Inspecting: { backgroundColor: "rgba(99, 102, 241, 0.15)", color: "#6366f1", border: "1px solid rgba(99, 102, 241, 0.3)" },
    };
    return {
      padding: "4px 8px",
      borderRadius: "6px",
      fontSize: "0.75rem",
      fontWeight: 600,
      width: "fit-content",
      ...styles[status],
    };
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      
      {/* 🚀 Advanced Mode Toggler */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid rgba(255,255,255,0.05)", paddingBottom: "16px" }}>
        <div>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "#fff", display: "flex", alignItems: "center", gap: "8px" }}>
            🧹 Housekeeping & Localized Voice Ops
          </h1>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.85rem", marginTop: "2px" }}>
            Direct mobile dispatch, interactive Hindi/English Text-to-Speech assistants, and custom microphone voice recorders.
          </p>
        </div>

        <div style={{ display: "flex", gap: "8px", backgroundColor: "rgba(255,255,255,0.03)", padding: "4px", borderRadius: "10px", border: "1px solid var(--border-color)" }}>
          <button
            onClick={() => setViewMode("desktop")}
            style={{
              padding: "8px 16px",
              borderRadius: "8px",
              border: "none",
              fontSize: "0.85rem",
              fontWeight: "600",
              cursor: "pointer",
              backgroundColor: viewMode === "desktop" ? "var(--border-focus)" : "transparent",
              color: "#fff",
              transition: "all 0.2s ease",
            }}
          >
            🖥️ Desktop Manager Panel
          </button>
          <button
            onClick={() => setViewMode("mobile")}
            style={{
              padding: "8px 16px",
              borderRadius: "8px",
              border: "none",
              fontSize: "0.85rem",
              fontWeight: "600",
              cursor: "pointer",
              backgroundColor: viewMode === "mobile" ? "var(--border-focus)" : "transparent",
              color: "#fff",
              transition: "all 0.2s ease",
            }}
          >
            📱 Smartphone Staff Emulator
          </button>
        </div>
      </div>

      {viewMode === "desktop" ? (
        /* ==================== DESKTOP MANAGER VIEW ==================== */
        <div style={{ display: "grid", gridTemplateColumns: "1.3fr 0.7fr", gap: "24px" }}>
          
          {/* Left Main Pane: Room Queue & Sync */}
          <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            
            {/* Turnover Table */}
            <div style={glassCardStyle}>
              <h3 style={{ fontSize: "1.05rem", fontWeight: "700", color: "#fff", display: "flex", alignItems: "center", gap: "6px" }}>
                📋 Room Turnover & Priority Queue
              </h3>
              
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.85rem" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", color: "var(--text-secondary)" }}>
                      <th style={{ padding: "12px 8px" }}>Room</th>
                      <th style={{ padding: "12px 8px" }}>Status</th>
                      <th style={{ padding: "12px 8px" }}>Assignee</th>
                      <th style={{ padding: "12px 8px" }}>Priority Alerts (Guest Notes)</th>
                      <th style={{ padding: "12px 8px" }}>Voice Memo</th>
                      <th style={{ padding: "12px 8px", textAlign: "right" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentRooms.map((room) => {
                      const statusData = roomStatuses[room.id] || { status: "Clean", assignedTo: "", lastUpdated: "00:00" };
                      const reservation = currentReservations.find((res) => res.roomId === room.id);
                      const hasNotes = reservation && reservation.details;
                      
                      return (
                        <tr key={room.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.03)", transition: "background-color 0.2s" }}>
                          <td style={{ padding: "14px 8px" }}>
                            <strong style={{ color: "#fff", display: "block" }}>{room.number}</strong>
                            <span style={{ fontSize: "0.7rem", color: "var(--text-secondary)" }}>{room.type}</span>
                          </td>
                          <td style={{ padding: "14px 8px" }}>
                            <select
                              value={statusData.status}
                              onChange={(e) => handleStatusChange(room.id, e.target.value as any)}
                              style={{
                                padding: "4px 8px",
                                borderRadius: "6px",
                                backgroundColor: "rgba(0,0,0,0.3)",
                                border: "1px solid var(--border-color)",
                                color: "#fff",
                                fontSize: "0.8rem",
                                cursor: "pointer",
                              }}
                            >
                              <option value="Clean">🟢 Clean</option>
                              <option value="Dirty">🔴 Dirty</option>
                              <option value="In Progress">🟡 In Progress</option>
                              <option value="Inspecting">🔵 Inspecting</option>
                            </select>
                          </td>
                          <td style={{ padding: "14px 8px" }}>
                            <select
                              value={statusData.assignedTo}
                              onChange={(e) => handleAssignHousekeeper(room.id, e.target.value)}
                              style={{
                                padding: "4px 8px",
                                borderRadius: "6px",
                                backgroundColor: "rgba(0,0,0,0.3)",
                                border: "1px solid var(--border-color)",
                                color: "#fff",
                                fontSize: "0.8rem",
                                cursor: "pointer",
                              }}
                            >
                              <option value="">Unassigned</option>
                              {housekeepers.map((h) => (
                                <option key={h.id} value={h.id}>{h.name}</option>
                              ))}
                            </select>
                          </td>
                          <td style={{ padding: "14px 8px", maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {hasNotes ? (
                              <span style={{ color: "var(--status-pending)", fontSize: "0.8rem" }}>
                                🔔 {reservation.guestName}: {reservation.details}
                              </span>
                            ) : (
                              <span style={{ color: "var(--text-muted)", fontSize: "0.75rem" }}>None</span>
                            )}
                          </td>
                          <td style={{ padding: "14px 8px" }}>
                            {recording && recordingRoomId === room.id ? (
                              <button
                                onClick={stopRecording}
                                style={{
                                  backgroundColor: "rgba(239, 68, 68, 0.2)",
                                  color: "#ef4444",
                                  border: "1px solid #ef4444",
                                  padding: "4px 8px",
                                  borderRadius: "6px",
                                  fontSize: "0.75rem",
                                  cursor: "pointer",
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "4px",
                                }}
                              >
                                ⏹️ Stop Recording
                              </button>
                            ) : (
                              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                <button
                                  onClick={() => startRecording(room.id)}
                                  title="Record custom voice memo via microphone"
                                  style={{
                                    backgroundColor: "rgba(255, 255, 255, 0.05)",
                                    border: "1px solid var(--border-color)",
                                    color: "#fff",
                                    padding: "4px 8px",
                                    borderRadius: "6px",
                                    fontSize: "0.75rem",
                                    cursor: "pointer",
                                  }}
                                >
                                  🎙️ Record
                                </button>
                                {voiceMemos[room.id] && (
                                  <audio
                                    src={voiceMemos[room.id]}
                                    controls
                                    style={{ height: "24px", width: "80px", opacity: 0.8 }}
                                  />
                                )}
                              </div>
                            )}
                          </td>
                          <td style={{ padding: "14px 8px", textAlign: "right" }}>
                            <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end" }}>
                              <button
                                onClick={() => handleSendWhatsApp(room, statusData)}
                                className="btn-secondary"
                                style={{
                                  padding: "6px 10px",
                                  fontSize: "0.75rem",
                                  borderColor: "rgba(34, 197, 94, 0.3)",
                                  color: "#4ade80",
                                  backgroundColor: "rgba(34, 197, 94, 0.05)",
                                  cursor: "pointer",
                                }}
                              >
                                💬 WA Dispatch
                              </button>
                              <button
                                onClick={() => speakText(`Room ${room.number} needs turnover. Staff assigned is ${housekeepers.find(h => h.id === statusData.assignedTo)?.name || "unassigned"}.${hasNotes ? ` Special guest note: ${reservation.details}` : ""}`, "en-IN")}
                                className="btn-secondary"
                                style={{ padding: "6px 8px", fontSize: "0.75rem" }}
                                title="Synthesize speech instruction"
                              >
                                🔊 TTS
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Linen & Laundry cycles */}
            {activePropertyType === "homestay" && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr", gap: "24px" }}>
              {/* Linen Stocks */}
              <div style={glassCardStyle}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <h3 style={{ fontSize: "1.05rem", fontWeight: "700", color: "#fff", display: "flex", alignItems: "center", gap: "6px", margin: 0 }}>
                    🛏️ Linen & Asset Inventory
                  </h3>
                  <button
                    onClick={() => setShowAddCustom(!showAddCustom)}
                    className="btn-secondary"
                    style={{ fontSize: "0.7rem", padding: "4px 8px" }}
                  >
                    {showAddCustom ? "Cancel" : "➕ New Item"}
                  </button>
                </div>
                
                {showAddCustom && (
                  <div style={{ display: "flex", gap: "8px", marginTop: "4px", backgroundColor: "rgba(0,0,0,0.2)", padding: "8px", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.05)" }}>
                    <input
                      type="text"
                      placeholder="Item name (e.g. Blankets, Soap)"
                      value={customItemName}
                      onChange={(e) => setCustomItemName(e.target.value)}
                      style={{
                        padding: "6px 8px",
                        borderRadius: "6px",
                        backgroundColor: "rgba(0,0,0,0.3)",
                        border: "1px solid var(--border-color)",
                        color: "#fff",
                        fontSize: "0.8rem",
                        flexGrow: 1,
                      }}
                    />
                    <button
                      onClick={() => {
                        if (customItemName.trim() !== "") {
                          const id = customItemName.toLowerCase().replace(/[^a-z0-9]/g, '-');
                          setInventoryItems((prev) => [...prev, { id, name: customItemName, count: 0 }]);
                          updateInventoryAPI(id, customItemName, 0);
                          setLaundryType(id);
                          setCustomItemName("");
                          setShowAddCustom(false);
                          addToast(`📦 Added new category: ${customItemName}`, "success");
                        }
                      }}
                      className="btn-primary"
                      style={{ padding: "6px 10px", fontSize: "0.8rem" }}
                    >
                      Create
                    </button>
                  </div>
                )}

                <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginTop: "4px", maxHeight: "150px", overflowY: "auto", paddingRight: "4px" }}>
                  {inventoryItems.map((item) => (
                    <div key={item.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>{item.name}</span>
                      <span style={{ fontSize: "0.95rem", fontWeight: "700", color: "#fff" }}>{item.count} units</span>
                    </div>
                  ))}
                </div>

                {/* Manual Add Stock Form */}
                <div style={{ borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: "14px", marginTop: "8px", display: "flex", gap: "8px" }}>
                  <select
                    id="addStockType"
                    style={{
                      padding: "6px 8px",
                      borderRadius: "6px",
                      backgroundColor: "rgba(0,0,0,0.3)",
                      border: "1px solid var(--border-color)",
                      color: "#fff",
                      fontSize: "0.8rem",
                      flexGrow: 1,
                    }}
                  >
                    {inventoryItems.map((item) => (
                      <option key={item.id} value={item.id}>{item.name}</option>
                    ))}
                  </select>
                  <input
                    type="number"
                    id="addStockAmount"
                    defaultValue={10}
                    min={1}
                    style={{
                      padding: "6px 8px",
                      borderRadius: "6px",
                      backgroundColor: "rgba(0,0,0,0.3)",
                      border: "1px solid var(--border-color)",
                      color: "#fff",
                      fontSize: "0.8rem",
                      width: "60px",
                      textAlign: "right",
                    }}
                  />
                  <button
                    onClick={() => {
                      const typeId = (document.getElementById("addStockType") as HTMLSelectElement).value;
                      const amount = parseInt((document.getElementById("addStockAmount") as HTMLInputElement).value) || 0;
                      if (amount > 0) {
                        setInventoryItems((prev) => 
                          prev.map(item => item.id === typeId ? { ...item, count: item.count + amount } : item)
                        );
                        const typeName = inventoryItems.find(i => i.id === typeId)?.name || typeId;
                        updateInventoryAPI(typeId, typeName, amount);
                        addToast(`📦 Added ${amount} new ${typeName} to inventory.`, "success");
                      }
                    }}
                    className="btn-primary"
                    style={{ padding: "6px 10px", fontSize: "0.8rem", whiteSpace: "nowrap" }}
                  >
                    ➕ Add
                  </button>
                </div>
              </div>

              {/* Laundry washing machine */}
              <div style={glassCardStyle}>
                <h3 style={{ fontSize: "1.05rem", fontWeight: "700", color: "#fff", display: "flex", alignItems: "center", gap: "6px" }}>
                  🧺 Laundry Cycle Washer & Simulator
                </h3>
                <p style={{ color: "var(--text-secondary)", fontSize: "0.8rem" }}>
                  Simulate washing dirty sheets/towels. Once complete, items are added directly to the active inventory!
                </p>

                <div style={{ display: "flex", gap: "12px", alignItems: "center", marginTop: "4px" }}>
                  <select
                    value={laundryType}
                    onChange={(e: any) => setLaundryType(e.target.value)}
                    style={{
                      padding: "8px 12px",
                      borderRadius: "8px",
                      backgroundColor: "rgba(0,0,0,0.3)",
                      border: "1px solid var(--border-color)",
                      color: "#fff",
                      fontSize: "0.85rem",
                      flexGrow: 1,
                    }}
                  >
                    {inventoryItems.map((item) => (
                      <option key={item.id} value={item.id}>{item.name}</option>
                    ))}
                  </select>

                  <input
                    type="number"
                    value={laundryLoadSize}
                    onChange={(e) => setLaundryLoadSize(parseInt(e.target.value) || 1)}
                    style={{
                      padding: "8px 12px",
                      borderRadius: "8px",
                      backgroundColor: "rgba(0,0,0,0.3)",
                      border: "1px solid var(--border-color)",
                      color: "#fff",
                      fontSize: "0.85rem",
                      width: "80px",
                      textAlign: "right",
                    }}
                  />

                  <button
                    onClick={startLaundryCycle}
                    disabled={laundryActive}
                    className="btn-primary"
                    style={{ padding: "8px 16px", fontSize: "0.85rem", opacity: laundryActive ? 0.5 : 1 }}
                  >
                    🚀 Start Wash
                  </button>
                </div>

                {laundryActive && (
                  <div style={{ marginTop: "12px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem", color: "#fff", marginBottom: "4px" }}>
                      <span>Washing active load...</span>
                      <span>{laundryTimer}s remaining</span>
                    </div>
                    <div style={{ width: "100%", height: "8px", backgroundColor: "rgba(255,255,255,0.05)", borderRadius: "4px", overflow: "hidden" }}>
                      <div
                        style={{
                          width: `${(10 - laundryTimer) * 10}%`,
                          height: "100%",
                          backgroundColor: "var(--border-focus)",
                          transition: "width 1s linear",
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
            )}

          </div>

          {/* Right Pane: Staff registry & Maintenance tickets */}
          <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            
            {/* Housekeepers registry list */}
            <div style={glassCardStyle}>
              <h3 style={{ fontSize: "1.05rem", fontWeight: "700", color: "#fff", display: "flex", alignItems: "center", gap: "6px" }}>
                👥 Registered Housekeeping Staff
              </h3>

              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {housekeepers.map((h) => (
                  <div key={h.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", backgroundColor: "rgba(255,255,255,0.02)", padding: "10px 14px", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.03)" }}>
                    <div>
                      <strong style={{ fontSize: "0.85rem", color: "#fff" }}>{h.name}</strong>
                      <span style={{ display: "block", fontSize: "0.7rem", color: "var(--text-secondary)", marginTop: "2px" }}>
                        📞 {h.phone || "No phone added"}
                      </span>
                    </div>
                    <span style={{ fontSize: "0.7rem", backgroundColor: "rgba(16,185,129,0.1)", color: "#10b981", padding: "2px 6px", borderRadius: "4px" }}>Active</span>
                  </div>
                ))}
              </div>

              <form onSubmit={handleAddHousekeeper} style={{ borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: "14px", display: "flex", flexDirection: "column", gap: "8px" }}>
                <input
                  type="text"
                  placeholder="Staff Name (e.g. Amit)"
                  value={newHkName}
                  onChange={(e) => setNewHkName(e.target.value)}
                  style={{
                    padding: "8px 12px",
                    borderRadius: "8px",
                    backgroundColor: "rgba(0,0,0,0.3)",
                    border: "1px solid var(--border-color)",
                    color: "#fff",
                    fontSize: "0.8rem",
                  }}
                />
                <input
                  type="text"
                  placeholder="WhatsApp Number (e.g. 919876...)"
                  value={newHkPhone}
                  onChange={(e) => setNewHkPhone(e.target.value)}
                  style={{
                    padding: "8px 12px",
                    borderRadius: "8px",
                    backgroundColor: "rgba(0,0,0,0.3)",
                    border: "1px solid var(--border-color)",
                    color: "#fff",
                    fontSize: "0.8rem",
                  }}
                />
                <button type="submit" className="btn-primary" style={{ padding: "8px", fontSize: "0.8rem", justifyContent: "center" }}>
                  ➕ Add Operator
                </button>
              </form>
            </div>

            {/* Maintenance and AC Servicing Tickets board */}
            <div style={glassCardStyle}>
              <h3 style={{ fontSize: "1.05rem", fontWeight: "700", color: "#fff", display: "flex", alignItems: "center", gap: "6px" }}>
                🔧 Maintenance & Servicing Work Tickets
              </h3>

              <form onSubmit={handleAddTicket} style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                <input
                  type="text"
                  placeholder="Room (e.g. 101)"
                  value={newTicketRoom}
                  onChange={(e) => setNewTicketRoom(e.target.value)}
                  style={{
                    padding: "8px 12px",
                    borderRadius: "8px",
                    backgroundColor: "rgba(0,0,0,0.3)",
                    border: "1px solid var(--border-color)",
                    color: "#fff",
                    fontSize: "0.8rem",
                    width: "90px",
                  }}
                />
                <input
                  type="text"
                  placeholder="Describe issue (e.g. AC servicing required)"
                  value={newTicketIssue}
                  onChange={(e) => setNewTicketIssue(e.target.value)}
                  style={{
                    padding: "8px 12px",
                    borderRadius: "8px",
                    backgroundColor: "rgba(0,0,0,0.3)",
                    border: "1px solid var(--border-color)",
                    color: "#fff",
                    fontSize: "0.8rem",
                    flexGrow: 1,
                  }}
                />
                <select
                  value={newTicketPriority}
                  onChange={(e) => setNewTicketPriority(e.target.value as any)}
                  style={{
                    padding: "8px 12px",
                    borderRadius: "8px",
                    backgroundColor: "rgba(0,0,0,0.3)",
                    border: "1px solid var(--border-color)",
                    color: "#fff",
                    fontSize: "0.8rem",
                    cursor: "pointer",
                    outline: "none"
                  }}
                >
                  <option value="low">Low Priority</option>
                  <option value="medium">Med Priority</option>
                  <option value="high">High Priority</option>
                </select>
                <button type="submit" className="btn-primary" style={{ padding: "8px 12px", fontSize: "0.8rem" }}>
                  Report
                </button>
              </form>

              <div style={{ display: "flex", flexDirection: "column", gap: "10px", maxHeight: "250px", overflowY: "auto", marginTop: "6px" }}>
                {tickets.map((t) => (
                  <div key={t.id} style={{ display: "flex", flexDirection: "column", gap: "8px", backgroundColor: "rgba(255,255,255,0.02)", padding: "12px 14px", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.03)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <strong style={{ fontSize: "0.85rem", color: "#fff" }}>🛠️ Room {t.roomNumber}</strong>
                      <span style={{ fontSize: "0.7rem", backgroundColor: t.priority === "high" ? "rgba(239,68,68,0.1)" : "rgba(245,158,11,0.1)", color: t.priority === "high" ? "#ef4444" : "#f59e0b", padding: "2px 6px", borderRadius: "4px" }}>
                        {t.priority.toUpperCase()} PRIORITY
                      </span>
                    </div>
                    <p style={{ color: "var(--text-secondary)", fontSize: "0.8rem", margin: 0 }}>{t.issue}</p>
                    
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid rgba(255,255,255,0.03)", paddingTop: "8px", marginTop: "4px" }}>
                      <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>Reported: {t.reportedAt}</span>
                      <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                        {dispatchTicketId === t.id ? (
                          <div style={{ display: "flex", gap: "4px", alignItems: "center", background: "rgba(0,0,0,0.2)", padding: "2px", borderRadius: "6px" }}>
                            <input 
                              type="text" 
                              placeholder="Tech WA (e.g. 9198...)" 
                              value={techPhone}
                              onChange={e => setTechPhone(e.target.value)}
                              autoFocus
                              style={{ padding: "2px 6px", borderRadius: "4px", backgroundColor: "rgba(0,0,0,0.5)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", fontSize: "0.7rem", width: "110px", outline: "none" }}
                            />
                            <button onClick={() => executeDispatchTicket(t)} style={{ background: "#10b981", color: "#fff", border: "none", borderRadius: "4px", padding: "2px 8px", fontSize: "0.7rem", cursor: "pointer", fontWeight: "600" }}>Send</button>
                            <button onClick={() => setDispatchTicketId(null)} style={{ background: "transparent", color: "#ef4444", border: "none", cursor: "pointer", fontSize: "1rem", lineHeight: "1" }}>×</button>
                          </div>
                        ) : (
                          <button
                            onClick={() => { setDispatchTicketId(t.id); setTechPhone(""); }}
                            style={{
                              background: "rgba(16, 185, 129, 0.15)",
                              color: "#10b981",
                              border: "1px solid rgba(16, 185, 129, 0.3)",
                              borderRadius: "6px",
                              padding: "2px 8px",
                              fontSize: "0.7rem",
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              gap: "4px"
                            }}
                          >
                            💬 Send WA
                          </button>
                        )}
                        <select
                          value={t.status}
                          onChange={(e) => handleUpdateTicketStatus(t.id, e.target.value as any)}
                          style={{
                            padding: "2px 6px",
                            borderRadius: "4px",
                            backgroundColor: "rgba(0,0,0,0.3)",
                            border: "1px solid var(--border-color)",
                            color: "#fff",
                            fontSize: "0.75rem",
                            cursor: "pointer",
                          }}
                        >
                          <option value="Reported">🔴 Reported</option>
                          <option value="In Progress">🟡 In Progress</option>
                          <option value="Resolved">🟢 Resolved</option>
                        </select>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>

        </div>
      ) : (
        /* ==================== SMARTPHONE APP EMULATOR ==================== */
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", padding: "20px 0" }}>
          
          {/* Framed Phone Container */}
          <div style={{
            width: "360px",
            height: "640px",
            backgroundColor: "#0d0a1b",
            borderRadius: "36px",
            border: "12px solid #2e2a47",
            boxShadow: "0 25px 50px -12px rgba(0,0,0,0.8), inset 0 0 1px 1px rgba(255,255,255,0.1)",
            position: "relative",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            fontFamily: "var(--font-family)",
          }}>
            {/* Phone Camera Notch */}
            <div style={{
              width: "120px",
              height: "22px",
              backgroundColor: "#2e2a47",
              borderRadius: "0 0 14px 14px",
              position: "absolute",
              top: 0,
              left: "50%",
              transform: "translateX(-50%)",
              zIndex: 3,
            }} />

            {/* Phone Top Status Bar */}
            <div style={{
              height: "40px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-end",
              padding: "0 24px 6px 24px",
              fontSize: "0.7rem",
              color: "rgba(255,255,255,0.6)",
              backgroundColor: "rgba(0,0,0,0.2)",
              borderBottom: "1px solid rgba(255,255,255,0.02)",
            }}>
              <span>18:08 🕡</span>
              <div style={{ display: "flex", gap: "6px" }}>
                <span>📶 5G</span>
                <span>🔋 88%</span>
              </div>
            </div>

            {/* Phone App Content Screen */}
            <div style={{ flexGrow: 1, padding: "16px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "16px" }}>
              
              {/* Operator Welcome Header */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "10px" }}>
                <div>
                  <span style={{ fontSize: "0.65rem", color: "var(--border-focus)", fontWeight: 700, textTransform: "uppercase" }}>Staff Workspace</span>
                  <h3 style={{ fontSize: "1.1rem", fontWeight: "700", color: "#fff", margin: 0 }}>Namaste, Raju!</h3>
                  <span style={{ fontSize: "0.7rem", color: "var(--text-secondary)" }}>Shift Status: 🟢 On Duty</span>
                </div>
                <div style={{ width: "36px", height: "36px", borderRadius: "50%", backgroundColor: "var(--border-focus)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.95rem", fontWeight: 700, color: "#fff" }}>
                  RP
                </div>
              </div>

              {/* Accessible TTS Header Instructions for Non-readers */}
              <div style={{
                background: "linear-gradient(135deg, rgba(99, 102, 241, 0.15) 0%, rgba(168, 85, 247, 0.15) 100%)",
                border: "1px solid rgba(99, 102, 241, 0.2)",
                borderRadius: "12px",
                padding: "12px 14px",
                display: "flex",
                flexDirection: "column",
                gap: "8px",
              }}>
                <span style={{ fontSize: "0.75rem", color: "#a5b4fc", fontWeight: "700" }}>🗣️ Voice Assistant (सुनने के लिए दबाएं):</span>
                
                <div style={{ display: "flex", gap: "8px" }}>
                  <button
                    onClick={() => speakText("Raju, aapko aath room turnover kiye jaane hain. Apne mobile app screen me pehla room checklist dekhen.", "hi-IN")}
                    className="btn-primary"
                    style={{ flexGrow: 1, fontSize: "0.75rem", padding: "6px", justifyContent: "center" }}
                  >
                    🔊 Hindi me Sune
                  </button>
                  <button
                    onClick={() => speakText("Raju, you have room turnover tasks assigned. Tap on a task to check room details and play recorded custom audio instructions.", "en-IN")}
                    className="btn-secondary"
                    style={{ flexGrow: 1, fontSize: "0.75rem", padding: "6px", justifyContent: "center" }}
                  >
                    🔊 English TTS
                  </button>
                </div>
              </div>

              {/* My Turnover Tasks Queue list */}
              <div>
                <h4 style={{ fontSize: "0.8rem", color: "var(--text-secondary)", fontWeight: "600", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "1px" }}>
                  My Priority Rooms
                </h4>

                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {currentRooms
                    .filter((room) => {
                      const statusData = roomStatuses[room.id];
                      return statusData && statusData.assignedTo === "hk-1"; // Show only Raju's assigned rooms
                    })
                    .map((room) => {
                      const statusData = roomStatuses[room.id] || { status: "Dirty", lastUpdated: "00:00" };
                      const reservation = currentReservations.find((res) => res.roomId === room.id);
                      
                      return (
                        <div
                          key={room.id}
                          style={{
                            backgroundColor: "rgba(255, 255, 255, 0.03)",
                            border: "1px solid var(--border-color)",
                            borderRadius: "12px",
                            padding: "12px 14px",
                            display: "flex",
                            flexDirection: "column",
                            gap: "10px",
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <div>
                              <strong style={{ fontSize: "0.9rem", color: "#fff" }}>🚪 Room {room.number}</strong>
                              <span style={{ display: "block", fontSize: "0.7rem", color: "var(--text-secondary)" }}>{room.type}</span>
                            </div>
                            <span style={badgeStyle(statusData.status)}>{statusData.status}</span>
                          </div>

                          {reservation && reservation.details && (
                            <div style={{ backgroundColor: "rgba(245,158,11,0.05)", borderLeft: "3px solid var(--status-pending)", padding: "6px 10px", borderRadius: "4px" }}>
                              <span style={{ display: "block", fontSize: "0.65rem", textTransform: "uppercase", color: "var(--status-pending)", fontWeight: 700 }}>
                                🔔 Guest Alert
                              </span>
                              <p style={{ color: "var(--text-secondary)", fontSize: "0.75rem", margin: 0, marginTop: "2px", lineHeight: "1.4" }}>
                                {reservation.details}
                              </p>
                            </div>
                          )}

                          {/* Accessible Voice Audio helpers */}
                          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", alignItems: "center", borderTop: "1px solid rgba(255,255,255,0.03)", paddingTop: "8px" }}>
                            <button
                              onClick={() => speakText(`kamra number ${room.number} saaf karna hai. Guest ${reservation?.guestName || "ne"} room instruction di hai: ${reservation?.details || "none"}. Kripya sheet aur toliya badlen.`, "hi-IN")}
                              className="btn-secondary"
                              style={{ padding: "4px 8px", fontSize: "0.7rem", border: "1px solid rgba(255,255,255,0.08)" }}
                            >
                              🔊 Task Audio (Hindi)
                            </button>
                            {voiceMemos[room.id] && (
                              <button
                                onClick={() => {
                                  const audio = new Audio(voiceMemos[room.id]);
                                  audio.play();
                                  addToast("Playing custom manager voice note...", "success");
                                }}
                                className="btn-secondary"
                                style={{ padding: "4px 8px", fontSize: "0.7rem", borderColor: "rgba(99,102,241,0.3)", color: "#a5b4fc" }}
                              >
                                🎙️ Listen Manager Memo
                              </button>
                            )}
                          </div>

                          {/* Quick action buttons to change status */}
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px", marginTop: "4px" }}>
                            <button
                              onClick={() => handleStatusChange(room.id, "In Progress")}
                              className="btn-secondary"
                              style={{ fontSize: "0.75rem", padding: "6px", justifyContent: "center", display: "flex", alignItems: "center" }}
                            >
                              ⚙️ Start Clean
                            </button>
                            <button
                              onClick={() => handleStatusChange(room.id, "Clean")}
                              className="btn-primary"
                              style={{ fontSize: "0.75rem", padding: "6px", justifyContent: "center", display: "flex", alignItems: "center" }}
                            >
                              ✓ Done (Clean)
                            </button>
                          </div>

                        </div>
                      );
                    })}
                </div>
              </div>

            </div>

            {/* Phone Screen Bottom Navigation bar */}
            <div style={{
              height: "48px",
              borderTop: "1px solid rgba(255,255,255,0.04)",
              backgroundColor: "rgba(0,0,0,0.3)",
              display: "flex",
              justifyContent: "space-around",
              alignItems: "center",
              fontSize: "0.7rem",
              color: "rgba(255,255,255,0.6)",
              paddingBottom: "4px",
            }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "2px", color: "var(--border-focus)" }}>
                <span>🧹</span>
                <strong>Rooms</strong>
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "2px", opacity: 0.5 }}>
                <span>🧺</span>
                <span>Laundry</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "2px", opacity: 0.5 }}>
                <span>🛠️</span>
                <span>Issues</span>
              </div>
            </div>

          </div>

        </div>
      )}

    </div>
  );
}
