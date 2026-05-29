import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

export async function GET(request: Request) {
  try {
    const leaveRequests = await prisma.leaveRequest.findMany({
      include: {
        user: { select: { name: true, role: true, avatar: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
    return NextResponse.json(leaveRequests);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const data = await request.json();
    const newLeave = await prisma.leaveRequest.create({
      data: {
        userId: data.userId,
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
        reason: data.reason,
        status: "Pending"
      }
    });
    return NextResponse.json(newLeave);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const data = await request.json();
    const updatedLeave = await prisma.leaveRequest.update({
      where: { id: data.id },
      data: { status: data.status }
    });
    return NextResponse.json(updatedLeave);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
