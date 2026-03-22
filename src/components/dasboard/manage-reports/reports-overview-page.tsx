import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  buildRoleReportHref,
  REPORT_DEFINITIONS,
  type RolePath,
} from "./report-ui-helpers";

type ReportsOverviewPageProps = {
  rolePath: RolePath;
};

const reportOrder = [
  "attendance",
  "accounts",
  "employee-information",
  "contributions",
  "deductions",
  "violations",
  "payroll",
] as const;

export default function ReportsOverviewPage({
  rolePath,
}: ReportsOverviewPageProps) {
  return (
    <div className="space-y-6 px-4 py-6 sm:px-6 lg:px-8 xl:px-10">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Manage Reports</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Access read-only company reports for attendance, accounts, employee information,
          contributions, deductions, violations, and payroll.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {reportOrder.map((reportType) => {
          const report = REPORT_DEFINITIONS[reportType];
          return (
            <Link
              key={reportType}
              href={buildRoleReportHref(rolePath, reportType)}
              className="block"
            >
              <Card className="h-full gap-0 transition hover:border-slate-300 hover:shadow-md">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">{report.title}</CardTitle>
                  <CardDescription>{report.description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="rounded-lg border bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
                    {report.blurb}
                  </div>
                  <div className="text-sm font-medium">Open report</div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
