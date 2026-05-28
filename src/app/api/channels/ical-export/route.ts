import { NextResponse } from "next/server";
import prisma from "@/lib/db";

// Helper to format date into YYYYMMDD string for iCal all-day events
function formatCalDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const channelId = searchParams.get("channelId");
    const propertyId = searchParams.get("propertyId");

    if (!channelId || !propertyId) {
      return NextResponse.json(
        { success: false, error: "Missing required parameters: channelId and propertyId" },
        { status: 400 }
      );
    }

    // 1. Verify that the channel exists and is connected
    const channel = await prisma.channel.findUnique({
      where: { id: channelId }
    });

    if (!channel || channel.propertyId !== propertyId) {
      return NextResponse.json(
        { success: false, error: "Invalid Channel or Property context mismatch." },
        { status: 404 }
      );
    }

    // 2. Fetch all rooms under this property
    const rooms = await prisma.room.findMany({
      where: { propertyId },
      include: { reservations: true }
    });

    // Base date May 20, 2026 for conversion index
    const baseDate = new Date(2026, 4, 20);

    // 3. Compile reservations list into iCal Events
    let icalEvents = "";
    const nowTimestamp = formatCalDate(new Date()) + "T000000Z";

    for (const room of rooms) {
      for (const res of room.reservations) {
        // Skip maintenance blocks or cancelled ones if any
        if (res.status === "cancelled") continue;

        // Calculate arrival and departure dates based on booking type
        const start = new Date(baseDate.getTime());
        const end = new Date(baseDate.getTime());

        if (res.bookingType === "hourly") {
          // Architectural constraint: Even if it's a 2-hour or 4-hour slot,
          // we MUST block the entire calendar day on OTAs to prevent double booking.
          // Hourly slots always happen on the baseDate (index 0) in this engine.
          end.setDate(baseDate.getDate() + 1); // +1 day because iCal DTEND is exclusive
        } else {
          // Daily booking: startIndex is the day index
          start.setDate(baseDate.getDate() + res.startIndex);
          end.setDate(baseDate.getDate() + res.startIndex + res.duration);
        }

        const formattedStart = formatCalDate(start);
        const formattedEnd = formatCalDate(end);

        // Escape helper for text descriptions
        const guestNameEscaped = res.guestName.replace(/[,;]/g, "\\$&");

        icalEvents += `BEGIN:VEVENT
UID:res-${res.id}@aetherhms.com
DTSTAMP:${nowTimestamp}
DTSTART;VALUE=DATE:${formattedStart}
DTEND;VALUE=DATE:${formattedEnd}
SUMMARY:AetherHMS Block [Room ${room.number}]
DESCRIPTION:Reserved for ${guestNameEscaped} (${res.bookingType} stay)
STATUS:CONFIRMED
END:VEVENT\n`;
      }
    }

    // 4. Build standard RFC 5545 iCalendar payload
    const icsContent = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//AetherHMS//ChannelManager//EN",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      `X-WR-CALNAME:AetherHMS Room locks - ${channel.name}`,
      "X-WR-TIMEZONE:Asia/Kolkata",
      icalEvents.trim(),
      "END:VCALENDAR"
    ].filter(Boolean).join("\r\n") + "\r\n";

    // 5. Output with official calendar headers
    return new NextResponse(icsContent, {
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": `attachment; filename="aetherhms-channel-${channel.name.toLowerCase().replace(/\s+/g, "-")}.ics"`,
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate"
      }
    });

  } catch (error: any) {
    console.error("GET /api/channels/ical-export error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to generate iCal feed." },
      { status: 500 }
    );
  }
}
