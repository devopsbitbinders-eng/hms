import { NextResponse } from "next/server";
import prisma from "@/lib/db";

export async function POST(request: Request) {
  try {
    const { reservationId, referralCode } = await request.json();

    if (!reservationId || !referralCode) {
      return NextResponse.json({ success: false, error: "Missing required fields" }, { status: 400 });
    }

    const affiliate = await prisma.affiliate.findUnique({ where: { referralCode: referralCode.toUpperCase() } });
    if (!affiliate || !affiliate.isActive) {
      return NextResponse.json({ success: false, error: "Invalid or inactive referral code" }, { status: 400 });
    }

    const reservation = await prisma.reservation.findUnique({
      where: { id: reservationId },
      include: { billingItems: true }
    });

    if (!reservation) {
      return NextResponse.json({ success: false, error: "Reservation not found" }, { status: 404 });
    }

    // Calculate commission
    let roomTotal = 0;
    reservation.billingItems.forEach(item => {
      if (item.category === "room") roomTotal += item.amount;
    });

    let commissionEarned = 0;
    if (affiliate.commissionType === "FLAT") {
      commissionEarned = affiliate.commissionValue;
    } else if (affiliate.commissionType === "PERCENTAGE") {
      commissionEarned = roomTotal * (affiliate.commissionValue / 100);
    }

    // Check if referral already exists
    const existing = await prisma.referral.findUnique({ where: { reservationId } });
    if (existing) {
      return NextResponse.json({ success: false, error: "Referral already applied to this booking" }, { status: 400 });
    }

    const referral = await prisma.referral.create({
      data: {
        reservationId,
        affiliateId: affiliate.id,
        status: "PENDING",
        commissionEarned
      }
    });

    return NextResponse.json({ success: true, message: "Referral applied successfully", referral });
  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ success: false, error: "Failed to apply referral" }, { status: 500 });
  }
}
