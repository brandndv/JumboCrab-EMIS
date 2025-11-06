"use client";

import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Employee } from "@/lib/validations/employees";
import { useState, useEffect } from "react";

type EmployeeDialogProps = {
  employee: Employee | null;
  mode: "create" | "view" | "edit" | "archive" | null;
  onClose: () => void;
  onSave: (employee: Employee) => void;
  onArchive: () => void;
};

export function EmployeeDialog({
  employee,
  mode,
  onClose,
  onSave,
  onArchive,
}: EmployeeDialogProps) {
  // Initialize form data with proper defaults
  const getInitialFormData = (emp: Employee | null): Partial<Employee> => {
    const defaults = {
      employmentStatus: "PROBATIONARY" as const,
      currentStatus: "ACTIVE" as const,
      startDate: new Date(),
    };

    if (!emp) {
      return { ...defaults };
    }

    return {
      ...defaults,
      ...emp,
    };
  };

  const [formData, setFormData] = useState<Partial<Employee>>(() =>
    getInitialFormData(employee)
  );

  const isOpen = mode !== null;

  // Update form data when employee prop changes
  useEffect(() => {
    console.log("EmployeeDialog - Mode:", mode);
    console.log("EmployeeDialog - Received employee data:", employee);

    if (employee) {
      // Create a clean data object with all fields properly set
      const updatedData = getInitialFormData(employee);
      console.log("EmployeeDialog - Setting form data with:", {
        ...updatedData,
        // Log dates as strings for better readability
        startDate: updatedData.startDate?.toISOString(),
        birthdate: (updatedData as any).birthdate?.toISOString(),
        endDate: (updatedData as any).endDate?.toISOString(),
      });
      setFormData(updatedData);
    } else if (mode === "create") {
      // Only reset to defaults if we're in create mode
      const defaultData = getInitialFormData(null);
      console.log(
        "EmployeeDialog - Initializing new employee with:",
        defaultData
      );
      setFormData(defaultData);
    }
  }, [employee, mode]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    console.log(
      `Field changed - ${name}:`,
      value,
      "Current form data:",
      formData
    );

    setFormData((prev) => {
      const newValue =
        name === "nationality"
          ? value === ""
            ? null
            : value // Convert empty string to null for nationality
          : value;

      const newData = {
        ...prev,
        [name]: newValue,
      };

      console.log("New form data:", newData);
      return newData;
    });
  };

  const handleSelectChange = (name: keyof Employee, value: string) => {
    console.log(`Select changed - ${name}:`, value);

    setFormData((prev) => {
      const newValue = name === "nationality" && value === "" ? null : value;
      const newData = {
        ...prev,
        [name]: newValue,
      };
      console.log("Updated form data after select change:", newData);
      return newData;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData) {
      console.error("No form data available");
      return;
    }

    try {
      console.log("[FORM] Starting form submission with data:", {
        ...formData,
        // Log dates as strings for better readability
        startDate: formData.startDate?.toISOString(),
        birthdate: (formData as any).birthdate?.toISOString(),
        endDate: (formData as any).endDate?.toISOString(),
      });

      await onSave(formData as Employee);
      console.log("[FORM] Form submitted successfully");
      onClose();
    } catch (error) {
      console.error("[FORM] Error submitting form:", error);
      // You might want to show an error toast/message to the user here
    }
  };

  if (!isOpen) return null;

  return (
    <div className="w-500">
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[80%]">
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>
                {mode === "create" && "Add New Employee"}
                {mode === "view" && "View Employee"}
                {mode === "edit" && "Edit Employee"}
                {mode === "archive" && "Archive Employee"}
              </DialogTitle>
              <DialogDescription>
                {mode === "create" && "Add a new employee to the system"}
                {mode === "view" && "View employee details"}
                {mode === "edit" && "Edit employee information"}
                {mode === "archive" &&
                  "Are you sure you want to archive this employee?"}
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              {mode === "archive" ? (
                <p>
                  This action cannot be undone. The employee will be archived.
                </p>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="firstName">First Name</Label>
                      <Input
                        id="firstName"
                        name="firstName"
                        value={formData.firstName || ""}
                        onChange={handleChange}
                        disabled={mode === "view"}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lastName">Last Name</Label>
                      <Input
                        id="lastName"
                        name="lastName"
                        value={formData.lastName || ""}
                        onChange={handleChange}
                        disabled={mode === "view"}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        name="email"
                        type="email"
                        value={formData.email || ""}
                        onChange={handleChange}
                        disabled={mode === "view"}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone">Phone</Label>
                      <Input
                        id="phone"
                        name="phone"
                        value={formData.phone || ""}
                        onChange={handleChange}
                        disabled={mode === "view"}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="position">Position</Label>
                      <Input
                        id="position"
                        name="position"
                        value={formData.position || ""}
                        onChange={handleChange}
                        disabled={mode === "view"}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="department">Department</Label>
                      <Input
                        id="department"
                        name="department"
                        value={formData.department || ""}
                        onChange={handleChange}
                        disabled={mode === "view"}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Employment Status</Label>
                      <Select
                        value={formData.employmentStatus || ""}
                        onValueChange={(value: string) =>
                          handleSelectChange(
                            "employmentStatus" as keyof Employee,
                            value
                          )
                        }
                        disabled={mode === "view"}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="REGULAR">Regular</SelectItem>
                          <SelectItem value="PROBATIONARY">
                            Probationary
                          </SelectItem>
                          <SelectItem value="TRAINING">Training</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Current Status</Label>
                      <Select
                        value={formData.currentStatus || ""}
                        onValueChange={(value) =>
                          handleSelectChange("currentStatus", value)
                        }
                        disabled={mode === "view"}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ACTIVE">Active</SelectItem>
                          <SelectItem value="ON_LEAVE">On Leave</SelectItem>
                          <SelectItem value="VACATION">Vacation</SelectItem>
                          <SelectItem value="SICK_LEAVE">Sick Leave</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="nationality">Nationality</Label>
                      <Input
                        id="nationality"
                        name="nationality"
                        value={
                          typeof formData.nationality === "string"
                            ? formData.nationality
                            : ""
                        }
                        onChange={(e) => {
                          const value = e.target.value || null;
                          console.log("Nationality changed:", {
                            old: formData.nationality,
                            new: value,
                          });
                          setFormData((prev) => ({
                            ...prev,
                            nationality: value,
                          }));
                        }}
                        disabled={mode === "view"}
                        placeholder="e.g., Filipino, American, etc."
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="startDate">Start Date</Label>
                      <Input
                        id="startDate"
                        name="startDate"
                        type="date"
                        value={
                          formData.startDate
                            ? format(
                                formData.startDate instanceof Date
                                  ? formData.startDate
                                  : new Date(formData.startDate),
                                "yyyy-MM-dd"
                              )
                            : ""
                        }
                        onChange={handleChange}
                        disabled={mode === "view"}
                      />
                    </div>
                    {formData.endDate && (
                      <div className="space-y-2">
                        <Label htmlFor="endDate">End Date</Label>
                        <Input
                          id="endDate"
                          name="endDate"
                          type="date"
                          value={
                            formData.endDate
                              ? format(new Date(formData.endDate), "yyyy-MM-dd")
                              : ""
                          }
                          onChange={handleChange}
                          disabled={mode === "view"}
                        />
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                {mode === "archive" ? "Cancel" : "Close"}
              </Button>
              {(mode === "create" || mode === "edit") && (
                <Button type="submit">
                  {mode === "create" ? "Create Employee" : "Save Changes"}
                </Button>
              )}
              {mode === "archive" && (
                <Button type="button" variant="destructive" onClick={onArchive}>
                  Archive
                </Button>
              )}
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
