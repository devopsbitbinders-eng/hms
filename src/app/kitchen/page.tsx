"use client";

import React, { useEffect, useState } from "react";
// Uncomment and install socket.io-client if you're using real websockets
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
    room: { name: string; id: string };
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

  if (loading) return <div className="p-10 text-center">Loading Kitchen Dashboard...</div>;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-slate-900 text-white p-4 flex justify-between items-center shadow">
        <h1 className="text-xl font-bold flex items-center gap-2">
          🍳 Kitchen Display System
        </h1>
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab("KDS")}
            className={`px-4 py-2 rounded font-semibold ${activeTab === "KDS" ? "bg-blue-600" : "bg-slate-800 hover:bg-slate-700"}`}
          >
            Active Orders
          </button>
          <button
            onClick={() => setActiveTab("MENU")}
            className={`px-4 py-2 rounded font-semibold ${activeTab === "MENU" ? "bg-blue-600" : "bg-slate-800 hover:bg-slate-700"}`}
          >
            Menu Management
          </button>
        </div>
      </header>

      <main className="flex-1 p-6 overflow-auto">
        {activeTab === "KDS" && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-full">
            {["NEW", "COOKING", "READY"].map((status) => {
              const columnOrders = orders.filter((o) => o.status === status);
              return (
                <div key={status} className="bg-slate-200 rounded-lg shadow flex flex-col">
                  <div className="bg-slate-300 p-3 rounded-t-lg border-b border-slate-400 font-bold text-slate-800 flex justify-between">
                    <span>{status}</span>
                    <span className="bg-slate-800 text-white text-xs px-2 py-1 rounded-full">{columnOrders.length}</span>
                  </div>
                  <div className="p-3 flex-1 overflow-y-auto flex flex-col gap-3">
                    {columnOrders.map((order) => (
                      <div key={order.id} className="bg-white border-l-4 border-blue-500 rounded shadow-sm p-3 relative">
                        <div className="flex justify-between items-start mb-2">
                          <div className="text-sm font-bold">Room {order.reservation?.roomId?.slice(0,4) || "N/A"}</div>
                          <div className="text-xs text-gray-500">#{order.id.slice(0, 5).toUpperCase()}</div>
                        </div>
                        <div className="text-xs text-gray-600 mb-3">{order.reservation?.guestName}</div>
                        <ul className="space-y-1 mb-4 text-sm font-medium">
                          {order.items.map((item) => (
                            <li key={item.id} className="flex justify-between border-b pb-1">
                              <span><span className="font-bold text-blue-600">{item.quantity}x</span> {item.menuItem.name}</span>
                              {item.notes && <span className="text-red-500 text-xs mt-1 ml-2">Note: {item.notes}</span>}
                            </li>
                          ))}
                        </ul>
                        <div className="flex justify-end gap-2">
                          {status === "NEW" && (
                            <button onClick={() => updateOrderStatus(order.id, "COOKING")} className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded text-sm font-semibold transition">
                              Start Cooking
                            </button>
                          )}
                          {status === "COOKING" && (
                            <button onClick={() => updateOrderStatus(order.id, "READY")} className="bg-amber-500 hover:bg-amber-600 text-white px-3 py-1.5 rounded text-sm font-semibold transition">
                              Mark Ready
                            </button>
                          )}
                          {status === "READY" && (
                            <button onClick={() => updateOrderStatus(order.id, "SERVED")} className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded text-sm font-semibold transition">
                              Serve Order
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                    {columnOrders.length === 0 && (
                      <div className="text-center text-slate-500 text-sm mt-10">No orders in {status}</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {activeTab === "MENU" && (
          <div className="bg-white rounded-lg shadow border border-gray-200">
            <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
              <h2 className="text-lg font-bold text-gray-800">Menu Availability</h2>
              <span className="text-sm text-gray-500">Toggle items to hide them from the guest menu.</span>
            </div>
            <div className="p-0">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-100 border-b">
                    <th className="p-3 text-sm font-semibold text-gray-600">Item Name</th>
                    <th className="p-3 text-sm font-semibold text-gray-600">Price</th>
                    <th className="p-3 text-sm font-semibold text-gray-600 w-32 text-center">Status</th>
                    <th className="p-3 text-sm font-semibold text-gray-600 w-32 text-center">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {menuItems.map((item) => (
                    <tr key={item.id} className="border-b hover:bg-gray-50">
                      <td className="p-3 font-medium text-gray-800">{item.name}</td>
                      <td className="p-3 text-gray-600">₹{item.price.toFixed(2)}</td>
                      <td className="p-3 text-center">
                        <span className={`px-2 py-1 text-xs rounded-full font-bold ${item.isAvailable ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                          {item.isAvailable ? "Available" : "Out of Stock"}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        <button
                          onClick={() => toggleAvailability(item.id, item.isAvailable)}
                          className={`px-3 py-1.5 rounded text-xs font-bold transition ${item.isAvailable ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-green-50 text-green-600 hover:bg-green-100'}`}
                        >
                          {item.isAvailable ? "Mark Out of Stock" : "Mark Available"}
                        </button>
                      </td>
                    </tr>
                  ))}
                  {menuItems.length === 0 && (
                    <tr>
                      <td colSpan={4} className="p-6 text-center text-gray-500">No menu items found. Add some from the admin dashboard!</td>
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
