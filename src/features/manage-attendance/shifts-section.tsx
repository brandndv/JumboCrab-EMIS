import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ShiftLite, formatMinutes } from "@/types/schedule-types";
import { Check, Pencil, Plus, RefreshCcw, Trash2, X } from "lucide-react";

const parseTimeToMinutes = (value?: string | null) => {
  if (!value) return null;
  const [h, m] = value.split(":").map((v) => Number(v));
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return h * 60 + m;
};

const deriveShiftCalcs = (
  startTime?: string,
  endTime?: string,
  spansMidnight?: boolean,
  breakStartTime?: string,
  breakEndTime?: string
) => {
  const start = parseTimeToMinutes(startTime);
  const end = parseTimeToMinutes(endTime);
  if (start == null || end == null)
    return { breakMinutes: 0, paidHours: 0, totalMinutes: 0 };
  let totalMinutes =
    spansMidnight && end <= start ? end + 24 * 60 - start : end - start;
  if (totalMinutes < 0) totalMinutes = 0;

  const bStart = parseTimeToMinutes(breakStartTime);
  const bEnd = parseTimeToMinutes(breakEndTime);
  let breakMinutes = 0;
  if (bStart != null && bEnd != null) {
    let endVal = bEnd;
    if (spansMidnight && bEnd <= bStart) {
      endVal += 24 * 60;
    }
    breakMinutes = Math.max(0, Math.min(totalMinutes, endVal - bStart));
  }
  const paidHours =
    totalMinutes > 0
      ? Number(((totalMinutes - breakMinutes) / 60).toFixed(2))
      : 0;
  return { breakMinutes, paidHours, totalMinutes };
};

export type ShiftEditState = {
  code: string;
  name: string;
  startTime: string;
  endTime: string;
  spansMidnight: boolean;
  breakStartTime?: string;
  breakEndTime?: string;
  notes: string;
};

type ShiftsSectionProps = {
  showShifts: boolean;
  shifts: ShiftLite[];
  shiftEditId: number | null;
  shiftEdit: ShiftEditState | null;
  shiftEditSaving: boolean;
  shiftEditError: string | null;
  shiftCode: string;
  shiftName: string;
  shiftStart: string;
  shiftEnd: string;
  shiftSpansMidnight: boolean;
  shiftBreakStart?: string;
  shiftBreakEnd?: string;
  shiftNotes: string;
  shiftSaving: boolean;
  shiftError: string | null;
  onRefresh: () => void;
  onStartEdit: (shift: ShiftLite) => void;
  onChangeEdit: (value: ShiftEditState) => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onDeleteShift: (id: number) => Promise<void>;
  onCreateShift: () => void;
  onChangeField: (field: string, value: string | number | boolean) => void;
};

