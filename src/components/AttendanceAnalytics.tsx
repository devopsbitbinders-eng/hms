"use client";

import React, { useState, useEffect, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';

export default function AttendanceAnalytics({ usersList }: { usersList: any[] }) {
  const [attendances, setAttendances] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<"weekly" | "monthly" | "yearly">("weekly");
  const [selectedUserId, setSelectedUserId] = useState<string>("all");

  useEffect(() => {
    const fetchAllAttendances = async () => {
      try {
        const res = await fetch("/api/attendance");
        const data = await res.json();
        if (data.success) {
          setAttendances(data.attendances);
        }
      } catch (err) {
        console.error("Failed to fetch attendances for analytics", err);
      } finally {
        setLoading(false);
      }
    };
    fetchAllAttendances();
  }, []);

  const chartData = useMemo(() => {
    if (!attendances.length) return [];

    const now = new Date();
    let startDate = new Date();
    
    if (timeRange === "weekly") {
      startDate.setDate(now.getDate() - 7);
    } else if (timeRange === "monthly") {
      startDate.setMonth(now.getMonth() - 1);
    } else {
      startDate.setFullYear(now.getFullYear() - 1);
    }

    // Filter by date range and selected user
    const filtered = attendances.filter(a => {
      const d = new Date(a.date);
      if (d < startDate) return false;
      if (selectedUserId !== "all" && a.userId !== selectedUserId) return false;
      return true;
    });

    if (selectedUserId === "all") {
      // Group by Staff Member
      const groupedByUser: { [key: string]: { totalHours: number, overTime: number, userName: string } } = {};
      
      filtered.forEach(a => {
        if (!a.clockIn || !a.clockOut) return;
        const cIn = new Date(a.clockIn);
        const cOut = new Date(a.clockOut);
        const hours = (cOut.getTime() - cIn.getTime()) / (1000 * 60 * 60);
        
        const userName = a.user?.name || "Unknown Staff";
        
        if (!groupedByUser[userName]) {
          groupedByUser[userName] = { totalHours: 0, overTime: 0, userName };
        }
        
        groupedByUser[userName].totalHours += hours;
        
        if (hours > 8) {
          groupedByUser[userName].overTime += (hours - 8);
        }
      });

      return Object.values(groupedByUser).map(u => ({
        label: u.userName,
        totalHours: Number(u.totalHours.toFixed(1)),
        overTime: Number(u.overTime.toFixed(1))
      })).sort((a, b) => b.totalHours - a.totalHours);
      
    } else {
      // Group by Date for specific staff
      const groupedByDate: { [key: string]: { totalHours: number, overTime: number, dateStr: string } } = {};
      
      filtered.forEach(a => {
        if (!a.clockIn || !a.clockOut) return;
        const cIn = new Date(a.clockIn);
        const cOut = new Date(a.clockOut);
        const hours = (cOut.getTime() - cIn.getTime()) / (1000 * 60 * 60);
        
        const dateStr = timeRange === "yearly" 
          ? `${cIn.getFullYear()}-${String(cIn.getMonth() + 1).padStart(2, '0')}`
          : cIn.toISOString().split("T")[0];

        if (!groupedByDate[dateStr]) {
          groupedByDate[dateStr] = { totalHours: 0, overTime: 0, dateStr };
        }
        
        groupedByDate[dateStr].totalHours += hours;
        
        if (hours > 8) {
          groupedByDate[dateStr].overTime += (hours - 8);
        }
      });

      return Object.values(groupedByDate).map(d => ({
        label: d.dateStr,
        totalHours: Number(d.totalHours.toFixed(1)),
        overTime: Number(d.overTime.toFixed(1))
      })).sort((a, b) => a.label.localeCompare(b.label));
    }

  }, [attendances, timeRange, selectedUserId]);

  if (loading) {
    return <div style={{ padding: "20px", color: "var(--text-secondary)" }}>Loading analytics...</div>;
  }

  return (
    <div className="glass-card" style={{ padding: "24px", marginTop: "24px", display: "flex", flexDirection: "column", gap: "20px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px" }}>
        <h2 style={{ fontSize: "1.2rem", fontWeight: "600", color: "#fff" }}>📊 Working Hours & Overtime Analytics</h2>
        
        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
          <select 
            value={selectedUserId} 
            onChange={(e) => setSelectedUserId(e.target.value)}
            style={{ 
              background: "rgba(0,0,0,0.3)", border: "1px solid var(--border-color)", 
              color: "#fff", padding: "8px 12px", borderRadius: "6px", outline: "none", fontSize: "0.85rem"
            }}
          >
            <option value="all">All Staff Members</option>
            {usersList.map(u => (
              <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
            ))}
          </select>

          <div style={{ display: "flex", background: "rgba(0,0,0,0.3)", borderRadius: "6px", border: "1px solid var(--border-color)", overflow: "hidden" }}>
            {(["weekly", "monthly", "yearly"] as const).map(range => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                style={{
                  padding: "8px 16px",
                  fontSize: "0.85rem",
                  background: timeRange === range ? "var(--primary-color)" : "transparent",
                  color: timeRange === range ? "#fff" : "var(--text-secondary)",
                  border: "none",
                  cursor: "pointer",
                  fontWeight: timeRange === range ? "600" : "normal",
                  textTransform: "capitalize"
                }}
              >
                {range}
              </button>
            ))}
          </div>
        </div>
      </div>

      {chartData.length === 0 ? (
        <div style={{ padding: "40px", textAlign: "center", color: "var(--text-secondary)" }}>
          No attendance data found for the selected criteria.
        </div>
      ) : (
        <div style={{ height: "350px", width: "100%", marginTop: "16px" }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" vertical={false} />
              <XAxis dataKey="label" stroke="var(--text-secondary)" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke="var(--text-secondary)" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `${val}h`} />
              <Tooltip 
                contentStyle={{ backgroundColor: "#1e1e2d", borderColor: "rgba(255,255,255,0.1)", borderRadius: "8px", color: "#fff" }}
                itemStyle={{ color: "#fff" }}
                cursor={{ fill: "rgba(255,255,255,0.05)" }}
              />
              <Legend wrapperStyle={{ paddingTop: "20px" }} />
              <Bar dataKey="totalHours" name="Total Working Hours" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="overTime" name="Overtime (> 8 hrs)" fill="#ef4444" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px", marginTop: "16px" }}>
        <div style={{ padding: "16px", background: "rgba(139, 92, 246, 0.1)", border: "1px solid rgba(139, 92, 246, 0.2)", borderRadius: "8px" }}>
          <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginBottom: "4px" }}>
            {selectedUserId === "all" ? "Total Staff Worked" : "Total Days Worked"}
          </div>
          <div style={{ fontSize: "1.5rem", fontWeight: "700", color: "#fff" }}>{chartData.length}</div>
        </div>
        <div style={{ padding: "16px", background: "rgba(16, 185, 129, 0.1)", border: "1px solid rgba(16, 185, 129, 0.2)", borderRadius: "8px" }}>
          <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginBottom: "4px" }}>
            {selectedUserId === "all" ? "Avg Hours / Staff Member" : "Avg Hours / Day"}
          </div>
          <div style={{ fontSize: "1.5rem", fontWeight: "700", color: "#10b981" }}>
            {chartData.length > 0 ? (chartData.reduce((acc, curr) => acc + curr.totalHours, 0) / chartData.length).toFixed(1) : 0}h
          </div>
        </div>
        <div style={{ padding: "16px", background: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.2)", borderRadius: "8px" }}>
          <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginBottom: "4px" }}>Total Overtime Hours</div>
          <div style={{ fontSize: "1.5rem", fontWeight: "700", color: "#ef4444" }}>
            {chartData.reduce((acc, curr) => acc + curr.overTime, 0).toFixed(1)}h
          </div>
        </div>
      </div>
    </div>
  );
}
