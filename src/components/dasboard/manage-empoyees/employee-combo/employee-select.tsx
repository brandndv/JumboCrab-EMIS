"use client";

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useEmployees } from "../employees-provider";

const EmployeeSelect = () => {
  const {
    departments,
    selectedDepartment,
    setSelectedDepartment,
    selectedStatus,
    setSelectedStatus,
  } = useEmployees();

  return (
    <div className="flex flex-row gap-2">
      {/* Department Selector */}
      <Select
        value={selectedDepartment || "ALL"}
        onValueChange={(value) => setSelectedDepartment(value === "ALL" ? null : value)}
      >
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="All Departments" />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectLabel>Departments</SelectLabel>
            <SelectItem value="ALL">All Departments</SelectItem>
            {departments.map((dept) => (
              <SelectItem key={dept} value={dept}>
                {dept.charAt(0) + dept.slice(1).toLowerCase()}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>

      {/* Status Selector */}
      <Select
        value={selectedStatus || "ALL"}
        onValueChange={(value) => setSelectedStatus(value === "ALL" ? null : value)}
      >
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="All Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectLabel>Status</SelectLabel>
            <SelectItem value="ALL">All Status</SelectItem>
            <SelectItem value="ACTIVE">Active</SelectItem>
            <SelectItem value="INACTIVE">Inactive</SelectItem>
            <SelectItem value="ON_LEAVE">On Leave</SelectItem>
            <SelectItem value="SICK_LEAVE">Sick Leave</SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  );
};

export default EmployeeSelect;
