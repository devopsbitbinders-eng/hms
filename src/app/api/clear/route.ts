import { NextResponse } from "next/server";
import prisma from "@/lib/db";

export async function POST(request: Request) {
  try {
    let ownerId = null;
    try {
      const body = await request.json();
      ownerId = body.ownerId;
    } catch (e) {}

    if (ownerId) {
      await prisma.property.deleteMany({ where: { ownerId } });
      await prisma.user.deleteMany({ where: { ownerId, NOT: { id: ownerId } } });
    } else {
      await prisma.billingItem.deleteMany();
      await prisma.reservation.deleteMany();
      await prisma.room.deleteMany();
      await prisma.property.deleteMany();
    }

    return NextResponse.json({
      success: true,
      message: "Database tables wiped successfully. System is now a clean production slate.",
    });
  } catch (error: any) {
    console.error("Database clear failed:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to wipe database tables." },
      { status: 500 }
    );
  }
}
