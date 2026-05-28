import { NextResponse } from "next/server";
import prisma from "@/lib/db";

export async function GET() {
  try {
    const notifications = await prisma.notification.findMany({
      orderBy: {
        createdAt: "desc",
      },
    });
    return NextResponse.json({ success: true, notifications });
  } catch (error: any) {
    console.error("Failed to fetch notifications:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch notifications" },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  try {
    await prisma.notification.deleteMany();
    return NextResponse.json({ success: true, message: "All notifications cleared" });
  } catch (error: any) {
    console.error("Failed to clear notifications:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to clear notifications" },
      { status: 500 }
    );
  }
}
