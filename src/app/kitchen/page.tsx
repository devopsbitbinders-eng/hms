"use client";

import React, { useEffect, useState } from "react";
import styles from "./kitchen.module.css";
// import io from "socket.io-client"; 

type OrderItem = {
  id: string;
  quantity: number;
  notes?: string;
  menuItem: {
    id: string;
    name: string;
  };
};

type Order = {
  id: string;
  status: "NEW" | "COOKING" | "READY" | "SERVED";
  items: OrderItem[];
  reservationId: string;
  reservation: {
    roomId: string;
    room?: { name: string; id: string };
    guestName: string;
  };
};

type MenuItem = {
  id: string;
  name: string;
  price: number;
  isAvailable: boolean;
};

export default function KitchenDashboard() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"KDS" | "MENU">("KDS");
  
  const [newItemName, setNewItemName] = useState("");
  const [newItemPrice, setNewItemPrice] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  const fetchData = async () => {
    try {
      const resOrders = await fetch("/api/kitchen/orders");
      const dataOrders = await resOrders.json();
      if (dataOrders.success) setOrders(dataOrders.orders);

      const resMenu = await fetch("/api/kitchen/menu");
      const dataMenu = await resMenu.json();
      if (dataMenu.success) setMenuItems(dataMenu.menuItems);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    // Fallback polling for real-time if socket.io is not set up
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, []);

  const generateKOT = (currentOrder: Order) => {
    // Find all READY orders for the same room
    const roomOrders = orders.filter(
      o => o.status === "READY" && 
      o.reservationId === currentOrder.reservationId
    );

    const allItems = roomOrders.flatMap(o => o.items);
    const orderIds = roomOrders.map(o => o.id.slice(0, 5).toUpperCase()).join(", ");

    const html = `<!DOCTYPE html>
<html>
<head>
  <title>Room Service Slip - Room ${currentOrder.reservation?.roomId?.slice(0, 4) || "N/A"}</title>
  <style>
    body { font-family: monospace; width: 300px; margin: 0; padding: 20px; color: #000; }
    h2 { text-align: center; margin-bottom: 5px; font-size: 18px; }
    .meta { border-bottom: 1px dashed #000; padding-bottom: 10px; margin-bottom: 10px; font-size: 14px; }
    table { width: 100%; border-collapse: collapse; font-size: 14px; }
    th { text-align: left; border-bottom: 1px dashed #000; padding-bottom: 5px; }
    td { padding: 5px 0; }
    .notes { font-size: 12px; font-style: italic; }
    .footer { margin-top: 20px; border-top: 1px dashed #000; padding-top: 20px; }
    .sig-line { margin-top: 40px; border-bottom: 1px solid #000; width: 100%; }
    @media print { body { padding: 0; } }
  </style>
</head>
<body onload="window.print()">
  <h2>AETHER HMS</h2>
  <div style="text-align: center; font-size: 14px; margin-bottom: 10px;">KITCHEN ORDER TICKET (COMBINED)</div>
  <div class="meta">
    <div><strong>Room:</strong> ${currentOrder.reservation?.roomId?.slice(0, 4) || "N/A"}</div>
    <div><strong>Guest:</strong> ${currentOrder.reservation?.guestName || "N/A"}</div>
    <div><strong>Orders:</strong> #${orderIds}</div>
    <div><strong>Time:</strong> ${new Date().toLocaleTimeString()}</div>
  </div>
  <table>
    <thead>
      <tr>
        <th style="width: 15%">Qty</th>
        <th>Item</th>
      </tr>
    </thead>
    <tbody>
      ${allItems.map(i => `
        <tr>
          <td style="font-weight: bold;">${i.quantity}x</td>
          <td>
            ${i.menuItem.name}
            ${i.notes ? `<div class="notes">Note: ${i.notes}</div>` : ''}
          </td>
        </tr>
      `).join('')}
    </tbody>
  </table>
  <div class="footer">
    <div><strong>Guest Signature:</strong></div>
    <div class="sig-line"></div>
    <div style="text-align: center; font-size: 12px; margin-top: 15px;">Please sign to charge to room folio</div>
  </div>
</body>
</html>`;
    const win = window.open("", "_blank", "width=400,height=600");
    if (win) {
      win.document.write(html);
      win.document.close();
    }
  };

  const updateOrderStatus = async (id: string, newStatus: string) => {
    // Optimistic UI update
    setOrders((prev) =>
      prev.map((o) => (o.id === id ? { ...o, status: newStatus as any } : o))
    );

    try {
      await fetch(`/api/kitchen/orders/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
    } catch (err) {
      console.error("Failed to update status", err);
      // Rollback if failed
      fetchData();
    }
  };

  const toggleAvailability = async (itemId: string, currentStatus: boolean) => {
    // Optimistic UI update
    setMenuItems((prev) =>
      prev.map((m) => (m.id === itemId ? { ...m, isAvailable: !currentStatus } : m))
    );

    try {
      await fetch(`/api/kitchen/menu/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isAvailable: !currentStatus }),
      });
    } catch (err) {
      console.error("Failed to toggle menu item", err);
      fetchData();
    }
  };

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName || !newItemPrice) return;
    setIsAdding(true);
    try {
      const res = await fetch("/api/kitchen/menu", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newItemName, price: parseFloat(newItemPrice), description: "" }),
      });
      const data = await res.json();
      if (data.success) {
        setMenuItems([...menuItems, data.menuItem].sort((a, b) => a.name.localeCompare(b.name)));
        setNewItemName("");
        setNewItemPrice("");
      }
    } catch (err) {
      console.error("Failed to add item", err);
    } finally {
      setIsAdding(false);
    }
  };

  if (loading) return <div style={{ padding: "2rem", textAlign: "center", color: "#fff" }}>Loading Kitchen Dashboard...</div>;

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>
          🍳 Kitchen Display System
        </h1>
        <div className={styles.tabs}>
          <button
            onClick={() => setActiveTab("KDS")}
            className={`${styles.tabBtn} ${activeTab === "KDS" ? styles.tabBtnActive : ""}`}
          >
            Active Orders
          </button>
          <button
            onClick={() => setActiveTab("MENU")}
            className={`${styles.tabBtn} ${activeTab === "MENU" ? styles.tabBtnActive : ""}`}
          >
            Menu Management
          </button>
        </div>
      </header>

      <main className={styles.main}>
        {activeTab === "KDS" && (
          <div className={styles.kdsGrid}>
            {["NEW", "COOKING", "READY"].map((status) => {
              const columnOrders = orders.filter((o) => o.status === status);
              return (
                <div key={status} className={styles.column}>
                  <div className={styles.colHeader}>
                    <span>{status}</span>
                    <span className={styles.badge}>{columnOrders.length}</span>
                  </div>
                  <div className={styles.colBody}>
                    {columnOrders.map((order) => (
                      <div key={order.id} className={styles.orderCard}>
                        <div className={styles.orderHeader}>
                          <div className={styles.roomName}>Room {order.reservation?.roomId?.slice(0,4) || "N/A"}</div>
                          <div className={styles.orderId}>#{order.id.slice(0, 5).toUpperCase()}</div>
                        </div>
                        <div className={styles.guestName}>{order.reservation?.guestName}</div>
                        <ul className={styles.itemList}>
                          {order.items.map((item) => (
                            <li key={item.id} className={styles.itemRow}>
                              <span><span className={styles.itemQty}>{item.quantity}x</span> {item.menuItem.name}</span>
                              {item.notes && <span className={styles.itemNote}>Note: {item.notes}</span>}
                            </li>
                          ))}
                        </ul>
                        <div className={styles.actionRow}>
                          {status === "NEW" && (
                            <button onClick={() => updateOrderStatus(order.id, "COOKING")} className={`${styles.actionBtn} ${styles.btnStart}`}>
                              Start Cooking
                            </button>
                          )}
                          {status === "COOKING" && (
                            <button onClick={() => updateOrderStatus(order.id, "READY")} className={`${styles.actionBtn} ${styles.btnReady}`}>
                              Mark Ready
                            </button>
                          )}
                          {status === "READY" && (
                            <>
                              <button onClick={() => generateKOT(order)} style={{ background: "#4f46e5", color: "white", padding: "0.375rem 0.75rem", borderRadius: "0.25rem", border: "none", cursor: "pointer", marginRight: "0.5rem", fontSize: "0.875rem", fontWeight: "600" }}>
                                🖨️ Print Slip
                              </button>
                              <button onClick={() => updateOrderStatus(order.id, "SERVED")} className={`${styles.actionBtn} ${styles.btnServe}`}>
                                Serve Order
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                    {columnOrders.length === 0 && (
                      <div className={styles.emptyText}>No orders in {status}</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {activeTab === "MENU" && (
          <div className={styles.menuContainer}>
            <div className={styles.menuHeader}>
              <div>
                <h2 className={styles.menuTitle}>Menu Availability</h2>
                <span className={styles.menuSub}>Add items or toggle them to hide from guest menu.</span>
              </div>
            </div>
            
            <div style={{ padding: "1rem", backgroundColor: "#0f172a", borderBottom: "1px solid #334155" }}>
              <form onSubmit={handleAddItem} style={{ display: "flex", gap: "1rem", alignItems: "flex-end" }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: "block", fontSize: "0.75rem", color: "#94a3b8", marginBottom: "0.25rem", fontWeight: "bold" }}>Item Name</label>
                  <input 
                    type="text" 
                    value={newItemName} 
                    onChange={e => setNewItemName(e.target.value)} 
                    placeholder="e.g. Masala Dosa" 
                    style={{ width: "100%", padding: "0.5rem", borderRadius: "0.25rem", border: "1px solid #334155", backgroundColor: "#1e293b", color: "#fff" }} 
                    required 
                  />
                </div>
                <div style={{ width: "150px" }}>
                  <label style={{ display: "block", fontSize: "0.75rem", color: "#94a3b8", marginBottom: "0.25rem", fontWeight: "bold" }}>Price (₹)</label>
                  <input 
                    type="number" 
                    value={newItemPrice} 
                    onChange={e => setNewItemPrice(e.target.value)} 
                    placeholder="e.g. 150" 
                    style={{ width: "100%", padding: "0.5rem", borderRadius: "0.25rem", border: "1px solid #334155", backgroundColor: "#1e293b", color: "#fff" }} 
                    required 
                    min="0"
                    step="0.01"
                  />
                </div>
                <button 
                  type="submit" 
                  disabled={isAdding}
                  style={{ padding: "0.5rem 1rem", backgroundColor: "#2563eb", color: "#fff", border: "none", borderRadius: "0.25rem", fontWeight: "bold", cursor: isAdding ? "not-allowed" : "pointer" }}
                >
                  {isAdding ? "Adding..." : "+ Add Item"}
                </button>
              </form>
            </div>

            <div>
              <table className={styles.menuTable}>
                <thead>
                  <tr>
                    <th>Item Name</th>
                    <th>Price</th>
                    <th style={{ textAlign: "center" }}>Status</th>
                    <th style={{ textAlign: "center" }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {menuItems.map((item) => (
                    <tr key={item.id}>
                      <td>{item.name}</td>
                      <td>₹{item.price.toFixed(2)}</td>
                      <td style={{ textAlign: "center" }}>
                        <span className={`${styles.statusBadge} ${item.isAvailable ? styles.statusAvail : styles.statusOut}`}>
                          {item.isAvailable ? "Available" : "Out of Stock"}
                        </span>
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <button
                          onClick={() => toggleAvailability(item.id, item.isAvailable)}
                          className={`${styles.toggleBtn} ${item.isAvailable ? styles.toggleAvail : styles.toggleOut}`}
                        >
                          {item.isAvailable ? "Mark Out of Stock" : "Mark Available"}
                        </button>
                      </td>
                    </tr>
                  ))}
                  {menuItems.length === 0 && (
                    <tr>
                      <td colSpan={4} style={{ textAlign: "center", padding: "2rem", color: "#94a3b8" }}>No menu items found. Use the form above to add some!</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
