import { NextResponse } from "next/server";
import prisma from "@/lib/db";

export async function GET() {
  try {
    const orders = await prisma.kitchenOrder.findMany({
      include: {
        items: {
          include: {
            menuItem: true
          }
        },
        reservation: {
          include: {
            room: true
          }
        }
      },
      orderBy: {
        createdAt: 'asc'
      }
    });

    return NextResponse.json({ success: true, orders });
  } catch (error) {
    console.error("Failed to fetch kitchen orders:", error);
    return NextResponse.json({ error: "Failed to fetch orders" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { reservationId, items, totalAmount } = await request.json();

    if (!reservationId || !items || items.length === 0) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const newOrder = await prisma.kitchenOrder.create({
      data: {
        reservationId,
        totalAmount,
        status: "NEW",
        items: {
          create: items.map((item: any) => ({
            menuItemId: item.menuItemId,
            quantity: item.quantity,
            price: item.price,
            notes: item.notes || ""
          }))
        }
      }
    });

    const reservation = await prisma.reservation.findUnique({ where: { id: reservationId } });
    const isInclusive = reservation?.details?.includes("[GST:inclusive]") ?? false;

    // Automatically add food charges to the guest folio
    for (const item of items) {
      const menuItem = await prisma.menuItem.findUnique({ where: { id: item.menuItemId } });
      if (menuItem) {
        let finalAmount = item.price * item.quantity;
        // If the folio is inclusive, we must pre-add the 5% GST so the back-calculation results in the correct final charge that matches the kitchen slip.
        if (isInclusive) {
           finalAmount = finalAmount * 1.05;
        }

        await prisma.billingItem.create({
          data: {
            name: `${menuItem.name} (Room Service) | Qty: ${item.quantity} | Unit: ${item.price}`,
            amount: finalAmount,
            category: "food",
            reservationId: reservationId,
          }
        });
      }
    }

    const newOrderWithIncludes = await prisma.kitchenOrder.findUnique({
      where: { id: newOrder.id },
      include: {
        items: { include: { menuItem: true } },
        reservation: true
      }
    });

    return NextResponse.json({ success: true, order: newOrderWithIncludes });
  } catch (error) {
    console.error("Failed to create order:", error);
    return NextResponse.json({ error: "Failed to place order" }, { status: 500 });
  }
}
