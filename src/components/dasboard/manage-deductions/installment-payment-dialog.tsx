"use client";

import { useEffect, useMemo, useState } from "react";
import {
  recordEmployeeDeductionPayment,
  type DeductionAssignmentRow,
} from "@/actions/deductions/deductions-action";
import {
  formatDate,
  formatMoney,
  getInstallmentMetrics,
} from "@/components/dasboard/manage-deductions/deduction-ui-helpers";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type InstallmentPaymentDialogProps = {
  row: DeductionAssignmentRow;
  onRecorded: (row: DeductionAssignmentRow) => void;
};

const today = () => new Date().toISOString().slice(0, 10);

export function InstallmentPaymentDialog({
  row,
  onRecorded,
}: InstallmentPaymentDialogProps) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(today());
  const [remarks, setRemarks] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const metrics = useMemo(() => getInstallmentMetrics(row), [row]);
  const suggestedAmount = useMemo(() => {
    if (metrics.balance <= 0) return "";
    if (metrics.perPayroll > 0) {
      return String(Math.min(metrics.balance, metrics.perPayroll));
    }
    return String(metrics.balance);
  }, [metrics.balance, metrics.perPayroll]);

  useEffect(() => {
    if (!open) return;
    setAmount(suggestedAmount);
    setPaymentDate(today());
    setRemarks("");
    setError(null);
  }, [open, suggestedAmount]);

  const submit = async () => {
    try {
      setSubmitting(true);
      setError(null);
      const result = await recordEmployeeDeductionPayment({
        id: row.id,
        amount,
        paymentDate,
        remarks,
      });

      if (!result.success || !result.data) {
        throw new Error(result.error || "Failed to record payment");
      }

      onRecorded(result.data);
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to record payment");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          variant="outline"
          disabled={metrics.balance <= 0}
        >
          Record Payment
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Record Installment Payment</DialogTitle>
          <DialogDescription>
            Apply a manual payment to this installment before the next payroll
            release. This reduces the remaining balance immediately.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 rounded-xl border border-border/70 bg-muted/20 p-4 sm:grid-cols-3">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
              Deduction
            </p>
            <p className="mt-2 text-sm font-medium">{row.deductionName}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
              Current balance
            </p>
            <p className="mt-2 text-sm font-medium">{formatMoney(metrics.balance)}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
              Scheduled amount
            </p>
            <p className="mt-2 text-sm font-medium">
              {formatMoney(metrics.perPayroll || metrics.balance)}
            </p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="installment-payment-amount">Payment Amount</Label>
            <Input
              id="installment-payment-amount"
              type="number"
              min="0.01"
              max={metrics.balance}
              step="0.01"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder="Enter payment amount"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="installment-payment-date">Payment Date</Label>
            <Input
              id="installment-payment-date"
              type="date"
              value={paymentDate}
              onChange={(event) => setPaymentDate(event.target.value)}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="installment-payment-remarks">Remarks</Label>
          <textarea
            id="installment-payment-remarks"
            value={remarks}
            onChange={(event) => setRemarks(event.target.value)}
            placeholder="Add a note or payment reference"
            className="min-h-24 w-full rounded-md border bg-background px-3 py-2 text-sm outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          />
        </div>

        {row.payments[0] ? (
          <p className="text-xs text-muted-foreground">
            Last payment: {formatMoney(row.payments[0].amount)} on{" "}
            {formatDate(row.payments[0].paymentDate)}
          </p>
        ) : null}

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
          >
            Cancel
          </Button>
          <Button type="button" onClick={submit} disabled={submitting}>
            {submitting ? "Saving..." : "Record Payment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
