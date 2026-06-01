import { NextResponse } from "next/server";
import prisma from "@/lib/db";

export async function GET() {
  try {
    const menuItems = await prisma.menuItem.findMany({
      orderBy: { name: 'asc' }
    });
    return NextResponse.json({ success: true, menuItems });
  } catch (error) {
    console.error("Failed to fetch menu items:", error);
    return NextResponse.json({ error: "Failed to fetch menu items" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const data = await request.json();
    const newMenuItem = await prisma.menuItem.create({
      data: {
        name: data.name,
        description: data.description,
        price: data.price,
        isAvailable: data.isAvailable ?? true
      }
    });
    return NextResponse.json({ success: true, menuItem: newMenuItem });
  } catch (error) {
    console.error("Failed to create menu item:", error);
    return NextResponse.json({ error: "Failed to create menu item" }, { status: 500 });
  }
}
