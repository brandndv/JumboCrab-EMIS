import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import {
  EmployeeLite,
  OverrideRow,
  ShiftLite,
  formatDateDisplay,
  formatRangeLabel,
  formatMinutes,
} from "@/types/schedule-types";
import { DateRange } from "react-day-picker";
import { CalendarClock, Pencil, Trash2 } from "lucide-react";
import { TZ } from "@/lib/timezone";

type OverridesSectionProps = {
  showOverrideForm: boolean;
  showOverrideTables: boolean;
  employees: EmployeeLite[];
  shifts: ShiftLite[];
  overrideEmployeeId: string;
  overrideShiftId: string;
  overrideDate: string;
  overrideEndDate: string | null;
  overrideIsRange: boolean;
  overrideError: string | null;
  overrideSaving: boolean;
  overrideDaysCount: number;
  selectedRange: DateRange;
  overridesForDay: OverrideRow[];
  upcomingOverrides: OverrideRow[];
  onRefresh: () => void;
  overridePickerOpen: boolean;
  onOverridePickerOpenChange: (open: boolean) => void;
  overrideEditOpen: boolean;
  onOverrideEditOpenChange: (open: boolean) => void;
  editingOverride: OverrideRow | null;
  onOverrideEmployeeChange: (value: string) => void;
  onOverrideShiftChange: (value: string) => void;
  onRangeSelect: (range: DateRange | undefined) => void;
  onClearSelection: () => void;
  onOpenCalendar: () => void;
  onSaveOverride: () => Promise<boolean> | void;
  onOverrideDateChange: (value: string) => void;
  onStartEditOverride: (row: OverrideRow) => void;
  onDeleteOverride: (id: string) => Promise<void>;
};

const formatShiftSummary = (shift: ShiftLite | null | undefined) =>
  shift
    ? `${shift.name} (${formatMinutes(shift.startMinutes)}-${formatMinutes(
        shift.endMinutes
      )})`
    : "Rest day";

