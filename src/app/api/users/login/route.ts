import { NextResponse } from "next/server";
import prisma from "@/lib/db";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { username, password } = body;

    if (!username || !password) {
      return NextResponse.json(
        { success: false, error: "Username and password/pin are required." },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { username },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: "Staff user not found." },
        { status: 401 }
      );
    }

    // Simple exact match password check
    if (user.password !== password) {
      return NextResponse.json(
        { success: false, error: "Invalid password or authorization PIN code." },
        { status: 401 }
      );
    }

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        username: user.username,
        role: user.role,
        avatar: user.avatar,
        propertyId: user.propertyId,
        allowRoomManagement: user.allowRoomManagement,
      },
    });
  } catch (error: any) {
    console.error("Login verification failed:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to authenticate session." },
      { status: 500 }
    );
  }
}
