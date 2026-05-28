import { NextResponse } from "next/server";
import prisma from "@/lib/db";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Resolve params robustly (supports both Promise and plain objects in Next.js 15/16)
    const resolvedParams = await params;
    const id = resolvedParams.id;

    const body = await request.json();
    const {
      roomId,
      startIndex,
      status,
      guestName,
      details,
      duration,
      isGroup,
      groupName,
      bookingType,

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

    const currentReservation = await prisma.reservation.findUnique({
      where: { id },
    });

    if (!currentReservation) {
      return NextResponse.json(
        { success: false, error: "Reservation not found." },
        { status: 404 }
      );
    }

    // 1. PAN Card Block Validation
    if (idType !== undefined && (idType === "PAN" || idType === "PAN Card")) {
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

    const targetRoomId = roomId !== undefined ? roomId : currentReservation.roomId;
    const targetStartIndex = startIndex !== undefined ? parseInt(startIndex, 10) : currentReservation.startIndex;
    const targetDuration = duration !== undefined ? parseInt(duration, 10) : currentReservation.duration;
    const targetBookingType = bookingType !== undefined ? bookingType : currentReservation.bookingType;

    // Only check for overlap if room, start date, duration, or scale is updated
    if (
      roomId !== undefined ||
      startIndex !== undefined ||
      duration !== undefined ||
      bookingType !== undefined
    ) {
      const existingReservations = await prisma.reservation.findMany({
        where: {
          roomId: targetRoomId,
          bookingType: targetBookingType,
          NOT: {
            id: id,
          },
        },
      });

      const proposedStart = targetStartIndex;
      const proposedEnd = targetStartIndex + targetDuration;

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
    }

    const updateData: any = {};
    if (roomId !== undefined) updateData.roomId = roomId;
    if (startIndex !== undefined) updateData.startIndex = parseInt(startIndex, 10);
    if (status !== undefined) updateData.status = status;
    if (guestName !== undefined) updateData.guestName = guestName;
    if (details !== undefined) updateData.details = details;
    if (duration !== undefined) updateData.duration = parseInt(duration, 10);
    if (isGroup !== undefined) updateData.isGroup = !!isGroup;
    if (groupName !== undefined) updateData.groupName = groupName;
    if (bookingType !== undefined) updateData.bookingType = bookingType;

    // Contact Information
    if (phone !== undefined) updateData.phone = phone;
    if (email !== undefined) updateData.email = email;
    if (dob !== undefined) updateData.dob = dob;
    if (nationality !== undefined) updateData.nationality = nationality;

    // Primary ID Verification
    if (idType !== undefined) updateData.idType = idType;
    if (idNumber !== undefined) updateData.idNumber = idNumber;
    if (idScanData !== undefined) updateData.idScanData = idScanData;

    // Foreign National - Form C Requirements
    if (passportNumber !== undefined) updateData.passportNumber = passportNumber;
    if (passportPlace !== undefined) updateData.passportPlace = passportPlace;
    if (passportIssueDate !== undefined) updateData.passportIssueDate = passportIssueDate;
    if (passportExpiryDate !== undefined) updateData.passportExpiryDate = passportExpiryDate;
    if (visaNumber !== undefined) updateData.visaNumber = visaNumber;
    if (visaType !== undefined) updateData.visaType = visaType;
    if (visaExpiryDate !== undefined) updateData.visaExpiryDate = visaExpiryDate;
    if (indiaArrivalDate !== undefined) updateData.indiaArrivalDate = indiaArrivalDate;
    if (portOfEntry !== undefined) updateData.portOfEntry = portOfEntry;
    if (arrivedFrom !== undefined) updateData.arrivedFrom = arrivedFrom;
    if (proceedingTo !== undefined) updateData.proceedingTo = proceedingTo;

    // Stay & Occupants Metadata
    if (checkInTime !== undefined) updateData.checkInTime = checkInTime;
    if (checkOutTime !== undefined) updateData.checkOutTime = checkOutTime;
    if (numAdults !== undefined) updateData.numAdults = parseInt(numAdults, 10);
    if (numChildren !== undefined) updateData.numChildren = parseInt(numChildren, 10);
    if (childAges !== undefined) updateData.childAges = childAges;
    if (vehicleNumber !== undefined) updateData.vehicleNumber = vehicleNumber;

    // Billing, Preferences & VIP Tags
    if (paymentMethod !== undefined) updateData.paymentMethod = paymentMethod;
    if (upiTransactionId !== undefined) updateData.upiTransactionId = upiTransactionId;
    if (specialRequests !== undefined) updateData.specialRequests = specialRequests;
    if (guestTag !== undefined) updateData.guestTag = guestTag;
    if (billingType !== undefined) updateData.billingType = billingType;
    if (guestGstNumber !== undefined) updateData.guestGstNumber = guestGstNumber;

    const reservation = await prisma.reservation.update({
      where: { id },
      data: updateData,
    });

    if (status === "checked-out" && currentReservation.status !== "checked-out") {
      await prisma.room.update({
        where: { id: targetRoomId },
        data: { cleanStatus: "Dirty" }
      });
    }

    return NextResponse.json({ success: true, reservation });
  } catch (error: any) {
    console.error("Failed to update reservation:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to update reservation" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const id = resolvedParams.id;

    const currentReservation = await prisma.reservation.findUnique({
      where: { id },
    });

    if (!currentReservation) {
      return NextResponse.json(
        { success: false, error: "Reservation not found." },
        { status: 404 }
      );
    }

    await prisma.reservation.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, message: "Reservation deleted successfully." });
  } catch (error: any) {
    console.error("Failed to delete reservation:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to delete reservation" },
      { status: 500 }
    );
  }
}

