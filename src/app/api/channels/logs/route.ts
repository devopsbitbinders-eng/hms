import { NextResponse } from "next/server";
import prisma from "@/lib/db";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const propertyId = searchParams.get("propertyId");

    if (!propertyId) {
      return NextResponse.json(
        { success: false, error: "Missing required propertyId parameter" },
        { status: 400 }
      );
    }

    const logs = await prisma.channelLog.findMany({
      where: { propertyId },
      orderBy: { timestamp: "desc" },
      take: 50 // Limit to latest 50 logs for premium visual scanning performance
    });

    return NextResponse.json({ success: true, logs });
  } catch (error: any) {
    console.error("GET /api/channels/logs error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch logs" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const propertyId = searchParams.get("propertyId");

    if (!propertyId) {
      return NextResponse.json(
        { success: false, error: "Missing required propertyId parameter" },
        { status: 400 }
      );
    }

    await prisma.channelLog.deleteMany({
      where: { propertyId }
    });

    await prisma.channelLog.create({
      data: {
        channelName: "System",
        type: "system_init",
        status: "success",
        message: "Activity Logs wiped persistently. Channel mapping listeners restarted.",
        propertyId
      }
    });

    return NextResponse.json({ success: true, message: "Logs cleared" });
  } catch (error: any) {
    console.error("DELETE /api/channels/logs error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to clear logs" },
      { status: 500 }
    );
  }
}
