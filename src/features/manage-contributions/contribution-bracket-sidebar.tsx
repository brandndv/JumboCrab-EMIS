"use client";

import {
  type ContributionBracketViewSection,
  type ContributionBracketViewRow,
} from "@/actions/contributions/contributions-action";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type ContributionBracketSidebarProps = {
  sections: ContributionBracketViewSection[];
  loading?: boolean;
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 2,
  }).format(value);

const formatRange = (row: ContributionBracketViewRow) => {
  if (row.upperBound == null) {
    return `${formatCurrency(row.lowerBound)} and above`;
  }

  return `${formatCurrency(row.lowerBound)} to ${formatCurrency(row.upperBound)}`;
};

const formatPercent = (value: number) => `${(value * 100).toFixed(2)}%`;

const formatFixedAmount = (value: number | null) =>
  value == null ? "—" : formatCurrency(value);

const formatRate = (value: number | null) =>
  value == null ? "—" : formatPercent(value);

export function ContributionBracketSidebar({
  sections,
  loading,
}: ContributionBracketSidebarProps) {
  return (
    <div className="space-y-4">
      <Card className="border-border/70 bg-card/70 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Official Bracket Tables</CardTitle>
          <p className="text-sm text-muted-foreground">
            Read-only active brackets currently used by the contribution preview and payroll calculations.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="rounded-xl border border-border/70 bg-background/40 px-3 py-3 text-xs text-muted-foreground">
            Government contributions and tax preview are shown with monthly
            bracket tables only.
          </div>

          {loading ? (
            <div className="rounded-xl border border-border/70 bg-background/40 px-3 py-4 text-sm text-muted-foreground">
              Loading bracket tables...
            </div>
          ) : sections.length === 0 ? (
            <div className="rounded-xl border border-border/70 bg-background/40 px-3 py-4 text-sm text-muted-foreground">
              No active brackets found.
            </div>
          ) : (
            sections.map((section) => (
              <div
                key={section.contributionType}
                className="rounded-xl border border-border/70 bg-background/40"
              >
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 px-4 py-3">
                  <div>
                    <p className="text-sm font-medium">{section.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {section.description}
                    </p>
                  </div>
                  <Badge variant="outline">{section.rows.length} rows</Badge>
                </div>

                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Range</TableHead>
                        <TableHead>EE Fixed</TableHead>
                        <TableHead>EE Rate</TableHead>
                        <TableHead>ER Fixed</TableHead>
                        <TableHead>ER Rate</TableHead>
                        <TableHead>Base Tax</TableHead>
                        <TableHead>Marginal Rate</TableHead>
                        <TableHead>Reference</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {section.rows.map((row) => (
                        <TableRow key={row.id}>
                          <TableCell className="min-w-56 font-medium">
                            {formatRange(row)}
                          </TableCell>
                          <TableCell>{formatFixedAmount(row.employeeFixedAmount)}</TableCell>
                          <TableCell>{formatRate(row.employeeRate)}</TableCell>
                          <TableCell>{formatFixedAmount(row.employerFixedAmount)}</TableCell>
                          <TableCell>{formatRate(row.employerRate)}</TableCell>
                          <TableCell>{formatFixedAmount(row.baseTax)}</TableCell>
                          <TableCell>{formatRate(row.marginalRate)}</TableCell>
                          <TableCell>{row.referenceCode || "—"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default ContributionBracketSidebar;
