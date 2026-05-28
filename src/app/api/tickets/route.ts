import { NextResponse } from "next/server";
import { prisma } from "../../../lib/db";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const propertyId = searchParams.get("propertyId");

    if (!propertyId) {
      return NextResponse.json({ error: "Property ID required" }, { status: 400 });
    }

    const tickets = await prisma.maintenanceTicket.findMany({
      where: { propertyId },
      orderBy: { reportedAt: 'desc' }
    });

    return NextResponse.json(tickets);
  } catch (error) {
    console.error("Failed to fetch tickets:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { roomNumber, issue, priority, propertyId, reportedAt } = body;

    if (!roomNumber || !issue || !propertyId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const ticket = await prisma.maintenanceTicket.create({
      data: {
        roomNumber,
        issue,
        priority: priority || "medium",
        reportedAt: reportedAt || new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        propertyId,
        status: "Reported"
      },
    });

    return NextResponse.json({ success: true, data: ticket });
  } catch (error) {
    console.error("Failed to create ticket:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
// Force Turbopack rebuild
