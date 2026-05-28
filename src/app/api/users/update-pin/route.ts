import { NextResponse } from "next/server";
import prisma from "@/lib/db";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { username, currentPin, newPin } = body;

    if (!username || !currentPin || !newPin) {
      return NextResponse.json(
        { success: false, error: "Missing required fields." },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { username },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: "Staff user not found." },
        { status: 404 }
      );
    }

    if (user.password !== currentPin) {
      return NextResponse.json(
        { success: false, error: "Invalid current PIN." },
        { status: 401 }
      );
    }

    const updatedUser = await prisma.user.update({
      where: { username },
      data: {
        password: newPin,
        isFirstLogin: false
      }
    });

    return NextResponse.json({
      success: true,
      user: {
        id: updatedUser.id,
        name: updatedUser.name,
        username: updatedUser.username,
        role: updatedUser.role,
        avatar: updatedUser.avatar,
        propertyId: updatedUser.propertyId,
        allowRoomManagement: updatedUser.allowRoomManagement,
        isFirstLogin: updatedUser.isFirstLogin,
      },
    });
  } catch (error: any) {
    console.error("Failed to update PIN:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Server error while updating PIN." },
      { status: 500 }
    );
  }
}
