"use client";

import React, { useState, useMemo } from "react";
import styles from "../app/dashboard/dashboard.module.css";
import { Reservation } from "./VisualGrid";

interface FinanceOpsProps {
  currentReservations: Reservation[];
  activePropertyId: string;
}

export default function FinanceOps({ currentReservations, activePropertyId }: FinanceOpsProps) {
  const [activeTab, setActiveTab] = useState<"invoices" | "formc" | "tally" | "summary">("invoices");

  // Form C State
  const [downloadingFormC, setDownloadingFormC] = useState(false);

  // Tally Sync State
  const [syncStartDate, setSyncStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split("T")[0];
  });
  const [syncEndDate, setSyncEndDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [syncingTally, setSyncingTally] = useState(false);

  // Invoice Engine State
  const [selectedResId, setSelectedResId] = useState("");
  const [guestState, setGuestState] = useState("Delhi"); // Default assuming local state
  const hotelState = "Delhi"; // Hardcoded for demo, would be tied to Property

  const foreignGuests = useMemo(() => {
    return currentReservations.filter((res) => 
      res.status === "checked-in" && (res.nationality === "Foreign" || res.passportNumber)
    );
  }, [currentReservations]);

  const handleDownloadFormC = async () => {
    setDownloadingFormC(true);
    try {
      const res = await fetch(`/api/finance/form-c?propertyId=${activePropertyId}`);
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `form-c-export-${new Date().toISOString().split("T")[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setDownloadingFormC(false);
    }
  };

  const handleTallySync = async () => {
    setSyncingTally(true);
    try {
      const res = await fetch(`/api/finance/tally-export?propertyId=${activePropertyId}&start=${syncStartDate}&end=${syncEndDate}`);
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `tally-sync-${syncStartDate}-to-${syncEndDate}.xml`;
        document.body.appendChild(a);
        a.click();
        a.remove();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSyncingTally(false);
    }
  };

  const parseGstMode = (detailsStr?: string | null): "exclusive" | "inclusive" => {
    if (detailsStr && detailsStr.includes("[GST:inclusive]")) return "inclusive";
    return "exclusive";
  };

  const calculateGST = (totalAmount: number, isLocal: boolean, gstMode: "exclusive" | "inclusive") => {
    // Syncing with Front Office logic: 
    // <= 7500 = 5% (2.5% CGST/SGST)
    // > 7500 = 18% (9% CGST/SGST)
    const rate = totalAmount > 7500 ? 0.18 : 0.05;
    
    if (gstMode === "inclusive") {
      const baseAmount = totalAmount / (1 + rate);
      const gstAmount = totalAmount - baseAmount;
      if (isLocal) {
        return {
          rate: rate * 100,
          cgst: gstAmount / 2,
          sgst: gstAmount / 2,
          igst: 0,
          total: totalAmount,
          baseAmount,
        };
      } else {
        return {
          rate: rate * 100,
          cgst: 0,
          sgst: 0,
          igst: gstAmount,
          total: totalAmount,
          baseAmount,
        };
      }
    } else {
      const gstAmount = totalAmount * rate;
      if (isLocal) {
        return {
          rate: rate * 100,
          cgst: gstAmount / 2,
          sgst: gstAmount / 2,
          igst: 0,
          total: totalAmount + gstAmount,
          baseAmount: totalAmount,
        };
      } else {
        return {
          rate: rate * 100,
          cgst: 0,
          sgst: 0,
          igst: gstAmount,
          total: totalAmount + gstAmount,
          baseAmount: totalAmount,
        };
      }
    }
  };

  const selectedRes = currentReservations.find(r => r.id === selectedResId);
  const totalRoomCharge = selectedRes ? (selectedRes.billingItems || []).filter(b => b.category === "room").reduce((sum, item) => sum + item.amount, 0) : 0;
  const gstMode = selectedRes ? parseGstMode(selectedRes.details) : "exclusive";
  const gstDetails = selectedRes ? calculateGST(totalRoomCharge, guestState.toLowerCase() === hotelState.toLowerCase(), gstMode) : null;

  return (
    <div style={{ padding: "24px", color: "white", maxWidth: "1200px", margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
        <div>
          <h2 style={{ margin: "0 0 8px 0", fontSize: "1.8rem", fontWeight: "700" }}>Localization & Finance</h2>
          <p style={{ margin: 0, color: "var(--text-secondary)", fontSize: "0.95rem" }}>
            India Market Ready: GST Invoicing, Form C, and ERP Sync.
          </p>
        </div>
      </div>

      <div style={{ display: "flex", gap: "12px", marginBottom: "24px", borderBottom: "1px solid rgba(255,255,255,0.1)", paddingBottom: "12px" }}>
        {[
          { id: "invoices", label: "🧾 Native GST Engine" },
          { id: "formc", label: "🛂 Form C Compliance" },
          { id: "tally", label: "📊 Tally ERP Sync" },
          { id: "summary", label: "📉 Monthly GST Report" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            style={{
              padding: "10px 20px",
              background: activeTab === tab.id ? "rgba(99, 102, 241, 0.1)" : "transparent",
              border: activeTab === tab.id ? "1px solid #6366f1" : "1px solid transparent",
              color: activeTab === tab.id ? "#818cf8" : "var(--text-muted)",
              borderRadius: "8px",
              cursor: "pointer",
              fontWeight: "600",
              transition: "all 0.2s"
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "invoices" && (
        <div className={styles.card}>
          <h3 style={{ margin: "0 0 16px 0", color: "#818cf8" }}>Invoice Generation</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "24px" }}>
            
            {/* Left side: Select Reservation */}
            <div>
              <label style={{ display: "block", marginBottom: "8px", fontSize: "0.85rem", color: "var(--text-secondary)" }}>Select Guest Booking</label>
              <select 
                style={{ width: "100%", padding: "10px", borderRadius: "8px", background: "rgba(0,0,0,0.2)", color: "white", border: "1px solid rgba(255,255,255,0.1)", marginBottom: "16px" }}
                value={selectedResId}
                onChange={(e) => setSelectedResId(e.target.value)}
              >
                <option value="">-- Choose a Reservation --</option>
                {currentReservations.map(r => (
                  <option key={r.id} value={r.id}>{r.guestName} (Room {r.roomId?.slice(-3) || "N/A"})</option>
                ))}
              </select>

              {selectedRes && (
                <>
                  <label style={{ display: "block", marginBottom: "8px", fontSize: "0.85rem", color: "var(--text-secondary)" }}>Guest State (For GST Split)</label>
                  <select 
                    style={{ width: "100%", padding: "10px", borderRadius: "8px", background: "rgba(0,0,0,0.2)", color: "white", border: "1px solid rgba(255,255,255,0.1)" }}
                    value={guestState}
                    onChange={(e) => setGuestState(e.target.value)}
                  >
                    <option value="Delhi">Delhi (Local - CGST/SGST)</option>
                    <option value="Haryana">Haryana (Interstate - IGST)</option>
                    <option value="Maharashtra">Maharashtra (Interstate - IGST)</option>
                    <option value="Karnataka">Karnataka (Interstate - IGST)</option>
                  </select>
                </>
              )}
            </div>

            {/* Right side: Invoice Preview */}
            <div style={{ background: "rgba(0,0,0,0.2)", borderRadius: "12px", padding: "24px", border: "1px solid rgba(255,255,255,0.05)" }}>
              {selectedRes && gstDetails ? (
                <div>
                  <div style={{ borderBottom: "1px dashed rgba(255,255,255,0.2)", paddingBottom: "16px", marginBottom: "16px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <h4 style={{ margin: "0 0 4px 0", fontSize: "1.2rem" }}>TAX INVOICE</h4>
                      <span style={{ 
                        fontSize: "0.75rem", 
                        padding: "2px 8px", 
                        borderRadius: "4px", 
                        background: gstMode === "inclusive" ? "rgba(52, 211, 153, 0.15)" : "rgba(99, 102, 241, 0.15)",
                        color: gstMode === "inclusive" ? "#34d399" : "#818cf8",
                        fontWeight: "600"
                      }}>
                        {gstMode.toUpperCase()}
                      </span>
                    </div>
                    <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--text-secondary)" }}>Bill To: {selectedRes.guestName}</p>
                    <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--text-secondary)" }}>Place of Supply: {guestState}</p>
                  </div>
                  
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "12px" }}>
                    <span>Room Charges (Taxable Value)</span>
                    <span>₹{gstDetails.baseAmount.toFixed(2)}</span>
                  </div>

                  <div style={{ padding: "12px", background: "rgba(99, 102, 241, 0.05)", borderRadius: "8px", marginBottom: "16px", border: "1px solid rgba(99, 102, 241, 0.1)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px", fontSize: "0.85rem", color: "#818cf8" }}>
                      <span>Applicable GST Bracket</span>
                      <span>{gstDetails.rate}%</span>
                    </div>
                    
                    {gstDetails.cgst > 0 && (
                      <>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px", fontSize: "0.9rem" }}>
                          <span>CGST ({(gstDetails.rate/2)}%)</span>
                          <span>₹{gstDetails.cgst.toFixed(2)}</span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px", fontSize: "0.9rem" }}>
                          <span>SGST ({(gstDetails.rate/2)}%)</span>
                          <span>₹{gstDetails.sgst.toFixed(2)}</span>
                        </div>
                      </>
                    )}
                    {gstDetails.igst > 0 && (
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px", fontSize: "0.9rem" }}>
                        <span>IGST ({gstDetails.rate}%)</span>
                        <span>₹{gstDetails.igst.toFixed(2)}</span>
                      </div>
                    )}
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px dashed rgba(255,255,255,0.2)", paddingTop: "16px", fontWeight: "700", fontSize: "1.2rem" }}>
                    <span>Grand Total</span>
                    <span>₹{gstDetails.total.toFixed(2)}</span>
                  </div>

                  <button className="btn-primary" style={{ width: "100%", marginTop: "24px" }}>
                    Download PDF Invoice
                  </button>
                </div>
              ) : (
                <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontStyle: "italic" }}>
                  Select a reservation to preview invoice.
                </div>
              )}
            </div>

          </div>
        </div>
      )}

      {activeTab === "formc" && (
        <div className={styles.card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "20px" }}>
            <div>
              <h3 style={{ margin: "0 0 8px 0", color: "#34d399" }}>Form C Export (FRRO)</h3>
              <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--text-secondary)", maxWidth: "600px" }}>
                Under Indian law, hotels must submit Form C for all foreign nationals within 24 hours of arrival. 
                This tool automatically aggregates passport and visa data into the official FRRO format.
              </p>
            </div>
            <button 
              onClick={handleDownloadFormC} 
              disabled={downloadingFormC || foreignGuests.length === 0}
              className="btn-primary" 
              style={{ background: "linear-gradient(135deg, #10b981 0%, #059669 100%)", whiteSpace: "nowrap" }}
            >
              {downloadingFormC ? "⏳ Exporting..." : "📥 Download Form C CSV"}
            </button>
          </div>

          <div style={{ background: "rgba(0,0,0,0.2)", borderRadius: "8px", overflow: "hidden", border: "1px solid rgba(255,255,255,0.05)" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.9rem" }}>
              <thead>
                <tr style={{ background: "rgba(255,255,255,0.05)", color: "var(--text-muted)" }}>
                  <th style={{ padding: "12px 16px" }}>Guest Name</th>
                  <th style={{ padding: "12px 16px" }}>Nationality</th>
                  <th style={{ padding: "12px 16px" }}>Passport No</th>
                  <th style={{ padding: "12px 16px" }}>Visa Type</th>
                  <th style={{ padding: "12px 16px" }}>Arrival In India</th>
                </tr>
              </thead>
              <tbody>
                {foreignGuests.length > 0 ? foreignGuests.map(g => (
                  <tr key={g.id} style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                    <td style={{ padding: "12px 16px" }}>{g.guestName}</td>
                    <td style={{ padding: "12px 16px" }}>{g.nationality || "Unknown"}</td>
                    <td style={{ padding: "12px 16px" }}>{g.passportNumber || "N/A"}</td>
                    <td style={{ padding: "12px 16px" }}>{g.visaType || "N/A"}</td>
                    <td style={{ padding: "12px 16px" }}>{g.indiaArrivalDate || "N/A"}</td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={5} style={{ padding: "24px", textAlign: "center", color: "var(--text-muted)" }}>
                      No foreign guests currently checked in.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === "tally" && (
        <div className={styles.card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "20px" }}>
            <div>
              <h3 style={{ margin: "0 0 8px 0", color: "#f59e0b" }}>Tally ERP Integration</h3>
              <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--text-secondary)", maxWidth: "600px" }}>
                Generate Tally-compatible XML Day-Book data. This automatically maps room revenue, CGST, SGST, and IGST to their respective accounting ledgers for seamless import into Tally Prime.
              </p>
            </div>
          </div>

          <div style={{ display: "flex", gap: "16px", alignItems: "flex-end", marginBottom: "24px" }}>
            <div>
              <label style={{ display: "block", marginBottom: "6px", fontSize: "0.8rem", color: "var(--text-secondary)" }}>From Date</label>
              <input 
                type="date" 
                value={syncStartDate} 
                onChange={e => setSyncStartDate(e.target.value)}
                style={{ padding: "10px", borderRadius: "8px", background: "rgba(0,0,0,0.2)", color: "white", border: "1px solid rgba(255,255,255,0.1)" }}
              />
            </div>
            <div>
              <label style={{ display: "block", marginBottom: "6px", fontSize: "0.8rem", color: "var(--text-secondary)" }}>To Date</label>
              <input 
                type="date" 
                value={syncEndDate} 
                onChange={e => setSyncEndDate(e.target.value)}
                style={{ padding: "10px", borderRadius: "8px", background: "rgba(0,0,0,0.2)", color: "white", border: "1px solid rgba(255,255,255,0.1)" }}
              />
            </div>
            <button 
              onClick={handleTallySync} 
              disabled={syncingTally}
              className="btn-primary" 
              style={{ background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)", padding: "11px 24px" }}
            >
              {syncingTally ? "⏳ Generating XML..." : "🔄 Export XML for Tally"}
            </button>
          </div>

          <div style={{ background: "rgba(245, 158, 11, 0.05)", border: "1px dashed rgba(245, 158, 11, 0.3)", borderRadius: "8px", padding: "16px" }}>
            <h4 style={{ margin: "0 0 8px 0", fontSize: "0.95rem", color: "#fcd34d" }}>Tally Ledger Mapping Guidelines:</h4>
            <ul style={{ margin: 0, paddingLeft: "20px", fontSize: "0.85rem", color: "var(--text-secondary)", display: "flex", flexDirection: "column", gap: "6px" }}>
              <li>Room Sales mapped to ledger: <strong>"Local Room Sales Account"</strong></li>
              <li>CGST 2.5% mapped to ledger: <strong>"Output CGST @ 2.5%"</strong></li>
              <li>SGST 2.5% mapped to ledger: <strong>"Output SGST @ 2.5%"</strong></li>
              <li>IGST 5% mapped to ledger: <strong>"Output IGST @ 5%"</strong></li>
            </ul>
          </div>
        </div>
      )}

      {activeTab === "summary" && (
        <div className={styles.card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "20px" }}>
            <div>
              <h3 style={{ margin: "0 0 8px 0", color: "#60a5fa" }}>Monthly GST Output Report</h3>
              <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--text-secondary)", maxWidth: "600px" }}>
                A complete tabular summary of all checked-out and invoiced reservations for filing GST returns.
              </p>
            </div>
            <button 
              className="btn-primary" 
              style={{ background: "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)", whiteSpace: "nowrap" }}
              onClick={() => {
                 // Fake CSV download
                 const a = document.createElement("a");
                 a.href = "data:text/csv;charset=utf-8,InvoiceDate,Guest,Taxable,CGST,SGST,Total\n";
                 a.download = "gst_report.csv";
                 a.click();
              }}
            >
              📥 Export to CSV
            </button>
          </div>

          <div style={{ background: "rgba(0,0,0,0.2)", borderRadius: "8px", overflow: "hidden", border: "1px solid rgba(255,255,255,0.05)" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.9rem" }}>
              <thead>
                <tr style={{ background: "rgba(255,255,255,0.05)", color: "var(--text-muted)", fontSize: "0.75rem", textTransform: "uppercase" }}>
                  <th style={{ padding: "12px 16px" }}>Invoice Date</th>
                  <th style={{ padding: "12px 16px" }}>Guest / Ref</th>
                  <th style={{ padding: "12px 16px" }}>Taxable Amount</th>
                  <th style={{ padding: "12px 16px" }}>CGST</th>
                  <th style={{ padding: "12px 16px" }}>SGST</th>
                  <th style={{ padding: "12px 16px" }}>IGST</th>
                  <th style={{ padding: "12px 16px" }}>Grand Total</th>
                </tr>
              </thead>
              <tbody>
                {currentReservations.filter(r => r.status === "checked-out").map(res => {
                  const totalRoomCharge = (res.billingItems || []).filter(b => b.category === "room").reduce((sum, item) => sum + item.amount, 0);
                  const mode = parseGstMode(res.details);
                  // Default to local (CGST/SGST) for tabular summary unless state is known
                  const gst = calculateGST(totalRoomCharge, true, mode);
                  
                  return (
                    <tr key={res.id} style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                      <td style={{ padding: "12px 16px", color: "var(--text-secondary)" }}>{res.checkOutTime ? new Date(res.checkOutTime).toLocaleDateString() : "N/A"}</td>
                      <td style={{ padding: "12px 16px" }}>
                        <div style={{ fontWeight: "600", color: "#fff" }}>{res.guestName}</div>
                        <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>#{res.id.substring(0,6).toUpperCase()}</div>
                      </td>
                      <td style={{ padding: "12px 16px", fontFamily: "monospace" }}>₹{gst.baseAmount.toFixed(2)}</td>
                      <td style={{ padding: "12px 16px", color: "#60a5fa", fontFamily: "monospace" }}>₹{gst.cgst.toFixed(2)}</td>
                      <td style={{ padding: "12px 16px", color: "#60a5fa", fontFamily: "monospace" }}>₹{gst.sgst.toFixed(2)}</td>
                      <td style={{ padding: "12px 16px", color: "#f59e0b", fontFamily: "monospace" }}>₹{gst.igst.toFixed(2)}</td>
                      <td style={{ padding: "12px 16px", color: "#10b981", fontWeight: "700", fontFamily: "monospace" }}>₹{gst.total.toFixed(2)}</td>
                    </tr>
                  )
                })}
                {currentReservations.filter(r => r.status === "checked-out").length === 0 && (
                  <tr>
                    <td colSpan={7} style={{ padding: "32px", textAlign: "center", color: "var(--text-muted)" }}>
                      No checked-out reservations to report.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
}
