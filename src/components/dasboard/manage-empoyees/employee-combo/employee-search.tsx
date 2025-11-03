import { Input } from "@/components/ui/input";

const EmployeeSearch = () => {
  return (
    <div className="w-96">
      <Input type="text" placeholder="Search employee by name, email, id..." />
    </div>
  );
};

export default EmployeeSearch;
