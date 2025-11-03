"use client";

import { Input } from "@/components/ui/input";
import { useEmployees } from "../employees-provider";
import { useEffect, useState } from "react";

const EmployeeSearch = () => {
  const { setSearchTerm } = useEmployees();
  const [inputValue, setInputValue] = useState("");

  // Debounce the search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchTerm(inputValue);
    }, 300);

    return () => clearTimeout(timer);
  }, [inputValue, setSearchTerm]);

  return (
    <div className="w-96">
      <Input 
        type="text" 
        placeholder="Search employee by name, email, id..."
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
      />
    </div>
  );
};

export default EmployeeSearch;
