import React, { useState } from "react";
import styles from "../app/dashboard/dashboard.module.css";

export interface Reservation {
  id: string;
  roomId?: string; // Database ID mapping
  guestName: string;
  roomIndex: number;
  startIndex: number; // Index of date/hour column
  duration: number;   // Number of nights or 2-hour blocks
  status: "checked-in" | "confirmed" | "pending" | "maintenance" | "checked-out" | "cancelled";
  details: string;
  billingItems: { id: string; name: string; amount: number; category: string; invoiceGroup?: string }[];
  isGroup?: boolean;
  groupName?: string;
  bookingType?: "daily" | "hourly"; // Which grid scale this reservation belongs to

  // Contact Information
  phone?: string;
  email?: string;
  dob?: string;
  nationality?: string;

  // B2B Billing Details
  companyName?: string;
  guestGstin?: string;
  guestGstNumber?: string;
  billingType?: string;
  paymentMethod?: string;
  upiTransactionId?: string;
  specialRequests?: string;
  guestTag?: string;

  // Primary ID Verification
  idType?: string;
  idNumber?: string;
  idScanData?: string;

  // Foreign National - Form C Requirements
  passportNumber?: string;
  passportPlace?: string;
  passportIssueDate?: string;
  passportExpiryDate?: string;
  visaNumber?: string;
  visaType?: string;
  visaExpiryDate?: string;
  indiaArrivalDate?: string;
  portOfEntry?: string;
  arrivedFrom?: string;
  proceedingTo?: string;

  // Stay & Occupants Metadata
  checkInTime?: string;
  checkOutTime?: string;
  numAdults?: number;
  numChildren?: number;
  childAges?: string;
  vehicleNumber?: string;
}

export interface Room {
  id?: string; // Database ID mapping
  propertyId?: string;
  number: string;
  name: string;
  type: string;
  basePrice?: number;
  cleanStatus?: string;
}

interface VisualGridProps {
  rooms: Room[];
  reservations: Reservation[];
  activePropertyId?: string;
  onUpdateReservation: (updated: Reservation) => void;
  onSelectReservation: (res: Reservation) => void;
  timeScale: "daily" | "hourly";
  addToast: (msg: string, type?: "success" | "error" | "warning") => void;
  currentUser?: any;
  onEditRoom?: (room: Room) => void;
  onAddBookingAtCell?: (roomIndex: number, colIndex: number) => void;
}

