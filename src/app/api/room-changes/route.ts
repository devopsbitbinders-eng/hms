import { NextResponse } from "next/server";
import prisma from "@/lib/db";

// GET all room changes for a property
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const propertyId = searchParams.get("propertyId");

    const roomChanges = await (prisma as any).roomChange.findMany({
      where: propertyId ? { propertyId } : {},
      orderBy: { changedAt: "desc" },
    });

    return NextResponse.json({ success: true, roomChanges });
  } catch (error: any) {
    console.error("Failed to fetch room changes:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST create a room change record and update reservation's roomId
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { reservationId, fromRoomId, toRoomId, reason, guestName, changedBy, propertyId } = body;

    if (!reservationId || !fromRoomId || !toRoomId || !reason) {
      return NextResponse.json(
        { success: false, error: "Missing required fields: reservationId, fromRoomId, toRoomId, reason" },
        { status: 400 }
      );
    }

    if (fromRoomId === toRoomId) {
      return NextResponse.json(
        { success: false, error: "New room must be different from current room." },
        { status: 400 }
      );
    }

    // Check if new room is available (no active bookings conflict)
    const targetReservation = await prisma.reservation.findUnique({
      where: { id: reservationId },
    });

    if (!targetReservation) {
      return NextResponse.json({ success: false, error: "Reservation not found." }, { status: 404 });
    }

    const conflictingBookings = await prisma.reservation.findMany({
      where: {
        roomId: toRoomId,
        status: { in: ["checked-in", "confirmed", "pending"] },
        id: { not: reservationId },
      },
    });

    const proposedStart = targetReservation.startIndex;
    const proposedEnd = targetReservation.startIndex + targetReservation.duration;

    const conflict = conflictingBookings.find((res) => {
      const resStart = res.startIndex;
      const resEnd = res.startIndex + res.duration;
      return Math.max(proposedStart, resStart) < Math.min(proposedEnd, resEnd);
    });

    if (conflict) {
      return NextResponse.json(
        { success: false, error: `New room is already occupied by "${conflict.guestName}" during this period.` },
        { status: 400 }
      );
    }

    // Update the reservation's roomId
    await prisma.reservation.update({
      where: { id: reservationId },
      data: { roomId: toRoomId },
    });

    // Fetch room names for the log
    const fromRoom = await prisma.room.findUnique({ where: { id: fromRoomId } });
    const toRoom = await prisma.room.findUnique({ where: { id: toRoomId } });

    // Create the room change audit record
    const roomChange = await (prisma as any).roomChange.create({
      data: {
        reservationId,
        guestName: guestName || "Unknown Guest",
        fromRoomId,
        toRoomId,
        fromRoomNumber: fromRoom?.number || "?",
        toRoomNumber: toRoom?.number || "?",
        fromRoomName: fromRoom?.name || "",
        toRoomName: toRoom?.name || "",
        reason,
        changedBy: changedBy || "Front Desk",
        propertyId: propertyId || "",
        changedAt: new Date(),
      },
    });

    return NextResponse.json({ success: true, roomChange });
  } catch (error: any) {
    console.error("Failed to process room change:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
