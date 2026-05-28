import { NextResponse } from "next/server";
import prisma from "@/lib/db";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      guestName,
      roomId,
      startIndex,
      duration,
      status,
      details,
      isGroup,
      groupName,
      bookingType, // "daily" or "hourly"
      billingItems, // array of { name, amount, category }

      // Contact Information
      phone,
      email,
      dob,
      nationality,

      // Primary ID Verification
      idType,
      idNumber,
      idScanData,

      // Foreign National - Form C Requirements
      passportNumber,
      passportPlace,
      passportIssueDate,
      passportExpiryDate,
      visaNumber,
      visaType,
      visaExpiryDate,
      indiaArrivalDate,
      portOfEntry,
      arrivedFrom,
      proceedingTo,

      // Stay & Occupants Metadata
      checkInTime,
      checkOutTime,
      numAdults,
      numChildren,
      childAges,
      vehicleNumber,

      // Billing, Preferences & VIP Tags
      paymentMethod,
      upiTransactionId,
      specialRequests,
      guestTag,
      billingType,
      guestGstNumber,
    } = body;

    if (!guestName || !roomId || startIndex === undefined || !duration || !status) {
      return NextResponse.json(
        { success: false, error: "Missing required fields: guestName, roomId, startIndex, duration, status" },
        { status: 400 }
      );
    }

    // 1. PAN Card Block Validation
    if (idType === "PAN" || idType === "PAN Card") {
      return NextResponse.json(
        { success: false, error: "Validation Error|PAN Cards are explicitly not accepted as valid proof of identity for hotel check-ins in India." },
        { status: 400 }
      );
    }

    // 2. Age Verification Validation (>= 18 years old)
    if (dob) {
      const birthDate = new Date(dob);
      const today = new Date();
      let age = today.getFullYear() - birthDate.getFullYear();
      const m = today.getMonth() - birthDate.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }
      if (age < 18) {
        return NextResponse.json(
          { success: false, error: "Age Restricted|Primary guest must be 18 years or older to book." },
          { status: 400 }
        );
      }
    }

    const parsedStartIndex = parseInt(startIndex, 10);
    const parsedDuration = parseInt(duration, 10);
    const targetBookingType = bookingType || "daily";

    // Double Booking Prevention Check
    const existingReservations = await prisma.reservation.findMany({
      where: {
        roomId: roomId,
        bookingType: targetBookingType,
      },
    });

    const proposedStart = parsedStartIndex;
    const proposedEnd = parsedStartIndex + parsedDuration;

    const conflict = existingReservations.find((res) => {
      if (res.status === "checked-out" || res.status === "cancelled") return false;
      const resStart = res.startIndex;
      const resEnd = res.startIndex + res.duration;
      return Math.max(proposedStart, resStart) < Math.min(proposedEnd, resEnd);
    });

    if (conflict) {
      return NextResponse.json(
        {
          success: false,
          error: `Room Occupied|This room is already booked by "${conflict.guestName}" during this period. Please choose another date or room.`,
        },
        { status: 400 }
      );
    }

    const reservation = await prisma.reservation.create({
      data: {
        guestName,
        roomId,
        startIndex: parseInt(startIndex, 10),
        duration: parseInt(duration, 10),
        status,
        details: details || "",
        isGroup: !!isGroup,
        groupName: groupName || "",
        bookingType: bookingType || "daily",
        phone: phone || null,
        email: email || null,
        dob: dob || null,
        nationality: nationality || null,
        idType: idType || null,
        idNumber: idNumber || null,
        idScanData: idScanData || null,
        passportNumber: passportNumber || null,
        passportPlace: passportPlace || null,
        passportIssueDate: passportIssueDate || null,
        passportExpiryDate: passportExpiryDate || null,
        visaNumber: visaNumber || null,
        visaType: visaType || null,
        visaExpiryDate: visaExpiryDate || null,
        indiaArrivalDate: indiaArrivalDate || null,
        portOfEntry: portOfEntry || null,
        arrivedFrom: arrivedFrom || null,
        proceedingTo: proceedingTo || null,
        checkInTime: checkInTime || null,
        checkOutTime: checkOutTime || null,
        numAdults: numAdults !== undefined ? parseInt(numAdults, 10) : 1,
        numChildren: numChildren !== undefined ? parseInt(numChildren, 10) : 0,
        childAges: childAges || null,
        vehicleNumber: vehicleNumber || null,
        paymentMethod: paymentMethod || null,
        upiTransactionId: upiTransactionId || null,
        specialRequests: specialRequests || null,
        guestTag: guestTag || null,
        billingType: billingType || "individual",
        guestGstNumber: guestGstNumber || null,
        billingItems: {
          create: (billingItems || []).map((item: any) => ({
            name: item.name,
            amount: parseFloat(item.amount),
            category: item.category || "room",
            invoiceGroup: "A",
          })),
        },
      },
      include: {
        billingItems: true,
      },
    });

    return NextResponse.json({ success: true, reservation });
  } catch (error: any) {
    console.error("Failed to create reservation:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to create reservation" },
      { status: 500 }
    );
  }
}
