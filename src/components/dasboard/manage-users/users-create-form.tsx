"use client";
"use client";
import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Eye, EyeOff, Search } from "lucide-react";
import { Roles } from "@prisma/client";
import { getEmployeesWithoutUser } from "@/actions/employees-action";

type Employee = {
  id: string;
  firstName: string;
  lastName: string;
  employeeCode: string;
  email: string | null;
};

const CreateUserForm = () => {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Roles | "">("");
  const [showPassword, setShowPassword] = useState(false);
  const [roleError, setRoleError] = useState("");
  const [loading, setLoading] = useState(false);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(false);

useEffect(() => {
  const fetchEmployees = async () => {
    if (role === 'employee') {
      setIsLoading(true)
      try {
        const response = await getEmployeesWithoutUser()
        if (response.success && response.data) {
          setEmployees(response.data)
        } else {
          console.error('Failed to fetch employees:', response.error)
        }
      } catch (error) {
        console.error('Error fetching employees:', error)
      } finally {
        setIsLoading(false)
      }
    }
  }
  fetchEmployees()
}, [role])

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    // Basic validation
    if (password.length < 6) {
      alert("Password must be at least 6 characters long");
      return;
    }
    if (!role) {
      setRoleError("Please select a role");
      return;
    }
    if (role === 'employee' && !selectedEmployee) {
      alert("Please select an employee");
      return;
    }

    setRoleError("");
    setLoading(true);

    try {
      const response = await fetch("/api/auth/users/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ 
          username, 
          email, 
          password, 
          role, 
          employee: selectedEmployee ? `${selectedEmployee.firstName} ${selectedEmployee.lastName}` : null,
          employeeId: selectedEmployee?.id || null
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create user");
      }

      // Success case
      console.log("User created successfully:", data);
      
      // Clear form on success
      setUsername("");
      setEmail("");
      setPassword("");
      setRole("");
      
      // Show success message
      alert("User created successfully!");
      
      // Optionally redirect to users list
      // router.push('/admin/users');

    } catch (error) {
      console.error("Error creating user:", error);
      // Show error message to user
      alert(error instanceof Error ? error.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };
  return (
    <div className="flex flex-col items-center justify-center h-screen p-6">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle className="text-2xl font-bold">Create New User</CardTitle>
          <CardDescription>
            Enter the user's information below to create a new account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label
                  htmlFor="username"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Username
                </label>
                <Input
                  type="text"
                  id="username"
                  name="username"
                  placeholder="johndoe"
                  className="w-full"
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="email"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Email
                </label>
                <Input
                  type="email"
                  id="email"
                  name="email"
                  placeholder="user@example.com"
                  className="w-full"
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="password"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Password
                </label>
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    id="password"
                    name="password"
                    placeholder="••••••••"
                    className="w-full pr-10"
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
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Role
                </label>
                <div className="space-y-1">
                  <Select
                    value={role || undefined}
                    onValueChange={(value: Roles) => {
                      setRole(value);
                      if (value) setRoleError("");
                    }}
                    required
                  >
                    <SelectTrigger
                      className={`w-full bg-white ${
                        roleError ? "border-destructive" : ""
                      }`}
                    >
                      <SelectValue placeholder="Select a role" />
                    </SelectTrigger>
                    <SelectContent className="bg-white">
                      {Object.values(Roles).map((roleValue) => (
                        <SelectItem 
                          key={roleValue} 
                          value={roleValue}
                        >
                          {roleValue.charAt(0).toUpperCase() + roleValue.slice(1).replace(/([A-Z])/g, ' $1').trim()}
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
            {role === 'employee' && (
              <div className="space-y-2">
                <label className="text-sm font-medium leading-none">
                  Select Employee
                </label>
                <Select
                  value={selectedEmployee?.id || ""}
                  onValueChange={(value) => {
                    const employee = employees.find(emp => emp.id === value);
                    setSelectedEmployee(employee || null);
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={
                      isLoading ? "Loading employees..." : "Select an employee"
                    } />
                  </SelectTrigger>
                  <SelectContent className="max-h-60 overflow-y-auto">
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
                      .filter(emp => 
                        `${emp.firstName} ${emp.lastName} ${emp.employeeCode}`
                          .toLowerCase()
                          .includes(searchTerm.toLowerCase())
                      )
                      .map((employee) => (
                        <SelectItem key={employee.id} value={employee.id}>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{employee.employeeCode}</span>
                            <span>{employee.firstName} {employee.lastName}</span>
                          </div>
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                {selectedEmployee && (
                  <div className="mt-2 p-3 bg-gray-50 rounded-md">
                    <p className="text-sm">
                      <span className="font-medium">Selected:</span> {selectedEmployee.firstName} {selectedEmployee.lastName}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Employee ID: {selectedEmployee.employeeCode}
                    </p>
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end gap-4 pt-4">
              <Button variant="outline" type="button">
                Cancel
              </Button>
              <Button type="submit">Create User</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default CreateUserForm;
