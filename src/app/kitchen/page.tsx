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
                            <button onClick={() => updateOrderStatus(order.id, "SERVED")} className={`${styles.actionBtn} ${styles.btnServe}`}>
                              Serve Order
                            </button>
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
              <h2 className={styles.menuTitle}>Menu Availability</h2>
              <span className={styles.menuSub}>Toggle items to hide them from the guest menu.</span>
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
                      <td colSpan={4} style={{ textAlign: "center", padding: "2rem", color: "#94a3b8" }}>No menu items found. Add some from the admin dashboard!</td>
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
