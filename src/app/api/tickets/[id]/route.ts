import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/db";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const id = resolvedParams.id;
    const body = await request.json();
    const { status } = body;

    const ticket = await prisma.maintenanceTicket.update({
      where: { id },
      data: { status },
    });

    return NextResponse.json({ success: true, data: ticket });
  } catch (error) {
    console.error("Failed to update ticket:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
