import { NextResponse } from "next/server";
import prisma from "@/lib/db";

export async function POST() {
  try {
    // Delete all users from the User table
    await prisma.user.deleteMany();

    return NextResponse.json({
      success: true,
      message: "All staff profiles and operator accounts have been wiped. System is ready for a fresh setup.",
    });
  } catch (error: any) {
    console.error("Wiping staff accounts failed:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to wipe staff accounts." },
      { status: 500 }
    );
  }
}
