import { NextResponse } from "next/server";
import prisma from "@/lib/db";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { channelId, propertyId } = body;

    if (!channelId || !propertyId) {
      return NextResponse.json(
        { success: false, error: "Missing required fields: channelId, propertyId" },
        { status: 400 }
      );
    }

    // 1. Verify channel exists and is iCal-based
    const channel = await prisma.channel.findUnique({
      where: { id: channelId }
    });

    if (!channel || channel.propertyId !== propertyId) {
      return NextResponse.json(
        { success: false, error: "Channel context mismatch or not found." },
        { status: 404 }
      );
    }

    if (channel.syncType !== "ical") {
      return NextResponse.json(
        { success: false, error: "This channel does not support iCal calendar link sync." },
        { status: 400 }
      );
    }

    // 2. Fetch all rooms and their reservations
    const rooms = await prisma.room.findMany({
      where: { propertyId },
      include: { reservations: true }
    });

    if (rooms.length === 0) {
      return NextResponse.json(
        { success: false, error: "No rooms mapped to this property. Please seed rooms first." },
        { status: 400 }
      );
    }

    // 3. Define 2 simulated events to pull from the external iCal feed
    // Event 1: A successful import in a vacant room
    // Event 2: A conflicting import in an occupied room to show collision blocking
    
    // Find a room that has some bookings, to cause a collision
    let roomWithBookings = rooms.find(r => r.reservations.length > 0);
    let roomWithoutBookings = rooms.find(r => r.reservations.length === 0);

    // Default room assignments if we don't have enough data
    const targetConflictRoom = roomWithBookings || rooms[0];
    const targetVacantRoom = roomWithoutBookings || (rooms.length > 1 ? rooms[1] : rooms[0]);

    // Let's create two mock events
    // Event A: Vacant import. We'll pick a vacant slot: May 26 to May 28 (startIndex = 6, duration = 2)
    // We'll search for conflicts for Event A in targetVacantRoom. If there's an existing reservation, we'll shift the startIndex.
    let vacantStartIndex = 6;
    let vacantDuration = 2;
    while (
      targetVacantRoom.reservations.some(res => {
        const proposedStart = vacantStartIndex;
        const proposedEnd = vacantStartIndex + vacantDuration;
        const resStart = res.startIndex;
        const resEnd = res.startIndex + res.duration;
        return Math.max(proposedStart, resStart) < Math.min(proposedEnd, resEnd);
      })
    ) {
      vacantStartIndex += 3; // Shift dates to avoid collision
    }

    // Event B: Conflicting import. We'll target the same dates as an existing reservation in targetConflictRoom.
    // If targetConflictRoom has no reservations, we will simulate a booking that succeeds instead of conflicts.
    let conflictStartIndex = 4;
    let conflictDuration = 2;
    let conflictResMatch = targetConflictRoom.reservations[0];
    
    if (conflictResMatch) {
      conflictStartIndex = conflictResMatch.startIndex;
      conflictDuration = conflictResMatch.duration;
    } else {
      // If no reservations exist, just place it on May 24 (startIndex = 4)
      conflictStartIndex = 4;
      conflictDuration = 2;
    }

    const mockIcalEvents = [
      {
        id: "mock-ical-vacant-102",
        guestName: "Samantha Miller",
        room: targetVacantRoom,
        startIndex: vacantStartIndex,
        duration: vacantDuration,
        isConflictExpected: false
      },
      {
        id: "mock-ical-conflict-103",
        guestName: "Dinesh Kumar",
        room: targetConflictRoom,
        startIndex: conflictStartIndex,
        duration: conflictDuration,
        isConflictExpected: !!conflictResMatch
      }
    ];

    let processedCount = 0;
    let successCount = 0;
    let blockedCount = 0;

    for (const event of mockIcalEvents) {
      processedCount++;
      const { guestName, room, startIndex, duration } = event;
      
      // Perform collision checking (Double Booking Prevention)
      const existingReservations = await prisma.reservation.findMany({
        where: {
          roomId: room.id,
          bookingType: "daily"
        }
      });

      const proposedStart = startIndex;
      const proposedEnd = startIndex + duration;

      const conflict = existingReservations.find(res => {
        const resStart = res.startIndex;
        const resEnd = res.startIndex + res.duration;
        return Math.max(proposedStart, resStart) < Math.min(proposedEnd, resEnd);
      });

      if (conflict) {
        blockedCount++;
        // Create blocked log
        await prisma.channelLog.create({
          data: {
            channelName: channel.name,
            type: "booking_webhook",
            status: "blocked",
            message: `[⚠️ iCal COLLISION BLOCKED] Incoming calendar sync from ${channel.name} REJECTED! Guest "${guestName}" attempted to book Room ${room.number} on May ${20 + proposedStart} (Duration: ${duration} nights) which conflicts with local occupant "${conflict.guestName}". Overbooking prevented.`,
            propertyId
          }
        });
      } else {
        successCount++;
        // Create local reservation
        await prisma.reservation.create({
          data: {
            guestName: `iCal Sync (${guestName})`,
            roomId: room.id,
            startIndex,
            duration,
            status: "confirmed",
            details: `Imported via 2-way iCal synchronization from ${channel.name}. Source feed: ${channel.externalIcalUrl || "Dynamic iCal URL"}`,
            phone: "+91 98765 43210",
            email: `${guestName.toLowerCase().replace(/\s+/g, "")}@external-ical.com`,
            paymentMethod: "Pay at Property",
            bookingType: "daily",
            checkInTime: "12:00 PM",
            checkOutTime: "11:00 AM",
            numAdults: 2,
            numChildren: 0,
            guestTag: "Frequent Flyer",
            billingItems: {
              create: [
                {
                  name: `Room Tariff (${channel.name} iCal Pricing)`,
                  amount: 2200 * duration,
                  category: "room",
                  invoiceGroup: "A"
                }
              ]
            }
          }
        });

        // Create success log
        await prisma.channelLog.create({
          data: {
            channelName: channel.name,
            type: "booking_webhook",
            status: "success",
            message: `[📥 iCal Sync Import] Successfully imported and locked reservation for "${guestName}" in Room ${room.number} (May ${20 + startIndex}, ${duration} nights) from ${channel.name}. Local blocks established.`,
            propertyId
          }
        });
      }
    }

    // 4. Update last synced timestamp on channel
    const updatedChannel = await prisma.channel.update({
      where: { id: channelId },
      data: {
        lastSynced: new Date(),
        status: "active"
      }
    });

    return NextResponse.json({
      success: true,
      processed: processedCount,
      successCount,
      blockedCount,
      channel: updatedChannel
    });

  } catch (error: any) {
    console.error("POST /api/channels/ical-sync error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed during iCal calendar sync." },
      { status: 500 }
    );
  }
}
