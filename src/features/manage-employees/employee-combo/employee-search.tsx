"use client";

import { Input } from "@/components/ui/input";
import { useEmployees } from "../employees-provider";
import { useEffect, useState, useCallback } from "react";

const EmployeeSearch = () => {
  const { setSearchTerm } = useEmployees();
  const [inputValue, setInputValue] = useState("");
  const [debouncedValue, setDebouncedValue] = useState("");

  // Update debounced value after delay
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(inputValue);
    }, 300);

    return () => {
      clearTimeout(timer);
    };
  }, [inputValue]);

  // Update search term when debounced value changes
  useEffect(() => {
    setSearchTerm(debouncedValue.trim().toLowerCase());
  }, [debouncedValue, setSearchTerm]);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setInputValue(e.target.value);
    },
    []
  );

  return (
    <div className="w-full">
      <Input
        type="search"
        placeholder="Search by name, code, or email..."
        value={inputValue}
        onChange={handleInputChange}
        className="w-full"
        aria-label="Search employees"
      />
    </div>
  );
};

export default EmployeeSearch;
