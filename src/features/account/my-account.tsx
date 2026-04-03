"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "@/hooks/use-session";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getEmployeeById } from "@/actions/employees/employees-action";
import {
  getGovernmentIdByEmployee,
  type GovernmentIdRecord,
} from "@/actions/contributions/government-ids-action";
import { updateUser } from "@/actions/users/users-action";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Eye, EyeOff } from "lucide-react";
import type { Employee } from "@/lib/validations/employees";

type EmployeeType = Partial<Employee>;
type EmployeeInfoTab = "profile" | "governmentIds";

const formatStatus = (value?: string | null) => {
  if (!value) return "—";
  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/^./, (v) => v.toUpperCase());
};

const formatValue = (value?: string | null) =>
  value?.trim() ? value.trim() : "—";

const getInitials = (fullName: string) => {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "U";
  if (parts.length === 1) return parts[0]?.[0]?.toUpperCase() ?? "U";
  return `${parts[0]?.[0] ?? ""}${parts[parts.length - 1]?.[0] ?? ""}`.toUpperCase();
};

const formatAddress = (employee?: EmployeeType | null) => {
  if (!employee) return "—";
  const parts = [
    employee.address,
    employee.city,
    employee.state,
    employee.postalCode,
    employee.country,
  ]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value));

  return parts.length > 0 ? parts.join(", ") : "—";
};

