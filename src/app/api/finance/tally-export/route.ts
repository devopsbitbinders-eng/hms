import { NextResponse } from "next/server";
import prisma from "@/lib/db";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const propertyId = searchParams.get("propertyId");
    const start = searchParams.get("start"); // YYYY-MM-DD
    const end = searchParams.get("end");

    if (!propertyId || !start || !end) {
      return NextResponse.json({ error: "Missing parameters" }, { status: 400 });
    }

    // In a real production system, we'd query by date fields, but our Reservation schema
    // currently relies on startIndex. For simplicity in this engine, we'll fetch all
    // reservations for the property and generate dummy vouchers for completed/confirmed ones.
    const rooms = await prisma.room.findMany({
      where: { propertyId },
      include: {
        reservations: {
          include: { billingItems: true }
        }
      }
    });

    let tallyXml = `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Import Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>Vouchers</REPORTNAME>
      </REQUESTDESC>
      <REQUESTDATA>\n`;

    rooms.forEach(room => {
      room.reservations.forEach(res => {
        if (res.status === "cancelled" || res.status === "maintenance") return;

        const roomCharge = res.billingItems
          .filter(b => b.category === "room")
          .reduce((sum, b) => sum + b.amount, 0);

        if (roomCharge <= 0) return;

        // GST Calculation
        const rate = roomCharge > 7500 ? 0.18 : 0.12;
        const gstAmount = roomCharge * rate;
        
        // Randomly assign to IGST or CGST/SGST for demonstration
        const isInterstate = Math.random() > 0.5;

        // Tally formatting expects negative amounts for credit ledgers (Sales, Tax)
        // and positive for debit ledgers (Party/Cash)
        const totalAmount = roomCharge + gstAmount;

        tallyXml += `        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <VOUCHER VCHTYPE="Sales" ACTION="Create">
            <DATE>${start.replace(/-/g, "")}</DATE>
            <NARRATION>Room Sales - ${res.guestName} (Room ${room.number})</NARRATION>
            <VOUCHERTYPENAME>Sales</VOUCHERTYPENAME>
            <PARTYLEDGERNAME>Cash/Card Payments</PARTYLEDGERNAME>
            
            <!-- DEBIT: Cash/Bank -->
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>Cash/Card Payments</LEDGERNAME>
              <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
              <AMOUNT>-${totalAmount.toFixed(2)}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>

            <!-- CREDIT: Room Sales -->
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>Local Room Sales Account</LEDGERNAME>
              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
              <AMOUNT>${roomCharge.toFixed(2)}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>\n`;

        if (isInterstate) {
          tallyXml += `            <!-- CREDIT: IGST -->
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>Output IGST @ ${rate * 100}%</LEDGERNAME>
              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
              <AMOUNT>${gstAmount.toFixed(2)}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>\n`;
        } else {
          tallyXml += `            <!-- CREDIT: CGST -->
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>Output CGST @ ${(rate * 100) / 2}%</LEDGERNAME>
              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
              <AMOUNT>${(gstAmount / 2).toFixed(2)}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>
            <!-- CREDIT: SGST -->
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>Output SGST @ ${(rate * 100) / 2}%</LEDGERNAME>
              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
              <AMOUNT>${(gstAmount / 2).toFixed(2)}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>\n`;
        }

        tallyXml += `          </VOUCHER>
        </TALLYMESSAGE>\n`;
      });
    });

    tallyXml += `      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`;

    return new NextResponse(tallyXml, {
      headers: {
        "Content-Type": "application/xml",
        "Content-Disposition": `attachment; filename="tally-sync-${start}-to-${end}.xml"`,
      }
    });

  } catch (error) {
    console.error("Tally export error", error);
    return NextResponse.json({ error: "Failed to generate Tally export" }, { status: 500 });
  }
}
