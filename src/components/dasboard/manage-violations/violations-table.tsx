"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { useViolations } from "@/hooks/use-violations";

const ViolationsTable = () => {
  const { filteredViolations, loading, error } = useViolations();

  const formatAmount = (value?: number | null) => {
    if (typeof value !== "number" || Number.isNaN(value)) return "-";
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatDate = (value: string) => {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString("en-US");
  };

  if (loading) {
    return (
      <div className="rounded-2xl border border-border/70 bg-card/70 p-6 text-sm text-muted-foreground">
        Loading violations...
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-6 text-sm text-destructive">
        {error}
      </div>
    );
  }

  if (!filteredViolations.length) {
    return (
      <div className="rounded-2xl border border-border/70 bg-card/70 p-6 text-sm text-muted-foreground">
        No violations found.
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border/70 bg-card/70 shadow-sm overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Employee</TableHead>
            <TableHead>Code</TableHead>
            <TableHead>Violation</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Amount</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredViolations.map((row) => {
            const amount = row.amount ?? row.installmentAmount;
            return (
              <TableRow key={row.id}>
                <TableCell>{row.employeeName || "Unknown Employee"}</TableCell>
                <TableCell>{row.employeeCode || "-"}</TableCell>
                <TableCell>{row.violationType}</TableCell>
                <TableCell>{formatDate(row.violationDate)}</TableCell>
                <TableCell>{formatAmount(amount)}</TableCell>
                <TableCell>{row.status}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
};

export default ViolationsTable;