export function ShiftsSection({
  showShifts,
  shifts,
  shiftEditId,
  shiftEdit,
  shiftEditSaving,
  shiftEditError,
  shiftCode,
  shiftName,
  shiftStart,
  shiftEnd,
  shiftSpansMidnight,
  shiftBreakStart,
  shiftBreakEnd,
  shiftNotes,
  shiftSaving,
  shiftError,
  onRefresh,
  onStartEdit,
  onChangeEdit,
  onSaveEdit,
  onCancelEdit,
  onDeleteShift,
  onCreateShift,
  onChangeField,
}: ShiftsSectionProps) {
  if (!showShifts) return null;

  const derivedCreate = deriveShiftCalcs(
    shiftStart,
    shiftEnd,
    shiftSpansMidnight,
    shiftBreakStart,
    shiftBreakEnd
  );

  return (
    <>
      <Card className="shadow-sm">
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-lg">Shifts</CardTitle>
            <p className="text-sm text-muted-foreground">
              Edit existing shifts inline.
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onRefresh}
            className="gap-2"
          >
            <RefreshCcw className="h-4 w-4" /> Refresh
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {shifts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No shifts yet.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead>Break window</TableHead>
                    <TableHead>Break (min)</TableHead>
                    <TableHead>Paid hrs</TableHead>
                    <TableHead>Spans midnight</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {shifts.map((shift) => {
                    const isEditing = shiftEditId === shift.id;
                    const derivedRow =
                      isEditing && shiftEdit
                        ? deriveShiftCalcs(
                            shiftEdit.startTime,
                            shiftEdit.endTime,
                            shiftEdit.spansMidnight,
                            shiftEdit.breakStartTime,
                            shiftEdit.breakEndTime
                          )
                        : null;
                    return (
                      <TableRow key={shift.id}>
                        <TableCell className="text-sm">
                          {isEditing ? (
                            <Input
                              value={shiftEdit?.code ?? ""}
                              onChange={(e) =>
                                shiftEdit &&
                                onChangeEdit({
                                  ...shiftEdit,
                                  code: e.target.value,
                                })
                              }
                            />
                          ) : (
                            shift.code
                          )}
                        </TableCell>
                        <TableCell className="text-sm">
                          {isEditing ? (
                            <Input
                              value={shiftEdit?.name ?? ""}
                              onChange={(e) =>
                                shiftEdit &&
                                onChangeEdit({
                                  ...shiftEdit,
                                  name: e.target.value,
                                })
                              }
                            />
                          ) : (
                            shift.name
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {isEditing ? (
                            <div className="flex gap-2">
                              <Input
                                type="time"
                                value={shiftEdit?.startTime ?? ""}
                                onChange={(e) =>
                                  shiftEdit &&
                                  onChangeEdit({
                                    ...shiftEdit,
                                    startTime: e.target.value,
                                  })
                                }
                              />
                              <Input
                                type="time"
                                value={shiftEdit?.endTime ?? ""}
                                onChange={(e) =>
                                  shiftEdit &&
                                  onChangeEdit({
                                    ...shiftEdit,
                                    endTime: e.target.value,
                                  })
                                }
                              />
                            </div>
                          ) : (
                            `${formatMinutes(
                              shift.startMinutes
                            )} - ${formatMinutes(shift.endMinutes)}`
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {isEditing ? (
                            <div className="flex gap-2">
                              <Input
                                type="time"
                                value={shiftEdit?.breakStartTime ?? ""}
                                onChange={(e) =>
                                  shiftEdit &&
                                  onChangeEdit({
                                    ...shiftEdit,
                                    breakStartTime: e.target.value,
                                  })
                                }
                              />
                              <Input
                                type="time"
                                value={shiftEdit?.breakEndTime ?? ""}
                                onChange={(e) =>
                                  shiftEdit &&
                                  onChangeEdit({
                                    ...shiftEdit,
                                    breakEndTime: e.target.value,
                                  })
                                }
                              />
                            </div>
                          ) : shift.breakStartMinutes != null &&
                            shift.breakEndMinutes != null ? (
                            `${formatMinutes(
                              shift.breakStartMinutes
                            )} - ${formatMinutes(shift.breakEndMinutes)}`
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell className="text-sm">
                          {isEditing
                            ? derivedRow?.breakMinutes ?? 0
                            : shift.breakMinutesUnpaid ?? 0}
                        </TableCell>
                        <TableCell className="text-sm">
                          {isEditing
                            ? derivedRow?.paidHours ?? 0
                            : shift.paidHoursPerDay ?? 0}
                        </TableCell>
                        <TableCell>
                          {isEditing ? (
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={shiftEdit?.spansMidnight ?? false}
                                onChange={(e) =>
                                  shiftEdit &&
                                  onChangeEdit({
                                    ...shiftEdit,
                                    spansMidnight: e.target.checked,
                                  })
                                }
                                className="h-4 w-4"
                              />
                              <span className="text-xs text-muted-foreground">
                                Ends next day
                              </span>
                            </div>
                          ) : (
                            <Badge variant="outline" className="uppercase">
                              {shift.spansMidnight ? "Yes" : "No"}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-right">
                          {isEditing ? (
                            <div className="flex justify-end gap-2">
                              <Button
                                size="sm"
                                onClick={onSaveEdit}
                                disabled={shiftEditSaving}
                                className="gap-1"
                              >
                                <Check className="h-4 w-4" />
                                Save
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={onCancelEdit}
                                className="gap-1"
                              >
                                <X className="h-4 w-4" />
                                Cancel
                              </Button>
                            </div>
                          ) : (
                            <div className="flex justify-end gap-2">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="gap-2"
                                onClick={() => onStartEdit(shift)}
                              >
                                <Pencil className="h-4 w-4" /> Edit
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="gap-2 text-destructive"
                                onClick={() => onDeleteShift(shift.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                                Delete
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
          {shiftEditError && (
            <p className="text-sm text-destructive">{shiftEditError}</p>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Create Shift</CardTitle>
          <p className="text-sm text-muted-foreground">
            Define a shift with start/end times and break details.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Code</label>
              <Input
                value={shiftCode}
                onChange={(e) => onChangeField("code", e.target.value)}
                placeholder="DAY-9-6"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Name</label>
              <Input
                value={shiftName}
                onChange={(e) => onChangeField("name", e.target.value)}
                placeholder="Day Shift"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Start time</label>
              <Input
                type="time"
                value={shiftStart}
                onChange={(e) => onChangeField("start", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">End time</label>
              <Input
                type="time"
                value={shiftEnd}
                onChange={(e) => onChangeField("end", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Break start</label>
              <Input
                type="time"
                value={shiftBreakStart ?? ""}
                onChange={(e) => onChangeField("breakStart", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Break end</label>
              <Input
                type="time"
                value={shiftBreakEnd ?? ""}
                onChange={(e) => onChangeField("breakEnd", e.target.value)}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <div className="text-sm text-muted-foreground">
                Unpaid break:{" "}
                <span className="font-medium text-foreground">
                  {derivedCreate.breakMinutes} mins
                </span>{" "}
                • Paid hours per day:{" "}
                <span className="font-medium text-foreground">
                  {derivedCreate.paidHours}
                </span>{" "}
                (auto-calculated)
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Spans midnight</label>
              <div className="flex items-center gap-2">
                <input
                  id="spans-midnight"
                  type="checkbox"
                  checked={shiftSpansMidnight}
                  onChange={(e) =>
                    onChangeField("spansMidnight", e.target.checked)
                  }
                  className="h-4 w-4"
                />
                <label
                  htmlFor="spans-midnight"
                  className="text-sm text-muted-foreground"
                >
                  Ends the next day
                </label>
              </div>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <label className="text-sm font-medium">Notes</label>
              <Input
                value={shiftNotes}
                onChange={(e) => onChangeField("notes", e.target.value)}
                placeholder="Optional"
              />
            </div>
          </div>
          {shiftError && (
            <p className="text-sm text-destructive">{shiftError}</p>
          )}
          <div className="flex justify-end">
            <Button
              onClick={onCreateShift}
              disabled={shiftSaving}
              className="gap-2"
            >
              <Plus className="h-4 w-4" />
              {shiftSaving ? "Saving..." : "Create shift"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