export function OverridesSection({
  showOverrideForm,
  showOverrideTables,
  employees,
  shifts,
  overrideEmployeeId,
  overrideShiftId,
  overrideDate,
  overrideEndDate,
  overrideIsRange,
  overrideError,
  overrideSaving,
  overrideDaysCount,
  selectedRange,
  overridesForDay,
  upcomingOverrides,
  onRefresh,
  overridePickerOpen,
  onOverridePickerOpenChange,
  overrideEditOpen,
  onOverrideEditOpenChange,
  editingOverride,
  onOverrideEmployeeChange,
  onOverrideShiftChange,
  onRangeSelect,
  onClearSelection,
  onOpenCalendar,
  onSaveOverride,
  onOverrideDateChange,
  onStartEditOverride,
  onDeleteOverride,
}: OverridesSectionProps) {
  return (
    <>
      {showOverrideForm && (
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Set Override</CardTitle>
            <p className="text-sm text-muted-foreground">
              Apply a shift or rest day to one date or a range of dates.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="space-y-2">
                <label className="text-sm font-medium">Employee</label>
                <select
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                  value={overrideEmployeeId}
                  onChange={(e) => onOverrideEmployeeChange(e.target.value)}
                >
                  <option value="">Select employee</option>
                  {employees.map((emp) => (
                    <option key={emp.employeeId} value={emp.employeeId}>
                      {emp.firstName} {emp.lastName} ({emp.employeeCode})
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Shift</label>
                <select
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                  value={overrideShiftId}
                  onChange={(e) => onOverrideShiftChange(e.target.value)}
                >
                  <option value="">Rest day (no shift)</option>
                  {shifts.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({formatMinutes(s.startMinutes)} -{" "}
                      {formatMinutes(s.endMinutes)})
                    </option>
                  ))}
                </select>
              </div>
              <div className="rounded-md border border-border bg-muted/30 p-3 text-sm flex flex-col gap-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-medium">Selected dates</p>
                    <p className="text-muted-foreground">
                      {formatRangeLabel(selectedRange)}{" "}
                      {overrideIsRange && overrideEndDate
                        ? `• ${overrideDaysCount} day${
                            overrideDaysCount !== 1 ? "s" : ""
                          }`
                        : "• single day"}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={onClearSelection}
                    >
                      Clear
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={onOpenCalendar}
                    >
                      Open calendar
                    </Button>
                  </div>
                </div>
              </div>
            </div>
            {overrideError && (
              <p className="text-sm text-destructive">{overrideError}</p>
            )}
            <div className="flex justify-end">
              <Button
                onClick={() => onSaveOverride()}
                disabled={overrideSaving}
                className="gap-2"
              >
                <CalendarClock className="h-4 w-4" />
                {overrideSaving ? "Saving..." : "Save override"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {showOverrideTables && (
        <Card className="shadow-sm">
          <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-lg">Overrides</CardTitle>
              <p className="text-sm text-muted-foreground">
                Current day overrides and upcoming ones.
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onRefresh}
              className="gap-2"
            >
              Refresh
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <p className="text-sm font-medium">Overrides for selected date</p>
              {overridesForDay.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No overrides for this date.
                </p>
              ) : (
                <div className="overflow-x-auto rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[24%] text-left">
                          Employee
                        </TableHead>
                        <TableHead className="w-[18%] text-left">
                          Date
                        </TableHead>
                        <TableHead className="w-[26%] text-left">
                          Shift
                        </TableHead>
                        <TableHead className="w-[16%] text-left">
                          Source
                        </TableHead>
                        <TableHead className="w-[16%] text-right">
                          Actions
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {overridesForDay.map((o) => (
                        <TableRow key={o.id}>
                          <TableCell className="w-[24%]">
                            <div className="flex flex-col">
                              <span className="font-medium">
                                {o.employee.firstName} {o.employee.lastName}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {o.employee.employeeCode} ·{" "}
                                {o.employee.department?.name || "—"}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="w-[18%] text-sm text-muted-foreground">
                            {formatDateDisplay(o.workDate)}
                          </TableCell>
                          <TableCell className="w-[26%] text-sm text-muted-foreground">
                            {formatShiftSummary(o.shift)}
                          </TableCell>
                          <TableCell className="w-[16%] text-sm text-muted-foreground">
                            <Badge variant="outline">{o.source}</Badge>
                          </TableCell>
                          <TableCell className="w-[16%] text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="gap-2"
                                onClick={() => onStartEditOverride(o)}
                              >
                                <Pencil className="h-4 w-4" /> Edit
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="gap-2 text-destructive"
                                onClick={() => onDeleteOverride(o.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                                Delete
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">Upcoming overrides</p>
              {upcomingOverrides.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No upcoming overrides.
                </p>
              ) : (
                <div className="overflow-x-auto rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[24%] text-left">
                          Employee
                        </TableHead>
                        <TableHead className="w-[18%] text-left">
                          Date
                        </TableHead>
                        <TableHead className="w-[26%] text-left">
                          Shift
                        </TableHead>
                        <TableHead className="w-[16%] text-left">
                          Source
                        </TableHead>
                        <TableHead className="w-[16%] text-right">
                          Actions
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {upcomingOverrides.map((o) => (
                        <TableRow key={o.id}>
                          <TableCell className="w-[24%]">
                            <div className="flex flex-col">
                              <span className="font-medium">
                                {o.employee.firstName} {o.employee.lastName}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {o.employee.employeeCode}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="w-[18%] text-sm text-muted-foreground">
                            {formatDateDisplay(o.workDate)}
                          </TableCell>
                          <TableCell className="w-[26%] text-sm text-muted-foreground">
                            {formatShiftSummary(o.shift)}
                          </TableCell>
                          <TableCell className="w-[16%] text-sm text-muted-foreground">
                            <Badge variant="outline">{o.source}</Badge>
                          </TableCell>
                          <TableCell className="w-[16%] text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="gap-2"
                                onClick={() => onStartEditOverride(o)}
                              >
                                <Pencil className="h-4 w-4" /> Edit
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="gap-2 text-destructive"
                                onClick={() => onDeleteOverride(o.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                                Delete
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog
        open={overridePickerOpen}
        onOpenChange={(open) => onOverridePickerOpenChange(open)}
      >
        <DialogContent className="w-[98vw] max-w-5xl max-h-[90vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle>Pick override dates</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 max-h-[75vh] overflow-y-auto">
            <Calendar
              className="mx-auto w-full max-w-[1040px] md:min-w-[880px] rounded-2xl border bg-card shadow-sm p-4 sm:p-5 [--cell-size:2.3rem] sm:[--cell-size:2.4rem]"
              mode="range"
              numberOfMonths={2}
              showOutsideDays
              selected={selectedRange}
              onSelect={onRangeSelect}
              initialFocus
            />
            <div className="flex flex-wrap items-center justify-between text-sm text-muted-foreground">
              <span>
                {selectedRange.from
                  ? selectedRange.from.toLocaleDateString("en-US", {
                      timeZone: TZ,
                    })
                  : "Start"}{" "}
                →{" "}
                {selectedRange.to
                  ? selectedRange.to.toLocaleDateString("en-US", {
                      timeZone: TZ,
                    })
                  : "End"}
              </span>
              <span>
                {overrideIsRange && overrideEndDate
                  ? `${overrideDaysCount} day${
                      overrideDaysCount !== 1 ? "s" : ""
                    }`
                  : "Single day"}
              </span>
            </div>
          </div>
          <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-between sm:items-center">
            <Button variant="ghost" onClick={onClearSelection}>
              Clear selection
            </Button>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                onClick={() => onOverridePickerOpenChange(false)}
              >
                Done
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={overrideEditOpen}
        onOpenChange={(open) => onOverrideEditOpenChange(open)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit override</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="text-sm">
              <p className="font-medium">
                {editingOverride?.employee.firstName}{" "}
                {editingOverride?.employee.lastName}
              </p>
              <p className="text-xs text-muted-foreground">
                {editingOverride?.employee.employeeCode}
              </p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Date</label>
              <Input
                type="date"
                value={overrideDate}
                onChange={(e) => onOverrideDateChange(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Shift</label>
              <select
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                value={overrideShiftId}
                onChange={(e) => onOverrideShiftChange(e.target.value)}
              >
                <option value="">Rest day (no shift)</option>
                {shifts.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({formatMinutes(s.startMinutes)} -{" "}
                    {formatMinutes(s.endMinutes)})
                  </option>
                ))}
              </select>
            </div>
            {overrideError && (
              <p className="text-sm text-destructive">{overrideError}</p>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="ghost"
              onClick={() => onOverrideEditOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={async () => {
                const ok = await onSaveOverride();
                if (ok) onOverrideEditOpenChange(false);
              }}
              disabled={overrideSaving}
              className="gap-2"
            >
              <CalendarClock className="h-4 w-4" />
              {overrideSaving ? "Saving..." : "Update override"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
