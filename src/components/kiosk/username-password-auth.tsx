"use client";

import { Input } from "@/components/ui/input";

export type KioskAuthMode = "password" | "qr";

export type KioskUserSuggestion = {
  username: string;
  role: string;
  employee: {
    employeeId: string;
    employeeCode: string;
    firstName: string;
    lastName: string;
  } | null;
};

type UsernamePasswordAuthProps = {
  username: string;
  onUsernameChange: (value: string) => void;
  onUsernameFocus?: () => void;
  onUsernameBlur?: () => void;
  password: string;
  onPasswordChange: (value: string) => void;
  suggestions: KioskUserSuggestion[];
  fetchingSuggestions?: boolean;
  onSelectSuggestion: (username: string) => void;
  title?: string;
  description?: string;
};

export function UsernamePasswordAuth({
  username,
  onUsernameChange,
  onUsernameFocus,
  onUsernameBlur,
  password,
  onPasswordChange,
  suggestions,
  fetchingSuggestions = false,
  onSelectSuggestion,
  title = "Manual fallback login",
  description = "Enter a valid employee username and password to punch from this kiosk.",
}: UsernamePasswordAuthProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <p className="text-sm font-semibold text-slate-100">{title}</p>
        <p className="text-sm text-slate-400">{description}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Input
          placeholder="Username"
          value={username}
          onChange={(e) => onUsernameChange(e.target.value)}
          onFocus={onUsernameFocus}
          onBlur={onUsernameBlur}
          className="h-11 border-slate-800 bg-slate-950/70 text-slate-100 placeholder:text-slate-500"
        />
        <Input
          type="password"
          placeholder="Employee or kiosk fallback password"
          value={password}
          onChange={(e) => onPasswordChange(e.target.value)}
          className="h-11 border-slate-800 bg-slate-950/70 text-slate-100 placeholder:text-slate-500"
        />
      </div>

      {suggestions.length > 0 ? (
        <div className="space-y-2 rounded-2xl border border-slate-800 bg-slate-950/60 p-3">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
            Suggested users
          </p>
          <div className="space-y-1">
            {suggestions.map((s) => (
              <button
                key={s.username}
                className="w-full rounded-xl border border-transparent px-3 py-2 text-left transition hover:border-slate-700 hover:bg-slate-900"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => onSelectSuggestion(s.username)}
                type="button"
              >
                <span className="text-sm font-medium text-slate-100">
                  {s.username}
                </span>
                <span className="block text-xs text-slate-400">
                  {s.employee?.firstName} {s.employee?.lastName} (
                  {s.employee?.employeeCode})
                </span>
              </button>
            ))}
          </div>
          {fetchingSuggestions ? (
            <p className="text-xs text-slate-500">Searching...</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
