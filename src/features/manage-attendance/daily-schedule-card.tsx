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
import { TableLoadingState } from "@/components/loading/loading-states";
import { cn } from "@/lib/utils";
import { RefreshCcw } from "lucide-react";
import { ScheduleEntry, formatMinutes } from "@/types/schedule-types";

type DailyScheduleCardProps = {
  date: string;
  entries: ScheduleEntry[];
  loading: boolean;
  error: string | null;
  onDateChange: (value: string) => void;
  onReload: () => void;
};

export function DailyScheduleCard({
  date,
  entries,
  loading,
  error,
  onDateChange,
  onReload,
}: DailyScheduleCardProps) {
  return (
    <Card className="shadow-sm">
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="text-lg">Daily Schedule</CardTitle>
          <p className="text-sm text-muted-foreground">
            Resolved shifts per employee for the selected date.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Input
            type="date"
            value={date}
            onChange={(e) => onDateChange(e.target.value)}
            className="w-40"
          />
          <Button size="sm" onClick={onReload}>
            <RefreshCcw className="h-4 w-4 mr-2" />
            Load
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-4 space-y-3">
        {loading ? (
          <TableLoadingState
            label="Loading schedule"
            columns={4}
            rows={4}
          />
        ) : error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">No employees found.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Shift</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead>Source</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((entry) => (
                  <TableRow key={entry.employee.employeeId}>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">
                          {entry.employee.firstName} {entry.employee.lastName}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {entry.employee.employeeCode} ·{" "}
                          {entry.employee.department?.name || "—"} ·{" "}
                          {entry.employee.position?.name || "—"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {entry.shift?.name || "Rest day"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {entry.shift
                        ? `${formatMinutes(
                            entry.scheduledStartMinutes
                          )} - ${formatMinutes(entry.scheduledEndMinutes)}`
                        : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={cn(
                          entry.source === "override" &&
                            "border-primary text-primary",
                          entry.source === "none" &&
                            "border-muted-foreground/50 text-muted-foreground"
                        )}
                      >
                        {entry.source}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
