import { NextResponse } from "next/server";
import prisma from "@/lib/db";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { channelName, roomId, startDateStr, duration, guestName, propertyId } = body;

    if (!channelName || !roomId || !startDateStr || !duration || !guestName || !propertyId) {
      return NextResponse.json(
        { success: false, error: "Missing required fields: channelName, roomId, startDateStr, duration, guestName, propertyId" },
        { status: 400 }
      );
    }

    // 1. Verify channel is connected in AetherHMS
    const channel = await prisma.channel.findFirst({
      where: { name: channelName, propertyId }
    });

    if (!channel || !channel.connected) {
      return NextResponse.json(
        { success: false, error: `Connection Denied|The channel "${channelName}" is not currently active. Open the credentials mapping modal and save a valid Listing ID before receiving inbound webhooks.` },
        { status: 400 }
      );
    }

    // 2. Fetch target room info for logs
    const room = await prisma.room.findUnique({
      where: { id: roomId }
    });

    if (!room) {
      return NextResponse.json(
        { success: false, error: "Room not found" },
        { status: 404 }
      );
    }

    // 3. Map startDateStr to startIndex
    // Base date May 20, 2026
    const base = new Date(2026, 4, 20);
    const parts = startDateStr.split("-").map(Number);
    const picked = new Date(parts[0], parts[1] - 1, parts[2]);
    const diff = Math.round((picked.getTime() - base.getTime()) / 86400000);
    const startIndex = Math.min(Math.max(diff, 0), 13);
    const parsedDuration = parseInt(duration, 10);

    // 4. Overlap Check (Double Booking Prevention)
    const existingReservations = await prisma.reservation.findMany({
      where: {
        roomId: roomId,
        bookingType: "daily"
      }
    });

    const proposedStart = startIndex;
    const proposedEnd = startIndex + parsedDuration;

    const conflict = existingReservations.find((res) => {
      const resStart = res.startIndex;
      const resEnd = res.startIndex + res.duration;
      return Math.max(proposedStart, resStart) < Math.min(proposedEnd, resEnd);
    });

    if (conflict) {
      // Create blocked warning log in DB
      await prisma.channelLog.create({
        data: {
          channelName,
          type: "booking_webhook",
          status: "blocked",
          message: `[⚠️ OVERBOOKING PREVENTED] Incoming Webhook from ${channelName} BLOCKED! Guest "${guestName}" attempted to book Room ${room.number} on May ${20 + proposedStart} (Duration: ${parsedDuration} nights) which conflicts with local occupant "${conflict.guestName}". Auto-collision blocker active.`,
          propertyId
        }
      });

      return NextResponse.json(
        {
          success: false,
          error: `Room Occupied|Accidental overbooking blocked! Room ${room.number} is occupied by "${conflict.guestName}" on those dates. Zero-lag synchronization rejected the incoming external request.`
        },
        { status: 400 }
      );
    }

    // 5. Create persistent reservation
    const simulatedOtaReservation = await prisma.reservation.create({
      data: {
        guestName: `OTA Booking (${guestName})`,
        roomId,
        startIndex,
        duration: parsedDuration,
        status: "confirmed",
        details: `Simulated OTA reservation received via real-time inbound webhook from ${channelName}. Listing Mapped ID: ${channel.listingId}`,
        phone: "+91 99999 88888",
        email: "ota-guest@global-channel.com",
        dob: "1990-05-15",
        nationality: "Indian",
        idType: "Passport",
        idNumber: `Z${Math.floor(1000000 + Math.random() * 9000000)}`,
        paymentMethod: "Pay at Property",
        bookingType: "daily",
        checkInTime: "12:00 PM",
        checkOutTime: "11:00 AM",
        numAdults: 2,
        numChildren: 0,
        guestTag: channelName === "Airbnb" ? "Frequent Flyer" : "Corporate Guest",
        billingItems: {
          create: [
            {
              name: `Room Charge (${channelName} Rate Parity)`,
              amount: 2500 * parsedDuration,
              category: "room",
              invoiceGroup: "A"
            }
          ]
        }
      }
    });

    // Create success log in DB
    await prisma.channelLog.create({
      data: {
        channelName,
        type: "booking_webhook",
        status: "success",
        message: `[📥 Webhook Inbound] Registered reservation for "${guestName}" in Room ${room.number} (May ${20 + startIndex}, ${parsedDuration} nights) from ${channelName} listing ID "${channel.listingId}". Zero-lag fanout updated remaining connected OTAs.`,
        propertyId
      }
    });

    return NextResponse.json({ success: true, reservation: simulatedOtaReservation });
  } catch (error: any) {
    console.error("Simulation endpoint error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Simulation server error" },
      { status: 500 }
    );
  }
}
