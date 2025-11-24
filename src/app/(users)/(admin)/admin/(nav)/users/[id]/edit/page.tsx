"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2, ArrowLeft, Save } from "lucide-react";
import type { UserWithEmployee } from "@/lib/validations/users";

type ApiUserResponse = {
  success: boolean;
  data?: UserWithEmployee;
  error?: string;
};

const roles: string[] = [
  "admin",
  "generalManager",
  "manager",
  "supervisor",
  "clerk",
  "employee",
];

const Field = ({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) => (
  <div className="space-y-2">
    <Label className="text-sm text-muted-foreground">{label}</Label>
    {children}
  </div>
);

const InfoField = ({
  label,
  value,
}: {
  label: string;
  value?: React.ReactNode;
}) => (
  <div className="space-y-2">
    <p className="text-xs uppercase tracking-wide text-muted-foreground">
      {label}
    </p>
    <div className="min-h-[44px] rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-foreground flex items-center">
      {value ?? <span className="text-muted-foreground/70">—</span>}
    </div>
  </div>
);

const buildDisplayName = (user?: UserWithEmployee | null) => {
  const fullName = `${user?.employee?.firstName ?? ""} ${
    user?.employee?.lastName ?? ""
  }`.trim();
  return fullName || user?.username || "User";
};

export default function UserEditPage({
  params,
}: {
  params: { id: string } | Promise<{ id: string }>;
}) {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<UserWithEmployee | null>(null);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<string>("");
  const [password, setPassword] = useState("");
  const [isDisabled, setIsDisabled] = useState(false);
  const generateTempPassword = () => {
    const chars =
      "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";
    const length = 12;
    let pwd = "";
    for (let i = 0; i < length; i++) {
      pwd += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setPassword(pwd);
  };

  const employeeName = useMemo(
    () =>
      `${user?.employee?.firstName ?? ""} ${user?.employee?.lastName ?? ""}`.trim(),
    [user]
  );

  // Resolve params promise safely
  useEffect(() => {
    const resolveParams = async () => {
      const resolved = await Promise.resolve(params);
      const id = resolved?.id ?? null;
      setUserId(id);
      if (!id) {
        setError("No user id provided");
        setLoading(false);
      }
    };
    resolveParams();
  }, [params]);

  useEffect(() => {
    if (!userId) return;
    const loadUser = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/users/${userId}`);
        const data: ApiUserResponse = await res.json();
        if (!res.ok || !data.success || !data.data) {
          throw new Error(data.error || "Failed to load user");
        }
        setUser(data.data);
        setUsername(data.data.username ?? "");
        setEmail(data.data.email ?? "");
        setRole(data.data.role ?? "");
        setIsDisabled(Boolean(data.data.isDisabled));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load user");
      } finally {
        setLoading(false);
      }
    };

    loadUser();
  }, [userId]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!userId) return;
    setSaving(true);
    setError(null);

    try {
      const payload: Record<string, unknown> = {
        username: username.trim(),
        email: email.trim(),
        role,
        isDisabled,
      };
      if (password.trim()) {
        payload.password = password.trim();
      }

      const res = await fetch(`/api/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data: ApiUserResponse = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to update user");
      }

      router.push(`/admin/users/${userId}/view`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update user");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[240px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-3xl rounded-xl border border-destructive/30 bg-destructive/10 p-6 text-destructive">
        <p className="font-medium">{error}</p>
        <div className="mt-4 flex gap-2">
          <Button variant="outline" onClick={() => router.back()}>
            Go back
          </Button>
          <Button variant="secondary" onClick={() => window.location.reload()}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 py-10 px-5 md:px-16 lg:px-24">
      <div className="flex items-start justify-between gap-4">
        <div>
          <button
            className="mb-3 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
            onClick={() => router.back()}
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
          <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
            Directory
          </p>
          <h1 className="text-3xl font-bold text-foreground">
            Edit {buildDisplayName(user)}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Update account details and status
          </p>
        </div>
        {user?.userId && (
          <Button variant="outline" asChild>
            <Link href={`/admin/users/${user.userId}/view`}>View profile</Link>
          </Button>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2 rounded-2xl border border-border/70 bg-card/60 shadow-sm">
          <CardHeader className="flex flex-row items-center gap-3 space-y-0">
            <Avatar className="h-12 w-12 ring-2 ring-primary/15">
              {(user?.image || user?.employee?.img) && (
                <AvatarImage
                  src={(user?.image as string) || (user?.employee?.img as string)}
                  alt={buildDisplayName(user)}
                />
              )}
              <AvatarFallback className="bg-primary/10 text-primary font-semibold uppercase">
                {user ? user.username?.[0] ?? "U" : "U"}
              </AvatarFallback>
            </Avatar>
            <div>
              <CardTitle>Edit User</CardTitle>
              <CardDescription>Fields marked * are required</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <form className="space-y-6" onSubmit={handleSubmit}>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Username *">
                  <Input
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    placeholder="johndoe"
                  />
                </Field>
                <Field label="Email *">
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="user@example.com"
                  />
                </Field>
                <Field label="Role *">
                  <Select value={role} onValueChange={setRole}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a role" />
                    </SelectTrigger>
                    <SelectContent>
                      {roles.map((r) => (
                        <SelectItem key={r} value={r}>
                          {r}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Status">
                  <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2">
                    <input
                      id="disabled"
                      type="checkbox"
                      checked={isDisabled}
                      onChange={(e) => setIsDisabled(e.target.checked)}
                      className="h-4 w-4 accent-primary"
                    />
                    <Label htmlFor="disabled" className="text-sm">
                      Disable account
                    </Label>
                  </div>
                </Field>
                <Field label="New Password">
                  <div className="flex gap-2">
                    <Input
                      type="text"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Leave blank to keep current password"
                    />
                    <Button type="button" variant="outline" onClick={generateTempPassword}>
                      Generate
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Leave blank to keep current password. Use Generate to create a temporary one.
                  </p>
                </Field>
              </div>

              <div className="flex flex-wrap gap-3 justify-end">
                <Button type="button" variant="outline" onClick={() => router.back()}>
                  Cancel
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  <Save className="mr-2 h-4 w-4" />
                  Save changes
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border border-border/70 bg-card/60 shadow-sm">
          <CardHeader>
            <CardTitle>Linked Employee</CardTitle>
            <CardDescription>Read-only employee association</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {user?.employee ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Badge variant="outline">Employee</Badge>
                  <span className="text-sm font-medium text-foreground">
                    {employeeName || "N/A"}
                  </span>
                </div>
                <div className="grid gap-3">
                  <InfoField label="Employee Code" value={user.employee.employeeCode} />
                  <InfoField
                    label="Position"
                  value={
                    typeof user.employee.position === "string"
                      ? user.employee.position
                      : (user.employee.position as any)?.name
                  }
                />
                <InfoField
                  label="Department"
                  value={
                    typeof user.employee.department === "string"
                      ? user.employee.department
                      : (user.employee.department as any)?.name
                  }
                />
                </div>
                {user.employee.employeeId && (
                  <Button asChild variant="outline" size="sm" className="w-full">
                    <Link href={`/admin/employees/${user.employee.employeeId}/view`}>
                      View employee record
                    </Link>
                  </Button>
                )}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-border/60 bg-muted/20 px-4 py-6 text-sm text-muted-foreground">
                This user is not linked to an employee record.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
