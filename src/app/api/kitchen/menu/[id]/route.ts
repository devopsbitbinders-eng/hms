import { NextResponse } from "next/server";
import prisma from "@/lib/db";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const { isAvailable, price, name, description } = await request.json();

    // Security note: check permissions here for updating price vs availability

    const updatedMenuItem = await prisma.menuItem.update({
      where: { id: resolvedParams.id },
      data: {
        ...(isAvailable !== undefined && { isAvailable }),
        ...(price !== undefined && { price }),
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
      }
    });

    return NextResponse.json({ success: true, menuItem: updatedMenuItem });
  } catch (error) {
    console.error("Menu item update failed:", error);
    return NextResponse.json({ error: "Failed to update menu item" }, { status: 500 });
  }
}
