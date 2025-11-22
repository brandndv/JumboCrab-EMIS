"use client";

import { useState, useEffect } from "react";
import { getEmployeesWithoutUser } from "@/actions/employees-action";
import { Button } from "@/components/ui/button";

interface AddUsersEmployeeAccountProps {
  onAssign: (employee: Employee) => void;
}
// Define the Employee type based on the data structure

interface Employee {
  employeeId: string; // Changed from id to employeeId
  firstName: string;
  lastName: string;
  employeeCode: string;
  email: string | null;
}

const AddUsersEmployeeAccount = ({
  onAssign,
}: AddUsersEmployeeAccountProps) => {
  // Add the type to the useState generic
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        const response = await getEmployeesWithoutUser();
        if (response.success) {
          setEmployees(response.data || []);
        } else {
          setError(response.error || "Failed to fetch employees");
        }
      } catch (err) {
        setError("An error occurred while fetching employees");
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchEmployees();
  }, []);

  if (loading) {
    return <div>Loading employees...</div>;
  }

  if (error) {
    return <div>Error: {error}</div>;
  }

  return (
    <div className="p-6">
      <h1 className="font-bold text-xl mb-2">Unassigned Employees</h1>
      <p className="text-gray-600 mb-4">Employees with no user accounts</p>

      {employees.length === 0 ? (
        <p>No unassigned employees found.</p>
      ) : (
        <div className="mt-4">
          <div className="grid grid-cols-3 gap-4 font-medium border-b pb-2">
            <div>Employee Code</div>
            <div>Name</div>
            <div>Actions</div>
          </div>
          {employees.map((employee) => (
            <div
              key={employee.employeeId}
              className="grid grid-cols-3 gap-4 py-2 border-b"
            >
              <div>{employee.employeeCode}</div>
              <div>
                {employee.firstName} {employee.lastName}
              </div>
              <div>
                <Button variant={"default"} onClick={() => onAssign(employee)}>
                  Assign
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AddUsersEmployeeAccount;
