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
    <div className="flex flex-row gap-2 w-full">
      {/* Department Selector */}
      <div className="flex-1 min-w-[160px]">
        <Select
          value={selectedDepartment || "ALL"}
          onValueChange={(value) =>
            setSelectedDepartment(value === "ALL" ? null : value)
          }
        >
          <SelectTrigger className="w-full h-9 text-sm">
            <SelectValue placeholder="Department" className="truncate" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup className="text-sm">
              <SelectLabel className="text-xs">Departments</SelectLabel>
              <SelectItem value="ALL" className="text-sm">All</SelectItem>
              {departments.map((dept) => (
                <SelectItem key={dept} value={dept} className="text-sm">
                  {dept.charAt(0) + dept.slice(1).toLowerCase()}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>

      {/* Status Selector */}
      <div className="flex-1 min-w-[140px]">
        <Select
          value={selectedStatus || "ALL"}
          onValueChange={(value) =>
            setSelectedStatus(value === "ALL" ? null : value)
          }
        >
          <SelectTrigger className="w-full h-9 text-sm">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup className="text-sm">
              <SelectLabel className="text-xs">Status</SelectLabel>
              <SelectItem value="ALL" className="text-sm">All</SelectItem>
              <SelectItem value="ACTIVE" className="text-sm">Active</SelectItem>
              <SelectItem value="INACTIVE" className="text-sm">Inactive</SelectItem>
              <SelectItem value="ON_LEAVE" className="text-sm">On Leave</SelectItem>
              <SelectItem value="SICK_LEAVE" className="text-sm">Sick Leave</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
};

export default EmployeeSelect;
