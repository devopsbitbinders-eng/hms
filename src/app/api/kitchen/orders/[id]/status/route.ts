import { NextResponse } from "next/server";
import prisma from "@/lib/db";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const { status } = await request.json(); // "COOKING", "READY", "SERVED"

    // Security note: In production, check session/role here.

    // Update Database
    const updatedOrder = await prisma.kitchenOrder.update({
      where: { id: resolvedParams.id },
      data: { status },
      include: { items: { include: { menuItem: true } } }
    });

    // We can emit a socket event here if socket.io is configured
    // For now, we will just return success

    return NextResponse.json({ success: true, order: updatedOrder });
  } catch (error) {
    console.error("Order status update failed:", error);
    return NextResponse.json({ error: "Failed to update order status" }, { status: 500 });
  }
}
