import React from "react";
import styles from "../app/dashboard/dashboard.module.css";

interface SidebarProps {
  activeMenu: string;
  setActiveMenu: (menu: string) => void;
  currentUser?: {
    name: string;
    role: string;
    avatar: string;
    permissions?: string[];
  } | null;
  onProfileClick?: () => void;
  activePropertyType?: string;
}

export default function Sidebar({
  activeMenu,
  setActiveMenu,
  currentUser,
  onProfileClick,
  activePropertyType,
}: SidebarProps) {
  let menuItems = [
    { id: "front-office", label: "Front Office", icon: "🗓️" },
    { id: "front-desk", label: "Front Desk", icon: "🛎️" },
    { id: "channel-manager", label: "Channel Manager", icon: "🌍" },
    { id: "housekeeping", label: "Housekeeping & Ops", icon: "🧹" },
    { id: "finance", label: activePropertyType === "homestay" ? "Bills & Earnings" : "Finance & GST", icon: "💰" },
    { id: "reviews", label: "Reviews", icon: "⭐" },
    { id: "attendance", label: "Attendance", icon: "⏱️" },
    { id: "settings", label: "Settings", icon: "⚙️" },
  ];

  if (activePropertyType === "homestay") {
    menuItems = menuItems.filter(item => item.id !== "channel-manager");
  }

  const name = currentUser?.name || "Aravind Mehta";
  const role = currentUser?.role || "Super Admin";
  const avatar = currentUser?.avatar || "AM";

  const filteredMenuItems = menuItems.filter((item) => {
    // If the user has explicitly assigned permissions, use those
    if (currentUser?.permissions && Array.isArray(currentUser.permissions)) {
      return currentUser.permissions.includes(item.id);
    }
    
    // Otherwise fallback to default role-based logic
    if (role === "Super Admin") return true;
    if (role === "General Manager") {
      // General Manager sees everything except dangerous DB actions (which are hidden inside settings by role check)
      return true;
    }
    if (role === "Front Office Manager") {
      return ["front-office", "front-desk", "housekeeping", "reviews", "attendance", "settings"].includes(item.id);
    }
    if (role === "Receptionist") {
      return ["front-office", "front-desk", "housekeeping", "reviews", "attendance"].includes(item.id);
    }
    if (role === "Finance Executive") {
      return ["front-office", "front-desk", "finance", "attendance"].includes(item.id);
    }
    if (role === "Housekeeper" || role === "Housekeeping Supervisor") {
      return ["housekeeping", "attendance"].includes(item.id);
    }
    return true;
  });

  return (
    <aside className={styles.sidebar}>
      <div>
        <div className={styles.brand}>
          <div className={styles.brandLogo}>A</div>
          <span className={styles.brandName}>AetherHMS</span>
        </div>
        <ul className={styles.menuList}>
          {filteredMenuItems.map((item) => (
            <li
              key={item.id}
              className={`${styles.menuItem} ${
                activeMenu === item.id ? styles.menuItemActive : ""
              }`}
              onClick={() => setActiveMenu(item.id)}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </li>
          ))}
        </ul>
      </div>

      <div
        className={styles.sidebarFooter}
        onClick={onProfileClick}
        style={{
          cursor: "pointer",
          borderRadius: "8px",
          padding: "8px",
          margin: "-8px",
          transition: "background-color 0.2s ease",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.05)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = "transparent";
        }}
      >
        <div className={styles.avatar} style={{ fontSize: "0.85rem", fontWeight: "600", textTransform: "uppercase", whiteSpace: "nowrap" }}>{avatar}</div>
        <div className={styles.profileInfo} style={{ flexGrow: 1 }}>
          <h4 style={{ fontSize: "0.85rem", fontWeight: "600", color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "130px" }}>{name}</h4>
          <p style={{ fontSize: "0.7rem", color: "var(--text-secondary)" }}>{role}</p>
        </div>
        <div style={{ fontSize: "0.8rem", opacity: 0.5, marginLeft: "4px" }}>🔑</div>
      </div>
    </aside>
  );
}

