import { NextResponse } from "next/server";
import prisma from "@/lib/db";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const id = resolvedParams.id;
    const body = await request.json();
    const { allowRoomManagement } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: "User ID is required." },
        { status: 400 }
      );
    }

    const updated = await prisma.user.update({
      where: { id },
      data: { allowRoomManagement },
    });

    return NextResponse.json({
      success: true,
      user: {
        id: updated.id,
        name: updated.name,
        role: updated.role,
        allowRoomManagement: updated.allowRoomManagement,
      },
    });
  } catch (error: any) {
    console.error("Failed to update user permissions:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to update staff permissions." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const id = resolvedParams.id;

    if (!id) {
      return NextResponse.json(
        { success: false, error: "User ID is required." },
        { status: 400 }
      );
    }

    await prisma.user.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: "Staff profile deleted successfully.",
    });
  } catch (error: any) {
    console.error("Failed to delete user:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to delete staff profile." },
      { status: 500 }
    );
  }
}
