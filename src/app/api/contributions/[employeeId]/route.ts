import { NextRequest, NextResponse } from "next/server";
import {
  getEmployeeContribution,
  upsertEmployeeContribution,
} from "@/actions/contributions-action";

// GET /api/contributions/:employeeId
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ employeeId: string }> }
) {
  const resolved = await Promise.resolve(params);
  const employeeId = resolved?.employeeId;
  const result = await getEmployeeContribution(employeeId);
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ data: result.data ?? null });
}

// PUT /api/contributions/:employeeId
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ employeeId: string }> }
) {
  const resolved = await Promise.resolve(params);
  const employeeId = resolved?.employeeId;

  try {
    const body = await req.json();
    const result = await upsertEmployeeContribution({
      employeeId: employeeId ?? "",
      sssEe: body.sssEe,
      sssEr: body.sssEr,
      isSssActive: body.isSssActive ?? true,
      philHealthEe: body.philHealthEe,
      philHealthEr: body.philHealthEr,
      isPhilHealthActive: body.isPhilHealthActive ?? true,
      pagIbigEe: body.pagIbigEe,
      pagIbigEr: body.pagIbigEr,
      isPagIbigActive: body.isPagIbigActive ?? true,
      withholdingEe: body.withholdingEe,
      withholdingEr: body.withholdingEr,
      isWithholdingActive: body.isWithholdingActive ?? true,
      effectiveDate: body.effectiveDate,
      actorUserId: body.actorUserId ?? null,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ data: result.data });
  } catch (error) {
    console.error("PUT /api/contributions error:", error);
    return NextResponse.json(
      { error: "Failed to save contribution" },
      { status: 500 }
    );
  }
}
