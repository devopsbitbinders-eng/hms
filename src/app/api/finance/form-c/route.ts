import { NextResponse } from "next/server";
import prisma from "@/lib/db";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const propertyId = searchParams.get("propertyId");

    if (!propertyId) {
      return NextResponse.json({ error: "Missing propertyId parameter" }, { status: 400 });
    }

    // Fetch reservations for the property
    const rooms = await prisma.room.findMany({
      where: { propertyId },
      include: {
        reservations: true
      }
    });

    let csvContent = "Guest Name,Nationality,Passport Number,Passport Place of Issue,Passport Issue Date,Passport Expiry Date,Visa Number,Visa Type,Visa Expiry Date,Date of Arrival in India,Arrived From,Proceeding To\n";

    rooms.forEach(room => {
      room.reservations.forEach(res => {
        // Filter only foreign guests
        if (res.nationality === "Foreign" || res.passportNumber) {
          const row = [
            `"${res.guestName || ""}"`,
            `"${res.nationality || ""}"`,
            `"${res.passportNumber || ""}"`,
            `"${res.passportPlace || ""}"`,
            `"${res.passportIssueDate || ""}"`,
            `"${res.passportExpiryDate || ""}"`,
            `"${res.visaNumber || ""}"`,
            `"${res.visaType || ""}"`,
            `"${res.visaExpiryDate || ""}"`,
            `"${res.indiaArrivalDate || ""}"`,
            `"${res.arrivedFrom || ""}"`,
            `"${res.proceedingTo || ""}"`
          ].join(",");
          csvContent += row + "\n";
        }
      });
    });

    return new NextResponse(csvContent, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="form-c-export-${new Date().toISOString().split("T")[0]}.csv"`,
      }
    });

  } catch (error) {
    console.error("Form C export error", error);
    return NextResponse.json({ error: "Failed to generate Form C export" }, { status: 500 });
  }
}
