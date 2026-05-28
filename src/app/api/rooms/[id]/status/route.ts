import { NextResponse } from "next/server";
import { prisma } from "../../../../../lib/db";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const id = resolvedParams.id;
    const body = await request.json();
    const { cleanStatus, hkAssignedTo, hkLastUpdated } = body;

    const updatedRoom = await prisma.room.update({
      where: { id },
      data: {
        cleanStatus,
        hkAssignedTo,
        hkLastUpdated,
      },
    });

    return NextResponse.json({ success: true, data: updatedRoom });
  } catch (error) {
    console.error("Failed to update room status:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
