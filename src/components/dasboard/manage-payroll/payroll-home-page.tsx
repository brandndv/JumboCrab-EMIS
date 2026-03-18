"use client";

import Link from "next/link";
import type { ComponentType } from "react";
import { Calculator, ClipboardCheck, History, ReceiptText } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useSession } from "@/hooks/use-session";

type FeatureItem = {
  title: string;
  description: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
};

const roleFeatureMap: Record<string, FeatureItem[]> = {
  admin: [
    {
      title: "Generate Payroll",
      description: "Create payroll runs from attendance, overtime, and deductions.",
      href: "/admin/payroll/generate-payroll",
      icon: Calculator,
    },
    {
      title: "Review Payroll",
      description: "Approve, reject, and release runs based on workflow stage.",
      href: "/admin/payroll/review-payroll",
      icon: ClipboardCheck,
    },
    {
      title: "Payroll History",
      description: "Track all payroll runs and inspect run details.",
      href: "/admin/payroll/payroll-history",
      icon: History,
    },
    {
      title: "Payslips",
      description: "Inspect employee payslip records and line-item breakdown.",
      href: "/admin/payroll/payslips",
      icon: ReceiptText,
    },
  ],
  clerk: [
    {
      title: "Generate Payroll",
      description: "Prepare draft payroll runs for review.",
      href: "/clerk/payroll/generate-payroll",
      icon: Calculator,
    },
    {
      title: "Payroll History",
      description: "See generated runs and status updates from reviewers.",
      href: "/clerk/payroll/payroll-history",
      icon: History,
    },
  ],
  manager: [
    {
      title: "Review Payroll",
      description: "Approve or reject payroll runs with remarks.",
      href: "/manager/payroll/review-payroll",
      icon: ClipboardCheck,
    },
    {
      title: "Payroll History",
      description: "Inspect completed and released payroll runs.",
      href: "/manager/payroll/payroll-history",
      icon: History,
    },
  ],
  generalManager: [
    {
      title: "Review Payroll",
      description: "Final approval and release control for payroll runs.",
      href: "/generalManager/payroll/review-payroll",
      icon: ClipboardCheck,
    },
    {
      title: "Payroll History",
      description: "Audit payroll output and review remarks history.",
      href: "/generalManager/payroll/payroll-history",
      icon: History,
    },
  ],
  employee: [
    {
      title: "My Payslips",
      description: "View released payslips and detailed earning/deduction lines.",
      href: "/employee/payslip",
      icon: ReceiptText,
    },
  ],
};

const PayrollHomePage = () => {
  const { user, loading, error } = useSession();

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Failed to load session</div>;
  if (!user) return <div>No session</div>;

  const roleKey = user.role ?? "employee";
  const features = roleFeatureMap[roleKey] ?? [];

  return (
    <div className="space-y-6 px-4 py-8 sm:px-8 lg:px-12">
      <div>
        <h1 className="text-2xl font-semibold">Payroll</h1>
        <p className="text-sm text-muted-foreground">
          Attendance-based payroll generation with review and release workflow.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {features.map((feature) => (
          <Link key={feature.href} href={feature.href} className="block">
            <Card className="h-full border-border/70 bg-card/80 shadow-sm transition hover:border-primary/40 hover:shadow-md">
              <CardHeader>
                <CardTitle className="inline-flex items-center gap-2 text-base">
                  <feature.icon className="h-4 w-4 text-primary" />
                  {feature.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  {feature.description}
                </p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
};

export default PayrollHomePage;
