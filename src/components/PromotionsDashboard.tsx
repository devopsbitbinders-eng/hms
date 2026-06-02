"use client";
import React, { useState, useEffect } from "react";
import styles from "../app/dashboard/dashboard.module.css";

export default function PromotionsDashboard({ currentUser, addToast }: { currentUser: any, addToast: any }) {
  const [coupons, setCoupons] = useState<any[]>([]);
  const [affiliates, setAffiliates] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState("coupons");
  
  // Form States for Coupons
  const [couponCode, setCouponCode] = useState("");
  const [discountType, setDiscountType] = useState("PERCENTAGE");
  const [discountValue, setDiscountValue] = useState("");
  const [applyTo, setApplyTo] = useState("ROOM_ONLY");
  const [customTarget, setCustomTarget] = useState("");
  const [validUntil, setValidUntil] = useState("");
  
  // Form States for Affiliates
  const [affName, setAffName] = useState("");
  const [affEmail, setAffEmail] = useState("");
  const [affCode, setAffCode] = useState("");
  const [affType, setAffType] = useState("PERCENTAGE");
  const [affValue, setAffValue] = useState("");

  const fetchData = async () => {
    try {
      const cRes = await fetch("/api/coupons");
      const cData = await cRes.json();
      if (cData.success) setCoupons(cData.coupons);
      
      const aRes = await fetch("/api/affiliates");
      const aData = await aRes.json();
      if (aData.success) setAffiliates(aData.affiliates);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/coupons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: couponCode, discountType, discountValue, applyTo: applyTo === "CUSTOM" ? `CUSTOM:${customTarget}` : applyTo,
          validUntil: validUntil || null
        })
      });
      const data = await res.json();
      if (data.success) {
        addToast("Coupon created successfully!", "success");
        setCouponCode(""); setDiscountValue(""); setCustomTarget(""); setValidUntil("");
        fetchData();
      } else {
        addToast(data.error, "error");
      }
    } catch (err) {
      addToast("Failed to create coupon", "error");
    }
  };

  const handleDeleteCoupon = async (id: string) => {
    if (!confirm("Are you sure you want to delete this coupon?")) return;
    try {
      const res = await fetch(`/api/coupons?id=${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        addToast("Coupon deleted successfully!", "success");
        fetchData();
      } else {
        addToast(data.error || "Failed to delete coupon", "error");
      }
    } catch (err: any) {
      addToast(err.message, "error");
    }
  };

  const handleCreateAffiliate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/affiliates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: affName, email: affEmail, referralCode: affCode, commissionType: affType, commissionValue: affValue
        })
      });
      const data = await res.json();
      if (data.success) {
        addToast("Affiliate created successfully!", "success");
        setAffName(""); setAffEmail(""); setAffCode(""); setAffValue("");
        fetchData();
      } else {
        addToast(data.error, "error");
      }
    } catch (err) {
      addToast("Failed to create affiliate", "error");
    }
  };

  const handlePayout = async (id: string) => {
    try {
      const res = await fetch("/api/affiliates", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action: "PAYOUT" })
      });
      const data = await res.json();
      if (data.success) {
        addToast("Payout processed successfully!", "success");
        fetchData();
      } else {
        addToast(data.error, "error");
      }
    } catch (err) {
      addToast("Failed to process payout", "error");
    }
  };

  const formStyle = { display: "flex", gap: "10px", flexWrap: "wrap" as "wrap", marginBottom: "20px", padding: "20px", background: "var(--bg-secondary)", borderRadius: "8px" };
  const inputStyle = { padding: "8px", borderRadius: "4px", border: "1px solid var(--border-color)", background: "var(--bg-primary)", color: "var(--text-primary)" };

  return (
    <div style={{ padding: "24px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
        <h1 style={{ fontSize: "1.8rem", fontWeight: "700" }}>🎁 Coupons & Referrals Dashboard</h1>
        <div style={{ display: "flex", gap: "8px" }}>
          <button className={`btn-secondary ${activeTab === 'coupons' ? 'active' : ''}`} onClick={() => setActiveTab('coupons')} style={{ background: activeTab === 'coupons' ? 'var(--primary-color)' : '', color: activeTab === 'coupons' ? '#fff' : '' }}>Discount Coupons</button>
          <button className={`btn-secondary ${activeTab === 'affiliates' ? 'active' : ''}`} onClick={() => setActiveTab('affiliates')} style={{ background: activeTab === 'affiliates' ? 'var(--primary-color)' : '', color: activeTab === 'affiliates' ? '#fff' : '' }}>Affiliate Referrals</button>
        </div>
      </div>

      {activeTab === "coupons" && (
        <>
          <div className="glass-card">
            <h3>Create New Coupon</h3>
            <form style={formStyle} onSubmit={handleCreateCoupon}>
              <input style={inputStyle} placeholder="Coupon Code (e.g. SUMMER20)" value={couponCode} onChange={e => setCouponCode(e.target.value)} required />
              <select style={inputStyle} value={discountType} onChange={e => setDiscountType(e.target.value)}>
                <option value="PERCENTAGE">Percentage (%)</option>
                <option value="FLAT">Flat Amount (₹)</option>
              </select>
              <input style={inputStyle} type="number" placeholder="Value" value={discountValue} onChange={e => setDiscountValue(e.target.value)} required />
              <select style={inputStyle} value={applyTo} onChange={e => setApplyTo(e.target.value)}>
                <option value="ROOM_ONLY">Room Tariff Only</option>
                <option value="GRAND_TOTAL">Grand Total (Inc. Food/Extras)</option>
                <option value="ROOM_UPGRADE_ONLY">Room Upgrade Only</option>
                <option value="CUSTOM">Custom Category/Name</option>
              </select>
              {applyTo === "CUSTOM" && (
                <input style={inputStyle} placeholder="e.g. Food, Spa, Laundry" value={customTarget} onChange={e => setCustomTarget(e.target.value)} required />
              )}
              <input style={inputStyle} type="datetime-local" title="Expiry Date & Time (Optional)" placeholder="Expiry Date" value={validUntil} onChange={e => setValidUntil(e.target.value)} />
              <button className="btn-primary" type="submit">Create Coupon</button>
            </form>
          </div>
          
          <div className="glass-card" style={{ marginTop: "20px" }}>
            <h3>Active Coupons</h3>
            <table className={styles.table} style={{ width: "100%", marginTop: "10px" }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", padding: "8px" }}>Code</th>
                  <th style={{ textAlign: "left", padding: "8px" }}>Type</th>
                  <th style={{ textAlign: "left", padding: "8px" }}>Value</th>
                  <th style={{ textAlign: "left", padding: "8px" }}>Applies To</th>
                  <th style={{ textAlign: "left", padding: "8px" }}>Times Used</th>
                  <th style={{ textAlign: "left", padding: "8px" }}>Expiry</th>
                  <th style={{ textAlign: "left", padding: "8px" }}>Status</th>
                  <th style={{ textAlign: "center", padding: "8px" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {coupons.map(c => (
                  <tr key={c.id} style={{ borderTop: "1px solid var(--border-color)" }}>
                    <td style={{ padding: "8px", fontWeight: "bold" }}>{c.code}</td>
                    <td style={{ padding: "8px" }}>{c.discountType}</td>
                    <td style={{ padding: "8px" }}>{c.discountType === "FLAT" ? `₹${c.discountValue}` : `${c.discountValue}%`}</td>
                    <td style={{ padding: "8px" }}>
                      <span style={{ fontSize: "0.75rem", padding: "2px 6px", borderRadius: "4px", background: "rgba(16,185,129,0.1)", color: "#10b981" }}>
                        {c.applyTo.replace(/_/g, " ").replace("CUSTOM:", "Custom: ")}
                      </span>
                    </td>
                    <td style={{ padding: "8px" }}>{c.timesUsed}</td>
                    <td style={{ padding: "8px" }}>{c.validUntil ? new Date(c.validUntil).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' }) : "No Expiry"}</td>
                    <td style={{ padding: "8px" }}>
                      {c.isActive ? "🟢 Active" : "🔴 Inactive"}
                      {c.validUntil && new Date(c.validUntil) < new Date() ? " (Expired)" : ""}
                    </td>
                    <td style={{ padding: "8px", textAlign: "center" }}>
                      <button onClick={() => handleDeleteCoupon(c.id)} style={{ background: "transparent", border: "none", color: "#ef4444", cursor: "pointer", fontSize: "16px" }} title="Delete Coupon">🗑️</button>
                    </td>
                  </tr>
                ))}
                {coupons.length === 0 && <tr><td colSpan={7} style={{ padding: "20px", textAlign: "center", color: "var(--text-secondary)" }}>No coupons found.</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}

      {activeTab === "affiliates" && (
        <>
          <div className="glass-card">
            <h3>Add New Affiliate / Partner</h3>
            <form style={formStyle} onSubmit={handleCreateAffiliate}>
              <input style={inputStyle} placeholder="Name" value={affName} onChange={e => setAffName(e.target.value)} required />
              <input style={inputStyle} type="email" placeholder="Email" value={affEmail} onChange={e => setAffEmail(e.target.value)} required />
              <input style={inputStyle} placeholder="Referral Code (e.g. MAKEMYTRIP)" value={affCode} onChange={e => setAffCode(e.target.value)} required />
              <select style={inputStyle} value={affType} onChange={e => setAffType(e.target.value)}>
                <option value="PERCENTAGE">Percentage (%)</option>
                <option value="FLAT">Flat Rate (₹)</option>
              </select>
              <input style={inputStyle} type="number" placeholder="Commission Value" value={affValue} onChange={e => setAffValue(e.target.value)} required />
              <button className="btn-primary" type="submit">Add Affiliate</button>
            </form>
          </div>

          <div className="glass-card" style={{ marginTop: "20px" }}>
            <h3>Affiliate Partners & Payouts</h3>
            <table className={styles.table} style={{ width: "100%", marginTop: "10px" }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", padding: "8px" }}>Name</th>
                  <th style={{ textAlign: "left", padding: "8px" }}>Code</th>
                  <th style={{ textAlign: "left", padding: "8px" }}>Commission</th>
                  <th style={{ textAlign: "left", padding: "8px" }}>Total Earned</th>
                  <th style={{ textAlign: "left", padding: "8px" }}>Pending Payout</th>
                  <th style={{ textAlign: "right", padding: "8px" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {affiliates.map(a => (
                  <tr key={a.id} style={{ borderTop: "1px solid var(--border-color)" }}>
                    <td style={{ padding: "8px", fontWeight: "bold" }}>{a.name}</td>
                    <td style={{ padding: "8px", color: "var(--primary-color)" }}>{a.referralCode}</td>
                    <td style={{ padding: "8px" }}>{a.commissionType === "FLAT" ? `₹${a.commissionValue}` : `${a.commissionValue}%`}</td>
                    <td style={{ padding: "8px" }}>₹{a.totalEarned.toFixed(2)}</td>
                    <td style={{ padding: "8px", color: a.pendingPayout > 0 ? "#f59e0b" : "var(--text-secondary)" }}>
                      ₹{a.pendingPayout.toFixed(2)}
                    </td>
                    <td style={{ padding: "8px", textAlign: "right" }}>
                      <button 
                        className="btn-secondary" 
                        disabled={a.pendingPayout <= 0}
                        onClick={() => handlePayout(a.id)}
                        style={{ padding: "4px 8px", fontSize: "0.8rem", opacity: a.pendingPayout > 0 ? 1 : 0.5 }}
                      >
                        Approve Payout
                      </button>
                    </td>
                  </tr>
                ))}
                {affiliates.length === 0 && <tr><td colSpan={6} style={{ padding: "20px", textAlign: "center", color: "var(--text-secondary)" }}>No affiliates found.</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
