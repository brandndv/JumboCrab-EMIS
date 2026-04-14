"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Clock,
  Coffee,
  LockKeyhole,
  LogIn,
  LogOut,
  QrCode,
  RefreshCcw,
  Shield,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  formatZonedDate,
  formatZonedTime,
  startOfZonedDay,
  zonedNow,
} from "@/lib/timezone";
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
  unlockKioskPasswordMode,
} from "@/actions/attendance/kiosk-attendance-action";
import { useToast } from "@/components/ui/toast-provider";

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

type KioskQrScanNotice = {
  username: string;
  employeeName: string;
  employeeCode: string;
  punchType: string;
  punchTime: string;
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

const PASSWORD_MODE_UNLOCK_WINDOW_MS = 60_000;
const QR_VISIBLE_WINDOW_SECONDS = (() => {
  const raw = Number(process.env.NEXT_PUBLIC_KIOSK_QR_VISIBLE_SECONDS ?? "30");
  if (!Number.isFinite(raw) || raw <= 0) {
    return 30;
  }
  return Math.max(5, Math.floor(raw));
})();
const darkCardClass =
  "rounded-[30px] border border-slate-800 bg-[#0b1120]/92 text-slate-100 shadow-[0_28px_80px_-48px_rgba(0,0,0,0.85)]";
const punchButtonClass =
  "h-auto min-h-16 justify-start rounded-2xl border border-slate-800 bg-slate-950/65 px-4 py-4 text-left text-sm font-medium text-slate-100 transition hover:bg-slate-900 disabled:border-slate-900 disabled:bg-slate-950/40 disabled:text-slate-600";

export default function KioskClockPage() {
  const toast = useToast();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [authMode, setAuthMode] = useState<KioskAuthMode>("qr");
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
  const [showUnlockPanel, setShowUnlockPanel] = useState(false);
  const [accessPassword, setAccessPassword] = useState("");
  const [unlockingFallback, setUnlockingFallback] = useState(false);
  const [unlockError, setUnlockError] = useState<string | null>(null);
  const [passwordModeUnlockedUntil, setPasswordModeUnlockedUntil] = useState<
    number | null
  >(null);
  const [qrVisibleUntil, setQrVisibleUntil] = useState<number | null>(null);
  const [qrScanNotice, setQrScanNotice] = useState<KioskQrScanNotice | null>(
    null,
  );

  useEffect(() => {
    const t = setInterval(() => setNow(zonedNow()), 1000);
    return () => clearInterval(t);
  }, []);

  const passwordModeUnlocked = Boolean(
    passwordModeUnlockedUntil && passwordModeUnlockedUntil > now.getTime(),
  );
  const unlockSecondsLeft = passwordModeUnlockedUntil
    ? Math.max(0, Math.ceil((passwordModeUnlockedUntil - now.getTime()) / 1000))
    : 0;
  const qrVisible = Boolean(qrVisibleUntil && qrVisibleUntil > now.getTime());
  const qrSecondsLeft = qrVisibleUntil
    ? Math.max(0, Math.ceil((qrVisibleUntil - now.getTime()) / 1000))
    : 0;
  const activeStatusUsername = statusUser || username;
  const currentDate = useMemo(
    () =>
      new Date(now).toLocaleDateString("en-CA", {
        timeZone: "Asia/Manila",
      }),
    [now],
  );
  const timeDisplay = useMemo(() => {
    if (!mounted) {
      return null;
    }

    const full = formatZonedTime(now, {
      hour12: true,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    const lastSpaceIndex = full.lastIndexOf(" ");

    if (lastSpaceIndex === -1) {
      return { time: full, meridiem: "" };
    }

    return {
      time: full.slice(0, lastSpaceIndex),
      meridiem: full.slice(lastSpaceIndex + 1),
    };
  }, [mounted, now]);

  const lockPasswordMode = useCallback(() => {
    setAuthMode("qr");
    setPasswordModeUnlockedUntil(null);
    setShowUnlockPanel(false);
    setAccessPassword("");
    setUnlockError(null);
    setUsername("");
    setPassword("");
    setSuggestions([]);
    setStatusUser("");
    setStatus(null);
  }, []);

  const showQrPanel = useCallback(() => {
    setQrVisibleUntil(Date.now() + QR_VISIBLE_WINDOW_SECONDS * 1000);
  }, []);

  const hideQrPanel = useCallback(() => {
    setQrVisibleUntil(null);
  }, []);

  const handleQrScanSuccess = useCallback(
    (ack: {
      username: string;
      employeeName: string;
      employeeCode: string;
      punchType: string;
      punchTime: string;
    }) => {
      setQrVisibleUntil(null);
      setQrScanNotice({
        username: ack.username,
        employeeName: ack.employeeName,
        employeeCode: ack.employeeCode,
        punchType: ack.punchType,
        punchTime: ack.punchTime,
      });
      setInfo(null);
      setError(null);
      setStatusUser(ack.username);
      toast.success("QR punch completed.", {
        description: `${ack.employeeName} ${formatPunchLabel(
          ack.punchType as Punch["punchType"],
        )} recorded.`,
      });
    },
    [toast],
  );

  const loadStatus = async (u: string) => {
    const normalizedUsername = u.trim();
    if (!normalizedUsername) {
      setStatus(null);
      setStatusUser("");
      return;
    }

    try {
      setLoadingStatus(true);
      setError(null);
      const result = await getKioskStatus({
        username: normalizedUsername,
        date: currentDate,
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
    const normalizedTerm = term.trim();
    if (!normalizedTerm) {
      setSuggestions([]);
      setFetchingSuggestions(false);
      return;
    }

    try {
      setFetchingSuggestions(true);
      const result = await searchKioskUsers({ query: normalizedTerm });
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

  const unlockPasswordFallback = async () => {
    try {
      setUnlockingFallback(true);
      setUnlockError(null);
      const result = await unlockKioskPasswordMode({
        accessPassword,
      });
      if (!result.success) {
        throw new Error(result.error || "Failed to unlock password fallback");
      }

      setAuthMode("password");
      setPasswordModeUnlockedUntil(Date.now() + PASSWORD_MODE_UNLOCK_WINDOW_MS);
      setShowUnlockPanel(false);
      setAccessPassword("");
      setError(null);
      setInfo("Supervisor fallback unlocked.");
      toast.success("Password fallback unlocked.");
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Failed to unlock password fallback";
      setUnlockError(message);
      toast.error("Failed to unlock fallback.", {
        description: message,
      });
    } finally {
      setUnlockingFallback(false);
    }
  };

  useEffect(() => {
    if (!statusUser) return;
    void loadStatus(statusUser);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusUser]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!passwordModeUnlockedUntil) return;
    if (passwordModeUnlockedUntil > now.getTime()) return;

    lockPasswordMode();
    setInfo("Password fallback locked. QR mode is active again.");
  }, [lockPasswordMode, now, passwordModeUnlockedUntil]);

  useEffect(() => {
    if (!qrVisibleUntil) return;
    if (qrVisibleUntil > now.getTime()) return;

    setQrVisibleUntil(null);
  }, [now, qrVisibleUntil]);

  useEffect(() => {
    if (!qrScanNotice) return;

    const timeout = window.setTimeout(() => {
      setQrScanNotice(null);
    }, 8000);

    return () => clearTimeout(timeout);
  }, [qrScanNotice]);

  const nextActions = useMemo(() => {
    const last = status?.lastPunch?.punchType;
    const allowedNext: Record<Punch["punchType"] | "NONE", Punch["punchType"]> =
      {
        NONE: "TIME_IN",
        TIME_OUT: "TIME_IN",
        TIME_IN: "BREAK_IN",
        BREAK_IN: "BREAK_OUT",
        BREAK_OUT: "TIME_OUT",
      };
    const key = (last as Punch["punchType"]) ?? "NONE";
    const expected = allowedNext[key as keyof typeof allowedNext];
    const all = [
      {
        type: "TIME_IN",
        label: "Time In",
        description: "Start the scheduled shift",
        icon: <LogIn className="h-5 w-5 text-orange-300" />,
      },
      {
        type: "BREAK_IN",
        label: "Break Start",
        description: "Begin the break window",
        icon: <Coffee className="h-5 w-5 text-orange-300" />,
      },
      {
        type: "BREAK_OUT",
        label: "Break End",
        description: "Resume the active shift",
        icon: <Clock className="h-5 w-5 text-orange-300" />,
      },
      {
        type: "TIME_OUT",
        label: "Time Out",
        description: "Finish the scheduled shift",
        icon: <LogOut className="h-5 w-5 text-orange-300" />,
      },
    ];
    return all.map((action) => ({
      ...action,
      enabled: action.type === expected,
    }));
  }, [status?.lastPunch?.punchType]);

  const punch = async (punchType: Punch["punchType"]) => {
    try {
      if (!passwordModeUnlocked || authMode !== "password") {
        setError(
          "Supervisor fallback must be unlocked before manual punching can be used.",
        );
        return;
      }
      if (!username || !password) {
        setError("Username and password required");
        return;
      }

      const currentNow = zonedNow();
      const dayStart = startOfZonedDay(currentNow);
      const minutesSinceStart = Math.round(
        (currentNow.getTime() - dayStart.getTime()) / 60000,
      );

      if (punchType === "TIME_IN") {
        if (status?.expected.start == null) {
          setError(reasonMessage("no_shift_today"));
          return;
        }
        if (minutesSinceStart < status.expected.start) {
          setError(reasonMessage("too_early"));
          return;
        }
        if (
          status.expected.end != null &&
          minutesSinceStart > status.expected.end
        ) {
          setError(reasonMessage("too_late"));
          return;
        }
      }

      setPunching(punchType);
      setError(null);
      setInfo(null);

      const currentUsername = username.trim();
      const result = await recordKioskPunch({
        username: currentUsername,
        password,
        punchType,
      });
      if (!result.success) {
        const msg = reasonMessage(
          result.reason,
          result.error || "Failed to punch",
        );
        throw new Error(msg);
      }

      const successMessage = reasonMessage(result.reason, "Punch recorded");
      setInfo(successMessage);
      toast.success(successMessage);
      setPassword("");
      setSuggestions([]);
      setStatusUser(currentUsername);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to punch";
      setError(message);
      toast.error("Failed to record punch.", {
        description: message,
      });
    } finally {
      setPunching(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#05070d] text-slate-100">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-orange-500/20 bg-orange-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-orange-300">
              <Shield className="h-3.5 w-3.5" />
              JumboCrab Kiosk
            </div>
            <div>
              <h1 className="text-4xl font-semibold tracking-tight text-slate-50">
                Clock Station
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                QR is the default punch path. Manual username and password
                fallback stays locked behind supervisor access.
              </p>
            </div>
          </div>

          <div className="rounded-[30px] border border-slate-800 bg-slate-950/80 px-6 py-5 text-right shadow-[0_24px_70px_-45px_rgba(0,0,0,0.9)]">
            <p className="text-xs font-medium uppercase tracking-[0.24em] text-slate-500">
              {mounted ? formatZonedDate(now) : "—"}
            </p>
            <div className="mt-3 flex items-end justify-end gap-3 text-slate-50">
              <span className="text-5xl font-semibold tracking-tight tabular-nums sm:text-6xl">
                {timeDisplay?.time ?? "— — : — —"}
              </span>
              <span className="pb-1 text-2xl font-semibold tracking-tight text-slate-300 sm:text-3xl">
                {timeDisplay?.meridiem ?? ""}
              </span>
            </div>
            <p className="mt-2 text-sm text-slate-400">Asia/Manila</p>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(360px,0.9fr)]">
          <Card className={darkCardClass}>
            <CardHeader className="border-b border-slate-800/80 pb-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-2">
                  <CardTitle className="text-2xl text-slate-50">
                    Scan to punch
                  </CardTitle>
                  <p className="max-w-2xl text-sm leading-6 text-slate-400">
                    Employees use their own phone to authenticate. Shared kiosk
                    credentials stay out of the normal flow.
                  </p>
                </div>
                <Badge
                  className={cn(
                    "w-fit border hover:bg-transparent",
                    qrVisible
                      ? "border-orange-500/20 bg-orange-500/10 text-orange-200"
                      : "border-slate-700 bg-slate-900 text-slate-300",
                  )}
                >
                  {qrVisible ? "QR Active" : "QR Hidden"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-5 p-6">
              {qrScanNotice ? (
                <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4">
                  <p className="text-sm font-semibold text-emerald-200">
                    QR scan completed
                  </p>
                  <p className="mt-1 text-sm text-emerald-100/80">
                    {qrScanNotice.employeeName} ({qrScanNotice.employeeCode}){" "}
                    recorded{" "}
                    {formatPunchLabel(
                      qrScanNotice.punchType as Punch["punchType"],
                    )}{" "}
                    at{" "}
                    {formatZonedTime(qrScanNotice.punchTime, {
                      hour12: true,
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    })}
                    .
                  </p>
                </div>
              ) : null}

              <div className="flex flex-col gap-4 rounded-2xl border border-slate-800 bg-slate-950/45 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-slate-100">
                    QR visibility window
                  </p>
                  <p className="text-sm text-slate-400">
                    {qrVisible
                      ? `QR is live and will auto-close in ${qrSecondsLeft}s.`
                      : `QR stays hidden until started, then closes after ${QR_VISIBLE_WINDOW_SECONDS}s.`}
                  </p>
                </div>
                <div className="flex flex-wrap gap-3">
                  {qrVisible ? (
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-11 rounded-2xl border border-slate-700 px-4 text-slate-200 hover:bg-slate-900 hover:text-slate-50"
                      onClick={hideQrPanel}
                    >
                      <X className="mr-2 h-4 w-4" />
                      Hide QR
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      className="h-11 rounded-2xl bg-orange-500 px-4 text-slate-950 hover:bg-orange-400"
                      onClick={showQrPanel}
                    >
                      <QrCode className="mr-2 h-4 w-4" />
                      Show QR
                    </Button>
                  )}
                </div>
              </div>

              <KioskQrPanel
                active={qrVisible}
                activeUntil={qrVisibleUntil}
                sessionSecondsLeft={qrSecondsLeft}
                onScanSuccess={handleQrScanSuccess}
              />
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card className={darkCardClass}>
              <CardHeader className="space-y-3 pb-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-2">
                    <CardTitle className="text-xl text-slate-50">
                      Restricted fallback
                    </CardTitle>
                    <p className="text-sm leading-6 text-slate-400">
                      Use this only when QR scanning is unavailable. Opening
                      this panel requires a separate kiosk password.
                    </p>
                  </div>
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center self-start rounded-2xl bg-orange-500/12 text-orange-300">
                    <LockKeyhole className="h-5 w-5" />
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <Shield className="h-4 w-4" />
                  <span>
                    Allowed kiosk IP rules still apply to fallback access.
                  </span>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {!passwordModeUnlocked && !showUnlockPanel ? (
                  <div className="space-y-4 rounded-2xl border border-dashed border-slate-800 bg-slate-950/55 p-4">
                    <p className="text-sm leading-6 text-slate-300">
                      One Time Authentication is hidden until manager unlocks
                      it.
                    </p>
                    <Button
                      type="button"
                      onClick={() => {
                        setShowUnlockPanel(true);
                        setUnlockError(null);
                      }}
                      className="h-11 rounded-2xl bg-orange-500 px-4 text-slate-950 hover:bg-orange-400"
                    >
                      Open One Time Authentication
                    </Button>
                  </div>
                ) : null}

                {!passwordModeUnlocked && showUnlockPanel ? (
                  <div className="space-y-4 rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-slate-100">
                        Manager access password
                      </p>
                      <p className="text-sm leading-6 text-slate-400">
                        This unlocks the One Time Authentication panel.
                        Employees still need a valid username and password to
                        record attendance.
                      </p>
                    </div>
                    <Input
                      type="password"
                      placeholder="Enter access password"
                      value={accessPassword}
                      onChange={(event) =>
                        setAccessPassword(event.target.value)
                      }
                      className="h-11 border-slate-800 bg-slate-950/70 text-slate-100 placeholder:text-slate-500"
                    />
                    {unlockError ? (
                      <p className="text-sm text-rose-400">{unlockError}</p>
                    ) : null}
                    <div className="flex flex-wrap gap-3">
                      <Button
                        type="button"
                        onClick={() => void unlockPasswordFallback()}
                        disabled={unlockingFallback}
                        className="h-11 rounded-2xl bg-orange-500 px-4 text-slate-950 hover:bg-orange-400"
                      >
                        {unlockingFallback ? "Unlocking..." : "Unlock OTA"}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        className="h-11 rounded-2xl text-slate-300 hover:bg-slate-900 hover:text-slate-100"
                        onClick={() => {
                          setShowUnlockPanel(false);
                          setAccessPassword("");
                          setUnlockError(null);
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : null}

                {passwordModeUnlocked ? (
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-3">
                      <div>
                        <p className="text-sm font-semibold text-emerald-200">
                          Fallback unlocked
                        </p>
                        <p className="text-xs text-emerald-100/70">
                          Password mode closes automatically in{" "}
                          {unlockSecondsLeft}s.
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        className="h-9 rounded-xl text-emerald-100 hover:bg-emerald-500/10 hover:text-emerald-50"
                        onClick={lockPasswordMode}
                      >
                        Close fallback
                      </Button>
                    </div>

                    <UsernamePasswordAuth
                      username={username}
                      onUsernameChange={(value) => {
                        setUsername(value);
                        void loadSuggestions(value);
                      }}
                      onUsernameFocus={() => {
                        if (username.trim()) {
                          void loadSuggestions(username);
                        }
                      }}
                      onUsernameBlur={() => setStatusUser(username.trim())}
                      password={password}
                      onPasswordChange={setPassword}
                      suggestions={suggestions}
                      fetchingSuggestions={fetchingSuggestions}
                      onSelectSuggestion={(selectedUsername) => {
                        setUsername(selectedUsername);
                        setStatusUser(selectedUsername);
                        setSuggestions([]);
                      }}
                      title="Fallback employee login"
                      description="Enter a valid employee username with either the employee password or the kiosk fallback password."
                    />
                  </div>
                ) : null}
              </CardContent>
            </Card>

            <Card className={darkCardClass}>
              <CardHeader className="space-y-2 pb-4">
                <div className="flex items-center justify-between gap-3">
                  <CardTitle className="text-xl text-slate-50">
                    Manual punch controls
                  </CardTitle>
                  <Badge
                    className={cn(
                      "border",
                      passwordModeUnlocked
                        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/10"
                        : "border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-900",
                    )}
                  >
                    {passwordModeUnlocked ? "Unlocked" : "Locked"}
                  </Badge>
                </div>
                <p className="text-sm leading-6 text-slate-400">
                  These controls only activate while the restricted fallback is
                  open.
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  {nextActions.map((action) => (
                    <Button
                      key={action.type}
                      type="button"
                      className={cn(
                        punchButtonClass,
                        action.enabled && passwordModeUnlocked
                          ? "hover:border-orange-500/40"
                          : "cursor-not-allowed",
                      )}
                      disabled={
                        !!punching ||
                        !action.enabled ||
                        !passwordModeUnlocked ||
                        authMode !== "password"
                      }
                      onClick={() => void punch(action.type)}
                    >
                      <span className="flex items-start gap-3">
                        <span className="mt-0.5">{action.icon}</span>
                        <span className="space-y-1">
                          <span className="block text-base font-semibold text-slate-100">
                            {punching === action.type
                              ? "Working..."
                              : action.label}
                          </span>
                          <span className="block text-xs text-slate-500">
                            {action.description}
                          </span>
                        </span>
                      </span>
                    </Button>
                  ))}
                </div>

                <div className="flex flex-col gap-3 rounded-2xl border border-slate-800 bg-slate-950/55 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <div className="flex h-11 w-full items-center rounded-2xl border border-slate-800 bg-slate-950/70 px-4 text-sm font-medium text-slate-100 sm:max-w-[280px]">
                      {currentDate}
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-11 w-full rounded-2xl px-4 text-slate-300 hover:bg-slate-900 hover:text-slate-100 sm:w-auto"
                      onClick={() =>
                        activeStatusUsername
                          ? void loadStatus(activeStatusUsername)
                          : undefined
                      }
                    >
                      <RefreshCcw className="mr-2 h-4 w-4" />
                      Refresh status
                    </Button>
                  </div>
                  <p className="text-xs leading-6 text-slate-500">
                    Status lookup is fixed to kiosk&apos;s current date. Manual
                    punch still follows today&apos;s scheduled shift only.
                  </p>
                </div>

                {error ? (
                  <p className="text-sm text-rose-400">{error}</p>
                ) : null}
                {info ? (
                  <p className="text-sm text-emerald-300">{info}</p>
                ) : null}
              </CardContent>
            </Card>
          </div>
        </div>

        {loadingStatus ? (
          <Card className={darkCardClass}>
            <CardContent className="p-5 text-sm text-slate-400">
              Loading employee punch status...
            </CardContent>
          </Card>
        ) : status ? (
          <Card className={darkCardClass}>
            <CardHeader className="flex flex-col gap-4 border-b border-slate-800/80 pb-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <CardTitle className="text-xl text-slate-50">
                  Current status
                </CardTitle>
                <p className="text-sm text-slate-400">
                  {status.employee.firstName} {status.employee.lastName} (
                  {status.employee.employeeCode})
                </p>
              </div>
              <div className="flex flex-col items-start gap-3 sm:items-end">
                <Badge className="w-fit border border-slate-700 bg-slate-900 text-slate-200 uppercase hover:bg-slate-900">
                  {status.user.role}
                </Badge>
                <div className="rounded-2xl border border-slate-800 bg-slate-950/55 px-4 py-3 sm:min-w-[320px]">
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
                    Schedule
                  </p>
                  <p className="mt-2 text-base font-semibold text-slate-100">
                    {status.expected.start != null &&
                    status.expected.end != null
                      ? `${minutesToTime(status.expected.start)} - ${minutesToTime(status.expected.end)}`
                      : "No schedule"}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    {status.expected.shiftName || "Day off"} (
                    {status.expected.source || "none"})
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-5 p-6">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-2xl border border-slate-800 bg-slate-950/55 p-4">
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
                    Last punch
                  </p>
                  <p className="mt-2 text-base font-semibold text-slate-100">
                    {status.lastPunch
                      ? formatPunchLabel(status.lastPunch.punchType)
                      : "None"}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    {status.lastPunch
                      ? formatZonedTime(status.lastPunch.punchTime, {
                          hour12: true,
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "—"}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-800 bg-slate-950/55 p-4">
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
                    Breaks
                  </p>
                  <p className="mt-2 text-base font-semibold text-slate-100">
                    {status.breakMinutes} mins{" "}
                    {status.breakCount ? `(${status.breakCount}x)` : ""}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    Department: {status.employee.department?.name || "—"}
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
                  Today&apos;s punches
                </p>
                {status.punches.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-950/45 p-4 text-sm text-slate-400">
                    No punches recorded yet today.
                  </div>
                ) : (
                  <div className="overflow-hidden rounded-2xl border border-slate-800">
                    <div className="divide-y divide-slate-800 bg-slate-950/45">
                      {status.punches.map((p, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between px-4 py-3"
                        >
                          <span className="text-sm font-medium text-slate-100">
                            {formatPunchLabel(p.punchType)}
                          </span>
                          <span className="text-xs text-slate-400">
                            {formatZonedTime(p.punchTime, {
                              hour12: true,
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
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
