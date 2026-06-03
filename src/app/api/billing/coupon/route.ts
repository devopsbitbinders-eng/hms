import { NextResponse } from "next/server";
import prisma from "@/lib/db";

export async function POST(request: Request) {
  try {
    const { reservationId, couponCode, appliedBy } = await request.json();

    if (!reservationId || !couponCode) {
      return NextResponse.json({ success: false, error: "Missing required fields" }, { status: 400 });
    }

    const coupon = await prisma.coupon.findUnique({ where: { code: couponCode } });
    if (!coupon || !coupon.isActive) {
      return NextResponse.json({ success: false, error: "Invalid or inactive coupon code" }, { status: 400 });
    }

    if (coupon.validUntil && new Date() > coupon.validUntil) {
      return NextResponse.json({ success: false, error: "Coupon has expired" }, { status: 400 });
    }

    if (coupon.usageLimit && coupon.timesUsed >= coupon.usageLimit) {
      return NextResponse.json({ success: false, error: "Coupon usage limit reached" }, { status: 400 });
    }

    const reservation = await prisma.reservation.findUnique({
      where: { id: reservationId },
      include: { billingItems: true }
    });

    if (!reservation) {
      return NextResponse.json({ success: false, error: "Reservation not found" }, { status: 404 });
    }

    // Verify minimum booking value
    let roomTotal = 0;
    reservation.billingItems.forEach(item => {
      if (item.category === "room") roomTotal += item.amount;
    });

    if (coupon.minBookingValue && roomTotal < coupon.minBookingValue) {
      return NextResponse.json({ success: false, error: `Minimum room booking value of ₹${coupon.minBookingValue} not met` }, { status: 400 });
    }

    // If the reservation already has this coupon, we don't need to increment again
    if (reservation.couponId !== coupon.id) {
      // If there was an old coupon, we should decrement it
      if (reservation.couponId) {
        await prisma.coupon.update({
          where: { id: reservation.couponId },
          data: { timesUsed: { decrement: 1 } }
        });
      }

      // Attach new coupon to reservation
      await prisma.reservation.update({
        where: { id: reservationId },
        data: { couponId: coupon.id }
      });

      // Update new coupon usage count
      await prisma.coupon.update({
        where: { id: coupon.id },
        data: { timesUsed: { increment: 1 } }
      });

      // Log the audit event
      await prisma.couponAuditLog.create({
        data: {
          couponId: coupon.id,
          reservationId: reservationId,
          appliedBy: appliedBy || "SYSTEM",
          discountApplied: 0 // Will be calculated dynamically during billing
        }
      });
    }

    return NextResponse.json({ success: true, message: "Coupon applied successfully", coupon });
  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ success: false, error: "Failed to apply coupon" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const reservationId = searchParams.get("reservationId");

    if (!reservationId) {
      return NextResponse.json({ success: false, error: "Missing reservationId" }, { status: 400 });
    }

    const reservation = await prisma.reservation.findUnique({ where: { id: reservationId } });
    if (reservation?.couponId) {
      await prisma.reservation.update({
        where: { id: reservationId },
        data: { couponId: null }
      });
      // Decrement usage
      await prisma.coupon.update({
        where: { id: reservation.couponId },
        data: { timesUsed: { decrement: 1 } }
      });
    }

    return NextResponse.json({ success: true, message: "Coupon removed" });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: "Failed to remove coupon" }, { status: 500 });
  }
}
