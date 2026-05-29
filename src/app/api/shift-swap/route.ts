import { NextResponse } from "next/server";
import prisma from "@/lib/db";

export async function GET() {
  try {
    const requests = await prisma.shiftSwapRequest.findMany({
      include: {
        requester: { select: { id: true, name: true, role: true, assignedShift: true } },
        targetUser: { select: { id: true, name: true, role: true, assignedShift: true } }
      },
      orderBy: { createdAt: "desc" }
    });
    return NextResponse.json({ success: true, requests });
  } catch (error) {
    console.error("Error fetching shift swap requests:", error);
    return NextResponse.json({ success: false, error: "Failed to fetch requests" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { requesterId, targetUserId, proposedShift, reason } = await req.json();

    const request = await prisma.shiftSwapRequest.create({
      data: {
        requesterId,
        targetUserId: targetUserId || null,
        proposedShift,
        reason,
        status: "Pending",
      },
    });

    return NextResponse.json({ success: true, request });
  } catch (error) {
    console.error("Error creating shift swap request:", error);
    return NextResponse.json({ success: false, error: "Failed to create request" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const { id, status } = await req.json();

    const request = await prisma.shiftSwapRequest.update({
      where: { id },
      data: { status },
      include: {
        requester: true,
        targetUser: true
      }
    });

    // If approved, update the actual assignedShift
    if (status === "Approved") {
      // Update requester's shift
      await prisma.user.update({
        where: { id: request.requesterId },
        data: { assignedShift: request.proposedShift }
      });

      if (request.targetUserId) {
        await prisma.user.update({
          where: { id: request.targetUserId },
          data: { assignedShift: request.requester.assignedShift }
        });
      }
    }

    return NextResponse.json({ success: true, request });
  } catch (error) {
    console.error("Error updating shift swap request:", error);
    return NextResponse.json({ success: false, error: "Failed to update request" }, { status: 500 });
  }
}
