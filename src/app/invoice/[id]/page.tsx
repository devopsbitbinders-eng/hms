"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";

export default function InvoicePage() {
  const { id } = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const invoiceType = searchParams.get('type'); // "A" or "B"
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

  const summarizeFood = searchParams.get('summarizeFood') === 'true';

  // Filter items if invoiceType is provided (for split billing)
  let items = invoiceType
    ? (reservation.billingItems?.filter((item: any) =>
      invoiceType === "B"
        ? item.invoiceGroup === "B"
        : (item.invoiceGroup === "A" || !item.invoiceGroup)
    ) || [])
    : (reservation.billingItems || []);

  let originalFoodItems: any[] = [];
  const foodItems = items.filter((i: any) => i.category === "food");
  if (summarizeFood) {
    originalFoodItems = [...foodItems];
    if (foodItems.length > 0) {
      items = items.filter((i: any) => i.category !== "food");
      const totalFood = foodItems.reduce((acc: number, curr: any) => acc + curr.amount, 0);
      items.push({
        id: "summary-food",
        name: "Room Service Food & Beverage",
        amount: totalFood,
        category: "food",
        invoiceGroup: invoiceType || "A"
      });
    }
  }

  // Formatting helpers
  const bookingDate = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ /g, '-');

  // Calculate Base Date based on our pseudo logic (2026-05-20 + startIndex days)
  const baseEpoch = new Date("2026-05-20").setHours(0, 0, 0, 0);
  const checkInDateObj = new Date(baseEpoch + (reservation.startIndex * 86400000));
  const checkOutDateObj = new Date(baseEpoch + ((reservation.startIndex + reservation.duration) * 86400000));

  const checkInStr = checkInDateObj.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ /g, '-');
  const checkOutStr = checkOutDateObj.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ /g, '-');

  // GST Calculation Logic matching SplitBillingModal
  const parseGstMode = (detailsStr?: string | null): "exclusive" | "inclusive" => {
    if (detailsStr && detailsStr.includes("[GST:inclusive]")) return "inclusive";
    return "exclusive";
  };
  const gstMode = parseGstMode(reservation.details);

  const calculateGST = (item: any) => {
    let rate = 0;
    if (item.category === "room") {
      rate = item.amount > 7500 ? 0.18 : 0.05;
    } else {
      rate = 0.05; // F&B or others
    }

    if (gstMode === "inclusive") {
      const lockedTotal = Math.round(item.amount * 100) / 100;
      const baseAmount = Math.round((lockedTotal / (1 + rate)) * 100) / 100;
      const cgst = Math.round(baseAmount * (rate / 2) * 100) / 100;
      const sgst = cgst;
      const sumCheck = Number((baseAmount + cgst + sgst).toFixed(2));
      const roundingAdj = Number((lockedTotal - sumCheck).toFixed(2));
      return { rate: rate * 100, baseAmount, cgst, sgst, roundingAdj, total: lockedTotal };
    } else {
      const baseAmount = Math.round(item.amount * 100) / 100;
      const cgst = Math.round(baseAmount * (rate / 2) * 100) / 100;
      const sgst = cgst;
      const total = Number((baseAmount + cgst + sgst).toFixed(2));
      return { rate: rate * 100, baseAmount, cgst, sgst, roundingAdj: 0, total };
    }
  };

  let netCost = 0, cgst = 0, sgst = 0, totalAmount = 0;
  items.forEach((item: any) => {
    const t = calculateGST(item);
    netCost += t.baseAmount;
    cgst += t.cgst;
    sgst += t.sgst;
    totalAmount += t.total;
  });

  netCost = Math.round(netCost);
  cgst = Math.round(cgst);
  sgst = Math.round(sgst);
  const totalGst = cgst + sgst;
  totalAmount = Math.round(totalAmount);

  // Extract meal plan from billing items if present
  const roomTariffItem = items.find((i: any) => i.name.includes("Room Tariff"));
  let mealPlan = "Room Only";
  if (roomTariffItem) {
    if (roomTariffItem.name.includes("CP")) mealPlan = "Room + Breakfast";
    else if (roomTariffItem.name.includes("MAP")) mealPlan = "Room + Breakfast + 1 Meal";
    else if (roomTariffItem.name.includes("AP")) mealPlan = "Room + All Meals";
  }

  const printDocument = () => {
    window.print();
  };

  return (
    <>
      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 10mm; }
          body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; background: white !important; }
          .no-print { display: none !important; }
          .invoice-container { margin: 0 !important; border: none !important; padding: 0 !important; box-shadow: none !important; }
        }
        html, body { overflow: auto !important; height: auto !important; background: #f3f4f6 !important; color: #000 !important; font-family: Arial, sans-serif; font-size: 11px; margin: 0; padding: 0; }
        .invoice-container { max-width: 900px; margin: 80px auto 40px auto; padding: 30px; box-sizing: border-box; background: white; border: 1px solid #ddd; box-shadow: 0 4px 6px rgba(0,0,0,0.1); border-radius: 8px; }
        .header { display: flex; justify-content: space-between; border-bottom: 1px solid #ddd; padding-bottom: 10px; margin-bottom: 20px; }
        .logo-area { display: flex; align-items: center; gap: 10px; font-weight: bold; font-size: 16px; }
        .booking-meta { text-align: right; line-height: 1.4; }
        
        .intro-text { margin-bottom: 20px; line-height: 1.5; }
        
        .grid-tables { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px; }
        
        table { width: 100%; border-collapse: collapse; border: 1px solid #ccc; font-size: 11px; }
        th, td { border: 1px solid #ccc; padding: 6px 10px; text-align: left; }
        th { font-weight: bold; text-align: center; background: #f9f9f9; }
        
        .summary-table { margin-bottom: 20px; }
        .summary-table td.right-align { text-align: right; }
        .summary-table td.bold { font-weight: bold; }
        
        .policy { margin-bottom: 30px; }
        .policy h4 { margin: 0 0 5px 0; font-size: 12px; }
        .policy ul { margin: 0 0 10px 0; padding-left: 20px; }
        
        .footer { display: flex; justify-content: space-between; align-items: flex-end; font-size: 10px; line-height: 1.4; border-top: 1px solid #ccc; padding-top: 20px; }
        .footer a { color: #0066cc; text-decoration: none; }
        
        .powered-by { text-align: center; font-size: 10px; margin-top: 20px; border-top: 1px solid #eee; padding-top: 10px; }
        
        .floating-action-bar { position: fixed; top: 0; left: 0; right: 0; background: #1e293b; padding: 12px 24px; display: flex; justify-content: space-between; align-items: center; z-index: 1000; box-shadow: 0 2px 10px rgba(0,0,0,0.2); }
      `}</style>

      <div className="no-print floating-action-bar">
        <span style={{ color: "white", fontSize: "14px", fontWeight: "bold" }}>Invoice / Voucher View</span>
        <div style={{ display: "flex", gap: "12px" }}>
          <button onClick={printDocument} style={{ padding: "8px 16px", cursor: "pointer", background: "#4f46e5", color: "white", border: "none", borderRadius: "4px", fontWeight: "bold" }}>🖨️ Print Voucher</button>
        </div>
      </div>

      <div className="invoice-container">
        <div className="header">
          <div className="logo-area">
            <img src="/hotel-logo.png" alt="Hotel Logo" style={{ height: "30px", width: "auto" }} onError={(e) => { e.currentTarget.style.display = 'none'; }} />
            <span>{reservation.room?.property?.name || "Aether HMS"}</span>
          </div>
          <div className="booking-meta">
            <div style={{ fontWeight: "bold", fontSize: "12px", marginBottom: "4px", color: invoiceType ? '#4f46e5' : 'inherit' }}>
              {invoiceType ? `TAX INVOICE ${invoiceType}` : 'TAX INVOICE'}
            </div>
            <div>Booking Date - {bookingDate}</div>
            <div>Booking ID - FDR{reservation.id.substring(0, 15).toUpperCase()}</div>
            <div>Booking Source - Direct</div>
            <div>Source Type - By Phone</div>
          </div>
        </div>

        <div className="intro-text">
          <p>Dear {reservation.guestName || "Guest"},</p>
          <p>We are pleased to provide your invoice. We would like to thank you for choosing {reservation.room?.property?.name || "Aether HMS"} for your visit to our hotel. We look forward to host you in the future.</p>
        </div>

        <div className="grid-tables">
          <div>
            <table>
              <thead>
                <tr>
                  <th colSpan={2}>Guest Details</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ width: "35%" }}>Guest Name</td>
                  <td>{reservation.guestName}</td>
                </tr>
                <tr>
                  <td>Guest Email</td>
                  <td><a href={"mailto:" + reservation.email} style={{ color: "#0066cc", textDecoration: "underline" }}>{reservation.email || "N/A"}</a></td>
                </tr>
                <tr>
                  <td>Guest Mobile</td>
                  <td>{reservation.phone || "N/A"}</td>
                </tr>
                <tr>
                  <td>Special Note</td>
                  <td>{reservation.specialRequests || ""}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div>
            <table>
              <thead>
                <tr>
                  <th colSpan={2}>Booking Details</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ width: "35%" }}>Check In Date</td>
                  <td>{checkInStr}</td>
                </tr>
                <tr>
                  <td>Check Out Date</td>
                  <td>{checkOutStr}</td>
                </tr>
                <tr>
                  <td>Number Of Nights</td>
                  <td>{reservation.duration}</td>
                </tr>
                <tr>
                  <td>Number Of Rooms</td>
                  <td>1</td>
                </tr>
                <tr>
                  <td>Total Amount</td>
                  <td>{totalAmount}</td>
                </tr>
                <tr>
                  <td>Payment Reference</td>
                  <td>{reservation.paymentMethod || "Direct"}</td>
                </tr>
                <tr>
                  <td>Created By</td>
                  <td>{reservation.room?.property?.name || "System"}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="summary-table">
          <table>
            <thead>
              <tr>
                <th colSpan={5}>Booking Summary</th>
              </tr>
              <tr>
                <th style={{ width: "5%" }}>SR No</th>
                <th style={{ width: "45%" }}>Description</th>
                <th style={{ width: "20%" }}>Category</th>
                <th style={{ width: "15%" }}>Amount</th>
                <th style={{ width: "15%" }}>GST</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item: any, idx: number) => {
                const t = calculateGST(item);
                const gstText = t.total - t.baseAmount > 0 ? (t.total - t.baseAmount).toFixed(2) : "0.00";
                const displayName = item.name.split(" | Qty:")[0];
                return (
                  <tr key={item.id || idx}>
                    <td>{idx + 1}</td>
                    <td>{displayName}</td>
                    <td>{item.category.toUpperCase()}</td>
                    <td>{t.baseAmount.toFixed(2)}</td>
                    <td>{gstText}</td>
                  </tr>
                );
              })}
              <tr>
                <td colSpan={4} className="bold">Net Cost</td>
                <td className="right-align">{netCost} /-</td>
              </tr>
              <tr>
                <td colSpan={4} className="bold" style={{ color: "#ef4444" }}>
                  Total GST Amount <span style={{ fontWeight: "normal" }}>(SGST: {sgst}) | (CGST: {cgst})</span>
                </td>
                <td className="right-align">{totalGst} /-</td>
              </tr>
              <tr>
                <td colSpan={4} className="bold">Grand Total</td>
                <td className="right-align">{totalAmount} /-</td>
              </tr>
              <tr>
                <td colSpan={4} className="bold">Paid Amount</td>
                <td className="right-align">{totalAmount} /-</td>
              </tr>
            </tbody>
          </table>
        </div>

        {summarizeFood && originalFoodItems.length > 0 && (
          <div className="summary-table" style={{ marginTop: "30px" }}>
            <table>
              <thead>
                <tr>
                  <th colSpan={5}>Room Service & Kitchen Details</th>
                </tr>
                <tr>
                  <th style={{ width: "5%" }}>SR No</th>
                  <th style={{ width: "35%" }}>Item Description</th>
                  <th style={{ width: "15%" }}>Category</th>
                  <th style={{ width: "10%", textAlign: "center" }}>Qty</th>
                  <th style={{ width: "10%", textAlign: "right" }}>Price</th>
                  <th style={{ width: "10%", textAlign: "right" }}>Amount</th>
                  <th style={{ width: "15%", textAlign: "right" }}>Total (Incl GST)</th>
                </tr>
              </thead>
              <tbody>
                {originalFoodItems.map((fItem, idx) => {
                  let fName = fItem.name;
                  let qty = 1;
                  let unitPrice = fItem.amount;
                  if (fItem.name.includes(" | Qty: ")) {
                     const parts = fItem.name.split(" | ");
                     fName = parts[0];
                     qty = parseInt(parts[1].replace("Qty: ", "")) || 1;
                     unitPrice = parseFloat(parts[2].replace("Unit: ", "")) || fItem.amount;
                  }
                  
                  const t = calculateGST(fItem);
                  return (
                    <tr key={fItem.id || idx}>
                      <td>{idx + 1}</td>
                      <td>{fName}</td>
                      <td>{fItem.category.toUpperCase()}</td>
                      <td style={{ textAlign: "center" }}>{qty}</td>
                      <td style={{ textAlign: "right" }}>{unitPrice.toFixed(2)}</td>
                      <td style={{ textAlign: "right" }}>{t.baseAmount.toFixed(2)}</td>
                      <td style={{ textAlign: "right" }}>{t.total.toFixed(2)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="policy">
          <h4>Cancellation Policy</h4>
          <ul>
            <li>Non Refundable</li>
          </ul>
          <p style={{ fontWeight: "bold", fontSize: "11px" }}>Please provide Govt. Approved Photo Identity Card of All Adult person at the time of check in. This is computer generated reservation and does not require any signature.</p>
        </div>

        <div className="footer">
          <div>
            Thanks & Regards<br />
            Reservation Manager<br />
            <strong>Add:</strong> {reservation.room?.property?.name || "Aether HMS"}, {reservation.room?.property?.location || "123, Hospitality Avenue, New Delhi"}<br />
            <em>For Any Clarification Contact:</em><br />
            Email: <a href={`mailto:contact@${(reservation.room?.property?.name || "aetherhms").replace(/\s+/g, '').toLowerCase()}.com`}>contact@{(reservation.room?.property?.name || "aetherhms").replace(/\s+/g, '').toLowerCase()}.com</a><br />
            GST Number: {reservation.room?.property?.gstNumber || "Not Provided"}<br /><br />
            Currency: Rupee
          </div>
          <div style={{ color: "#ef4444", fontWeight: "bold", textAlign: "right" }}>
            Check In Time: {reservation.checkInTime ? (reservation.checkInTime.includes("T") ? new Date(reservation.checkInTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false }) + ' Hrs' : reservation.checkInTime) : "12:00 Hrs"}<br />
            Check Out Time: {reservation.checkOutTime ? (reservation.checkOutTime.includes("T") ? new Date(reservation.checkOutTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false }) + ' Hrs' : reservation.checkOutTime) : "10:00 Hrs"}
          </div>
        </div>

        <div className="powered-by">
          Reservation Is Powered By <a href="#" style={{ color: "#0066cc", fontWeight: "bold", textDecoration: "underline" }}>Aether HMS</a>
        </div>
      </div>
    </>
  );
}
