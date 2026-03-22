import type { DeductionAssignmentRow } from "@/actions/deductions/deductions-action";
import { getDeductionProgressMeta } from "@/components/dasboard/manage-deductions/deduction-ui-helpers";
import { cn } from "@/lib/utils";

type DeductionProgressProps = {
  row: DeductionAssignmentRow;
  compact?: boolean;
};

export function DeductionProgress({ row, compact = false }: DeductionProgressProps) {
  const meta = getDeductionProgressMeta(row);

  return (
    <div className={cn("space-y-2", compact ? "min-w-48" : "")}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
          {meta.title}
        </p>
        <p className="text-xs font-medium text-foreground">{meta.label}</p>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full transition-all", meta.barClass)}
          style={{ width: `${meta.percent}%` }}
        />
      </div>
      <p className="text-xs text-muted-foreground">{meta.detail}</p>
    </div>
  );
}
