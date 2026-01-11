import { NextRequest, NextResponse } from "next/server";
import {
  getEmployeeContribution,
  upsertEmployeeContribution,
} from "@/actions/contributions-action";

// =========================================================
// API ROUTE: GET CONTRIBUTION FOR EMPLOYEE
// =========================================================
// Endpoint: GET /api/contributions/[employeeId]
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ employeeId: string }> }
) {
  // 1. Resolve the route parameters (Next.js 15+ sends params as a Promise)
  const resolved = await Promise.resolve(params);
  const employeeId = resolved?.employeeId;

  // 2. Call the server action to fetch data
  const result = await getEmployeeContribution(employeeId);

  // 3. Handle errors
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  // 4. Return success response
  return NextResponse.json({ data: result.data ?? null });
}

// =========================================================
// API ROUTE: UPDATE CONTRIBUTION FOR EMPLOYEE
// =========================================================
// Endpoint: PUT /api/contributions/[employeeId]
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ employeeId: string }> }
) {
  // 1. Resolve parameters
  const resolved = await Promise.resolve(params);
  const employeeId = resolved?.employeeId;

  try {
    // 2. Parse the request body (sent as JSON from the client)
    const body = await req.json();

    // 3. Call the server action to save data.
    // Note: 'actorUserId' is no longer needed here as it's handled by the session server-side.
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
    });

    // 4. Handle logical errors from the action (e.g., validation failed)
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    // 5. Return success
    return NextResponse.json({ data: result.data });
  } catch (error) {
    console.error("PUT /api/contributions error:", error);
    // 6. Handle unexpected server errors
    return NextResponse.json(
      { error: "Failed to save contribution" },
      { status: 500 }
    );
  }
}