export default function VisualGrid({
  rooms,
  reservations,
  activePropertyId,
  onUpdateReservation,
  onSelectReservation,
  timeScale,
  addToast,
  currentUser,
  onEditRoom,
  onAddBookingAtCell,
}: VisualGridProps) {
  const [dragOverCell, setDragOverCell] = useState<{ roomIdx: number; colIdx: number } | null>(null);
  
  const isSeniorStaff =
    currentUser?.role === "Super Admin" ||
    ((currentUser?.role === "General Manager" || currentUser?.role === "Front Office Manager") &&
      currentUser?.allowRoomManagement !== false);

  const [dateOffset, setDateOffset] = React.useState(0);


  // Constants based on scale
  const colCount = timeScale === "daily" ? 14 : 12;

  // Generate Daily Headers (14 days starting May 20, 2026)
  const getDailyHeaders = () => {
    const headers = [];
    const startDate = new Date(2026, 4, 20); // May 20, 2026
    startDate.setDate(startDate.getDate() + (timeScale === "daily" ? dateOffset : 0));
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    for (let i = 0; i < 14; i++) {
      const d = new Date(startDate);
      d.setDate(startDate.getDate() + i);
      headers.push({
        dayName: days[d.getDay()],
        dayNum: d.getDate(),
        month: d.toLocaleString("default", { month: "short" }),
      });
    }
    return headers;
  };

  // Generate Hourly Headers (12 slots, 2-hour increments starting 8 AM)
  const getHourlyHeaders = () => {
    return [
      "08:00 AM",
      "10:00 AM",
      "12:00 PM",
      "02:00 PM",
      "04:00 PM",
      "06:00 PM",
      "08:00 PM",
      "10:00 PM",
      "12:00 AM",
      "02:00 AM",
      "04:00 AM",
      "06:00 AM",
    ];
  };

  const dailyHeaders = getDailyHeaders();
  const hourlyHeaders = getHourlyHeaders();

  // HTML5 Drag & Drop handlers
  const handleDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.setData("text/plain", id);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, roomIdx: number, colIdx: number) => {
    e.preventDefault();
    if (!dragOverCell || dragOverCell.roomIdx !== roomIdx || dragOverCell.colIdx !== colIdx) {
      setDragOverCell({ roomIdx, colIdx });
    }
  };

  const handleDragLeave = () => {
    setDragOverCell(null);
  };

  const handleDrop = (e: React.DragEvent, targetRoomIdx: number, targetColIdx: number) => {
    e.preventDefault();
    setDragOverCell(null);
    const id = e.dataTransfer.getData("text/plain");
    const res = reservations.find((r) => r.id === id);

    if (res) {
      // Validate bounds (prevent booking falling out of calendar scale bounds)
      if (targetColIdx + res.duration > colCount) {
        addToast("⚠️ Cannot shift: Reservation extends past visible calendar bounds.");
        return;
      }

      // Check for overlap with other reservations in target room
      const overlap = reservations.find(
        (other) =>
          other.id !== id &&
          other.roomIndex === targetRoomIdx &&
          Math.max(other.startIndex, targetColIdx) < Math.min(other.startIndex + other.duration, targetColIdx + res.duration)
      );

      if (overlap) {
        addToast(`⚠️ Room Conflict: Overlaps with ${overlap.guestName}'s booking.`);
        return;
      }

      // Prevent past date drags (unless keeping the same date for a room change)
      const todayIndex = Math.floor(
        (new Date().setHours(0, 0, 0, 0) - new Date("2026-05-20").setHours(0, 0, 0, 0)) /
          (1000 * 60 * 60 * 24)
      );
      if (targetColIdx < todayIndex && targetColIdx !== res.startIndex) {
        addToast("⚠️ Past Date Restriction: You cannot move a booking to a past date.");
        return;
      }

      // Update reservation details
      const oldRoomNum = rooms[res.roomIndex].number;
      const newRoomNum = rooms[targetRoomIdx].number;
      
      let updatedDetails = res.details;
      if (targetRoomIdx !== res.roomIndex) {
        const reason = window.prompt(`Please provide a reason for moving ${res.guestName} to Room ${newRoomNum}:`);
        if (!reason) {
          addToast("Room change cancelled: Reason is required.");
          return;
        }

        // Fire room change log
        fetch("/api/room-changes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            reservationId: res.id,
            guestName: res.guestName,
            fromRoomId: rooms[res.roomIndex].id,
            toRoomId: rooms[targetRoomIdx].id,
            fromRoomNumber: oldRoomNum,
            toRoomNumber: newRoomNum,
            fromRoomName: rooms[res.roomIndex].name,
            toRoomName: rooms[targetRoomIdx].name,
            reason: reason,
            changedBy: currentUser ? `${currentUser.name} (${currentUser.role})` : "Grid Drag",
            propertyId: activePropertyId || rooms[targetRoomIdx].propertyId || "unknown"
          })
        }).catch(err => console.error("Failed to log room change:", err));

        updatedDetails = `${updatedDetails || ""}\n\n[Swapped from Room ${oldRoomNum} to ${newRoomNum}: ${reason}]`.trim();
        addToast(`🔄 Moved reservation for ${res.guestName} from Room ${oldRoomNum} to Room ${newRoomNum}`);
      } else {
        addToast(`📅 Date updated for ${res.guestName}`);
      }

      const updated = {
        ...res,
        roomId: rooms[targetRoomIdx].id, // Map the target database roomId
        roomIndex: targetRoomIdx,
        startIndex: targetColIdx,
        details: updatedDetails
      };

      onUpdateReservation(updated);
    }
  };

  // Status mapping to card style
  const getCardStyle = (status: string) => {
    switch (status) {
      case "checked-in":
        return styles.checkedInCard;
      case "confirmed":
        return styles.confirmedCard;
      case "pending":
        return styles.pendingCard;
      case "maintenance":
        return styles.maintenanceCard;
      case "checked-out":
        return styles.checkedOutCard;
      default:
        return "";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "checked-in": return "🟢 In-Room";
      case "confirmed": return "🔵 Confirmed";
      case "pending": return "🟡 Unpaid";
      case "maintenance": return "🛠️ Out of Order";
      case "checked-out": return "🏁 Checked-Out";
      default: return "";
    }
  };

  return (
    <div className={styles.gridScrollContainer}>
      <div className={timeScale === "daily" ? styles.gridCanvas : styles.hourlyGridCanvas}>
        {/* Top-left corner cell */}
        <div className={styles.gridCornerHeader} style={{ display: "flex", flexDirection: "column", gap: "4px", justifyContent: "center", alignItems: "flex-start" }}>
          <span>Rooms & Spaces</span>
          {timeScale === "daily" && (
            <div style={{ display: "flex", gap: "4px" }}>
              <button style={{ padding: "2px 8px", background: "var(--bg-secondary)", border: "1px solid var(--border-color)", borderRadius: "4px", cursor: "pointer", color: "var(--text-primary)" }} onClick={() => setDateOffset(prev => prev - 7)}>⬅️</button>
              <button style={{ padding: "2px 8px", background: "var(--bg-secondary)", border: "1px solid var(--border-color)", borderRadius: "4px", cursor: "pointer", color: "var(--text-primary)" }} onClick={() => setDateOffset(Math.floor((new Date().setHours(0,0,0,0) - new Date("2026-05-20").setHours(0,0,0,0)) / 86400000))}>Today</button>
              <button style={{ padding: "2px 8px", background: "var(--bg-secondary)", border: "1px solid var(--border-color)", borderRadius: "4px", cursor: "pointer", color: "var(--text-primary)" }} onClick={() => setDateOffset(prev => prev + 7)}>➡️</button>
            </div>
          )}
        </div>

        {/* Date / Time Headers */}
        {timeScale === "daily"
          ? dailyHeaders.map((h, i) => (
              <div key={i} className={styles.gridHeaderCell} style={{ gridColumn: i + 2 }}>
                <span className={styles.gridHeaderDayName}>{h.dayName}</span>
                <span className={styles.gridHeaderDayNum}>{h.dayNum}</span>
                <span style={{ fontSize: "0.65rem", color: "var(--text-muted)" }}>{h.month}</span>
              </div>
            ))
          : hourlyHeaders.map((h, i) => (
              <div key={i} className={styles.gridHeaderCell} style={{ gridColumn: i + 2 }}>
                <span className={styles.gridHeaderDayNum}>{h}</span>
                <span className={styles.gridHeaderDayName}>2-hr Slot</span>
              </div>
            ))}

        {/* Room rows and grids */}
        {rooms.map((room, roomIdx) => (
          <div className={styles.gridRow} key={room.number}>
            {/* Sticky Room Label */}
            <div
              className={styles.roomCell}
              style={{
                gridRow: roomIdx + 2,
                cursor: isSeniorStaff ? "pointer" : "default",
                transition: "background-color 0.2s ease",
              }}
              onClick={() => {
                if (isSeniorStaff && onEditRoom) {
                  onEditRoom(room);
                }
              }}
              onMouseEnter={(e) => {
                if (isSeniorStaff) {
                  e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.05)";
                  const editBadge = e.currentTarget.querySelector(".edit-badge");
                  if (editBadge) (editBadge as HTMLElement).style.opacity = "1";
                }
              }}
              onMouseLeave={(e) => {
                if (isSeniorStaff) {
                  e.currentTarget.style.backgroundColor = "var(--bg-secondary)";
                  const editBadge = e.currentTarget.querySelector(".edit-badge");
                  if (editBadge) (editBadge as HTMLElement).style.opacity = "0";
                }
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
                <div>
                  <div className={styles.roomName}>{room.number} — {room.name}</div>
                  <div className={styles.roomType}>{room.type}</div>
                </div>
                {isSeniorStaff && (
                  <span
                    className="edit-badge"
                    style={{
                      fontSize: "0.75rem",
                      color: "var(--border-focus)",
                      opacity: 0,
                      transition: "opacity 0.2s ease",
                      paddingLeft: "4px",
                    }}
                  >
                    ✏️
                  </span>
                )}
              </div>
            </div>

            {/* Backing Grid Cells for drop target & hover effects */}
            {Array.from({ length: colCount }).map((_, colIdx) => {
              const actualColIdx = colIdx + (timeScale === "daily" ? dateOffset : 0);
              const isOver = dragOverCell?.roomIdx === roomIdx && dragOverCell?.colIdx === actualColIdx;
              return (
                <div
                  key={colIdx}
                  className={`${styles.gridCell} ${isOver ? styles.gridCellDragOver : ""}`}
                  style={{ gridRow: roomIdx + 2, gridColumn: colIdx + 2, cursor: "pointer" }}
                  onClick={() => {
                    if (onAddBookingAtCell) {
                      onAddBookingAtCell(roomIdx, actualColIdx);
                    }
                  }}
                  onDragOver={(e) => handleDragOver(e, roomIdx, actualColIdx)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, roomIdx, actualColIdx)}
                />
              );
            })}
          </div>
        ))}

        {/* Render Floating Booking Cards overlayed on the exact Grid Columns and Rows */}
        {reservations
          .filter((res) => {
            // Only show reservations whose bookingType matches the current view scale.
            // Existing records without bookingType are treated as "daily" (backwards compat).
            const resType = res.bookingType || "daily";
            return resType === timeScale;
          })
          .map((res) => {
          // Map reservations to a continuous timeline (Morning = .0, Afternoon = .5)
          let visualStart = (res.duration === 0 ? res.startIndex : res.startIndex + 0.5) - (timeScale === "daily" ? dateOffset : 0);
          let visualEnd = (res.duration === 0 ? res.startIndex + 0.5 : res.startIndex + res.duration + 0.5) - (timeScale === "daily" ? dateOffset : 0);

          if (res.status === "checked-out" && res.checkOutTime && timeScale === "daily") {
            const checkOutDate = new Date(res.checkOutTime);
            const base = new Date("2026-05-20T00:00:00");
            const diffDays = Math.floor((new Date(checkOutDate).setHours(0,0,0,0) - base.getTime()) / 86400000);
            visualEnd = (diffDays + 0.5) - dateOffset;
            if (visualEnd <= visualStart) visualEnd = visualStart + 0.5;
          }

          // Out of bounds check
          if (visualStart >= colCount || visualEnd <= 0) return null;

          // Calculate actual overlaps in continuous time
          const overlapIndex = reservations.filter(r => {
            if (r.roomId !== res.roomId || r.id === res.id) return false;
            let rStart = r.duration === 0 ? r.startIndex : r.startIndex + 0.5;
            let rEnd = r.duration === 0 ? r.startIndex + 0.5 : r.startIndex + r.duration + 0.5;
            
            if (r.status === "checked-out" && r.checkOutTime && timeScale === "daily") {
              const rCheckOutDate = new Date(r.checkOutTime);
              const rBase = new Date("2026-05-20T00:00:00");
              const rDiffDays = Math.floor((new Date(rCheckOutDate).setHours(0,0,0,0) - rBase.getTime()) / 86400000);
              rEnd = rDiffDays + 0.5;
              if (rEnd <= rStart) rEnd = rStart + 0.5;
            }

            const overlaps = Math.max(visualStart, rStart) < Math.min(visualEnd, rEnd);
            return overlaps && (rStart < visualStart || (rStart === visualStart && r.id < res.id));
          }).length;

          // Map continuous timeline to discrete CSS Grid columns
          const gridColStart = Math.floor(visualStart) + 2;
          const gridColEnd = Math.min(Math.ceil(visualEnd) + 2, colCount + 2);
          
          // Calculate exact CSS percentages based on how many cells it spans
          const cellSpan = gridColEnd - gridColStart;
          if (cellSpan <= 0) return null;

          // How far from the left edge of the spanned cells does it actually start?
          const leftShiftCells = visualStart - Math.floor(visualStart);
          const marginLeftPercent = (leftShiftCells / cellSpan) * 100;

          // What is the true visual width in cells?
          const visualWidthCells = Math.min(visualEnd, colCount) - visualStart;
          const widthPercent = (visualWidthCells / cellSpan) * 100;

          // Determine visual styling
          const isMorningStart = leftShiftCells === 0;
          const isMorningEnd = (visualEnd - Math.floor(visualEnd)) === 0.5;

          let blockStyle: React.CSSProperties = {
            gridRow: `${res.roomIndex + 2} / span 1`,
            gridColumnStart: gridColStart,
            gridColumnEnd: gridColEnd,
            marginLeft: `${marginLeftPercent}%`,
            width: `calc(${widthPercent}% - 2px)`, // -2px for border fitting
            top: overlapIndex > 0 ? `${8 + overlapIndex * 28}px` : "8px",
            bottom: "auto",
            height: overlapIndex > 0 ? "26px" : "54px",
            zIndex: res.status === "checked-out" ? 10 : 20 + overlapIndex,
            opacity: res.status === "checked-out" ? 0.6 : 1,
            borderLeft: !isMorningStart ? "2px dashed rgba(255,255,255,0.3)" : "none",
            borderRight: isMorningEnd ? "2px dashed rgba(255,255,255,0.3)" : "none",
          };

          return (
            <div
              key={res.id}
              className={`${styles.bookingCard} ${getCardStyle(res.status)}`}
              style={blockStyle}
              draggable={res.status !== "maintenance" && res.status !== "checked-out"}
              onDragStart={(e) => handleDragStart(e, res.id)}
              onClick={() => onSelectReservation(res)}
            >
              <div className={styles.bookingCardTitle}>
                {res.guestName}
                {res.details && res.details.includes("[Swapped") && (
                  <span style={{ marginLeft: "6px", fontSize: "0.6rem", background: "rgba(236,72,153,0.3)", color: "#fbcfe8", padding: "2px 6px", borderRadius: "10px" }}>🔄 Swapped</span>
                )}
                {res.isGroup && <span style={{ fontSize: "0.6rem", display: "block", color: "var(--text-secondary)" }}>🏢 Group: {res.groupName}</span>}
              </div>
              <div className={styles.bookingCardDetail}>
                {getStatusLabel(res.status)} • {res.duration} {timeScale === "daily" ? "nights" : "slots"}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
