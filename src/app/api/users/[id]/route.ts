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
    const { allowRoomManagement, assignedShift, shiftTiming, permissions } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: "User ID is required." },
        { status: 400 }
      );
    }

    const dataToUpdate: any = {};
    if (allowRoomManagement !== undefined) dataToUpdate.allowRoomManagement = allowRoomManagement;
    if (assignedShift !== undefined) dataToUpdate.assignedShift = assignedShift;
    if (shiftTiming !== undefined) dataToUpdate.shiftTiming = shiftTiming;
    if (permissions !== undefined) dataToUpdate.permissions = permissions;

    const updated = await prisma.user.update({
      where: { id },
      data: dataToUpdate,
    });

    return NextResponse.json({
      success: true,
      user: {
        id: updated.id,
        name: updated.name,
        role: updated.role,
        allowRoomManagement: updated.allowRoomManagement,
        assignedShift: updated.assignedShift,
        shiftTiming: updated.shiftTiming,
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

    const userToDelete = await prisma.user.findUnique({ where: { id } });
    await prisma.user.delete({
      where: { id },
    });
    
    if (userToDelete) {
      await prisma.notification.create({
        data: {
          message: `Staff member ${userToDelete.name} was removed from the system.`,
          staffName: "System",
          propertyName: "Aether HMS"
        }
      });
    }

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
