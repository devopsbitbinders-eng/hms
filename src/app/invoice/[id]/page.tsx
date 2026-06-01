"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

export default function InvoicePage() {
  const { id } = useParams();
  const router = useRouter();
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

  // Formatting helpers
  const bookingDate = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ /g, '-');
  
  // Calculate Base Date based on our pseudo logic (2026-05-20 + startIndex days)
  const baseEpoch = new Date("2026-05-20").setHours(0,0,0,0);
  const checkInDateObj = new Date(baseEpoch + (reservation.startIndex * 86400000));
  const checkOutDateObj = new Date(baseEpoch + ((reservation.startIndex + reservation.duration) * 86400000));
  
  const checkInStr = checkInDateObj.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ /g, '-');
  const checkOutStr = checkOutDateObj.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ /g, '-');
  
  // Totals calculation
  const totalAmount = reservation.billingItems?.reduce((sum: number, item: any) => sum + item.amount, 0) || 0;
  
  // Calculate pseudo GST (Assuming 12% total, so 6% SGST, 6% CGST for reverse calculation - or 18% depending on amount)
  const gstRate = totalAmount > 7500 ? 0.18 : 0.12;
  const netCost = Math.round(totalAmount / (1 + gstRate));
  const totalGst = totalAmount - netCost;
  const sgst = Math.round(totalGst / 2);
  const cgst = totalGst - sgst;

  // Extract meal plan from billing items if present
  const roomTariffItem = reservation.billingItems?.find((i: any) => i.name.includes("Room Tariff"));
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
          body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          .no-print { display: none !important; }
        }
        body { background: #fff !important; color: #000 !important; font-family: Arial, sans-serif; font-size: 11px; margin: 0; padding: 0; }
        .invoice-container { max-width: 900px; margin: 20px auto; padding: 20px; box-sizing: border-box; background: white; border: 1px solid #ddd; }
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
      `}</style>

      <div className="invoice-container">
        <div className="no-print" style={{ marginBottom: "20px", display: "flex", gap: "10px" }}>
          <button onClick={() => router.back()} style={{ padding: "8px 16px", cursor: "pointer" }}>Back to Dashboard</button>
          <button onClick={printDocument} style={{ padding: "8px 16px", cursor: "pointer", background: "#4f46e5", color: "white", border: "none" }}>Print Voucher</button>
        </div>

        <div className="header">
          <div className="logo-area">
            <img src="/hotel-logo.png" alt="Hotel Logo" style={{ height: "30px", width: "auto" }} onError={(e) => { e.currentTarget.style.display='none'; }} />
            <span>The Amore Hills</span>
          </div>
          <div className="booking-meta">
            <div style={{ fontWeight: "bold", fontSize: "12px", marginBottom: "4px" }}>
              {reservation.status === 'confirmed' || reservation.status === 'checked-in' ? 'Booking Confirmed' : 'Booking Cancelled'}
            </div>
            <div>Booking Date - {bookingDate}</div>
            <div>Booking ID - FDR{reservation.id.substring(0, 15).toUpperCase()}</div>
            <div>Booking Source - Direct</div>
            <div>Source Type - By Phone</div>
          </div>
        </div>

        <div className="intro-text">
          <p>Dear {reservation.guestName || "Guest"},</p>
          <p>
            {reservation.status === 'confirmed' || reservation.status === 'checked-in' 
              ? "We are pleased to confirm your booking. We would like to thank you for choosing The Amore Hills for your visit to our hotel. We look forward to host you in the future."
              : "We regret to inform you! Your booking has been cancelled. We would like to thank you for choosing The Amore Hills for your visit to our hotel. We look forward to host you in the future."
            }
          </p>
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
                <th style={{ width: "45%" }}>Room Category</th>
                <th style={{ width: "20%" }}>Adult+E Bed</th>
                <th style={{ width: "15%" }}>Child+Infant</th>
                <th style={{ width: "15%" }}>Meal Plan</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>1</td>
                <td>{reservation.room?.type || "Super Deluxe Room with Mountain View"}</td>
                <td>{reservation.numAdults} + 0</td>
                <td>{reservation.numChildren} + 0</td>
                <td>{mealPlan}</td>
              </tr>
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
            <strong>Add:</strong> The Amore Hills, GROUND FLOOR, KHASRA 255 KHATONI 28, SIWALI PATAL KANATAL, KANATAL POST OFFICE, KANATAL, Devaprayag, Tehri Garhwal, Uttarakhand, 249130<br />
            <em>For Any Clarification Contact:</em> Mobile: +919999231323<br />
            Mobile: 9999231323<br />
            Landline: 9999231323<br />
            Email: <a href="mailto:sas23enterprises@gmail.com">sas23enterprises@gmail.com</a><br />
            Website: <a href="https://amorehills.com/">https://amorehills.com/</a><br />
            GST Number: 05AAEPA9547Q1ZA<br /><br />
            Currency: Rupee
          </div>
          <div style={{ color: "#ef4444", fontWeight: "bold", textAlign: "right" }}>
            Check In Time: 12:00 Hrs<br />
            Check Out Time: 10:00 Hrs
          </div>
        </div>

        <div className="powered-by">
          Reservation Is Powered By <a href="#" style={{ color: "#0066cc", fontWeight: "bold", textDecoration: "underline" }}>AsiaTech Inc</a>
        </div>
      </div>
    </>
  );
}
