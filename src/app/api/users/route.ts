import { NextResponse } from "next/server";
import prisma from "@/lib/db";

export async function GET() {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        username: true,
        role: true,
        avatar: true,
        password: true, // We return password for simple demo PIN checks inside client components
        propertyId: true,
        allowRoomManagement: true,
        assignedShift: true,
        shiftTiming: true,
        permissions: true,
      },
    });

    return NextResponse.json({ success: true, users });
  } catch (error: any) {
    console.error("Failed to fetch users:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to retrieve staff users." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, username, password, role, avatar, propertyId, assignedShift, shiftTiming } = body;

    if (!name || !username || !password || !role || !avatar) {
      return NextResponse.json(
        { success: false, error: "Missing required fields." },
        { status: 400 }
      );
    }

    // Check if username already exists
    const existing = await prisma.user.findUnique({
      where: { username },
    });

    if (existing) {
      return NextResponse.json(
        { success: false, error: "Username is already taken by another staff member." },
        { status: 400 }
      );
    }

    const newUser = await prisma.user.create({
      data: {
        name,
        username,
        password,
        role,
        avatar,
        propertyId: propertyId || null,
        allowRoomManagement: true, // Managers defaulted to ON
        assignedShift: assignedShift || "Morning",
        shiftTiming: shiftTiming || null,
      },
    });

    return NextResponse.json({
      success: true,
      user: {
        id: newUser.id,
        name: newUser.name,
        username: newUser.username,
        role: newUser.role,
        avatar: newUser.avatar,
        propertyId: newUser.propertyId,
        allowRoomManagement: newUser.allowRoomManagement,
      },
    });
  } catch (error: any) {
    console.error("Failed to create user:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to create new staff profile." },
      { status: 500 }
    );
  }
}
