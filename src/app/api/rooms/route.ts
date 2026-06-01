import { NextResponse } from "next/server";
import prisma from "@/lib/db";

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const propertyId = searchParams.get("propertyId");
    if (!propertyId) return NextResponse.json({ error: "Missing propertyId" }, { status: 400 });
    
    const rooms = await prisma.room.findMany({
      where: { propertyId },
      select: { id: true, number: true, name: true, type: true, basePrice: true, priceEP: true, priceCP: true, priceMAP: true, priceAP: true, cleanStatus: true, hkAssignedTo: true, hkLastUpdated: true }
    });
    
    return NextResponse.json(rooms);
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch rooms" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { number, name, type, propertyId, staffName, propertyName, basePrice, priceEP, priceCP, priceMAP, priceAP } = body;

    if (!number || !name || !type || !propertyId) {
      return NextResponse.json(
        { success: false, error: "Missing required fields: number, name, type, propertyId" },
        { status: 400 }
      );
    }

    const room = await prisma.room.create({
      data: {
        number,
        name,
        type,
        propertyId,
        basePrice: basePrice ? parseFloat(basePrice.toString()) : 0.0,
        priceEP: priceEP ? parseFloat(priceEP.toString()) : 0.0,
        priceCP: priceCP ? parseFloat(priceCP.toString()) : 0.0,
        priceMAP: priceMAP ? parseFloat(priceMAP.toString()) : 0.0,
        priceAP: priceAP ? parseFloat(priceAP.toString()) : 0.0,
      },
    });

    // Create a persistent notification for Super Admin
    if (staffName && propertyName) {
      await prisma.notification.create({
        data: {
          message: `${staffName} added Room ${number} (${name} — ${type}) to ${propertyName}`,
          staffName,
          propertyName,
        },
      });
    }

    return NextResponse.json({ success: true, room });
  } catch (error: any) {
    console.error("Failed to create room:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to create room" },
      { status: 500 }
    );
  }
}
