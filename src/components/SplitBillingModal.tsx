import React, { useState, useEffect } from "react";
import styles from "../app/dashboard/dashboard.module.css";
import { Reservation, Room } from "./VisualGrid";

interface SplitBillingModalProps {
  reservation: Reservation;
  room: Room;
  onUpdateReservation: (updated: Reservation) => void;
  onClose: () => void;
  addToast: (msg: string) => void;
  activePropertyType?: string;
  activeProperty?: any;
}

interface BillingItem {
  id: string;
  name: string;
  amount: number;
  category: "room" | "service" | "amenity";
  invoiceGroup?: string; // Track group persistently
}

// ── CA COMPLIANCE HELPERS ──
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

function amountInWords(amount: number): string {
  const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
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

export default function SplitBillingModal({
  reservation,
  room,
  onUpdateReservation,
  onClose,
  addToast,
  activePropertyType,
  activeProperty,
}: SplitBillingModalProps) {
  // Ledger items state - separate lists for Invoice A and Invoice B
  const [invoiceA, setInvoiceA] = useState<BillingItem[]>([]);
  const [invoiceB, setInvoiceB] = useState<BillingItem[]>([]);
  
  // Selection checkmarks state
  const [selectedItems, setSelectedItems] = useState<string[]>([]);

  const parseGstMode = (detailsStr?: string | null): "exclusive" | "inclusive" => {
    if (detailsStr && detailsStr.includes("[GST:inclusive]")) return "inclusive";
    return "exclusive";
  };

  const cleanDetailsText = (detailsStr?: string | null): string => {
    if (!detailsStr) return "";
    return detailsStr
      .replace("[GST:inclusive]", "")
      .replace("[GST:exclusive]", "")
      .trim();
  };

  const formatDetailsWithGstMode = (detailsStr: string, mode: "exclusive" | "inclusive"): string => {
    const clean = cleanDetailsText(detailsStr);
    return `${clean}\n[GST:${mode}]`.trim();
  };

  const gstMode = parseGstMode(reservation.details);

  const handleGstModeChange = async (mode: "exclusive" | "inclusive") => {
    if (reservation.status === "checked-out") {
      addToast("⚠️ Billing mode is locked — this reservation has already been checked out.", "error");
      return;
    }
    const cleanDetails = cleanDetailsText(reservation.details);
    const newDetails = formatDetailsWithGstMode(cleanDetails, mode);
    
    onUpdateReservation({
      ...reservation,
      details: newDetails,
    });
    addToast(`📊 GST Mode set to ${mode.toUpperCase()} dynamically.`);

    try {
      const response = await fetch(`/api/reservations/${reservation.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomId: reservation.roomId,
          startIndex: reservation.startIndex,
          status: reservation.status,
          guestName: reservation.guestName,
          details: newDetails,
          duration: reservation.duration,
          isGroup: reservation.isGroup,
          groupName: reservation.groupName,
        }),
      });
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || "Failed to persist GST mode update");
      }
    } catch (err: any) {
      addToast(`❌ Persistent Save Failed: ${err.message}`);
      onUpdateReservation(reservation);
    }
  };

  // Initialize ledger items from reservation data mapping invoice groups correctly
  useEffect(() => {
    if (reservation.billingItems) {
      const items = reservation.billingItems.map((item) => ({
        id: item.id,
        name: item.name,
        amount: item.amount,
        category: item.category as "room" | "service" | "amenity",
        invoiceGroup: item.invoiceGroup || "A",
      }));
      setInvoiceA(items.filter((item) => item.invoiceGroup === "A" || !item.invoiceGroup));
      setInvoiceB(items.filter((item) => item.invoiceGroup === "B"));
      setSelectedItems([]);
    }
  }, [reservation]);

  // ── SECTION 170 CGST-COMPLIANT TAX CALCULATION ──────────────────────────
  // Per Sec.170 CGST Act: tax amounts are rounded to nearest paisa (2dp).
  // In inclusive mode the Grand Total is hard-locked to the original price.
  // Any sub-paisa drift is injected as an explicit "Rounding Adjustment" so
  // the invoice column (Base + CGST + SGST + RoundAdj) === Grand Total.
  const calculateGST = (item: BillingItem) => {
    let rate = 0;
    if (item.category === "room") {
      rate = item.amount > 7500 ? 0.18 : 0.05;
    } else {
      rate = 0.05; // F&B / room-service flat 5%
    }

    if (gstMode === "inclusive") {
      // Step 1: derive base from locked inclusive total
      const lockedTotal = Math.round(item.amount * 100) / 100;
      const baseAmount  = Math.round((lockedTotal / (1 + rate)) * 100) / 100;
      // Step 2: symmetric half-split (round each half independently)
      const cgst = Math.round(baseAmount * (rate / 2) * 100) / 100;
      const sgst = cgst;
      // Step 3: detect rounding drift and absorb it
      const sumCheck    = Number((baseAmount + cgst + sgst).toFixed(2));
      const roundingAdj = Number((lockedTotal - sumCheck).toFixed(2));
      return { rate: rate * 100, baseAmount, cgst, sgst, roundingAdj, total: lockedTotal };
    } else {
      const baseAmount  = Math.round(item.amount * 100) / 100;
      const cgst = Math.round(baseAmount * (rate / 2) * 100) / 100;
      const sgst = cgst;
      const total = Number((baseAmount + cgst + sgst).toFixed(2));
      return { rate: rate * 100, baseAmount, cgst, sgst, roundingAdj: 0, total };
    }
  };

  const getInvoiceTotals = (items: BillingItem[]) => {
    let subtotal = 0, totalCgst = 0, totalSgst = 0, totalRoundingAdj = 0, total = 0;
    items.forEach((item) => {
      const t = calculateGST(item);
      subtotal        += t.baseAmount;
      totalCgst       += t.cgst;
      totalSgst       += t.sgst;
      totalRoundingAdj += t.roundingAdj;
      total           += t.total;
    });
    return {
      subtotal:     Math.round(subtotal * 100) / 100,
      cgst:         Math.round(totalCgst * 100) / 100,
      sgst:         Math.round(totalSgst * 100) / 100,
      roundingAdj:  Math.round(totalRoundingAdj * 100) / 100,
      total:        Math.round(total * 100) / 100,
    };
  };

  const handleSelectItem = (id: string) => {
    setSelectedItems((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const transferToInvoiceB = async () => {
    if (selectedItems.length === 0) return;
    const itemsToMove = invoiceA.filter((item) => selectedItems.includes(item.id));
    const newInvoiceA = invoiceA.filter((item) => !selectedItems.includes(item.id));
    const newInvoiceB = [...invoiceB, ...itemsToMove.map(item => ({ ...item, invoiceGroup: "B" }))];

    // Optimistic UI update
    setInvoiceA(newInvoiceA);
    setInvoiceB(newInvoiceB);
    setSelectedItems([]);
    addToast(`➡️ Shipped ${itemsToMove.length} item(s) to Guest Invoice B.`);

    try {
      const response = await fetch("/api/billing/split", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemIds: itemsToMove.map((i) => i.id), invoiceGroup: "B" }),
      });
      const data = await response.json();
      if (data.success) {
        // Construct the full updated billing items array and update parent reservation state
        const updatedBillingItems = [
          ...newInvoiceA.map(i => ({ ...i, invoiceGroup: "A" })),
          ...newInvoiceB.map(i => ({ ...i, invoiceGroup: "B" }))
        ];
        onUpdateReservation({
          ...reservation,
          billingItems: updatedBillingItems,
        });
      } else {
        throw new Error(data.error || "Failed to split billing items");
      }
    } catch (err: any) {
      addToast(`❌ Persistence failed: ${err.message}`);
      // Revert optimistic updates on failure
      setInvoiceA(invoiceA);
      setInvoiceB(invoiceB);
    }
  };

  const transferToInvoiceA = async () => {
    if (selectedItems.length === 0) return;
    const itemsToMove = invoiceB.filter((item) => selectedItems.includes(item.id));
    const newInvoiceB = invoiceB.filter((item) => !selectedItems.includes(item.id));
    const newInvoiceA = [...invoiceA, ...itemsToMove.map(item => ({ ...item, invoiceGroup: "A" }))];

    // Optimistic UI update
    setInvoiceB(newInvoiceB);
    setInvoiceA(newInvoiceA);
    setSelectedItems([]);
    addToast(`⬅️ Shipped ${itemsToMove.length} item(s) back to Corporate Invoice A.`);

    try {
      const response = await fetch("/api/billing/split", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemIds: itemsToMove.map((i) => i.id), invoiceGroup: "A" }),
      });
      const data = await response.json();
      if (data.success) {
        // Construct the full updated billing items array and update parent reservation state
        const updatedBillingItems = [
          ...newInvoiceA.map(i => ({ ...i, invoiceGroup: "A" })),
          ...newInvoiceB.map(i => ({ ...i, invoiceGroup: "B" }))
        ];
        onUpdateReservation({
          ...reservation,
          billingItems: updatedBillingItems,
        });
      } else {
        throw new Error(data.error || "Failed to split billing items");
      }
    } catch (err: any) {
      addToast(`❌ Persistence failed: ${err.message}`);
      // Revert optimistic updates on failure
      setInvoiceB(invoiceB);
      setInvoiceA(invoiceA);
    }
  };

  const handleExportPDF = (invoiceType: "A" | "B") => {
    const items = invoiceType === "A" ? invoiceA : invoiceB;
    if (items.length === 0) return;
    
    const totals = getInvoiceTotals(items);
    const now = new Date();
    // Use Guest GSTIN to determine State if Corporate, otherwise fallback to property state
    let guestState = PROPERTY_STATE;
    let isIntrastate = true;
    
    // Fallback to checking the reservation's GSTIN if provided
    if (reservation.billingType === "corporate" && reservation.guestGstNumber && reservation.guestGstNumber.length === 15) {
      const code = reservation.guestGstNumber.substring(0, 2);
      guestState = STATE_CODES[code] || "Unknown State";
      isIntrastate = code === PROPERTY_STATE_CODE;
    }
    const fy = now.getMonth() > 2 ? `${now.getFullYear().toString().slice(-2)}-${(now.getFullYear()+1).toString().slice(-2)}` : `${(now.getFullYear()-1).toString().slice(-2)}-${now.getFullYear().toString().slice(-2)}`;
    const invoiceNo = `ATH/${fy}/${reservation.id.substring(0,4).toUpperCase()}/${invoiceType}`;
    const words = amountInWords(totals.total);

    // Compute average tax rate for summary based on total tax / total subtotal
    let avgGstRate = 0;
    if (totals.subtotal > 0) avgGstRate = ((totals.cgst + totals.sgst) / totals.subtotal);
    const halfRate = (avgGstRate * 50).toFixed(1).replace(/\.0$/, '');
    const fullRate = (avgGstRate * 100).toFixed(1).replace(/\.0$/, '');

    const formatCurrency = (val: number) => `₹${val.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    const itemRows = items.map(item => {
      const tax = calculateGST(item);
      const sac = getSacCode(item.category, item.name);
      const itemHalf = (tax.rate / 2).toFixed(1).replace(/\.0$/, '');
      const itemFull = (tax.rate).toFixed(1).replace(/\.0$/, '');

      if (isIntrastate) {
        return `<tr>
          <td>${item.name}</td>
          <td style="text-align:center;color:#555;font-size:11px">${sac}</td>
          <td style="text-align:center;font-size:11px;color:#555">${item.category.toUpperCase()}</td>
          <td style="text-align:right">${formatCurrency(tax.baseAmount)}</td>
          <td style="text-align:center;font-size:11px">${tax.rate > 0 ? itemHalf+'%' : '—'}</td>
          <td style="text-align:center;font-size:11px">${tax.rate > 0 ? itemHalf+'%' : '—'}</td>
        </tr>`;
      } else {
        return `<tr>
          <td>${item.name}</td>
          <td style="text-align:center;color:#555;font-size:11px">${sac}</td>
          <td style="text-align:center;font-size:11px;color:#555">${item.category.toUpperCase()}</td>
          <td style="text-align:right">${formatCurrency(tax.baseAmount)}</td>
          <td style="text-align:center;font-size:11px">${tax.rate > 0 ? itemFull+'%' : '—'}</td>
        </tr>`;
      }
    }).join('');

    const taxHeader = isIntrastate
      ? `<th style="text-align:center">CGST Rate</th><th style="text-align:center">SGST Rate</th>`
      : `<th style="text-align:center">IGST Rate</th>`;

    // ── Rounding adjustment row (Sec. 170 CGST Act) ──────────────────────────
    const roundingAdj = totals.roundingAdj ?? 0;
    const roundingRow = roundingAdj !== 0
      ? `<tr class="gst-row">
           <td colspan="4" style="text-align:right;font-style:italic;color:#b45309">Rounding Adjustment (Sec.170 CGST Act)</td>
           <td colspan="2" style="text-align:right;padding-right:8px;color:#b45309">${roundingAdj > 0 ? '+' : ''}${formatCurrency(roundingAdj)}</td>
         </tr>`
      : '';

    const taxSummaryRows = (totals.cgst + totals.sgst) > 0
      ? isIntrastate
        ? `<tr class="gst-row"><td colspan="4" style="text-align:right">CGST @ ${halfRate}%</td><td colspan="2" style="text-align:right;padding-right:8px">${formatCurrency(totals.cgst)}</td></tr>
           <tr class="gst-row"><td colspan="4" style="text-align:right">SGST @ ${halfRate}%</td><td colspan="2" style="text-align:right;padding-right:8px">${formatCurrency(totals.sgst)}</td></tr>
           ${roundingRow}`
        : `<tr class="gst-row"><td colspan="4" style="text-align:right">IGST @ ${fullRate}%</td><td colspan="2" style="text-align:right;padding-right:8px">${formatCurrency(totals.cgst + totals.sgst)}</td></tr>
           ${roundingRow}`
      : '';

    const colSpanTotal = isIntrastate ? 5 : 4;

    const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <title>Tax Invoice ${invoiceType} – ${reservation.guestName}</title>
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
  <div class="no-print" style="margin-bottom:20px">
    <button onclick="window.print()" style="background:#4f46e5;color:#fff;border:none;padding:10px 24px;border-radius:6px;font-size:13px;font-weight:600;cursor:pointer;letter-spacing:0.03em">🖨 Print Invoice</button>
  </div>
  <div class="inv-header">
    <div style="flex: 1;">
      <div class="inv-logo">${activeProperty?.name || "Aether"}<span>HMS</span></div>
      <div class="inv-tagline" style="font-weight:700; color:#111; margin-top:4px;">${activeProperty?.name || "Aether Hotel Management Pvt. Ltd."}</div>
      <div class="inv-tagline" style="margin-top:2px; max-width: 250px;">${activeProperty?.location || "123, Hospitality Avenue, Sector 4, New Delhi - 110001, India"}</div>
      <div class="inv-tagline" style="margin-top:4px; font-weight:600; color:#4f46e5;">Property GSTIN: ${activeProperty?.gstNumber || "N/A"} · State: ${PROPERTY_STATE} (Code: 07)</div>
    </div>
    <div class="inv-meta" style="flex: 1; text-align:right;">
      <h2 style="font-size: 24px; color: #111; border-bottom: 2px solid #111; display: inline-block; padding-bottom: 4px; margin-bottom: 8px;">TAX INVOICE ${invoiceType}</h2>
      <p class="inv-no">Invoice No: ${invoiceNo}</p>
      <p>Date of Issue: ${now.toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'})}</p>
      <p>Time: ${now.toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})}</p>
      <div class="tax-badge ${isIntrastate ? 'intrastate' : 'interstate'}">${isIntrastate ? '✓ Intrastate — CGST + SGST' : '⚡ Inter-State — IGST Applicable'}</div>
    </div>
  </div>
  <div class="info-grid">
    <div>
      <div class="info-block" style="margin-bottom:10px">
        <label style="color:#4f46e5;">Billed To (Guest Details)</label>
        <p style="font-size:15px;font-weight:700">${reservation.guestName}</p>
        ${reservation.groupName ? `<p style="font-size:12px;font-weight:600;margin-top:2px">${reservation.groupName}</p>` : ''}
        ${reservation.guestGstNumber ? `<p style="font-size:11px;color:#4f46e5;margin-top:1px;font-weight:600">GSTIN: ${reservation.guestGstNumber}</p>` : ''}
      </div>
      <div class="info-block" style="margin-bottom:10px">
        <label>Guest State</label>
        <p>${guestState}</p>
      </div>
      ${reservation.phone ? `<div class="info-block"><label>Mobile</label><p class="mono">${reservation.phone}</p></div>` : ''}
      ${reservation.email ? `<div class="info-block" style="margin-top:8px"><label>Email</label><p class="mono">${reservation.email}</p></div>` : ''}
    </div>
    <div>
      <div class="info-block" style="margin-bottom:10px">
        <label>Room</label>
        <p style="font-weight:700">${room ? `Room ${room.number} — ${room.name}` : 'N/A'}</p>
        <p style="font-size:11px;color:#6b7280;margin-top:2px">${room?.type || ''}</p>
      </div>
      <div class="info-block" style="margin-bottom:10px">
        <label>Invoice Type</label>
        <p>${invoiceType === "A" ? "Primary Room Tariff & Taxes" : "Incidentals / Split Share"}</p>
      </div>
    </div>
  </div>

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
      <tr class="subtotal-row">
        <td colspan="3" style="text-align:right">Taxable Subtotal</td>
        <td style="text-align:right">${formatCurrency(totals.subtotal)}</td>
        <td ${isIntrastate ? 'colspan="2"' : ''} style="text-align:center;font-size:11px;color:#6b7280">—</td>
      </tr>
      ${taxSummaryRows}
      <tr class="total-row">
        <td colspan="${colSpanTotal}" style="text-align:right">Grand Total (Incl. GST)</td>
        <td style="text-align:right">${formatCurrency(totals.total)}</td>
      </tr>
    </tbody>
  </table>

  <div class="words-block">
    <div class="words-label">Amount in Words</div>
    <div class="words-text">${words}</div>
  </div>

  <div class="payment-row">
    <div>
      <div style="font-size:11px;color:#555;margin-bottom:6px"><strong>Payment Status:</strong> Pending / To Ledger</div>
      <div class="stamp" style="margin-bottom:12px">SPLIT BILL GENERATED</div>
      
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

  <div class="gst-notice">
    <strong>Note:</strong> ${isIntrastate
      ? `This is an intrastate supply. CGST and SGST apply under CGST Act, 2017 and ${guestState} GST Act, 2017.`
      : `This is an inter-state supply from ${PROPERTY_STATE} to ${guestState}. IGST applies under IGST Act, 2017.`
    }
  </div>

  <div class="footer">
    AetherHMS · This is a computer-generated invoice and does not require a physical signature. · Generated: ${now.toLocaleString('en-IN')}
  </div>
</body>
</html>`;

    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(htmlContent);
      printWindow.document.close();
    }
    
    addToast(`📄 Invoice ${invoiceType} ready for PDF export / printing.`);
  };

  const handleTallySync = (invoiceType: "A" | "B") => {
    const items = invoiceType === "A" ? invoiceA : invoiceB;
    if (items.length === 0) return;
    
    const totals = getInvoiceTotals(items);
    const dateStr = new Date().toISOString().split("T")[0].replace(/-/g, "");
    
    const tallyXml = `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Import Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>Vouchers</REPORTNAME>
      </REQUESTDESC>
      <REQUESTDATA>
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <VOUCHER VCHTYPE="Sales" ACTION="Create">
            <DATE>${dateStr}</DATE>
            <NARRATION>Invoice ${invoiceType} - ${reservation.guestName} (Room ${room.number})</NARRATION>
            <VOUCHERTYPENAME>Sales</VOUCHERTYPENAME>
            <PARTYLEDGERNAME>Cash/Card Payments</PARTYLEDGERNAME>
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>Cash/Card Payments</LEDGERNAME>
              <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
              <AMOUNT>-${totals.total.toFixed(2)}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>Local Room Sales Account</LEDGERNAME>
              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
              <AMOUNT>${totals.subtotal.toFixed(2)}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>Output CGST</LEDGERNAME>
              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
              <AMOUNT>${totals.cgst.toFixed(2)}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>Output SGST</LEDGERNAME>
              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
              <AMOUNT>${totals.sgst.toFixed(2)}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>
          </VOUCHER>
        </TALLYMESSAGE>
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`;

    const blob = new Blob([tallyXml], { type: "application/xml" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tally-sync-invoice-${invoiceType}-${reservation.id.slice(0,6)}.xml`;
    document.body.appendChild(a);
    a.click();
    a.remove();

    addToast(`📊 Invoice ${invoiceType} successfully downloaded for Tally ERP import.`);
  };

  const handleDeleteBooking = async () => {
    if (!window.confirm(`⚠️ Are you sure you want to CANCEL and DELETE the entire booking for ${reservation.guestName}? This will remove all records from the database.`)) {
      return;
    }

    try {
      const response = await fetch(`/api/reservations/${reservation.id}`, {
        method: "DELETE",
      });
      const data = await response.json();
      
      if (data.success || response.ok) {
        // If guest was checked-in or checked-out, mark room as Dirty
        if (reservation.status === "checked-in" || reservation.status === "checked-out") {
          if (typeof window !== "undefined") {
            try {
              const stored = localStorage.getItem("aether_room_housekeeping_statuses");
              const current = stored ? JSON.parse(stored) : {};
              if (room.id) {
                current[room.id] = {
                  ...(current[room.id] || {}),
                  status: "Dirty",
                  lastUpdated: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                };
                localStorage.setItem("aether_room_housekeeping_statuses", JSON.stringify(current));
              }
            } catch (err) {
              console.error("Failed to flag housekeeping as dirty during cancellation", err);
            }
          }
        }
        
        addToast(`🗑️ Booking for ${reservation.guestName} successfully cancelled & deleted.`);
        onClose();
        // Reload page to refresh context
        setTimeout(() => {
          window.location.reload();
        }, 800);
      } else {
        throw new Error(data.error || "Failed to delete booking");
      }
    } catch (err: any) {
      addToast(`❌ Delete failed: ${err.message}`);
    }
  };

  const totalsA = getInvoiceTotals(invoiceA);
  const totalsB = getInvoiceTotals(invoiceB);

  return (
    <div className={styles.modalOverlay}>
      <div className={`${styles.modalContent} glass-card`}>
        <div className={styles.modalHeader}>
          <div>
            <h2 style={{ fontSize: "1.5rem", fontWeight: "700", marginBottom: "4px" }}>
              Split Billing & Reservation Ledger
            </h2>
            <p style={{ color: "var(--text-secondary)", fontSize: "0.85rem" }}>
              Manage corporate routing, shared amenities allocation, and live GST invoices.
            </p>
          </div>
          <button className={styles.modalCloseBtn} onClick={onClose}>
            ✕
          </button>
        </div>

        {/* Guest Reservation Card Info */}
        <div
          style={{
            backgroundColor: "var(--bg-tertiary)",
            borderRadius: "8px",
            padding: "16px",
            border: "1px solid var(--border-color)",
            display: "flex",
            justifyContent: "space-between",
            marginBottom: "24px",
            fontSize: "0.875rem",
          }}
        >
          <div>
            <strong style={{ color: "#fff", display: "block", fontSize: "1rem", marginBottom: "4px" }}>
              🔑 Guest: {reservation.guestName}
            </strong>
            <span style={{ color: "var(--text-secondary)", display: "block" }}>
              Room {room.number} — {room.name} ({room.type})
            </span>
            <span style={{ color: "var(--text-secondary)", display: "block", marginTop: "4px", fontSize: "0.8rem", fontWeight: "500", padding: "4px 8px", backgroundColor: "rgba(255,255,255,0.03)", borderRadius: "4px", display: "inline-block" }}>
              🗓️ In: {reservation.checkInTime 
                ? new Date(reservation.checkInTime).toLocaleString("en-IN", { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                : new Date(new Date("2026-05-20T00:00:00").getTime() + reservation.startIndex * 86400000).toLocaleDateString("en-IN", { weekday: 'short', month: 'short', day: 'numeric' })}
              &nbsp;&nbsp;&nbsp;|&nbsp;&nbsp;&nbsp;
              🏁 Out: {reservation.checkOutTime 
                ? new Date(reservation.checkOutTime).toLocaleString("en-IN", { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                : new Date(new Date("2026-05-20T00:00:00").getTime() + (reservation.startIndex + reservation.duration) * 86400000).toLocaleDateString("en-IN", { weekday: 'short', month: 'short', day: 'numeric' })}
            </span>
            <div style={{ marginTop: "12px", display: "flex", flexWrap: "wrap", gap: "16px", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ color: "var(--text-secondary)", fontSize: "0.8rem", fontWeight: "600" }}>Check-In Status:</span>
                <select
                  disabled={reservation.status === "checked-out"}
                  value={reservation.status}
                  onChange={(e) => {
                    const newStatus = e.target.value as any;
                    const updated = { ...reservation, status: newStatus };
                    onUpdateReservation(updated);
                    
                    if (newStatus === "checked-out") {
                      if (typeof window !== "undefined") {
                        try {
                          const stored = localStorage.getItem("aether_room_housekeeping_statuses");
                          const current = stored ? JSON.parse(stored) : {};
                          if (room.id) {
                            current[room.id] = {
                              ...(current[room.id] || {}),
                              status: "Dirty",
                              lastUpdated: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                            };
                            localStorage.setItem("aether_room_housekeeping_statuses", JSON.stringify(current));
                          }
                        } catch (err) {
                          console.error("Failed to update housekeeping status in localStorage", err);
                        }
                      }
                    }
                    
                    addToast(`🟢 Status updated to ${newStatus.toUpperCase()} for ${reservation.guestName}`);
                  }}
                  style={{
                    backgroundColor: "rgba(255,255,255,0.05)",
                    border: "1px solid var(--border-color)",
                    borderRadius: "6px",
                    color: "#fff",
                    padding: "4px 8px",
                    fontSize: "0.8rem",
                    fontWeight: "600",
                    cursor: reservation.status === "checked-out" ? "not-allowed" : "pointer",
                    opacity: reservation.status === "checked-out" ? 0.6 : 1,
                    outline: "none",
                    transition: "all 0.2s ease",
                  }}
                >
                  <option value="confirmed" style={{ backgroundColor: "#121026", color: "#818cf8" }}>🔵 Confirmed (Booked)</option>
                  <option value="checked-in" style={{ backgroundColor: "#121026", color: "#34d399" }}>🟢 Checked-In (In-Room)</option>
                  <option value="pending" style={{ backgroundColor: "#121026", color: "#fbbf24" }}>🟡 Unpaid / Pending</option>
                  <option value="checked-out" style={{ backgroundColor: "#121026", color: "#94a3b8" }}>🏁 Checked-Out (Left/Vacant)</option>
                  <option value="maintenance" style={{ backgroundColor: "#121026", color: "#f87171" }}>🛠️ Out of Order</option>
                </select>
              </div>

              {/* GST Preferences - HIDDEN for Homestays */}
              {activePropertyType !== "homestay" && (
                <div style={{ marginTop: "24px" }}>
                  <h3 style={{ fontSize: "0.95rem", fontWeight: "600", color: "#fff", marginBottom: "12px", display: "flex", alignItems: "center", gap: "6px" }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "#818cf8" }}>
                      <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                    </svg>
                    GST Billing Mode
                    {reservation.status === "checked-out" && (
                      <span style={{ fontSize: "0.65rem", background: "rgba(239,68,68,0.15)", color: "#f87171", border: "1px solid rgba(239,68,68,0.3)", borderRadius: "4px", padding: "2px 6px", marginLeft: "4px", fontWeight: "700", letterSpacing: "0.04em" }}>LOCKED — CHECKED OUT</span>
                    )}
                  </h3>
                  <div style={{ backgroundColor: "rgba(255,255,255,0.02)", border: `1px dashed ${reservation.status === "checked-out" ? "rgba(239,68,68,0.3)" : "rgba(255,255,255,0.1)"}`, borderRadius: "8px", padding: "16px", opacity: reservation.status === "checked-out" ? 0.7 : 1, pointerEvents: reservation.status === "checked-out" ? "none" : "auto" }}>
                    <div style={{ display: "flex", gap: "24px" }}>
                      <label style={{ display: "flex", alignItems: "center", gap: "4px", cursor: reservation.status === "checked-out" ? "not-allowed" : "pointer", fontSize: "0.8rem", color: gstMode === "exclusive" ? "#fff" : "var(--text-secondary)" }}>
                        <input 
                          type="radio" 
                          name="modalGstMode"
                          checked={gstMode === "exclusive"}
                          disabled={reservation.status === "checked-out"}
                          onChange={() => handleGstModeChange("exclusive")}
                          style={{ cursor: reservation.status === "checked-out" ? "not-allowed" : "pointer" }}
                        />
                        Exclusive (Add GST)
                      </label>
                      <label style={{ display: "flex", alignItems: "center", gap: "4px", cursor: reservation.status === "checked-out" ? "not-allowed" : "pointer", fontSize: "0.8rem", color: gstMode === "inclusive" ? "#fff" : "var(--text-secondary)" }}>
                        <input 
                          type="radio" 
                          name="modalGstMode"
                          checked={gstMode === "inclusive"}
                          disabled={reservation.status === "checked-out"}
                          onChange={() => handleGstModeChange("inclusive")}
                          style={{ cursor: reservation.status === "checked-out" ? "not-allowed" : "pointer" }}
                        />
                        Inclusive (Extract GST)
                      </label>
                    </div>
                  </div>
                </div>
              )}

              {/* B2B Corporate Billing Section */}
              <div style={{ marginTop: "24px" }}>
                <h3 style={{ fontSize: "0.95rem", fontWeight: "600", color: "#fff", marginBottom: "12px", display: "flex", alignItems: "center", gap: "6px" }}>
                  🏢 B2B Corporate Billing
                  {reservation.status === "checked-out" && (
                    <span style={{ fontSize: "0.65rem", background: "rgba(239,68,68,0.15)", color: "#f87171", border: "1px solid rgba(239,68,68,0.3)", borderRadius: "4px", padding: "2px 6px", marginLeft: "4px", fontWeight: "700", letterSpacing: "0.04em" }}>LOCKED — CHECKED OUT</span>
                  )}
                </h3>
                <div style={{ backgroundColor: "rgba(255,255,255,0.02)", border: `1px solid ${reservation.status === "checked-out" ? "rgba(239,68,68,0.3)" : "rgba(255,255,255,0.1)"}`, borderRadius: "8px", padding: "16px", opacity: reservation.status === "checked-out" ? 0.7 : 1, pointerEvents: reservation.status === "checked-out" ? "none" : "auto" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: reservation.status === "checked-out" ? "not-allowed" : "pointer", fontSize: "0.85rem", color: "#fff", fontWeight: "600", marginBottom: "12px" }}>
                    <input 
                      type="checkbox" 
                      checked={reservation.billingType === "corporate"}
                      disabled={reservation.status === "checked-out"}
                      onChange={async (e) => {
                        const isCorp = e.target.checked;
                        const updated = { ...reservation, billingType: isCorp ? "corporate" : "individual" };
                        if (!isCorp) {
                          updated.guestGstNumber = null;
                        }
                        onUpdateReservation(updated);
                        
                        try {
                          await fetch(`/api/reservations/${reservation.id}`, {
                            method: "PUT",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ billingType: updated.billingType, guestGstNumber: updated.guestGstNumber }),
                          });
                        } catch (err) {}
                      }}
                      style={{ cursor: reservation.status === "checked-out" ? "not-allowed" : "pointer", width: "16px", height: "16px" }}
                    />
                    Enable Corporate GST Invoice
                  </label>
                  
                  {reservation.billingType === "corporate" && (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginTop: "12px" }}>
                      <div>
                        <label style={{ display: "block", fontSize: "0.75rem", color: "var(--text-secondary)", marginBottom: "4px" }}>Company Name</label>
                        <input 
                          type="text"
                          value={reservation.groupName || ""}
                          readOnly={reservation.status === "checked-out"}
                          onChange={(e) => {
                            if (reservation.status !== "checked-out") onUpdateReservation({ ...reservation, groupName: e.target.value });
                          }}
                          onBlur={async (e) => {
                            if (reservation.status === "checked-out") return;
                            try {
                              await fetch(`/api/reservations/${reservation.id}`, {
                                method: "PUT", headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ groupName: e.target.value }),
                              });
                            } catch (err) {}
                          }}
                          style={{ width: "100%", padding: "8px", borderRadius: "4px", border: "1px solid var(--border-color)", backgroundColor: reservation.status === "checked-out" ? "rgba(0,0,0,0.4)" : "rgba(0,0,0,0.2)", color: "#fff", fontSize: "0.85rem", cursor: reservation.status === "checked-out" ? "not-allowed" : "text" }}
                          placeholder="e.g. TechCorp Pvt Ltd"
                        />
                      </div>
                      <div>
                        <label style={{ display: "block", fontSize: "0.75rem", color: "var(--text-secondary)", marginBottom: "4px" }}>Company GSTIN</label>
                        <input 
                          type="text"
                          value={reservation.guestGstNumber || ""}
                          maxLength={15}
                          readOnly={reservation.status === "checked-out"}
                          onChange={(e) => {
                            if (reservation.status === "checked-out") return;
                            const val = e.target.value.toUpperCase();
                            onUpdateReservation({ ...reservation, guestGstNumber: val });
                          }}
                          onBlur={async (e) => {
                            if (reservation.status === "checked-out") return;
                            const val = e.target.value;
                            if (val && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(val)) {
                              addToast("⚠️ Invalid GSTIN format. Example: 07AAAAA0000A1Z5");
                              return;
                            }
                            try {
                              await fetch(`/api/reservations/${reservation.id}`, {
                                method: "PUT", headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ guestGstNumber: val }),
                              });
                              addToast("🏢 Corporate Billing details saved.");
                            } catch (err) {}
                          }}
                          style={{ width: "100%", padding: "8px", borderRadius: "4px", border: "1px solid var(--border-color)", backgroundColor: reservation.status === "checked-out" ? "rgba(0,0,0,0.4)" : "rgba(0,0,0,0.2)", color: reservation.guestGstNumber && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(reservation.guestGstNumber) ? "#ef4444" : "#fff", fontSize: "0.85rem", cursor: reservation.status === "checked-out" ? "not-allowed" : "text" }}
                          placeholder="15-character GSTIN"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <span
              style={{
                display: "inline-block",
                padding: "4px 8px",
                borderRadius: "4px",
                fontSize: "0.75rem",
                fontWeight: "600",
                backgroundColor: "rgba(99, 102, 241, 0.15)",
                color: "#818cf8",
                marginBottom: "4px",
              }}
            >
              {reservation.isGroup ? `🏢 Group: ${reservation.groupName}` : "👤 Individual Booking"}
            </span>
            <div style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>
              Ledger ID: {reservation.id}
            </div>
          </div>
        </div>

        {/* Split Billing Multi-Invoice Split Grid */}
        <div className={styles.splitBillingGrid}>
          {/* LEDGER POOL SELECTOR */}
          <div className={styles.ledgerSection}>
            <h3 style={{ fontSize: "1rem", fontWeight: "600", color: "#fff" }}>
              📋 Consolidated Charge Ledger
            </h3>
            <p style={{ fontSize: "0.775rem", color: "var(--text-secondary)", marginTop: "-8px" }}>
              Select ledger items to distribute them between invoices.
            </p>

            <table className={styles.itemTable}>
              <thead>
                <tr>
                  <th style={{ width: "40px" }}>Select</th>
                  <th>Item Description</th>
                  <th>Category</th>
                  <th style={{ textAlign: "right" }}>Base Amount</th>
                </tr>
              </thead>
              <tbody>
                {/* Invoice A Items */}
                {invoiceA.map((item) => (
                  <tr
                    key={item.id}
                    className={selectedItems.includes(item.id) ? styles.itemRowChecked : ""}
                  >
                    <td>
                      <input
                        type="checkbox"
                        checked={selectedItems.includes(item.id)}
                        onChange={() => handleSelectItem(item.id)}
                        style={{ cursor: "pointer" }}
                      />
                    </td>
                    <td>
                      <div>{item.name}</div>
                      <span style={{ fontSize: "0.7rem", color: "#818cf8" }}>In Invoice A</span>
                    </td>
                    <td>
                      <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                        {item.category.toUpperCase()}
                      </span>
                    </td>
                    <td style={{ textAlign: "right", fontWeight: "500", color: "#fff" }}>
                      ₹{item.amount.toLocaleString("en-IN")}
                    </td>
                  </tr>
                ))}

                {/* Invoice B Items */}
                {invoiceB.map((item) => (
                  <tr
                    key={item.id}
                    className={selectedItems.includes(item.id) ? styles.itemRowChecked : ""}
                  >
                    <td>
                      <input
                        type="checkbox"
                        checked={selectedItems.includes(item.id)}
                        onChange={() => handleSelectItem(item.id)}
                        style={{ cursor: "pointer" }}
                      />
                    </td>
                    <td>
                      <div>{item.name}</div>
                      <span style={{ fontSize: "0.7rem", color: "var(--status-pending)" }}>
                        In Invoice B
                      </span>
                    </td>
                    <td>
                      <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                        {item.category.toUpperCase()}
                      </span>
                    </td>
                    <td style={{ textAlign: "right", fontWeight: "500", color: "#fff" }}>
                      ₹{item.amount.toLocaleString("en-IN")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Split Actions Controller */}
            <div style={{ display: "flex", gap: "12px", marginTop: "12px" }}>
              {reservation.status === "checked-out" ? (
                <div style={{ width: "100%", padding: "8px", borderRadius: "6px", backgroundColor: "rgba(239,68,68,0.08)", border: "1px dashed rgba(239,68,68,0.3)", color: "#f87171", fontSize: "0.8rem", textAlign: "center" }}>
                  🔒 Invoice items are locked — guest has checked out.
                </div>
              ) : (
                <>
                  <button
                    className="btn-secondary"
                    style={{ flexGrow: 1, fontSize: "0.8rem", padding: "6px" }}
                    onClick={transferToInvoiceB}
                    disabled={selectedItems.length === 0}
                  >
                    ➡️ Move Selected to Invoice B
                  </button>
                  <button
                    className="btn-secondary"
                    style={{ flexGrow: 1, fontSize: "0.8rem", padding: "6px" }}
                    onClick={transferToInvoiceA}
                    disabled={selectedItems.length === 0}
                  >
                    ⬅️ Move Selected to Invoice A
                  </button>
                </>
              )}
            </div>
          </div>

          {/* TWO DYNAMIC INVOICE PREVIEWS */}
          <div className={styles.invoiceSection}>
            {/* INVOICE CARD A */}
            <div className={styles.invoiceCard}>
              <div className={styles.invoiceHeader}>
                <span>{reservation.isGroup ? "Invoice A: Corporate / Primary" : "Invoice A: Room & Primary"}</span>
                {activePropertyType !== "homestay" && <span style={{ color: "#818cf8", fontSize: "0.75rem" }}>GST Active</span>}
              </div>

              {invoiceA.length === 0 ? (
                <div style={{ color: "var(--text-muted)", fontSize: "0.8rem", textAlign: "center", padding: "16px" }}>
                  No billable items mapped to this invoice.
                </div>
              ) : (
                <>
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {invoiceA.map((item) => {
                      const tax = calculateGST(item);
                      return (
                        <div key={item.id} className={styles.invoiceItemRow}>
                          <span>{item.name}</span>
                          <span>
                            ₹{activePropertyType === "homestay" ? item.amount.toLocaleString("en-IN") : tax.baseAmount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            {activePropertyType !== "homestay" && (
                              <span style={{ fontSize: "0.65rem", color: "var(--text-muted)", marginLeft: "4px" }}>
                                ({gstMode === "inclusive" ? `incl. ${tax.rate}%` : `+${tax.rate}%`})
                              </span>
                            )}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {activePropertyType !== "homestay" && (
                    <div className={styles.taxSummary}>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span>Tariff Subtotal</span>
                        <span>₹{totalsA.subtotal.toLocaleString("en-IN")}</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span>CGST (Central Tax)</span>
                        <span>₹{totalsA.cgst.toLocaleString("en-IN")}</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span>SGST (State Tax)</span>
                        <span>₹{totalsA.sgst.toLocaleString("en-IN")}</span>
                      </div>
                    </div>
                  )}

                  <div className={styles.invoiceTotal}>
                    <span>{activePropertyType === "homestay" ? "Guest Bill Summary" : "Grand Total (Incl. Taxes)"}</span>
                    <span>₹{Math.round(totalsA.total).toLocaleString("en-IN")}</span>
                  </div>
                  
                  {/* UPI QR Code Block for Homestay */}
                  {activePropertyType === "homestay" && (
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: "16px", padding: "16px", background: "rgba(255,255,255,0.05)", borderRadius: "12px", border: "1px dashed rgba(255,255,255,0.2)" }}>
                      <p style={{ fontSize: "0.85rem", color: "#e2e8f0", marginBottom: "12px", fontWeight: "600" }}>Scan & Pay via UPI</p>
                      <img src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(`upi://pay?pa=merchant@upi&pn=AetherHMS&am=${Math.round(totalsA.total)}&cu=INR`)}`} alt="UPI QR Code" style={{ width: "120px", height: "120px", borderRadius: "8px", background: "#fff", padding: "4px" }} />
                    </div>
                  )}


                  <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
                    <button
                      className="btn-primary"
                      style={{ padding: "6px 12px", fontSize: "0.75rem", flexGrow: 1 }}
                      onClick={() => handleExportPDF("A")}
                    >
                      📄 Export PDF
                    </button>
                    <button
                      className="btn-secondary"
                      style={{ padding: "6px 12px", fontSize: "0.75rem" }}
                      onClick={() => handleTallySync("A")}
                      title="Sync to Tally ERP"
                    >
                      🔌 Tally
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* INVOICE CARD B */}
            <div className={styles.invoiceCard}>
              <div className={styles.invoiceHeader}>
                <span>{reservation.isGroup ? "Invoice B: Personal / Split Share" : "Invoice B: Incidentals / Split Share"}</span>
                <span style={{ color: "var(--status-pending)", fontSize: "0.75rem" }}>Split Active</span>
              </div>

              {invoiceB.length === 0 ? (
                <div style={{ color: "var(--text-muted)", fontSize: "0.8rem", textAlign: "center", padding: "16px" }}>
                  No billable items mapped to this invoice.
                </div>
              ) : (
                <>
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {invoiceB.map((item) => {
                      const tax = calculateGST(item);
                      return (
                        <div key={item.id} className={styles.invoiceItemRow}>
                          <span>{item.name}</span>
                          <span>
                            ₹{activePropertyType === "homestay" ? item.amount.toLocaleString("en-IN") : tax.baseAmount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            {activePropertyType !== "homestay" && (
                              <span style={{ fontSize: "0.65rem", color: "var(--text-muted)", marginLeft: "4px" }}>
                                ({gstMode === "inclusive" ? `incl. ${tax.rate}%` : `+${tax.rate}%`})
                              </span>
                            )}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {activePropertyType !== "homestay" && (
                    <div className={styles.taxSummary}>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span>Tariff Subtotal</span>
                        <span>₹{totalsB.subtotal.toLocaleString("en-IN")}</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span>CGST (Central Tax)</span>
                        <span>₹{totalsB.cgst.toLocaleString("en-IN")}</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span>SGST (State Tax)</span>
                        <span>₹{totalsB.sgst.toLocaleString("en-IN")}</span>
                      </div>
                    </div>
                  )}

                  <div className={styles.invoiceTotal}>
                    <span>{activePropertyType === "homestay" ? "Guest Bill Summary" : "Grand Total (Incl. Taxes)"}</span>
                    <span>₹{Math.round(totalsB.total).toLocaleString("en-IN")}</span>
                  </div>
                  
                  {/* UPI QR Code Block for Homestay */}
                  {activePropertyType === "homestay" && (
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: "16px", padding: "16px", background: "rgba(255,255,255,0.05)", borderRadius: "12px", border: "1px dashed rgba(255,255,255,0.2)" }}>
                      <p style={{ fontSize: "0.85rem", color: "#e2e8f0", marginBottom: "12px", fontWeight: "600" }}>Scan & Pay via UPI</p>
                      <img src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(`upi://pay?pa=merchant@upi&pn=AetherHMS&am=${Math.round(totalsB.total)}&cu=INR`)}`} alt="UPI QR Code" style={{ width: "120px", height: "120px", borderRadius: "8px", background: "#fff", padding: "4px" }} />
                    </div>
                  )}

                  <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
                    <button
                      className="btn-primary"
                      style={{ padding: "6px 12px", fontSize: "0.75rem", flexGrow: 1 }}
                      onClick={() => handleExportPDF("B")}
                    >
                      📄 Export PDF
                    </button>
                    <button
                      className="btn-secondary"
                      style={{ padding: "6px 12px", fontSize: "0.75rem" }}
                      onClick={() => handleTallySync("B")}
                      title="Sync to Tally ERP"
                    >
                      🔌 Tally
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        <div className={styles.splitButtons} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", marginTop: "24px", borderTop: "1px solid var(--border-color)", paddingTop: "16px" }}>
          <button 
            onClick={handleDeleteBooking}
            style={{
              backgroundColor: "transparent",
              border: "1px solid #ef4444",
              color: "#ef4444",
              borderRadius: "8px",
              padding: "8px 16px",
              fontSize: "0.875rem",
              fontWeight: "600",
              cursor: "pointer",
              transition: "all 0.2s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "#ef4444";
              e.currentTarget.style.color = "#fff";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
              e.currentTarget.style.color = "#ef4444";
            }}
          >
            🗑️ Cancel & Delete Booking
          </button>
          <button className="btn-secondary" onClick={onClose}>
            Back to Front Office Grid
          </button>
        </div>
      </div>
    </div>
  );
}
