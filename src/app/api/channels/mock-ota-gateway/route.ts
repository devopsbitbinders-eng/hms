import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get("Authorization");
    const body = await request.json();
    const { channelName, listingId, apiKey, action, roomName, dates, value } = body;

    // Simulate API connection credential checks
    if (!listingId || !apiKey) {
      return NextResponse.json(
        { success: false, error: "401 Unauthorized: Connection handshake failed. Missing OTA Listing ID or API Key mapping." },
        { status: 401 }
      );
    }

    if (authHeader !== `Bearer ${apiKey}`) {
      return NextResponse.json(
        { success: false, error: "403 Forbidden: Invalid API Token or Secret Signature verified by the OTA server." },
        { status: 403 }
      );
    }

    // Simulate standard OTA API response structure
    if (action === "push_inventory") {
      return NextResponse.json({
        success: true,
        channel: channelName,
        transactionId: `TX_${Math.random().toString(36).substring(2, 9).toUpperCase()}`,
        status: "SUCCESS",
        details: `Successfully locked room "${roomName}" across dates [${dates.join(", ")}]. Set OTA inventory allocation = ${value}.`
      });
    }

    if (action === "push_rate") {
      return NextResponse.json({
        success: true,
        channel: channelName,
        transactionId: `TX_${Math.random().toString(36).substring(2, 9).toUpperCase()}`,
        status: "SUCCESS",
        details: `Enforced dynamic price parity rate structure = ${value} INR on "${roomName}" across dates [${dates.join(", ")}].`
      });
    }

    return NextResponse.json(
      { success: false, error: "Invalid Action requested on the Gateway Endpoint" },
      { status: 400 }
    );
  } catch (error: any) {
    console.error("Mock OTA Gateway error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "OTA Gateway server error" },
      { status: 500 }
    );
  }
}
