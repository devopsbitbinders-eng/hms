import { NextResponse } from "next/server";
import prisma from "@/lib/db";

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { itemIds, invoiceGroup } = body;

    if (!itemIds || !Array.isArray(itemIds) || !invoiceGroup) {
      return NextResponse.json(
        { success: false, error: "Missing required fields: itemIds (array), invoiceGroup ('A' or 'B')" },
        { status: 400 }
      );
    }

    if (invoiceGroup !== "A" && invoiceGroup !== "B") {
      return NextResponse.json(
        { success: false, error: "invoiceGroup must be either 'A' or 'B'" },
        { status: 400 }
      );
    }

    // Batch update the billing items' invoice groups in the database
    const updateResult = await prisma.billingItem.updateMany({
      where: {
        id: {
          in: itemIds,
        },
      },
      data: {
        invoiceGroup,
      },
    });

    return NextResponse.json({
      success: true,
      count: updateResult.count,
      message: `Successfully shifted ${updateResult.count} item(s) to Invoice Group ${invoiceGroup}`,
    });
  } catch (error: any) {
    console.error("Failed to split billing items:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to split billing items" },
      { status: 500 }
    );
  }
}
