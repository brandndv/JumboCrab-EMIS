"use client";

import { useEffect, useState } from "react";
import {
  getAttendanceSecuritySettings,
  updateAttendanceSecuritySettings,
} from "@/actions/attendance/attendance-action";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ModuleLoadingState } from "@/components/loading/loading-states";
import { useToast } from "@/components/ui/toast-provider";

type AttendanceSecuritySettingsForm = {
  gpsValidationEnabled: boolean;
  faceRecognitionEnabled: boolean;
  faceRequiredForQrPunch: boolean;
  faceLivenessRequired: boolean;
  faceMatchMaxDistance: number;
  faceFailureMode: string;
};

const defaultForm: AttendanceSecuritySettingsForm = {
  gpsValidationEnabled: false,
  faceRecognitionEnabled: false,
  faceRequiredForQrPunch: false,
  faceLivenessRequired: true,
  faceMatchMaxDistance: 0.5,
  faceFailureMode: "BLOCK",
};

const settingRows: Array<{
  key: Exclude<
    keyof AttendanceSecuritySettingsForm,
    "faceMatchMaxDistance" | "faceFailureMode"
  >;
  title: string;
  description: string;
}> = [
  {
    key: "gpsValidationEnabled",
    title: "Capture location when available",
    description:
      "Attach optional location coordinates to attendance punch context.",
  },
  {
    key: "faceRecognitionEnabled",
    title: "Enable face recognition",
    description:
      "Allow QR punches to require employee face verification before the punch is recorded.",
  },
  {
    key: "faceRequiredForQrPunch",
    title: "Require face for QR punch",
    description:
      "When enabled, employee QR scan opens camera and records punch only after face match passes.",
  },
  {
    key: "faceLivenessRequired",
    title: "Require liveness challenge",
    description:
      "Ask employees to blink or turn their head and reject obvious photo-only attempts.",
  },
];

export function AttendanceSecuritySettingsPage() {
  const toast = useToast();
  const [form, setForm] = useState<AttendanceSecuritySettingsForm>(defaultForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await getAttendanceSecuritySettings();
      if (!result.success || !result.data) {
        throw new Error(
          result.error || "Failed to load attendance security settings",
        );
      }

      setForm({
        gpsValidationEnabled: result.data.gpsValidationEnabled,
        faceRecognitionEnabled:
          result.data.faceRecognitionEnabled ?? defaultForm.faceRecognitionEnabled,
        faceRequiredForQrPunch:
          result.data.faceRequiredForQrPunch ?? defaultForm.faceRequiredForQrPunch,
        faceLivenessRequired:
          result.data.faceLivenessRequired ?? defaultForm.faceLivenessRequired,
        faceMatchMaxDistance:
          result.data.faceMatchMaxDistance ?? defaultForm.faceMatchMaxDistance,
        faceFailureMode: result.data.faceFailureMode ?? defaultForm.faceFailureMode,
      });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load attendance security settings",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const result = await updateAttendanceSecuritySettings({
        ...form,
        faceMatchMaxDistance: Math.max(
          0.45,
          Math.min(0.6, Number(form.faceMatchMaxDistance) || 0.5),
        ),
      });

      if (!result.success) {
        throw new Error(
          result.error || "Failed to save attendance security settings",
        );
      }

      toast.success("Attendance settings updated.", {
        description: "Attendance security settings were saved successfully.",
      });
      await load();
    } catch (err) {
      toast.error("Failed to update attendance settings.", {
        description:
          err instanceof Error
            ? err.message
            : "Failed to update attendance security settings",
      });
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  if (loading) {
    return (
      <ModuleLoadingState
        title="Attendance Settings"
        description="Loading attendance security configuration."
      />
    );
  }

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Attendance Settings</CardTitle>
        <p className="text-sm text-muted-foreground">
          Configure location context and face verification for attendance punches.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <div className="space-y-3">
          {settingRows.map((setting) => (
            <label
              key={setting.key}
              className="flex items-start justify-between gap-4 rounded-xl border border-border/70 bg-muted/10 p-4"
            >
              <div className="space-y-1">
                <p className="font-medium">{setting.title}</p>
                <p className="text-sm text-muted-foreground">
                  {setting.description}
                </p>
              </div>
              <input
                type="checkbox"
                checked={form[setting.key]}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    [setting.key]: event.target.checked,
                  }))
                }
                className="mt-1 h-4 w-4"
              />
            </label>
          ))}
        </div>

        <div className="rounded-xl border border-border/70 bg-muted/10 p-4">
          <div className="space-y-2">
            <p className="font-medium">Face match distance threshold</p>
            <p className="text-sm text-muted-foreground">
              Lower is stricter. Start at 0.50, then tune after real employee
              enrollment tests.
            </p>
            <Input
              type="number"
              min={0.45}
              max={0.6}
              step={0.01}
              value={form.faceMatchMaxDistance}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  faceMatchMaxDistance: Number(event.target.value),
                }))
              }
              className="max-w-xs"
            />
          </div>
        </div>

        <div className="rounded-xl border border-border/70 bg-muted/10 p-4">
          <div className="space-y-2">
            <p className="font-medium">Face failure mode</p>
            <p className="text-sm text-muted-foreground">
              Block is safest. Fallback allows QR punch when face camera is
              unavailable, useful for LAN HTTP development on phones.
            </p>
            <select
              value={form.faceFailureMode}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  faceFailureMode: event.target.value,
                }))
              }
              className="h-10 w-full max-w-sm rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              <option value="BLOCK">Block punch when face check fails</option>
              <option value="FLAG">
                Allow fallback punch when camera is unavailable
              </option>
            </select>
          </div>
        </div>

        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="outline" onClick={() => void load()} disabled={saving}>
            Reset
          </Button>
          <Button onClick={() => void handleSave()} disabled={saving}>
            {saving ? "Saving..." : "Save settings"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
