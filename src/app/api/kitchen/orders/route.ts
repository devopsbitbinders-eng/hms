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
        reservation: true
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
      },
      include: {
        items: { include: { menuItem: true } },
        reservation: true
      }
    });

    return NextResponse.json({ success: true, order: newOrder });
  } catch (error) {
    console.error("Failed to create order:", error);
    return NextResponse.json({ error: "Failed to place order" }, { status: 500 });
  }
}
