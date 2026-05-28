"use client";

import React, { useState, useEffect } from "react";

interface Review {
  id: string;
  guestName: string;
  rating: number;
  comment: string;
  source: string;
  sentimentScore: number | null;
  topics: string | null;
  reviewType: string | null;
  autoReply: string | null;
  createdAt: string;
}

const OTA_PLATFORMS = [
  { value: "bookingComUrl",  label: "Booking.com",           icon: "🏨", domain: "booking.com" },
  { value: "agodaUrl",       label: "Agoda",                 icon: "🌏", domain: "agoda.com" },
  { value: "tripAdvisorUrl", label: "TripAdvisor",           icon: "🦉", domain: "tripadvisor.com" },
  { value: "makeMyTripUrl",  label: "MakeMyTrip",            icon: "✈️", domain: "makemytrip.com" },
  { value: "expediaUrl",     label: "Expedia",               icon: "🗺️", domain: "expedia.com" },
  { value: "hotelsComUrl",   label: "Hotels.com",            icon: "🏩", domain: "hotels.com" },
  { value: "airbnbUrl",      label: "Airbnb",                icon: "🏡", domain: "airbnb.com" },
  { value: "goibiboUrl",     label: "Goibibo",               icon: "🚀", domain: "goibibo.com" },
  { value: "yatraUrl",       label: "Yatra",                 icon: "🛫", domain: "yatra.com" },
  { value: "oyoUrl",         label: "OYO Rooms",             icon: "🔴", domain: "oyorooms.com" },
  { value: "easemytripUrl",  label: "EaseMyTrip",            icon: "💼", domain: "easemytrip.com" },
  { value: "custom",         label: "Other / Custom",        icon: "➕", domain: "" },
];

