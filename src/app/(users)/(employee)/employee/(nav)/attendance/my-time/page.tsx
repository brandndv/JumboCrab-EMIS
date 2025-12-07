"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCcw, Clock, Coffee, LogOut, LogIn } from "lucide-react";
import { cn } from "@/lib/utils";

type Punch = {
  punchTime: string;
  punchType: string;
};

type StatusPayload = {
  employee: {
    employeeId: string;
    employeeCode: string;
    firstName: string;
    lastName: string;
    department?: { name: string | null } | null;
    position?: { name: string | null } | null;
  };
  expected: {
    start: number | null;
    end: number | null;
    shiftName: string | null;
    source: string;
  };
  punches: Punch[];
  lastPunch: Punch | null;
  breakCount: number;
  breakMinutes: number;
};

const minutesToTime = (mins: number | null) => {
  if (mins == null) return "—";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
};

const formatTime = (value?: string | null) => {
  if (!value) return "—";
  const d = new Date(value);
  return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
};

const punchOrder = ["TIME_IN", "BREAK_OUT", "BREAK_IN", "TIME_OUT"] as const;

export default function MyTimePage() {
  const [status, setStatus] = useState<StatusPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [punching, setPunching] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/attendance/self");
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to load status");
      setStatus(json.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load status");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const nextActions = useMemo(() => {
    const last = status?.lastPunch?.punchType;
    const actions: { type: Punch["punchType"]; label: string; icon: React.ReactNode }[] = [];
    if (!last || last === "TIME_OUT") {
      actions.push({ type: "TIME_IN", label: "Time in", icon: <LogIn className="h-4 w-4" /> });
    } else if (last === "TIME_IN") {
      actions.push({ type: "BREAK_IN", label: "Break start", icon: <Coffee className="h-4 w-4" /> });
      actions.push({ type: "TIME_OUT", label: "Time out", icon: <LogOut className="h-4 w-4" /> });
    } else if (last === "BREAK_IN") {
      actions.push({ type: "BREAK_OUT", label: "Break end", icon: <Clock className="h-4 w-4" /> });
      actions.push({ type: "TIME_OUT", label: "Time out", icon: <LogOut className="h-4 w-4" /> });
    }
    return actions;
  }, [status?.lastPunch?.punchType]);

  const punch = async (punchType: Punch["punchType"]) => {
    try {
      setPunching(punchType);
      setError(null);
      const res = await fetch("/api/attendance/self", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ punchType }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to punch");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to punch");
    } finally {
      setPunching(null);
    }
  };

  return (
    <div className="space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <div>
        <h1 className="text-2xl font-semibold">My Time</h1>
        <p className="text-sm text-muted-foreground">
          Clock in/out and breaks from this device. Only allowed on premise computers.
        </p>
      </div>

      <Card className="shadow-sm">
        <CardHeader className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">Status</CardTitle>
            <p className="text-sm text-muted-foreground">
              {status
                ? `${status.employee.firstName} ${status.employee.lastName} (${status.employee.employeeCode})`
                : "Loading..."}
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={load} aria-label="Reload">
            <RefreshCcw className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : !status ? (
            <p className="text-sm text-muted-foreground">No data.</p>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Expected</p>
                  <p className="text-sm">
                    {minutesToTime(status.expected.start)} - {minutesToTime(status.expected.end)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {status.expected.shiftName || "No shift"} ({status.expected.source})
                  </p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Last punch</p>
                  <p className="text-sm font-medium">
                    {status.lastPunch ? status.lastPunch.punchType.replace("_", " ") : "None"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {status.lastPunch ? formatTime(status.lastPunch.punchTime) : "—"}
                  </p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Breaks</p>
                  <p className="text-sm">
                    {status.breakMinutes} mins {status.breakCount ? `(${status.breakCount}x)` : ""}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {nextActions.map((action) => (
                  <Button
                    key={action.type}
                    size="lg"
                    className="gap-2"
                    disabled={!!punching}
                    onClick={() => punch(action.type)}
                  >
                    {action.icon}
                    {punching === action.type ? "Working..." : action.label}
                  </Button>
                ))}
              </div>

              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Today&apos;s punches</p>
                {status.punches.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No punches yet today.</p>
                ) : (
                  <div className="rounded-lg border">
                    <div className="divide-y">
                      {status.punches.map((p, idx) => (
                        <div key={idx} className="flex items-center justify-between px-3 py-2">
                          <span className="text-sm font-medium">{p.punchType.replace("_", " ")}</span>
                          <span className="text-xs text-muted-foreground">{formatTime(p.punchTime)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
