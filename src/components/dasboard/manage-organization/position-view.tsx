"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type PositionRow = {
  positionId: string;
  name: string;
  description?: string | null;
  department?: { departmentId: string; name: string };
  employees: {
    employeeId: string;
    employeeCode: string;
    firstName: string;
    lastName: string;
    department?: { name: string | null };
  }[];
};

export function PositionView() {
  const [positions, setPositions] = useState<PositionRow[]>([]);
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<PositionRow | null>(null);
  const [open, setOpen] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/positions");
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to load positions");
      setPositions(json?.data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load positions");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const term = filter.trim().toLowerCase();
    if (!term) return positions;
    return positions.filter((p) => {
      return (
        p.name.toLowerCase().includes(term) ||
        p.department?.name?.toLowerCase().includes(term) ||
        p.description?.toLowerCase().includes(term)
      );
    });
  }, [positions, filter]);

  return (
    <Card className="shadow-sm">
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="text-lg">Job/Position View</CardTitle>
          <p className="text-sm text-muted-foreground">
            See which employees hold each position.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
          <Input
            placeholder="Filter by name or department"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="w-full sm:w-64"
          />
          <Button variant="ghost" size="icon" onClick={load} aria-label="Reload">
            <RefreshCcw className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 p-4">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground">No positions found.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {filtered.map((pos) => (
              <div key={pos.positionId} className="rounded-lg border bg-muted/10 p-4 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold">{pos.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {pos.department?.name || "No department"}
                    </p>
                  </div>
                  <Badge variant="outline">
                    {pos.employees.length} assigned
                  </Badge>
                </div>
                {pos.description && (
                  <p className="text-xs text-muted-foreground">{pos.description}</p>
                )}
                {pos.employees.length > 0 ? (
                  <ul className="space-y-1 text-xs text-muted-foreground">
                    {pos.employees.map((emp) => (
                      <li key={emp.employeeId} className="flex justify-between">
                        <span>
                          {emp.firstName} {emp.lastName} ({emp.employeeCode})
                        </span>
                        <span>{emp.department?.name || ""}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-muted-foreground">No employees assigned.</p>
                )}
                <div className="pt-1">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setSelected(pos);
                      setOpen(true);
                    }}
                  >
                    Quick view
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
      <Dialog
        open={open}
        onOpenChange={(val) => {
          setOpen(val);
          if (!val) setSelected(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selected?.name ?? "Position"}</DialogTitle>
            <DialogDescription>Role details and assigned employees.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <div>
              <p className="text-muted-foreground">Department</p>
              <p className="font-medium">{selected?.department?.name || "None"}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Description</p>
              <p className="font-medium">{selected?.description || "None"}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Employees</p>
              {selected?.employees?.length ? (
                <ul className="mt-1 space-y-1">
                  {selected.employees.map((e) => (
                    <li key={e.employeeId} className="flex items-center justify-between rounded-md border px-3 py-2">
                      <span>{e.firstName} {e.lastName} ({e.employeeCode})</span>
                      <span className="text-xs text-muted-foreground">{e.department?.name || ""}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-muted-foreground">No employees yet.</p>
              )}
            </div>
          </div>
          <DialogFooter />
        </DialogContent>
      </Dialog>
    </Card>
  );
}
