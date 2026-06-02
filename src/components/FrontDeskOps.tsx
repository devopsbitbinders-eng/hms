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
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid var(--border-color)", paddingTop: "20px" }}>
                <div style={{ fontSize: "1.1rem", color: "#fff" }}>
                  Total: <strong style={{ color: "#10b981" }}>₹{
                    Object.entries(newOrderItems).reduce((acc, [id, qty]) => {
                      const item = kitchenMenu.find(m => m.id === id);
                      return acc + ((item?.price || 0) * qty);
                    }, 0).toFixed(2)
                  }</strong>
                </div>
                <div style={{ display: "flex", gap: "12px" }}>
                  <button type="button" className="btn-secondary" onClick={() => setFoodOrderRes(null)}>Cancel</button>
                  <button type="submit" className="btn-primary" disabled={isSubmittingOrder || Object.values(newOrderItems).every(q => q === 0)}>
                    {isSubmittingOrder ? "Submitting..." : "Submit Order"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
