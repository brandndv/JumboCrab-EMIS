import { NextResponse } from "next/server";
import { generateUniqueEmployeeCode } from "@/lib/employees/employee-code";

export async function GET() {
  try {
    const employeeCode = await generateUniqueEmployeeCode();
    return NextResponse.json({ employeeCode });
  } catch (error) {
    console.error("Failed to generate employee code:", error);
    return NextResponse.json(
      { error: "Failed to generate employee code" },
      { status: 500 }
    );
  }
}
