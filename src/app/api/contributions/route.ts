import { NextRequest, NextResponse } from "next/server";
import { listContributionDirectory } from "@/actions/contributions-action";

// GET /api/contributions - list directory rows (EE totals per employee)
export async function GET(_req: NextRequest) {
  const result = await listContributionDirectory();
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }
  return NextResponse.json({ data: result.data });
}
