"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";

// Utility formatting functions
function formatCurrency(val: number): string {
  return `₹${val.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function amountInWords(amount: number): string {
  const a = ["","One ","Two ","Three ","Four ","Five ","Six ","Seven ","Eight ","Nine ","Ten ","Eleven ","Twelve ","Thirteen ","Fourteen ","Fifteen ","Sixteen ","Seventeen ","Eighteen ","Nineteen "];
  const b = ["","","Twenty","Thirty","Forty","Fifty","Sixty","Seventy","Eighty","Ninety"];
  const convert = (n: number): string => {
    if (n < 20) return a[n];
    if (n < 100) return b[Math.floor(n / 10)] + (n % 10 !== 0 ? " " + a[n % 10] : "");
    if (n < 1000) return a[Math.floor(n / 100)] + "Hundred " + (n % 100 !== 0 ? "and " + convert(n % 100) : "");
    if (n < 100000) return convert(Math.floor(n / 1000)) + "Thousand " + (n % 1000 !== 0 ? convert(n % 1000) : "");
    if (n < 10000000) return convert(Math.floor(n / 100000)) + "Lakh " + (n % 100000 !== 0 ? convert(n % 100000) : "");
    return convert(Math.floor(n / 10000000)) + "Crore " + (n % 10000000 !== 0 ? convert(n % 10000000) : "");
  };
  const whole = Math.floor(amount);
  if (whole === 0) return "Zero Rupees Only";
  return "Rupees " + convert(whole).trim() + " Only";
}

function getSacCode(category: string, name: string): string {
  const n = name.toLowerCase();
  const c = category.toLowerCase();
  if (c === "room" || n.includes("tariff") || n.includes("room rate") || n.includes("accommodation")) return "996311";
  if (n.includes("food") || n.includes("breakfast") || n.includes("dinner") || n.includes("lunch") || n.includes("f&b") || n.includes("room service")) return "996331";
  if (c === "amenity" || n.includes("spa") || n.includes("massage")) return "999721";
  if (c === "laundry" || n.includes("laundry") || n.includes("iron")) return "999719";
  if (n.includes("pickup") || n.includes("drop") || n.includes("transfer") || n.includes("cab") || n.includes("taxi")) return "996412";
  if (n.includes("tour") || n.includes("guide")) return "998552";
  return "999999";
}

function getGstRate(category: string, amount: number): number {
  if (category === "room") {
    return amount > 7500 ? 0.18 : 0.05;
  }
  return 0.05; // 5% for F&B, spa, services, etc.
}

function indexToDate(idx: number): string {
  const base = new Date("2026-05-20");
  base.setDate(base.getDate() + idx);
  return base.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export default function InvoicePage() {
  const { id } = useParams();
  const searchParams = useSearchParams();
  const summarizeFood = searchParams.get('summarizeFood') === 'true';
  const queryGuestState = searchParams.get('guestState') || "Delhi";

  const [reservation, setReservation] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    const fetchReservation = async () => {
      try {
        const res = await fetch(`/api/reservations/${id}`);
        const data = await res.json();
        if (data.success) {
          setReservation(data.reservation);
        }
      } catch (err) {
        console.error("Failed to fetch reservation:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchReservation();
  }, [id]);

  if (loading) return <div style={{ padding: "40px", textAlign: "center" }}>Loading Invoice...</div>;
  if (!reservation) return <div style={{ padding: "40px", textAlign: "center", color: "red" }}>Reservation not found.</div>;

  let itemsToProcess = [...(reservation.billingItems || [])];
  if (summarizeFood) {
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
        reservationId: reservation.id
      });
    }
  }

  const isInclusive = reservation.details?.includes("[GST:inclusive]") ?? false;
  let subtotal = 0, totalCgst = 0, totalSgst = 0, totalRoundingAdj = 0, grandTotal = 0;
  let tariff = 0, maxRate = 0;

  itemsToProcess.forEach((item) => {
    const rate = getGstRate(item.category, item.amount);
    if (item.category === "room") tariff = item.amount;
    if (rate > maxRate) maxRate = rate;

    let baseAmount = item.amount;
    let cgst = 0;
    let sgst = 0;
    let roundingAdj = 0;

    if (isInclusive) {
      baseAmount = item.amount / (1 + rate);
      const halfRateAmount = baseAmount * (rate / 2);
      cgst = halfRateAmount;
      sgst = halfRateAmount;
      const sumCheck = baseAmount + cgst + sgst;
      roundingAdj = item.amount - sumCheck;
    } else {
      const halfRateAmount = baseAmount * (rate / 2);
      cgst = halfRateAmount;
      sgst = halfRateAmount;
    }

    subtotal += baseAmount;
    totalCgst += cgst;
    totalSgst += sgst;
    totalRoundingAdj += roundingAdj;
    grandTotal += (isInclusive ? item.amount : (baseAmount + cgst + sgst));
  });

  const roundedSubtotal = Math.round(subtotal * 100) / 100;
  const roundedCgst = Math.round(totalCgst * 100) / 100;
  const roundedSgst = Math.round(totalSgst * 100) / 100;
  const roundedTotalGst = roundedCgst + roundedSgst;
  const roundedRoundingAdj = Math.round(totalRoundingAdj * 100) / 100;
  const roundedTotal = Math.round(grandTotal * 100) / 100;

  const bill = { subtotal: roundedSubtotal, tariff, gstRate: maxRate, gstAmt: roundedTotalGst, cgst: roundedCgst, sgst: roundedSgst, roundingAdj: roundedRoundingAdj, total: roundedTotal };

  const PROPERTY_STATE = "Delhi";
  const PROPERTY_STATE_CODE = "07";
  const STATE_CODES: Record<string, string> = { "07": "Delhi" }; // Simplified for render
  
  let finalGuestState = queryGuestState;
  let isIntrastate = true;
  if (reservation.billingType === "corporate" && reservation.guestGstNumber && reservation.guestGstNumber.length === 15) {
    const code = reservation.guestGstNumber.substring(0, 2);
    finalGuestState = STATE_CODES[code] || "Unknown State";
    isIntrastate = code === PROPERTY_STATE_CODE;
  } else {
    isIntrastate = finalGuestState === PROPERTY_STATE;
  }

  const now = new Date();
  const fy = now.getMonth() > 2 ? `${now.getFullYear().toString().slice(-2)}-${(now.getFullYear()+1).toString().slice(-2)}` : `${(now.getFullYear()-1).toString().slice(-2)}-${now.getFullYear().toString().slice(-2)}`;
  const invoiceNo = `ATH/${fy}/${reservation.id.substring(0,4).toUpperCase()}`;
  const halfRate = (bill.gstRate * 50).toFixed(1).replace(/\.0$/, '');
  const fullRate = (bill.gstRate * 100).toFixed(1).replace(/\.0$/, '');
  const words = amountInWords(bill.total);

  const room = reservation.room;
  const activeProperty = room?.property;

  return (
    <>
      <style dangerouslySetInnerHTML={{__html: `
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        body{font-family:'Inter',Arial,sans-serif;color:#111;background:#fff;padding:40px;font-size:13px;line-height:1.5}
        @media print{
          body{padding:20px}
          .no-print{display:none}
          @page{margin:15mm;size:A4}
        }
        .inv-header{display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:20px;border-bottom:2.5px solid #111;margin-bottom:20px}
        .inv-logo{font-size:22px;font-weight:700;letter-spacing:-0.5px;color:#111}
        .inv-logo span{color:#4f46e5}
        .inv-tagline{font-size:10px;color:#666;margin-top:2px;letter-spacing:0.04em;text-transform:uppercase}
        .inv-meta{text-align:right}
        .inv-meta h2{font-size:18px;font-weight:700;color:#111;letter-spacing:0.02em;text-transform:uppercase}
        .inv-meta p{font-size:11px;color:#555;margin-top:3px}
        .inv-meta .inv-no{font-size:12px;font-weight:600;color:#4f46e5;margin-top:4px}
        .tax-badge{display:inline-block;padding:3px 10px;border-radius:20px;font-size:10px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;margin-top:6px}
        .intrastate{background:#dcfce7;color:#166534;border:1px solid #bbf7d0}
        .interstate{background:#fef3c7;color:#92400e;border:1px solid #fde68a}
        .info-grid{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin:20px 0;padding:16px;background:#f9fafb;border-radius:6px;border:1px solid #e5e7eb}
        .info-block label{display:block;font-size:10px;text-transform:uppercase;letter-spacing:0.06em;color:#9ca3af;margin-bottom:3px;font-weight:600}
        .info-block p{font-size:13px;color:#111;font-weight:500}
        .info-block p.mono{font-family:monospace;font-size:12px;color:#374151}
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
        .words-block{margin:14px 0;padding:12px 16px;background:#f0f9ff;border-left:4px solid #0ea5e9;border-radius:0 6px 6px 0}
        .words-label{font-size:10px;text-transform:uppercase;letter-spacing:0.06em;color:#0369a1;font-weight:700;margin-bottom:4px}
        .words-text{font-size:13px;color:#0c4a6e;font-weight:600;font-style:italic}
        .payment-row{display:flex;align-items:center;justify-content:space-between;margin:20px 0 0}
        .stamp{display:inline-block;border:2.5px solid #16a34a;color:#16a34a;padding:6px 18px;border-radius:4px;font-weight:700;font-size:13px;transform:rotate(-4deg);letter-spacing:0.06em}
        .sig-block{text-align:right;font-size:11px;color:#555}
        .sig-block p{margin-top:28px;border-top:1px solid #ccc;padding-top:6px;display:inline-block;min-width:120px}
        .footer{margin-top:28px;padding-top:14px;border-top:1px dashed #d1d5db;text-align:center;font-size:10px;color:#9ca3af;letter-spacing:0.04em}
        .gst-notice{font-size:10px;color:#6b7280;margin-top:8px;text-align:left}
      `}} />

      {/* Action Bar */}
      <div className="no-print" style={{ marginBottom: "20px" }}>
        <button onClick={() => window.print()} style={{ background: "#4f46e5", color: "#fff", border: "none", padding: "10px 24px", borderRadius: "6px", fontSize: "13px", fontWeight: 600, cursor: "pointer", letterSpacing: "0.03em" }}>🖨 Print Invoice</button>
      </div>

      <div className="inv-header">
        <div style={{ flex: 1 }}>
          <div className="inv-logo">{activeProperty?.name || "Aether"}<span>HMS</span></div>
          <div className="inv-tagline" style={{ fontWeight: 700, color: "#111", marginTop: "4px" }}>{activeProperty?.name || "Aether Hotel Management Pvt. Ltd."}</div>
          <div className="inv-tagline" style={{ marginTop: "2px", maxWidth: "250px" }}>{activeProperty?.location || "123, Hospitality Avenue, Sector 4, New Delhi - 110001, India"}</div>
          <div className="inv-tagline" style={{ marginTop: "4px", fontWeight: 600, color: "#4f46e5" }}>Property GSTIN: {activeProperty?.gstNumber || "N/A"} · State: {PROPERTY_STATE} (Code: 07)</div>
        </div>
        <div className="inv-meta" style={{ flex: 1, textAlign: "right" }}>
          <h2 style={{ fontSize: "24px", color: "#111", borderBottom: "2px solid #111", display: "inline-block", paddingBottom: "4px", marginBottom: "8px" }}>TAX INVOICE</h2>
          <p className="inv-no">Invoice No: {invoiceNo}</p>
          <p>Date of Issue: {now.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
          <p>Time: {now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</p>
          <div className={`tax-badge ${isIntrastate ? 'intrastate' : 'interstate'}`}>{isIntrastate ? '✓ Intrastate — CGST + SGST' : '⚡ Inter-State — IGST Applicable'}</div>
        </div>
      </div>

      <div className="info-grid">
        <div>
          <div className="info-block" style={{ marginBottom: "10px" }}>
            <label style={{ color: "#4f46e5" }}>Billed To (Guest Details)</label>
            <p style={{ fontSize: "15px", fontWeight: 700 }}>{reservation.guestName}</p>
            {reservation.groupName && <p style={{ fontSize: "12px", fontWeight: 600, marginTop: "2px" }}>{reservation.groupName}</p>}
            {reservation.guestGstNumber && <p style={{ fontSize: "11px", color: "#4f46e5", marginTop: "1px", fontWeight: 600 }}>GSTIN: {reservation.guestGstNumber}</p>}
          </div>
          <div className="info-block" style={{ marginBottom: "10px" }}>
            <label>Guest State</label>
            <p>{finalGuestState}</p>
          </div>
          {reservation.phone && <div className="info-block"><label>Mobile</label><p className="mono">{reservation.phone}</p></div>}
          {reservation.email && <div className="info-block" style={{ marginTop: "8px" }}><label>Email</label><p className="mono">{reservation.email}</p></div>}
          {reservation.nationality === 'Foreign' && reservation.passportNumber && <div className="info-block" style={{ marginTop: "8px" }}><label>Passport No.</label><p className="mono">{reservation.passportNumber}</p></div>}
        </div>
        <div>
          <div className="info-block" style={{ marginBottom: "10px" }}>
            <label>Room</label>
            <p style={{ fontWeight: 700 }}>{room ? `Room ${room.number} — ${room.name}` : 'N/A'}</p>
            <p style={{ fontSize: "11px", color: "#6b7280", marginTop: "2px" }}>{room?.type || ''}</p>
          </div>
          <div className="info-block" style={{ marginBottom: "10px" }}>
            <label>Check-In</label>
            <p>{indexToDate(reservation.startIndex)}</p>
          </div>
          <div className="info-block" style={{ marginBottom: "10px" }}>
            <label>Check-Out</label>
            <p>{now.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
          </div>
          <div className="info-block">
            <label>Stay Duration</label>
            <p>{reservation.duration} Night{reservation.duration !== 1 ? 's' : ''} · {reservation.numAdults || 1} Guest{(reservation.numAdults || 1) > 1 ? 's' : ''}</p>
          </div>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th style={{ width: "30%" }}>Description</th>
            <th style={{ textAlign: "center", width: "10%" }}>SAC / HSN</th>
            <th style={{ textAlign: "center", width: "12%" }}>Category</th>
            <th style={{ textAlign: "right", width: "14%" }}>Amount (₹)</th>
            {isIntrastate ? (
              <>
                <th style={{ textAlign: "center" }}>CGST Rate</th>
                <th style={{ textAlign: "center" }}>SGST Rate</th>
              </>
            ) : (
              <th style={{ textAlign: "center" }}>IGST Rate</th>
            )}
          </tr>
        </thead>
        <tbody>
          {itemsToProcess.map((item) => {
            const sac = getSacCode(item.category, item.name);
            const itemGstRate = getGstRate(item.category, item.amount);
            const itemHalf = (itemGstRate * 50).toFixed(1).replace(/\.0$/, '');
            const itemFull = (itemGstRate * 100).toFixed(1).replace(/\.0$/, '');
            const baseAmount = isInclusive ? (item.amount / (1 + itemGstRate)) : item.amount;
            
            return (
              <tr key={item.id}>
                <td>{item.name}</td>
                <td style={{ textAlign: "center", color: "#555", fontSize: "11px" }}>{sac}</td>
                <td style={{ textAlign: "center", fontSize: "11px", color: "#555" }}>{item.category.toUpperCase()}</td>
                <td style={{ textAlign: "right" }}>{formatCurrency(baseAmount)}</td>
                {isIntrastate ? (
                  <>
                    <td style={{ textAlign: "center", fontSize: "11px" }}>{itemGstRate > 0 ? itemHalf + '%' : '—'}</td>
                    <td style={{ textAlign: "center", fontSize: "11px" }}>{itemGstRate > 0 ? itemHalf + '%' : '—'}</td>
                  </>
                ) : (
                  <td style={{ textAlign: "center", fontSize: "11px" }}>{itemGstRate > 0 ? itemFull + '%' : '—'}</td>
                )}
              </tr>
            );
          })}
          
          <tr className="subtotal-row">
            <td colSpan={3} style={{ textAlign: "right" }}>Taxable Subtotal</td>
            <td style={{ textAlign: "right" }}>{formatCurrency(bill.subtotal)}</td>
            <td colSpan={isIntrastate ? 2 : 1} style={{ textAlign: "center", fontSize: "11px", color: "#6b7280" }}>—</td>
          </tr>
          
          {bill.gstRate > 0 && (
            isIntrastate ? (
              <>
                <tr className="gst-row"><td colSpan={4} style={{ textAlign: "right" }}>CGST @ {halfRate}%</td><td colSpan={2} style={{ textAlign: "right", paddingRight: "8px" }}>{formatCurrency(bill.cgst)}</td></tr>
                <tr className="gst-row"><td colSpan={4} style={{ textAlign: "right" }}>SGST @ {halfRate}%</td><td colSpan={2} style={{ textAlign: "right", paddingRight: "8px" }}>{formatCurrency(bill.sgst)}</td></tr>
                {bill.roundingAdj !== 0 && <tr className="gst-row"><td colSpan={4} style={{ textAlign: "right", fontStyle: "italic", color: "#b45309" }}>Rounding Adjustment (Sec.170 CGST Act)</td><td colSpan={2} style={{ textAlign: "right", paddingRight: "8px", color: "#b45309" }}>{bill.roundingAdj > 0 ? '+' : ''}{formatCurrency(bill.roundingAdj)}</td></tr>}
              </>
            ) : (
              <>
                <tr className="gst-row"><td colSpan={4} style={{ textAlign: "right" }}>IGST @ {fullRate}%</td><td colSpan={1} style={{ textAlign: "right", paddingRight: "8px" }}>{formatCurrency(bill.gstAmt)}</td></tr>
                {bill.roundingAdj !== 0 && <tr className="gst-row"><td colSpan={4} style={{ textAlign: "right", fontStyle: "italic", color: "#b45309" }}>Rounding Adjustment (Sec.170 CGST Act)</td><td colSpan={1} style={{ textAlign: "right", paddingRight: "8px", color: "#b45309" }}>{bill.roundingAdj > 0 ? '+' : ''}{formatCurrency(bill.roundingAdj)}</td></tr>}
              </>
            )
          )}
          
          <tr className="total-row">
            <td colSpan={isIntrastate ? 5 : 4} style={{ textAlign: "right" }}>Grand Total (Incl. GST)</td>
            <td style={{ textAlign: "right" }}>{formatCurrency(bill.total)}</td>
          </tr>
        </tbody>
      </table>

      <div className="words-block">
        <div className="words-label">Amount in Words</div>
        <div className="words-text">{words}</div>
      </div>

      <div className="payment-row">
        <div>
          <div style={{ fontSize: "11px", color: "#555", marginBottom: "6px" }}><strong>Payment Method:</strong> {reservation.paymentMethod || 'CASH'}</div>
          <div className="stamp" style={{ marginBottom: "12px" }}>PAYMENT RECEIVED</div>
          
          <div style={{ marginTop: "16px", borderTop: "1px solid #e5e7eb", paddingTop: "10px" }}>
            <div style={{ fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.06em", color: "#6b7280", fontWeight: 700, marginBottom: "4px" }}>Payment Settlement Channels</div>
            <table style={{ width: "auto", margin: 0, fontSize: "11px", borderCollapse: "collapse", border: "none" }}>
              <tbody style={{ border: "none" }}>
                <tr style={{ border: "none", background: "transparent" }}><td style={{ padding: "2px 8px 2px 0", border: "none", color: "#555" }}>Bank Name:</td><td style={{ padding: "2px 0", border: "none", fontWeight: 600 }}>_____________________</td></tr>
                <tr style={{ border: "none", background: "transparent" }}><td style={{ padding: "2px 8px 2px 0", border: "none", color: "#555" }}>Account No:</td><td style={{ padding: "2px 0", border: "none", fontFamily: "monospace", fontWeight: 600 }}>_____________________</td></tr>
                <tr style={{ border: "none", background: "transparent" }}><td style={{ padding: "2px 8px 2px 0", border: "none", color: "#555" }}>IFSC Code:</td><td style={{ padding: "2px 0", border: "none", fontFamily: "monospace", fontWeight: 600 }}>_____________________</td></tr>
                <tr style={{ border: "none", background: "transparent" }}><td style={{ padding: "2px 8px 2px 0", border: "none", color: "#555" }}>UPI ID:</td><td style={{ padding: "2px 0", border: "none", fontWeight: 600 }}>_____________________</td></tr>
              </tbody>
            </table>
          </div>
        </div>
        <div className="sig-block" style={{ alignSelf: "flex-end" }}>
          <div style={{ height: "60px" }}></div>
          <p>Authorised Signatory</p>
        </div>
      </div>

      <div className="gst-notice">
        <strong>Note:</strong> {isIntrastate
          ? `This is an intrastate supply. CGST @ ${halfRate}% and SGST @ ${halfRate}% apply under CGST Act, 2017 and ${finalGuestState} GST Act, 2017.`
          : `This is an inter-state supply from ${PROPERTY_STATE} to ${finalGuestState}. IGST @ ${fullRate}% applies under IGST Act, 2017.`
        }
        SAC Code 996311 — Accommodation Services per Schedule II, CGST Act.
      </div>

      <div className="footer">
        AetherHMS · This is a computer-generated invoice and does not require a physical signature. · Generated: {now.toLocaleString('en-IN')}
      </div>
    </>
  );
}
