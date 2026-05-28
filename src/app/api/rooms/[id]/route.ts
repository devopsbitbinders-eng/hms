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
    const { number, name, type, basePrice } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Missing room ID parameter" },
        { status: 400 }
      );
    }

    if (!number || !name || !type) {
      return NextResponse.json(
        { success: false, error: "Missing required fields: number, name, type" },
        { status: 400 }
      );
    }

    // Update the room details in the database
    const room = await prisma.room.update({
      where: { id },
      data: {
        number,
        name,
        type,
        ...(basePrice !== undefined && { basePrice: parseFloat(basePrice.toString()) })
      },
    });

    return NextResponse.json({ success: true, room });
  } catch (error: any) {
    console.error("Failed to update room:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to update room" },
      { status: 500 }
    );
  }
}
