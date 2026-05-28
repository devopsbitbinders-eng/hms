import { NextResponse } from "next/server";
import prisma from "@/lib/db";

// Helper to seed base channels for a property if they don't exist
async function ensureChannelsSeeded(propertyId: string) {
  const count = await prisma.channel.count({
    where: { propertyId }
  });

  if (count === 0) {
    const defaultChannels = [
      { name: "Booking.com", status: "inactive", markupType: "percentage", markupValue: 0.0, connected: false, propertyId },
      { name: "Airbnb", status: "inactive", markupType: "percentage", markupValue: 0.0, connected: false, propertyId },
      { name: "Agoda", status: "inactive", markupType: "percentage", markupValue: 0.0, connected: false, propertyId },
      { name: "Expedia", status: "inactive", markupType: "percentage", markupValue: 0.0, connected: false, propertyId },
    ];

    await prisma.channel.createMany({
      data: defaultChannels
    });

    await prisma.channelLog.create({
      data: {
        channelName: "System",
        type: "system_init",
        status: "success",
        message: "Successfully initialized and mapped seed OTA nodes for the active property branch.",
        propertyId
      }
    });
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const propertyId = searchParams.get("propertyId");

    if (!propertyId) {
      return NextResponse.json(
        { success: false, error: "Missing required propertyId parameter" },
        { status: 400 }
      );
    }

    await ensureChannelsSeeded(propertyId);

    const channels = await prisma.channel.findMany({
      where: { propertyId },
      orderBy: { name: "asc" }
    });

    return NextResponse.json({ success: true, channels });
  } catch (error: any) {
    console.error("GET /api/channels error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch channels" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { channelId, action, propertyId, markupType, markupValue, listingId, apiKey } = body;

    if (!propertyId) {
      return NextResponse.json(
        { success: false, error: "Missing propertyId in request body" },
        { status: 400 }
      );
    }

    if (!channelId) {
      if (action === "register_custom") {
        const { name, syncType, externalIcalUrl } = body;
        if (!name) {
          return NextResponse.json(
            { success: false, error: "Missing channel name for custom OTA registration" },
            { status: 400 }
          );
        }

        const newChannel = await prisma.channel.create({
          data: {
            name,
            syncType: syncType || "ical",
            externalIcalUrl: externalIcalUrl || null,
            isCustom: true,
            connected: true,
            status: "active",
            propertyId,
            markupType: "percentage",
            markupValue: 0.0
          }
        });

        const localIcalUrl = `/api/channels/ical-export?channelId=${newChannel.id}&propertyId=${propertyId}`;
        const updatedChannel = await prisma.channel.update({
          where: { id: newChannel.id },
          data: { localIcalUrl }
        });

        await prisma.channelLog.create({
          data: {
            channelName: name,
            type: "custom_registered",
            status: "success",
            message: `Registered new custom sales channel "${name}" successfully. Dynamic 2-way iCal export link compiled.`,
            propertyId
          }
        });

        return NextResponse.json({ success: true, channel: updatedChannel });
      }

      return NextResponse.json(
        { success: false, error: "Missing channelId in request body" },
        { status: 400 }
      );
    }

    if (action === "delete_custom") {
      const deletedChannel = await prisma.channel.delete({
        where: { id: channelId }
      });

      await prisma.channelLog.create({
        data: {
          channelName: deletedChannel.name,
          type: "custom_deleted",
          status: "warning",
          message: `Removed custom sales channel "${deletedChannel.name}" mapping persistently from this property branch.`,
          propertyId
        }
      });

      return NextResponse.json({ success: true, message: "Channel deleted successfully" });
    }

    const channel = await prisma.channel.findUnique({
      where: { id: channelId }
    });

    if (!channel) {
      return NextResponse.json(
        { success: false, error: "Channel not found" },
        { status: 404 }
      );
    }

    let updatedChannel;

    if (action === "toggle") {
      const targetConnectedState = !channel.connected;
      const targetStatus = targetConnectedState ? "active" : "inactive";

      updatedChannel = await prisma.channel.update({
        where: { id: channelId },
        data: {
          connected: targetConnectedState,
          status: targetStatus,
          lastSynced: targetConnectedState ? new Date() : null,
          listingId: targetConnectedState ? channel.listingId : null,
          apiKey: targetConnectedState ? channel.apiKey : null
        }
      });

      // Record logs
      await prisma.channelLog.create({
        data: {
          channelName: channel.name,
          type: "connection_toggle",
          status: "success",
          message: targetConnectedState
            ? `Successfully connected & mapped to ${channel.name} integration. Real-time rate and inventory pushing activated.`
            : `Disconnected AetherHMS mapping sync from ${channel.name}. Direct pricing parity bypass locked.`,
          propertyId
        }
      });
    } else if (action === "save_credentials") {
      updatedChannel = await prisma.channel.update({
        where: { id: channelId },
        data: {
          listingId,
          apiKey,
          connected: true,
          status: "active",
          lastSynced: new Date()
        }
      });

      await prisma.channelLog.create({
        data: {
          channelName: channel.name,
          type: "credentials_update",
          status: "success",
          message: `Linked and authenticated channel coordinates. Mapped OTA Listing/Hotel ID: "${listingId}" successfully!`,
          propertyId
        }
      });
    } else if (action === "update_markup") {
      updatedChannel = await prisma.channel.update({
        where: { id: channelId },
        data: {
          markupType: markupType || "percentage",
          markupValue: parseFloat(markupValue || 0.0),
          lastSynced: new Date()
        }
      });

      await prisma.channelLog.create({
        data: {
          channelName: channel.name,
          type: "rate_sync",
          status: "success",
          message: `Configured new Rate Parity Pricing Strategy: ${markupType === "percentage" ? `+${markupValue}%` : `+${markupValue} INR`} adjustment applied across connected slots.`,
          propertyId
        }
      });
    } else if (action === "log_inventory_push") {
      const { message, status } = body;
      updatedChannel = await prisma.channel.update({
        where: { id: channelId },
        data: {
          lastSynced: new Date()
        }
      });

      await prisma.channelLog.create({
        data: {
          channelName: channel.name,
          type: "inventory_sync",
          status: status || "success",
          message: message || "Successfully pushed inventory update.",
          propertyId
        }
      });
    }

    return NextResponse.json({ success: true, channel: updatedChannel });
  } catch (error: any) {
    console.error("POST /api/channels error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to update channel" },
      { status: 500 }
    );
  }
}
