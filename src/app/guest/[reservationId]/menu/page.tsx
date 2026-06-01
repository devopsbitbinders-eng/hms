"use client";

import React, { useEffect, useState, use } from "react";
import styles from "./guest-menu.module.css";

type MenuItem = {
  id: string;
  name: string;
  price: number;
  description: string;
  isAvailable: boolean;
};

type CartItem = {
  menuItem: MenuItem;
  quantity: number;
  notes: string;
};

export default function GuestMenuPage({ params }: { params: Promise<{ reservationId: string }> }) {
  const resolvedParams = use(params);
  const { reservationId } = resolvedParams;

  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [placingOrder, setPlacingOrder] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    fetch("/api/kitchen/menu")
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          // Only show available items to guests
          setMenuItems(data.menuItems.filter((m: MenuItem) => m.isAvailable));
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const updateCart = (menuItem: MenuItem, delta: number) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.menuItem.id === menuItem.id);
      if (!existing) {
        if (delta > 0) return [...prev, { menuItem, quantity: delta, notes: "" }];
        return prev;
      }
      
      const newQuantity = existing.quantity + delta;
      if (newQuantity <= 0) {
        return prev.filter((item) => item.menuItem.id !== menuItem.id);
      }

      return prev.map((item) =>
        item.menuItem.id === menuItem.id ? { ...item, quantity: newQuantity } : item
      );
    });
  };

  const updateNotes = (menuItemId: string, notes: string) => {
    setCart((prev) =>
      prev.map((item) =>
        item.menuItem.id === menuItemId ? { ...item, notes } : item
      )
    );
  };

  const cartTotal = cart.reduce((sum, item) => sum + item.menuItem.price * item.quantity, 0);
  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);

  const placeOrder = async () => {
    if (cart.length === 0) return;
    setPlacingOrder(true);

    try {
      const res = await fetch("/api/kitchen/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reservationId,
          totalAmount: cartTotal,
          items: cart.map((c) => ({
            menuItemId: c.menuItem.id,
            quantity: c.quantity,
            price: c.menuItem.price,
            notes: c.notes
          }))
        }),
      });

      const data = await res.json();
      if (data.success) {
        setShowSuccess(true);
        setCart([]);
      } else {
        alert("Sorry, we couldn't place your order. Please call the front desk.");
      }
    } catch (e) {
      alert("Error placing order. Please try again.");
    } finally {
      setPlacingOrder(false);
    }
  };

  if (loading) return <div style={{ color: "white", padding: "2rem", textAlign: "center" }}>Loading Menu...</div>;

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.welcomeText}>Room Service</div>
        <h1 className={styles.title}>Aether Kitchen</h1>
        <div className={styles.roomTag}>Room ID: {reservationId.slice(0, 4).toUpperCase()}</div>
      </header>

      <main className={styles.main}>
        <div className={styles.menuGrid}>
          {menuItems.map((item) => {
            const cartItem = cart.find((c) => c.menuItem.id === item.id);
            const qty = cartItem?.quantity || 0;

            return (
              <div key={item.id} className={styles.menuItem}>
                <div className={styles.itemHeader}>
                  <div className={styles.itemName}>{item.name}</div>
                  <div className={styles.itemPrice}>₹{item.price}</div>
                </div>
                <div className={styles.itemDesc}>
                  {item.description || "Freshly prepared in our kitchen."}
                </div>
                
                <div className={styles.itemControls}>
                  {qty > 0 ? (
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center" }}>
                        <button onClick={() => updateCart(item, -1)} className={styles.qtyBtn}>-</button>
                        <div className={styles.qtyValue}>{qty}</div>
                        <button onClick={() => updateCart(item, 1)} className={styles.qtyBtn}>+</button>
                      </div>
                      <input 
                        type="text" 
                        placeholder="Any special requests? (e.g., Less spicy)" 
                        className={styles.noteInput}
                        value={cartItem?.notes || ""}
                        onChange={(e) => updateNotes(item.id, e.target.value)}
                      />
                    </div>
                  ) : (
                    <div style={{ display: "flex", justifyContent: "flex-end", width: "100%" }}>
                      <button onClick={() => updateCart(item, 1)} style={{ background: "#4f46e5", color: "white", border: "none", padding: "0.5rem 1rem", borderRadius: "0.5rem", fontWeight: "bold", cursor: "pointer" }}>
                        Add to Order
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          
          {menuItems.length === 0 && (
            <div style={{ textAlign: "center", color: "#94a3b8", marginTop: "2rem" }}>
              Room service is currently closed.
            </div>
          )}
        </div>
      </main>

      {totalItems > 0 && (
        <div className={styles.cartOverlay}>
          <div className={styles.cartInfo}>
            <span className={styles.cartItems}>{totalItems} {totalItems === 1 ? 'Item' : 'Items'}</span>
            <span className={styles.cartTotal}>₹{cartTotal}</span>
          </div>
          <button 
            className={styles.checkoutBtn} 
            onClick={placeOrder}
            disabled={placingOrder}
          >
            {placingOrder ? "Sending..." : "Place Order"}
          </button>
        </div>
      )}

      {showSuccess && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <div className={styles.successIcon}>👨‍🍳</div>
            <h2 className={styles.modalTitle}>Order Received!</h2>
            <p className={styles.modalText}>
              Our chefs have started preparing your meal. It will be delivered to your room shortly.
            </p>
            <button className={styles.doneBtn} onClick={() => setShowSuccess(false)}>
              Back to Menu
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
