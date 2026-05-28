"use client";

import React, { useState, useEffect } from "react";
import styles from "../app/dashboard/dashboard.module.css";

interface Review {
  id: string;
  guestName: string;
  rating: number;
  comment: string;
  status: "pending" | "published" | "rejected";
  source: string;
  createdAt: string;
}

interface ReviewManagementProps {
  activeProperty: string;
  propertiesList: any[];
}

export default function ReviewManagement({ activeProperty, propertiesList }: ReviewManagementProps) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(false);

  const activePropDetails = propertiesList.find((p) => {
    const lowercase = p.name.toLowerCase();
    const key = lowercase.includes("goa") ? "goa" :
                lowercase.includes("manali") ? "manali" :
                lowercase.includes("delhi") ? "delhi" :
                lowercase.replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
    return key === activeProperty;
  });

  const fetchReviews = async () => {
    if (!activePropDetails) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/reviews?propertyId=${activePropDetails.id}`);
      const data = await res.json();
      if (data.success) {
        setReviews(data.reviews);
      }
    } catch (err) {
      console.error("Failed to fetch reviews", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReviews();
  }, [activeProperty, propertiesList]);

  const updateReviewStatus = async (id: string, status: "published" | "rejected") => {
    try {
      const res = await fetch(`/api/reviews/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (data.success) {
        setReviews((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));
      }
    } catch (err) {
      console.error("Failed to update review", err);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "published": return "#4ade80"; // green
      case "pending": return "#facc15"; // yellow
      case "rejected": return "#f87171"; // red
      default: return "#9ca3af";
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2 className={styles.title}>Review Management</h2>
      </div>

      <div className={styles.card}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "20px" }}>
          <h3 style={{ fontSize: "1.1rem", fontWeight: "600", color: "#fff" }}>
            Guest Reviews for {activePropDetails?.name || "Selected Property"}
          </h3>
          <button 
            onClick={fetchReviews}
            style={{ 
              backgroundColor: "var(--accent-color)", 
              color: "#fff", 
              border: "none", 
              padding: "8px 16px", 
              borderRadius: "6px", 
              cursor: "pointer",
              fontWeight: "600"
            }}
          >
            Refresh
          </button>
        </div>

        {loading ? (
          <p style={{ color: "var(--text-secondary)" }}>Loading reviews...</p>
        ) : reviews.length === 0 ? (
          <p style={{ color: "var(--text-secondary)" }}>No reviews found for this property.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {reviews.map((review) => (
              <div key={review.id} style={{ 
                backgroundColor: "var(--bg-tertiary)", 
                border: "1px solid var(--border-color)", 
                borderRadius: "8px", 
                padding: "16px",
                display: "flex",
                flexDirection: "column",
                gap: "12px"
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                    <strong style={{ color: "#fff", fontSize: "1.1rem" }}>{review.guestName}</strong>
                    <span style={{ 
                      backgroundColor: "rgba(255, 255, 255, 0.1)", 
                      padding: "4px 8px", 
                      borderRadius: "4px",
                      fontSize: "0.8rem",
                      color: "var(--text-secondary)"
                    }}>
                      Source: {review.source}
                    </span>
                    <span style={{ 
                      color: getStatusColor(review.status),
                      fontSize: "0.85rem",
                      fontWeight: "bold",
                      textTransform: "uppercase"
                    }}>
                      • {review.status}
                    </span>
                  </div>
                  <div style={{ color: "#fbbf24", fontSize: "1.2rem" }}>
                    {"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}
                  </div>
                </div>

                {review.comment && (
                  <p style={{ color: "var(--text-secondary)", fontSize: "0.95rem", lineHeight: "1.5" }}>
                    "{review.comment}"
                  </p>
                )}

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "8px", paddingTop: "12px", borderTop: "1px solid var(--border-color)" }}>
                  <span style={{ color: "var(--text-secondary)", fontSize: "0.8rem" }}>
                    Submitted: {new Date(review.createdAt).toLocaleString()}
                  </span>
                  
                  {review.status === "pending" && (
                    <div style={{ display: "flex", gap: "8px" }}>
                      <button 
                        onClick={() => updateReviewStatus(review.id, "published")}
                        style={{
                          backgroundColor: "rgba(74, 222, 128, 0.2)",
                          color: "#4ade80",
                          border: "1px solid #4ade80",
                          padding: "6px 12px",
                          borderRadius: "4px",
                          cursor: "pointer",
                          fontSize: "0.85rem",
                          fontWeight: "bold"
                        }}
                      >
                        Approve
                      </button>
                      <button 
                        onClick={() => updateReviewStatus(review.id, "rejected")}
                        style={{
                          backgroundColor: "rgba(248, 113, 113, 0.2)",
                          color: "#f87171",
                          border: "1px solid #f87171",
                          padding: "6px 12px",
                          borderRadius: "4px",
                          cursor: "pointer",
                          fontSize: "0.85rem",
                          fontWeight: "bold"
                        }}
                      >
                        Reject
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
