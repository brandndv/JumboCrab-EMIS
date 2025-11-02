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
  mode: "view" | "edit" | "archive" | null;
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
  const [formData, setFormData] = useState<Partial<Employee>>(employee || {});
  const isOpen = mode !== null;

  useEffect(() => {
    if (employee) {
      setFormData(employee);
    }
  }, [employee]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSelectChange = (name: keyof Employee, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData) {
      onSave(formData as Employee);
    }
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              {mode === "view" && "View Employee"}
              {mode === "edit" && "Edit Employee"}
              {mode === "archive" && "Archive Employee"}
            </DialogTitle>
            <DialogDescription>
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
                    <Label htmlFor="startDate">Start Date</Label>
                    <Input
                      id="startDate"
                      name="startDate"
                      type="date"
                      value={
                        formData.startDate
                          ? format(new Date(formData.startDate), "yyyy-MM-dd")
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
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="mr-2"
            >
              {mode === "view" ? "Close" : "Cancel"}
            </Button>

            {mode === "edit" && <Button type="submit">Save Changes</Button>}

            {mode === "archive" && (
              <Button type="button" variant="destructive" onClick={onArchive}>
                Archive
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
