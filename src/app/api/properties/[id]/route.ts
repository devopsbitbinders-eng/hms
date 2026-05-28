import { NextResponse } from "next/server";
import prisma from "@/lib/db";

const ALLOWED_OTA_FIELDS = [
  "bookingComUrl", "tripAdvisorUrl", "agodaUrl", "makeMyTripUrl",
  "expediaUrl", "hotelsComUrl", "airbnbUrl", "goibiboUrl",
  "yatraUrl", "oyoUrl", "easemytripUrl", "customOtaUrls"
];

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: propertyId } = await params;
    if (!propertyId) return NextResponse.json({ error: "Missing propertyId" }, { status: 400 });
    const property = await prisma.property.findUnique({ where: { id: propertyId } });
    if (!property) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(property);
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: propertyId } = await params;
    if (!propertyId) return NextResponse.json({ error: "Missing propertyId" }, { status: 400 });

    const body = await request.json();
    const updateData: any = {};

    for (const field of ALLOWED_OTA_FIELDS) {
      if (body[field] !== undefined) {
        // Allow setting to null to unlink a platform
        updateData[field] = body[field] === "" ? null : body[field];
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "No valid fields provided" }, { status: 400 });
    }

    const property = await prisma.property.update({
      where: { id: propertyId },
      data: updateData
    });

    return NextResponse.json({ success: true, property });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
