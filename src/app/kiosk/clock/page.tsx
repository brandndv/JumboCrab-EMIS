  "use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCcw, LogIn, LogOut, Coffee, Clock, Shield } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatZonedDate, formatZonedTime, startOfZonedDay, zonedNow } from "@/lib/timezone";
import { KioskQrPanel } from "@/components/kiosk/kiosk-qr-panel";
import {
  type KioskAuthMode,
  type KioskUserSuggestion,
  UsernamePasswordAuth,
} from "@/components/kiosk/username-password-auth";
import {
  getKioskStatus,
  recordKioskPunch,
  searchKioskUsers,
} from "@/actions/attendance/kiosk-attendance-action";

type Punch = {
  punchTime: string;
  punchType: string;
};

type StatusPayload = {
  user: { username: string; role: string };
  employee: {
    employeeId: string;
    employeeCode: string;
    firstName: string;
    lastName: string;
    department?: { name: string | null } | null;
    position?: { name: string | null } | null;
  };
  expected: { start: number | null; end: number | null; shiftName: string | null; source: string };
  punches: Punch[];
  lastPunch: Punch | null;
  breakCount: number;
  breakMinutes: number;
};

const minutesToTime = (mins: number | null) => {
  if (mins == null) return "—";
  const total = ((mins % (24 * 60)) + 24 * 60) % (24 * 60);
  const h24 = Math.floor(total / 60);
  const m = total % 60;
  const suffix = h24 >= 12 ? "PM" : "AM";
  const h12 = h24 % 12 || 12;
  return `${h12}:${m.toString().padStart(2, "0")} ${suffix}`;
};

const reasonMessage = (reason?: string, fallback?: string) => {
  const map: Record<string, string> = {
    unauthorized: "You must sign in first.",
    invalid_date: "Selected date is invalid.",
    employee_not_found: "Employee record not found for this user.",
    ip_not_allowed: "This device is not allowed to punch.",
    invalid_punch_type: "Punch type is invalid.",
    missing_credentials: "Username and password are required.",
    user_not_eligible: "User is not eligible to punch.",
    invalid_credentials: "Incorrect username or password.",
    wrong_date: "Clock in is only allowed on today's scheduled shift date.",
    no_shift_today: "No scheduled shift for today.",
    too_early: "Too early to clock in.",
    too_late: "Cannot clock in after your scheduled end time.",
    already_clocked_out: "Already clocked out today.",
    invalid_sequence: "Wrong punch order. Follow the punch sequence.",
  };
  if (reason && map[reason]) return map[reason];
  return fallback || "Failed to punch";
};
const formatPunchLabel = (punchType: Punch["punchType"]) => {
  switch (punchType) {
    case "TIME_IN":
      return "TIME IN";
    case "TIME_OUT":
      return "TIME OUT";
    case "BREAK_IN":
      return "BREAK START";
    case "BREAK_OUT":
      return "BREAK END";
    default:
      return punchType.replace("_", " ").toUpperCase();
  }
};

export default function KioskClockPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [authMode, setAuthMode] = useState<KioskAuthMode>("password");
  const [statusUser, setStatusUser] = useState<string>("");
  const [status, setStatus] = useState<StatusPayload | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [punching, setPunching] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<KioskUserSuggestion[]>([]);
  const [fetchingSuggestions, setFetchingSuggestions] = useState(false);
  const [now, setNow] = useState<Date>(zonedNow());
  const [mounted, setMounted] = useState(false);
  const [selectedDate, setSelectedDate] = useState(() => {
    const d = zonedNow();
    const iso = new Date(d).toLocaleDateString("en-CA", {
      timeZone: "Asia/Manila",
    });
    return iso; // yyyy-mm-dd
  });

  useEffect(() => {
    const t = setInterval(() => setNow(zonedNow()), 1000);
    return () => clearInterval(t);
  }, []);

  const loadStatus = async (u: string) => {
    if (!u) return;
    try {
      setLoadingStatus(true);
      setError(null);
      const result = await getKioskStatus({
        username: u,
        date: selectedDate || undefined,
      });
      if (!result.success) {
        throw new Error(result.error || "Failed to load status");
      }
      setStatus(result.data ?? null);
    } catch (err) {
      setStatus(null);
      setError(err instanceof Error ? err.message : "Failed to load status");
    } finally {
      setLoadingStatus(false);
    }
  };

  const loadSuggestions = async (term: string) => {
    try {
      setFetchingSuggestions(true);
      const result = await searchKioskUsers({ query: term });
      if (!result.success) {
        throw new Error(result.error || "Failed to load suggestions");
      }
      setSuggestions(result.data ?? []);
    } catch {
      setSuggestions([]);
    } finally {
      setFetchingSuggestions(false);
    }
  };

  useEffect(() => {
    if (statusUser) loadStatus(statusUser);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusUser]);

  useEffect(() => {
    setMounted(true);
  }, []);