const InfoField = ({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) => (
  <div className="space-y-2">
    <p className="text-sm font-medium leading-none text-foreground">{label}</p>
    <div className="min-h-[46px] rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-foreground flex items-center">
      {value}
    </div>
  </div>
);

const InfoSection = ({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) => (
  <section className="space-y-3 rounded-xl border border-border/70 bg-muted/10 p-4 md:p-5">
    <div className="space-y-1">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      {description && (
        <p className="text-xs text-muted-foreground">{description}</p>
      )}
    </div>
    {children}
  </section>
);

const MyAccountPage = () => {
  const { user, loading, error, isEmployee } = useSession();
  const employeeId = user?.employee?.employeeId;
  const [employeeInfoTab, setEmployeeInfoTab] =
    useState<EmployeeInfoTab>("profile");
  const [employeeDetails, setEmployeeDetails] = useState<EmployeeType | null>(
    null,
  );
  const [employeeDetailsLoading, setEmployeeDetailsLoading] = useState(false);
  const [governmentIds, setGovernmentIds] = useState<GovernmentIdRecord | null>(
    null,
  );
  const [governmentIdsLoading, setGovernmentIdsLoading] = useState(false);
  const [governmentIdsError, setGovernmentIdsError] = useState<string | null>(
    null,
  );
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  useEffect(() => {
    if (!isEmployee || !employeeId) {
      setEmployeeDetails(null);
      return;
    }

    let cancelled = false;

    const fetchEmployeeDetails = async () => {
      setEmployeeDetailsLoading(true);
      try {
        const result = await getEmployeeById(employeeId);
        if (!cancelled && result.success && result.data) {
          setEmployeeDetails(result.data as unknown as EmployeeType);
        }
      } finally {
        if (!cancelled) {
          setEmployeeDetailsLoading(false);
        }
      }
    };

    fetchEmployeeDetails();

    return () => {
      cancelled = true;
    };
  }, [isEmployee, employeeId]);

  useEffect(() => {
    if (!isEmployee || !employeeId) {
      setGovernmentIds(null);
      setGovernmentIdsError(null);
      setGovernmentIdsLoading(false);
      return;
    }

    let cancelled = false;

    const fetchGovernmentIds = async () => {
      setGovernmentIdsLoading(true);
      setGovernmentIdsError(null);
      try {
        const result = await getGovernmentIdByEmployee(employeeId);
        if (cancelled) return;

        if (!result.success) {
          setGovernmentIdsError(
            result.error || "Failed to load government IDs.",
          );
          setGovernmentIds(null);
          return;
        }

        setGovernmentIds(result.data ?? null);
      } catch (fetchError) {
        if (!cancelled) {
          console.error("Failed to load government IDs:", fetchError);
          setGovernmentIdsError("Failed to load government IDs.");
          setGovernmentIds(null);
        }
      } finally {
        if (!cancelled) {
          setGovernmentIdsLoading(false);
        }
      }
    };

    fetchGovernmentIds();

    return () => {
      cancelled = true;
    };
  }, [isEmployee, employeeId]);

  const employee = useMemo(() => {
    if (employeeDetails) return employeeDetails;
    return (user?.employee as EmployeeType | null) ?? null;
  }, [employeeDetails, user?.employee]);

  const fullName = useMemo(() => {
    if (!user) return "User";
    const firstName = employee?.firstName ?? "";
    const middleName = employee?.middleName ?? "";
    const lastName = employee?.lastName ?? "";
    const suffix = employee?.suffix ?? "";
    const employeeName = [firstName, middleName, lastName, suffix]
      .filter(Boolean)
      .join(" ")
      .trim();
    return employeeName || user.username || "User";
  }, [user, employee]);

  const profileImageSrc = useMemo(() => {
    const employeeImage = employee?.img?.trim();
    if (employeeImage) return employeeImage;

    const userImage = user?.image?.trim();
    if (userImage) return userImage;

    return null;
  }, [employee?.img, user?.image]);

  const handlePasswordModalChange = (open: boolean) => {
    setIsPasswordModalOpen(open);
    if (!open) {
      setNewPassword("");
      setConfirmPassword("");
      setShowNewPassword(false);
      setShowConfirmPassword(false);
      setPasswordError(null);
      setPasswordSaving(false);
    }
  };

  const handleChangePassword = async () => {
    const userId = user?.userId;
    if (!userId) {
      setPasswordError("User ID not found.");
      return;
    }
    if (newPassword.length < 6) {
      setPasswordError("Password must be at least 6 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("Passwords do not match.");
      return;
    }

    try {
      setPasswordSaving(true);
      setPasswordError(null);
      const result = await updateUser({ userId, password: newPassword });
      if (!result.success) {
        throw new Error(result.error || "Failed to update password.");
      }
      handlePasswordModalChange(false);
    } catch (err) {
      setPasswordError(
        err instanceof Error ? err.message : "Failed to update password.",
      );
    } finally {
      setPasswordSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
        <Card className="rounded-2xl border border-border/70 bg-card/60 shadow-sm">
          <CardContent className="p-6 text-sm text-muted-foreground">
            Loading account...
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
        <Card className="rounded-2xl border border-destructive/30 bg-destructive/10 shadow-sm">
          <CardContent className="p-6 text-sm text-destructive">
            Failed to load account. {error.message}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
        <Card className="rounded-2xl border border-border/70 bg-card/60 shadow-sm">
          <CardContent className="p-6 text-sm text-muted-foreground">
            No active session found.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold text-foreground sm:text-3xl">
          My Account
        </h1>
        <p className="text-sm text-muted-foreground">
          View your account credentials and profile details.
        </p>
      </div>

      <Card className="rounded-2xl border border-border/70 bg-card/60 shadow-sm">
        <CardHeader className="flex flex-col items-start gap-4 space-y-0 pb-4 sm:flex-row sm:items-center sm:gap-5">
          <Avatar className="h-16 w-16 ring-2 ring-primary/20 sm:h-20 sm:w-20">
            {profileImageSrc && (
              <AvatarImage src={profileImageSrc} alt={fullName} />
            )}
            <AvatarFallback className="bg-primary/10 text-primary font-semibold uppercase">
              {getInitials(fullName)}
            </AvatarFallback>
          </Avatar>
          <div className="space-y-1">
            <CardTitle className="text-xl">Account Credentials</CardTitle>
            <CardDescription>
              Your sign-in details and password settings
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <InfoField label="Username" value={user.username || "—"} />
            <InfoField label="Email" value={user.email || "—"} />
          </div>
          <div className="flex justify-end">
            <Dialog
              open={isPasswordModalOpen}
              onOpenChange={handlePasswordModalChange}
            >
              <DialogTrigger asChild>
                <Button variant="outline">Change Password</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Change Password</DialogTitle>
                  <DialogDescription>
                    Update your account password.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="new-password">New Password</Label>
                    <div className="relative">
                      <Input
                        id="new-password"
                        type={showNewPassword ? "text" : "password"}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="At least 6 characters"
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword((prev) => !prev)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        aria-label={
                          showNewPassword
                            ? "Hide new password"
                            : "Show new password"
                        }
                      >
                        {showNewPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirm-password">Confirm Password</Label>
                    <div className="relative">
                      <Input
                        id="confirm-password"
                        type={showConfirmPassword ? "text" : "password"}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Re-enter new password"
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword((prev) => !prev)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        aria-label={
                          showConfirmPassword
                            ? "Hide confirm password"
                            : "Show confirm password"
                        }
                      >
                        {showConfirmPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>
                  {passwordError && (
                    <p className="text-sm text-destructive">{passwordError}</p>
                  )}
                </div>
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handlePasswordModalChange(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    onClick={handleChangePassword}
                    disabled={passwordSaving}
                  >
                    {passwordSaving ? "Saving..." : "Save Password"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
      </Card>

      {isEmployee && (
        <Card className="rounded-2xl border border-border/70 bg-card/60 shadow-sm">
          <CardHeader className="space-y-4 pb-4">
            <div>
              <CardTitle className="text-xl">Employee Information</CardTitle>
              <CardDescription>
                Linked employee profile and government ID details
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant={employeeInfoTab === "profile" ? "default" : "outline"}
                onClick={() => setEmployeeInfoTab("profile")}
              >
                Employee Profile
              </Button>
              <Button
                type="button"
                size="sm"
                variant={
                  employeeInfoTab === "governmentIds" ? "default" : "outline"
                }
                onClick={() => setEmployeeInfoTab("governmentIds")}
              >
                Government IDs
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {employeeInfoTab === "profile" &&
              (employeeDetailsLoading && !employee ? (
                <div className="rounded-lg border border-border/70 bg-muted/20 p-4 text-sm text-muted-foreground">
                  Loading employee information...
                </div>
              ) : employee ? (
                <div className="space-y-4">
                  <InfoSection
                    title="Personal Information"
                    description="Core identity and civil details."
                  >
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                      <InfoField
                        label="Employee Code"
                        value={formatValue(employee.employeeCode)}
                      />
                      <InfoField
                        label="First Name"
                        value={formatValue(employee.firstName)}
                      />
                      <InfoField
                        label="Middle Name"
                        value={formatValue(employee.middleName)}
                      />
                      <InfoField
                        label="Last Name"
                        value={formatValue(employee.lastName)}
                      />
                      <InfoField
                        label="Suffix"
                        value={formatValue(employee.suffix)}
                      />
                      <InfoField
                        label="Gender"
                        value={formatStatus(employee.sex)}
                      />
                      <InfoField
                        label="Civil Status"
                        value={formatStatus(employee.civilStatus)}
                      />
                      <InfoField
                        label="Nationality"
                        value={formatValue(employee.nationality)}
                      />
                    </div>
                  </InfoSection>

                  <InfoSection
                    title="Work Information"
                    description="Your current role inside the organization."
                  >
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                      <InfoField
                        label="Department"
                        value={formatValue(employee.department)}
                      />
                      <InfoField
                        label="Position"
                        value={formatValue(employee.position)}
                      />
                      <InfoField
                        label="Employment Status"
                        value={formatStatus(employee.employmentStatus)}
                      />
                      <InfoField
                        label="Current Status"
                        value={formatStatus(employee.currentStatus)}
                      />
                    </div>
                  </InfoSection>

                  <InfoSection
                    title="Contact Information"
                    description="Direct contact channels linked to your profile."
                  >
                    <div className="grid gap-4 md:grid-cols-2">
                      <InfoField
                        label="Phone Number"
                        value={formatValue(employee.phone)}
                      />
                      <InfoField
                        label="Employee Email"
                        value={formatValue(employee.email)}
                      />
                    </div>
                  </InfoSection>

                  <InfoSection
                    title="Address"
                    description="Current residential address on file."
                  >
                    <div className="grid gap-4 md:grid-cols-2">
                      <InfoField
                        label="Full Address"
                        value={formatAddress(employee)}
                      />
                    </div>
                  </InfoSection>

                  <InfoSection
                    title="Emergency Contact"
                    description="Person we should contact during urgent situations."
                  >
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                      <InfoField
                        label="Contact Name"
                        value={formatValue(employee.emergencyContactName)}
                      />
                      <InfoField
                        label="Relationship"
                        value={formatValue(
                          employee.emergencyContactRelationship,
                        )}
                      />
                      <InfoField
                        label="Contact Phone"
                        value={formatValue(employee.emergencyContactPhone)}
                      />
                      <InfoField
                        label="Contact Email"
                        value={formatValue(employee.emergencyContactEmail)}
                      />
                    </div>
                  </InfoSection>
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-border/70 bg-muted/20 p-4 text-sm text-muted-foreground">
                  No linked employee record found.
                </div>
              ))}

            {employeeInfoTab === "governmentIds" &&
              (governmentIdsLoading ? (
                <div className="rounded-lg border border-border/70 bg-muted/20 p-4 text-sm text-muted-foreground">
                  Loading government IDs...
                </div>
              ) : governmentIdsError ? (
                <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
                  {governmentIdsError}
                </div>
              ) : (
                <InfoSection
                  title="Government IDs"
                  description="Government identification numbers on file."
                >
                  <div className="grid gap-4 md:grid-cols-2">
                    <InfoField
                      label="TIN"
                      value={formatValue(governmentIds?.tinNumber)}
                    />
                    <InfoField
                      label="SSS"
                      value={formatValue(governmentIds?.sssNumber)}
                    />
                    <InfoField
                      label="PhilHealth"
                      value={formatValue(governmentIds?.philHealthNumber)}
                    />
                    <InfoField
                      label="Pag-IBIG"
                      value={formatValue(governmentIds?.pagIbigNumber)}
                    />
                  </div>
                </InfoSection>
              ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default MyAccountPage;
