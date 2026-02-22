"use client";

import { LogIn, QrCode } from "lucide-react";
import { Button } from "@/components/ui/button";
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
  authMode: KioskAuthMode;
  onAuthModeChange: (mode: KioskAuthMode) => void;
  username: string;
  onUsernameChange: (value: string) => void;
  onUsernameFocus?: () => void;
  onUsernameBlur?: () => void;
  password: string;
  onPasswordChange: (value: string) => void;
  suggestions: KioskUserSuggestion[];
  fetchingSuggestions?: boolean;
  onSelectSuggestion: (username: string) => void;
};

export function UsernamePasswordAuth({
  authMode,
  onAuthModeChange,
  username,
  onUsernameChange,
  onUsernameFocus,
  onUsernameBlur,
  password,
  onPasswordChange,
  suggestions,
  fetchingSuggestions = false,
  onSelectSuggestion,
}: UsernamePasswordAuthProps) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 text-xs">
        <Button
          type="button"
          variant={authMode === "password" ? "default" : "outline"}
          size="sm"
          className="gap-2"
          onClick={() => onAuthModeChange("password")}
        >
          <LogIn className="h-4 w-4" />
          Username & password
        </Button>
        <Button
          type="button"
          variant={authMode === "qr" ? "default" : "outline"}
          size="sm"
          className="gap-2"
          onClick={() => onAuthModeChange("qr")}
        >
          <QrCode className="h-4 w-4" />
          QR mode
        </Button>
      </div>

      {authMode === "password" ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              placeholder="Username"
              value={username}
              onChange={(e) => onUsernameChange(e.target.value)}
              onFocus={onUsernameFocus}
              onBlur={onUsernameBlur}
            />
            <Input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => onPasswordChange(e.target.value)}
            />
          </div>
          {suggestions.length > 0 && (
            <div className="rounded-lg border bg-muted/30 p-2 space-y-1">
              <p className="text-xs text-muted-foreground">Select user</p>
              {suggestions.map((s) => (
                <button
                  key={s.username}
                  className="w-full rounded-md px-2 py-1 text-left hover:bg-muted"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => onSelectSuggestion(s.username)}
                >
                  <span className="text-sm font-medium">{s.username}</span>{" "}
                  <span className="text-xs text-muted-foreground">
                    {s.employee?.firstName} {s.employee?.lastName} (
                    {s.employee?.employeeCode})
                  </span>
                </button>
              ))}
              {fetchingSuggestions && (
                <p className="text-xs text-muted-foreground">Searching...</p>
              )}
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}

