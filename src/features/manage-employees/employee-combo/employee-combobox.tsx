import { Button } from "@/components/ui/button";
import { RotateCcw } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import EmployeeSearch from "./employee-search";
import EmployeeSelect from "./employee-select";
import { useEmployees } from "../employees-provider";

const EmployeeComboBox = () => {
  const {
    setSearchTerm,
    setSelectedDepartment,
    setSelectedStatus,
    searchTerm,
    selectedDepartment,
    selectedStatus,
  } = useEmployees();

  const hasActiveFilters = searchTerm || selectedDepartment || selectedStatus;

  const handleReset = () => {
    setSearchTerm("");
    setSelectedDepartment(null);
    setSelectedStatus(null);
  };

  return (
    <div className="w-full space-y-3">
      {/* Mobile/Tablet Layout */}
      <div className="lg:hidden flex flex-col gap-3 w-full">
        {/* Search bar - full width */}
        <div className="w-full">
          <EmployeeSearch />
        </div>
        
        {/* Filters and reset button in a single row */}
        <div className="flex flex-row items-center gap-2 w-full">
          <div className="flex-1">
            <EmployeeSelect />
          </div>
          
          {/* Reset button - only show when filters are active */}
          {hasActiveFilters && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleReset}
                    className="h-10 w-10 shrink-0"
                    aria-label="Reset filters"
                  >
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Reset all filters</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      </div>

      {/* Desktop Layout (lg and up) */}
      <div className="hidden lg:flex items-center gap-2 w-full">
        {/* Search - takes remaining space */}
        <div className="flex-1">
          <EmployeeSearch />
        </div>
        
        {/* Selects - fixed width */}
        <div className="w-[400px]">
          <EmployeeSelect />
        </div>
        
        {/* Reset button */}
        {hasActiveFilters && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleReset}
                  className="h-10 w-10 shrink-0"
                  aria-label="Reset filters"
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Reset all filters</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
    </div>
  );
};

export default EmployeeComboBox;
