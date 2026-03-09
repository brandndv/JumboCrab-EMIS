"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  createEmployeeViolation,
  listEmployeesForViolation,
  listViolationDefinitions,
  type ViolationRow,
  type ViolationDefinitionOption,
  type ViolationEmployeeOption,
} from "@/actions/violations/violations-action";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const toDateInputValue = (date: Date) => date.toISOString().slice(0, 10);

type ViolationCreateFormProps = {
  initialEmployeeId?: string | null;
  cancelPath?: string;
  onSubmitted?: (created: ViolationRow) => void | Promise<void>;
};

const formatEmployeeLabel = (employee: ViolationEmployeeOption) =>
  `${employee.employeeCode} - ${employee.firstName} ${employee.lastName}`;

export default function ViolationCreateForm({
  initialEmployeeId,
  cancelPath,
  onSubmitted,
}: ViolationCreateFormProps) {
  const router = useRouter();
  const pathname = usePathname();

  const [employees, setEmployees] = useState<ViolationEmployeeOption[]>([]);
  const [employeesLoading, setEmployeesLoading] = useState(false);
  const [employeeQuery, setEmployeeQuery] = useState("");
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(
    initialEmployeeId ?? "",
  );
  const [employeeDropdownOpen, setEmployeeDropdownOpen] = useState(false);

  const [definitions, setDefinitions] = useState<ViolationDefinitionOption[]>(
    [],
  );
  const [definitionsLoading, setDefinitionsLoading] = useState(false);
  const [selectedViolationId, setSelectedViolationId] = useState("");

  const [violationDate, setViolationDate] = useState(
    toDateInputValue(new Date()),
  );
  const [remarks, setRemarks] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const selectedEmployee = useMemo(
    () =>
      employees.find((employee) => employee.employeeId === selectedEmployeeId),
    [employees, selectedEmployeeId],
  );

  const employeeSuggestions = useMemo(() => {
    const term = employeeQuery.trim().toLowerCase();
    if (!term) return employees;
    return employees.filter((employee) =>
      formatEmployeeLabel(employee).toLowerCase().includes(term),
    );
  }, [employees, employeeQuery]);

  const activeDefinitions = useMemo(
    () => definitions.filter((definition) => definition.isActive),
    [definitions],
  );

  const selectedDefinition = useMemo(
    () =>
      activeDefinitions.find(
        (definition) => definition.violationId === selectedViolationId,
      ) ?? null,
    [activeDefinitions, selectedViolationId],
  );

  const inferredCancelPath = useMemo(() => {
    const rolePath = pathname.split("/").filter(Boolean)[0] || "admin";
    return `/${rolePath}/violations`;
  }, [pathname]);

  const loadEmployees = async (query: string) => {
    try {
      setEmployeesLoading(true);
      setError(null);
      const result = await listEmployeesForViolation({
        query,
        employeeId: selectedEmployeeId || initialEmployeeId || undefined,
        limit: 80,
      });
      if (!result.success) {
        throw new Error(result.error || "Failed to load employees");
      }
      const rows = result.data ?? [];
      setEmployees(rows);

      const selected = rows.find(
        (employee) =>
          employee.employeeId === (selectedEmployeeId || initialEmployeeId),
      );
      if (selected && !employeeQuery) {
        setEmployeeQuery(formatEmployeeLabel(selected));
      }
    } catch (err) {
      setEmployees([]);
      setError(err instanceof Error ? err.message : "Failed to load employees");
    } finally {
      setEmployeesLoading(false);
    }
  };

  const loadDefinitions = async () => {
    try {
      setDefinitionsLoading(true);
      setError(null);
      const result = await listViolationDefinitions();
      if (!result.success) {
        throw new Error(result.error || "Failed to load violation definitions");
      }
      const rows = result.data ?? [];
      setDefinitions(rows);
      const firstActive = rows.find((row) => row.isActive) ?? null;
      if (!selectedViolationId && firstActive) {
        setSelectedViolationId(firstActive.violationId);
      }
    } catch (err) {
      setDefinitions([]);
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load violation definitions",
      );
    } finally {
      setDefinitionsLoading(false);
    }
  };

  const selectEmployee = (employee: ViolationEmployeeOption) => {
    setSelectedEmployeeId(employee.employeeId);
    setEmployeeQuery(formatEmployeeLabel(employee));
    setEmployeeDropdownOpen(false);
  };

  const submit = async () => {
    try {
      setSubmitting(true);
      setError(null);
      setMessage(null);

      if (!selectedEmployeeId) {
        throw new Error("Please select an employee");
      }
      if (!selectedViolationId) {
        throw new Error("Please select a violation");
      }
      if (!violationDate) {
        throw new Error("Please select a violation date");
      }

      const result = await createEmployeeViolation({
        employeeId: selectedEmployeeId,
        violationId: selectedViolationId,
        violationDate,
        remarks,
        // New assignments start as not acknowledged; employee acknowledgement toggles this later.
        isAcknowledged: false,
      });
      if (!result.success) {
        throw new Error(result.error || "Failed to save violation assignment");
      }

      if (result.data && onSubmitted) {
        await Promise.resolve(onSubmitted(result.data));
      }

      setMessage(
        result.data?.status === "DRAFT"
          ? "Violation draft submitted for manager approval."
          : "Violation assigned successfully.",
      );
      setRemarks("");
      setViolationDate(toDateInputValue(new Date()));
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to save violation assignment",
      );
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    void Promise.all([loadEmployees(""), loadDefinitions()]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const handle = setTimeout(() => {
      void loadEmployees(employeeQuery);
    }, 250);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employeeQuery]);

  return (
    <Card className="shadow-sm">
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="employee-combined">Employee</Label>
          <div className="relative">
            <Input
              id="employee-combined"
              value={employeeQuery}
              onChange={(event) => {
                setEmployeeQuery(event.target.value);
                setSelectedEmployeeId("");
                setEmployeeDropdownOpen(true);
              }}
              onFocus={() => setEmployeeDropdownOpen(true)}
              onBlur={() => {
                // Delay close so click on suggestion can complete.
                setTimeout(() => setEmployeeDropdownOpen(false), 120);
              }}
              placeholder="Search and select employee"
              autoComplete="off"
            />
            {employeeDropdownOpen && employeeSuggestions.length > 0 ? (
              <div className="absolute z-20 mt-1 max-h-52 w-full overflow-auto rounded-md border bg-popover p-1 shadow-md">
                {employeeSuggestions.slice(0, 20).map((employee) => (
                  <button
                    key={employee.employeeId}
                    type="button"
                    className="w-full rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground"
                    onMouseDown={(event) => {
                      event.preventDefault();
                      selectEmployee(employee);
                    }}
                  >
                    {formatEmployeeLabel(employee)}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          {employeesLoading ? (
            <p className="text-xs text-muted-foreground">
              Loading employees...
            </p>
          ) : null}
          {selectedEmployee ? (
            <p className="text-xs text-muted-foreground">
              Selected: {formatEmployeeLabel(selectedEmployee)}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Select one employee from search results.
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="violation-select">Violation</Label>
          <Select
            value={selectedViolationId}
            onValueChange={setSelectedViolationId}
            disabled={definitionsLoading}
          >
            <SelectTrigger id="violation-select">
              <SelectValue
                placeholder={
                  definitionsLoading
                    ? "Loading violation options..."
                    : "Select violation"
                }
              />
            </SelectTrigger>
            <SelectContent>
              {activeDefinitions.map((definition) => (
                <SelectItem
                  key={definition.violationId}
                  value={definition.violationId}
                >
                  {definition.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {activeDefinitions.length === 0 && !definitionsLoading ? (
            <p className="text-xs text-muted-foreground">
              No violation definitions found. Add a violation in the directory
              first.
            </p>
          ) : null}
          {selectedDefinition ? (
            <p className="text-xs text-muted-foreground">
              Strike rule: 1 strike each, max{" "}
              {selectedDefinition.maxStrikesPerEmployee} counted per employee
            </p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="violation-date">Violation Date</Label>
          <Input
            id="violation-date"
            type="date"
            value={violationDate}
            onChange={(event) => setViolationDate(event.target.value)}
          />
        </div>

        <div className="rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          Acknowledgement is stored in <code>isAcknowledged</code> and defaults
          to false. It should become true when the employee acknowledges it.
        </div>

        <div className="space-y-2">
          <Label htmlFor="violation-remarks">Remarks</Label>
          <textarea
            id="violation-remarks"
            value={remarks}
            onChange={(event) => setRemarks(event.target.value)}
            placeholder="Optional notes"
            className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          />
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push(cancelPath || inferredCancelPath)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => void submit()}
            disabled={submitting}
          >
            Save Assignment
          </Button>
        </div>

        {message ? <p className="text-sm text-emerald-600">{message}</p> : null}
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </CardContent>
    </Card>
  );
}
