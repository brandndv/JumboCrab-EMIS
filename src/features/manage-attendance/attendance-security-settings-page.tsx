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
  deviceTokenTrackingEnabled: boolean;
  fingerprintTrackingEnabled: boolean;
  gpsValidationEnabled: boolean;
  suspiciousTimeWindowMinutes: number;
  allowOnlyOneRegisteredDevicePerEmployee: boolean;
  requireManagerReviewForFlaggedLogs: boolean;
};

const defaultForm: AttendanceSecuritySettingsForm = {
  deviceTokenTrackingEnabled: true,
  fingerprintTrackingEnabled: true,
  gpsValidationEnabled: false,
  suspiciousTimeWindowMinutes: 3,
  allowOnlyOneRegisteredDevicePerEmployee: false,
  requireManagerReviewForFlaggedLogs: true,
};

const settingRows: Array<{
  key: keyof Omit<AttendanceSecuritySettingsForm, "suspiciousTimeWindowMinutes">;
  title: string;
  description: string;
}> = [
  {
    key: "deviceTokenTrackingEnabled",
    title: "Enable device token tracking",
    description:
      "Store persistent browser token from employee device for attendance review.",
  },
  {
    key: "fingerprintTrackingEnabled",
    title: "Enable fingerprint tracking",
    description:
      "Use lightweight browser fingerprint from safe browser properties only.",
  },
  {
    key: "gpsValidationEnabled",
    title: "Enable GPS validation",
    description:
      "Capture location when available and flag missing or mismatched GPS activity.",
  },
  {
    key: "allowOnlyOneRegisteredDevicePerEmployee",
    title: "Allow only one active registered device",
    description:
      "New devices stay flagged until manager validates or admin updates employee device usage.",
  },
  {
    key: "requireManagerReviewForFlaggedLogs",
    title: "Require manager review for flagged logs",
    description:
      "Keep suspicious logs pending until manager or admin records review decision.",
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
        deviceTokenTrackingEnabled: result.data.deviceTokenTrackingEnabled,
        fingerprintTrackingEnabled: result.data.fingerprintTrackingEnabled,
        gpsValidationEnabled: result.data.gpsValidationEnabled,
        suspiciousTimeWindowMinutes: result.data.suspiciousTimeWindowMinutes,
        allowOnlyOneRegisteredDevicePerEmployee:
          result.data.allowOnlyOneRegisteredDevicePerEmployee,
        requireManagerReviewForFlaggedLogs:
          result.data.requireManagerReviewForFlaggedLogs,
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
        suspiciousTimeWindowMinutes: Math.max(
          1,
          Math.min(3, Math.round(Number(form.suspiciousTimeWindowMinutes) || 1)),
        ),
      });

      if (!result.success) {
        throw new Error(
          result.error || "Failed to save attendance security settings",
        );
      }

      toast.success("Attendance settings updated.", {
        description: "Anti-cheating rules were saved successfully.",
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
        description="Loading anti-cheating attendance configuration."
      />
    );
  }

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Attendance Settings</CardTitle>
        <p className="text-sm text-muted-foreground">
          Configure anti-cheating attendance rules without changing current punch flow.
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
            <p className="font-medium">Suspicious time window in minutes</p>
            <p className="text-sm text-muted-foreground">
              Used for rapid multi-employee device reuse and fingerprint checks.
            </p>
            <Input
              type="number"
              min={1}
              max={3}
              value={form.suspiciousTimeWindowMinutes}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  suspiciousTimeWindowMinutes: Number(event.target.value),
                }))
              }
              className="max-w-xs"
            />
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
