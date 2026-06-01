import { NextResponse } from "next/server";
import prisma from "@/lib/db";

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const properties = await prisma.property.findMany({
      include: {
        rooms: {
          include: {
            reservations: {
              include: {
                billingItems: true,
              },
            },
          },
        },
      },
    });

    return NextResponse.json({ success: true, properties });
  } catch (error: any) {
    console.error("Failed to fetch properties:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch properties" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, type, location, gstNumber } = body;

    if (!name || !type || !location) {
      return NextResponse.json(
        { success: false, error: "Missing required fields: name, type, location" },
        { status: 400 }
      );
    }

    const property = await prisma.property.create({
      data: {
        name,
        type,
        location,
        gstNumber: gstNumber || null,
      },
    });

    return NextResponse.json({ success: true, property });
  } catch (error: any) {
    console.error("Failed to create property:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to create property" },
      { status: 500 }
    );
  }
}
