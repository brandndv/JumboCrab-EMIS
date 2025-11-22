import { NextRequest, NextResponse } from "next/server";
import {
  getGovernmentIdByEmployee,
  upsertGovernmentId,
} from "@/actions/government-ids-action";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ employeeId: string }> }
) {
  const resolvedParams = await Promise.resolve(params);
  const employeeId = resolvedParams?.employeeId;

  if (!employeeId) {
    return NextResponse.json(
      { error: "Employee ID is required" },
      { status: 400 }
    );
  }

  const result = await getGovernmentIdByEmployee(employeeId);

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({ data: result.data ?? null });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ employeeId: string }> }
) {
  try {
    const body = await req.json();
    const resolvedParams = await Promise.resolve(params);
    const employeeId = resolvedParams?.employeeId;

    const result = await upsertGovernmentId({
      employeeId,
      sssNumber: body.sssNumber ?? null,
      philHealthNumber: body.philHealthNumber ?? null,
      tinNumber: body.tinNumber ?? null,
      pagIbigNumber: body.pagIbigNumber ?? null,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ data: result.data });
  } catch (error) {
    console.error("PUT /api/government-ids error:", error);
    return NextResponse.json(
      { error: "Failed to save government IDs" },
      { status: 500 }
    );
  }
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ employeeId: string }> }
) {
  // Allow POST as an alias for PUT to simplify client calls
  return PUT(req, ctx);
}
