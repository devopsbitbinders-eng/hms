import { NextResponse } from "next/server";
import { prisma } from "../../../lib/db";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const propertyId = searchParams.get("propertyId");

    if (!propertyId) {
      return NextResponse.json({ error: "Property ID required" }, { status: 400 });
    }

    const items = await prisma.inventoryItem.findMany({
      where: { propertyId },
    });

    return NextResponse.json(items);
  } catch (error) {
    console.error("Failed to fetch inventory:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { itemId, name, count, propertyId } = body;

    if (!itemId || !name || !propertyId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Check if item already exists
    let item = await prisma.inventoryItem.findFirst({
      where: { itemId, propertyId }
    });

    if (item) {
      item = await prisma.inventoryItem.update({
        where: { id: item.id },
        data: { count: item.count + (count || 0) }
      });
    } else {
      item = await prisma.inventoryItem.create({
        data: {
          itemId,
          name,
          count: count || 0,
          propertyId,
        },
      });
    }

    return NextResponse.json({ success: true, data: item });
  } catch (error) {
    console.error("Failed to create/update inventory:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
