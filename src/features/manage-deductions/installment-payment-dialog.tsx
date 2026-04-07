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
  runtimeStatusLabel,
  frequencyLabel,
  describeAssignmentValue,
} from "@/features/manage-deductions/deduction-ui-helpers";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/toast-provider";
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
import {
  DeductionFrequency,
  EmployeeDeductionAssignmentStatus,
} from "@prisma/client";

type InstallmentPaymentDialogProps = {
  row: DeductionAssignmentRow;
  onRecorded: (row: DeductionAssignmentRow) => void;
};

const today = () => new Date().toISOString().slice(0, 10);

export function DeductionPaymentDialog({
  row,
  onRecorded,
}: InstallmentPaymentDialogProps) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(today());
  const [remarks, setRemarks] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const metrics = useMemo(() => getInstallmentMetrics(row), [row]);
  const isInstallment = row.frequency === DeductionFrequency.INSTALLMENT;
  const isOneTime = row.frequency === DeductionFrequency.ONE_TIME;
  const isTerminalStatus =
    row.status === EmployeeDeductionAssignmentStatus.COMPLETED ||
    row.status === EmployeeDeductionAssignmentStatus.CANCELLED;
  const fixedAmount = useMemo(() => {
    if (row.amountMode !== "FIXED") return null;
    const configured = row.amountOverride ?? row.defaultAmount ?? null;
    return typeof configured === "number" && configured > 0 ? configured : null;
  }, [row.amountMode, row.amountOverride, row.defaultAmount]);
  const suggestedAmount = useMemo(() => {
    if (isInstallment) {
      if (metrics.balance <= 0) return "";
      if (metrics.perPayroll > 0) {
        return String(Math.min(metrics.balance, metrics.perPayroll));
      }
      return String(metrics.balance);
    }

    if (fixedAmount != null) {
      return String(fixedAmount);
    }

    return "";
  }, [fixedAmount, isInstallment, metrics.balance, metrics.perPayroll]);
  const canRecordPayment =
    !isTerminalStatus && (!isInstallment || metrics.balance > 0);
  const dialogTitle = isInstallment
    ? "Record Deduction Payment"
    : isOneTime
      ? "Record One-Time Settlement"
      : "Record Deduction Payment";
  const dialogDescription = isInstallment
    ? "Apply a manual payment before the next payroll release. This reduces the remaining balance immediately."
    : isOneTime
      ? "Record a manual settlement outside payroll. Saving this payment marks the one-time deduction as completed."
      : "Log a manual payment outside payroll. Recurring deductions stay active until you pause or complete the assignment.";
  const balanceHeading = isInstallment
    ? "Current balance"
    : isOneTime
      ? "Settlement"
      : "Assignment status";
  const balanceValue = isInstallment
    ? formatMoney(metrics.balance)
    : isOneTime
      ? row.status === EmployeeDeductionAssignmentStatus.COMPLETED
        ? "Settled"
        : "Pending settlement"
      : runtimeStatusLabel(row.status);
  const scheduleHeading = isInstallment ? "Scheduled amount" : "Configured value";
  const scheduleValue = isInstallment
    ? formatMoney(metrics.perPayroll || metrics.balance)
    : describeAssignmentValue(row);

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
      toast.success("Payment recorded successfully.", {
        description: `${row.deductionName} has been updated with the new payment.`,
      });
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
          disabled={!canRecordPayment}
        >
          Record Payment
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
          <DialogDescription>{dialogDescription}</DialogDescription>
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
              {balanceHeading}
            </p>
            <p className="mt-2 text-sm font-medium">{balanceValue}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
              {scheduleHeading}
            </p>
            <p className="mt-2 text-sm font-medium">{scheduleValue}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {frequencyLabel(row.frequency)}
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
              max={isInstallment ? metrics.balance : undefined}
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
          <div className="space-y-1 text-xs text-muted-foreground">
            <p>
              Last payment: {formatMoney(row.payments[0].amount)} on{" "}
              {formatDate(row.payments[0].paymentDate)}
            </p>
            <p>
              {row.payments.length} payment record
              {row.payments.length === 1 ? "" : "s"} logged so far.
            </p>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            No manual payments recorded yet.
          </p>
        )}

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
            {submitting ? (
              <span className="inline-flex items-center gap-2">
                <Spinner className="h-4 w-4" />
                Saving...
              </span>
            ) : (
              "Record Payment"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export { DeductionPaymentDialog as InstallmentPaymentDialog };
