"use client";

import React, { useState, useEffect } from "react";
import styles from "./dashboard/dashboard.module.css";
import Sidebar from "../components/Sidebar";
import Header from "../components/Header";
import VisualGrid, { Room, Reservation } from "../components/VisualGrid";
import SplitBillingModal from "@/components/SplitBillingModal";
import ReviewDashboard from "@/components/ReviewDashboard";
import ChannelManager from "../components/ChannelManager";
import HousekeepingOps from "../components/HousekeepingOps";
import FinanceOps from "../components/FinanceOps";
import FrontDeskOps from "../components/FrontDeskOps";
import ReviewManagement from "../components/ReviewManagement";
import LoginScreen from "../components/LoginScreen";

// Helper to map DB property names to frontend property keys
const mapPropertyKey = (name: string): string => {
  const lowercase = name.toLowerCase();
  if (lowercase.includes("goa")) return "goa";
  if (lowercase.includes("manali")) return "manali";
  if (lowercase.includes("delhi")) return "delhi";
  // Replace spaces and special characters for custom property names
  return lowercase.replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
};

// Form layouts helper styles
const labelStyle: React.CSSProperties = {
  fontSize: "0.85rem",
  fontWeight: "600",
  color: "var(--text-secondary)",
  display: "block",
  marginBottom: "6px",
};

const inputStyle: React.CSSProperties = {
  backgroundColor: "var(--bg-tertiary)",
  border: "1px solid var(--border-color)",
  borderRadius: "8px",
  padding: "10px 14px",
  color: "#fff",
  width: "100%",
  fontSize: "0.9rem",
  outline: "none",
  fontFamily: "var(--font-family)",
  marginBottom: "16px",
};

