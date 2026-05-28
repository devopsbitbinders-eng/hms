import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const propertyId = searchParams.get("propertyId");

    const reviews = await prisma.review.findMany({
      where: propertyId ? { propertyId } : undefined,
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ success: true, reviews });
  } catch (error: any) {
    console.error("Error fetching reviews:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const data = await req.json();
    
    if (!data.propertyId || !data.guestName || !data.rating) {
      return NextResponse.json({ success: false, error: "Missing required fields" }, { status: 400 });
    }

    const review = await prisma.review.create({
      data: {
        propertyId: data.propertyId,
        guestName: data.guestName,
        rating: data.rating,
        comment: data.comment || "",
        source: data.source || "Internal",
        status: data.status || "pending",
        reservationId: data.reservationId || null,
      },
    });

    return NextResponse.json({ success: true, review });
  } catch (error: any) {
    console.error("Error creating review:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
