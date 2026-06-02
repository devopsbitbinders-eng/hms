import { NextResponse } from "next/server";
import prisma from "@/lib/db";

export async function GET() {
  try {
    const affiliates = await prisma.affiliate.findMany({
      include: {
        referrals: true
      },
      orderBy: { totalEarned: 'desc' }
    });
    return NextResponse.json({ success: true, affiliates });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: "Failed to fetch affiliates" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const data = await request.json();
    const { name, email, referralCode, commissionType, commissionValue } = data;

    if (!name || !email || !referralCode || !commissionType || !commissionValue) {
      return NextResponse.json({ success: false, error: "Missing required fields" }, { status: 400 });
    }

    const newAffiliate = await prisma.affiliate.create({
      data: {
        name,
        email,
        referralCode: referralCode.toUpperCase(),
        commissionType,
        commissionValue: parseFloat(commissionValue),
      }
    });

    return NextResponse.json({ success: true, affiliate: newAffiliate });
  } catch (error: any) {
    if (error.code === 'P2002') {
       return NextResponse.json({ success: false, error: "Email or Referral Code already exists" }, { status: 400 });
    }
    return NextResponse.json({ success: false, error: "Failed to create affiliate" }, { status: 500 });
  }
}

// Process Payout
export async function PATCH(request: Request) {
  try {
    const data = await request.json();
    const { id, action } = data;

    if (!id || action !== "PAYOUT") {
      return NextResponse.json({ success: false, error: "Invalid action" }, { status: 400 });
    }

    const affiliate = await prisma.affiliate.findUnique({ where: { id } });
    if (!affiliate || affiliate.pendingPayout <= 0) {
      return NextResponse.json({ success: false, error: "No pending payout available" }, { status: 400 });
    }

    const updatedAffiliate = await prisma.affiliate.update({
      where: { id },
      data: {
        totalEarned: { increment: affiliate.pendingPayout },
        pendingPayout: 0
      }
    });

    // Mark referrals as PAID
    await prisma.referral.updateMany({
      where: { affiliateId: id, status: "PAYABLE" },
      data: { status: "PAID" }
    });

    return NextResponse.json({ success: true, affiliate: updatedAffiliate });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: "Failed to process payout" }, { status: 500 });
  }
}
