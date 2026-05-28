import { NextResponse } from "next/server";
import prisma from "@/lib/db";

// POST: Add a new billing item to an existing reservation (folio charge)
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { reservationId, name, amount, category } = body;

    if (!reservationId || !name || amount === undefined || !category) {
      return NextResponse.json(
        { success: false, error: "Missing required fields: reservationId, name, amount, category" },
        { status: 400 }
      );
    }

    const item = await prisma.billingItem.create({
      data: {
        reservationId,
        name,
        amount: parseFloat(amount.toString()),
        category,
        invoiceGroup: "A",
      },
    });

    return NextResponse.json({ success: true, item });
  } catch (error: any) {
    console.error("Failed to add folio charge:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to add folio charge" },
      { status: 500 }
    );
  }
}

// DELETE: Remove a billing item by ID
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const itemId = searchParams.get("itemId");

    if (!itemId) {
      return NextResponse.json(
        { success: false, error: "Missing itemId" },
        { status: 400 }
      );
    }

    await prisma.billingItem.delete({ where: { id: itemId } });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Failed to delete billing item:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to delete billing item" },
      { status: 500 }
    );
  }
}
