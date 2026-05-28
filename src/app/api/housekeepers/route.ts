import { NextResponse } from "next/server";
import { prisma } from "../../../lib/db";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const propertyId = searchParams.get("propertyId");

    if (!propertyId) {
      return NextResponse.json({ error: "Property ID required" }, { status: 400 });
    }

    const housekeepers = await prisma.housekeeper.findMany({
      where: { propertyId },
    });

    return NextResponse.json(housekeepers);
  } catch (error) {
    console.error("Failed to fetch housekeepers:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, phone, propertyId, status } = body;

    if (!name || !phone || !propertyId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const newHk = await prisma.housekeeper.create({
      data: {
        name,
        phone,
        propertyId,
        status: status || "active",
      },
    });

    return NextResponse.json({ success: true, data: newHk });
  } catch (error) {
    console.error("Failed to create housekeeper:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