const nextActions = useMemo(() => {
    const last = status?.lastPunch?.punchType;
    const allowedNext: Record<Punch["punchType"] | "NONE", Punch["punchType"]> = {
      NONE: "TIME_IN",
      TIME_OUT: "TIME_IN",
      TIME_IN: "BREAK_IN",
      BREAK_IN: "BREAK_OUT",
      BREAK_OUT: "TIME_OUT",
    };
    const key = (last as Punch["punchType"]) ?? "NONE";
    const expected = allowedNext[key as keyof typeof allowedNext];
    const all = [
      { type: "TIME_IN", label: "TIME IN", icon: <LogIn className="h-5 w-5" /> },
      { type: "BREAK_IN", label: "BREAK START", icon: <Coffee className="h-5 w-5" /> },
      { type: "BREAK_OUT", label: "BREAK END", icon: <Clock className="h-5 w-5" /> },
      { type: "TIME_OUT", label: "TIME OUT", icon: <LogOut className="h-5 w-5" /> },
    ];
    return all.map((a) => ({ ...a, enabled: a.type === expected }));
  }, [status?.lastPunch?.punchType]);

  const punch = async (punchType: Punch["punchType"]) => {
    try {
      if (authMode === "password" && (!username || !password)) {
        setError("Username and password required");
        return;
      }
      if (authMode === "qr") {
        setError("QR mode uses employee scan flow. Kiosk-side manual punch is disabled.");
        return;
      }
      // Front-end validation mirrors API reasons for faster feedback
      const now = zonedNow();
      const todayISO = new Date(now).toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
      const dayStart = startOfZonedDay(now);
      const minutesSinceStart = Math.round((now.getTime() - dayStart.getTime()) / 60000);

      if (punchType === "TIME_IN") {
        if (selectedDate && selectedDate !== todayISO) {
          setError(reasonMessage("wrong_date"));
          return;
        }
        if (status?.expected.start == null) {
          setError(reasonMessage("no_shift_today"));
          return;
        }
        if (minutesSinceStart < status.expected.start) {
          setError(reasonMessage("too_early"));
          return;
        }
        if (status.expected.end != null && minutesSinceStart > status.expected.end) {
          setError(reasonMessage("too_late"));
          return;
        }
      }

      setPunching(punchType);
      setError(null);
      setInfo(null);
      const result = await recordKioskPunch({ username, password, punchType });
      if (!result.success) {
        const msg = reasonMessage(
          result.reason,
          result.error || "Failed to punch"
        );
        throw new Error(msg);
      }
      setInfo(reasonMessage(result.reason, "Punch recorded"));
      setPassword("");
      setSuggestions([]);
      setStatusUser(username);
      await loadStatus(username);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to punch");
    } finally {
      setPunching(null);
    }
  };

  return (
      <div className="min-h-screen bg-muted/20 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-5xl space-y-8">
        <div className="text-center space-y-4">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Kiosk</p>
          <h1 className="text-4xl font-semibold">Clock</h1>
          <p className="text-sm text-muted-foreground">Time in/out and breaks from this device only.</p>
          <div className="text-6xl font-semibold tracking-tight">
            {mounted
              ? formatZonedTime(now, { hour12: true, hour: "2-digit", minute: "2-digit", second: "2-digit" })
              : "— — : — —"}
          </div>
          <div className="text-sm text-muted-foreground">
            {mounted
              ? formatZonedDate(selectedDate ? new Date(selectedDate) : now)
              : "—"}
          </div>
        </div>

        <Card className="shadow-sm">
          <CardHeader className="flex flex-col gap-4">
            <CardTitle className="text-xl">
              {authMode === "password" ? "Enter credentials" : "Scan via QR"}
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              {authMode === "password"
                ? "Your username/password are verified for each punch. No session is created."
                : "Employee devices can scan this QR to authenticate at the kiosk."}
            </p>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Shield className="h-4 w-4" />
              <span>Only allowed IPs can punch (configure ALLOWED_PUNCH_IPS env).</span>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <UsernamePasswordAuth
              authMode={authMode}
              onAuthModeChange={setAuthMode}
              username={username}
              onUsernameChange={(value) => {
                setUsername(value);
                loadSuggestions(value);
              }}
              onUsernameFocus={() => loadSuggestions(username)}
              onUsernameBlur={() => setStatusUser(username)}
              password={password}
              onPasswordChange={setPassword}
              suggestions={suggestions}
              fetchingSuggestions={fetchingSuggestions}
              onSelectSuggestion={(selectedUsername) => {
                setUsername(selectedUsername);
                setStatusUser(selectedUsername);
                setSuggestions([]);
              }}
            />
            {authMode === "qr" ? (
              <KioskQrPanel />
            ) : null}
            <div className="flex flex-wrap items-center gap-3 justify-center">
              {nextActions.map((action) => (
                <Button
                  key={action.type}
                  className={cn(
                    "gap-3 text-lg px-8 py-6",
                    !action.enabled && "opacity-60 cursor-not-allowed"
                  )}
                  disabled={!!punching || !action.enabled || authMode !== "password"}
                  onClick={() => punch(action.type)}
                  size="lg"
                >
                  {action.icon}
                  {punching === action.type ? "Working..." : action.label}
                </Button>
              ))}
                <Button
                  variant="ghost"
                  size="lg"
                  className="gap-2 px-6 py-6"
                  onClick={() => username && loadStatus(username)}
                  aria-label="Reload"
                >
                  <RefreshCcw className="h-5 w-5" /> Refresh
                </Button>
                <Input
                  type="date"
                  className="w-40"
                  value={selectedDate}
                  onChange={(e) => {
                    setSelectedDate(e.target.value);
                    if (username) loadStatus(username);
                  }}
                />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            {info && <p className="text-sm text-green-600">{info}</p>}
          </CardContent>
        </Card>

        {loadingStatus ? (
          <Card className="shadow-sm">
            <CardContent className="p-4 text-sm text-muted-foreground">Loading status...</CardContent>
          </Card>
        ) : status ? (
          <Card className="shadow-sm">
            <CardHeader className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">Status</CardTitle>
                <p className="text-sm text-muted-foreground">
                  {status.employee.firstName} {status.employee.lastName} ({status.employee.employeeCode})
                </p>
              </div>
              <Badge variant="outline" className="uppercase">
                {status.user.role}
              </Badge>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Expected</p>
                  <p className="text-sm">
                    {status.expected.start != null && status.expected.end != null
                      ? `${minutesToTime(status.expected.start)} - ${minutesToTime(status.expected.end)}`
                      : "No schedule"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {status.expected.shiftName || "Day off"} ({status.expected.source || "none"})
                  </p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Last punch</p>
                  <p className="text-sm font-medium">
                    {status.lastPunch ? formatPunchLabel(status.lastPunch.punchType) : "None"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {status.lastPunch ? formatZonedTime(status.lastPunch.punchTime, { hour12: true, hour: "2-digit", minute: "2-digit" }) : "—"}
                  </p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Breaks</p>
                  <p className="text-sm">
                    {status.breakMinutes} mins {status.breakCount ? `(${status.breakCount}x)` : ""}
                  </p>
                </div>
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
                          <span className="text-sm font-medium">{formatPunchLabel(p.punchType)}</span>
                          <span className="text-xs text-muted-foreground">
                            {formatZonedTime(p.punchTime, { hour12: true, hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