export default function Dashboard() {
  const [activeMenu, setActiveMenu] = useState("front-office");

  // Read URL parameters to auto-launch specific modules (like WhatsApp housekeeping link)
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const moduleQuery = params.get("module");
      if (moduleQuery) {
        setActiveMenu(moduleQuery);
      }
    }
  }, []);

  const [activeProperty, setActiveProperty] = useState("");
  const [timeScale, setTimeScale] = useState<"daily" | "hourly">("daily");

  // Multi-User Staff & Session Authentication states
  const [currentUser, setCurrentUser] = useState<any>(null);

  const hasPermission = (permId: string) => {
    if (!currentUser) return false;
    
    // Super Admins bypass everything
    if (currentUser.role === "Super Admin") return true;

    // If they have explicitly defined custom permissions, STRICTLY rely on that array
    if (currentUser.permissions && Array.isArray(currentUser.permissions)) {
      // If asking for a sub-permission (e.g. staff-management:add), they MUST explicitly have it in the array
      // OR they must have the parent permission and it's something that used to be default.
      // Actually, if we are doing explicit custom permissions, they just need exactly that string in the array.
      // But to be safe for old users who only have 'staff-management', we might assume 'staff-management' implies all sub-permissions IF the sub-permissions aren't listed in the modal yet. But since we are adding them to the modal, they will check them.
      return currentUser.permissions.includes(permId);
    }

    // Default Fallbacks if no custom permissions set yet
    if (currentUser.role === "General Manager") {
      // GM has all these defaults
      const defaults = [
        "front-office", "front-desk", "channel-manager", "housekeeping", "finance", "reviews", "attendance", 
        "attendance:approve-leave", "attendance:approve-swap", "attendance:manual-clock",
        "staff-management", "staff-management:add", "staff-management:edit-shift"
      ];
      return defaults.includes(permId);
    }
    
    if (currentUser.role === "Front Office Manager") {
      const defaults = [
        "front-office", "front-desk", "housekeeping", "reviews", "attendance",
        "attendance:approve-leave", "attendance:approve-swap",
        "staff-management", "staff-management:edit-shift"
      ];
      return defaults.includes(permId);
    }
    
    // Other roles fall back to simple rules
    return false;
  };

  const [usersList, setUsersList] = useState<any[]>([]);
  const [todayAttendance, setTodayAttendance] = useState<any>(null);
  const [allAttendances, setAllAttendances] = useState<any[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<any[]>([]);
  const [shiftSwapRequests, setShiftSwapRequests] = useState<any[]>([]);
  const [showShiftSwapModal, setShowShiftSwapModal] = useState(false);
  const [swapTargetUserId, setSwapTargetUserId] = useState("");
  const [swapProposedShift, setSwapProposedShift] = useState("Morning");
  const [swapReason, setSwapReason] = useState("");
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [leaveStartDate, setLeaveStartDate] = useState("");
  const [leaveEndDate, setLeaveEndDate] = useState("");
  const [leaveReason, setLeaveReason] = useState("");
  const [showProfileSwitcher, setShowProfileSwitcher] = useState(false);
  const [authenticatingUser, setAuthenticatingUser] = useState<any>(null);
  const [authPassword, setAuthPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSuccess, setAuthSuccess] = useState(false);

  // Dynamic staff creation inputs
  const [newStaffName, setNewStaffName] = useState("");
  const [newStaffUsername, setNewStaffUsername] = useState("");
  const [newStaffPassword, setNewStaffPassword] = useState("");
  const [justCreatedStaff, setJustCreatedStaff] = useState<{name: string, pin: string} | null>(null);
  const [newStaffRole, setNewStaffRole] = useState("Front Office Clerk");
  const [customStaffRole, setCustomStaffRole] = useState("");
  const [newStaffAvatar, setNewStaffAvatar] = useState("");
  const [newStaffPropertyId, setNewStaffPropertyId] = useState("");
  const [editingShiftUserId, setEditingShiftUserId] = useState<string | null>(null);
  const [editingPermissionsUserId, setEditingPermissionsUserId] = useState<string | null>(null);
  const [editPermissionsValue, setEditPermissionsValue] = useState<string[]>([]);
  const [isUpdatingPermissions, setIsUpdatingPermissions] = useState(false);
  const [editShiftValue, setEditShiftValue] = useState("Morning");
  const [editShiftTimingValue, setEditShiftTimingValue] = useState("");
  const [isUpdatingShift, setIsUpdatingShift] = useState(false);
  

  const handleUpdatePermissions = async (userId: string) => {
    setIsUpdatingPermissions(true);
    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          permissions: editPermissionsValue,
        }),
      });
      const data = await res.json();
      if (data.success) {
        // Find a way to add toast, here we assume showToast or addToast exists (it's called addToast in this file)
        if (typeof (window as any).addToast === 'function') (window as any).addToast("✅ Permissions updated successfully");
        setUsersList(usersList.map(u => u.id === userId ? { ...u, permissions: editPermissionsValue } : u));
        setEditingPermissionsUserId(null);
      } else {
        console.error("Failed to update permissions");
      }
    } catch (e) {
      console.error("Failed to update permissions", e);
    } finally {
      setIsUpdatingPermissions(false);
    }
  };

  const handleUpdateShift = async (userId: string) => {
    setIsUpdatingShift(true);
    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assignedShift: editShiftValue,
          shiftTiming: editShiftValue === "Custom" ? editShiftTimingValue : null,
        }),
      });
      const data = await res.json();
      if (data.success) {
        addToast("✅ Shift updated successfully");
        setEditingShiftUserId(null);
        fetchUsers();
      } else {
        addToast("⚠️ " + data.error, "error");
      }
    } catch (err) {
      addToast("⚠️ Failed to update shift", "error");
    } finally {
      setIsUpdatingShift(false);
    }
  };


  // Onboarding Wizard states
  const [onboardingName, setOnboardingName] = useState("");
  const [onboardingUsername, setOnboardingUsername] = useState("");
  const [onboardingPassword, setOnboardingPassword] = useState("");
  const [onboardingConfirmPassword, setOnboardingConfirmPassword] = useState("");
  const [onboardingShowPassword, setOnboardingShowPassword] = useState(false);
  const [onboardingError, setOnboardingError] = useState<string | null>(null);
  const [onboardingSubmitting, setOnboardingSubmitting] = useState(false);

  // Role permissions override
  const [tabOverrides, setTabOverrides] = useState<Record<string, boolean>>({});
  const [overridePassword, setOverridePassword] = useState("");
  const [overrideError, setOverrideError] = useState<string | null>(null);

  // General Manager Channel Manager unlock states
  const [channelManagerUnlocked, setChannelManagerUnlocked] = useState(false);
  const [gmPasswordInput, setGmPasswordInput] = useState("");
  const [gmError, setGmError] = useState<string | null>(null);

  // Settings sub-tab state
  const [settingsSubTab, setSettingsSubTab] = useState<"system" | "attendance" | "permissions">("system");

  
  // Store property rooms and reservations in local state
  const [loading, setLoading] = useState(true);
  const [propertiesList, setPropertiesList] = useState<any[]>([]);
  const [propertyRooms, setPropertyRooms] = useState<Record<string, Room[]>>({});
  const [allReservations, setAllReservations] = useState<Record<string, Reservation[]>>({});
  
  const [selectedRes, setSelectedRes] = useState<Reservation | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastType, setToastType] = useState<"success" | "error" | "warning">("success");
  const [notificationsList, setNotificationsList] = useState<any[]>([]);

  // Modals visibility states
  const [showPropertyModal, setShowPropertyModal] = useState(false);
  const [showRoomModal, setShowRoomModal] = useState(false);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [showEditRoomModal, setShowEditRoomModal] = useState(false);
  const [selectedRoomToEdit, setSelectedRoomToEdit] = useState<any>(null);

  // Property Form Inputs
  const [newPropName, setNewPropName] = useState("");
  const [newPropType, setNewPropType] = useState("homestay");
  const [newPropLocation, setNewPropLocation] = useState("");
  const [newPropGstNumber, setNewPropGstNumber] = useState("");

  // Room Form Inputs
  const [newRoomNumber, setNewRoomNumber] = useState("");
  const [newRoomName, setNewRoomName] = useState("");
  const [newRoomType, setNewRoomType] = useState("Standard Room");
  const [newRoomPrice, setNewRoomPrice] = useState("");

  const [editRoomNumber, setEditRoomNumber] = useState("");
  const [editRoomName, setEditRoomName] = useState("");
  const [editRoomType, setEditRoomType] = useState("Standard Room");
  const [editRoomPrice, setEditRoomPrice] = useState("");

  // Booking Form Inputs
  const [newResGuestName, setNewResGuestName] = useState("");
  const [newResRoomId, setNewResRoomId] = useState("");
  const [newResStartIndex, setNewResStartIndex] = useState(0);
  const [newResDate, setNewResDate] = useState("2026-05-20"); // Arrival date picker — base date is May 20 2026
  const [newResDuration, setNewResDuration] = useState(2);
  const [newResStatus, setNewResStatus] = useState<"checked-in" | "confirmed" | "pending" | "maintenance">("confirmed");
  const [newResDetails, setNewResDetails] = useState("");
  const [newResIsGroup, setNewResIsGroup] = useState(false);
  const [newResGroupName, setNewResGroupName] = useState("");
  const [newResBillingItems, setNewResBillingItems] = useState<{ name: string; amount: number; category: string }[]>([
    { name: "Room Tariff", amount: 4500, category: "room" }
  ]);
  const [newResGstMode, setNewResGstMode] = useState<"exclusive" | "inclusive">("exclusive");
  const [newResBillingType, setNewResBillingType] = useState<"individual" | "corporate">("individual");
  const [newResGuestGstNumber, setNewResGuestGstNumber] = useState("");
  // For flexible bookings in daily mode: an optional preferred check-in time slot
  const [newResCheckInTime, setNewResCheckInTime] = useState("");

  // Multi-step Wizard & Guest profile state hooks
  const [newResStep, setNewResStep] = useState(1);
  const [newResPhone, setNewResPhone] = useState("");
  const [newResEmail, setNewResEmail] = useState("");
  const [newResDob, setNewResDob] = useState("");
  const [newResNationality, setNewResNationality] = useState("Indian");

  // Primary ID Verification
  const [newResIdType, setNewResIdType] = useState("Aadhaar Card");
  const [newResIdNumber, setNewResIdNumber] = useState("");
  const [newResIdScanData, setNewResIdScanData] = useState("");

  // Foreign National - Form C Requirements
  const [newResPassportNumber, setNewResPassportNumber] = useState("");
  const [newResPassportPlace, setNewResPassportPlace] = useState("");
  const [newResPassportIssueDate, setNewResPassportIssueDate] = useState("");
  const [newResPassportExpiryDate, setNewResPassportExpiryDate] = useState("");
  const [newResVisaNumber, setNewResVisaNumber] = useState("");
  const [newResVisaType, setNewResVisaType] = useState("");
  const [newResVisaExpiryDate, setNewResVisaExpiryDate] = useState("");
  const [newResIndiaArrivalDate, setNewResIndiaArrivalDate] = useState("");
  const [newResPortOfEntry, setNewResPortOfEntry] = useState("");
  const [newResArrivedFrom, setNewResArrivedFrom] = useState("");
  const [newResProceedingTo, setNewResProceedingTo] = useState("");

  // Stay & Occupants Metadata
  const [newResCheckOutTime, setNewResCheckOutTime] = useState("");
  const [newResNumAdults, setNewResNumAdults] = useState(1);
  const [newResNumChildren, setNewResNumChildren] = useState(0);
  const [newResChildAges, setNewResChildAges] = useState<string[]>([]);
  const [newResVehicleNumber, setNewResVehicleNumber] = useState("");

  // Billing, Preferences & VIP Tags
  const [newResPaymentMethod, setNewResPaymentMethod] = useState("Pay at Property");
  const [newResUpiTransactionId, setNewResUpiTransactionId] = useState("");
  const [newResSpecialRequests, setNewResSpecialRequests] = useState("");
  const [newResGuestTag, setNewResGuestTag] = useState("");

  // Helpers: bidirectional sync between Arrival Date picker and startIndex
  const BASE_DATE = new Date(2026, 4, 20); // May 20, 2026
  const indexToDate = (idx: number): string => {
    const d = new Date(2026, 4, 20);
    d.setDate(d.getDate() + idx);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };
  const dateToIndex = (dateStr: string): number => {
    if (!dateStr) return 0;
    const parts = dateStr.split("-").map(Number);
    const picked = new Date(parts[0], parts[1] - 1, parts[2]);
    const base = new Date(2026, 4, 20);
    const diff = Math.round((picked.getTime() - base.getTime()) / 86400000);
    return Math.min(Math.max(diff, 0), 13);
  };
  // Called when the date picker changes — syncs startIndex
  const handleResDateChange = (dateStr: string) => {
    setNewResDate(dateStr);
    setNewResStartIndex(dateToIndex(dateStr));
  };
  // Called when the startIndex dropdown changes — syncs date picker
  const handleResStartIndexChange = (idx: number) => {
    setNewResStartIndex(idx);
    setNewResDate(indexToDate(idx));
  };

  // Temporary charge inputs inside reservation modal
  const [tempChargeName, setTempChargeName] = useState("");
  const [tempChargeAmount, setTempChargeAmount] = useState("");
  const [tempChargeCategory, setTempChargeCategory] = useState("service");

  // Auto-dismiss toast — errors stay 5s, others 3s
  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => {
        setToastMessage(null);
      }, toastType === "error" ? 5000 : 3000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage, toastType]);

  const addToast = (msg: string, type: "success" | "error" | "warning" = "success") => {
    setToastMessage(msg);
    setToastType(type);
  };

  // Fetch properties and structure states on mount
  async function loadData() {
    try {
      setLoading(true);
      const response = await fetch("/api/properties");
      const data = await response.json();
      if (data.success) {
        setPropertiesList(data.properties);
        if (data.properties.length > 0) {
          setNewStaffPropertyId((prev) => prev || data.properties[0].id);
        }
        const roomsMap: Record<string, Room[]> = {};
        const reservationsMap: Record<string, Reservation[]> = {};

        data.properties.forEach((property: any) => {
          const propKey = mapPropertyKey(property.name);
          
          roomsMap[propKey] = property.rooms.map((room: any) => ({
            id: room.id,
            number: room.number,
            name: room.name,
            type: room.type,
            basePrice: room.basePrice,
          }));

          reservationsMap[propKey] = property.rooms.flatMap((room: any, roomIndex: number) =>
            room.reservations.map((res: any) => ({
              ...res,
              roomIndex: roomIndex,
              details: res.details || "",
              groupName: res.groupName || "",
              bookingType: (res.bookingType || "daily") as "daily" | "hourly",
              billingItems: res.billingItems.map((item: any) => ({
                id: item.id,
                name: item.name,
                amount: item.amount,
                category: item.category,
                invoiceGroup: item.invoiceGroup,
              })),
            }))
          );
        });

        setPropertyRooms(roomsMap);
        setAllReservations(reservationsMap);

        // Intelligently set active property
        const keys = Object.keys(roomsMap);
        if (keys.length > 0) {
          if (!activeProperty || !roomsMap[activeProperty]) {
            setActiveProperty(keys[0]);
          }
        } else {
          setActiveProperty("");
        }
        await fetchNotifications();
      } else {
        throw new Error(data.error || "Failed to load database records");
      }
    } catch (err: any) {
      addToast("Connection Error|Could not load hotel data. Please refresh the page or check your internet connection.", "error");
      console.error("Load data error:", err);
    } finally {
      setLoading(false);
    }
  }

  async function fetchUsers() {
    try {
      const res = await fetch("/api/users");
      const data = await res.json();
      if (data.success) {
        setUsersList(data.users);
        // Sync allowRoomManagement into current session reactively
        setCurrentUser((prev: any) => {
          if (!prev) return prev;
          const freshRecord = data.users.find((u: any) => u.id === prev.id);
          if (freshRecord && freshRecord.allowRoomManagement !== prev.allowRoomManagement) {
            const merged = { ...prev, allowRoomManagement: freshRecord.allowRoomManagement };
            localStorage.setItem("aether_pms_user", JSON.stringify(merged));
            return merged;
          }
          return prev;
        });
      }
    } catch (err) {
      console.error("Failed to load staff list:", err);
    }
  }

  async function handleToggleRoomManagement(userId: string, currentVal: boolean) {
    const newVal = !currentVal;
    // Optimistic update in usersList
    setUsersList((prev: any[]) =>
      prev.map((u: any) => u.id === userId ? { ...u, allowRoomManagement: newVal } : u)
    );
    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ allowRoomManagement: newVal }),
      });
      const data = await res.json();
      if (data.success) {
        addToast(newVal
          ? `✅ Room Management ENABLED for ${data.user.name}.`
          : `🔒 Room Management DISABLED for ${data.user.name}.`
        );
        // Immediately sync if the toggled user is the active session
        setCurrentUser((prev: any) => {
          if (!prev || prev.id !== userId) return prev;
          const merged = { ...prev, allowRoomManagement: newVal };
          localStorage.setItem("aether_pms_user", JSON.stringify(merged));
          return merged;
        });
      } else {
        throw new Error(data.error || "Update failed");
      }
    } catch (err: any) {
      addToast("Permission Update Failed|Could not change staff permissions. Please try again.", "error");
      // Rollback optimistic update
      setUsersList((prev: any[]) =>
        prev.map((u: any) => u.id === userId ? { ...u, allowRoomManagement: currentVal } : u)
      );
    }
  }

  async function fetchNotifications() {
    try {
      const res = await fetch("/api/notifications");
      const data = await res.json();
      if (data.success) {
        setNotificationsList(data.notifications);
      }
    } catch (err) {
      console.error("Failed to fetch notifications:", err);
    }
  }

  async function handleClearNotifications() {
    try {
      const res = await fetch("/api/notifications", { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        setNotificationsList([]);
        addToast("🔔 Notifications cleared.");
      } else {
        throw new Error(data.error || "Failed to clear notifications");
      }
    } catch (err: any) {
      addToast("Clear Failed|Could not clear notifications. Please try again.", "error");
    }
  }

  async function fetchAttendance() {
    try {
      const today = new Date().toISOString().split("T")[0];
      const res = await fetch("/api/attendance?date=" + today);
      const data = await res.json();
      if (data.success) {
        setAllAttendances(data.attendances);
      }
    } catch (err) {
      console.error("Failed to fetch attendance:", err);
    }
  }

  async function fetchShiftSwapRequests() {
    try {
      const res = await fetch("/api/shift-swap");
      const data = await res.json();
      if (!data.error) {
        setShiftSwapRequests(data.requests || []);
      }
    } catch (err) {
      console.error("Failed to fetch shift swap requests:", err);
    }
  }

  async function fetchLeaveRequests() {
    try {
      const res = await fetch("/api/leave");
      const data = await res.json();
      if (!data.error) {
        setLeaveRequests(data);
      }
    } catch (err) {
      console.error("Failed to fetch leave requests:", err);
    }
  }

  useEffect(() => {
    if (currentUser && allAttendances.length > 0) {
      const myAtt = allAttendances.find((a: any) => a.userId === currentUser.id && !a.clockOut);
      setTodayAttendance(myAtt || null);
    } else {
      setTodayAttendance(null);
    }
  }, [currentUser, allAttendances]);

  const handleClockInOut = async (type: "clockIn" | "clockOut") => {
    if (!currentUser) return;
    try {
      let shift = "Morning";
      if (type === "clockIn") {
        const hours = new Date().getHours();
        if (hours >= 5 && hours < 14) shift = "Morning";
        else if (hours >= 14 && hours < 22) shift = "Evening";
        else shift = "Night";
      }
      const res = await fetch("/api/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: currentUser.id, type, shift })
      });
      const data = await res.json();
      if (data.success) {
        addToast(type === "clockIn" ? "✅ Successfully Clocked In for the day!" : "✅ Clocked Out successfully.");
        fetchAttendance();
      } else {
        addToast("⚠️ " + data.error, "error");
      }
    } catch (err) {
      addToast("Failed to update attendance", "error");
    }
  }

  const handleOwnerMarkAttendance = async (staffId: string) => {
    try {
      const hours = new Date().getHours();
      let shift = "Morning";
      if (hours >= 5 && hours < 14) shift = "Morning";
      else if (hours >= 14 && hours < 22) shift = "Evening";
      else shift = "Night";

      const res = await fetch("/api/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: staffId, type: "manual", markedBy: "Owner", shift })
      });
      const data = await res.json();
      if (data.success) {
        addToast("✅ Marked attendance successfully.");
        fetchAttendance();
      } else {
        addToast("⚠️ " + data.error, "error");
      }
    } catch (err) {
      addToast("Failed to mark attendance", "error");
    }
  }

  const handleCreateLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/leave", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: currentUser.id, startDate: leaveStartDate, endDate: leaveEndDate, reason: leaveReason })
      });
      const data = await res.json();
      if (!data.error) {
        addToast("Leave request submitted successfully.");
        setShowLeaveModal(false);
        setLeaveStartDate("");
        setLeaveEndDate("");
        setLeaveReason("");
        fetchLeaveRequests();
    fetchShiftSwapRequests();
      } else {
        addToast("Error submitting leave request: " + data.error, "error");
      }
    } catch (err) {
      addToast("Failed to submit leave request", "error");
    }
  }

  const handleUpdateLeave = async (id: string, status: string) => {
    try {
      const res = await fetch("/api/leave", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status })
      });
      const data = await res.json();
      if (!data.error) {
        addToast("Leave request " + status.toLowerCase() + ".");
        fetchLeaveRequests();
      } else {
        addToast("Error updating leave request: " + data.error, "error");
      }
    } catch (err) {
      addToast("Failed to update leave request", "error");
    }
  }

  useEffect(() => {
    const saved = localStorage.getItem("aether_pms_user");
    if (saved) {
      try {
        setCurrentUser(JSON.parse(saved));
      } catch (e) {
        console.error(e);
      }
    }
    loadData();
    fetchUsers();
    fetchAttendance();
    fetchLeaveRequests();

    // Poll for permission changes every 5 seconds so revoked managers see UI updates without reload
    const pollInterval = setInterval(() => {
      fetchUsers();
    }, 5000);
    return () => clearInterval(pollInterval);
  }, []);

  // Reactive lock: bind activeProperty slug to assigned property branch for staff members
  useEffect(() => {
    if (currentUser && currentUser.role !== "Super Admin" && propertiesList.length > 0) {
      const assigned = propertiesList.find((p) => p.id === currentUser.propertyId);
      if (assigned) {
        setActiveProperty(mapPropertyKey(assigned.name));
      } else {
        setActiveProperty("");
      }
    }
  }, [currentUser, propertiesList]);

  // Reset General Manager Channel Manager unlocked status when operator changes
  useEffect(() => {
    setChannelManagerUnlocked(false);
    setGmPasswordInput("");
    setGmError(null);
  }, [currentUser]);

  // Reactive redirect: If the active user has no permission to access the currently activeMenu,
  // automatically redirect them to their first allowed menu.
  useEffect(() => {
    if (currentUser) {
      const isAllowed = checkTabPermission(activeMenu);
      if (!isAllowed) {
        const firstPermitted = ["front-office", "housekeeping", "channel-manager", "finance", "settings"].find(menuId => checkTabPermission(menuId));
        if (firstPermitted) {
          setActiveMenu(firstPermitted);
        }
      }
    }
  }, [currentUser, activeMenu]);


  const handleUpdateReservation = async (updatedRes: Reservation) => {
    const previousReservations = { ...allReservations };
    setAllReservations((prev) => ({
      ...prev,
      [activeProperty]: prev[activeProperty].map((r) => (r.id === updatedRes.id ? updatedRes : r)),
    }));

    try {
      const response = await fetch(`/api/reservations/${updatedRes.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomId: updatedRes.roomId,
          startIndex: updatedRes.startIndex,
          status: updatedRes.status,
          guestName: updatedRes.guestName,
          details: updatedRes.details,
          duration: updatedRes.duration,
          isGroup: updatedRes.isGroup,
          groupName: updatedRes.groupName,
        }),
      });

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || "Failed to save reservation details");
      }
    } catch (err: any) {
      const errMsg = err.message || "Could not save reservation details.";
      if (errMsg.includes("|")) {
        addToast(errMsg, "error");
      } else {
        addToast(`Save Failed|${errMsg}`, "error");
      }
      setAllReservations(previousReservations);
    }
  };

  // 1. CREATE PROPERTY BRANCH
  const handleCreateProperty = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPropName || !newPropLocation) {
      addToast("⚠️ Please fill in all fields.");
      return;
    }

    if (newPropGstNumber) {
      const gstRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
      if (!gstRegex.test(newPropGstNumber)) {
        addToast("Invalid Property GSTIN format. Example: 07AAAAA0000A1Z5", "error");
        return;
      }
    }

    try {
      const response = await fetch("/api/properties", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newPropName,
          type: newPropType,
          location: newPropLocation,
          gstNumber: newPropGstNumber,
        }),
      });
      const data = await response.json();
      if (data.success) {
        addToast(`🏢 Property "${newPropName}" created successfully!`);
        setShowPropertyModal(false);
        setNewPropName("");
        setNewPropLocation("");
        setNewPropGstNumber("");
        const newKey = mapPropertyKey(newPropName);
        setActiveProperty(newKey);
        await loadData();
      } else {
        throw new Error(data.error || "Failed to create property.");
      }
    } catch (err: any) {
      addToast("Property Error|Could not create the property. Please try again.", "error");
      console.error("Property creation error:", err);
    }
  };

  // 2. CREATE ROOM IN PROPERTY
  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoomNumber || !newRoomName) {
      addToast("⚠️ Please fill in number and name.");
      return;
    }

    const activePropDetails = propertiesList.find(p => mapPropertyKey(p.name) === activeProperty);
    if (!activePropDetails) {
      addToast("❌ Active property not found.");
      return;
    }

    try {
      const response = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          number: newRoomNumber,
          name: newRoomName,
          type: newRoomType,
          propertyId: activePropDetails.id,
          staffName: currentUser ? `${currentUser.name} (${currentUser.role})` : "System",
          propertyName: activePropDetails.name,
          basePrice: newRoomPrice ? parseFloat(newRoomPrice) : 0,
        }),
      });
      const data = await response.json();
      if (data.success) {
        addToast(`🔑 Room ${newRoomNumber} added to branch!`);
        setShowRoomModal(false);
        setNewRoomNumber("");
        setNewRoomName("");
        setNewRoomPrice("");
        await loadData();
      } else {
        throw new Error(data.error || "Failed to create room.");
      }
    } catch (err: any) {
      addToast("Room Error|Could not add the room. Please make sure the room number is unique and try again.", "error");
      console.error("Room creation error:", err);
    }
  };

  // UPDATE ROOM DETAILS Persistent API Call
  const handleUpdateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRoomToEdit || !editRoomNumber || !editRoomName) {
      addToast("⚠️ Please fill in room number and name.");
      return;
    }

    try {
      const response = await fetch(`/api/rooms/${selectedRoomToEdit.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          number: editRoomNumber,
          name: editRoomName,
          type: editRoomType,
          basePrice: editRoomPrice ? parseFloat(editRoomPrice) : 0,
        }),
      });
      const data = await response.json();
      if (data.success) {
        addToast(`💾 Room ${editRoomNumber} details updated persistently!`);
        setShowEditRoomModal(false);
        setSelectedRoomToEdit(null);
        await loadData();
      } else {
        throw new Error(data.error || "Failed to update room details.");
      }
    } catch (err: any) {
      addToast("Room Update Failed|The room details could not be saved. Please try again.", "error");
      console.error("Room update error:", err);
    }
  };

  const handleToggleRoomMaintenance = async (room: any) => {
    const isSeniorStaff =
      currentUser?.role === "Super Admin" ||
      currentUser?.role === "General Manager";
    
    if (!isSeniorStaff) {
      addToast("🚫 Permission Denied: Only Super Admins and General Managers can alter room maintenance statuses.", "error");
      return;
    }

    const activeResList = allReservations[activeProperty] || [];
    const maintenanceBlock = activeResList.find(
      (res) => res.roomId === room.id && res.status === "maintenance"
    );

    if (maintenanceBlock) {
      if (!window.confirm(`🔧 Do you want to RELEASE Room ${room.number} back to active guest booking service? This will delete the active maintenance block.`)) {
        return;
      }

      try {
        const response = await fetch(`/api/reservations/${maintenanceBlock.id}`, {
          method: "DELETE",
        });
        const data = await response.json();
        if (data.success || response.ok) {
          addToast(`🟢 Room ${room.number} released to service successfully!`);
          setShowEditRoomModal(false);
          setSelectedRoomToEdit(null);
          await loadData();
        } else {
          throw new Error(data.error || "Failed to release room from maintenance.");
        }
      } catch (err: any) {
        addToast(`❌ Release Failed: ${err.message}`, "error");
      }
    } else {
      const overlappingGuest = activeResList.find(
        (res) =>
          res.roomId === room.id &&
          res.status !== "maintenance" &&
          (res.bookingType || "daily") === timeScale &&
          Math.max(0, res.startIndex) < Math.min(7, res.startIndex + res.duration)
      );

      if (overlappingGuest) {
        if (!window.confirm(`⚠️ Warning: Room ${room.number} is occupied or booked by "${overlappingGuest.guestName}" within the next 7 days. Setting maintenance will overlap with their stay. Proceed anyway?`)) {
          return;
        }
      } else {
        if (!window.confirm(`🛠️ Are you sure you want to place Room ${room.number} OUT OF ORDER for a 7-day maintenance block?`)) {
          return;
        }
      }

      try {
        const response = await fetch("/api/reservations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            guestName: "Room Maintenance Block",
            roomId: room.id,
            startIndex: 0,
            duration: 7,
            status: "maintenance",
            details: "Scheduled room maintenance & preventative inspection.",
            isGroup: false,
            bookingType: timeScale,
            billingItems: [],
          }),
        });
        const data = await response.json();
        if (data.success) {
          addToast(`🛠️ Room ${room.number} placed OUT OF ORDER persistently!`);
          setShowEditRoomModal(false);
          setSelectedRoomToEdit(null);
          await loadData();
        } else {
          throw new Error(data.error || "Failed to create maintenance block.");
        }
      } catch (err: any) {
        addToast(`❌ Maintenance Block Failed: ${err.message}`, "error");
      }
    }
  };

  // 3. CREATE BOOKING / RESERVATION
  const handleCreateReservation = async (e: React.FormEvent) => {
    e.preventDefault();
    const assignedRoomId = newResRoomId || currentRooms[0]?.id;
    if (!newResGuestName || !assignedRoomId) {
      addToast("⚠️ Please fill in Guest Name and select a Room.");
      return;
    }

    const assignedRoom = currentRooms.find(r => r.id === assignedRoomId);
    if (assignedRoom && assignedRoom.cleanStatus === "Dirty") {
      if (!window.confirm(`Housekeeping Alert: Room ${assignedRoom.number} is marked as "Dirty". Please ensure it is cleaned. Do you want to proceed with this booking anyway?`)) {
        return;
      }
    }

    const todayIndex = Math.floor(
      (new Date().setHours(0, 0, 0, 0) - BASE_DATE.setHours(0, 0, 0, 0)) /
        (1000 * 60 * 60 * 24)
    );
    if (newResStartIndex < todayIndex) {
      addToast("Past Date Restriction|You cannot create a booking that starts in the past. Please select today or a future date.", "error");
      return;
    }

    // 1. PAN Card Block Validation
    if (newResIdType === "PAN" || newResIdType === "PAN Card") {
      addToast("Validation Error|PAN Cards are explicitly not accepted as valid proof of identity for hotel check-ins in India.", "error");
      return;
    }

    // Corporate GSTIN Validation
    if (newResBillingType === "corporate" && newResGuestGstNumber) {
      const gstRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
      if (!gstRegex.test(newResGuestGstNumber)) {
        addToast("Invalid Corporate GSTIN format. Example: 07AAAAA0000A1Z5", "error");
        return;
      }
    }

    // 2. Age Verification Validation (>= 18 years old)
    if (newResDob) {
      const birthDate = new Date(newResDob);
      const today = new Date();
      let age = today.getFullYear() - birthDate.getFullYear();
      const m = today.getMonth() - birthDate.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }
      if (age < 18) {
        addToast("Age Restricted|Primary guest must be 18 years or older to book.", "error");
        return;
      }
    }

    // Frontend Overlap Check
    const activeResList = allReservations[activeProperty] || [];
    const proposedStart = newResStartIndex;
    const proposedEnd = newResStartIndex + newResDuration;

    const overlap = activeResList.find(
      (res) =>
        res.roomId === assignedRoomId &&
        res.status !== "checked-out" &&
        res.status !== "cancelled" &&
        (res.bookingType || "daily") === timeScale &&
        Math.max(proposedStart, res.startIndex) < Math.min(proposedEnd, res.startIndex + res.duration)
    );

    if (overlap) {
      addToast(
        `Room Occupied|This room is already booked by "${overlap.guestName}" during this period. Please choose another date or room.`,
        "error"
      );
      return;
    }

    try {
      const response = await fetch("/api/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guestName: newResGuestName,
          roomId: assignedRoomId,
          startIndex: newResStartIndex,
          duration: newResDuration,
          status: newResStatus,
          details: newResCheckInTime
            ? `${newResDetails ? newResDetails + "\n" : ""}Flexible Check-in: ${newResCheckInTime}\n[GST:${newResGstMode}]`.trim()
            : `${newResDetails ? newResDetails + "\n" : ""}[GST:${newResGstMode}]`.trim(),
          isGroup: newResIsGroup,
          groupName: newResIsGroup ? newResGroupName : "",
          bookingType: timeScale,
          billingItems: newResBillingItems,
          billingType: newResBillingType,
          guestGstNumber: newResBillingType === "corporate" ? newResGuestGstNumber : null,

          // Contact Information
          phone: newResPhone,
          email: newResEmail,
          dob: newResDob,
          nationality: newResNationality,

          // Primary ID Verification
          idType: newResIdType,
          idNumber: newResIdNumber,
          idScanData: newResIdScanData,

          // Foreign National - Form C Requirements
          passportNumber: newResPassportNumber,
          passportPlace: newResPassportPlace,
          passportIssueDate: newResPassportIssueDate,
          passportExpiryDate: newResPassportExpiryDate,
          visaNumber: newResVisaNumber,
          visaType: newResVisaType,
          visaExpiryDate: newResVisaExpiryDate,
          indiaArrivalDate: newResIndiaArrivalDate,
          portOfEntry: newResPortOfEntry,
          arrivedFrom: newResArrivedFrom,
          proceedingTo: newResProceedingTo,

          // Stay & Occupants Metadata
          checkInTime: newResCheckInTime,
          checkOutTime: newResCheckOutTime,
          numAdults: newResNumAdults,
          numChildren: newResNumChildren,
          childAges: newResChildAges.join(","),
          vehicleNumber: newResVehicleNumber,

          // Billing, Preferences & VIP Tags
          paymentMethod: newResPaymentMethod,
          upiTransactionId: newResUpiTransactionId,
          specialRequests: newResSpecialRequests,
          guestTag: newResGuestTag,
        }),
      });
      const data = await response.json();
      if (data.success) {
        addToast(`📅 Booking for "${newResGuestName}" registered persistently!`);

        // --- OUTBOUND OTA CHANNEL SYNC PIPELINE ---
        const currentPropertyId = propertiesList.find((p) => mapPropertyKey(p.name) === activeProperty)?.id || "";
        const targetRoomId = assignedRoomId;
        const targetStartIndex = newResStartIndex;
        const targetDuration = newResDuration;
        const targetGuestName = newResGuestName;

        if (currentPropertyId) {
          (async () => {
            try {
              const chanRes = await fetch(`/api/channels?propertyId=${currentPropertyId}`);
              const chanData = await chanRes.json();
              if (chanData.success && Array.isArray(chanData.channels)) {
                const connectedChannels = chanData.channels.filter((c: any) => c.connected);
                const roomObj = currentRooms.find((r: any) => r.id === targetRoomId);
                const roomName = roomObj ? `Room ${roomObj.number} (${roomObj.name})` : "Assigned Room Unit";

                const dates: string[] = [];
                const baseDate = new Date("2026-05-20T00:00:00");
                for (let i = 0; i < targetDuration; i++) {
                  const d = new Date(baseDate);
                  d.setDate(baseDate.getDate() + targetStartIndex + i);
                  dates.push(d.toISOString().split("T")[0]);
                }

                for (const channel of connectedChannels) {
                  const gatewayRes = await fetch("/api/channels/mock-ota-gateway", {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                      "Authorization": `Bearer ${channel.apiKey}`
                    },
                    body: JSON.stringify({
                      channelName: channel.name,
                      listingId: channel.listingId,
                      apiKey: channel.apiKey,
                      action: "push_inventory",
                      roomName,
                      dates,
                      value: 0
                    })
                  });

                  const gatewayData = await gatewayRes.json();
                  if (gatewayRes.status === 200 && gatewayData.success) {
                    await fetch("/api/channels", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        channelId: channel.id,
                        action: "log_inventory_push",
                        propertyId: currentPropertyId,
                        status: "success",
                        message: `[🚀 Webhook Outbound Push] Synced inventory lock for Direct Guest "${targetGuestName}" in room "${roomName}" across dates [${dates.join(", ")}]. Connected OTA Status: ${gatewayData.status}.`
                      })
                    });
                  } else {
                    await fetch("/api/channels", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        channelId: channel.id,
                        action: "log_inventory_push",
                        propertyId: currentPropertyId,
                        status: "warning",
                        message: `[⚠️ Outbound Push Failed] Attempted to push direct guest "${targetGuestName}" reservation in room "${roomName}" to ${channel.name} but gateway rejected request: ${gatewayData.error || "Handshake mismatch"}`
                      })
                    });
                  }
                }
              }
            } catch (err) {
              console.error("Outbound synchronization failed:", err);
            }
          })();
        }
        // --- END OUTBOUND OTA CHANNEL SYNC PIPELINE ---

        setShowBookingModal(false);
        setNewResStep(1);
        setNewResGuestName("");
        setNewResDetails("");
        setNewResIsGroup(false);
        setNewResGroupName("");
        setNewResCheckInTime("");
        setNewResDate("2026-05-20");
        setNewResStartIndex(0);
        setNewResPhone("");
        setNewResEmail("");
        setNewResDob("");
        setNewResNationality("Indian");
        setNewResIdType("Aadhaar Card");
        setNewResIdNumber("");
        setNewResIdScanData("");
        setNewResPassportNumber("");
        setNewResPassportPlace("");
        setNewResPassportIssueDate("");
        setNewResPassportExpiryDate("");
        setNewResVisaNumber("");
        setNewResVisaType("");
        setNewResVisaExpiryDate("");
        setNewResIndiaArrivalDate("");
        setNewResPortOfEntry("");
        setNewResArrivedFrom("");
        setNewResProceedingTo("");
        setNewResCheckOutTime("");
        setNewResNumAdults(1);
        setNewResNumChildren(0);
        setNewResChildAges([]);
        setNewResVehicleNumber("");
        setNewResPaymentMethod("Pay at Property");
        setNewResUpiTransactionId("");
        setNewResSpecialRequests("");
        setNewResGuestTag("");
        setNewResBillingItems([{ name: "Room Tariff", amount: 4500, category: "room" }]);
        setNewResGstMode("exclusive");
        await loadData();
      } else {
        throw new Error(data.error || "Failed to create reservation.");
      }
    } catch (err: any) {
      const errMsg = err.message || "Could not save the booking.";
      if (errMsg.includes("|")) {
        addToast(errMsg, "error");
      } else {
        addToast(`Booking Failed|${errMsg}`, "error");
      }
      console.error("Booking creation error:", err);
    }
  };

  // Open booking modal pre-filled from a calendar grid cell click
  const handleAddBookingAtCell = (roomIdx: number, colIdx: number) => {
    if (currentRooms.length === 0) {
      addToast("⚠️ Please add a Room before booking a guest!");
      return;
    }

    const todayIndex = Math.floor(
      (new Date().setHours(0, 0, 0, 0) - BASE_DATE.setHours(0, 0, 0, 0)) /
        (1000 * 60 * 60 * 24)
    );
    if (colIdx < todayIndex) {
      addToast("Past Date Restriction|You cannot create a booking that starts in the past. Please select today or a future date.", "error");
      return;
    }

    const targetRoom = currentRooms[roomIdx];
    if (!targetRoom) return;

    if (targetRoom.cleanStatus === "Dirty") {
      addToast(`Housekeeping Alert|Room ${targetRoom.number} is marked as "Dirty". Please ensure it is cleaned before the guest arrives.`, "warning");
    }

    setNewResRoomId(targetRoom.id || "");
    setNewResBillingItems([{ name: "Room Rate", amount: targetRoom.basePrice || 0, category: "room" }]);
    setNewResStartIndex(colIdx);
    setNewResDate(indexToDate(colIdx));
    setNewResCheckInTime("");
    setNewResDuration(timeScale === "daily" ? 1 : 1);
    setShowBookingModal(true);
  };

  // Add temporary starting charge to booking wizard
  const handleAddTempCharge = () => {
    if (!tempChargeName || !tempChargeAmount) return;
    setNewResBillingItems((prev) => [
      ...prev,
      { name: tempChargeName, amount: parseFloat(tempChargeAmount), category: tempChargeCategory },
    ]);
    setTempChargeName("");
    setTempChargeAmount("");
  };

  // Remove starting charge from booking wizard
  const handleRemoveTempCharge = (index: number) => {
    setNewResBillingItems((prev) => prev.filter((_, i) => i !== index));
  };

  // VERIFY USER PIN / PASSWORD
  const handleVerifyPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authenticatingUser || !authPassword) return;

    setAuthError(null);
    try {
      const response = await fetch("/api/users/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: authenticatingUser.username,
          password: authPassword,
        }),
      });
      const data = await response.json();
      if (data.success) {
        setAuthSuccess(true);
        setTimeout(() => {
          setCurrentUser(data.user);
          localStorage.setItem("aether_pms_user", JSON.stringify(data.user));
          
          // Reset credentials checker overlay state
          setAuthenticatingUser(null);
          setAuthPassword("");
          setAuthSuccess(false);
          setShowProfileSwitcher(false);
          addToast(`🔑 Session initialized as ${data.user.name} (${data.user.role}).`);

          // Redirect to appropriate module based on role mapping
          if (data.user.role === "Housekeeping Supervisor") {
            setActiveMenu("housekeeping");
          } else if (data.user.role === "Finance Executive") {
            setActiveMenu("finance");
          } else {
            setActiveMenu("front-office");
          }
        }, 800);
      } else {
        throw new Error(data.error || "Incorrect credentials.");
      }
    } catch (err: any) {
      setAuthError(err.message || "Authorization failed.");
      const inputEl = document.getElementById("auth-pin-input");
      if (inputEl) {
        inputEl.classList.add("shake-animation");
        setTimeout(() => inputEl.classList.remove("shake-animation"), 500);
      }
    }
  };

  // UNLOCK CHANNEL MANAGER FOR GENERAL MANAGER
  const handleUnlockChannelManager = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !gmPasswordInput) return;

    setGmError(null);
    try {
      const response = await fetch("/api/users/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: currentUser.username,
          password: gmPasswordInput,
        }),
      });
      const data = await response.json();
      if (data.success) {
        setChannelManagerUnlocked(true);
        addToast("🔓 Channel Manager access unlocked for this shift session.");
      } else {
        throw new Error(data.error || "Incorrect password.");
      }
    } catch (err: any) {
      setGmError(err.message || "Authentication failed.");
      const inputEl = document.getElementById("gm-pin-input");
      if (inputEl) {
        inputEl.classList.add("shake-animation");
        setTimeout(() => inputEl.classList.remove("shake-animation"), 500);
      }
    }
  };

  // REGISTER NEW STAFF USER
  const handleRegisterStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStaffName || !newStaffUsername || !newStaffPassword || !newStaffAvatar) {
      addToast("⚠️ Please enter all staff member details.");
      return;
    }

    const finalRole = newStaffRole === "Other" ? customStaffRole : newStaffRole;

    if (finalRole !== "Super Admin" && !newStaffPropertyId) {
      addToast("⚠️ Please select an Assigned Property for this staff member.");
      return;
    }

    try {
      const response = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newStaffName,
          username: newStaffUsername.toLowerCase().trim(),
          password: newStaffPassword,
          role: finalRole,
          avatar: newStaffAvatar.toUpperCase().substring(0, 2),
          propertyId: finalRole === "Super Admin" ? null : newStaffPropertyId,
        }),
      });
      const data = await response.json();
      if (data.success) {
        addToast(`✅ Staff member "${newStaffName}" registered persistently!`);
        setJustCreatedStaff({ name: newStaffName, pin: newStaffPassword });
        setNewStaffName("");
        setNewStaffUsername("");
        setNewStaffPassword("");
        setNewStaffAvatar("");
        setNewStaffPropertyId(propertiesList[0]?.id || "");
        await fetchUsers();
      } else {
        throw new Error(data.error || "Failed to create user.");
      }
    } catch (err: any) {
      addToast("Registration Failed|Could not register the staff member. Please check the details and try again.", "error");
    }
  };

  // DELETE STAFF USER
  const handleDeleteStaff = async (userId: string, userName: string) => {
    if (!confirm(`Are you sure you want to remove staff member "${userName}"?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/users/${userId}`, { method: "DELETE" });
      const data = await response.json();
      if (data.success) {
        addToast(`👥 Staff member "${userName}" deleted.`);
        
        // If the deleted user is the active session user, log out safely
        if (currentUser?.id === userId) {
          localStorage.removeItem("aether_pms_user");
          setCurrentUser(null);
        }
        
        await fetchUsers();
      } else {
        throw new Error(data.error || "Failed to delete staff profile.");
      }
    } catch (err: any) {
      addToast("Delete Failed|Could not delete this staff member. Please try again.", "error");
    }
  };

  // WIPE ALL STAFF ACCOUNTS
  const handleClearStaffAccounts = async () => {
    if (!confirm("🚨 DANGER: Are you sure you want to delete all staff and administrator profiles? You will be logged out immediately and redirected to the Initial Setup Wizard. This cannot be undone!")) {
      return;
    }

    try {
      setLoading(true);
      const response = await fetch("/api/users/clear", { method: "POST" });
      const data = await response.json();
      if (data.success) {
        addToast("🗑️ All staff accounts wiped successfully.");
        localStorage.removeItem("aether_pms_user");
        setCurrentUser(null);
        setUsersList([]);
      } else {
        throw new Error(data.error || "Wipe failed.");
      }
    } catch (err: any) {
      addToast("Wipe Failed|Could not clear staff accounts. Please try again.", "error");
    } finally {
      setLoading(false);
    }
  };

  // REGISTER SUPER ADMIN ONBOARDING
  const handleOnboardingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setOnboardingError(null);

    if (!onboardingName.trim()) {
      setOnboardingError("Please enter your Full Name.");
      return;
    }
    if (!onboardingUsername.trim()) {
      setOnboardingError("Please enter a username.");
      return;
    }
    if (onboardingPassword.length < 4) {
      setOnboardingError("Password or PIN must be at least 4 characters.");
      return;
    }
    if (onboardingPassword !== onboardingConfirmPassword) {
      setOnboardingError("Passwords do not match.");
      return;
    }

    const calculatedAvatar = (()=>{
      const parts = onboardingName.trim().split(/\s+/);
      if (parts.length >= 2) {
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
      }
      return parts[0] ? parts[0].substring(0, 2).toUpperCase() : "SA";
    })();

    setOnboardingSubmitting(true);
    try {
      const response = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: onboardingName,
          username: onboardingUsername.toLowerCase().trim(),
          password: onboardingPassword,
          role: "Super Admin",
          avatar: calculatedAvatar,
        }),
      });

      const data = await response.json();
      if (data.success) {
        addToast(`👑 Super Admin "${onboardingName}" registered successfully!`);
        
        // Log them in immediately
        setCurrentUser(data.user);
        localStorage.setItem("aether_pms_user", JSON.stringify(data.user));
        
        // Clean onboarding states
        setOnboardingName("");
        setOnboardingUsername("");
        setOnboardingPassword("");
        setOnboardingConfirmPassword("");
        
        await fetchUsers();
        await loadData();
      } else {
        throw new Error(data.error || "Registration failed.");
      }
    } catch (err: any) {
      setOnboardingError(err.message || "An unexpected error occurred during setup.");
    } finally {
      setOnboardingSubmitting(false);
    }
  };

  // SUPER ADMIN OVERRIDE CHECK FOR TABS
  const handleAdminOverride = (menuId: string, e: React.FormEvent) => {
    e.preventDefault();
    setOverrideError(null);

    // Find the Super Admin password dynamically from loaded staff list
    const superAdmin = usersList.find(u => u.role === "Super Admin");
    const correctPassword = superAdmin ? superAdmin.password : "adminpassword";

    if (overridePassword === correctPassword) {
      setTabOverrides(prev => ({ ...prev, [menuId]: true }));
      setOverridePassword("");
      setOverrideError(null);
      addToast(`🔓 Section "${menuId.toUpperCase()}" unlocked via Admin Override.`);
    } else {
      setOverrideError("Invalid Super Admin Override PIN / Password.");
      const el = document.getElementById("override-input");
      if (el) {
        el.classList.add("shake-animation");
        setTimeout(() => el.classList.remove("shake-animation"), 500);
      }
    }
  };

  // 4. WIPE DATABASE
  const handleClearDatabase = async () => {
    if (!confirm("🚨 DANGER: Are you sure you want to delete all database tables? This will delete all properties, rooms, bookings, and splits. This cannot be undone!")) {
      return;
    }

    try {
      setLoading(true);
      const response = await fetch("/api/clear", { method: "POST" });
      const data = await response.json();
      if (data.success) {
        addToast("🗑️ MySQL Database fully wiped.");
        setPropertiesList([]);
        setPropertyRooms({});
        setAllReservations({});
        setActiveProperty("");
        await loadData();
      } else {
        throw new Error(data.error || "Clear failed.");
      }
    } catch (err: any) {
      addToast("Database Wipe Failed|Could not reset the database. Please try again or contact your system administrator.", "error");
    } finally {
      setLoading(false);
    }
  };

  // 5. SEED DATABASE TRIGGER
  const handleSeedDatabase = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/seed");
      const data = await response.json();
      if (data.success) {
        addToast("🌱 Seeded Goan, Manali & Delhi demo branches successfully!");
        await loadData();
      } else {
        throw new Error(data.error || "Seed failed.");
      }
    } catch (err: any) {
      addToast("Demo Seed Failed|Could not load demo hotel data. Please try again.", "error");
    } finally {
      setLoading(false);
    }
  };

  // Check if active user has permission to open a tab
  const checkTabPermission = (menuId: string) => {
    if (!currentUser) return true;
    if (currentUser.role === "Super Admin") return true;

    // Check if an override is active
    if (tabOverrides[menuId]) return true;

    const role = currentUser.role;

    // General Manager has access to everything EXCEPT settings
    if (role === "General Manager") {
      return menuId !== "settings";
    }

    // Receptionist (including Front Office Manager & Finance Executive) has access to front-office, front-desk and housekeeping
    if (role === "Receptionist" || role === "Front Office Manager" || role === "Finance Executive") {
      return ["front-office", "front-desk", "housekeeping", "attendance"].includes(menuId);
    }

    // Housekeeper (including Housekeeping Supervisor & Housekeeper) has access ONLY to housekeeping
    if (role === "Housekeeper" || role === "Housekeeping Supervisor") {
      return menuId === "housekeeping";
    }

    return true;
  };

  // Switch properties cleanly
  const currentRooms = propertyRooms[activeProperty] || [];
  const currentReservations = allReservations[activeProperty] || [];
  const currentProperty = propertiesList.find((p) => mapPropertyKey(p.name) === activeProperty);
  const activePropertyType = currentProperty?.type || "Premium Hotel";

  // Compute Occupancy metrics dynamically based on active property bookings
  const calculateOccupancyStats = () => {
    const total = currentRooms.length;
    const occupied = currentReservations.filter((r) => r.status === "checked-in").length;
    const maintenanceCount = currentReservations.filter((r) => r.status === "maintenance").length;
    const upcomingCount = currentReservations.filter((r) => r.status === "confirmed").length;
    const pct = total > 0 ? Math.round((occupied / total) * 100) : 0;

    return {
      occupancy: pct,
      checkedIn: occupied,
      upcoming: upcomingCount,
      maintenance: maintenanceCount,
    };
  };

  const stats = calculateOccupancyStats();
  const hasProperties = Object.keys(propertyRooms).length > 0;

  if (loading) {
    return (
      <main className={styles.dashboardContainer}>
        <Sidebar activeMenu={activeMenu} setActiveMenu={setActiveMenu} currentUser={currentUser} onProfileClick={() => setShowProfileSwitcher(true)} activePropertyType={activePropertyType} />
        <div className={styles.mainContent} style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
          <div className="glass-card" style={{ padding: "40px", textAlign: "center", maxWidth: "450px", display: "flex", flexDirection: "column", gap: "24px", alignItems: "center" }}>
            <div style={{
              width: "48px",
              height: "48px",
              borderRadius: "50%",
              border: "3px solid rgba(99, 102, 241, 0.1)",
              borderTopColor: "var(--border-focus)",
              animation: "spin 1s linear infinite"
            }} />
            <div>
              <h2 style={{ fontSize: "1.25rem", fontWeight: "600", color: "#fff", marginBottom: "8px" }}>Loading AetherHMS...</h2>
              <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem", lineHeight: "1.5" }}>
                Connecting to the database and loading your property data. Please wait a moment.
              </p>
            </div>
          </div>
        </div>
        {toastMessage && (
          toastType === "error" ? (
            <div className={styles.toastError}>
              <span className={styles.toastErrorIcon}>🚫</span>
              <div>
                <div className={styles.toastErrorTitle}>{toastMessage.split("|")[0]}</div>
                <div className={styles.toastErrorBody}>{toastMessage.split("|")[1] || toastMessage.split("|")[0]}</div>
              </div>
            </div>
          ) : toastType === "warning" ? (
            <div className={styles.toastWarning}>⚠️ {toastMessage}</div>
          ) : (
            <div className={styles.toast}>🔔 {toastMessage}</div>
          )
        )}
      </main>
    );
  }

  // Fullscreen Onboarding Setup Wizard for empty staff tables
  if (usersList.length === 0) {
    const previewInitials = (()=>{
      const parts = onboardingName.trim().split(/\s+/);
      if (parts.length >= 2) {
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
      }
      return parts[0] ? parts[0].substring(0, 2).toUpperCase() : "??";
    })();

    return (
      <main style={{
        minHeight: "100vh",
        width: "100vw",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "radial-gradient(circle at center, #1e1b4b 0%, #0f0c1b 100%)",
        fontFamily: "var(--font-family)",
        color: "#fff",
        padding: "20px",
        overflowY: "auto",
      }}>
        <div className="glass-card" style={{
          padding: "48px 40px",
          maxWidth: "500px",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "24px",
          boxShadow: "0 20px 40px rgba(0,0,0,0.5), inset 0 0 0 1px rgba(255,255,255,0.05)",
          borderRadius: "16px",
          animation: "fadeIn 0.5s ease",
        }}>
          {/* Glowing Header */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
            <div style={{
              width: "80px",
              height: "80px",
              borderRadius: "50%",
              background: "linear-gradient(135deg, #6366f1 0%, #a855f7 100%)",
              boxShadow: "0 0 25px rgba(99, 102, 241, 0.4)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "2rem",
              fontWeight: "700",
              color: "#fff",
              marginBottom: "16px",
            }}>
              {previewInitials}
            </div>
            <h1 style={{ fontSize: "1.85rem", fontWeight: "800", letterSpacing: "-0.5px", background: "linear-gradient(to right, #fff, var(--text-secondary))", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              AetherHMS Initial Setup
            </h1>
            <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem", marginTop: "8px", lineHeight: "1.5" }}>
              Welcome! Register your primary **Super Admin** account to launch your custom Property Management Workspace.
            </p>
          </div>

          <form onSubmit={handleOnboardingSubmit} style={{ width: "100%", display: "flex", flexDirection: "column" }}>
            <label style={labelStyle}>Owner / Admin Full Name</label>
            <input
              style={inputStyle}
              type="text"
              placeholder="e.g. Aravind Mehta"
              value={onboardingName}
              onChange={(e) => setOnboardingName(e.target.value)}
              required
              disabled={onboardingSubmitting}
            />

            <label style={labelStyle}>Select Username</label>
            <input
              style={inputStyle}
              type="text"
              placeholder="e.g. aravind"
              value={onboardingUsername}
              onChange={(e) => setOnboardingUsername(e.target.value.toLowerCase().replace(/\s+/g, ""))}
              required
              disabled={onboardingSubmitting}
            />

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
              <div>
                <label style={labelStyle}>Password / PIN</label>
                <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                  <input
                    style={{ ...inputStyle, paddingRight: "36px" }}
                    type={onboardingShowPassword ? "text" : "password"}
                    placeholder="Enter PIN/pass"
                    value={onboardingPassword}
                    onChange={(e) => setOnboardingPassword(e.target.value)}
                    required
                    disabled={onboardingSubmitting}
                  />
                  <button
                    type="button"
                    onClick={() => setOnboardingShowPassword(!onboardingShowPassword)}
                    style={{
                      position: "absolute",
                      right: "10px",
                      top: "14px",
                      background: "none",
                      border: "none",
                      color: "var(--text-secondary)",
                      cursor: "pointer",
                      fontSize: "0.85rem"
                    }}
                  >
                    {onboardingShowPassword ? "👁️" : "🙈"}
                  </button>
                </div>
              </div>
              <div>
                <label style={labelStyle}>Confirm Password</label>
                <input
                  style={inputStyle}
                  type={onboardingShowPassword ? "text" : "password"}
                  placeholder="Re-enter PIN/pass"
                  value={onboardingConfirmPassword}
                  onChange={(e) => setOnboardingConfirmPassword(e.target.value)}
                  required
                  disabled={onboardingSubmitting}
                />
              </div>
            </div>

            {onboardingError && (
              <div style={{
                backgroundColor: "rgba(239, 68, 68, 0.08)",
                border: "1px solid rgba(239, 68, 68, 0.2)",
                borderRadius: "8px",
                padding: "12px",
                fontSize: "0.825rem",
                color: "#f87171",
                marginBottom: "16px",
                textAlign: "center",
                fontWeight: "500",
              }}>
                ⚠️ {onboardingError}
              </div>
            )}

            <button
              className="btn-primary"
              type="submit"
              disabled={onboardingSubmitting}
              style={{
                width: "100%",
                padding: "12px",
                fontSize: "0.95rem",
                fontWeight: "600",
                marginTop: "8px",
                justifyContent: "center",
              }}
            >
              {onboardingSubmitting ? "Initializing System..." : "👑 Register & Launch HMS"}
            </button>
          </form>

          <div style={{ display: "flex", gap: "8px", alignItems: "center", borderTop: "1px solid var(--border-color)", paddingTop: "16px", width: "100%", justifyContent: "center" }}>
            <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
              ⚡ Powered by AetherHMS Production Engine
            </span>
          </div>
        </div>
      </main>
    );
  }



  if (!currentUser) {
    return (
      <LoginScreen onLoginSuccess={(user) => {
        setCurrentUser(user);
        localStorage.setItem("aether_pms_user", JSON.stringify(user));
      }} />
    );
  }

  return (
    <main className={styles.dashboardContainer}>
      <Sidebar activeMenu={activeMenu} setActiveMenu={setActiveMenu} currentUser={currentUser} onProfileClick={() => setShowProfileSwitcher(true)} activePropertyType={activePropertyType} />

      <div className={styles.mainContent}>
        {/* Dynamic Global Header (Only show property switcher if database has properties) */}
        <Header
          activeProperty={activeProperty}
          setActiveProperty={(prop) => {
            setActiveProperty(prop);
            addToast(`🏢 Switched property context to ${prop.toUpperCase()} branch.`);
          }}
          stats={stats}
          properties={propertiesList}
          hasProperties={hasProperties}
          currentUser={currentUser}
          notifications={notificationsList}
          onClearNotifications={handleClearNotifications}
          todayAttendance={todayAttendance}
          onClockInOut={handleClockInOut}
          onRequestLeave={() => setShowLeaveModal(true)}
        />

        {/* Stats Summary Panel */}
        {hasProperties && (
          <section className={styles.statGrid}>
            <div className={`${styles.statCard} glass-card`}>
              <div className={styles.statTitle}>Occupancy Rate</div>
              <div className={styles.statValue}>{stats.occupancy}%</div>
              <div className={styles.statTrend}>📈 Live updates</div>
            </div>
            <div className={`${styles.statCard} glass-card`}>
              <div className={styles.statTitle}>Checked-In Guests</div>
              <div className={styles.statValue}>{stats.checkedIn} Rooms</div>
              <div className={styles.statTrend}>🟢 Active occupancy</div>
            </div>
            <div className={`${styles.statCard} glass-card`}>
              <div className={styles.statTitle}>Upcoming Check-Ins</div>
              <div className={styles.statValue}>{stats.upcoming} Arrivals</div>
              <div className={styles.statTrend} style={{ color: "var(--status-confirmed)" }}>
                📅 Confirmed status
              </div>
            </div>
            <div className={`${styles.statCard} glass-card`}>
              <div className={styles.statTitle}>Out-of-Order Rooms</div>
              <div className={styles.statValue}>{stats.maintenance} Spaces</div>
              <div className={styles.statTrend} style={{ color: stats.maintenance > 0 ? "var(--status-pending)" : "var(--status-checkedin)" }}>
                🛠️ Maintenance Tickets
              </div>
            </div>
          </section>
        )}

        {/* Dynamic Body Router */}
        {!checkTabPermission(activeMenu) ? (
          <section style={{ padding: "40px 32px", flexGrow: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div className="glass-card" style={{ padding: "48px", textAlign: "center", maxWidth: "550px", display: "flex", flexDirection: "column", gap: "24px", alignItems: "center" }}>
              <div style={{ fontSize: "3rem" }}>🛡️</div>
              <div>
                <h1 style={{ fontSize: "1.50rem", fontWeight: "700", color: "#fff", marginBottom: "12px" }}>Access Restricted</h1>
                <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem", lineHeight: "1.6", marginBottom: "8px" }}>
                  The active staff profile <strong>{currentUser?.name}</strong> ({currentUser?.role}) does not have permissions to access the <strong>{activeMenu.replace("-", " ").toUpperCase()}</strong> module.
                </p>
                <p style={{ color: "var(--text-muted)", fontSize: "0.8rem", lineHeight: "1.4" }}>
                  Please log in as an authorized user or ask a Super Admin to enter their override password below to view this section.
                </p>
              </div>

              <form onSubmit={(e) => handleAdminOverride(activeMenu, e)} style={{ width: "100%", marginTop: "8px" }}>
                <div style={{ display: "flex", gap: "8px", width: "100%" }}>
                  <input
                    id="override-input"
                    type="password"
                    style={{ ...inputStyle, marginBottom: 0, flexGrow: 1 }}
                    placeholder="Super Admin Override PIN"
                    value={overridePassword}
                    onChange={(e) => setOverridePassword(e.target.value)}
                    required
                  />
                  <button className="btn-primary" type="submit" style={{ whiteSpace: "nowrap" }}>
                    🔑 Unlock Tab
                  </button>
                </div>
                {overrideError && (
                  <p style={{ color: "#ef4444", fontSize: "0.8rem", marginTop: "8px", fontWeight: "600" }}>
                    ❌ {overrideError}
                  </p>
                )}
              </form>

              <div style={{ borderTop: "1px solid var(--border-color)", paddingTop: "16px", width: "100%", display: "flex", justifyContent: "center", gap: "16px" }}>
                <button className="btn-secondary" style={{ padding: "8px 14px", fontSize: "0.85rem" }} onClick={() => {
                  const permitted = ["front-office", "channel-manager", "housekeeping", "finance", "settings"].find(t => checkTabPermission(t));
                  if (permitted) setActiveMenu(permitted);
                }}>
                  👈 Back to Allowed Tab
                </button>
                <button className="btn-secondary" style={{ padding: "8px 14px", fontSize: "0.85rem" }} onClick={() => setShowProfileSwitcher(true)}>
                  🔄 Switch Staff Profile
                </button>
              </div>
            </div>
          </section>
        ) : activeMenu === "front-office" ? (
          !hasProperties ? (
            /* Sleek Empty State / Setup Wizard */
            <section style={{ padding: "40px 32px", flexGrow: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div className="glass-card" style={{ padding: "48px", textAlign: "center", maxWidth: "600px", display: "flex", flexDirection: "column", gap: "24px", alignItems: "center" }}>
                <div style={{ fontSize: "3.5rem", background: "linear-gradient(135deg, #6366f1 0%, #a855f7 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>🏢</div>
                <div>
                  <h1 style={{ fontSize: "1.75rem", fontWeight: "700", color: "#fff", marginBottom: "12px" }}>AetherHMS Database Slate is Clean!</h1>
                  <p style={{ color: "var(--text-secondary)", fontSize: "0.95rem", lineHeight: "1.6", marginBottom: "8px" }}>
                    Your PMS database tables are synced and ready for production. You can start entering your actual hotel configurations or load the visual demo data.
                  </p>
                </div>
                {hasPermission("staff-management:add") ? (
                  <div style={{ display: "flex", gap: "16px", marginTop: "8px" }}>
                    <button className="btn-primary" onClick={() => setShowPropertyModal(true)}>
                      🏢 Create Property Branch
                    </button>
                    <button className="btn-secondary" onClick={handleSeedDatabase}>
                      🌱 Load Visual Demo Data
                    </button>
                  </div>
                ) : (
                  <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem", fontStyle: "italic", textAlign: "center" }}>
                    🔒 Property setup is locked. Please login as a Super Admin to create a property or seed demo data.
                  </p>
                )}
              </div>
            </section>
          ) : (
            <section className={styles.calendarWorkspace}>
              {/* Header Control Toolbar */}
              <div className={styles.calendarToolbar}>
                <div className={styles.toolbarLeft}>
                  <h1 className={styles.toolbarTitle}>Front Office Visual Grid</h1>
                  
                  <div className={styles.viewToggler}>
                    <button
                      className={`${styles.toggleBtn} ${timeScale === "daily" ? styles.toggleBtnActive : ""}`}
                      onClick={() => {
                        setTimeScale("daily");
                        addToast("📅 Visual Grid shifted to 14-Day Calendar Scale.");
                      }}
                    >
                      Daily Scale
                    </button>
                    {activePropertyType !== "homestay" && (
                    <button
                      className={`${styles.toggleBtn} ${timeScale === "hourly" ? styles.toggleBtnActive : ""}`}
                      onClick={() => {
                        setTimeScale("hourly");
                        addToast("⏱️ Visual Grid shifted to 24-Hour Transit Slots.");
                      }}
                    >
                      Hourly/Flexible Slots
                    </button>
                    )}
                  </div>
                </div>

                <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                  {currentUser?.role === "Super Admin" && (
                    <button className="btn-secondary" style={{ padding: "8px 14px", fontSize: "0.85rem" }} onClick={() => setShowPropertyModal(true)}>
                      🏢 Add Property
                    </button>
                  )}
                  {(currentUser?.role === "Super Admin" ||
                    ((currentUser?.role === "Front Office Manager" || currentUser?.role === "General Manager") &&
                      currentUser?.allowRoomManagement !== false)) && (
                    <button className="btn-secondary" style={{ padding: "8px 14px", fontSize: "0.85rem" }} onClick={() => setShowRoomModal(true)}>
                      🔑 Add Room
                    </button>
                  )}
                  {currentUser?.role !== "Housekeeping Supervisor" && (
                    <button className="btn-primary" style={{ padding: "8px 14px", fontSize: "0.85rem" }} onClick={() => {
                      if (currentRooms.length === 0) {
                        addToast("⚠️ Please add a Room before booking a guest!");
                        return;
                      }
                      setShowBookingModal(true);
                    }}>
                      📅 New Booking
                    </button>
                  )}
                </div>
              </div>

              {/* Dynamic Grid Board */}
              <VisualGrid
                rooms={currentRooms}
                reservations={currentReservations}
                onUpdateReservation={handleUpdateReservation}
                onSelectReservation={async (res) => {
                  if (res.status === "maintenance") {
                    const isSeniorStaff =
                      currentUser?.role === "Super Admin" ||
                      currentUser?.role === "General Manager";
                    
                    if (!isSeniorStaff) {
                      addToast(`🛠️ "${res.guestName}" is an active Out of Order maintenance block. Only Super Admins and General Managers can release it.`, "warning");
                      return;
                    }
                    
                    if (window.confirm(`🛠️ Out-of-Order Block: "${res.guestName}"\n\nDo you want to RELEASE this room back to active guest service? (This will delete the maintenance block)`)) {
                      try {
                        const response = await fetch(`/api/reservations/${res.id}`, {
                          method: "DELETE",
                        });
                        const data = await response.json();
                        if (data.success || response.ok) {
                          addToast(`🟢 Room released to service successfully!`);
                          await loadData();
                        } else {
                          throw new Error(data.error || "Failed to release room.");
                        }
                      } catch (err: any) {
                        addToast(`❌ Release Failed: ${err.message}`, "error");
                      }
                    }
                    return;
                  }
                  setSelectedRes(res);
                }}
                timeScale={timeScale}
                addToast={addToast}
                currentUser={currentUser}
                onEditRoom={(room: any) => {
                  setSelectedRoomToEdit(room);
                  setEditRoomNumber(room.number);
                  setEditRoomName(room.name);
                  setEditRoomType(room.type);
                  setEditRoomPrice(room.basePrice?.toString() || "0");
                  setShowEditRoomModal(true);
                }}
                onAddBookingAtCell={handleAddBookingAtCell}
              />
            </section>
          )
        ) : activeMenu === "front-desk" ? (
          <section style={{ padding: "32px", overflowY: "auto", flexGrow: 1 }}>
            <FrontDeskOps
              currentReservations={currentReservations as any}
              currentRooms={currentRooms}
              activePropertyId={propertiesList.find((p) => mapPropertyKey(p.name) === activeProperty)?.id || ""}
              activeProperty={propertiesList.find((p) => mapPropertyKey(p.name) === activeProperty)}
              currentUser={currentUser}
              addToast={addToast}
              onUpdateReservation={handleUpdateReservation}
              refreshData={loadData}
            />
          </section>
        ) : activeMenu === "reviews" ? (
          <section style={{ padding: "32px", overflowY: "auto", flexGrow: 1 }}>
            <ReviewDashboard
              activePropertyId={propertiesList.find((p) => mapPropertyKey(p.name) === activeProperty)?.id || ""}
              addToast={addToast}
            />
          </section>
        
        ) : activeMenu === "attendance" ? (
          <section style={{ padding: "40px 32px", overflowY: "auto", flexGrow: 1, minHeight: 0 }}>
            <div className="glass-card" style={{ padding: "32px", display: "flex", flexDirection: "column", minHeight: "min-content" }}>
              {/* ========== STAFF ATTENDANCE SUB-TAB ========== */}
              
                  <h2 style={{ fontSize: "1.1rem", color: "#fff", fontWeight: "600", marginBottom: "16px" }}>⏱️ Today's Staff Attendance</h2>
                  
                  {(["Super Admin", "General Manager", "Front Office Manager"].includes(currentUser?.role) ? usersList : usersList.filter(u => u.id === currentUser?.id)).length === 0 ? (
                    <div style={{ textAlign: "center", padding: "32px", backgroundColor: "rgba(255,255,255,0.02)", borderRadius: "8px", border: "1px dashed var(--border-color)" }}>
                      <p style={{ color: "var(--text-secondary)" }}>No staff members found.</p>
                    </div>
                  ) : (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "12px" }}>
                      {(["Super Admin", "General Manager", "Front Office Manager"].includes(currentUser?.role) ? usersList : usersList.filter(u => u.id === currentUser?.id)).map((user: any) => {
                        const att = allAttendances.find((a: any) => a.userId === user.id);
                        const todayStr = new Date().toISOString().split("T")[0];
                        const approvedLeave = leaveRequests.find((l: any) => 
                          l.userId === user.id && 
                          l.status === "Approved" && 
                          new Date(l.startDate).toISOString().split("T")[0] <= todayStr &&
                          new Date(l.endDate).toISOString().split("T")[0] >= todayStr
                        );

                        return (
                          <div key={user.id} className="glass-card" style={{ padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                              <div className={styles.avatar} style={{ margin: 0, width: "36px", height: "36px", fontSize: "0.9rem", filter: !att ? "grayscale(100%) opacity(0.5)" : "none" }}>{user.avatar}</div>
                              <div>
                                <strong style={{ fontSize: "0.9rem", color: !att ? "var(--text-muted)" : "#fff", display: "block" }}>{user.name}</strong>
                                <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                                  {user.role}
                                  {att && ` • Shift: ${att.shift || 'Morning'} ${att.shiftTiming ? '(' + att.shiftTiming + ')' : ''}`}
                                  {att && ` • In: ${new Date(att.clockIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                                  {att?.clockOut && ` • Out: ${new Date(att.clockOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                                  {att?.clockOut && att?.clockIn && ` • Worked: ${Math.round((new Date(att.clockOut).getTime() - new Date(att.clockIn).getTime()) / (1000 * 60 * 60) * 10) / 10} hrs`}
                                  {att && !att?.clockOut && ` • Working: ${Math.round((new Date().getTime() - new Date(att.clockIn).getTime()) / (1000 * 60 * 60) * 10) / 10} hrs`}
                                </span>
                              </div>
                            </div>
                            <div>
                              {!att ? (
                                approvedLeave ? (
                                  <span style={{ padding: "4px 8px", borderRadius: "4px", fontSize: "0.75rem", fontWeight: "600", backgroundColor: "rgba(234, 179, 8, 0.1)", color: "#eab308", border: "1px solid rgba(234, 179, 8, 0.2)" }}>
                                    On Leave
                                  </span>
                                ) : (
                                  <span style={{ padding: "4px 8px", borderRadius: "4px", fontSize: "0.75rem", fontWeight: "600", backgroundColor: "rgba(239, 68, 68, 0.1)", color: "#ef4444", border: "1px solid rgba(239, 68, 68, 0.2)" }}>
                                    Absent
                                  </span>
                                )
                              ) : (
                                <span style={{ 
                                  padding: "4px 8px", 
                                  borderRadius: "4px", 
                                  fontSize: "0.75rem", 
                                  fontWeight: "600",
                                  backgroundColor: att.clockOut ? "rgba(107, 114, 128, 0.1)" : "rgba(16, 185, 129, 0.1)",
                                  color: att.clockOut ? "var(--text-muted)" : "var(--status-checkedin)",
                                  border: `1px solid ${att.clockOut ? "rgba(107, 114, 128, 0.2)" : "rgba(16, 185, 129, 0.2)"}`
                                }}>
                                  {att.clockOut ? "Shift Completed" : "Clocked In"}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {currentUser?.role === "Super Admin" && (
                    <div style={{ marginTop: "24px", padding: "16px", backgroundColor: "rgba(255,255,255,0.02)", borderRadius: "8px", border: "1px dashed var(--border-color)" }}>
                      <h3 style={{ fontSize: "0.9rem", color: "#fff", fontWeight: "600", marginBottom: "12px" }}>✅ Mark Staff Attendance Manually</h3>
                      <div style={{ display: "flex", gap: "12px", alignItems: "flex-end" }}>
                        <div style={{ flex: 1 }}>
                          <select 
                            style={{ ...inputStyle, padding: "8px 12px" }} 
                            onChange={(e) => {
                              if (e.target.value) {
                                handleOwnerMarkAttendance(e.target.value);
                                e.target.value = "";
                              }
                            }}
                          >
                            <option value="">-- Choose a staff member to clock them in --</option>
                            {usersList.map((u: any) => (
                              <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  )}
                  {/* Leave Management Section */}
                  <div style={{ marginTop: "32px", padding: "16px", backgroundColor: "rgba(255,255,255,0.02)", borderRadius: "8px", border: "1px dashed var(--border-color)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                      <h3 style={{ fontSize: "1rem", color: "#fff", fontWeight: "600" }}>📅 Leave Management</h3>
                      <button onClick={() => setShowLeaveModal(true)} className="btn-primary" style={{ padding: "6px 12px", fontSize: "0.8rem" }}>➕ Request Leave</button>
                    </div>

                    {(currentUser?.role === "Super Admin" ? leaveRequests : leaveRequests.filter((l: any) => l.userId === currentUser?.id)).length === 0 ? (
                      <p style={{ color: "var(--text-secondary)", fontSize: "0.85rem", textAlign: "center" }}>No leave requests found.</p>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                        {(currentUser?.role === "Super Admin" ? leaveRequests : leaveRequests.filter((l: any) => l.userId === currentUser?.id)).map((leave: any) => (
                          <div key={leave.id} style={{ padding: "12px", backgroundColor: "rgba(0,0,0,0.2)", borderRadius: "6px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <div>
                              <strong style={{ fontSize: "0.9rem", color: "#fff" }}>{leave.user?.name || "Unknown"}</strong>
                              <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginLeft: "8px" }}>
                                {new Date(leave.startDate).toLocaleDateString()} to {new Date(leave.endDate).toLocaleDateString()}
                              </span>
                              <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: "4px" }}>"{leave.reason}"</p>
                            </div>
                            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                              <span style={{ 
                                padding: "4px 8px", borderRadius: "4px", fontSize: "0.75rem", fontWeight: "600",
                                backgroundColor: leave.status === "Approved" ? "rgba(16, 185, 129, 0.1)" : leave.status === "Denied" ? "rgba(239, 68, 68, 0.1)" : "rgba(234, 179, 8, 0.1)",
                                color: leave.status === "Approved" ? "#10b981" : leave.status === "Denied" ? "#ef4444" : "#eab308"
                              }}>
                                {leave.status}
                              </span>
                              {hasPermission("attendance:approve-leave") && leave.status === "Pending" && (
                                <div style={{ display: "flex", gap: "4px" }}>
                                  <button onClick={() => handleUpdateLeave(leave.id, "Approved")} style={{ background: "#10b981", color: "#fff", border: "none", padding: "4px 8px", borderRadius: "4px", cursor: "pointer", fontSize: "0.75rem" }}>Approve</button>
                                  <button onClick={() => handleUpdateLeave(leave.id, "Denied")} style={{ background: "#ef4444", color: "#fff", border: "none", padding: "4px 8px", borderRadius: "4px", cursor: "pointer", fontSize: "0.75rem" }}>Deny</button>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                
            </div>
          </section>
) : activeMenu === "staff-management" ? (
          <section style={{ padding: "40px 32px", overflowY: "auto", flexGrow: 1, minHeight: 0 }}>
            <div className="glass-card" style={{ padding: "48px", maxWidth: "800px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "24px" }}>
              <div>
                <h1 style={{ fontSize: "1.75rem", fontWeight: "700", marginBottom: "8px" }}>👥 Staff & Shifts Management</h1>
                <p style={{ color: "var(--text-secondary)", fontSize: "0.95rem", lineHeight: "1.6" }}>
                  Manage hotel staff accounts, assign roles, set up shifts, and configure individual permissions.
                </p>
              </div>
              
              
              <div style={{ borderTop: "1px solid var(--border-color)", paddingTop: "24px", marginBottom: "8px" }}>
                <h2 style={{ fontSize: "1.1rem", color: "#fff", fontWeight: "600", marginBottom: "16px" }}>👥 PMS Staff & Operator Accounts</h2>
                
                {/* User List Grid */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "10px", marginBottom: "20px" }}>
                  {usersList.map((user: any) => (
                    <div key={user.id} className="glass-card" style={{ padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "12px", flex: 1 }}>
                        <div className={styles.avatar} style={{ margin: 0, width: "36px", height: "36px", fontSize: "0.85rem", flexShrink: 0 }}>{user.avatar}</div>
                        <div>
                          <strong style={{ fontSize: "0.875rem", color: "#fff", display: "block" }}>{user.name}</strong>
                          <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                            @{user.username} • <span style={{ color: "var(--border-focus)", fontWeight: "500" }}>{user.role}</span>
                            {user.assignedShift && (
                              <span style={{ marginLeft: "8px", color: "#fbbf24", fontWeight: "600" }}>
                                • 🕐 {user.assignedShift}{user.shiftTiming ? ` (${user.shiftTiming})` : ""}
                              </span>
                            )}
                            {!user.assignedShift && (
                              <span style={{ marginLeft: "8px", color: "var(--text-muted)", fontStyle: "italic" }}>
                                • No shift assigned
                              </span>
                            )}
                          </span>
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: "8px", alignItems: "center", flexShrink: 0 }}>
                        {/* Inline Shift Assignment */}
                        {editingShiftUserId === user.id ? (
                          <div style={{ display: "flex", gap: "6px", alignItems: "center", background: "rgba(255,255,255,0.04)", padding: "6px 10px", borderRadius: "8px", border: "1px solid var(--border-color)" }}>
                            <select
                              style={{ ...inputStyle, padding: "4px 8px", fontSize: "0.8rem", width: "120px", height: "auto" }}
                              value={editShiftValue}
                              onChange={(e) => setEditShiftValue(e.target.value)}
                            >
                              <option value="Morning">Morning</option>
                              <option value="Evening">Evening</option>
                              <option value="Night">Night</option>
                              <option value="Custom">Custom</option>
                            </select>
                            {editShiftValue === "Custom" && (
                              <input
                                style={{ ...inputStyle, padding: "4px 8px", fontSize: "0.8rem", width: "150px", height: "auto" }}
                                type="text"
                                placeholder="e.g. 10 AM – 6 PM"
                                value={editShiftTimingValue}
                                onChange={(e) => setEditShiftTimingValue(e.target.value)}
                              />
                            )}
                            <button
                              onClick={() => handleUpdateShift(user.id)}
                              disabled={isUpdatingShift}
                              style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)", color: "#fff", border: "none", padding: "4px 10px", borderRadius: "6px", cursor: "pointer", fontSize: "0.8rem", fontWeight: "600", whiteSpace: "nowrap" }}
                            >
                              {isUpdatingShift ? "…" : "Save"}
                            </button>
                            <button
                              onClick={() => setEditingShiftUserId(null)}
                              style={{ background: "none", color: "var(--text-secondary)", border: "1px solid var(--border-color)", padding: "4px 8px", borderRadius: "6px", cursor: "pointer", fontSize: "0.8rem" }}
                            >
                              ✕
                            </button>
                          </div>
                        ) : (
                          ["Super Admin", "General Manager", "Front Office Manager"].includes(currentUser?.role || "") && (
                            <>
                              <button
                                onClick={() => {
                                  setEditingShiftUserId(user.id);
                                  setEditShiftValue(user.assignedShift || "Morning");
                                  setEditShiftTimingValue(user.shiftTiming || "");
                                }}
                                style={{ background: "none", border: "1px solid var(--border-color)", color: "var(--text-secondary)", cursor: "pointer", fontSize: "0.75rem", padding: "4px 10px", borderRadius: "6px", transition: "all 0.2s", whiteSpace: "nowrap" }}
                                onMouseEnter={(e) => { e.currentTarget.style.color = "#fff"; e.currentTarget.style.borderColor = "var(--border-focus)"; }}
                                onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-secondary)"; e.currentTarget.style.borderColor = "var(--border-color)"; }}
                              >
                                🕐 Assign Shift
                              </button>
                              {currentUser?.role === "Super Admin" && (
                                <button
                                  onClick={() => {
                                    setEditingPermissionsUserId(user.id);
                                    let defaultPerms = user.permissions || [];
                                    if (!user.permissions) {
                                      if (user.role === "Super Admin") defaultPerms = ["front-office", "front-desk", "channel-manager", "housekeeping", "finance", "reviews", "attendance", "attendance:approve-leave", "attendance:approve-swap", "attendance:manual-clock", "staff-management", "staff-management:add", "staff-management:edit-shift", "staff-management:delete", "settings"];
                                      else if (user.role === "General Manager") defaultPerms = ["front-office", "front-desk", "channel-manager", "housekeeping", "finance", "reviews", "attendance", "attendance:approve-leave", "attendance:approve-swap", "attendance:manual-clock", "staff-management", "staff-management:add", "staff-management:edit-shift"];
                                      else if (user.role === "Front Office Manager") defaultPerms = ["front-office", "front-desk", "housekeeping", "reviews", "attendance", "attendance:approve-leave", "attendance:approve-swap", "staff-management", "staff-management:edit-shift"];
                                      else if (user.role === "Receptionist") defaultPerms = ["front-office", "front-desk", "housekeeping", "reviews", "attendance"];
                                      else if (user.role === "Finance Executive") defaultPerms = ["front-office", "front-desk", "finance", "attendance"];
                                      else if (user.role === "Housekeeper" || user.role === "Housekeeping Supervisor") defaultPerms = ["housekeeping", "attendance"];
                                    }
                                    setEditPermissionsValue(defaultPerms);
                                  }}
                                  style={{ background: "none", border: "1px solid var(--border-color)", color: "var(--text-secondary)", cursor: "pointer", fontSize: "0.75rem", padding: "4px 10px", borderRadius: "6px", transition: "all 0.2s", whiteSpace: "nowrap", marginLeft: "4px" }}
                                  onMouseEnter={(e) => { e.currentTarget.style.color = "#fff"; e.currentTarget.style.borderColor = "var(--border-focus)"; }}
                                  onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-secondary)"; e.currentTarget.style.borderColor = "var(--border-color)"; }}
                                >
                                  🔑 Edit Permissions
                                </button>
                              )}
                            </>
                          )
                        )}
                        {currentUser?.role === "Super Admin" && (
                          <button
                            type="button"
                            onClick={() => handleDeleteStaff(user.id, user.name)}
                            style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontSize: "1.1rem", padding: "6px", borderRadius: "6px", display: "flex", alignItems: "center", transition: "all 0.2s ease" }}
                            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "rgba(239,68,68,0.1)"; }}
                            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
                            title="Delete Operator"
                          >
                            🗑️
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Add User Form */}
                {currentUser?.role === "Super Admin" ? (
                  <>
                    <form onSubmit={handleRegisterStaff} className="glass-card" style={{ padding: "20px", borderStyle: "dashed" }}>
                      <h3 style={{ fontSize: "0.9rem", color: "#fff", fontWeight: "600", marginBottom: "12px" }}>👤 Register New Hotel Staff Member</h3>
                      
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                        <div>
                          <label style={labelStyle}>Full Name</label>
                          <input style={{ ...inputStyle, padding: "8px 12px" }} type="text" placeholder="e.g. Rahul Sharma" value={newStaffName} onChange={(e) => setNewStaffName(e.target.value)} required />
                        </div>
                        <div>
                          <label style={labelStyle}>Username</label>
                          <input style={{ ...inputStyle, padding: "8px 12px" }} type="text" placeholder="e.g. rahul" value={newStaffUsername} onChange={(e) => setNewStaffUsername(e.target.value)} required />
                        </div>
                      </div>

                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px" }}>
                        <div style={{ flex: 1.5 }}>
                          <label style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "4px", display: "block" }}>Temporary PIN (First Login)</label>
                          <input style={{ ...inputStyle, padding: "8px 12px" }} type="text" placeholder="e.g. 1234" value={newStaffPassword} onChange={(e) => setNewStaffPassword(e.target.value)} required />
                        </div>
                        <div>
                          <label style={labelStyle}>Role</label>
                          <select style={{ ...inputStyle, padding: "8px 12px", marginBottom: newStaffRole === "Other" ? "8px" : "0" }} value={newStaffRole} onChange={(e) => setNewStaffRole(e.target.value)}>
                            <option value="General Manager">General Manager (Senior GM)</option>
                            <option value="Front Office Manager">Front Office Manager (Senior Staff)</option>
                            <option value="Receptionist">Receptionist (Front Desk)</option>
                            <option value="Housekeeping Supervisor">Housekeeping Supervisor</option>
                            <option value="Finance Executive">Finance Executive</option>
                            <option value="Other">Other (Custom Role)</option>
                          </select>
                          {newStaffRole === "Other" && (
                            <input 
                              style={{ ...inputStyle, padding: "8px 12px" }} 
                              type="text" 
                              placeholder="e.g. Security Guard" 
                              value={customStaffRole} 
                              onChange={(e) => setCustomStaffRole(e.target.value)} 
                              required 
                            />
                          )}
                        </div>
                        <div>
                          <label style={labelStyle}>Avatar Initials</label>
                          <input style={{ ...inputStyle, padding: "8px 12px" }} type="text" maxLength={2} placeholder="e.g. RS" value={newStaffAvatar} onChange={(e) => setNewStaffAvatar(e.target.value)} required />
                        </div>
                      </div>

                      {(newStaffRole === "Other" ? customStaffRole : newStaffRole).toLowerCase() !== "super admin" && (
                        <div style={{ display: "flex", flexDirection: "column", marginTop: "4px", marginBottom: "12px" }}>
                          <label style={labelStyle}>Assigned Property Branch</label>
                          {propertiesList.length > 0 ? (
                            <select
                              style={{ ...inputStyle, padding: "8px 12px", marginBottom: "4px" }}
                              value={newStaffPropertyId}
                              onChange={(e) => setNewStaffPropertyId(e.target.value)}
                              required
                            >
                              {propertiesList.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.name} ({p.location})
                                </option>
                              ))}
                            </select>
                          ) : (
                            <span style={{ fontSize: "0.75rem", color: "#ef4444", fontStyle: "italic", marginBottom: "4px" }}>
                              ❌ No properties registered. Please register a property first.
                            </span>
                          )}
                        </div>
                      )}

                      <button className="btn-primary" type="submit" style={{ fontSize: "0.85rem", padding: "8px 14px", marginTop: "4px" }}>
                        ➕ Register Staff Account
                      </button>
                    </form>

                    {justCreatedStaff && (
                      <div style={{ padding: "16px", marginTop: "16px", backgroundColor: "rgba(16, 185, 129, 0.1)", border: "1px solid var(--status-checkedin)", borderRadius: "8px" }}>
                        <h4 style={{ color: "var(--status-checkedin)", fontSize: "1rem", marginBottom: "8px" }}>✅ Profile Created Successfully!</h4>
                        <p style={{ color: "var(--text-secondary)", fontSize: "0.85rem", marginBottom: "16px", lineHeight: "1.5" }}>
                          Share these login details with <strong>{justCreatedStaff.name}</strong> so they can log in and set their permanent PIN.
                        </p>
                        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
                          <button 
                            type="button"
                            className="btn-primary" 
                            onClick={() => {
                              const msg = `Hi ${justCreatedStaff.name}, your AetherHMS account is ready! Your temporary PIN is: ${justCreatedStaff.pin}. Please log in and set your new PIN.`;
                              window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank");
                            }}
                            style={{ flex: 1, backgroundColor: "#25D366", color: "#fff", border: "none", minWidth: "160px" }}
                          >
                            💬 WhatsApp
                          </button>
                          <button 
                            type="button"
                            className="btn-primary" 
                            onClick={() => {
                              const subject = `Your AetherHMS Account is Ready!`;
                              const msg = `Hi ${justCreatedStaff.name},\n\nYour AetherHMS account is ready!\n\nYour temporary PIN is: ${justCreatedStaff.pin}\n\nPlease log in and set your new permanent PIN.\n\nThanks!`;
                              window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(msg)}`;
                            }}
                            style={{ flex: 1, backgroundColor: "#3b82f6", color: "#fff", border: "none", minWidth: "160px" }}
                          >
                            ✉️ Email
                          </button>
                          <button 
                            type="button"
                            className="btn-secondary" 
                            onClick={() => {
                              const msg = `Hi ${justCreatedStaff.name}, your AetherHMS account is ready! Your temporary PIN is: ${justCreatedStaff.pin}. Please log in and set your new PIN.`;
                              navigator.clipboard.writeText(msg);
                              addToast("📋 Credentials copied to clipboard!");
                            }}
                            style={{ flex: 1, minWidth: "160px" }}
                          >
                            📋 Copy Details
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="glass-card" style={{ padding: "20px", display: "flex", alignItems: "center", gap: "16px", backgroundColor: "rgba(255,255,255,0.01)", borderStyle: "dashed" }}>
                    <div style={{ fontSize: "1.5rem" }}>🔒</div>
                    <div>
                      <h4 style={{ fontSize: "0.875rem", color: "#fff", fontWeight: "600" }}>Operator Onboarding Locked</h4>
                      <p style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginTop: "2px" }}>
                        Only the registered **Super Admin** has permission to onboard new hotel staff members or operator profiles.
                      </p>
                    </div>
                  </div>
                )}
              </div>
              

              
            </div>
          </section>
) : activeMenu === "settings" ? (
          /* Sleek Settings View with Wipe Database Control */
          <section style={{ padding: "40px 32px", overflowY: "auto", flexGrow: 1 }}>
            <div className="glass-card" style={{ padding: "48px", maxWidth: "800px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "24px" }}>
              <div>
                <h1 style={{ fontSize: "1.75rem", fontWeight: "700", marginBottom: "8px" }}>⚙️ Admin Control Centre</h1>
                <p style={{ color: "var(--text-secondary)", fontSize: "0.95rem", lineHeight: "1.6" }}>
                  Manage live database connections, staff permissions, and web booking synchronization.
                </p>
              </div>

              {/* Settings Sub-Tab Navigation */}
              <div style={{ display: "flex", gap: "8px", borderBottom: "1px solid var(--border-color)", paddingBottom: "0" }}>
                {([
                  { id: "permissions", label: "🔑 Staff Permissions Layout" },
                ] as const).map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setSettingsSubTab(tab.id)}
                    style={{
                      background: "none",
                      border: "none",
                      borderBottom: settingsSubTab === tab.id ? "2px solid var(--border-focus)" : "2px solid transparent",
                      color: settingsSubTab === tab.id ? "#fff" : "var(--text-secondary)",
                      fontWeight: settingsSubTab === tab.id ? "600" : "400",
                      fontSize: "0.85rem",
                      padding: "10px 16px",
                      cursor: "pointer",
                      transition: "all 0.2s ease",
                      whiteSpace: "nowrap",
                      fontFamily: "inherit",
                    }}
                    onMouseEnter={(e) => { if (settingsSubTab !== tab.id) e.currentTarget.style.color = "#fff"; }}
                    onMouseLeave={(e) => { if (settingsSubTab !== tab.id) e.currentTarget.style.color = "var(--text-secondary)"; }}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* ========== STAFF PERMISSIONS LAYOUT SUB-TAB ========== */}
              {settingsSubTab === "permissions" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                  <div>
                    <h2 style={{ fontSize: "1.1rem", color: "#fff", fontWeight: "600", marginBottom: "6px" }}>🔑 Staff Permissions Layout</h2>
                    <p style={{ fontSize: "0.82rem", color: "var(--text-secondary)", lineHeight: "1.6" }}>
                      Control granular permissions for senior staff members. Toggle <strong style={{ color: "#fff" }}>Allow Room Management</strong> to grant or revoke the ability to add and edit rooms. Changes take effect in under 5 seconds without requiring a logout.
                    </p>
                  </div>

                  {/* Manager Permission Cards */}
                  {usersList.filter((u: any) =>
                    u.role === "General Manager" || u.role === "Front Office Manager"
                  ).length === 0 ? (
                    <div className="glass-card" style={{ padding: "24px", textAlign: "center", color: "var(--text-muted)", fontSize: "0.85rem", borderStyle: "dashed" }}>
                      🏷️ No managers registered yet. Add a General Manager or Front Office Manager from System Settings.
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                      {usersList
                        .filter((u: any) => u.role === "General Manager" || u.role === "Front Office Manager")
                        .map((manager: any) => (
                          <div
                            key={manager.id}
                            className="glass-card"
                            style={{
                              padding: "16px 20px",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              gap: "16px",
                              border: manager.allowRoomManagement !== false
                                ? "1px solid rgba(99, 102, 241, 0.25)"
                                : "1px solid rgba(239, 68, 68, 0.2)",
                              transition: "border-color 0.3s ease",
                            }}
                          >
                            {/* Manager Info */}
                            <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                              <div
                                className={styles.avatar}
                                style={{
                                  margin: 0,
                                  width: "40px",
                                  height: "40px",
                                  fontSize: "0.85rem",
                                  opacity: manager.allowRoomManagement === false ? 0.5 : 1,
                                  transition: "opacity 0.3s ease",
                                }}
                              >
                                {manager.avatar}
                              </div>
                              <div>
                                <strong style={{ fontSize: "0.9rem", color: "#fff", display: "block" }}>{manager.name}</strong>
                                <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                                  @{manager.username} •{" "}
                                  <span style={{ color: "var(--border-focus)", fontWeight: "500" }}>{manager.role}</span>
                                </span>
                              </div>
                            </div>

                            {/* Toggle Control */}
                            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                              <span style={{ fontSize: "0.78rem", color: "var(--text-secondary)", fontWeight: "500", whiteSpace: "nowrap" }}>
                                Allow Room Management
                              </span>
                              {/* iOS-style toggle switch */}
                              <button
                                id={`toggle-room-mgmt-${manager.id}`}
                                onClick={() => currentUser?.role === "Super Admin" && handleToggleRoomManagement(manager.id, manager.allowRoomManagement !== false)}
                                title={currentUser?.role !== "Super Admin" ? "Only Super Admin can change this" : (manager.allowRoomManagement !== false ? "Click to revoke" : "Click to grant")}
                                style={{
                                  position: "relative",
                                  width: "52px",
                                  height: "28px",
                                  borderRadius: "14px",
                                  border: "none",
                                  cursor: currentUser?.role === "Super Admin" ? "pointer" : "not-allowed",
                                  background: manager.allowRoomManagement !== false
                                    ? "linear-gradient(135deg, #6366f1, #8b5cf6)"
                                    : "rgba(239, 68, 68, 0.3)",
                                  transition: "background 0.3s ease",
                                  outline: "none",
                                  flexShrink: 0,
                                  boxShadow: manager.allowRoomManagement !== false
                                    ? "0 0 12px rgba(99, 102, 241, 0.4)"
                                    : "none",
                                }}
                              >
                                <span
                                  style={{
                                    position: "absolute",
                                    top: "3px",
                                    left: manager.allowRoomManagement !== false ? "27px" : "3px",
                                    width: "22px",
                                    height: "22px",
                                    borderRadius: "50%",
                                    background: "#fff",
                                    transition: "left 0.25s ease",
                                    display: "block",
                                    boxShadow: "0 1px 4px rgba(0,0,0,0.4)",
                                  }}
                                />
                              </button>
                              <span
                                style={{
                                  fontSize: "0.78rem",
                                  fontWeight: "700",
                                  color: manager.allowRoomManagement !== false ? "#6ee7b7" : "#ef4444",
                                  minWidth: "28px",
                                  transition: "color 0.3s ease",
                                }}
                              >
                                {manager.allowRoomManagement !== false ? "YES" : "NO"}
                              </span>
                            </div>
                          </div>
                        ))}
                    </div>
                  )}

                  {/* Informational note */}
                  <div
                    style={{
                      display: "flex",
                      gap: "12px",
                      alignItems: "flex-start",
                      backgroundColor: "rgba(99, 102, 241, 0.06)",
                      border: "1px solid rgba(99, 102, 241, 0.15)",
                      borderRadius: "10px",
                      padding: "14px 16px",
                    }}
                  >
                    <span style={{ fontSize: "1.1rem", flexShrink: 0, marginTop: "1px" }}>💡</span>
                    <div style={{ fontSize: "0.78rem", color: "var(--text-secondary)", lineHeight: "1.6" }}>
                      <strong style={{ color: "#fff", display: "block", marginBottom: "2px" }}>How it works</strong>
                      By default, all newly registered managers are granted Room Management access (<strong style={{ color: "#6ee7b7" }}>YES</strong>). Flip a toggle to <strong style={{ color: "#ef4444" }}>NO</strong> to instantly hide the <strong style={{ color: "#fff" }}>🔑 Add Room</strong> button and disable room editing from that manager's dashboard. The change propagates automatically within 5 seconds — no logout required.
                    </div>
                  </div>
                </div>
              )}

              {settingsSubTab === "system" && (
              <div style={{ borderTop: "1px solid var(--border-color)", paddingTop: "24px", display: "flex", flexDirection: "column", gap: "16px" }}>
                <h2 style={{ fontSize: "1.1rem", color: "#fff", fontWeight: "600", marginBottom: "4px" }}>⚠️ Dangerous Database Actions</h2>
                
                {currentUser?.role === "Super Admin" ? (
                  <>
                    <div style={{ backgroundColor: "rgba(239, 68, 68, 0.04)", border: "1px solid rgba(239, 68, 68, 0.15)", borderRadius: "8px", padding: "20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ maxWidth: "70%" }}>
                        <strong style={{ color: "#ef4444", display: "block", marginBottom: "4px" }}>Wipe All Property & Booking Data</strong>
                        <span style={{ color: "var(--text-secondary)", fontSize: "0.85rem", lineHeight: "1.4" }}>
                          Permanently wipes all properties, individual rooms, active reservations, and split billing ledgers. Your staff accounts will remain intact.
                        </span>
                      </div>
                      <button className="btn-secondary" style={{ borderColor: "rgba(239, 68, 68, 0.3)", color: "#f87171", padding: "10px 16px", whiteSpace: "nowrap" }} onClick={handleClearDatabase}>
                        Wipe Property Data
                      </button>
                    </div>

                    <div style={{ backgroundColor: "rgba(239, 68, 68, 0.04)", border: "1px solid rgba(239, 68, 68, 0.15)", borderRadius: "8px", padding: "20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ maxWidth: "70%" }}>
                        <strong style={{ color: "#ef4444", display: "block", marginBottom: "4px" }}>Wipe All Staff & Operator Accounts</strong>
                        <span style={{ color: "var(--text-secondary)", fontSize: "0.85rem", lineHeight: "1.4" }}>
                          Permanently wipes all administrator, manager, and supervisor profiles. You will be logged out and the Initial Setup Wizard will be triggered.
                        </span>
                      </div>
                      <button className="btn-secondary" style={{ borderColor: "rgba(239, 68, 68, 0.3)", color: "#f87171", padding: "10px 16px", whiteSpace: "nowrap" }} onClick={handleClearStaffAccounts}>
                        Wipe Staff Accounts
                      </button>
                    </div>
                  </>
                ) : (
                  <div style={{ backgroundColor: "rgba(239, 68, 68, 0.02)", border: "1px solid rgba(239, 68, 68, 0.1)", borderRadius: "8px", padding: "20px", display: "flex", alignItems: "center", gap: "16px" }}>
                    <div style={{ fontSize: "1.5rem" }}>🔒</div>
                    <div>
                      <strong style={{ color: "var(--text-secondary)", display: "block" }}>Database Wipes Locked</strong>
                      <span style={{ color: "var(--text-muted)", fontSize: "0.8rem", lineHeight: "1.4", display: "block", marginTop: "2px" }}>
                        You are logged in as **{currentUser?.name}** ({currentUser?.role}). Only the primary **Super Admin** has permission to wipe database tables or clear operational records.
                      </span>
                    </div>
                  </div>
                )}
              </div>
              )}
            </div>
          </section>
        ) : activeMenu === "channel-manager" ? (
          <section style={{ padding: "32px", overflowY: "auto", flexGrow: 1 }}>
            {currentUser?.role === "General Manager" && !channelManagerUnlocked ? (
              <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "60vh" }}>
                <div className="glass-card" style={{ padding: "40px", maxWidth: "450px", width: "100%", textAlign: "center", display: "flex", flexDirection: "column", gap: "24px", alignItems: "center", boxShadow: "0 20px 40px rgba(0,0,0,0.4)" }}>
                  <div style={{ fontSize: "3rem" }}>🔒</div>
                  <div>
                    <h2 style={{ fontSize: "1.25rem", fontWeight: "700", color: "#fff", marginBottom: "8px" }}>General Manager Security Lock</h2>
                    <p style={{ color: "var(--text-secondary)", fontSize: "0.85rem", lineHeight: "1.5" }}>
                      Accessing the Channel Manager requires validating your active shift session password. Please enter your passcode/password to unlock.
                    </p>
                  </div>
                  <form onSubmit={handleUnlockChannelManager} style={{ width: "100%", display: "flex", flexDirection: "column", gap: "16px" }}>
                    <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                      <input
                        id="gm-pin-input"
                        type="password"
                        style={{ ...inputStyle, marginBottom: 0, textAlign: "center", fontSize: "1.25rem", letterSpacing: "4px", fontWeight: "700" }}
                        placeholder="••••••••"
                        value={gmPasswordInput}
                        onChange={(e) => setGmPasswordInput(e.target.value)}
                        required
                        autoFocus
                      />
                    </div>
                    {gmError && (
                      <p style={{ color: "#f87171", fontSize: "0.8rem", fontWeight: "500", margin: 0 }}>
                        ⚠️ {gmError}
                      </p>
                    )}
                    
                    {/* Interactive GM PIN Pad */}
                    <div style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(3, 1fr)",
                      gap: "10px",
                      width: "100%",
                      maxWidth: "280px",
                      margin: "0 auto"
                    }}>
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                        <button
                          key={num}
                          type="button"
                          className="btn-secondary"
                          style={{ height: "45px", fontSize: "1.1rem", fontWeight: "600", justifyContent: "center", borderRadius: "10px" }}
                          onClick={() => setGmPasswordInput((prev) => prev + num)}
                        >
                          {num}
                        </button>
                      ))}
                      <button
                        type="button"
                        className="btn-secondary"
                        style={{ height: "45px", fontSize: "0.8rem", fontWeight: "600", justifyContent: "center", borderRadius: "10px", color: "#ef4444" }}
                        onClick={() => setGmPasswordInput("")}
                      >
                        CLEAR
                      </button>
                      <button
                        type="button"
                        className="btn-secondary"
                        style={{ height: "45px", fontSize: "1.1rem", fontWeight: "600", justifyContent: "center", borderRadius: "10px" }}
                        onClick={() => setGmPasswordInput((prev) => prev + "0")}
                      >
                        0
                      </button>
                      <button
                        type="button"
                        className="btn-secondary"
                        style={{ height: "45px", fontSize: "0.8rem", fontWeight: "600", justifyContent: "center", borderRadius: "10px", color: "var(--text-secondary)" }}
                        onClick={() => setGmPasswordInput((prev) => prev.slice(0, -1))}
                      >
                        ⌫
                      </button>
                    </div>

                    <button className="btn-primary" type="submit" style={{ justifyContent: "center", width: "100%", padding: "10px", marginTop: "8px" }}>
                      🔑 Unlock Channel Manager
                    </button>
                  </form>
                </div>
              </div>
            ) : (
              <ChannelManager
                activePropertyId={propertiesList.find((p) => mapPropertyKey(p.name) === activeProperty)?.id || ""}
                currentRooms={currentRooms}
                addToast={addToast}
                refreshCalendar={loadData}
              />
            )}
          </section>
        ) : activeMenu === "housekeeping" ? (
          <section style={{ padding: "32px", overflowY: "auto", flexGrow: 1 }}>
            <HousekeepingOps
              currentRooms={currentRooms as any}
              currentReservations={currentReservations as any}
              activePropertyId={propertiesList.find(p => mapPropertyKey(p.name) === activeProperty)?.id || ""}
              activePropertyType={activePropertyType}
              addToast={addToast}
            />
          </section>
        ) : activeMenu === "finance" ? (
          <section style={{ padding: "32px", overflowY: "auto", flexGrow: 1 }}>
            <FinanceOps 
              currentReservations={currentReservations as any}
              activePropertyId={propertiesList.find(p => mapPropertyKey(p.name) === activeProperty)?.id || ""}
            />
          </section>
        ) : activeMenu === "reviews" ? (
          <section style={{ padding: "32px", overflowY: "auto", flexGrow: 1 }}>
            <ReviewManagement 
              activeProperty={activeProperty}
              propertiesList={propertiesList}
            />
          </section>
        ) : (
          /* MOCKUP SHIELDS FOR OTHER HMS MODULES */
          <section style={{ padding: "40px 32px", overflowY: "auto", flexGrow: 1 }}>
            <div className="glass-card" style={{ padding: "48px", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", maxWidth: "800px", margin: "0 auto", gap: "24px" }}>
              <div style={{ width: "70px", height: "70px", borderRadius: "50%", backgroundColor: "rgba(99, 102, 241, 0.15)", display: "flex", alignItems: "center", fontSize: "2rem", alignSelf: "center", justifyContent: "center" }}>
                {activeMenu === "finance" && "📊"}
              </div>

              <div>
                <h1 style={{ fontSize: "1.75rem", fontWeight: "700", marginBottom: "8px" }}>
                  {activeMenu === "finance" && "📊 Localization & Finance Engine (India Ready)"}
                </h1>
                <p style={{ color: "var(--text-secondary)", fontSize: "0.95rem", lineHeight: "1.6" }}>
                  {activeMenu === "finance" && "Indian GST calculation engine supporting tariff tax brackets (12% vs 18% splits), BOI Form C schema generators for foreign visitors, and Tally ERP ledger direct sync integrations."}
                </p>
              </div>

              <div style={{ backgroundColor: "rgba(255, 255, 255, 0.02)", border: "1px solid var(--border-color)", borderRadius: "8px", padding: "16px", width: "100%", fontSize: "0.85rem", textAlign: "left" }}>
                <strong style={{ display: "block", color: "#fff", marginBottom: "6px" }}>⚡ Roadmap Status: Integration Ready</strong>
                The visual layout for this module is fully scoped. When database sync keys are configured, live REST API pipelines will fetch and populate active data directly to these ledger nodes.
              </div>

              <button className="btn-primary" onClick={() => setActiveMenu("front-office")}>
                Return to Front Office Calendar Grid
              </button>
            </div>
          </section>
        )}
      </div>

      {/* 🏬 ADD PROPERTY MODAL */}
      {showPropertyModal && (
        <div className={styles.modalOverlay}>
          <div className={`${styles.modalContent} glass-card`} style={{ maxWidth: "450px" }}>
            <div className={styles.modalHeader}>
              <h2 style={{ fontSize: "1.25rem", fontWeight: "700" }}>🏢 Register New Branch</h2>
              <button className={styles.modalCloseBtn} onClick={() => setShowPropertyModal(false)}>✕</button>
            </div>
            <form onSubmit={handleCreateProperty}>
              <label style={labelStyle}>Property Name</label>
              <input style={inputStyle} type="text" placeholder="e.g. Goa Palms Resort" value={newPropName} onChange={(e) => setNewPropName(e.target.value)} required />

              <label style={labelStyle}>Property Type</label>
              <select style={inputStyle} value={newPropType} onChange={(e) => setNewPropType(e.target.value)}>
                <option value="homestay">🌴 Homestay / Villa</option>
                <option value="hotel">🏨 Premium Hotel</option>
                <option value="resort">⛰️ Mountain/Beach Resort</option>
              </select>

              <label style={labelStyle}>Location</label>
              <input style={inputStyle} type="text" placeholder="e.g. Anjuna, Goa" value={newPropLocation} onChange={(e) => setNewPropLocation(e.target.value)} required />

              <label style={labelStyle}>Property GST Number (Optional)</label>
              <input style={inputStyle} type="text" placeholder="e.g. 22AAAAA0000A1Z5" value={newPropGstNumber} onChange={(e) => setNewPropGstNumber(e.target.value.toUpperCase())} />

              <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end", marginTop: "12px" }}>
                <button className="btn-secondary" type="button" onClick={() => setShowPropertyModal(false)}>Cancel</button>
                <button className="btn-primary" type="submit">Create Property</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 🔑 ADD ROOM MODAL */}
      {showRoomModal && (
        <div className={styles.modalOverlay}>
          <div className={`${styles.modalContent} glass-card`} style={{ maxWidth: "450px" }}>
            <div className={styles.modalHeader}>
              <h2 style={{ fontSize: "1.25rem", fontWeight: "700" }}>🔑 Add Room / Space</h2>
              <button className={styles.modalCloseBtn} onClick={() => setShowRoomModal(false)}>✕</button>
            </div>
            <form onSubmit={handleCreateRoom}>
              <label style={labelStyle}>Room Number</label>
              <input style={inputStyle} type="text" placeholder="e.g. 101" value={newRoomNumber} onChange={(e) => setNewRoomNumber(e.target.value)} required />

              <label style={labelStyle}>Room Name</label>
              <input style={inputStyle} type="text" placeholder="e.g. Suite Palms" value={newRoomName} onChange={(e) => setNewRoomName(e.target.value)} required />

              <label style={labelStyle}>Room Category</label>
              <select style={inputStyle} value={newRoomType} onChange={(e) => setNewRoomType(e.target.value)}>
                <option value="Standard Room">Standard Room</option>
                <option value="Luxury Suite">Luxury Suite</option>
                <option value="Attic Loft">Attic Loft</option>
                <option value="Deluxe Room">Deluxe Room</option>
                <option value="Shared Conference">Shared Conference</option>
                <option value="Co-working Desk">Co-working Desk</option>
              </select>

              <label style={labelStyle}>Room Base Price (₹)</label>
              <input style={inputStyle} type="number" placeholder="e.g. 2500" value={newRoomPrice} onChange={(e) => setNewRoomPrice(e.target.value)} required />

              <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end", marginTop: "12px" }}>
                <button className="btn-secondary" type="button" onClick={() => setShowRoomModal(false)}>Cancel</button>
                <button className="btn-primary" type="submit">Add Room</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ✏️ EDIT ROOM MODAL */}
      {showEditRoomModal && selectedRoomToEdit && (
        <div className={styles.modalOverlay}>
          <div className={`${styles.modalContent} glass-card`} style={{ maxWidth: "450px" }}>
            <div className={styles.modalHeader}>
              <h2 style={{ fontSize: "1.25rem", fontWeight: "700" }}>✏️ Edit Room Details</h2>
              <button className={styles.modalCloseBtn} onClick={() => {
                setShowEditRoomModal(false);
                setSelectedRoomToEdit(null);
              }}>✕</button>
            </div>
            <form onSubmit={handleUpdateRoom}>
              <label style={labelStyle}>Room Number</label>
              <input style={inputStyle} type="text" placeholder="e.g. 101" value={editRoomNumber} onChange={(e) => setEditRoomNumber(e.target.value)} required />

              <label style={labelStyle}>Room Name</label>
              <input style={inputStyle} type="text" placeholder="e.g. Suite Palms" value={editRoomName} onChange={(e) => setEditRoomName(e.target.value)} required />

              <label style={labelStyle}>Room Category (Change Room Type)</label>
              <select style={inputStyle} value={editRoomType} onChange={(e) => setEditRoomType(e.target.value)}>
                <option value="Standard Room">Standard Room</option>
                <option value="Luxury Suite">Luxury Suite</option>
                <option value="Attic Loft">Attic Loft</option>
                <option value="Deluxe Room">Deluxe Room</option>
                <option value="Shared Conference">Shared Conference</option>
                <option value="Co-working Desk">Co-working Desk</option>
              </select>

              <label style={labelStyle}>Room Base Price (₹)</label>
              <input style={inputStyle} type="number" placeholder="e.g. 2500" value={editRoomPrice} onChange={(e) => setEditRoomPrice(e.target.value)} required />

              {/* Maintenance Toggle restricted to Super Admins & General Managers */}
              {(currentUser?.role === "Super Admin" || currentUser?.role === "General Manager") && (
                <div style={{ marginTop: "16px", borderTop: "1px solid var(--border-color)", paddingTop: "16px", marginBottom: "16px" }}>
                  <label style={{ ...labelStyle, display: "block", marginBottom: "8px", fontWeight: "600" }}>🔧 Room Operations & Maintenance</label>
                  <p style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginBottom: "12px", lineHeight: "1.4" }}>
                    Toggle Room Operational status. Placing a room out of order blocks bookings for 7 days.
                  </p>
                  
                  {(() => {
                    const activeResList = allReservations[activeProperty] || [];
                    const isMaint = activeResList.some(
                      (res) => res.roomId === selectedRoomToEdit.id && res.status === "maintenance"
                    );
                    
                    return (
                      <button
                        type="button"
                        onClick={() => handleToggleRoomMaintenance(selectedRoomToEdit)}
                        style={{
                          width: "100%",
                          padding: "10px",
                          borderRadius: "8px",
                          fontSize: "0.85rem",
                          fontWeight: "600",
                          cursor: "pointer",
                          transition: "all 0.2s ease",
                          backgroundColor: isMaint ? "rgba(16, 185, 129, 0.1)" : "rgba(239, 68, 68, 0.1)",
                          border: isMaint ? "1px solid #10b981" : "1px solid #ef4444",
                          color: isMaint ? "#10b981" : "#ef4444",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = isMaint ? "#10b981" : "#ef4444";
                          e.currentTarget.style.color = "#fff";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = isMaint ? "rgba(16, 185, 129, 0.1)" : "rgba(239, 68, 68, 0.1)";
                          e.currentTarget.style.color = isMaint ? "#10b981" : "#ef4444";
                        }}
                      >
                        {isMaint ? "🟢 Release to Guest Service (Clean/Operational)" : "🛠️ Place Room Out-of-Order (Maintenance Block)"}
                      </button>
                    );
                  })()}
                </div>
              )}

              <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end", marginTop: "12px" }}>
                <button className="btn-secondary" type="button" onClick={() => {
                  setShowEditRoomModal(false);
                  setSelectedRoomToEdit(null);
                }}>Cancel</button>
                <button className="btn-primary" type="submit">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 📅 NEW BOOKING / RESERVATION MODAL */}
      {showBookingModal && (
        <div className={styles.modalOverlay}>
          <div className={`${styles.modalContent} glass-card`} style={{ maxWidth: "800px" }}>
            <div className={styles.modalHeader}>
              <h2 style={{ fontSize: "1.25rem", fontWeight: "700" }}>📅 New Guest Booking</h2>
              <button className={styles.modalCloseBtn} onClick={() => { 
                setShowBookingModal(false); 
                setNewResDate("2026-05-20"); 
                setNewResStartIndex(0); 
                setNewResCheckInTime(""); 
                setNewResStep(1); 
              }}>✕</button>
            </div>

            {/* Stepper Progress Indicator */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "28px", padding: "0 10px", position: "relative" }}>
              {/* Connector line */}
              <div style={{ position: "absolute", top: "18px", left: "40px", right: "40px", height: "3px", backgroundColor: "rgba(255,255,255,0.08)", zIndex: 1 }}>
                <div style={{ 
                  height: "100%", 
                  width: `${((newResStep - 1) / 3) * 100}%`, 
                  background: "linear-gradient(to right, #6366f1, #a855f7)", 
                  transition: "width 0.3s cubic-bezier(0.4, 0, 0.2, 1)" 
                }} />
              </div>

              {[
                { step: 1, label: "Stay", desc: "Room & Schedule" },
                { step: 2, label: "Profile", desc: "Guest Details" },
                { step: 3, label: "Identity", desc: "Govt ID & Form C" },
                { step: 4, label: "Billing", desc: "Payment & Tags" }
              ].map((s) => {
                const isActive = newResStep === s.step;
                const isCompleted = newResStep > s.step;
                return (
                  <div key={s.step} style={{ display: "flex", flexDirection: "column", alignItems: "center", zIndex: 2, width: "70px", textAlign: "center" }}>
                    <div style={{
                      width: "36px",
                      height: "36px",
                      borderRadius: "50%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: "700",
                      fontSize: "0.85rem",
                      cursor: "pointer",
                      transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                      background: isCompleted 
                        ? "linear-gradient(135deg, #10b981 0%, #059669 100%)" 
                        : isActive 
                        ? "linear-gradient(135deg, #6366f1 0%, #a855f7 100%)" 
                        : "#1e293b",
                      color: isCompleted || isActive ? "#fff" : "var(--text-secondary)",
                      border: isActive 
                        ? "2px solid #818cf8" 
                        : isCompleted 
                        ? "2px solid #34d399" 
                        : "2px solid var(--border-color)",
                      boxShadow: isActive ? "0 0 12px rgba(99, 102, 241, 0.4)" : "none"
                    }}
                    onClick={() => {
                      if (s.step < newResStep) {
                        setNewResStep(s.step);
                      } else if (s.step > newResStep) {
                        if (newResStep === 1 && s.step >= 2) {
                          if (!newResRoomId) { addToast("Room Selection|Please select an assigned room.", "error"); return; }
                          if (s.step === 2) { setNewResStep(2); return; }
                        }
                        if (newResStep === 2 && s.step >= 3) {
                          if (!newResRoomId) { addToast("Room Selection|Please select an assigned room.", "error"); return; }
                          if (!newResGuestName.trim()) { addToast("Profile Name|Full Name is required.", "error"); return; }
                          if (!newResPhone.trim()) { addToast("Profile Phone|Phone number is required.", "error"); return; }
                          if (!newResDob) { addToast("Profile DoB|Date of Birth is required.", "error"); return; }
                          const birthDate = new Date(newResDob);
                          const today = new Date();
                          let age = today.getFullYear() - birthDate.getFullYear();
                          const m = today.getMonth() - birthDate.getMonth();
                          if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) { age--; }
                          if (age < 18) { addToast("Age Verification|Primary guest must be 18 years or older.", "error"); return; }
                          if (s.step === 3) { setNewResStep(3); return; }
                        }
                        if (newResStep === 3 && s.step === 4) {
                          if (!newResRoomId) { addToast("Room Selection|Please select an assigned room.", "error"); return; }
                          if (!newResGuestName.trim()) { addToast("Profile Name|Full Name is required.", "error"); return; }
                          if (!newResPhone.trim()) { addToast("Profile Phone|Phone number is required.", "error"); return; }
                          if (!newResDob) { addToast("Profile DoB|Date of Birth is required.", "error"); return; }
                          if (newResNationality === "Indian") {
                            if (newResIdType === "PAN Card") { addToast("Identity Warning|PAN Card is not accepted for check-in.", "error"); return; }
                            if (!newResIdNumber.trim()) { addToast("Identity Number|ID Number is required.", "error"); return; }
                          } else {
                            if (!newResPassportNumber.trim()) { addToast("Passport Details|Passport number is required.", "error"); return; }
                            if (!newResVisaNumber.trim()) { addToast("Visa Details|Visa number is required.", "error"); return; }
                          }
                          setNewResStep(4);
                        }
                      }
                    }}
                    >
                      {isCompleted ? "✓" : s.step}
                    </div>
                    <span style={{ 
                      fontSize: "0.75rem", 
                      fontWeight: isActive || isCompleted ? "600" : "500", 
                      color: isActive ? "#fff" : isCompleted ? "#34d399" : "var(--text-muted)", 
                      marginTop: "6px",
                      whiteSpace: "nowrap"
                    }}>
                      {s.label}
                    </span>
                  </div>
                );
              })}
            </div>

            <form onSubmit={handleCreateReservation}>
              {/* STEP 1: STAY & SCHEDULING DETAILS */}
              {newResStep === 1 && (
                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                    <div>
                      <label style={labelStyle}>Assigned Room</label>
                      <select style={inputStyle} value={newResRoomId} onChange={(e) => {
                        setNewResRoomId(e.target.value);
                        const selected = currentRooms.find((r: any) => r.id === e.target.value);
                        if (selected) {
                           setNewResBillingItems(prev => {
                             const idx = prev.findIndex(item => item.category === "room");
                             if (idx >= 0) {
                               const updated = [...prev];
                               updated[idx].amount = selected.basePrice || 0;
                               return updated;
                             }
                             return [{ name: "Room Rate", amount: selected.basePrice || 0, category: "room" }, ...prev];
                           });
                        }
                      }} required>
                        <option value="">-- Select Assigned Room --</option>
                        {currentRooms.map((room) => (
                          <option key={room.id} value={room.id}>
                            Room {room.number} — {room.name} ({room.type})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label style={labelStyle}>🏷️ Reservation Status</label>
                      <select style={inputStyle} value={newResStatus} onChange={(e) => setNewResStatus(e.target.value as any)}>
                        <option value="confirmed">🔵 Confirmed Booking</option>
                        <option value="checked-in">🟢 Checked-In Guest</option>
                        <option value="pending">🟡 Unpaid / Pending Booking</option>
                        <option value="maintenance">🛠️ Out of Order / Maintenance</option>
                      </select>
                    </div>
                  </div>

                  {/* Scheduling fields dynamically adapt to scale */}
                  {timeScale === "daily" ? (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "16px" }}>
                      <div>
                        <label style={labelStyle}>📆 Arrival Date</label>
                        <input
                          style={inputStyle}
                          type="date"
                          min="2026-05-20"
                          max="2026-06-02"
                          value={newResDate}
                          onChange={(e) => handleResDateChange(e.target.value)}
                          onClick={(e) => { try { e.currentTarget.showPicker(); } catch (err) {} }}
                          onFocus={(e) => { try { e.currentTarget.showPicker(); } catch (err) {} }}
                        />
                      </div>
                      <div>
                        <label style={labelStyle}>🌙 Duration (Nights)</label>
                        <input style={inputStyle} type="number" min="1" max="14" value={newResDuration} onChange={(e) => setNewResDuration(parseInt(e.target.value, 10))} required />
                      </div>
                      <div>
                        <label style={labelStyle}>⏰ Flexible Check-in <span style={{ fontWeight: 400, color: "var(--text-muted)", fontSize: "0.75rem" }}>(optional)</span></label>
                        <select
                          style={inputStyle}
                          value={newResCheckInTime}
                          onChange={(e) => setNewResCheckInTime(e.target.value)}
                        >
                          <option value="">— No preference —</option>
                          {["08:00 AM","10:00 AM","12:00 PM","02:00 PM","04:00 PM","06:00 PM","08:00 PM","10:00 PM"].map((t) => (
                            <option key={t} value={t}>{t}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                      <div>
                        <label style={labelStyle}>⏱️ Start Time Slot</label>
                        <select
                          style={inputStyle}
                          value={newResStartIndex}
                          onChange={(e) => setNewResStartIndex(parseInt(e.target.value, 10))}
                        >
                          {["08:00 AM","10:00 AM","12:00 PM","02:00 PM","04:00 PM","06:00 PM","08:00 PM","10:00 PM","12:00 AM","02:00 AM","04:00 AM","06:00 AM"].map((h, i) => (
                            <option key={i} value={i}>{h} (Slot {i + 1})</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label style={labelStyle}>⏳ Duration (2-Hr Slots)</label>
                        <input style={inputStyle} type="number" min="1" max="12" value={newResDuration} onChange={(e) => setNewResDuration(parseInt(e.target.value, 10))} required />
                      </div>
                    </div>
                  )}

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "16px" }}>
                    <div>
                      <label style={labelStyle}>🗓️ Check-out Date <span style={{ fontWeight: 400, color: "var(--text-muted)", fontSize: "0.75rem" }}>(auto)</span></label>
                      <input style={{...inputStyle, backgroundColor: "rgba(255,255,255,0.02)", color: "var(--text-secondary)"}} type="date" value={new Date(new Date(newResDate).getTime() + (newResDuration * 86400000)).toISOString().split("T")[0]} readOnly disabled />
                    </div>
                    <div>
                      <label style={labelStyle}>⏰ Expected Check-out Time <span style={{ fontWeight: 400, color: "var(--text-muted)", fontSize: "0.75rem" }}>(optional)</span></label>
                      <input style={inputStyle} type="text" placeholder="e.g. 11:00 AM" value={newResCheckOutTime} onChange={(e) => setNewResCheckOutTime(e.target.value)} />
                    </div>
                    <div>
                      <label style={labelStyle}>🚗 Vehicle Number (Parking) <span style={{ fontWeight: 400, color: "var(--text-muted)", fontSize: "0.75rem" }}>(optional)</span></label>
                      <input style={inputStyle} type="text" placeholder="e.g. GA-03-X-1234" value={newResVehicleNumber} onChange={(e) => setNewResVehicleNumber(e.target.value)} />
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                    <div>
                      <label style={labelStyle}>👨 Adults Count</label>
                      <input style={inputStyle} type="number" min="1" max="10" value={newResNumAdults} onChange={(e) => setNewResNumAdults(parseInt(e.target.value, 10))} required />
                    </div>
                    <div>
                      <label style={labelStyle}>👶 Children Count</label>
                      <input style={inputStyle} type="number" min="0" max="10" value={newResNumChildren} onChange={(e) => {
                        const count = parseInt(e.target.value, 10) || 0;
                        setNewResNumChildren(count);
                        setNewResChildAges((prev) => {
                          const updated = [...prev];
                          if (updated.length < count) {
                            while (updated.length < count) updated.push("");
                          } else if (updated.length > count) {
                            updated.splice(count);
                          }
                          return updated;
                        });
                      }} required />
                    </div>
                  </div>

                  {/* Dynamic child ages */}
                  {newResNumChildren > 0 && (
                    <div style={{
                      backgroundColor: "rgba(255,255,255,0.02)",
                      border: "1px dashed var(--border-color)",
                      borderRadius: "8px",
                      padding: "16px",
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))",
                      gap: "12px",
                      marginTop: "4px"
                    }}>
                      {Array.from({ length: newResNumChildren }).map((_, childIdx) => (
                        <div key={childIdx}>
                          <label style={{ ...labelStyle, fontSize: "0.75rem" }}>👶 Child {childIdx + 1} Age</label>
                          <select
                            style={{ ...inputStyle, marginBottom: 0, padding: "6px 10px", fontSize: "0.8rem" }}
                            value={newResChildAges[childIdx] || ""}
                            onChange={(e) => {
                              const updatedAges = [...newResChildAges];
                              updatedAges[childIdx] = e.target.value;
                              setNewResChildAges(updatedAges);
                            }}
                            required
                          >
                            <option value="">Age</option>
                            {Array.from({ length: 18 }).map((_, age) => (
                              <option key={age} value={age}>{age} yr{age > 1 ? 's' : ''}</option>
                            ))}
                          </select>
                        </div>
                      ))}
                    </div>
                  )}

                  <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end", marginTop: "24px" }}>
                    <button className="btn-secondary" type="button" onClick={() => { 
                      setShowBookingModal(false); 
                      setNewResDate("2026-05-20"); 
                      setNewResStartIndex(0); 
                      setNewResCheckInTime(""); 
                      setNewResStep(1); 
                    }}>Cancel</button>
                    <button className="btn-primary" type="button" onClick={() => {
                      if (!newResRoomId) {
                        addToast("Room Selection|Please assign a room before proceeding.", "error");
                      } else {
                        setNewResStep(2);
                      }
                    }}>Next Step ➔</button>
                  </div>
                </div>
              )}

              {/* STEP 2: GUEST CONTACT & PROFILE DETAILS */}
              {newResStep === 2 && (
                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                    <div>
                      <label style={labelStyle}>👤 Guest Full Name</label>
                      <input style={inputStyle} type="text" placeholder="As shown in government ID" value={newResGuestName} onChange={(e) => setNewResGuestName(e.target.value)} required />
                    </div>
                    <div>
                      <label style={labelStyle}>🌐 Nationality</label>
                      <select style={inputStyle} value={newResNationality} onChange={(e) => setNewResNationality(e.target.value)}>
                        <option value="Indian">🇮🇳 Indian National</option>
                        <option value="Foreign">🌐 Foreign National (Form C Required)</option>
                      </select>
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                    <div>
                      <label style={labelStyle}>📞 Phone Number</label>
                      <input style={inputStyle} type="tel" placeholder="e.g. +91 98765 43210 (WhatsApp alerts)" value={newResPhone} onChange={(e) => setNewResPhone(e.target.value)} required />
                    </div>
                    <div>
                      <label style={labelStyle}>✉️ Email Address</label>
                      <input style={inputStyle} type="email" placeholder="e.g. guest@example.com (digital invoices)" value={newResEmail} onChange={(e) => setNewResEmail(e.target.value)} required />
                    </div>
                  </div>

                  <div>
                    <label style={labelStyle}>🎂 Date of Birth</label>
                    <input
                      style={inputStyle}
                      type="date"
                      value={newResDob}
                      onChange={(e) => setNewResDob(e.target.value)}
                      onClick={(e) => { try { e.currentTarget.showPicker(); } catch (err) {} }}
                      onFocus={(e) => { try { e.currentTarget.showPicker(); } catch (err) {} }}
                      required
                    />
                  </div>

                  {/* DOB Under-18 Banner Block */}
                  {(() => {
                    if (!newResDob) return null;
                    const birthDate = new Date(newResDob);
                    const today = new Date();
                    let age = today.getFullYear() - birthDate.getFullYear();
                    const m = today.getMonth() - birthDate.getMonth();
                    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) { age--; }
                    if (age < 18) {
                      return (
                        <div style={{
                          backgroundColor: "rgba(239, 68, 68, 0.08)",
                          border: "1px solid rgba(239, 68, 68, 0.25)",
                          borderRadius: "8px",
                          padding: "12px 16px",
                          color: "#fca5a5",
                          fontSize: "0.85rem",
                          display: "flex",
                          alignItems: "center",
                          gap: "10px",
                          lineHeight: "1.4"
                        }}>
                          <span style={{ fontSize: "1.1rem" }}>⚠️</span>
                          <span><strong>Age Policy Alert:</strong> The primary guest is under 18 (Age: {age}). Under standard regulatory frameworks, the registering primary guest must be 18 years or older to book a stay.</span>
                        </div>
                      );
                    }
                    return null;
                  })()}

                  <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end", marginTop: "24px" }}>
                    <button className="btn-secondary" type="button" onClick={() => setNewResStep(1)}>⬅ Back</button>
                    <button className="btn-primary" type="button" onClick={() => {
                      if (!newResGuestName.trim()) { addToast("Full Name|Guest Full Name is required.", "error"); return; }
                      if (!newResPhone.trim()) { addToast("Phone Number|Phone Number is required.", "error"); return; }
                      if (!newResDob) { addToast("Date of Birth|Date of Birth is required for age verification.", "error"); return; }
                      
                      const birthDate = new Date(newResDob);
                      const today = new Date();
                      let age = today.getFullYear() - birthDate.getFullYear();
                      const m = today.getMonth() - birthDate.getMonth();
                      if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) { age--; }
                      if (age < 18) {
                        addToast("Age Restriction|Primary guest must be 18 years or older.", "error");
                        return;
                      }
                      setNewResStep(3);
                    }}>Next Step ➔</button>
                  </div>
                </div>
              )}

              {/* STEP 3: REGULATORY COMPLIANCE / GUEST IDENTIFICATION */}
              {newResStep === 3 && (
                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  {newResNationality === "Indian" ? (
                    <>
                      <h3 style={{ fontSize: "0.95rem", fontWeight: "700", color: "#fff", marginBottom: "4px" }}>🇮🇳 Domestic Indian Guest Verification</h3>
                      
                      {/* PAN Card Policy notice */}
                      <div style={{
                        backgroundColor: "rgba(245, 158, 11, 0.06)",
                        border: "1px solid rgba(245, 158, 11, 0.2)",
                        borderRadius: "8px",
                        padding: "12px 16px",
                        color: "#fcd34d",
                        fontSize: "0.85rem",
                        display: "flex",
                        alignItems: "flex-start",
                        gap: "10px",
                        lineHeight: "1.4"
                      }}>
                        <span style={{ fontSize: "1.1rem" }}>⚠️</span>
                        <div>
                          <strong>PAN Card Invalid for Check-In:</strong> Under tourism & civil regulations in India, a <strong>PAN Card is explicitly NOT accepted</strong> as valid proof of identity for checking into a hotel. Provide an Aadhaar Card, Driving License, Voter ID, or Passport.
                        </div>
                      </div>

                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                        <div>
                          <label style={labelStyle}>🆔 ID Document Type</label>
                          <select 
                            style={inputStyle} 
                            value={newResIdType === "PAN Card" ? "Aadhaar Card" : newResIdType} 
                            onChange={(e) => setNewResIdType(e.target.value)}
                          >
                            <option value="Aadhaar Card">Aadhaar Card</option>
                            <option value="Driving License">Driving License</option>
                            <option value="Voter ID Card">Voter ID Card</option>
                            <option value="Passport">Passport</option>
                            <option value="PAN Card" disabled>PAN Card (Forbidden by Govt. Mandate)</option>
                          </select>
                        </div>
                        <div>
                          <label style={labelStyle}>🔢 Alphanumeric ID Number</label>
                          <input style={inputStyle} type="text" placeholder="e.g. 1234 5678 9012" value={newResIdNumber} onChange={(e) => setNewResIdNumber(e.target.value)} required />
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <h3 style={{ fontSize: "0.95rem", fontWeight: "700", color: "#fff", marginBottom: "4px" }}>🌐 Form C Immigration Requirements (Foreign National)</h3>
                      
                      <div style={{
                        backgroundColor: "rgba(59, 130, 246, 0.06)",
                        border: "1px solid rgba(59, 130, 246, 0.2)",
                        borderRadius: "8px",
                        padding: "12px 16px",
                        color: "#93c5fd",
                        fontSize: "0.82rem",
                        lineHeight: "1.4"
                      }}>
                        ℹ️ <strong>Form C Mandate:</strong> In accordance with government regulations, all foreign guests must supply Passport, Visa, and Arrival details upon registration.
                      </div>

                      {/* Passport Details Box */}
                      <div style={{ border: "1px solid var(--border-color)", padding: "16px", borderRadius: "8px", backgroundColor: "rgba(255,255,255,0.01)" }}>
                        <h4 style={{ fontSize: "0.85rem", fontWeight: "600", color: "#818cf8", marginBottom: "12px" }}>🛂 Passport Details</h4>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                          <div>
                            <label style={{ ...labelStyle, fontSize: "0.8rem" }}>Passport Number</label>
                            <input style={{ ...inputStyle, marginBottom: 0 }} type="text" placeholder="Passport No." value={newResPassportNumber} onChange={(e) => setNewResPassportNumber(e.target.value)} required />
                          </div>
                          <div>
                            <label style={{ ...labelStyle, fontSize: "0.8rem" }}>Place of Issue</label>
                            <input style={{ ...inputStyle, marginBottom: 0 }} type="text" placeholder="e.g. London" value={newResPassportPlace} onChange={(e) => setNewResPassportPlace(e.target.value)} />
                          </div>
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginTop: "12px" }}>
                          <div>
                            <label style={{ ...labelStyle, fontSize: "0.8rem" }}>Issue Date</label>
                            <input
                              style={{ ...inputStyle, marginBottom: 0 }}
                              type="date"
                              value={newResPassportIssueDate}
                              onChange={(e) => setNewResPassportIssueDate(e.target.value)}
                              onClick={(e) => { try { e.currentTarget.showPicker(); } catch (err) {} }}
                              onFocus={(e) => { try { e.currentTarget.showPicker(); } catch (err) {} }}
                            />
                          </div>
                          <div>
                            <label style={{ ...labelStyle, fontSize: "0.8rem" }}>Expiry Date</label>
                            <input
                              style={{ ...inputStyle, marginBottom: 0 }}
                              type="date"
                              value={newResPassportExpiryDate}
                              onChange={(e) => setNewResPassportExpiryDate(e.target.value)}
                              onClick={(e) => { try { e.currentTarget.showPicker(); } catch (err) {} }}
                              onFocus={(e) => { try { e.currentTarget.showPicker(); } catch (err) {} }}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Visa Details Box */}
                      <div style={{ border: "1px solid var(--border-color)", padding: "16px", borderRadius: "8px", backgroundColor: "rgba(255,255,255,0.01)" }}>
                        <h4 style={{ fontSize: "0.85rem", fontWeight: "600", color: "#818cf8", marginBottom: "12px" }}>📄 Visa Details</h4>
                        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "16px" }}>
                          <div>
                            <label style={{ ...labelStyle, fontSize: "0.8rem" }}>Visa Number</label>
                            <input style={{ ...inputStyle, marginBottom: 0 }} type="text" placeholder="Visa No." value={newResVisaNumber} onChange={(e) => setNewResVisaNumber(e.target.value)} required />
                          </div>
                          <div>
                            <label style={{ ...labelStyle, fontSize: "0.8rem" }}>Visa Type</label>
                            <input style={{ ...inputStyle, marginBottom: 0 }} type="text" placeholder="e.g. Tourist" value={newResVisaType} onChange={(e) => setNewResVisaType(e.target.value)} />
                          </div>
                        </div>
                        <div style={{ marginTop: "12px" }}>
                          <label style={{ ...labelStyle, fontSize: "0.8rem" }}>Visa Expiry Date</label>
                          <input
                            style={{ ...inputStyle, marginBottom: 0 }}
                            type="date"
                            value={newResVisaExpiryDate}
                            onChange={(e) => setNewResVisaExpiryDate(e.target.value)}
                            onClick={(e) => { try { e.currentTarget.showPicker(); } catch (err) {} }}
                            onFocus={(e) => { try { e.currentTarget.showPicker(); } catch (err) {} }}
                          />
                        </div>
                      </div>

                      {/* Arrival info */}
                      <div style={{ border: "1px solid var(--border-color)", padding: "16px", borderRadius: "8px", backgroundColor: "rgba(255,255,255,0.01)" }}>
                        <h4 style={{ fontSize: "0.85rem", fontWeight: "600", color: "#818cf8", marginBottom: "12px" }}>✈️ Arrival & Form C Details</h4>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                          <div>
                            <label style={{ ...labelStyle, fontSize: "0.8rem" }}>India Arrival Date</label>
                            <input
                              style={{ ...inputStyle, marginBottom: 0 }}
                              type="date"
                              value={newResIndiaArrivalDate}
                              onChange={(e) => setNewResIndiaArrivalDate(e.target.value)}
                              onClick={(e) => { try { e.currentTarget.showPicker(); } catch (err) {} }}
                              onFocus={(e) => { try { e.currentTarget.showPicker(); } catch (err) {} }}
                            />
                          </div>
                          <div>
                            <label style={{ ...labelStyle, fontSize: "0.8rem" }}>Port of Entry</label>
                            <input style={{ ...inputStyle, marginBottom: 0 }} type="text" placeholder="e.g. Dabolim Goa" value={newResPortOfEntry} onChange={(e) => setNewResPortOfEntry(e.target.value)} />
                          </div>
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginTop: "12px" }}>
                          <div>
                            <label style={{ ...labelStyle, fontSize: "0.8rem" }}>Arrived From</label>
                            <input style={{ ...inputStyle, marginBottom: 0 }} type="text" placeholder="Country / City" value={newResArrivedFrom} onChange={(e) => setNewResArrivedFrom(e.target.value)} />
                          </div>
                          <div>
                            <label style={{ ...labelStyle, fontSize: "0.8rem" }}>Proceeding To</label>
                            <input style={{ ...inputStyle, marginBottom: 0 }} type="text" placeholder="Next Destination" value={newResProceedingTo} onChange={(e) => setNewResProceedingTo(e.target.value)} />
                          </div>
                        </div>
                      </div>
                    </>
                  )}

                  {/* ID Document scan upload box */}
                  <div style={{ border: "1px dashed var(--border-color)", padding: "20px", borderRadius: "8px", backgroundColor: "rgba(255,255,255,0.01)", textAlign: "center" }}>
                    <label style={{ ...labelStyle, color: "#fff", display: "inline-flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                      📸 Upload ID Document Photocopy Scan (Aadhaar/DL/Passport)
                    </label>
                    <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "12px" }}>Supported formats: JPEG, PNG, PDF. Max size: 2MB. Stored locally inside the PMS.</p>
                    
                    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "12px" }}>
                      <label style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "8px",
                        padding: "8px 16px",
                        backgroundColor: "rgba(99, 102, 241, 0.15)",
                        border: "1px solid rgba(99, 102, 241, 0.4)",
                        borderRadius: "6px",
                        color: "#818cf8",
                        fontWeight: "600",
                        fontSize: "0.85rem",
                        cursor: "pointer",
                        transition: "var(--transition-fast)"
                      }}>
                        📁 Choose File
                        <input 
                          type="file" 
                          accept="image/*,application/pdf" 
                          style={{ display: "none" }} 
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              if (file.size > 2 * 1024 * 1024) {
                                addToast("File Size Too Large|Maximum file size allowed is 2MB.", "warning");
                                return;
                              }
                              const reader = new FileReader();
                              reader.onloadend = () => {
                                setNewResIdScanData(reader.result as string);
                                addToast("ID Document Scan successfully uploaded & processed.");
                              };
                              reader.readAsDataURL(file);
                            }
                          }} 
                        />
                      </label>
                      
                      {newResIdScanData && (
                        <span style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "6px",
                          fontSize: "0.8rem",
                          color: "#34d399",
                          backgroundColor: "rgba(52, 211, 153, 0.1)",
                          padding: "6px 12px",
                          borderRadius: "6px",
                          border: "1px solid rgba(52, 211, 153, 0.2)"
                        }}>
                          ✓ Scan Uploaded ({Math.round(newResIdScanData.length / 1024)} KB)
                          <button 
                            type="button" 
                            style={{ background: "none", border: "none", color: "#f87171", cursor: "pointer", fontSize: "0.9rem", padding: "0 2px" }}
                            onClick={() => setNewResIdScanData("")}
                          >✕</button>
                        </span>
                      )}
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end", marginTop: "24px" }}>
                    <button className="btn-secondary" type="button" onClick={() => setNewResStep(2)}>⬅ Back</button>
                    <button className="btn-primary" type="button" onClick={() => {
                      if (newResNationality === "Indian") {
                        if (newResIdType === "PAN Card") {
                          addToast("Identity Warning|PAN Card is not accepted for check-in by Govt policy.", "error");
                          return;
                        }
                        if (!newResIdNumber.trim()) {
                          addToast("Identity Verification|Please enter the ID number.", "error");
                          return;
                        }
                      } else {
                        if (!newResPassportNumber.trim()) {
                          addToast("Passport Details|Passport number is required for foreign nationals.", "error");
                          return;
                        }
                        if (!newResVisaNumber.trim()) {
                          addToast("Visa Details|Visa number is required for foreign nationals.", "error");
                          return;
                        }
                      }
                      setNewResStep(4);
                    }}>Next Step ➔</button>
                  </div>
                </div>
              )}

              {/* STEP 4: PAYMENT, TAGS & STARTING CHARGES */}
              {newResStep === 4 && (
                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                    <div>
                      <label style={labelStyle}>💳 Payment Method</label>
                      <select style={inputStyle} value={newResPaymentMethod} onChange={(e) => setNewResPaymentMethod(e.target.value)}>
                        <option value="Pay at Property">Pay at Property</option>
                        <option value="UPI">UPI / QR Transfer</option>
                        <option value="Credit Card">Credit/Debit Card</option>
                        <option value="Corporate Billing">Corporate Billing</option>
                      </select>
                    </div>
                    <div>
                      <label style={labelStyle}>🏷️ Special Guest Tag badge</label>
                      <select style={inputStyle} value={newResGuestTag} onChange={(e) => setNewResGuestTag(e.target.value)}>
                        <option value="">-- No Tag --</option>
                        <option value="VIP">⭐ VIP Guest</option>
                        <option value="Corporate Guest">🏢 Corporate / Business Guest</option>
                        <option value="Frequent Flyer">✈️ Frequent Flyer (Loyalty)</option>
                        <option value="Blacklisted">⚠️ Blacklisted (Refuse Entry)</option>
                      </select>
                    </div>
                  </div>

                  {/* UPI transaction ID input conditionally */}
                  {newResPaymentMethod === "UPI" && (
                    <div>
                      <label style={labelStyle}>⚡ UPI Transaction ID / Reference No.</label>
                      <input style={inputStyle} type="text" placeholder="e.g. 612345678901 (12-digit transaction number)" value={newResUpiTransactionId} onChange={(e) => setNewResUpiTransactionId(e.target.value)} required />
                    </div>
                  )}

                  {/* Corporate/Group booking toggler */}
                  <div style={{ display: "flex", gap: "12px", alignItems: "center", marginBottom: "8px" }}>
                    <input type="checkbox" id="isGroup" checked={newResIsGroup} onChange={(e) => setNewResIsGroup(e.target.checked)} style={{ width: "16px", height: "16px", cursor: "pointer" }} />
                    <label htmlFor="isGroup" style={{ fontSize: "0.85rem", fontWeight: "600", color: "#fff", cursor: "pointer" }}>Is Corporate / Group Booking?</label>
                  </div>

                  {newResIsGroup && (
                    <div>
                      <label style={labelStyle}>Group or Company Name</label>
                      <input style={inputStyle} type="text" placeholder="e.g. TechCorp Annual Meet" value={newResGroupName} onChange={(e) => setNewResGroupName(e.target.value)} required={newResIsGroup} />
                    </div>
                  )}

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                    <div>
                      <label style={labelStyle}>Special Instructions & Details</label>
                      <textarea style={{ ...inputStyle, height: "70px", resize: "none" }} placeholder="e.g. VIP guest. Prefers airport shuttle." value={newResDetails} onChange={(e) => setNewResDetails(e.target.value)} />
                    </div>
                    <div>
                      <label style={labelStyle}>Dietary Requirements & Allergies</label>
                      <textarea style={{ ...inputStyle, height: "70px", resize: "none" }} placeholder="e.g. Vegan, peanut allergy. Avoid MSG." value={newResSpecialRequests} onChange={(e) => setNewResSpecialRequests(e.target.value)} />
                    </div>
                  </div>

                  {/* GST Billing Mode Preference */}
                  <div style={{ 
                    marginBottom: "20px", 
                    padding: "16px", 
                    backgroundColor: "rgba(255,255,255,0.02)", 
                    border: "1px dashed rgba(255,255,255,0.15)", 
                    borderRadius: "8px",
                    marginTop: "16px"
                  }}>
                    <label style={{ ...labelStyle, marginBottom: "12px", display: "block", color: "#818cf8", fontSize: "0.9rem", fontWeight: "600" }}>
                      📊 GST Billing Mode Preference
                    </label>
                    <div style={{ display: "flex", gap: "24px" }}>
                      <label style={{ 
                        display: "flex", 
                        alignItems: "center", 
                        gap: "8px", 
                        cursor: "pointer", 
                        fontSize: "0.85rem",
                        color: newResGstMode === "exclusive" ? "#fff" : "var(--text-secondary)",
                        fontWeight: newResGstMode === "exclusive" ? "600" : "400"
                      }}>
                        <input 
                          type="radio" 
                          name="gstBillingMode" 
                          checked={newResGstMode === "exclusive"} 
                          onChange={() => setNewResGstMode("exclusive")} 
                          style={{ cursor: "pointer", width: "16px", height: "16px" }}
                        />
                        Exclusive: Add GST on top of the entered room tariff
                      </label>
                      <label style={{ 
                        display: "flex", 
                        alignItems: "center", 
                        gap: "8px", 
                        cursor: "pointer", 
                        fontSize: "0.85rem",
                        color: newResGstMode === "inclusive" ? "#fff" : "var(--text-secondary)",
                        fontWeight: newResGstMode === "inclusive" ? "600" : "400"
                      }}>
                        <input 
                          type="radio" 
                          name="gstBillingMode" 
                          checked={newResGstMode === "inclusive"} 
                          onChange={() => setNewResGstMode("inclusive")} 
                          style={{ cursor: "pointer", width: "16px", height: "16px" }}
                        />
                        Inclusive: Extract GST from the entered room tariff
                      </label>
                    </div>
                  </div>

                  {/* Billing Type & Guest GST Selection */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "20px" }}>
                    <div>
                      <label style={labelStyle}>💼 Billing Type</label>
                      <select style={inputStyle} value={newResBillingType} onChange={(e) => {
                        setNewResBillingType(e.target.value as "individual" | "corporate");
                        if (e.target.value === "individual") {
                          setNewResGuestGstNumber("");
                        }
                      }}>
                        <option value="individual">👤 Individual Guest (B2C)</option>
                        <option value="corporate">🏢 Corporate / Business (B2B)</option>
                      </select>
                    </div>
                    {newResBillingType === "corporate" && (
                      <div>
                        <label style={labelStyle}>Company GST Number</label>
                        <input 
                          style={inputStyle} 
                          type="text" 
                          placeholder="e.g. 22AAAAA0000A1Z5" 
                          value={newResGuestGstNumber} 
                          onChange={(e) => setNewResGuestGstNumber(e.target.value.toUpperCase())} 
                          required 
                        />
                      </div>
                    )}
                  </div>

                  {/* 📋 STARTING INVOICE CHARGES */}
                  <div style={{ borderTop: "1px solid var(--border-color)", paddingTop: "16px" }}>
                    <h3 style={{ fontSize: "0.95rem", fontWeight: "600", color: "#fff", marginBottom: "12px" }}>📋 Starting Invoice Charges</h3>
                    
                    {newResBillingItems.length === 0 ? (
                      <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: "12px" }}>No invoice charges added yet.</p>
                    ) : (
                      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "16px" }}>
                        <thead>
                          <tr style={{ borderBottom: "1px solid var(--border-color)" }}>
                            <th style={{ textAlign: "left", fontSize: "0.75rem", color: "var(--text-muted)", padding: "4px" }}>Item Description</th>
                            <th style={{ textAlign: "left", fontSize: "0.75rem", color: "var(--text-muted)", padding: "4px" }}>Category</th>
                            <th style={{ textAlign: "right", fontSize: "0.75rem", color: "var(--text-muted)", padding: "4px" }}>Amount</th>
                            <th style={{ width: "40px" }}></th>
                          </tr>
                        </thead>
                        <tbody>
                          {newResBillingItems.map((item, idx) => (
                            <tr key={idx} style={{ borderBottom: "1px solid rgba(255,255,255,0.02)" }}>
                              <td style={{ fontSize: "0.8rem", padding: "6px 4px" }}>{item.name}</td>
                              <td style={{ fontSize: "0.75rem", color: "var(--text-secondary)", padding: "6px 4px" }}>{item.category.toUpperCase()}</td>
                              <td style={{ fontSize: "0.8rem", textAlign: "right", padding: "6px 4px" }}>₹{item.amount.toLocaleString("en-IN")}</td>
                              <td style={{ textAlign: "center" }}>
                                <button type="button" style={{ background: "none", border: "none", color: "#f87171", cursor: "pointer", fontSize: "0.8rem" }} onClick={() => handleRemoveTempCharge(idx)}>✕</button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}

                    {/* Inline adder form */}
                    <div style={{ display: "flex", gap: "8px", alignItems: "flex-end", backgroundColor: "rgba(255,255,255,0.02)", border: "1px solid var(--border-color)", borderRadius: "8px", padding: "12px" }}>
                      <div style={{ flex: 2 }}>
                        <label style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>Description</label>
                        <input style={{ ...inputStyle, marginBottom: 0, padding: "6px 10px" }} type="text" placeholder="e.g. SPA Massage" value={tempChargeName} onChange={(e) => setTempChargeName(e.target.value)} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <label style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>Amount (₹)</label>
                        <input style={{ ...inputStyle, marginBottom: 0, padding: "6px 10px" }} type="number" placeholder="2500" value={tempChargeAmount} onChange={(e) => setTempChargeAmount(e.target.value)} />
                      </div>
                      <div style={{ flex: 1.2 }}>
                        <label style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>Type</label>
                        <select style={{ ...inputStyle, marginBottom: 0, padding: "6px 10px" }} value={tempChargeCategory} onChange={(e) => setTempChargeCategory(e.target.value)}>
                          <option value="room">ROOM</option>
                          <option value="service">SERVICE</option>
                          <option value="amenity">AMENITY</option>
                        </select>
                      </div>
                      <button className="btn-secondary" type="button" style={{ padding: "6px 12px", fontSize: "0.8rem", height: "34px" }} onClick={handleAddTempCharge}>➕ Add</button>
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end", marginTop: "24px" }}>
                    <button className="btn-secondary" type="button" onClick={() => setNewResStep(3)}>⬅ Back</button>
                    <button className="btn-primary" type="submit">Confirm Guest Booking ✓</button>
                  </div>
                </div>
              )}
            </form>
          </div>
        </div>
      )}

      {/* Splitting Invoices Modal Portal */}
      {selectedRes && (
        <SplitBillingModal
          reservation={selectedRes}
          room={currentRooms.find(r => r.id === selectedRes.roomId) || currentRooms[selectedRes.roomIndex]}
          onUpdateReservation={(updatedRes) => {
            handleUpdateReservation(updatedRes);
            setSelectedRes(updatedRes);
          }}
          onClose={() => setSelectedRes(null)}
          addToast={addToast}
          activePropertyType={activePropertyType}
          activeProperty={propertiesList.find((p) => mapPropertyKey(p.name) === activeProperty)}
        />
      )}

      {/* LEAVE REQUEST MODAL */}
      {showLeaveModal && (
        <div className={styles.modalOverlay}>
          <div className={`${styles.modalContent} glass-card`} style={{ maxWidth: "500px", maxHeight: "90vh", overflowY: "auto" }}>
            <div className={styles.modalHeader}>
              <h2 style={{ fontSize: "1.25rem", fontWeight: "700" }}>📅 My Leave Requests</h2>
              <button className={styles.modalCloseBtn} onClick={() => setShowLeaveModal(false)}>✕</button>
            </div>
            
            <div style={{ marginBottom: "24px" }}>
              <h3 style={{ fontSize: "1rem", color: "#fff", marginBottom: "12px" }}>Submit New Request</h3>
              <form onSubmit={handleCreateLeave}>
                <div style={{ display: "flex", gap: "12px", marginBottom: "16px" }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: "block", marginBottom: "8px", color: "var(--text-secondary)", fontSize: "0.85rem" }}>Start Date</label>
                    <input type="date" required value={leaveStartDate} onChange={(e) => setLeaveStartDate(e.target.value)} style={{ ...inputStyle, width: "100%", padding: "10px" }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: "block", marginBottom: "8px", color: "var(--text-secondary)", fontSize: "0.85rem" }}>End Date</label>
                    <input type="date" required value={leaveEndDate} onChange={(e) => setLeaveEndDate(e.target.value)} style={{ ...inputStyle, width: "100%", padding: "10px" }} />
                  </div>
                </div>
                <div style={{ marginBottom: "16px" }}>
                  <label style={{ display: "block", marginBottom: "8px", color: "var(--text-secondary)", fontSize: "0.85rem" }}>Reason / Remarks</label>
                  <textarea required value={leaveReason} onChange={(e) => setLeaveReason(e.target.value)} placeholder="e.g. Vacation, Sick Leave" style={{ ...inputStyle, width: "100%", padding: "10px", minHeight: "60px" }} />
                </div>
                <button type="submit" className="btn-primary" style={{ width: "100%", padding: "12px", fontSize: "0.9rem" }}>
                  Submit Request
                </button>
              </form>
            </div>

            <div style={{ borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: "24px" }}>
              <h3 style={{ fontSize: "1rem", color: "#fff", marginBottom: "12px" }}>My Past Requests</h3>
              {leaveRequests.filter(l => l.userId === currentUser?.id).length === 0 ? (
                <p style={{ color: "var(--text-secondary)", fontSize: "0.85rem", textAlign: "center" }}>You have no leave requests.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {leaveRequests.filter(l => l.userId === currentUser?.id).map((leave: any) => (
                    <div key={leave.id} style={{ padding: "12px", backgroundColor: "rgba(0,0,0,0.2)", borderRadius: "6px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <span style={{ fontSize: "0.85rem", color: "#fff", display: "block" }}>
                          {new Date(leave.startDate).toLocaleDateString()} to {new Date(leave.endDate).toLocaleDateString()}
                        </span>
                        <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "4px" }}>"{leave.reason}"</p>
                      </div>
                      <span style={{ 
                        padding: "4px 8px", borderRadius: "4px", fontSize: "0.7rem", fontWeight: "600",
                        backgroundColor: leave.status === "Approved" ? "rgba(16, 185, 129, 0.1)" : leave.status === "Denied" ? "rgba(239, 68, 68, 0.1)" : "rgba(234, 179, 8, 0.1)",
                        color: leave.status === "Approved" ? "#10b981" : leave.status === "Denied" ? "#ef4444" : "#eab308"
                      }}>
                        {leave.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 🔄 PROFILE SWITCHER & CREDENTIALS KEYPAD MODAL */}
      {showProfileSwitcher && (
        <div className={styles.modalOverlay}>
          <div className={`${styles.modalContent} glass-card`} style={{ maxWidth: "450px", position: "relative" }}>
            <div className={styles.modalHeader}>
              <h2 style={{ fontSize: "1.25rem", fontWeight: "700" }}>
                {authenticatingUser ? "🔑 Staff Verification" : "🔄 Switch Staff Session"}
              </h2>
              <button className={styles.modalCloseBtn} onClick={() => {
                setShowProfileSwitcher(false);
                setAuthenticatingUser(null);
                setAuthPassword("");
                setAuthError(null);
              }}>✕</button>
            </div>

            {!authenticatingUser ? (
              /* Profile List view */
              <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                {/* Active user card with Lock Shift button */}
                <div style={{
                  background: "linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(168, 85, 247, 0.1) 100%)",
                  border: "1px solid rgba(99, 102, 241, 0.2)",
                  borderRadius: "12px",
                  padding: "16px 20px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "16px"
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                    <div className={styles.avatar} style={{ width: "48px", height: "48px", fontSize: "1.1rem", background: "var(--border-focus)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {currentUser?.avatar || "AM"}
                    </div>
                    <div>
                      <span style={{ fontSize: "0.75rem", textTransform: "uppercase", color: "var(--border-focus)", fontWeight: "700", letterSpacing: "1px" }}>Active Session</span>
                      <h3 style={{ fontSize: "1.1rem", color: "#fff", fontWeight: "600" }}>{currentUser?.name || "Aravind Mehta"}</h3>
                      <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>{currentUser?.role || "Super Admin"}</p>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                    <button
                      type="button"
                    onClick={() => {
                      localStorage.removeItem("aether_pms_user");
                      setCurrentUser(null);
                      setShowProfileSwitcher(false);
                      addToast("🔒 PMS Terminal Locked. Active shift session suspended.");
                    }}
                    className="btn-secondary"
                    style={{
                      padding: "8px 12px",
                      fontSize: "0.8rem",
                      borderColor: "rgba(239, 68, 68, 0.3)",
                      color: "#f87171",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      backgroundColor: "rgba(239, 68, 68, 0.05)",
                      cursor: "pointer",
                      borderRadius: "6px",
                      border: "1px solid rgba(239, 68, 68, 0.3)"
                    }}
                  >
                    🔒 Lock Shift
                  </button>
                  </div>
                </div>

                {/* Account selector list */}
                <div>
                  <h4 style={{ fontSize: "0.85rem", color: "var(--text-secondary)", fontWeight: "600", marginBottom: "10px" }}>Available Operators</h4>
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {usersList
                      .filter((user) => {
                        // Hide Super Admin accounts from the quick switcher when active session is regular staff
                        if (currentUser?.role !== "Super Admin" && user.role === "Super Admin") {
                          return false;
                        }
                        return true;
                      })
                      .map((user) => {
                        const isActive = user.username === currentUser?.username;
                      return (
                        <div
                          key={user.id}
                          onClick={() => {
                            if (isActive) return;
                            setAuthenticatingUser(user);
                            setAuthPassword("");
                            setAuthError(null);
                          }}
                          style={{
                            padding: "12px 16px",
                            borderRadius: "10px",
                            backgroundColor: isActive ? "rgba(255,255,255,0.01)" : "rgba(255,255,255,0.03)",
                            border: isActive ? "1px solid rgba(255,255,255,0.02)" : "1px solid var(--border-color)",
                            display: "flex",
                            alignItems: "center",
                            gap: "12px",
                            cursor: isActive ? "default" : "pointer",
                            transition: "all 0.2s ease",
                            opacity: isActive ? 0.5 : 1,
                          }}
                          onMouseEnter={(e) => {
                            if (!isActive) {
                              e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.07)";
                              e.currentTarget.style.borderColor = "var(--border-focus)";
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (!isActive) {
                              e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.03)";
                              e.currentTarget.style.borderColor = "var(--border-color)";
                            }
                          }}
                        >
                          <div className={styles.avatar} style={{ width: "32px", height: "32px", fontSize: "0.8rem", margin: 0 }}>
                            {user.avatar}
                          </div>
                          <div style={{ flexGrow: 1 }}>
                            <strong style={{ fontSize: "0.85rem", color: "#fff", display: "block" }}>{user.name}</strong>
                            <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>{user.role}</span>
                          </div>
                          {!isActive && <span style={{ fontSize: "0.8rem", color: "var(--border-focus)" }}>🔑 Login</span>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : (
              /* Authentication Passcode pad */
              <form onSubmit={handleVerifyPassword} style={{ display: "flex", flexDirection: "column", gap: "20px", alignItems: "center" }}>
                {authSuccess ? (
                  /* Success Loader animation */
                  <div style={{ textAlign: "center", padding: "40px 0", display: "flex", flexDirection: "column", gap: "16px", alignItems: "center" }}>
                    <div style={{
                      width: "60px",
                      height: "60px",
                      borderRadius: "50%",
                      backgroundColor: "var(--status-checkedin-bg)",
                      border: "3px solid var(--status-checkedin)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "2rem",
                      color: "var(--status-checkedin)",
                    }}>✓</div>
                    <div>
                      <h3 style={{ color: "#fff", fontSize: "1.1rem", fontWeight: "600" }}>Access Granted</h3>
                      <p style={{ color: "var(--text-secondary)", fontSize: "0.85rem", marginTop: "4px" }}>Initializing console workspace...</p>
                    </div>
                  </div>
                ) : (
                  <>
                    <div style={{ textAlign: "center", width: "100%" }}>
                      <div className={styles.avatar} style={{ width: "50px", height: "50px", fontSize: "1.2rem", background: "var(--border-focus)", color: "#fff", margin: "0 auto 12px auto" }}>
                        {authenticatingUser.avatar}
                      </div>
                      <h3 style={{ fontSize: "1.1rem", color: "#fff", fontWeight: "600" }}>{authenticatingUser.name}</h3>
                      <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)", display: "block", marginTop: "2px" }}>
                        Role Clearance: <strong>{authenticatingUser.role}</strong>
                      </span>
                    </div>

                    {/* Password display line */}
                    <div style={{ width: "100%" }}>
                      <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                        <input
                          id="auth-pin-input"
                          type={showPassword ? "text" : "password"}
                          style={{
                            ...inputStyle,
                            marginBottom: 0,
                            paddingRight: "40px",
                            textAlign: "center",
                            fontSize: "1.25rem",
                            letterSpacing: "4px",
                            fontWeight: "700"
                          }}
                          placeholder="••••••••"
                          value={authPassword}
                          onChange={(e) => setAuthPassword(e.target.value)}
                          required
                          autoFocus
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          style={{
                            position: "absolute",
                            right: "12px",
                            background: "none",
                            border: "none",
                            color: "var(--text-secondary)",
                            cursor: "pointer",
                            fontSize: "1rem"
                          }}
                        >
                          {showPassword ? "👁️" : "🙈"}
                        </button>
                      </div>
                      {authError && (
                        <p style={{ color: "#f87171", fontSize: "0.8rem", marginTop: "6px", textAlign: "center", fontWeight: "500" }}>
                          ⚠️ {authError}
                        </p>
                      )}
                    </div>

                    {/* Interactive PIN Pad */}
                    <div style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(3, 1fr)",
                      gap: "10px",
                      width: "280px",
                      marginTop: "4px"
                    }}>
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                        <button
                          key={num}
                          type="button"
                          className="btn-secondary"
                          style={{ height: "50px", fontSize: "1.2rem", fontWeight: "600", justifyContent: "center", borderRadius: "10px" }}
                          onClick={() => setAuthPassword((prev) => prev + num)}
                        >
                          {num}
                        </button>
                      ))}
                      <button
                        type="button"
                        className="btn-secondary"
                        style={{ height: "50px", fontSize: "0.85rem", fontWeight: "600", justifyContent: "center", borderRadius: "10px", color: "#ef4444" }}
                        onClick={() => setAuthPassword("")}
                      >
                        CLEAR
                      </button>
                      <button
                        type="button"
                        className="btn-secondary"
                        style={{ height: "50px", fontSize: "1.2rem", fontWeight: "600", justifyContent: "center", borderRadius: "10px" }}
                        onClick={() => setAuthPassword((prev) => prev + "0")}
                      >
                        0
                      </button>
                      <button
                        type="button"
                        className="btn-secondary"
                        style={{ height: "50px", fontSize: "0.85rem", fontWeight: "600", justifyContent: "center", borderRadius: "10px", color: "var(--text-secondary)" }}
                        onClick={() => setAuthPassword((prev) => prev.slice(0, -1))}
                      >
                        ⌫
                      </button>
                    </div>

                    {/* Bottom action row */}
                    <div style={{ display: "flex", gap: "12px", width: "100%", marginTop: "12px" }}>
                      <button
                        type="button"
                        className="btn-secondary"
                        style={{ flexGrow: 1, justifyContent: "center" }}
                        onClick={() => {
                          setAuthenticatingUser(null);
                          setAuthPassword("");
                          setAuthError(null);
                        }}
                      >
                        Back
                      </button>
                      <button
                        type="submit"
                        className="btn-primary"
                        style={{ flexGrow: 1, justifyContent: "center" }}
                      >
                        Verify & Login
                      </button>
                    </div>
                  </>
                )}
              </form>
            )}
          </div>
        </div>
      )}
      
      {/* Shift Swap Modal */}
      {showShiftSwapModal && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(15,23,42,0.85)", backdropFilter: "blur(4px)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <form className="glass-card" style={{ width: "400px", maxWidth: "90vw", padding: "24px", position: "relative" }} onSubmit={async (e) => {
            e.preventDefault();
            const res = await fetch("/api/shift-swap", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                requesterId: currentUser?.id,
                targetUserId: swapTargetUserId || null,
                proposedShift: swapProposedShift,
                reason: swapReason
              })
            });
            if (res.ok) {
              setShowShiftSwapModal(false);
              setSwapReason("");
              setSwapTargetUserId("");
              setSwapProposedShift("Morning");
              addToast("✅ Shift change requested successfully");
              fetchShiftSwapRequests();
            } else {
              addToast("⚠️ Failed to request shift change", "error");
            }
          }}>
            <button
              type="button"
              onClick={() => setShowShiftSwapModal(false)}
              style={{ position: "absolute", top: "16px", right: "16px", background: "none", border: "none", color: "var(--text-secondary)", cursor: "pointer", fontSize: "1.2rem" }}
            >
              ✕
            </button>
            <h2 style={{ fontSize: "1.2rem", fontWeight: "600", color: "#fff", marginBottom: "16px" }}>🔄 Request Shift Change / Swap</h2>
            
            <div style={{ display: "flex", flexDirection: "column", gap: "16px", marginBottom: "24px" }}>
              <div>
                <label style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginBottom: "6px", display: "block" }}>Desired Shift</label>
                <select style={{ ...inputStyle, width: "100%" }} value={swapProposedShift} onChange={(e) => setSwapProposedShift(e.target.value)} required>
                  <option value="Morning">Morning</option>
                  <option value="Evening">Evening</option>
                  <option value="Night">Night</option>
                </select>
              </div>
              
              <div>
                <label style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginBottom: "6px", display: "block" }}>Swap with (Optional)</label>
                <select style={{ ...inputStyle, width: "100%" }} value={swapTargetUserId} onChange={(e) => setSwapTargetUserId(e.target.value)}>
                  <option value="">-- No specific person, just change my shift --</option>
                  {usersList.filter((u: any) => u.id !== currentUser?.id).map((u: any) => (
                    <option key={u.id} value={u.id}>{u.name} (Currently on {u.assignedShift || "Morning"})</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginBottom: "6px", display: "block" }}>Reason for change</label>
                <textarea
                  style={{ ...inputStyle, width: "100%", minHeight: "80px", resize: "vertical" }}
                  value={swapReason}
                  onChange={(e) => setSwapReason(e.target.value)}
                  placeholder="Explain why you need this shift change..."
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              style={{ width: "100%", background: "linear-gradient(135deg,#3b82f6,#2dd4bf)", color: "#fff", border: "none", padding: "12px", borderRadius: "8px", fontSize: "1rem", fontWeight: "600", cursor: "pointer" }}
            >
              Submit Request
            </button>
          </form>
        </div>
      )}

      {/* Permissions Modal */}
      {editingPermissionsUserId && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(15,23,42,0.85)", backdropFilter: "blur(4px)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div className="glass-card" style={{ width: "450px", maxWidth: "90vw", padding: "24px", position: "relative" }}>
            <button
              onClick={() => setEditingPermissionsUserId(null)}
              style={{ position: "absolute", top: "16px", right: "16px", background: "none", border: "none", color: "var(--text-secondary)", cursor: "pointer", fontSize: "1.2rem" }}
            >
              ✕
            </button>
            <h2 style={{ fontSize: "1.2rem", fontWeight: "600", color: "#fff", marginBottom: "8px" }}>🔑 Edit Custom Permissions</h2>
            <p style={{ color: "var(--text-secondary)", fontSize: "0.85rem", marginBottom: "20px", lineHeight: "1.5" }}>
              Select exactly which modules this staff member can access. This overrides their default role permissions.
            </p>
            
            
            <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "24px", maxHeight: "70vh", flexGrow: 1, overflowY: "auto", paddingRight: "8px" }}>
              {[
                { id: "front-office", label: "🗓️ Front Office (Bookings)" },
                { id: "front-desk", label: "🛎️ Front Desk (Check-in/out)" },
                { id: "channel-manager", label: "🌍 Channel Manager" },
                { id: "housekeeping", label: "🧹 Housekeeping & Ops" },
                { id: "finance", label: "💰 Finance & GST" },
                { id: "reviews", label: "⭐ Reviews" },
                { 
                  id: "attendance", label: "⏱️ Attendance", 
                  subPerms: [
                    { id: "attendance:approve-leave", label: "Approve/Deny Leave Requests" },
                    { id: "attendance:approve-swap", label: "Approve/Deny Shift Swaps" },
                    { id: "attendance:manual-clock", label: "Manually Clock Staff In/Out" }
                  ]
                },
                { 
                  id: "staff-management", label: "👥 Staff & Shifts",
                  subPerms: [
                    { id: "staff-management:add", label: "Register New Staff" },
                    { id: "staff-management:edit-shift", label: "Assign/Edit Shifts" },
                    { id: "staff-management:delete", label: "Delete Staff Accounts" }
                  ]
                },
                { id: "settings", label: "⚙️ Settings" },
              ].map((perm) => (
                <div key={perm.id} style={{ display: "flex", flexDirection: "column", backgroundColor: "rgba(255,255,255,0.03)", border: "1px solid var(--border-color)", borderRadius: "8px", overflow: "hidden" }}>
                  {!perm.subPerms ? (
                    <label style={{ display: "flex", alignItems: "center", gap: "12px", cursor: "pointer", padding: "12px 14px", transition: "all 0.2s ease" }}>
                      <input
                        type="checkbox"
                        checked={editPermissionsValue.includes(perm.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setEditPermissionsValue([...editPermissionsValue, perm.id]);
                          } else {
                            setEditPermissionsValue(editPermissionsValue.filter((id) => id !== perm.id && !id.startsWith(perm.id + ":")));
                          }
                        }}
                        style={{ width: "18px", height: "18px", accentColor: "#6366f1", cursor: "pointer" }}
                      />
                      <span style={{ fontSize: "0.95rem", color: "#fff", fontWeight: "500" }}>{perm.label}</span>
                    </label>
                  ) : (
                    <details open={editPermissionsValue.includes(perm.id)} style={{ width: "100%" }}>
                      <summary style={{ display: "flex", alignItems: "center", gap: "12px", cursor: "pointer", padding: "12px 14px", listStyle: "none", position: "relative", outline: "none" }}>
                        <input
                          type="checkbox"
                          checked={editPermissionsValue.includes(perm.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setEditPermissionsValue([...editPermissionsValue, perm.id]);
                            } else {
                              setEditPermissionsValue(editPermissionsValue.filter((id) => id !== perm.id && !id.startsWith(perm.id + ":")));
                            }
                          }}
                          style={{ width: "18px", height: "18px", accentColor: "#6366f1", cursor: "pointer" }}
                        />
                        <span style={{ fontSize: "0.95rem", color: "#fff", fontWeight: "500", flexGrow: 1 }}>{perm.label}</span>
                        <span style={{ color: "var(--text-muted)", fontSize: "0.8rem", paddingRight: "8px" }}>▼</span>
                        
                        <style dangerouslySetInnerHTML={{__html: `
                          summary::-webkit-details-marker { display: none; }
                          details[open] summary span:last-child { transform: rotate(180deg); }
                        `}} />
                      </summary>
                      
                      <div style={{ display: "flex", flexDirection: "column", gap: "10px", padding: "12px 14px 16px 44px", borderTop: "1px solid rgba(255,255,255,0.05)", backgroundColor: "rgba(0,0,0,0.15)" }}>
                        {perm.subPerms.map((sub) => (
                          <label key={sub.id} style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer", padding: "4px 0" }}>
                            <input
                              type="checkbox"
                              checked={editPermissionsValue.includes(sub.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  // Auto-check parent if a sub is checked
                                  const newArr = new Set([...editPermissionsValue, sub.id, perm.id]);
                                  setEditPermissionsValue(Array.from(newArr));
                                } else {
                                  setEditPermissionsValue(editPermissionsValue.filter((id) => id !== sub.id));
                                }
                              }}
                              style={{ width: "16px", height: "16px", accentColor: "#8b5cf6", cursor: "pointer", borderRadius: "4px" }}
                            />
                            <span style={{ fontSize: "0.85rem", color: "var(--text-secondary)", fontWeight: "500" }}>{sub.label}</span>
                          </label>
                        ))}
                      </div>
                    </details>
                  )}
                </div>
              ))}
            </div>


            <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
              <button
                onClick={() => setEditingPermissionsUserId(null)}
                style={{ background: "transparent", color: "var(--text-secondary)", border: "1px solid var(--border-color)", padding: "10px 16px", borderRadius: "8px", fontSize: "0.9rem", fontWeight: "600", cursor: "pointer" }}
              >
                Cancel
              </button>
              <button
                onClick={() => handleUpdatePermissions(editingPermissionsUserId)}
                disabled={isUpdatingPermissions}
                style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)", color: "#fff", border: "none", padding: "10px 20px", borderRadius: "8px", fontSize: "0.9rem", fontWeight: "600", cursor: "pointer", display: "flex", alignItems: "center", gap: "8px", boxShadow: "0 4px 12px rgba(99,102,241,0.3)" }}
              >
                {isUpdatingPermissions ? "Saving..." : "Save Permissions"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dynamic Toast Notifications */}
      {toastMessage && (
        toastType === "error" ? (
          <div className={styles.toastError}>
            <span className={styles.toastErrorIcon}>🚫</span>
            <div>
              <div className={styles.toastErrorTitle}>{toastMessage.split("|")[0]}</div>
              <div className={styles.toastErrorBody}>{toastMessage.split("|")[1] || toastMessage.split("|")[0]}</div>
            </div>
          </div>
        ) : toastType === "warning" ? (
          <div className={styles.toastWarning}>⚠️ {toastMessage}</div>
        ) : (
          <div className={styles.toast}>🔔 {toastMessage}</div>
        )
      )}
    </main>
  );
}
