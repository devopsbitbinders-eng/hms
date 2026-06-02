import { NextResponse } from "next/server";
import prisma from "@/lib/db";

export async function GET() {
  try {
    const coupons = await prisma.coupon.findMany({
      orderBy: { validUntil: 'desc' }
    });
    return NextResponse.json({ success: true, coupons });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: "Failed to fetch coupons" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const data = await request.json();
    const { code, discountType, discountValue, applyTo, maxDiscount, minBookingValue, usageLimit, validFrom, validUntil } = data;

    if (!code || !discountType || !discountValue) {
      return NextResponse.json({ success: false, error: "Missing required fields" }, { status: 400 });
    }

    const newCoupon = await prisma.coupon.create({
      data: {
        code: code.toUpperCase(),
        discountType,
        discountValue: parseFloat(discountValue),
        applyTo: applyTo || "ROOM_ONLY",
        maxDiscount: maxDiscount ? parseFloat(maxDiscount) : null,
        minBookingValue: minBookingValue ? parseFloat(minBookingValue) : null,
        usageLimit: usageLimit ? parseInt(usageLimit, 10) : null,
        validFrom: validFrom ? new Date(validFrom) : null,
        validUntil: validUntil ? new Date(validUntil) : null,
        isActive: true
      }
    });

    return NextResponse.json({ success: true, coupon: newCoupon });
  } catch (error: any) {
    if (error.code === 'P2002') {
       return NextResponse.json({ success: false, error: "Coupon code already exists" }, { status: 400 });
    }
    return NextResponse.json({ success: false, error: "Failed to create coupon" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const data = await request.json();
    const { id, isActive } = data;

    if (!id || isActive === undefined) {
      return NextResponse.json({ success: false, error: "Missing required fields" }, { status: 400 });
    }

    const updatedCoupon = await prisma.coupon.update({
      where: { id },
      data: { isActive }
    });

    return NextResponse.json({ success: true, coupon: updatedCoupon });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: "Failed to update coupon" }, { status: 500 });
  }
}
