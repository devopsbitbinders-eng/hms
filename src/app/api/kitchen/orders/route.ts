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