export default function ReviewDashboard({ activePropertyId, addToast }: {
  activePropertyId: string;
  addToast: (msg: string, type?: "success" | "error" | "warning") => void;
}) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [platformInput, setPlatformInput] = useState("bookingComUrl");
  const [customPlatformName, setCustomPlatformName] = useState("");
  const [customPlatformDomain, setCustomPlatformDomain] = useState("");
  const [activeTab, setActiveTab] = useState("All");
  const [stats, setStats] = useState({ average: 0, total: 0 });
  const [linkedPlatforms, setLinkedPlatforms] = useState<{ label: string; value: string; url: string }[]>([]);

  const isCustomPlatform = platformInput === "custom";

  const loadLinkedPlatforms = async () => {
    try {
      const res = await fetch(`/api/properties/${activePropertyId}`);
      const data = await res.json();
      if (!data) return;
      const linked: { label: string; value: string; url: string }[] = [];
      for (const p of OTA_PLATFORMS.filter(x => x.value !== "custom")) {
        const url = (data as any)[p.value];
        if (url) linked.push({ label: p.label, value: p.value, url });
      }
      // Custom platforms
      if (data.customOtaUrls) {
        try {
          const customs: { name: string; url: string }[] = JSON.parse(data.customOtaUrls);
          for (const c of customs) linked.push({ label: c.name, value: "custom", url: c.url });
        } catch {}
      }
      setLinkedPlatforms(linked);
    } catch {}
  };

  const unlinkPlatform = async (fieldValue: string, url: string) => {
    try {
      if (fieldValue === "custom") {
        // Remove from customOtaUrls JSON array
        const res = await fetch(`/api/properties/${activePropertyId}`);
        const data = await res.json();
        let customs: { name: string; url: string; domain: string }[] = [];
        try { customs = JSON.parse(data.customOtaUrls || "[]"); } catch {}
        const updated = customs.filter(c => c.url !== url);
        await fetch(`/api/properties/${activePropertyId}`, {
          method: "PUT", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ customOtaUrls: JSON.stringify(updated) })
        });
      } else {
        await fetch(`/api/properties/${activePropertyId}`, {
          method: "PUT", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ [fieldValue]: "" })
        });
      }
      addToast("✅ Platform unlinked.", "success");
      loadLinkedPlatforms();
    } catch {
      addToast("❌ Failed to unlink platform.", "error");
    }
  };

  const fetchReviews = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/reviews?propertyId=${activePropertyId}`);
      const data = await res.json();
      if (data.success) {
        setReviews(data.reviews);
        const total = data.reviews.length;
        const avg = total > 0 ? data.reviews.reduce((acc: number, r: Review) => acc + r.rating, 0) / total : 0;
        setStats({ average: avg, total });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activePropertyId) fetchReviews();
  }, [activePropertyId]);

  // Derived state for filtering
  const reviewPlatforms = ["All", ...Array.from(new Set(reviews.map(r => r.source)))];
  const filteredReviews = activeTab === "All" ? reviews : reviews.filter(r => r.source === activeTab);

  const handleSync = async () => {
    try {
      setSyncing(true);
      addToast("Initiating OTA pipeline sync. This may take 30-60 seconds...", "warning");
      const res = await fetch("/api/reviews/sync-worker", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ propertyId: activePropertyId })
      });
      const data = await res.json();
      if (data.success) {
        addToast(`✅ Sync Complete: Pulled ${data.totalProcessed} new reviews from configured platforms.`, "success");
        fetchReviews();
      } else {
        addToast(`❌ Sync Failed: ${data.error}`, "error");
      }
    } catch (error: any) {
      addToast(`❌ System Error: ${error.message}`, "error");
    } finally {
      setSyncing(false);
    }
  };

  const renderStars = (rating: number) =>
    Array.from({ length: 5 }).map((_, i) => (
      <span key={i} style={{ color: i < rating ? "#ffc107" : "#e4e5e9", fontSize: "1.2rem" }}>★</span>
    ));

  const handleSearch = async () => {
    if (isCustomPlatform) {
      addToast("For custom platforms, please paste the URL directly below.", "warning");
      return;
    }
    if (!searchQuery.trim()) return addToast("Please enter a hotel name", "warning");
    try {
      setIsSearching(true);
      setSearchResults([]);
      const res = await fetch(`/api/reviews/search?q=${encodeURIComponent(searchQuery)}&platform=${platformInput}`);
      const data = await res.json();
      if (data.success) {
        setSearchResults(data.results);
        if (data.results.length === 0) addToast("No results found. Try a different search term.", "warning");
      } else {
        addToast(`❌ Search Failed: ${data.error}`, "error");
      }
    } catch (e: any) {
      addToast(`❌ Error: ${e.message}`, "error");
    } finally {
      setIsSearching(false);
    }
  };

  const saveSelectedUrl = async (url: string) => {
    try {
      addToast("Saving OTA link...", "warning");
      let payload: any = {};

      if (isCustomPlatform) {
        if (!customPlatformName.trim() || !url.trim()) {
          return addToast("Please enter both a platform name and a URL.", "warning");
        }
        // Fetch existing customOtaUrls, append new entry
        const propRes = await fetch(`/api/properties/${activePropertyId}`);
        const propData = await propRes.json();
        let existing: any[] = [];
        if (propData?.customOtaUrls) {
          try { existing = JSON.parse(propData.customOtaUrls); } catch {}
        }
        const domain = customPlatformDomain.trim() || new URL(url).hostname.replace("www.", "");
        existing.push({ name: customPlatformName.trim(), url: url.trim(), domain });
        payload = { customOtaUrls: JSON.stringify(existing) };
      } else {
        payload = { [platformInput]: url };
      }

      const res = await fetch(`/api/properties/${activePropertyId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        addToast("✅ OTA link saved successfully!", "success");
        setShowConfig(false);
        setSearchQuery("");
        setSearchResults([]);
        setUrlInput("");
        setCustomPlatformName("");
        setCustomPlatformDomain("");
      } else {
        addToast("❌ Failed to save URL", "error");
      }
    } catch (e: any) {
      addToast(`❌ Error: ${e.message}`, "error");
    }
  };

  const selectedPlatformLabel = OTA_PLATFORMS.find(p => p.value === platformInput)?.label || "Platform";

  return (
    <div style={{ padding: "24px", maxWidth: "1200px", margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "32px" }}>
        <div>
          <h1 style={{ fontSize: "2rem", fontWeight: "700", color: "#111", letterSpacing: "-0.5px" }}>Reviews & Reputation</h1>
          <p style={{ color: "var(--text-secondary)", marginTop: "4px" }}>Monitor and analyze OTA feedback in real-time.</p>
        </div>
        <div style={{ display: "flex", gap: "12px" }}>
          <button
            onClick={() => { setShowConfig(true); loadLinkedPlatforms(); }}
            style={{ padding: "10px 16px", backgroundColor: "transparent", border: "1px solid var(--border-color)", color: "var(--text-secondary)", borderRadius: "6px", fontWeight: "600", cursor: "pointer", transition: "all 0.2s" }}
          >
            ⚙️ Add Platform
          </button>
          <button
            onClick={handleSync}
            disabled={syncing}
            style={{ padding: "10px 20px", backgroundColor: syncing ? "var(--border-color)" : "var(--primary-color)", color: syncing ? "#666" : "#fff", border: "none", borderRadius: "6px", fontWeight: "600", cursor: syncing ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: "8px", transition: "all 0.2s" }}
          >
            {syncing ? "🔄 Pipeline Syncing..." : "⚡ Sync Reviews Now"}
          </button>
        </div>
      </div>

      {/* OTA Config Modal */}
      {showConfig && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: "#fff", padding: "32px", borderRadius: "12px", width: "100%", maxWidth: "640px", boxShadow: "0 10px 40px rgba(0,0,0,0.15)", maxHeight: "85vh", overflowY: "auto" }}>
            <h2 style={{ fontSize: "1.5rem", marginBottom: "6px", color: "#111" }}>OTA Auto-Discovery</h2>
            <p style={{ color: "var(--text-secondary)", marginBottom: "16px", fontSize: "0.9rem" }}>
              Select a platform, search for your property, and link it to AetherHMS in one click.
            </p>

            {/* Currently Linked Platforms */}
            {linkedPlatforms.length > 0 && (
              <div style={{ marginBottom: "20px", background: "#f8f9fa", borderRadius: "10px", border: "1px solid #e8eaed", overflow: "hidden" }}>
                <div style={{ padding: "10px 14px", background: "#eef3ff", borderBottom: "1px solid #e8eaed", fontWeight: "700", fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.5px", color: "#4285f4" }}>
                  ✅ Currently Linked Platforms
                </div>
                {linkedPlatforms.map((lp, idx) => (
                  <div key={idx} style={{ padding: "10px 14px", borderBottom: idx < linkedPlatforms.length - 1 ? "1px solid #e8eaed" : "none", display: "flex", justifyContent: "space-between", alignItems: "center", background: "#fff" }}>
                    <div>
                      <span style={{ fontWeight: "600", fontSize: "0.85rem", color: "#111" }}>{lp.label}</span>
                      <span style={{ fontSize: "0.75rem", color: "#888", marginLeft: "8px", maxWidth: "300px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "inline-block", verticalAlign: "middle" }}>
                        {lp.url.replace("https://", "").replace("http://", "").substring(0, 50)}...
                      </span>
                    </div>
                    <button
                      onClick={() => unlinkPlatform(lp.value, lp.url)}
                      style={{ padding: "4px 10px", background: "#fff0f0", color: "#c0392b", border: "1px solid #f5c6c6", borderRadius: "4px", fontSize: "0.75rem", fontWeight: "600", cursor: "pointer" }}
                    >
                      ✕ Remove
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Platform Selector Grid */}
            <label style={{ display: "block", marginBottom: "12px", fontWeight: "700", fontSize: "0.85rem", textTransform: "uppercase", letterSpacing: "0.5px", color: "#888" }}>Select Platform</label>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px", marginBottom: "24px" }}>
              {OTA_PLATFORMS.map(p => {
                const isSelected = platformInput === p.value;
                return (
                  <button
                    key={p.value}
                    onClick={() => { setPlatformInput(p.value); setSearchResults([]); setUrlInput(""); }}
                    style={{
                      padding: "12px 8px",
                      borderRadius: "10px",
                      border: isSelected ? "2px solid var(--primary-color)" : "1.5px solid #e8eaed",
                      background: isSelected ? "#eef3ff" : "#fafafa",
                      color: isSelected ? "var(--primary-color)" : "#444",
                      fontWeight: isSelected ? "700" : "500",
                      fontSize: "0.82rem",
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: "6px",
                      boxShadow: isSelected ? "0 0 0 3px rgba(66,133,244,0.12)" : "none",
                    }}
                  >
                    <span style={{ fontSize: "1.4rem", lineHeight: 1 }}>{p.icon}</span>
                    <span>{p.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Custom Platform Fields */}
            {isCustomPlatform ? (
              <div style={{ marginBottom: "20px", background: "#f8f9fa", padding: "16px", borderRadius: "8px", border: "1px solid var(--border-color)" }}>
                <p style={{ fontSize: "0.85rem", color: "#666", marginBottom: "12px" }}>
                  Enter the name and direct URL of your property's review page on the custom platform.
                </p>
                <input
                  type="text"
                  value={customPlatformName}
                  onChange={e => setCustomPlatformName(e.target.value)}
                  placeholder="Platform name (e.g. Cleartrip, Via.com)"
                  style={{ width: "100%", padding: "10px 12px", borderRadius: "6px", border: "1px solid var(--border-color)", outline: "none", marginBottom: "8px", boxSizing: "border-box" }}
                />
                <input
                  type="url"
                  value={urlInput}
                  onChange={e => setUrlInput(e.target.value)}
                  placeholder="Full URL of your hotel page"
                  style={{ width: "100%", padding: "10px 12px", borderRadius: "6px", border: "1px solid var(--border-color)", outline: "none", marginBottom: "8px", boxSizing: "border-box" }}
                />
                <button
                  onClick={() => saveSelectedUrl(urlInput)}
                  disabled={!customPlatformName.trim() || !urlInput.trim()}
                  style={{ width: "100%", padding: "10px", background: "var(--primary-color)", color: "#fff", border: "none", borderRadius: "6px", fontWeight: "600", cursor: "pointer" }}
                >
                  💾 Save Custom Platform
                </button>
              </div>
            ) : (
              <>
                {/* Search Box */}
                <label style={{ display: "block", marginBottom: "8px", fontWeight: "600", fontSize: "0.9rem" }}>
                  Search on {selectedPlatformLabel}
                </label>
                <div style={{ display: "flex", gap: "10px", marginBottom: "16px" }}>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handleSearch()}
                    placeholder="e.g. Taj Mahal Palace Mumbai"
                    style={{ flex: 1, padding: "12px", borderRadius: "6px", border: "1px solid var(--border-color)", outline: "none" }}
                  />
                  <button
                    onClick={handleSearch}
                    disabled={isSearching}
                    style={{ padding: "12px 20px", background: isSearching ? "var(--border-color)" : "var(--primary-color)", color: isSearching ? "#666" : "#fff", border: "none", borderRadius: "6px", cursor: isSearching ? "not-allowed" : "pointer", fontWeight: "600", whiteSpace: "nowrap" }}
                  >
                    {isSearching ? "Searching..." : "🔍 Search"}
                  </button>
                </div>

                {/* Search Results */}
                {searchResults.length > 0 && (
                  <div style={{ marginBottom: "16px", border: "1px solid var(--border-color)", borderRadius: "8px", overflow: "hidden" }}>
                    <div style={{ padding: "10px 16px", background: "#f8f9fa", borderBottom: "1px solid var(--border-color)", fontWeight: "600", fontSize: "0.85rem" }}>
                      Select your property:
                    </div>
                    {searchResults.map((result, idx) => (
                      <div key={idx} style={{ padding: "14px 16px", borderBottom: idx === searchResults.length - 1 ? "none" : "1px solid var(--border-color)", display: "flex", justifyContent: "space-between", alignItems: "center", background: "#fff" }}>
                        <div>
                          <div style={{ fontWeight: "600", color: "#111", marginBottom: "2px" }}>{result.name}</div>
                          <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>{result.address || "Location not provided"}</div>
                        </div>
                        <button
                          onClick={() => saveSelectedUrl(result.link)}
                          style={{ padding: "7px 14px", background: "#e7f1ff", color: "#004085", border: "none", borderRadius: "4px", cursor: "pointer", fontWeight: "600", fontSize: "0.82rem", whiteSpace: "nowrap" }}
                        >
                          Link Property
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Manual URL fallback */}
                <div style={{ marginTop: "8px" }}>
                  <label style={{ display: "block", marginBottom: "6px", fontSize: "0.82rem", color: "#666" }}>
                    Or paste URL manually:
                  </label>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <input
                      type="url"
                      value={urlInput}
                      onChange={e => setUrlInput(e.target.value)}
                      placeholder="https://..."
                      style={{ flex: 1, padding: "10px 12px", borderRadius: "6px", border: "1px solid var(--border-color)", outline: "none", fontSize: "0.85rem" }}
                    />
                    <button
                      onClick={() => saveSelectedUrl(urlInput)}
                      disabled={!urlInput.trim()}
                      style={{ padding: "10px 14px", background: "#e7f1ff", color: "#004085", border: "none", borderRadius: "6px", fontWeight: "600", cursor: "pointer", fontSize: "0.85rem" }}
                    >
                      Save
                    </button>
                  </div>
                </div>
              </>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "20px" }}>
              <button
                onClick={() => { setShowConfig(false); setSearchResults([]); setSearchQuery(""); setUrlInput(""); setCustomPlatformName(""); }}
                style={{ padding: "10px 16px", background: "transparent", border: "none", cursor: "pointer", fontWeight: "600", color: "#666" }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Analytics Overview */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "20px", marginBottom: "32px" }}>
        <div style={{ background: "#fff", padding: "24px", borderRadius: "12px", border: "1px solid var(--border-color)", boxShadow: "0 2px 8px rgba(0,0,0,0.02)" }}>
          <div style={{ color: "var(--text-secondary)", fontSize: "0.85rem", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "8px" }}>Average Rating</div>
          <div style={{ fontSize: "2.5rem", fontWeight: "700", color: "#111", display: "flex", alignItems: "center", gap: "12px" }}>
            {stats.average.toFixed(1)} <span style={{ fontSize: "1.2rem", color: "#ffc107" }}>★</span>
          </div>
        </div>
        <div style={{ background: "#fff", padding: "24px", borderRadius: "12px", border: "1px solid var(--border-color)", boxShadow: "0 2px 8px rgba(0,0,0,0.02)" }}>
          <div style={{ color: "var(--text-secondary)", fontSize: "0.85rem", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "8px" }}>Total Reviews</div>
          <div style={{ fontSize: "2.5rem", fontWeight: "700", color: "#111" }}>{stats.total}</div>
        </div>
        <div style={{ background: "#fff", padding: "24px", borderRadius: "12px", border: "1px solid var(--border-color)", boxShadow: "0 2px 8px rgba(0,0,0,0.02)" }}>
          <div style={{ color: "var(--text-secondary)", fontSize: "0.85rem", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "8px" }}>Pipeline Health</div>
          <div style={{ fontSize: "1.2rem", fontWeight: "600", color: "var(--status-confirmed)", display: "flex", alignItems: "center", gap: "8px" }}>
            <div style={{ width: "12px", height: "12px", borderRadius: "50%", backgroundColor: "var(--status-confirmed)", boxShadow: "0 0 10px var(--status-confirmed)" }}></div>
            Active & Listening
          </div>
        </div>
      </div>

      {/* Review Feed */}
      <h2 style={{ fontSize: "1.2rem", fontWeight: "600", color: "#111", marginBottom: "16px" }}>Guest Feedback Feed</h2>

      {/* Platform Tabs */}
      {!loading && reviews.length > 0 && (
        <div style={{ display: "flex", gap: "8px", marginBottom: "24px", overflowX: "auto", paddingBottom: "8px" }}>
          {reviewPlatforms.map(platform => (
            <button
              key={platform}
              onClick={() => setActiveTab(platform)}
              style={{
                padding: "8px 16px", borderRadius: "20px",
                border: activeTab === platform ? "none" : "1px solid var(--border-color)",
                background: activeTab === platform ? "var(--primary-color)" : "#fff",
                color: activeTab === platform ? "#fff" : "#495057",
                fontWeight: "600", fontSize: "0.85rem", cursor: "pointer",
                whiteSpace: "nowrap", transition: "all 0.2s"
              }}
            >
              {platform}{platform !== "All" && ` (${reviews.filter(r => r.source === platform).length})`}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: "center", padding: "40px", color: "var(--text-secondary)" }}>Loading database records...</div>
      ) : reviews.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 20px", background: "#f8f9fa", borderRadius: "12px", border: "1px dashed var(--border-color)" }}>
          <h3 style={{ fontSize: "1.1rem", color: "#333", marginBottom: "8px" }}>No reviews found for this property</h3>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>Click "Sync Reviews Now" to pull reviews from all configured platforms.</p>
        </div>
      ) : filteredReviews.length === 0 ? (
        <div style={{ textAlign: "center", padding: "40px", color: "var(--text-secondary)" }}>No reviews found for this platform.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {filteredReviews.map((r) => {
            const dateStr = new Date(r.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
            let topicTags: string[] = [];
            if (r.topics) { try { topicTags = JSON.parse(r.topics); } catch (e) {} }

            return (
              <div key={r.id} style={{ background: "#fff", padding: "24px", borderRadius: "12px", border: "1px solid var(--border-color)", display: "flex", gap: "24px" }}>
                {/* Left: Meta */}
                <div style={{ minWidth: "200px", borderRight: "1px solid var(--border-color)", paddingRight: "24px" }}>
                  <div style={{ fontWeight: "600", color: "#111", fontSize: "1.1rem", marginBottom: "4px" }}>{r.guestName}</div>
                  <div style={{ color: "var(--text-secondary)", fontSize: "0.85rem", marginBottom: "12px" }}>{dateStr}</div>
                  <div style={{ display: "inline-block", padding: "4px 10px", background: "#f1f3f5", borderRadius: "4px", fontSize: "0.75rem", fontWeight: "600", color: "#495057" }}>
                    Source: {r.source}
                  </div>
                </div>

                {/* Right: Content */}
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px" }}>
                    <div>{renderStars(r.rating)}</div>
                    {(r.sentimentScore !== null || r.reviewType) && (
                      <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                        {r.reviewType && (
                          <div style={{
                            padding: "4px 8px", borderRadius: "4px", fontSize: "0.8rem", fontWeight: "600",
                            backgroundColor: r.reviewType === "Praise" ? "#e3fcef" : r.reviewType === "Complaint" ? "#ffe3e3" : r.reviewType === "Suggestion" ? "#cce5ff" : "#fff3cd",
                            color: r.reviewType === "Praise" ? "#0f5132" : r.reviewType === "Complaint" ? "#842029" : r.reviewType === "Suggestion" ? "#004085" : "#856404"
                          }}>
                            {r.reviewType}
                          </div>
                        )}
                        {r.sentimentScore !== null && (
                          <div style={{
                            padding: "4px 8px", borderRadius: "4px", fontSize: "0.8rem", fontWeight: "600",
                            backgroundColor: r.sentimentScore >= 70 ? "#e3fcef" : r.sentimentScore >= 40 ? "#fff3cd" : "#ffe3e3",
                            color: r.sentimentScore >= 70 ? "#0f5132" : r.sentimentScore >= 40 ? "#856404" : "#842029"
                          }}>
                            {r.sentimentScore}/100
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <p style={{ color: "#333", fontSize: "0.95rem", lineHeight: "1.6", whiteSpace: "pre-wrap", marginBottom: "16px" }}>
                    {r.comment}
                  </p>

                  {topicTags.length > 0 && (
                    <div style={{ display: "flex", gap: "8px", marginBottom: "16px", flexWrap: "wrap" }}>
                      {topicTags.map((t, idx) => (
                        <span key={idx} style={{ padding: "4px 10px", backgroundColor: "#e7f1ff", color: "#004085", borderRadius: "12px", fontSize: "0.75rem", fontWeight: "500" }}>
                          {t}
                        </span>
                      ))}
                    </div>
                  )}

                  {r.autoReply && (
                    <div style={{ background: "#f8f9fa", border: "1px solid #e9ecef", borderRadius: "8px", padding: "16px", marginTop: "12px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                        <span style={{ fontSize: "1rem" }}>🤖</span>
                        <span style={{ fontSize: "0.85rem", fontWeight: "600", color: "#495057" }}>AI Generated Draft Reply</span>
                      </div>
                      <p style={{ fontSize: "0.9rem", color: "#495057", lineHeight: "1.5", whiteSpace: "pre-wrap", margin: 0, fontStyle: "italic" }}>
                        {r.autoReply}
                      </p>
                      <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
                        <button style={{ padding: "6px 12px", background: "var(--primary-color)", color: "#fff", border: "none", borderRadius: "4px", fontSize: "0.8rem", fontWeight: "600", cursor: "pointer" }}>Publish Reply</button>
                        <button style={{ padding: "6px 12px", background: "transparent", color: "var(--primary-color)", border: "1px solid var(--primary-color)", borderRadius: "4px", fontSize: "0.8rem", fontWeight: "600", cursor: "pointer" }}>Edit</button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
