import { NextResponse } from "next/server";
import prisma from "@/lib/db";

function getGstRate(category: string, amount: number): number {
  if (category === "room") {
    return amount > 7500 ? 0.18 : 0.12;
  }
  return 0.05; // 5% for food and others
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const reservationId = searchParams.get("reservationId");
    const couponCode = searchParams.get("couponCode"); // Optional: if applying a new coupon

    if (!reservationId) {
      return NextResponse.json({ success: false, error: "Missing reservationId" }, { status: 400 });
    }

    const reservation = await prisma.reservation.findUnique({
      where: { id: reservationId },
      include: { billingItems: true, coupon: true },
    });

    if (!reservation) {
      return NextResponse.json({ success: false, error: "Reservation not found" }, { status: 404 });
    }

    const isInclusive = reservation.details?.includes("[GST:inclusive]") ?? false;
    let coupon = reservation.coupon;

    if (couponCode) {
      const pendingCoupon = await prisma.coupon.findUnique({ where: { code: couponCode } });
      if (!pendingCoupon) {
        return NextResponse.json({ success: false, error: "Invalid coupon code" }, { status: 400 });
      }
      if (!pendingCoupon.isActive) {
        return NextResponse.json({ success: false, error: "Coupon is not active" }, { status: 400 });
      }
      if (pendingCoupon.validUntil && new Date() > pendingCoupon.validUntil) {
        return NextResponse.json({ success: false, error: "Coupon has expired" }, { status: 400 });
      }
      if (pendingCoupon.usageLimit && pendingCoupon.timesUsed >= pendingCoupon.usageLimit) {
        return NextResponse.json({ success: false, error: "Coupon usage limit reached" }, { status: 400 });
      }
      coupon = pendingCoupon;
    }

    // Process Billing Items (Room items are discountable)
    let totalRoomLocked = 0;
    let totalOtherLocked = 0;
    let roomGstRate = 0;
    
    reservation.billingItems.forEach(item => {
      if (item.category === "room") {
        totalRoomLocked += item.amount;
        const rate = getGstRate(item.category, item.amount);
        if (rate > roomGstRate) roomGstRate = rate;
      } else {
        totalOtherLocked += item.amount;
      }
    });

    // Check minimum booking value (against room total or overall total?)
    // Usually coupons apply to the room booking value.
    if (coupon && coupon.minBookingValue && totalRoomLocked < coupon.minBookingValue) {
       return NextResponse.json({ success: false, error: `Minimum booking value of ₹${coupon.minBookingValue} not met` }, { status: 400 });
    }

    // Extract Base Price for Rooms and Others
    let roomBase = isInclusive ? (totalRoomLocked / (1 + roomGstRate)) : totalRoomLocked;
    
    // We process other items normally first
    let finalOtherBase = 0;
    let finalOtherGst = 0;
    reservation.billingItems.forEach(item => {
      if (item.category !== "room") {
        const rate = getGstRate(item.category, item.amount);
        const base = isInclusive ? (item.amount / (1 + rate)) : item.amount;
        const gst = base * rate;
        finalOtherBase += base;
        finalOtherGst += gst;
      }
    });

    let discountAmount = 0;
    let targetBase = roomBase;
    let upgradeBase = 0;
    
    if (coupon && coupon.applyTo === "GRAND_TOTAL") {
      targetBase = roomBase + finalOtherBase;
    } else if (coupon && coupon.applyTo === "ROOM_UPGRADE_ONLY") {
      // Find upgrade items in billing
      reservation.billingItems.forEach(item => {
        if (item.name.toLowerCase().includes("upgrade")) {
           const rate = getGstRate(item.category, item.amount);
           upgradeBase += isInclusive ? (item.amount / (1 + rate)) : item.amount;
        }
      });
      targetBase = upgradeBase;
    }

    if (coupon) {
      if (coupon.discountType === "FLAT") {
        discountAmount = coupon.discountValue;
      } else if (coupon.discountType === "PERCENTAGE") {
        discountAmount = targetBase * (coupon.discountValue / 100);
        if (coupon.maxDiscount && discountAmount > coupon.maxDiscount) {
          discountAmount = coupon.maxDiscount;
        }
      }
      if (discountAmount > targetBase) discountAmount = targetBase;
    }

    let discountedRoomBase = roomBase;
    // If it's a room only discount, we subtract from roomBase.
    if (coupon && coupon.applyTo === "ROOM_ONLY") {
      discountedRoomBase = roomBase - discountAmount;
    } else if (coupon && coupon.applyTo === "ROOM_UPGRADE_ONLY") {
      // Deduct from room base since upgrades are usually part of room charges, 
      // or if they are separate, they are still part of the grand total.
      // We will deduct from the roomBase or finalOtherBase accordingly.
      let remainingDiscount = discountAmount;
      if (remainingDiscount > roomBase) {
        discountedRoomBase = 0;
        remainingDiscount -= roomBase;
        finalOtherBase -= remainingDiscount;
        if (finalOtherBase < 0) finalOtherBase = 0;
      } else {
        discountedRoomBase = roomBase - remainingDiscount;
      }
    } else if (coupon && coupon.applyTo === "GRAND_TOTAL") {
      // If it's a grand total discount, we just reduce the roomBase proportionally or take it entirely from room to keep things simple.
      // Usually, we just subtract from the total base. Let's just deduct it from room base first, and if it exceeds, from other base.
      let remainingDiscount = discountAmount;
      if (remainingDiscount > roomBase) {
        discountedRoomBase = 0;
        remainingDiscount -= roomBase;
        finalOtherBase -= remainingDiscount;
        if (finalOtherBase < 0) finalOtherBase = 0;
      } else {
        discountedRoomBase = roomBase - remainingDiscount;
      }
    }

    const roomGst = discountedRoomBase * roomGstRate;
    const finalRoomTotal = discountedRoomBase + roomGst;

    const finalSubtotal = discountedRoomBase + finalOtherBase;
    const finalTotalGst = roomGst + finalOtherGst;
    const grandTotal = finalSubtotal + finalTotalGst;

    return NextResponse.json({
      success: true,
      data: {
        isInclusive,
        originalRoomBase: roomBase,
        discountAmount,
        discountedRoomBase,
        finalRoomTotal,
        otherItemsTotal: finalOtherBase + finalOtherGst,
        finalSubtotal,
        finalTotalGst,
        grandTotal,
        couponApplied: coupon ? coupon.code : null,
      }
    });

  } catch (error: any) {
    console.error("Billing Calculation Error:", error);
    return NextResponse.json({ success: false, error: "Failed to calculate bill" }, { status: 500 });
  }
}
