import { NextResponse } from "next/server";
import prisma from "@/lib/db";

export async function GET() {
  try {
    // 1. Clean the database tables in reverse order of relations
    await prisma.billingItem.deleteMany();
    await prisma.reservation.deleteMany();
    await prisma.room.deleteMany();
    await prisma.property.deleteMany();
    
    // Safely attempt clearing of User table if it exists in DB
    try {
      await prisma.user.deleteMany();
    } catch (e) {
      console.warn("User table cleanup skipped or failed:", e);
    }

    // 2. Seed Default Staff Accounts
    await prisma.user.createMany({
      data: [
        {
          name: "Aravind Mehta",
          username: "aravind",
          password: "adminpassword",
          role: "Super Admin",
          avatar: "AM"
        },
        {
          name: "Kabir Anand",
          username: "kabir",
          password: "frontoffice",
          role: "Front Office Manager",
          avatar: "KA"
        },
        {
          name: "Meera Sen",
          username: "meera",
          password: "housekeeping",
          role: "Housekeeping Supervisor",
          avatar: "MS"
        },
        {
          name: "Sanjay Singhal",
          username: "sanjay",
          password: "finance",
          role: "Finance Executive",
          avatar: "SS"
        }
      ]
    });


    // 2. Seed Goa Beachfront Homestay
    const goa = await prisma.property.create({
      data: {
        name: "Goa Beachfront Homestay",
        type: "homestay",
        location: "Goa, India",
        rooms: {
          create: [
            { number: "101", name: "Suite Palms", type: "Premium Suite" },
            { number: "102", name: "Ocean Breeze", type: "Standard Room" },
            { number: "103", name: "Sunset Vista", type: "Rustic Cabin" },
            { number: "104", name: "Dune Hideaway", type: "Standard Room" },
          ],
        },
      },
      include: { rooms: true },
    });

    // Seed Goa reservations
    await prisma.reservation.create({
      data: {
        guestName: "Kabir Anand",
        roomId: goa.rooms[0].id, // Room 101
        startIndex: 1,
        duration: 4,
        status: "checked-in",
        details: "VIP Guest. Prefers extra towels and airport drop-off booking.",
        isGroup: false,
        billingItems: {
          create: [
            { name: "Room Tariff - 4 Nights", amount: 32000, category: "room", invoiceGroup: "A" },
            { name: "Express Laundry Cycles", amount: 1200, category: "service", invoiceGroup: "A" },
            { name: "Jet Ski Experience Pack", amount: 3500, category: "amenity", invoiceGroup: "A" },
          ],
        },
      },
    });

    await prisma.reservation.create({
      data: {
        guestName: "Elena Rostova",
        roomId: goa.rooms[1].id, // Room 102
        startIndex: 2,
        duration: 3,
        status: "confirmed",
        details: "Foreign national (Form C details completed). Needs visa copy verify.",
        isGroup: true,
        groupName: "Inbound International Tour",
        billingItems: {
          create: [
            { name: "Room Tariff - 3 Nights", amount: 15000, category: "room", invoiceGroup: "A" },
            { name: "Private Airport Shuttle Transfer", amount: 2500, category: "service", invoiceGroup: "A" },
          ],
        },
      },
    });

    await prisma.reservation.create({
      data: {
        guestName: "⚠️ AC Servicing & Polish",
        roomId: goa.rooms[2].id, // Room 103
        startIndex: 6,
        duration: 2,
        status: "maintenance",
        details: "Air conditioning coolant recharge and wooden balcony treatment.",
      },
    });

    await prisma.reservation.create({
      data: {
        guestName: "Devendra Pal",
        roomId: goa.rooms[3].id, // Room 104
        startIndex: 5,
        duration: 5,
        status: "pending",
        details: "Individual booking. Late arrival expected.",
        isGroup: false,
        billingItems: {
          create: [
            { name: "Room Tariff - 5 Nights", amount: 22500, category: "room", invoiceGroup: "A" },
            { name: "Gourmet Room Service Lunch", amount: 1800, category: "service", invoiceGroup: "A" },
          ],
        },
      },
    });

    // 3. Seed Manali Alpine Chalet
    const manali = await prisma.property.create({
      data: {
        name: "Manali Alpine Chalet",
        type: "resort",
        location: "Manali, Himachal Pradesh",
        rooms: {
          create: [
            { number: "201", name: "Pine Retreat", type: "Deluxe Room" },
            { number: "202", name: "Cedar Attic", type: "Attic Loft" },
            { number: "203", name: "Summit View", type: "Luxury Suite" },
            { number: "204", name: "Riverside Cabin", type: "Wood Cabin" },
            { number: "205", name: "Oak Den", type: "Standard Room" },
          ],
        },
      },
      include: { rooms: true },
    });

    // Seed Manali reservations
    await prisma.reservation.create({
      data: {
        guestName: "Meera Sen",
        roomId: manali.rooms[0].id, // Room 201
        startIndex: 0,
        duration: 3,
        status: "checked-in",
        details: "Solo travel blogger. High priority room request.",
        billingItems: {
          create: [
            { name: "Room Tariff - 3 Nights", amount: 18000, category: "room", invoiceGroup: "A" },
            { name: "Guided Trekking Tour (Solang Valley)", amount: 4500, category: "amenity", invoiceGroup: "A" },
          ],
        },
      },
    });

    await prisma.reservation.create({
      data: {
        guestName: "Vikram Malhotra",
        roomId: manali.rooms[2].id, // Room 203
        startIndex: 3,
        duration: 6,
        status: "confirmed",
        details: "Corporate executive retreat booking.",
        isGroup: true,
        groupName: "Corporate Retreat Malhotras",
        billingItems: {
          create: [
            { name: "Room Tariff - 6 Nights", amount: 57000, category: "room", invoiceGroup: "A" },
            { name: "Swedish Full Body Massage (Spa)", amount: 4000, category: "amenity", invoiceGroup: "A" },
          ],
        },
      },
    });

    await prisma.reservation.create({
      data: {
        guestName: "Nikhil Nair",
        roomId: manali.rooms[4].id, // Room 205
        startIndex: 2,
        duration: 4,
        status: "pending",
        details: "Family vacation. Requested extra bedding.",
        billingItems: {
          create: [
            { name: "Room Tariff - 4 Nights", amount: 16000, category: "room", invoiceGroup: "A" },
            { name: "Special Himachali Dinner Feast", amount: 1500, category: "service", invoiceGroup: "A" },
          ],
        },
      },
    });

    // 4. Seed Delhi Business Suite
    const delhi = await prisma.property.create({
      data: {
        name: "Delhi Business Suite",
        type: "hotel",
        location: "Connaught Place, New Delhi",
        rooms: {
          create: [
            { number: "301", name: "Executive Club A", type: "Business Suite" },
            { number: "302", name: "Executive Club B", type: "Business Suite" },
            { number: "303", name: "Corporate Deluxe A", type: "Standard Room" },
            { number: "304", name: "Corporate Deluxe B", type: "Standard Room" },
            { number: "305", name: "Hotdesk Space A", type: "Co-working Desk" },
            { number: "306", name: "Hotdesk Space B", type: "Co-working Desk" },
            { number: "307", name: "Hotdesk Space C", type: "Co-working Desk" },
            { number: "308", name: "Capsule Pod A", type: "Transit Pod" },
            { number: "309", name: "Capsule Pod B", type: "Transit Pod" },
            { number: "310", name: "Board Meeting Suite", type: "Shared Conference" },
          ],
        },
      },
      include: { rooms: true },
    });

    // Seed Delhi reservations
    await prisma.reservation.create({
      data: {
        guestName: "Sanjay Singhal",
        roomId: delhi.rooms[0].id, // Room 301
        startIndex: 1,
        duration: 5,
        status: "checked-in",
        details: "Regular business traveller. Corporate contract rate applied.",
        billingItems: {
          create: [
            { name: "Room Tariff - 5 Nights", amount: 60000, category: "room", invoiceGroup: "A" },
            { name: "Executive Lounge In-dining", amount: 6200, category: "service", invoiceGroup: "A" },
            { name: "Luxury Sedan Airport Pick", amount: 7500, category: "service", invoiceGroup: "A" },
          ],
        },
      },
    });

    await prisma.reservation.create({
      data: {
        guestName: "TechCorp India Group",
        roomId: delhi.rooms[2].id, // Room 303
        startIndex: 3,
        duration: 4,
        status: "confirmed",
        details: "Corporate block booking. Split invoicing required across ledger.",
        isGroup: true,
        groupName: "TechCorp Annual Meet",
        billingItems: {
          create: [
            { name: "Room Tariff - 4 Nights", amount: 28800, category: "room", invoiceGroup: "A" },
            { name: "Shared Meeting Room Rental", amount: 4000, category: "amenity", invoiceGroup: "A" },
          ],
        },
      },
    });

    await prisma.reservation.create({
      data: {
        guestName: "Ananya Das",
        roomId: delhi.rooms[4].id, // Room 305
        startIndex: 2,
        duration: 8,
        status: "checked-in",
        details: "Hourly/Transit co-working usage.",
        billingItems: {
          create: [
            { name: "Co-working Space Fee", amount: 6400, category: "room", invoiceGroup: "A" },
            { name: "Cafeteria Beverage Ledger", amount: 900, category: "service", invoiceGroup: "A" },
          ],
        },
      },
    });

    await prisma.reservation.create({
      data: {
        guestName: "Amit Shah",
        roomId: delhi.rooms[7].id, // Room 308
        startIndex: 0,
        duration: 6,
        status: "checked-in",
        details: "Short stay transit capsule user.",
        billingItems: {
          create: [
            { name: "Capsule Pod Booking - 6 Units", amount: 7200, category: "room", invoiceGroup: "A" },
          ],
        },
      },
    });

    await prisma.reservation.create({
      data: {
        guestName: "⚠️ Plumbing Maintenance",
        roomId: delhi.rooms[3].id, // Room 304
        startIndex: 4,
        duration: 3,
        status: "maintenance",
        details: "Bathroom drain servicing and wallpaper alignment.",
      },
    });

    return NextResponse.json({
      success: true,
      message: "MySQL Database successfully cleared and seeded with clean mock structures!",
    });
  } catch (error: any) {
    console.error("Database Seeding Failed:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to seed local MySQL database tables.",
      },
      { status: 500 }
    );
  }
}
