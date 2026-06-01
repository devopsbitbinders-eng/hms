"use client";
import React, { useState, useMemo } from "react";
import styles from "../app/dashboard/dashboard.module.css";
import { Reservation, Room } from "./VisualGrid";

interface FrontDeskOpsProps {
  currentReservations: Reservation[];
  currentRooms: Room[];
  activePropertyId: string;
  currentUser: any;
  addToast: (msg: string, type?: "success" | "error" | "warning") => void;
  onUpdateReservation: (res: Reservation) => void;
  refreshData: () => Promise<void>;
  activeProperty?: any;
}

// Property state (in a real system this would come from DB / property settings)
const PROPERTY_STATE = "Delhi";

const STATE_CODES: Record<string, string> = {
  "01": "Jammu & Kashmir", "02": "Himachal Pradesh", "03": "Punjab", "04": "Chandigarh", "05": "Uttarakhand",
  "06": "Haryana", "07": "Delhi", "08": "Rajasthan", "09": "Uttar Pradesh", "10": "Bihar", "11": "Sikkim",
  "12": "Arunachal Pradesh", "13": "Nagaland", "14": "Manipur", "15": "Mizoram", "16": "Tripura", "17": "Meghalaya",
  "18": "Assam", "19": "West Bengal", "20": "Jharkhand", "21": "Odisha", "22": "Chhattisgarh", "23": "Madhya Pradesh",
  "24": "Gujarat", "25": "Daman & Diu", "26": "Dadra & Nagar Haveli", "27": "Maharashtra", "29": "Karnataka",
  "30": "Goa", "31": "Lakshadweep", "32": "Kerala", "33": "Tamil Nadu", "34": "Puducherry", "35": "Andaman & Nicobar",
  "36": "Telangana", "37": "Andhra Pradesh", "38": "Ladakh"
};
const PROPERTY_STATE_CODE = "07"; // Hardcoded Delhi for now
const INDIAN_STATES = Object.values(STATE_CODES);

const GST_RATES: Record<string, number> = {
  "0-999": 0,
  "1000-2499": 0.12,
  "2500+": 0.18,
};

function getGstRate(category: string, amount: number): number {
  if (category === "room") {
    return amount > 7500 ? 0.18 : 0.05;
  }
  return 0.05; // 5% for F&B, spa, services, etc.
}

