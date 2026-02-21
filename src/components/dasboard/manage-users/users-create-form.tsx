"use client";

import { useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Eye, EyeOff, Search } from "lucide-react";
import { getEmployeesWithoutUser } from "@/actions/employees/employees-action";
import { usePathname, useRouter } from "next/navigation";
import { createAuthUser } from "@/actions/auth/auth-action";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { APP_ROLES, type AppRole } from "@/lib/rbac";

type Employee = {
  employeeId: string;
  firstName: string;
  lastName: string;
  employeeCode: string;
  email?: string | null;
  img?: string | null;
};

type CreateUserFormProps = {
  defaultEmployeeId?: string;
};

function getUsersBasePath(pathname: string): string {
  const segments = pathname.split("/").filter(Boolean);
  const usersIndex = segments.indexOf("users");

  if (usersIndex === -1) {
    return "/admin/users";
  }

  return `/${segments.slice(0, usersIndex + 1).join("/")}`;
}

const CreateUserForm = ({ defaultEmployeeId }: CreateUserFormProps) => {
  const router = useRouter();
  const pathname = usePathname();
  const usersBasePath = useMemo(() => getUsersBasePath(pathname), [pathname]);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<AppRole | "">(
    defaultEmployeeId ? "employee" : "",
  );
  const [showPassword, setShowPassword] = useState(false);
  const [roleError, setRoleError] = useState("");
  const [loading, setLoading] = useState(false);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(
    null,
  );
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const fetchEmployees = async () => {
      if (role === "employee" || defaultEmployeeId) {
        setIsLoading(true);
        try {
          const response = await getEmployeesWithoutUser();
          if (response.success && response.data) {
            setEmployees(response.data);
            if (defaultEmployeeId) {
              const match = response.data.find(
                (emp) => emp.employeeId === defaultEmployeeId,
              );
              if (match) {
                setSelectedEmployee(match);
                setEmail(match.email ?? "");
                setRole("employee");
              }
            }
          } else {
            console.error("Failed to fetch employees:", response.error);
          }
        } catch (error) {
          console.error("Error fetching employees:", error);
        } finally {
          setIsLoading(false);
        }
      }
    };
    fetchEmployees();
  }, [role, defaultEmployeeId]);

  useEffect(() => {
    if (role !== "employee") {
      setSelectedEmployee(null);
      setSearchTerm("");
      return;
    }

    setEmail(selectedEmployee?.email ?? "");
  }, [role, selectedEmployee]);

  useEffect(() => {
    if (selectedEmployee) {
      setRole("employee");
      setEmail(selectedEmployee.email ?? "");
    }
  }, [selectedEmployee]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (password.length < 6) {
      alert("Password must be at least 6 characters long");
      return;
    }
    if (!role) {
      setRoleError("Please select a role");
      return;
    }
    if (role === "employee" && !selectedEmployee) {
      alert("Please select an employee");
      return;
    }

    setRoleError("");
    setLoading(true);

    try {
      const result = await createAuthUser({
        username,
        email,
        password,
        role,
        employeeId: selectedEmployee?.employeeId || null,
      });

      if (!result.success) {
        throw new Error(result.error || "Failed to create user");
      }

      setUsername("");
      setEmail("");
      setPassword("");
      setRole("");

      alert("User created successfully!");
      router.push(usersBasePath);
    } catch (error) {
      console.error("Error creating user:", error);
      alert(error instanceof Error ? error.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto">
      <Card className="rounded-2xl border border-border/70 shadow-sm">
        <CardHeader className="space-y-0 pb-3">
          <p className="mb-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
            Account Setup
          </p>
          <CardTitle className="text-3xl font-bold text-foreground">
            Create User Account
          </CardTitle>
          <CardDescription className="mt-1 text-sm text-muted-foreground">
            Enter the user&apos;s information below to create a new account
          </CardDescription>
        </CardHeader>

        <CardContent className="pt-0 pb-6">
          <form className="space-y-5" onSubmit={handleSubmit}>
            <div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label
                    htmlFor="username"
                    className="text-sm font-medium leading-none"
                  >
                    Username
                  </label>
                  <Input
                    type="text"
                    id="username"
                    name="username"
                    placeholder="johndoe"
                    className="h-11 rounded-lg"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <label
                    htmlFor="email"
                    className="text-sm font-medium leading-none"
                  >
                    Email
                  </label>
                  <Input
                    type="email"
                    id="email"
                    name="email"
                    placeholder="user@example.com"
                    className="h-11 rounded-lg"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    readOnly={role === "employee" && !!selectedEmployee?.email}
                  />
                </div>

                <div className="space-y-2">
                  <label
                    htmlFor="password"
                    className="text-sm font-medium leading-none"
                  >
                    Password
                  </label>
                  <div className="relative">
                    <Input
                      type={showPassword ? "text" : "password"}
                      id="password"
                      name="password"
                      placeholder="••••••••"
                      className="h-11 rounded-lg pr-10"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                    <button
                      type="button"
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <label
                    htmlFor="role"
                    className="text-sm font-medium leading-none"
                  >
                    Role
                  </label>
                  <div className="space-y-1">
                    <Select
                      value={role || undefined}
                      onValueChange={(value: AppRole) => {
                        setRole(value);
                        if (value) setRoleError("");
                      }}
                      required
                    >
                      <SelectTrigger
                        className={`h-11 rounded-lg w-full bg-background text-foreground ${
                          roleError ? "border-destructive" : ""
                        }`}
                      >
                        <SelectValue placeholder="Select a role" />
                      </SelectTrigger>
                      <SelectContent className="bg-card text-foreground">
                        {APP_ROLES.map((roleValue) => (
                          <SelectItem key={roleValue} value={roleValue}>
                            {roleValue.charAt(0).toUpperCase() +
                              roleValue
                                .slice(1)
                                .replace(/([A-Z])/g, " $1")
                                .trim()}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {roleError && (
                      <p className="text-sm font-medium text-destructive">
                        {roleError}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {role === "employee" && (
              <div className="space-y-3 rounded-2xl border border-border/70 bg-muted/10 p-4 md:p-5">
                <label className="text-sm font-medium leading-none">
                  Select Employee
                </label>
                <Select
                  value={selectedEmployee?.employeeId || ""}
                  onValueChange={(value) => {
                    const employee = employees.find(
                      (emp) => emp.employeeId === value,
                    );
                    setSelectedEmployee(employee || null);
                    setEmail(employee?.email ?? "");
                  }}
                >
                  <SelectTrigger className="h-11 rounded-lg w-full bg-background text-foreground">
                    <SelectValue
                      placeholder={
                        isLoading
                          ? "Loading employees..."
                          : "Select an employee"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent className="max-h-60 overflow-y-auto bg-card text-foreground">
                    <div className="px-3 py-2">
                      <div className="relative">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Search employees..."
                          className="pl-8"
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </div>
                    </div>
                    {employees
                      .filter((emp) =>
                        `${emp.firstName} ${emp.lastName} ${emp.employeeCode}`
                          .toLowerCase()
                          .includes(searchTerm.toLowerCase()),
                      )
                      .map((employee) => (
                        <SelectItem
                          key={employee.employeeId}
                          value={employee.employeeId}
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-medium">
                              {employee.employeeCode}
                            </span>
                            <span>
                              {employee.firstName} {employee.lastName}
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>

                {selectedEmployee && (
                  <div className="rounded-md border border-border bg-background p-3">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-12 w-12">
                        {selectedEmployee.img && (
                          <AvatarImage
                            src={selectedEmployee.img}
                            alt={`${selectedEmployee.firstName} ${selectedEmployee.lastName}`}
                            className="object-cover"
                          />
                        )}
                        <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                          {`${selectedEmployee.firstName?.[0] ?? ""}${
                            selectedEmployee.lastName?.[0] ?? ""
                          }`.toUpperCase() || "E"}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm text-foreground">
                          <span className="font-medium">Selected:</span>{" "}
                          {selectedEmployee.firstName}{" "}
                          {selectedEmployee.lastName}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Employee ID: {selectedEmployee.employeeCode}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end gap-3 pt-1">
              <Button
                variant="outline"
                type="button"
                onClick={() => router.push(usersBasePath)}
                className="min-w-28"
              >
                Cancel
              </Button>
              <Button type="submit" disabled={loading} className="min-w-36">
                {loading ? "Creating..." : "Create Account"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default CreateUserForm;
