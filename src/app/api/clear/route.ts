import { NextResponse } from "next/server";
import prisma from "@/lib/db";

export async function POST() {
  try {
    // Relational safe truncation in reverse order of constraints
    await prisma.billingItem.deleteMany();
    await prisma.reservation.deleteMany();
    await prisma.room.deleteMany();
    await prisma.property.deleteMany();

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
