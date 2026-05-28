import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const dateStr = searchParams.get("date"); // e.g., "2023-10-25"
    let dateFilter = {};
    if (dateStr) {
      const startDate = new Date(dateStr);
      startDate.setUTCHours(0,0,0,0);
      const endDate = new Date(dateStr);
      endDate.setUTCHours(23,59,59,999);
      dateFilter = {
        date: {
          gte: startDate,
          lte: endDate
        }
      }
    }

    const attendances = await prisma.attendance.findMany({
      where: dateFilter,
      include: {
        user: {
          select: { name: true, username: true, role: true, avatar: true }
        }
      },
      orderBy: { createdAt: "desc" }
    });
    return NextResponse.json({ success: true, attendances });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ success: false, error: "Failed to fetch attendance" });
  }
}

export async function POST(request: Request) {
  try {
    const data = await request.json();
    const { userId, type, status, markedBy } = data; // type: "clockIn", "clockOut", or "manual"
    
    const today = new Date();
    today.setUTCHours(0,0,0,0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (type === "clockIn") {
      // Check if already clocked in today
      const existing = await prisma.attendance.findFirst({
        where: { userId, date: { gte: today, lt: tomorrow } }
      });
      if (existing) {
        return NextResponse.json({ success: false, error: "Already clocked in today" });
      }
      
      const att = await prisma.attendance.create({
        data: {
          userId,
          date: new Date(),
          clockIn: new Date(),
          status: status || "Present",
          markedBy: markedBy || "Self"
        }
      });
      return NextResponse.json({ success: true, attendance: att });
    }
    
    if (type === "clockOut") {
      const existing = await prisma.attendance.findFirst({
        where: { userId, date: { gte: today, lt: tomorrow }, clockOut: null },
        orderBy: { clockIn: "desc" }
      });
      if (!existing) {
        return NextResponse.json({ success: false, error: "No active clock-in found" });
      }
      const att = await prisma.attendance.update({
        where: { id: existing.id },
        data: { clockOut: new Date() }
      });
      return NextResponse.json({ success: true, attendance: att });
    }

    if (type === "manual") {
      // Owner marking attendance
      const dateToUse = data.date ? new Date(data.date) : new Date();
      const clockInTime = data.clockIn ? new Date(data.clockIn) : new Date();
      
      const att = await prisma.attendance.create({
        data: {
          userId,
          date: dateToUse,
          clockIn: clockInTime,
          clockOut: data.clockOut ? new Date(data.clockOut) : null,
          status: status || "Present",
          markedBy: markedBy || "Owner"
        }
      });
      return NextResponse.json({ success: true, attendance: att });
    }

    return NextResponse.json({ success: false, error: "Invalid type" });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ success: false, error: "Failed to mark attendance" });
  }
}