function formatCurrency(val: number): string {
  return `₹${val.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function indexToDate(idx: number): string {
  const base = new Date("2026-05-20");
  base.setDate(base.getDate() + idx);
  return base.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

// ── SAC / HSN CODE LOOKUP ──────────────────────────────────────────
function getSacCode(category: string, name: string): string {
  const n = name.toLowerCase();
  const c = category.toLowerCase();
  if (c === "room" || n.includes("tariff") || n.includes("room rate") || n.includes("accommodation")) return "996311";
  if (n.includes("food") || n.includes("breakfast") || n.includes("dinner") || n.includes("lunch") || n.includes("f&b") || n.includes("room service")) return "996331";
  if (n.includes("spa") || n.includes("massage") || n.includes("wellness")) return "999721";
  if (n.includes("laundry") || n.includes("dry clean")) return "997014";
  if (n.includes("transport") || n.includes("cab") || n.includes("airport")) return "996601";
  if (n.includes("gym") || n.includes("pool") || n.includes("fitness")) return "999721";
  if (n.includes("minibar") || n.includes("bar") || n.includes("beverage")) return "996331";
  if (c === "amenity") return "999721";
  if (c === "service") return "998599";
  return "999999";
}

// ── INDIAN AMOUNT IN WORDS ─────────────────────────────────────────
function amountInWords(amount: number): string {
  const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
    "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

  function convertBelowThousand(n: number): string {
    if (n === 0) return "";
    if (n < 20) return ones[n] + " ";
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? " " + ones[n % 10] : "") + " ";
    return ones[Math.floor(n / 100)] + " Hundred " + convertBelowThousand(n % 100);
  }

  const rupees = Math.floor(amount);
  const paise = Math.round((amount - rupees) * 100);

  if (rupees === 0 && paise === 0) return "Rupees Zero Only.";

  let result = "Rupees ";
  const crore = Math.floor(rupees / 10000000);
  const lakh = Math.floor((rupees % 10000000) / 100000);
  const thousand = Math.floor((rupees % 100000) / 1000);
  const remainder = rupees % 1000;

  if (crore > 0) result += convertBelowThousand(crore) + "Crore ";
  if (lakh > 0) result += convertBelowThousand(lakh) + "Lakh ";
  if (thousand > 0) result += convertBelowThousand(thousand) + "Thousand ";
  if (remainder > 0) result += convertBelowThousand(remainder);

  result = result.trim();
  if (paise > 0) result += " and " + convertBelowThousand(paise).trim() + " Paise";
  return result + " Only.";
}

export default function FrontDeskOps({
  currentReservations,
  currentRooms,
  activePropertyId,
  currentUser,
  addToast,
  onUpdateReservation,
  refreshData,
  activeProperty,
}: FrontDeskOpsProps) {
  const [activeTab, setActiveTab] = useState<"arrivals" | "inhouse" | "departures" | "history" | "roomchanges">("arrivals");
  const [historySearch, setHistorySearch] = useState("");
  const [checkoutRes, setCheckoutRes] = useState<Reservation | null>(null);
  const [folioRes, setFolioRes] = useState<Reservation | null>(null);
  const [checkoutPayment, setCheckoutPayment] = useState("Cash");
  const [checkoutNote, setCheckoutNote] = useState("");
  const [checkoutGuestState, setCheckoutGuestState] = useState(PROPERTY_STATE);
  const [isProcessingCheckout, setIsProcessingCheckout] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [isPaymentVerified, setIsPaymentVerified] = useState(false);
  const [isPosModalOpen, setIsPosModalOpen] = useState(false);
  const [posState, setPosState] = useState<"idle" | "waking" | "ready" | "paid">("idle");
  const [summarizeFood, setSummarizeFood] = useState(false);

  // Folio Add Charge state
  const [folioChargeName, setFolioChargeName] = useState("");
  const [folioChargeAmount, setFolioChargeAmount] = useState("");
  const [folioChargeCategory, setFolioChargeCategory] = useState("service");
  const [isAddingCharge, setIsAddingCharge] = useState(false);

  // Room Change state
  const [roomChangeRes, setRoomChangeRes] = useState<Reservation | null>(null);
  const [changeToRoomId, setChangeToRoomId] = useState("");
  const [changeReason, setChangeReason] = useState("");
  const [isProcessingChange, setIsProcessingChange] = useState(false);
  const [roomChangeLogs, setRoomChangeLogs] = useState<any[]>([]);

  // Fetch room change logs
  const fetchRoomChanges = async () => {
    try {
      const res = await fetch(`/api/room-changes?propertyId=${activePropertyId}`);
      const data = await res.json();
      if (data.success) setRoomChangeLogs(data.roomChanges);
    } catch (e) {
      console.error("Failed to fetch room changes", e);
    }
  };

  React.useEffect(() => {
    if (activeTab === "roomchanges") {
      fetchRoomChanges();
    }
  }, [activePropertyId, activeTab]);

  const todayIndex = Math.floor(
    (new Date().setHours(0, 0, 0, 0) - new Date("2026-05-20").setHours(0, 0, 0, 0)) /
      (1000 * 60 * 60 * 24)
  );

  // Categorize reservations
  const arrivingToday = useMemo(
    () =>
      currentReservations.filter(
        (r) =>
          r.status === "confirmed" &&
          r.startIndex === todayIndex &&
          r.bookingType !== "hourly"
      ),
    [currentReservations, todayIndex]
  );

  const inHouseGuests = useMemo(
    () => currentReservations.filter((r) => r.status === "checked-in"),
    [currentReservations]
  );

  const departingToday = useMemo(
    () =>
      currentReservations.filter(
        (r) =>
          r.status === "checked-in" &&
          r.startIndex + r.duration === todayIndex &&
          r.bookingType !== "hourly"
      ),
    [currentReservations, todayIndex]
  );

  const pastGuests = useMemo(() => {
    let filtered = currentReservations.filter((r) => r.status === "checked-out");
    if (historySearch) {
      const lower = historySearch.toLowerCase();
      filtered = filtered.filter(r => r.guestName.toLowerCase().includes(lower) || r.id.toLowerCase().includes(lower));
    }
    return filtered.sort((a,b) => {
      const dateA = a.checkOutTime ? new Date(a.checkOutTime).getTime() : 0;
      const dateB = b.checkOutTime ? new Date(b.checkOutTime).getTime() : 0;
      return dateB - dateA;
    });
  }, [currentReservations, historySearch]);

  const getRoomForRes = (res: Reservation): Room | undefined =>
    currentRooms.find((r) => r.id === res.roomId);

  // ── SECTION 170 CGST-COMPLIANT BILL COMPUTATION ──────────────────────────
  const computeBill = (res: Reservation, summarizeFoodItem: boolean = false) => {
    const isInclusive = res.details?.includes("[GST:inclusive]") ?? false;
    let subtotal = 0, totalCgst = 0, totalSgst = 0, totalRoundingAdj = 0, grandTotal = 0;
    let tariff = 0, maxRate = 0;

    let itemsToProcess = [...res.billingItems];
    if (summarizeFoodItem) {
      const foodItems = itemsToProcess.filter(i => i.category === "food");
      if (foodItems.length > 0) {
        itemsToProcess = itemsToProcess.filter(i => i.category !== "food");
        const totalFood = foodItems.reduce((acc, curr) => acc + curr.amount, 0);
        itemsToProcess.push({
          id: "summary-food",
          name: "Room Service Food & Beverage",
          amount: totalFood,
          category: "food",
          invoiceGroup: "A",
          reservationId: res.id
        });
      }
    }

    itemsToProcess.forEach((item) => {
      const rate = getGstRate(item.category, item.amount);
      if (item.category === "room") tariff = item.amount;
      if (rate > maxRate) maxRate = rate;

      if (isInclusive) {
        // Hard-lock total; derive base with symmetric half-split rounding
        const lockedTotal = Math.round(item.amount * 100) / 100;
        const baseAmount  = Math.round((lockedTotal / (1 + rate)) * 100) / 100;
        const cgst = Math.round(baseAmount * (rate / 2) * 100) / 100;
        const sgst = cgst;
        const sumCheck    = Number((baseAmount + cgst + sgst).toFixed(2));
        const roundingAdj = Number((lockedTotal - sumCheck).toFixed(2));
        subtotal        += baseAmount;
        totalCgst       += cgst;
        totalSgst       += sgst;
        totalRoundingAdj += roundingAdj;
        grandTotal      += lockedTotal;
      } else {
        const baseAmount = Math.round(item.amount * 100) / 100;
        const cgst = Math.round(baseAmount * (rate / 2) * 100) / 100;
        const sgst = cgst;
        subtotal   += baseAmount;
        totalCgst  += cgst;
        totalSgst  += sgst;
        grandTotal += baseAmount + cgst + sgst;
      }
    });

    const roundedSubtotal    = Math.round(subtotal * 100) / 100;
    const roundedCgst        = Math.round(totalCgst * 100) / 100;
    const roundedSgst        = Math.round(totalSgst * 100) / 100;
    const roundedTotalGst    = Number((roundedCgst + roundedSgst).toFixed(2));
    const roundedRoundingAdj = Math.round(totalRoundingAdj * 100) / 100;
    const roundedTotal       = Math.round(grandTotal * 100) / 100;

    return { subtotal: roundedSubtotal, tariff, gstRate: maxRate, gstAmt: roundedTotalGst, cgst: roundedCgst, sgst: roundedSgst, roundingAdj: roundedRoundingAdj, total: roundedTotal, itemsToProcess };
  };

  // Handle Check-In (confirm → checked-in)
  const handleCheckIn = async (res: Reservation) => {
    try {
      const response = await fetch(`/api/reservations/${res.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "checked-in" }),
      });
      const data = await response.json();
      if (data.success) {
        onUpdateReservation({ ...res, status: "checked-in" });
        addToast(`✅ ${res.guestName} checked in successfully!`, "success");
        await refreshData();
      } else {
        throw new Error(data.error);
      }
    } catch (err: any) {
      addToast(`Check-In Failed|${err.message}`, "error");
    }
  };

  // Handle Checkout
  const handleCheckout = async () => {
    if (!checkoutRes) return;
    setIsProcessingCheckout(true);

    if (checkoutPayment === "Corporate Account" && checkoutRes.guestGstNumber) {
      const gstRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
      if (!gstRegex.test(checkoutRes.guestGstNumber)) {
        addToast("Invalid GSTIN format. Example: 07AAAAA0000A1Z5", "error");
        setIsProcessingCheckout(false);
        return;
      }
    }

    // Dynamic Duration Adjustment for Early/Late Checkouts
    const actualDuration = Math.max(0, todayIndex - checkoutRes.startIndex);
    const originalDuration = checkoutRes.duration;
    
    let updatedDetails = checkoutNote
      ? (checkoutRes.details || "") + `\n[Checkout Note: ${checkoutNote}]`
      : checkoutRes.details || "";

    if (actualDuration !== originalDuration) {
      const diff = Math.abs(originalDuration - actualDuration);
      const timeStr = actualDuration < originalDuration ? `early by ${diff} night(s)` : `late by ${diff} night(s)`;
      updatedDetails += `\n[System: Guest checked out ${timeStr}. Duration auto-adjusted from ${originalDuration} to ${actualDuration} nights to free up calendar.]`;
    }

    try {
      // 1. Mark reservation as checked-out and update duration
      const response = await fetch(`/api/reservations/${checkoutRes.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "checked-out",
          duration: actualDuration,
          checkOutTime: new Date().toISOString(),
          paymentMethod: checkoutPayment,
          details: updatedDetails,
          billingType: checkoutPayment === "Corporate Account" ? "corporate" : "individual",
          groupName: checkoutPayment === "Corporate Account" ? checkoutRes.groupName : null,
          guestGstNumber: checkoutPayment === "Corporate Account" ? checkoutRes.guestGstNumber : null,
        }),
      });
      const data = await response.json();
      if (!data.success) throw new Error(data.error);

      // 2. Mark room dirty
      const room = getRoomForRes(checkoutRes);
      if (room?.id) {
        await fetch(`/api/rooms/${room.id}/status`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cleanStatus: "Dirty" }),
        });
      }

      addToast(`🏁 ${checkoutRes.guestName} checked out! Room marked Dirty for housekeeping.`, "success");

      // 3. Generate receipt PDF
      generateReceiptPDF(checkoutRes, room, checkoutGuestState, summarizeFood);

      setCheckoutRes(null);
      setCheckoutNote("");
      setCheckoutPayment("Cash");
      setCheckoutGuestState(PROPERTY_STATE);
      setSummarizeFood(false);
      await refreshData();
    } catch (err: any) {
      addToast(`Checkout Failed|${err.message}`, "error");
    } finally {
      setIsProcessingCheckout(false);
    }
  };

  // Add folio charge
  const handleAddFolioCharge = async () => {
    if (!folioRes || !folioChargeName || !folioChargeAmount) return;
    setIsAddingCharge(true);
    try {
      const response = await fetch("/api/billing/folio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reservationId: folioRes.id,
          name: folioChargeName,
          amount: parseFloat(folioChargeAmount),
          category: folioChargeCategory,
        }),
      });
      const data = await response.json();
      if (data.success) {
        addToast(`💰 Charge "${folioChargeName}" added to ${folioRes.guestName}'s folio!`, "success");
        setFolioChargeName("");
        setFolioChargeAmount("");
        await refreshData();
        // Update the local folioRes with the new item
        const updated = currentReservations.find((r) => r.id === folioRes.id);
        if (updated) setFolioRes({ ...updated, billingItems: [...updated.billingItems, data.item] });
      } else {
        throw new Error(data.error);
      }
    } catch (err: any) {
      addToast(`Charge Failed|${err.message}`, "error");
    } finally {
      setIsAddingCharge(false);
    }
  };

  // Delete folio charge
  const handleDeleteFolioCharge = async (itemId: string) => {
    if (!folioRes) return;
    try {
      const response = await fetch(`/api/billing/folio?itemId=${itemId}`, { method: "DELETE" });
      const data = await response.json();
      if (data.success) {
        addToast("🗑️ Charge removed from folio.", "success");
        await refreshData();
        const updated = currentReservations.find((r) => r.id === folioRes.id);
        if (updated) setFolioRes(updated);
      }
    } catch (err: any) {
      addToast(`Delete Failed|${err.message}`, "error");
    }
  };

  // ── CA-COMPLIANT RECEIPT PDF ───────────────────────────────────────
  const generateReceiptPDF = (res: Reservation, room?: Room, guestState: string = PROPERTY_STATE, summarizeFoodItem: boolean = false) => {
    const bill = computeBill(res, summarizeFoodItem);
    const now = new Date();
    
    // Intra/Inter State Logic based on Corporate GSTIN
    let finalGuestState = guestState;
    let isIntrastate = true;
    if (res.billingType === "corporate" && res.guestGstNumber && res.guestGstNumber.length === 15) {
      const code = res.guestGstNumber.substring(0, 2);
      finalGuestState = STATE_CODES[code] || "Unknown State";
      isIntrastate = code === PROPERTY_STATE_CODE;
    } else {
      isIntrastate = finalGuestState === PROPERTY_STATE;
    }
    const fy = now.getMonth() > 2 ? `${now.getFullYear().toString().slice(-2)}-${(now.getFullYear()+1).toString().slice(-2)}` : `${(now.getFullYear()-1).toString().slice(-2)}-${now.getFullYear().toString().slice(-2)}`;
    const invoiceNo = `ATH/${fy}/${res.id.substring(0,4).toUpperCase()}`;
    const halfRate = (bill.gstRate * 50).toFixed(1).replace(/\.0$/, '');
    const fullRate = (bill.gstRate * 100).toFixed(1).replace(/\.0$/, '');
    const words = amountInWords(bill.total);

    // Build item rows with SAC/HSN codes
    const isInclusive = res.details?.includes("[GST:inclusive]") ?? false;
    const itemRows = bill.itemsToProcess.map((item) => {
      const sac = getSacCode(item.category, item.name);
      const itemGstRate = getGstRate(item.category, item.amount);
      const itemHalf = (itemGstRate * 50).toFixed(1).replace(/\.0$/, '');
      const itemFull = (itemGstRate * 100).toFixed(1).replace(/\.0$/, '');
      
      const baseAmount = isInclusive ? (item.amount / (1 + itemGstRate)) : item.amount;

      if (isIntrastate) {
        return `<tr>
          <td>${item.name}</td>
          <td style="text-align:center;color:#555;font-size:11px">${sac}</td>
          <td style="text-align:center;font-size:11px;color:#555">${item.category.toUpperCase()}</td>
          <td style="text-align:right">${formatCurrency(baseAmount)}</td>
          <td style="text-align:center;font-size:11px">${itemGstRate > 0 ? itemHalf+'%' : '—'}</td>
          <td style="text-align:center;font-size:11px">${itemGstRate > 0 ? itemHalf+'%' : '—'}</td>
        </tr>`;
      } else {
        return `<tr>
          <td>${item.name}</td>
          <td style="text-align:center;color:#555;font-size:11px">${sac}</td>
          <td style="text-align:center;font-size:11px;color:#555">${item.category.toUpperCase()}</td>
          <td style="text-align:right">${formatCurrency(baseAmount)}</td>
          <td style="text-align:center;font-size:11px">${itemGstRate > 0 ? itemFull+'%' : '—'}</td>
        </tr>`;
      }
    }).join('');

    const taxHeader = isIntrastate
      ? `<th style="text-align:center">CGST Rate</th><th style="text-align:center">SGST Rate</th>`
      : `<th style="text-align:center">IGST Rate</th>`;

    const taxSummaryRows = bill.gstRate > 0
      ? isIntrastate
        ? `<tr class="gst-row"><td colspan="4" style="text-align:right">CGST @ ${halfRate}%</td><td colspan="2" style="text-align:right;padding-right:8px">${formatCurrency(bill.cgst)}</td></tr>
           <tr class="gst-row"><td colspan="4" style="text-align:right">SGST @ ${halfRate}%</td><td colspan="2" style="text-align:right;padding-right:8px">${formatCurrency(bill.sgst)}</td></tr>
           ${bill.roundingAdj !== 0 ? `<tr class="gst-row"><td colspan="4" style="text-align:right;font-style:italic;color:#b45309">Rounding Adjustment (Sec.170 CGST Act)</td><td colspan="2" style="text-align:right;padding-right:8px;color:#b45309">${bill.roundingAdj > 0 ? '+' : ''}${formatCurrency(bill.roundingAdj)}</td></tr>` : ''}`
        : `<tr class="gst-row"><td colspan="4" style="text-align:right">IGST @ ${fullRate}%</td><td colspan="2" style="text-align:right;padding-right:8px">${formatCurrency(bill.gstAmt)}</td></tr>
           ${bill.roundingAdj !== 0 ? `<tr class="gst-row"><td colspan="4" style="text-align:right;font-style:italic;color:#b45309">Rounding Adjustment (Sec.170 CGST Act)</td><td colspan="2" style="text-align:right;padding-right:8px;color:#b45309">${bill.roundingAdj > 0 ? '+' : ''}${formatCurrency(bill.roundingAdj)}</td></tr>` : ''}`
      : '';

    const colSpanTotal = isIntrastate ? 5 : 4;

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <title>Tax Invoice – ${res.guestName} – ${invoiceNo}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:'Inter',Arial,sans-serif;color:#111;background:#fff;padding:40px;font-size:13px;line-height:1.5}
    @media print{
      body{padding:20px}
      .no-print{display:none}
      @page{margin:15mm;size:A4}
    }
    /* ── HEADER ── */
    .inv-header{display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:20px;border-bottom:2.5px solid #111;margin-bottom:20px}
    .inv-logo{font-size:22px;font-weight:700;letter-spacing:-0.5px;color:#111}
    .inv-logo span{color:#4f46e5}
    .inv-tagline{font-size:10px;color:#666;margin-top:2px;letter-spacing:0.04em;text-transform:uppercase}
    .inv-meta{text-align:right}
    .inv-meta h2{font-size:18px;font-weight:700;color:#111;letter-spacing:0.02em;text-transform:uppercase}
    .inv-meta p{font-size:11px;color:#555;margin-top:3px}
    .inv-meta .inv-no{font-size:12px;font-weight:600;color:#4f46e5;margin-top:4px}
    /* ── TAX TYPE BADGE ── */
    .tax-badge{display:inline-block;padding:3px 10px;border-radius:20px;font-size:10px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;margin-top:6px}
    .intrastate{background:#dcfce7;color:#166534;border:1px solid #bbf7d0}
    .interstate{background:#fef3c7;color:#92400e;border:1px solid #fde68a}
    /* ── GUEST & PROPERTY INFO ── */
    .info-grid{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin:20px 0;padding:16px;background:#f9fafb;border-radius:6px;border:1px solid #e5e7eb}
    .info-block label{display:block;font-size:10px;text-transform:uppercase;letter-spacing:0.06em;color:#9ca3af;margin-bottom:3px;font-weight:600}
    .info-block p{font-size:13px;color:#111;font-weight:500}
    .info-block p.mono{font-family:monospace;font-size:12px;color:#374151}
    /* ── TABLE ── */
    table{width:100%;border-collapse:collapse;margin:16px 0;font-size:12px}
    thead tr{background:#111;color:#fff}
    thead th{padding:9px 10px;font-size:10px;font-weight:600;letter-spacing:0.05em;text-transform:uppercase;text-align:left}
    tbody tr{border-bottom:1px solid #f0f0f0}
    tbody tr:hover{background:#fafafa}
    tbody td{padding:9px 10px;vertical-align:middle;color:#222}
    .sac-col{font-family:monospace;font-size:11px;color:#6b7280;text-align:center}
    .gst-row td{color:#555;font-style:italic;background:#f9fafb}
    .subtotal-row td{font-weight:600;background:#f3f4f6;border-top:1.5px solid #d1d5db}
    .total-row td{font-weight:700;font-size:14px;background:#111;color:#fff;border:none;padding:11px 10px}
    /* ── AMOUNT IN WORDS ── */
    .words-block{margin:14px 0;padding:12px 16px;background:#f0f9ff;border-left:4px solid #0ea5e9;border-radius:0 6px 6px 0}
    .words-label{font-size:10px;text-transform:uppercase;letter-spacing:0.06em;color:#0369a1;font-weight:700;margin-bottom:4px}
    .words-text{font-size:13px;color:#0c4a6e;font-weight:600;font-style:italic}
    /* ── STAMP & FOOTER ── */
    .payment-row{display:flex;align-items:center;justify-content:space-between;margin:20px 0 0}
    .stamp{display:inline-block;border:2.5px solid #16a34a;color:#16a34a;padding:6px 18px;border-radius:4px;font-weight:700;font-size:13px;transform:rotate(-4deg);letter-spacing:0.06em}
    .sig-block{text-align:right;font-size:11px;color:#555}
    .sig-block p{margin-top:28px;border-top:1px solid #ccc;padding-top:6px;display:inline-block;min-width:120px}
    .footer{margin-top:28px;padding-top:14px;border-top:1px dashed #d1d5db;text-align:center;font-size:10px;color:#9ca3af;letter-spacing:0.04em}
    .gst-notice{font-size:10px;color:#6b7280;margin-top:8px;text-align:left}
  </style>
</head>
<body>

  <!-- PRINT BUTTON (hidden on print) -->
  <div class="no-print" style="margin-bottom:20px">
    <button onclick="window.print()" style="background:#4f46e5;color:#fff;border:none;padding:10px 24px;border-radius:6px;font-size:13px;font-weight:600;cursor:pointer;letter-spacing:0.03em">🖨 Print Invoice</button>
  </div>

  <!-- HEADER -->
  <div class="inv-header">
    <div style="flex: 1;">
      <div class="inv-logo">${activeProperty?.name || "Aether"}<span>HMS</span></div>
      <div class="inv-tagline" style="font-weight:700; color:#111; margin-top:4px;">${activeProperty?.name || "Aether Hotel Management Pvt. Ltd."}</div>
      <div class="inv-tagline" style="margin-top:2px; max-width: 250px;">${activeProperty?.location || "123, Hospitality Avenue, Sector 4, New Delhi - 110001, India"}</div>
      <div class="inv-tagline" style="margin-top:4px; font-weight:600; color:#4f46e5;">Property GSTIN: ${activeProperty?.gstNumber || "N/A"} · State: ${PROPERTY_STATE} (Code: 07)</div>
    </div>
    <div class="inv-meta" style="flex: 1; text-align:right;">
      <h2 style="font-size: 24px; color: #111; border-bottom: 2px solid #111; display: inline-block; padding-bottom: 4px; margin-bottom: 8px;">TAX INVOICE</h2>
      <p class="inv-no">Invoice No: ${invoiceNo}</p>
      <p>Date of Issue: ${now.toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'})}</p>
      <p>Time: ${now.toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})}</p>
      <div class="tax-badge ${isIntrastate ? 'intrastate' : 'interstate'}">${isIntrastate ? '✓ Intrastate — CGST + SGST' : '⚡ Inter-State — IGST Applicable'}</div>
    </div>
  </div>

  <!-- GUEST & STAY INFO -->
  <div class="info-grid">
    <div>
      <div class="info-block" style="margin-bottom:10px">
        <label style="color:#4f46e5;">Billed To (Guest Details)</label>
        <p style="font-size:15px;font-weight:700">${res.guestName}</p>
        ${res.groupName ? `<p style="font-size:12px;font-weight:600;margin-top:2px">${res.groupName}</p>` : ''}
        ${res.guestGstNumber ? `<p style="font-size:11px;color:#4f46e5;margin-top:1px;font-weight:600">GSTIN: ${res.guestGstNumber}</p>` : ''}
      </div>
      <div class="info-block" style="margin-bottom:10px">
        <label>Guest State</label>
        <p>${finalGuestState}</p>
      </div>
      ${res.phone ? `<div class="info-block"><label>Mobile</label><p class="mono">${res.phone}</p></div>` : ''}
      ${res.email ? `<div class="info-block" style="margin-top:8px"><label>Email</label><p class="mono">${res.email}</p></div>` : ''}
      ${res.nationality === 'Foreign' && res.passportNumber ? `<div class="info-block" style="margin-top:8px"><label>Passport No.</label><p class="mono">${res.passportNumber}</p></div>` : ''}
    </div>
    <div>
      <div class="info-block" style="margin-bottom:10px">
        <label>Room</label>
        <p style="font-weight:700">${room ? `Room ${room.number} — ${room.name}` : 'N/A'}</p>
        <p style="font-size:11px;color:#6b7280;margin-top:2px">${room?.type || ''}</p>
      </div>
      <div class="info-block" style="margin-bottom:10px">
        <label>Check-In</label>
        <p>${indexToDate(res.startIndex)}</p>
      </div>
      <div class="info-block" style="margin-bottom:10px">
        <label>Check-Out</label>
        <p>${now.toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'})}</p>
      </div>
      <div class="info-block">
        <label>Stay Duration</label>
        <p>${res.duration} Night${res.duration !== 1 ? 's' : ''} · ${res.numAdults || 1} Guest${(res.numAdults||1)>1?'s':''}</p>
      </div>
    </div>
  </div>

  <!-- CHARGE TABLE -->
  <table>
    <thead>
      <tr>
        <th style="width:30%">Description</th>
        <th style="text-align:center;width:10%">SAC / HSN</th>
        <th style="text-align:center;width:12%">Category</th>
        <th style="text-align:right;width:14%">Amount (₹)</th>
        ${taxHeader}
      </tr>
    </thead>
    <tbody>
      ${itemRows}
      <!-- Subtotal -->
      <tr class="subtotal-row">
        <td colspan="3" style="text-align:right">Taxable Subtotal</td>
        <td style="text-align:right">${formatCurrency(bill.subtotal)}</td>
        <td ${isIntrastate ? 'colspan="2"' : ''} style="text-align:center;font-size:11px;color:#6b7280">—</td>
      </tr>
      <!-- Tax rows -->
      ${taxSummaryRows}
      <!-- Grand Total -->
      <tr class="total-row">
        <td colspan="${colSpanTotal}" style="text-align:right">Grand Total (Incl. GST)</td>
        <td style="text-align:right">${formatCurrency(bill.total)}</td>
      </tr>
    </tbody>
  </table>

  <!-- AMOUNT IN WORDS -->
  <div class="words-block">
    <div class="words-label">Amount in Words</div>
    <div class="words-text">${words}</div>
  </div>

  <!-- PAYMENT & SIGNATURE -->
  <div class="payment-row">
    <div>
      <div style="font-size:11px;color:#555;margin-bottom:6px"><strong>Payment Method:</strong> ${checkoutPayment}</div>
      <div class="stamp" style="margin-bottom:12px">PAYMENT RECEIVED</div>
      
      <div style="margin-top:16px;border-top:1px solid #e5e7eb;padding-top:10px">
        <div style="font-size:10px;text-transform:uppercase;letter-spacing:0.06em;color:#6b7280;font-weight:700;margin-bottom:4px">Payment Settlement Channels</div>
        <table style="width:auto;margin:0;font-size:11px;border-collapse:collapse;border:none">
          <tbody style="border:none">
            <tr style="border:none;background:transparent"><td style="padding:2px 8px 2px 0;border:none;color:#555">Bank Name:</td><td style="padding:2px 0;border:none;font-weight:600">_____________________</td></tr>
            <tr style="border:none;background:transparent"><td style="padding:2px 8px 2px 0;border:none;color:#555">Account No:</td><td style="padding:2px 0;border:none;font-family:monospace;font-weight:600">_____________________</td></tr>
            <tr style="border:none;background:transparent"><td style="padding:2px 8px 2px 0;border:none;color:#555">IFSC Code:</td><td style="padding:2px 0;border:none;font-family:monospace;font-weight:600">_____________________</td></tr>
            <tr style="border:none;background:transparent"><td style="padding:2px 8px 2px 0;border:none;color:#555">UPI ID:</td><td style="padding:2px 0;border:none;font-weight:600">_____________________</td></tr>
          </tbody>
        </table>
      </div>
    </div>
    <div class="sig-block" style="align-self:flex-end">
      <div style="height:60px"></div>
      <p>Authorised Signatory</p>
    </div>
  </div>

  <!-- GST NOTICE -->
  <div class="gst-notice">
    <strong>Note:</strong> ${isIntrastate
      ? `This is an intrastate supply. CGST @ ${halfRate}% and SGST @ ${halfRate}% apply under CGST Act, 2017 and ${finalGuestState} GST Act, 2017.`
      : `This is an inter-state supply from ${PROPERTY_STATE} to ${finalGuestState}. IGST @ ${fullRate}% applies under IGST Act, 2017.`
    }
    SAC Code 996311 — Accommodation Services per Schedule II, CGST Act.
  </div>

  <!-- FOOTER -->
  <div class="footer">
    AetherHMS · This is a computer-generated invoice and does not require a physical signature. · Generated: ${now.toLocaleString('en-IN')}
  </div>

</body>
</html>`;
    const win = window.open("", "_blank");
    if (win) {
      win.document.write(html);
      win.document.close();
    }
  };

  // ── ROOM CHANGE HANDLER ─────────────────────────────────────────────
  const handleRoomChange = async () => {
    if (!roomChangeRes || !changeToRoomId || !changeReason.trim()) {
      addToast("Please select a new room and provide a reason.", "error");
      return;
    }
    setIsProcessingChange(true);
    try {
      const res = await fetch("/api/room-changes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reservationId: roomChangeRes.id,
          fromRoomId: roomChangeRes.roomId,
          toRoomId: changeToRoomId,
          reason: changeReason,
          guestName: roomChangeRes.guestName,
          changedBy: currentUser?.name || "Front Desk",
          propertyId: activePropertyId,
        }),
      });
      const data = await res.json();
      if (data.success) {
        addToast(`✅ Room changed successfully for ${roomChangeRes.guestName}`, "success");
        setRoomChangeRes(null);
        setChangeToRoomId("");
        setChangeReason("");
        await refreshData();
        await fetchRoomChanges();
      } else {
        addToast(data.error || "Failed to change room.", "error");
      }
    } catch (e) {
      addToast("Network error. Please try again.", "error");
    } finally {
      setIsProcessingChange(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    backgroundColor: "rgba(255,255,255,0.05)",
    border: "1px solid var(--border-color)",
    borderRadius: "8px",
    padding: "10px 14px",
    color: "#fff",
    width: "100%",
    fontSize: "0.88rem",
    outline: "none",
    fontFamily: "inherit",
  };
  
  const optionStyle: React.CSSProperties = {
    backgroundColor: "#1e1e2d",
    color: "#fff"
  };

  const labelStyle: React.CSSProperties = {
    fontSize: "0.75rem",
    fontWeight: "600",
    color: "var(--text-secondary)",
    display: "block",
    marginBottom: "6px",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  };

  const tabs = [
    { id: "arrivals" as const, label: "🛬 Arriving Today", count: arrivingToday.length, color: "#6366f1" },
    { id: "inhouse" as const, label: "🏠 In-House", count: inHouseGuests.length, color: "#10b981" },
    { id: "departures" as const, label: "🛫 Departing Today", count: departingToday.length, color: "#f59e0b" },
    { id: "history" as const, label: "📜 Check-Out History", count: pastGuests.length, color: "#6b7280" },
    { id: "roomchanges" as const, label: "🔄 Room Changes", count: roomChangeLogs.length, color: "#ec4899" },
  ];

  const displayList =
    activeTab === "arrivals" ? arrivingToday :
    activeTab === "inhouse" ? inHouseGuests :
    activeTab === "departures" ? departingToday :
    activeTab === "history" ? pastGuests : [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* Header */}
      <div>
        <h2 style={{ fontSize: "1.5rem", fontWeight: "700", marginBottom: "4px", display: "flex", alignItems: "center", gap: "10px" }}>
          🏨 Front Desk Operations
        </h2>
        <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem" }}>
          Manage daily arrivals, in-house guest folios, and check-outs in real time.
        </p>
      </div>

      {/* Summary Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "16px" }}>
        {tabs.map((tab) => (
          <div
            key={tab.id}
            className="glass-card"
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: "20px 24px",
              cursor: "pointer",
              border: activeTab === tab.id ? `1.5px solid ${tab.color}` : "1px solid var(--border-color)",
              borderRadius: "12px",
              transition: "all 0.2s ease",
              background: activeTab === tab.id ? `linear-gradient(135deg, ${tab.color}18, transparent)` : undefined,
            }}
          >
            <div style={{ fontSize: "2rem", fontWeight: "800", color: tab.color }}>{tab.count}</div>
            <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginTop: "4px" }}>{tab.label}</div>
          </div>
        ))}
      </div>

      {/* Guest List */}
      <div className="glass-card" style={{ padding: "0", overflow: "hidden" }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border-color)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ fontSize: "1rem", fontWeight: "600" }}>
            {tabs.find((t) => t.id === activeTab)?.label} — {indexToDate(todayIndex)}
          </h3>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            {activeTab === "history" && (
              <input 
                type="text" 
                placeholder="Search by name..." 
                value={historySearch}
                onChange={e => setHistorySearch(e.target.value)}
                style={{ padding: "6px 12px", borderRadius: "6px", border: "1px solid var(--border-color)", background: "rgba(0,0,0,0.2)", color: "#fff", fontSize: "0.8rem" }}
              />
            )}
            <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>{displayList.length} guest{displayList.length !== 1 ? "s" : ""}</span>
          </div>
        </div>

        {displayList.length === 0 ? (
          <div style={{ padding: "48px", textAlign: "center", color: "var(--text-muted)" }}>
            <div style={{ fontSize: "2.5rem", marginBottom: "12px" }}>
              {activeTab === "arrivals" ? "🛬" : activeTab === "inhouse" ? "🏠" : activeTab === "departures" ? "🛫" : "📜"}
            </div>
            <p style={{ fontSize: "0.9rem" }}>
              {activeTab === "arrivals" && "No check-ins scheduled for today."}
              {activeTab === "inhouse" && "No guests currently in-house."}
              {activeTab === "departures" && "No check-outs due today."}
              {activeTab === "history" && "No check-out history available."}
            </p>
          </div>
        ) : (
          <div>
            {displayList.map((res, idx) => {
              const room = getRoomForRes(res);
              const bill = computeBill(res);
              return (
                <div
                  key={res.id}
                  style={{
                    padding: "16px 20px",
                    borderBottom: idx < displayList.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none",
                    display: "flex",
                    alignItems: "center",
                    gap: "16px",
                  }}
                >
                  {/* Avatar */}
                  <div style={{
                    width: "42px",
                    height: "42px",
                    borderRadius: "50%",
                    background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: "700",
                    fontSize: "1rem",
                    flexShrink: 0,
                    color: "#fff",
                  }}>
                    {res.guestName.charAt(0).toUpperCase()}
                  </div>

                  {/* Info */}
                  <div style={{ flexGrow: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: "600", fontSize: "0.95rem", color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {res.guestName}
                      {res.isGroup && <span style={{ marginLeft: "8px", fontSize: "0.7rem", background: "rgba(99,102,241,0.2)", color: "#818cf8", padding: "2px 8px", borderRadius: "20px" }}>Group</span>}
                    </div>
                    <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginTop: "2px" }}>
                      {room ? `Room ${room.number} — ${room.name} (${room.type})` : "Room N/A"} · {res.numAdults || 1} Adult{(res.numAdults || 1) !== 1 ? "s" : ""}
                    </div>
                    <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginTop: "2px" }}>
                      {indexToDate(res.startIndex)} → {indexToDate(res.startIndex + res.duration)} · {res.duration} Night{res.duration !== 1 ? "s" : ""}
                    </div>

                      {activeTab === "history" && (
                        <div style={{ marginTop: "6px", display: "flex", gap: "12px" }}>
                          <span style={{ fontSize: "0.75rem", color: "#10b981", background: "rgba(16, 185, 129, 0.1)", padding: "2px 6px", borderRadius: "4px" }}>Checked out on {res.checkOutTime ? new Date(res.checkOutTime).toLocaleDateString() : indexToDate(res.startIndex + res.duration)}</span>
                          {res.paymentMethod && <span style={{ fontSize: "0.75rem", color: "#6366f1", background: "rgba(99, 102, 241, 0.1)", padding: "2px 6px", borderRadius: "4px" }}>Paid via {res.paymentMethod}</span>}
                        </div>
                      )}
                      {activeTab === "history" && res.details && res.details.includes("Checkout Note:") && (
                        <div style={{ fontSize: "0.75rem", color: "#f59e0b", marginTop: "4px", fontStyle: "italic" }}>
                          {res.details.split("Checkout Note: ")[1] || "Checkout Note logged"}
                        </div>
                      )}

                  </div>

                  {/* Bill Total */}
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div style={{ fontWeight: "700", fontSize: "0.95rem", color: "#10b981" }}>{formatCurrency(bill.total)}</div>
                    <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>incl. GST</div>
                  </div>

                  {/* Actions */}
                  <div style={{ display: "flex", gap: "8px", flexShrink: 0 }}>
                    {activeTab === "arrivals" && (
                      <button
                        className="btn-primary"
                        style={{ padding: "8px 16px", fontSize: "0.8rem", whiteSpace: "nowrap" }}
                        onClick={() => handleCheckIn(res)}
                      >
                        ✅ Check In
                      </button>
                    )}
                    {activeTab === "inhouse" && (
                      <>
                        <button
                          className="btn-secondary"
                          style={{ padding: "8px 14px", fontSize: "0.8rem", whiteSpace: "nowrap" }}
                          onClick={() => setFolioRes(res)}
                        >
                          💰 Add Charge
                        </button>
                        <button
                          className="btn-secondary"
                          style={{ padding: "8px 14px", fontSize: "0.8rem", whiteSpace: "nowrap", background: "rgba(236,72,153,0.15)", border: "1px solid rgba(236,72,153,0.4)", color: "#f472b6" }}
                          onClick={() => { setRoomChangeRes(res); setChangeToRoomId(""); setChangeReason(""); }}
                        >
                          🔄 Change Room
                        </button>
                        <button
                          className="btn-secondary"
                          style={{ padding: "8px 14px", fontSize: "0.8rem", whiteSpace: "nowrap", background: "rgba(168,85,247,0.15)", border: "1px solid rgba(168,85,247,0.4)", color: "#c084fc" }}
                          onClick={() => { setRoomChangeRes(res); setChangeToRoomId(""); setChangeReason("Room Upgrade - "); }}
                        >
                          ⏫ Upgrade Room
                        </button>
                        <button
                          className="btn-primary"
                          style={{ padding: "8px 14px", fontSize: "0.8rem", whiteSpace: "nowrap", background: "linear-gradient(135deg, #f59e0b, #d97706)" }}
                          onClick={() => setCheckoutRes(res)}
                        >
                          🏁 Check Out
                        </button>
                        <button
                          className="btn-secondary"
                          style={{ padding: "8px 14px", fontSize: "0.8rem", whiteSpace: "nowrap", background: "rgba(34,197,94,0.15)", border: "1px solid rgba(34,197,94,0.4)", color: "#4ade80" }}
                          onClick={() => {
                            let cleanPhone = res.phone?.replace(/\D/g, "");
                            if (!cleanPhone) {
                              addToast("Guest has no phone number on record.", "error");
                              return;
                            }
                            if (cleanPhone.length === 10) cleanPhone = "91" + cleanPhone;
                            const url = `${window.location.origin}/guest/${res.id}/menu`;
                            const msg = `Welcome to Aether HMS, ${res.guestName}! Your room is ready. Order room service anytime from your phone using this secure link:\n\n${url}`;
                            window.open(`https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(msg)}`, "_blank");
                          }}
                        >
                          💬 Send Menu
                        </button>
                      </>
                    )}
                    {activeTab === "history" && (
                      <button
                        className="btn-secondary"
                        style={{ padding: "8px 16px", fontSize: "0.8rem", whiteSpace: "nowrap" }}
                        onClick={() => generateReceiptPDF(res, room, PROPERTY_STATE)}
                      >
                        📄 View Receipt
                      </button>
                    )}
                    {activeTab === "departures" && (
                      <button
                        className="btn-primary"
                        style={{ padding: "8px 16px", fontSize: "0.8rem", whiteSpace: "nowrap", background: "linear-gradient(135deg, #f59e0b, #d97706)" }}
                        onClick={() => setCheckoutRes(res)}
                      >
                        🏁 Check Out
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── ROOM CHANGES LOG TAB ─────────────────────────────────── */}
      {activeTab === "roomchanges" && (
        <div className="glass-card" style={{ padding: "0", overflow: "hidden" }}>
          <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--border-color)", display: "flex", justifyContent: "space-between", alignItems: "center", background: "linear-gradient(135deg, rgba(236,72,153,0.12), transparent)" }}>
            <div>
              <h3 style={{ fontSize: "1.1rem", fontWeight: "700", color: "#f472b6", margin: 0 }}>🔄 Room Change Log</h3>
              <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginTop: "4px", marginBottom: 0 }}>
                Complete audit trail of all guest room changes and swaps.
              </p>
            </div>
            <span style={{ fontSize: "0.8rem", background: "rgba(236,72,153,0.15)", color: "#f472b6", padding: "4px 12px", borderRadius: "20px", border: "1px solid rgba(236,72,153,0.3)", fontWeight: "600" }}>
              {roomChangeLogs.length} Record{roomChangeLogs.length !== 1 ? "s" : ""}
            </span>
          </div>

          {roomChangeLogs.length === 0 ? (
            <div style={{ padding: "64px", textAlign: "center", color: "var(--text-muted)" }}>
              <div style={{ fontSize: "3rem", marginBottom: "12px" }}>🔄</div>
              <p style={{ fontSize: "0.9rem" }}>No room changes have been recorded yet.</p>
              <p style={{ fontSize: "0.8rem", opacity: 0.7 }}>Room changes appear here when you use the "Change Room" button for in-house guests.</p>
            </div>
          ) : (
            <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "12px" }}>
              {roomChangeLogs.map((log: any, idx: number) => (
                <div key={log.id} style={{
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(236,72,153,0.15)",
                  borderRadius: "12px",
                  padding: "16px 20px",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "16px",
                  transition: "all 0.2s",
                  position: "relative",
                  overflow: "hidden",
                }}>
                  {/* Left accent bar */}
                  <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: "3px", background: "linear-gradient(to bottom, #ec4899, #8b5cf6)", borderRadius: "3px 0 0 3px" }} />

                  {/* Avatar */}
                  <div style={{
                    width: "44px", height: "44px", borderRadius: "50%",
                    background: "linear-gradient(135deg, #ec4899, #8b5cf6)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontWeight: "700", fontSize: "1rem", color: "#fff", flexShrink: 0,
                  }}>
                    {log.guestName?.charAt(0)?.toUpperCase() || "G"}
                  </div>

                  {/* Main content */}
                  <div style={{ flexGrow: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap", marginBottom: "8px" }}>
                      <span style={{ fontWeight: "700", fontSize: "0.95rem", color: "#fff" }}>{log.guestName}</span>
                      <span style={{ fontSize: "0.7rem", color: "var(--text-muted)", background: "rgba(255,255,255,0.05)", padding: "2px 8px", borderRadius: "4px" }}>
                        #{log.reservationId?.substring(0, 6)?.toUpperCase()}
                      </span>
                    </div>

                    {/* Room Change Arrow */}
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
                      <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: "8px", padding: "6px 14px", textAlign: "center" }}>
                        <div style={{ fontSize: "0.65rem", color: "#ef4444", textTransform: "uppercase", letterSpacing: "0.05em" }}>From</div>
                        <div style={{ fontWeight: "700", fontSize: "1rem", color: "#ef4444" }}>Room {log.fromRoomNumber}</div>
                        {log.fromRoomName && <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>{log.fromRoomName}</div>}
                      </div>
                      <div style={{ fontSize: "1.5rem", color: "#f472b6" }}>→</div>
                      <div style={{ background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.25)", borderRadius: "8px", padding: "6px 14px", textAlign: "center" }}>
                        <div style={{ fontSize: "0.65rem", color: "#10b981", textTransform: "uppercase", letterSpacing: "0.05em" }}>To</div>
                        <div style={{ fontWeight: "700", fontSize: "1rem", color: "#10b981" }}>Room {log.toRoomNumber}</div>
                        {log.toRoomName && <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>{log.toRoomName}</div>}
                      </div>
                    </div>

                    {/* Reason */}
                    <div style={{ background: "rgba(236,72,153,0.08)", borderLeft: "3px solid rgba(236,72,153,0.5)", borderRadius: "0 6px 6px 0", padding: "8px 12px", marginBottom: "6px" }}>
                      <div style={{ fontSize: "0.7rem", color: "#f472b6", fontWeight: "600", marginBottom: "2px", textTransform: "uppercase" }}>Reason</div>
                      <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)", fontStyle: "italic" }}>&ldquo;{log.reason}&rdquo;</div>
                    </div>
                  </div>

                  {/* Right meta */}
                  <div style={{ textAlign: "right", flexShrink: 0, minWidth: "130px" }}>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginBottom: "4px" }}>
                      {log.changedAt ? new Date(log.changedAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "N/A"}
                    </div>
                    <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>
                      {log.changedAt ? new Date(log.changedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : ""}
                    </div>
                    <div style={{ marginTop: "6px", fontSize: "0.72rem", background: "rgba(99,102,241,0.15)", color: "#818cf8", padding: "2px 8px", borderRadius: "20px", display: "inline-block" }}>
                      by {log.changedBy}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── ROOM CHANGE MODAL ──────────────────────────────── */}
      {roomChangeRes && (
        <div className={styles.modalOverlay}>
          <div className={`${styles.modalContent} glass-card`} style={{ maxWidth: "520px", padding: "0", overflow: "hidden" }}>
            {/* Header */}
            <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--border-color)", display: "flex", justifyContent: "space-between", alignItems: "center", background: "linear-gradient(135deg, rgba(236,72,153,0.18), transparent)" }}>
              <div>
                <h2 style={{ fontSize: "1.2rem", fontWeight: "700", color: "#f472b6", margin: 0 }}>🔄 Change Guest Room</h2>
                <p style={{ fontSize: "0.82rem", color: "var(--text-secondary)", marginTop: "4px", marginBottom: 0 }}>
                  {roomChangeRes.guestName} · Current: Room {getRoomForRes(roomChangeRes)?.number || "N/A"}
                </p>
              </div>
              <button className={styles.modalCloseBtn} onClick={() => setRoomChangeRes(null)}>✕</button>
            </div>

            <div style={{ padding: "24px" }}>
              {/* Current room info */}
              <div style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: "10px", padding: "14px 18px", marginBottom: "20px", display: "flex", alignItems: "center", gap: "14px" }}>
                <div style={{ fontSize: "2rem" }}>🛏️</div>
                <div>
                  <div style={{ fontSize: "0.75rem", color: "#ef4444", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: "600" }}>Current Room</div>
                  <div style={{ fontWeight: "700", fontSize: "1.1rem", color: "#fff" }}>
                    Room {getRoomForRes(roomChangeRes)?.number} — {getRoomForRes(roomChangeRes)?.name}
                  </div>
                  <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>{getRoomForRes(roomChangeRes)?.type}</div>
                </div>
              </div>

              {/* Select new room */}
              <label style={labelStyle}>Select New Room</label>
              <select
                style={{ ...inputStyle, marginBottom: "16px" }}
                value={changeToRoomId}
                onChange={(e) => setChangeToRoomId(e.target.value)}
              >
                <option value="" style={optionStyle}>-- Choose a Room --</option>
                {currentRooms
                  .filter(r => r.id !== roomChangeRes.roomId && r.propertyId === activePropertyId)
                  .map(r => (
                    <option key={r.id} value={r.id} style={optionStyle}>
                      Room {r.number} — {r.name} ({r.type})
                    </option>
                  ))}
              </select>

              {/* New room preview */}
              {changeToRoomId && (
                <div style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)", borderRadius: "10px", padding: "12px 18px", marginBottom: "16px", display: "flex", alignItems: "center", gap: "12px" }}>
                  <div style={{ fontSize: "1.8rem" }}>✅</div>
                  <div>
                    <div style={{ fontSize: "0.72rem", color: "#10b981", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: "600" }}>Moving To</div>
                    <div style={{ fontWeight: "700", color: "#10b981" }}>
                      Room {currentRooms.find(r => r.id === changeToRoomId)?.number} — {currentRooms.find(r => r.id === changeToRoomId)?.name}
                    </div>
                  </div>
                </div>
              )}

              {/* Reason */}
              <label style={labelStyle}>Reason for Room Change *</label>
              <textarea
                style={{ ...inputStyle, height: "90px", resize: "none", marginBottom: "20px" }}
                placeholder="e.g. Guest requested quieter room, maintenance issue in current room, room upgrade, etc."
                value={changeReason}
                onChange={(e) => setChangeReason(e.target.value)}
              />

              <div style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: "8px", padding: "10px 14px", marginBottom: "20px", fontSize: "0.8rem", color: "#fcd34d" }}>
                ⚠️ This action will immediately move the guest to the new room and log the change in the Room Changes report.
              </div>

              <div style={{ display: "flex", gap: "12px" }}>
                <button className="btn-secondary" style={{ flexGrow: 1, justifyContent: "center" }} onClick={() => setRoomChangeRes(null)}>
                  Cancel
                </button>
                <button
                  className="btn-primary"
                  style={{ flexGrow: 2, justifyContent: "center", background: "linear-gradient(135deg, #ec4899, #8b5cf6)", fontWeight: "700" }}
                  onClick={handleRoomChange}
                  disabled={isProcessingChange || !changeToRoomId || !changeReason.trim()}
                >
                  {isProcessingChange ? "⏳ Processing..." : "🔄 Confirm Room Change"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── CHECKOUT MODAL ─────────────────────────────── */}
      {checkoutRes && (
        <div className={styles.modalOverlay}>
          <div className={`${styles.modalContent} glass-card`} style={{ maxWidth: "560px", padding: "0", overflow: "hidden" }}>
            {/* Header */}
            <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--border-color)", display: "flex", justifyContent: "space-between", alignItems: "center", background: "linear-gradient(135deg, rgba(245,158,11,0.15), transparent)" }}>
              <div>
                <h2 style={{ fontSize: "1.2rem", fontWeight: "700", color: "#fff" }}>🏁 Guest Check-Out</h2>
                <p style={{ fontSize: "0.82rem", color: "var(--text-secondary)", marginTop: "2px" }}>{checkoutRes.guestName} · {getRoomForRes(checkoutRes) ? `Room ${getRoomForRes(checkoutRes)!.number}` : ""}</p>
              </div>
              <button className={styles.modalCloseBtn} onClick={() => setCheckoutRes(null)}>✕</button>
            </div>

            <div style={{ padding: "24px", maxHeight: "75vh", overflowY: "auto" }}>
              {/* Bill Summary */}
              {(() => {
                const bill = computeBill(checkoutRes, summarizeFood);
                const isCorp = checkoutRes.billingType === "corporate";
                const isIntrastateUI = isCorp && checkoutRes.guestGstNumber && checkoutRes.guestGstNumber.length >= 2 
                  ? checkoutRes.guestGstNumber.substring(0, 2) === PROPERTY_STATE_CODE 
                  : checkoutGuestState === PROPERTY_STATE;

                const halfRate = (bill.gstRate * 50).toFixed(1).replace(/\.0$/, '');
                const fullRate = (bill.gstRate * 100).toFixed(1).replace(/\.0$/, '');

                const hasFood = checkoutRes.billingItems.some(i => i.category === "food");

                return (
                  <div style={{ background: "rgba(0,0,0,0.3)", borderRadius: "10px", padding: "16px", marginBottom: "20px" }}>
                    <div style={{ fontWeight: "600", fontSize: "0.85rem", marginBottom: "12px", color: "#fff", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span>📋 Final Bill Summary</span>
                      {hasFood && (
                        <label style={{ fontSize: "0.75rem", display: "flex", alignItems: "center", gap: "6px", cursor: "pointer", background: "rgba(255,255,255,0.05)", padding: "4px 8px", borderRadius: "6px" }}>
                          <input type="checkbox" checked={summarizeFood} onChange={(e) => setSummarizeFood(e.target.checked)} />
                          Summarize Kitchen Food
                        </label>
                      )}
                    </div>
                    {bill.itemsToProcess.map((item) => {
                      const isInclusive = checkoutRes.details?.includes("[GST:inclusive]") ?? false;
                      const rate = getGstRate(item.category, item.amount);
                      const baseAmount = isInclusive ? item.amount / (1 + rate) : item.amount;
                      return (
                        <div key={item.id} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", marginBottom: "6px", color: "var(--text-secondary)" }}>
                          <span>{item.name} <span style={{ fontSize: "0.7rem", textTransform: "uppercase", opacity: 0.6 }}>({item.category})</span></span>
                          <span>{formatCurrency(baseAmount)}</span>
                        </div>
                      );
                    })}
                    <div style={{ borderTop: "1px solid rgba(255,255,255,0.1)", marginTop: "10px", paddingTop: "10px" }}>
                      
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.82rem", color: "#fff", marginBottom: "10px", fontWeight: "600" }}>
                        <span>Subtotal</span><span>{formatCurrency(bill.subtotal)}</span>
                      </div>
                      
                      {isIntrastateUI ? (
                        <>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.82rem", color: "var(--text-muted)", marginBottom: "4px" }}>
                            <span>CGST ({halfRate}%)</span><span>{formatCurrency(bill.cgst)}</span>
                          </div>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.82rem", color: "var(--text-muted)", marginBottom: bill.roundingAdj !== 0 ? "4px" : "10px" }}>
                            <span>SGST ({halfRate}%)</span><span>{formatCurrency(bill.sgst)}</span>
                          </div>
                          {bill.roundingAdj !== 0 && (
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.78rem", color: "#f59e0b", marginBottom: "10px", fontStyle: "italic" }}>
                              <span>Rounding Adj. (Sec.170)</span>
                              <span>{bill.roundingAdj > 0 ? "+" : ""}{formatCurrency(bill.roundingAdj)}</span>
                            </div>
                          )}
                        </>
                      ) : (
                        <>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.82rem", color: "var(--text-muted)", marginBottom: bill.roundingAdj !== 0 ? "4px" : "10px" }}>
                            <span>IGST ({fullRate}%)</span><span>{formatCurrency(bill.gstAmt)}</span>
                          </div>
                          {bill.roundingAdj !== 0 && (
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.78rem", color: "#f59e0b", marginBottom: "10px", fontStyle: "italic" }}>
                              <span>Rounding Adj. (Sec.170)</span>
                              <span>{bill.roundingAdj > 0 ? "+" : ""}{formatCurrency(bill.roundingAdj)}</span>
                            </div>
                          )}
                        </>
                      )}

                      <div style={{ display: "flex", justifyContent: "space-between", fontWeight: "700", fontSize: "1.1rem", color: "#10b981" }}>
                        <span>Grand Total</span><span>{formatCurrency(bill.total)}</span>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Guest State (For GST automation) */}
              <label style={labelStyle}>Guest State (For GST)</label>
              <select style={{ ...inputStyle, marginBottom: "16px" }} value={checkoutGuestState} onChange={(e) => setCheckoutGuestState(e.target.value)}>
                {INDIAN_STATES.map((state) => (
                  <option key={state} value={state} style={optionStyle}>{state}</option>
                ))}
              </select>

              {/* Payment Method */}
              <label style={labelStyle}>Payment Method</label>
              <select style={{ ...inputStyle, marginBottom: checkoutPayment === "Corporate Account" ? "12px" : "16px" }} value={checkoutPayment} onChange={(e) => {
                setCheckoutPayment(e.target.value);
                if (e.target.value === "Corporate Account" && checkoutRes) {
                  setCheckoutRes({ ...checkoutRes, billingType: "corporate" });
                }
              }}>
                <option style={optionStyle}>Cash</option>
                <option style={optionStyle}>UPI</option>
                <option style={optionStyle}>Credit Card</option>
                <option style={optionStyle}>Debit Card</option>
                <option style={optionStyle}>Corporate Account</option>
                <option style={optionStyle}>Smart POS (Wireless)</option>
                <option style={optionStyle}>Bank Transfer</option>
              </select>

              
              {checkoutPayment === "Smart POS (Wireless)" && checkoutRes && (
                <div style={{ backgroundColor: "rgba(0,210,97,0.1)", border: "1px solid rgba(0,210,97,0.3)", borderRadius: "8px", padding: "16px", marginBottom: "16px", textAlign: "center" }}>
                  <div style={{ fontSize: "0.85rem", color: "#fff", marginBottom: "12px", fontWeight: "600" }}>
                    Total to collect: {formatCurrency(computeBill(checkoutRes).total)}
                  </div>
                  {posState === "paid" ? (
                    <div style={{ color: "#10b981", fontWeight: "700", fontSize: "1rem" }}>✅ Payment Received via POS</div>
                  ) : (
                    <button
                      className="btn-primary"
                      style={{ padding: "10px 20px", fontSize: "0.9rem", width: "100%", justifyContent: "center", background: "linear-gradient(135deg, #00d261, #059669)", fontWeight: "700" }}
                      onClick={() => { setIsPosModalOpen(true); setPosState("waking"); setTimeout(() => setPosState("ready"), 2000); }}
                    >
                      📱 Send to POS Machine
                    </button>
                  )}
                </div>
              )}

              {checkoutPayment === "Corporate Account" && checkoutRes && (
                <div style={{ backgroundColor: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", padding: "12px", marginBottom: "16px" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                    <div>
                      <label style={{ display: "block", fontSize: "0.75rem", color: "var(--text-secondary)", marginBottom: "4px" }}>Company Name</label>
                      <input 
                        type="text"
                        value={checkoutRes.groupName || ""}
                        onChange={(e) => setCheckoutRes({ ...checkoutRes, groupName: e.target.value })}
                        style={{ width: "100%", padding: "8px", borderRadius: "4px", border: "1px solid var(--border-color)", backgroundColor: "rgba(0,0,0,0.2)", color: "#fff", fontSize: "0.85rem" }}
                        placeholder="e.g. TechCorp Pvt Ltd"
                      />
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: "0.75rem", color: "var(--text-secondary)", marginBottom: "4px" }}>Company GSTIN</label>
                      <input 
                        type="text"
                        value={checkoutRes.guestGstNumber || ""}
                        maxLength={15}
                        onChange={(e) => setCheckoutRes({ ...checkoutRes, guestGstNumber: e.target.value.toUpperCase() })}
                        style={{ width: "100%", padding: "8px", borderRadius: "4px", border: "1px solid var(--border-color)", backgroundColor: "rgba(0,0,0,0.2)", color: checkoutRes.guestGstNumber && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(checkoutRes.guestGstNumber) ? "#ef4444" : "#fff", fontSize: "0.85rem" }}
                        placeholder="15-character GSTIN"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Checkout Note */}
              <label style={labelStyle}>Checkout Note (Optional)</label>
              <textarea
                style={{ ...inputStyle, height: "70px", resize: "none", marginBottom: "20px" }}
                placeholder="e.g. Guest left early, room damage noted..."
                value={checkoutNote}
                onChange={(e) => setCheckoutNote(e.target.value)}
              />

              <div style={{ display: "flex", gap: "12px" }}>
                <button className="btn-secondary" style={{ flexGrow: 1, justifyContent: "center" }} onClick={() => setCheckoutRes(null)}>
                  Cancel
                </button>
                <button
                  className="btn-primary"
                  style={{ flexGrow: 2, justifyContent: "center", background: "linear-gradient(135deg, #f59e0b, #d97706)", fontWeight: "700" }}
                  onClick={handleCheckout}
                  disabled={isProcessingCheckout || (checkoutPayment === "Smart POS (Wireless)" && posState !== "paid")}
                >
                  {isProcessingCheckout ? "⏳ Processing..." : "🏁 Confirm Checkout & Print Receipt"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── FOLIO MODAL ──────────────────────────────────── */}
      {folioRes && (
        <div className={styles.modalOverlay}>
          <div className={`${styles.modalContent} glass-card`} style={{ maxWidth: "560px", padding: "0", overflow: "hidden" }}>
            <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--border-color)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h2 style={{ fontSize: "1.2rem", fontWeight: "700" }}>💰 Running Folio</h2>
                <p style={{ fontSize: "0.82rem", color: "var(--text-secondary)", marginTop: "2px" }}>{folioRes.guestName} · {getRoomForRes(folioRes) ? `Room ${getRoomForRes(folioRes)!.number}` : ""}</p>
              </div>
              <button className={styles.modalCloseBtn} onClick={() => setFolioRes(null)}>✕</button>
            </div>

            <div style={{ padding: "24px", maxHeight: "75vh", overflowY: "auto" }}>
              {/* Current Charges */}
              <div style={{ marginBottom: "20px" }}>
                <div style={{ fontSize: "0.82rem", fontWeight: "600", color: "var(--text-secondary)", marginBottom: "10px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Current Charges</div>
                {folioRes.billingItems.length === 0 ? (
                  <div style={{ color: "var(--text-muted)", fontSize: "0.85rem", textAlign: "center", padding: "16px" }}>No charges yet.</div>
                ) : (
                  folioRes.billingItems.map((item) => (
                    <div key={item.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: "rgba(255,255,255,0.03)", borderRadius: "6px", marginBottom: "6px", fontSize: "0.875rem" }}>
                      <div>
                        <span style={{ color: "#fff" }}>{item.name}</span>
                        <span style={{ marginLeft: "8px", fontSize: "0.7rem", color: "var(--text-muted)", textTransform: "uppercase" }}>{item.category}</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                        <span style={{ fontWeight: "600", color: "#10b981" }}>{formatCurrency(item.amount)}</span>
                        <button
                          style={{ background: "none", border: "none", cursor: "pointer", color: "#ef4444", fontSize: "0.85rem", padding: "2px 6px" }}
                          onClick={() => handleDeleteFolioCharge(item.id)}
                          title="Remove charge"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  ))
                )}
                {/* Running total */}
                <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 12px 0", fontWeight: "700", fontSize: "0.95rem", borderTop: "1px solid rgba(255,255,255,0.1)", marginTop: "8px" }}>
                  <span>Running Total (excl. GST)</span>
                  <span style={{ color: "#10b981" }}>{formatCurrency(folioRes.billingItems.reduce((s, i) => s + i.amount, 0))}</span>
                </div>
              </div>


              {/* Add Charge Form */}
              <div style={{ background: "rgba(0,0,0,0.2)", borderRadius: "10px", padding: "16px" }}>
                <div style={{ fontSize: "0.82rem", fontWeight: "600", color: "var(--text-secondary)", marginBottom: "12px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Post New Charge</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "10px", marginBottom: "10px" }}>
                  <input
                    style={inputStyle}
                    placeholder="e.g. Room Service - Dinner"
                    value={folioChargeName}
                    onChange={(e) => setFolioChargeName(e.target.value)}
                  />
                  <input
                    style={{ ...inputStyle, width: "110px" }}
                    type="number"
                    placeholder="₹ Amount"
                    value={folioChargeAmount}
                    onChange={(e) => setFolioChargeAmount(e.target.value)}
                  />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "10px" }}>
                  <select style={inputStyle} value={folioChargeCategory} onChange={(e) => setFolioChargeCategory(e.target.value)}>
                    <option value="service" style={optionStyle}>Room Service / F&B</option>
                    <option value="amenity" style={optionStyle}>Amenity (Spa, Gym, Pool)</option>
                    <option value="room" style={optionStyle}>Room Charge</option>
                  </select>
                  <button
                    className="btn-primary"
                    style={{ whiteSpace: "nowrap", padding: "10px 20px", fontSize: "0.85rem" }}
                    onClick={handleAddFolioCharge}
                    disabled={isAddingCharge || !folioChargeName || !folioChargeAmount}
                  >
                    {isAddingCharge ? "Adding..." : "➕ Post"}
                  </button>
                </div>
              </div>

              <button className="btn-secondary" style={{ width: "100%", justifyContent: "center", marginTop: "16px" }} onClick={() => setFolioRes(null)}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── SMART POS MODAL ─────────────────────────────── */}
      {isPosModalOpen && checkoutRes && (
        <div className={styles.modalOverlay} style={{ zIndex: 1000 }}>
          <div className={`${styles.modalContent} glass-card`} style={{ maxWidth: "400px", padding: "0", overflow: "hidden", textAlign: "center" }}>
            <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--border-color)", background: "linear-gradient(135deg, rgba(0,210,97,0.15), transparent)" }}>
              <h2 style={{ fontSize: "1.2rem", fontWeight: "700", color: "#fff" }}>Smart POS Terminal</h2>
              <p style={{ fontSize: "0.82rem", color: "var(--text-secondary)", marginTop: "2px" }}>Awaiting Payment...</p>
            </div>
            <div style={{ padding: "30px 24px" }}>
              {posState === "waking" && (
                <div>
                  <div style={{ fontSize: "2rem", marginBottom: "16px", animation: "pulse 1.5s infinite" }}>📡</div>
                  <div style={{ fontSize: "0.95rem", color: "#fff", fontWeight: "600" }}>Waking up POS Machine...</div>
                  <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: "8px" }}>Sending {formatCurrency(computeBill(checkoutRes).total)} request</div>
                </div>
              )}
              {posState === "ready" && (
                <div>
                  <div style={{ background: "#fff", padding: "16px", borderRadius: "12px", display: "inline-block", marginBottom: "20px" }}>
                    <div style={{ width: "160px", height: "160px", background: "url('https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=upi://pay?pa=hotel@upi&pn=Hotel&am=100') center/cover" }}></div>
                  </div>
                  <div style={{ fontSize: "0.95rem", color: "#fff", fontWeight: "600", marginBottom: "8px" }}>Terminal is Ready</div>
                  <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: "24px" }}>Guest is scanning the Dynamic QR...</div>
                  <button 
                    className="btn-primary" 
                    style={{ background: "#3b82f6", width: "100%", justifyContent: "center" }}
                    onClick={() => {
                      setPosState("paid");
                      setTimeout(() => setIsPosModalOpen(false), 1500);
                    }}
                  >
                    Simulate Guest Payment (Demo)
                  </button>
                </div>
              )}
              {posState === "paid" && (
                <div>
                  <div style={{ fontSize: "3rem", marginBottom: "16px", color: "#10b981" }}>✅</div>
                  <div style={{ fontSize: "1.1rem", color: "#10b981", fontWeight: "700" }}>Payment Successful!</div>
                  <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: "8px" }}>Redirecting...</div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
