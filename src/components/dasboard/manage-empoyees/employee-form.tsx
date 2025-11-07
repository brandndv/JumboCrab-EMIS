"use client";

import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Employee,
  SUFFIX,
  validateEmployee,
  validatePartialEmployee,
} from "@/lib/validations/employees";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { createEmployee, updateEmployee } from "@/actions/employees-action";

// Helper component to display form field errors
const FormError = ({ message }: { message?: string }) => {
  if (!message) return null;

  return (
    <p className="mt-1 text-sm text-red-600 dark:text-red-500" role="alert">
      {message}
    </p>
  );
};

type EmployeeFormProps = {
  employeeId: string | null;
  mode: "create" | "view" | "edit";
  initialData?: Partial<Employee> | null;
};

export default function EmployeeForm({
  employeeId,
  mode,
  initialData = null,
}: EmployeeFormProps) {
  const router = useRouter();
  const [formData, setFormData] = useState<Partial<Employee>>(() => {
    if (initialData) {
      return {
        firstName: initialData.firstName || "",
        lastName: initialData.lastName || "",
        suffix: initialData.suffix || "",
        email: initialData.email || "",
        phone: initialData.phone || "",
        emergencyContactName: initialData.emergencyContactName || "",
        emergencyContactRelationship:
          initialData.emergencyContactRelationship || "",
        emergencyContactPhone: initialData.emergencyContactPhone || "",
        emergencyContactEmail: initialData.emergencyContactEmail || "",
        // Add other fields as needed
        ...initialData,
      };
    }
    return {
      firstName: "",
      lastName: "",
      suffix: "",
      email: "",
      phone: "",
      emergencyContactName: "",
      emergencyContactRelationship: "",
      emergencyContactPhone: "",
      emergencyContactEmail: "",
    };
  });
  const [isLoading, setIsLoading] = useState(!initialData);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Initialize form data
  useEffect(() => {
    const fetchEmployee = async () => {
      if (mode !== "create" && employeeId && !initialData) {
        try {
          const response = await fetch(`/api/employees/${employeeId}`);
          if (!response.ok) {
            throw new Error("Failed to fetch employee data");
          }
          const data = await response.json();
          setFormData({
            ...data,
            img: data.img || '/default-avatar.png' // Default image if none provided
          });
        } catch (error) {
          console.error("Error fetching employee:", error);
        } finally {
          setIsLoading(false);
        }
      } else if (initialData) {
        // Use the provided initialData with default image
        setFormData({
          ...initialData,
          img: initialData.img || '/default-avatar.png'
        });
        setIsLoading(false);
      } else {
        // Initialize new employee with default values
        setFormData({
          employeeCode: `EMP-${Date.now()}`,
          firstName: "",
          lastName: "",
          email: "",
          phone: "",
          emergencyContactName: "",
          emergencyContactRelationship: "",
          emergencyContactPhone: "",
          emergencyContactEmail: "",
          description: "",
          employmentStatus: "PROBATIONARY",
          currentStatus: "ACTIVE",
          startDate: new Date(),
          position: "",
          department: "",
          sex: "MALE",
          civilStatus: "SINGLE",
          nationality: "",
          birthdate: new Date(),
          address: "",
          img: null, // Set to null to match the updated schema
        });
        setIsLoading(false);
      }
    };

    fetchEmployee();
  }, [employeeId, mode]);

  const validateField = (name: string, value: any) => {
    // Create a temporary object with the new value
    const tempData = { ...formData, [name]: value };

    // Validate the field using the appropriate schema
    const schema =
      mode === "create" ? validateEmployee : validatePartialEmployee;
    const result = schema(tempData);

    if (!result.success) {
      // Find the error for this specific field
      const fieldError = result.error.issues.find(
        (issue) => issue.path[0] === name
      );

      // Update errors state
      if (fieldError?.message) {
        setErrors((prev) => ({
          ...prev,
          [name]: fieldError.message,
        }));
      } else {
        // If no error message, remove the error
        setErrors((prev) => {
          const newErrors = { ...prev };
          delete newErrors[name as keyof typeof newErrors];
          return newErrors;
        });
      }
    } else {
      // Clear error for this field if validation passes
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[name as keyof typeof newErrors];
        return newErrors;
      });
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    if (mode === "view") return; // Prevent changes in view mode

    const { name, value } = e.target;

    // Handle phone number input (only allow numbers)
    if (name === "phone" || name === "emergencyContactPhone") {
      // Only update if the value is empty or contains only digits
      if (value === "" || /^\d*$/.test(value)) {
        setFormData((prev) => ({
          ...prev,
          [name]: value,
        }));
        validateField(name, value);
      }
      return;
    }

    // For other fields
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    // Validate the field in real-time
    validateField(name, value);
  };

  const handleSelectChange = (name: keyof Employee, value: string) => {
    if (mode === "view") return; // Prevent changes in view mode

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // Helper function to format field names for display
  const formatFieldName = (field: string) => {
    return field
      .replace(/([A-Z])/g, " $1")
      .replace(/^./, (str) => str.toUpperCase())
      .trim();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === "view") return; // Prevent form submission in view mode

    console.log("Form submitted with data:", formData);
    setIsSubmitting(true);
    setErrors({});

    try {
      // Validate the form data
      const validationResult =
        mode === "create"
          ? validateEmployee(formData)
          : validatePartialEmployee(formData);

      console.log("Validation result:", validationResult);

      if (!validationResult.success) {
        // Format the errors into a more usable format
        const formattedErrors: Record<string, string> = {};

        validationResult.error.issues.forEach((issue) => {
          const field = issue.path[0] as string;
          formattedErrors[field] = issue.message;
        });

        setErrors(formattedErrors);

        // Scroll to the first error
        const firstError = document.querySelector('[data-error="true"]');
        if (firstError) {
          firstError.scrollIntoView({ behavior: "smooth", block: "center" });
        }
        return;
      }

      console.log("Attempting to save employee...");
      let result;

      if (mode === "create") {
        console.log("Creating new employee with data:", formData);
        result = await createEmployee(formData as any);
        console.log("Create employee result:", result);
      } else if (employeeId) {
        console.log(
          "Updating employee with ID:",
          employeeId,
          "Data:",
          formData
        );
        result = await updateEmployee({
          ...formData,
          id: employeeId,
        } as any);
        console.log("Update employee result:", result);
      } else {
        const error = "Employee ID is required for update";
        console.error(error);
        throw new Error(error);
      }

      if (!result.success) {
        throw new Error(result.error || "Failed to save employee");
      }

      // Show success message
      alert(
        `Employee ${mode === "create" ? "created" : "updated"} successfully!`
      );

      // Redirect back to employees list
      router.push("/admin/employees");
      router.refresh();
    } catch (error) {
      console.error("Error saving employee:", error);
      setErrors((prev) => ({
        ...prev,
        form:
          error instanceof Error
            ? error.message
            : "An error occurred while saving the employee",
      }));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8 p-6">
      <div className="space-y-6">
        {/* ========== PROFILE & PERSONAL INFO SECTION ========== */}
        <div className="flex flex-col md:flex-row gap-8">
          {/* ========== PROFILE IMAGE SECTION ========== */}
          <div className="w-full md:w-48 space-y-4">
            <h4 className="font-medium text-sm">Profile Image</h4>
            <div className="flex justify-center">
              <div className="relative">
                <div className="h-32 w-32 rounded-full bg-gray-100 overflow-hidden border border-gray-200">
                  {formData.img ? (
                    <img
                      src={formData.img}
                      alt={formData.firstName || "Profile"}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="h-full w-full bg-gray-200 flex items-center justify-center">
                      <span className="text-gray-400 text-sm text-center p-2">
                        No Image Available
                      </span>
                    </div>
                  )}
                </div>
                {mode !== "view" && (
                  <div className="mt-4 space-y-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() =>
                        document.getElementById("image-upload")?.click()
                      }
                    >
                      Choose Photo
                    </Button>
                    <input
                      id="image-upload"
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = (event) => {
                            setFormData((prev) => ({
                              ...prev,
                              img: event.target?.result as string,
                            }));
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                    />
                    {formData.img && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="w-full text-red-600 hover:text-red-700"
                        onClick={() =>
                          setFormData((prev) => ({ ...prev, img: "" }))
                        }
                      >
                        Remove Photo
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ========== PERSONAL INFORMATION SECTION ========== */}
          <div className="flex-1 space-y-4">
            <h4 className="font-medium">Personal Information</h4>
            <div className="grid grid-cols-1 gap-y-4">
              <div className="grid grid-cols-1 gap-y-4">
                {/* First Row: First Name, Last Name, Suffix */}
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
                  {/* First Name */}
                  <div className="sm:col-span-5 space-y-2">
                    <Label htmlFor="firstName">First Name *</Label>
                    {mode === "view" ? (
                      <div className="min-h-[40px] px-3 py-2 bg-gray-50 rounded-md border border-gray-200 flex items-center text-sm text-gray-800 w-full">
                        {formData.firstName || "-"}
                      </div>
                    ) : (
                      <div className="w-full">
                        <Input
                          id="firstName"
                          name="firstName"
                          value={formData.firstName || ""}
                          onChange={handleChange}
                          className={`w-full ${
                            errors.firstName ? "border-red-500" : ""
                          }`}
                          data-error={!!errors.firstName}
                          required
                          minLength={1}
                          maxLength={50}
                        />
                        <FormError message={errors.firstName} />
                      </div>
                    )}
                  </div>

                  {/* Last Name */}
                  <div className="sm:col-span-5 space-y-2">
                    <Label htmlFor="lastName">Last Name *</Label>
                    {mode === "view" ? (
                      <div className="min-h-[40px] px-3 py-2 bg-gray-50 rounded-md border border-gray-200 flex items-center text-sm text-gray-800 w-full">
                        {formData.lastName || "-"}
                      </div>
                    ) : (
                      <div className="w-full">
                        <Input
                          id="lastName"
                          name="lastName"
                          value={formData.lastName || ""}
                          onChange={handleChange}
                          className={`w-full ${
                            errors.lastName ? "border-red-500" : ""
                          }`}
                          data-error={!!errors.lastName}
                          required
                          minLength={1}
                          maxLength={50}
                        />
                        <FormError message={errors.lastName} />
                      </div>
                    )}
                  </div>

                  {/* Suffix */}
                  <div className="sm:col-span-2 space-y-2">
                    <Label htmlFor="suffix">Suffix</Label>
                    {mode === "view" ? (
                      <div className="min-h-[40px] px-3 py-2 bg-gray-50 rounded-md border border-gray-200 flex items-center text-sm text-gray-800 w-24">
                        {formData.suffix || "-"}
                      </div>
                    ) : (
                      <div className="w-24">
                        <select
                          id="suffix"
                          name="suffix"
                          value={formData.suffix || ""}
                          onChange={(e) =>
                            handleSelectChange("suffix", e.target.value)
                          }
                          className={`w-full h-10 px-2 py-2 rounded-md border ${
                            errors.suffix ? "border-red-500" : "border-gray-300"
                          } focus:outline-none focus:ring-1 focus:ring-primary`}
                        >
                          <option value="">-</option>
                          <option value="JR">Jr.</option>
                          <option value="SR">Sr.</option>
                          <option value="II">II</option>
                          <option value="III">III</option>
                          <option value="IV">IV</option>
                        </select>
                        <FormError message={errors.suffix} />
                      </div>
                    )}
                  </div>
                </div>

                {/* Second Row: Middle Name, Date of Birth, Gender */}
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 mt-4">
                  {/* Middle Name */}
                  <div className="sm:col-span-5 space-y-2">
                    <Label htmlFor="middleName">Middle Name</Label>
                    {mode === "view" ? (
                      <div className="min-h-[40px] px-3 py-2 bg-gray-50 rounded-md border border-gray-200 flex items-center text-sm text-gray-800 w-full">
                        {formData.middleName || "-"}
                      </div>
                    ) : (
                      <div className="w-full">
                        <Input
                          id="middleName"
                          name="middleName"
                          value={formData.middleName || ""}
                          onChange={handleChange}
                          className={`w-full ${
                            errors.middleName ? "border-red-500" : ""
                          }`}
                          data-error={!!errors.middleName}
                          maxLength={50}
                        />
                        <FormError message={errors.middleName} />
                      </div>
                    )}
                  </div>

                  {/* Birthdate */}
                  <div className="sm:col-span-5 space-y-2">
                    <Label htmlFor="birthdate">Date of Birth *</Label>
                    {mode === "view" ? (
                      <div className="min-h-[40px] px-3 py-2 bg-gray-50 rounded-md border border-gray-200 flex items-center text-sm text-gray-800 w-full">
                        {formData.birthdate
                          ? new Date(formData.birthdate).toLocaleDateString()
                          : "-"}
                      </div>
                    ) : (
                      <div className="w-full">
                        <Input
                          id="birthdate"
                          name="birthdate"
                          type="date"
                          className={`w-full ${
                            errors.birthdate ? "border-red-500" : ""
                          }`}
                          value={
                            formData.birthdate
                              ? new Date(formData.birthdate)
                                  .toISOString()
                                  .split("T")[0]
                              : ""
                          }
                          onChange={(e) => {
                            handleSelectChange("birthdate", e.target.value);
                            if (e.target.value) {
                              validateField("birthdate", e.target.value);
                            }
                          }}
                          max={new Date().toISOString().split("T")[0]}
                          required
                        />
                        <FormError message={errors.birthdate} />
                      </div>
                    )}
                  </div>

                  {/* Gender */}
                  <div className="sm:col-span-2 space-y-2">
                    <Label>Gender *</Label>
                    {mode === "view" ? (
                      <div className="min-h-[40px] px-3 py-2 bg-gray-50 rounded-md border border-gray-200 flex items-center text-sm text-gray-800 w-24">
                        {formData.sex || "-"}
                      </div>
                    ) : (
                      <div className="w-24">
                        <div className="flex items-center space-x-2">
                          <select
                            name="gender"
                            value={formData.sex || ""}
                            onChange={(e) =>
                              handleSelectChange("sex", e.target.value)
                            }
                            className={`w-full h-10 px-2 py-2 rounded-md border ${
                              errors.sex ? "border-red-500" : "border-gray-300"
                            } focus:outline-none focus:ring-1 focus:ring-primary`}
                            required
                          >
                            <option value="">-</option>
                            <option value="MALE">Male</option>
                            <option value="FEMALE">Female</option>
                          </select>
                        </div>
                        <FormError message={errors.sex} />
                      </div>
                    )}
                  </div>

                  {/* Civil Status */}
                  <div className="sm:col-span-3 space-y-2">
                    <Label htmlFor="civilStatus">Civil Status *</Label>
                    {mode === "view" ? (
                      <div className="min-h-[40px] px-3 py-2 bg-gray-50 rounded-md border border-gray-200 flex items-center text-sm text-gray-800 w-full">
                        {formData.civilStatus || "-"}
                      </div>
                    ) : (
                      <div className="w-full">
                        <select
                          id="civilStatus"
                          name="civilStatus"
                          value={formData.civilStatus || ""}
                          onChange={(e) =>
                            handleSelectChange("civilStatus", e.target.value)
                          }
                          className={`w-full h-10 px-3 py-2 rounded-md border ${
                            errors.civilStatus
                              ? "border-red-500"
                              : "border-gray-300"
                          } focus:outline-none focus:ring-1 focus:ring-primary`}
                          required
                        >
                          <option value="">Select Status</option>
                          <option value="SINGLE">Single</option>
                          <option value="MARRIED">Married</option>
                          <option value="DIVORCED">Divorced</option>
                          <option value="WIDOWED">Widowed</option>
                        </select>
                        <FormError message={errors.civilStatus} />
                      </div>
                    )}
                  </div>

                  {/* Nationality */}
                  <div className="sm:col-span-4 space-y-2">
                    <Label htmlFor="nationality">Nationality *</Label>
                    {mode === "view" ? (
                      <div className="min-h-[40px] px-3 py-2 bg-gray-50 rounded-md border border-gray-200 flex items-center text-sm text-gray-800 w-full">
                        {formData.nationality || "-"}
                      </div>
                    ) : (
                      <div className="w-full">
                        <Input
                          id="nationality"
                          name="nationality"
                          value={formData.nationality || ""}
                          onChange={handleChange}
                          placeholder="e.g., Filipino, American"
                          className={`w-full ${
                            errors.nationality ? "border-red-500" : ""
                          }`}
                          data-error={!!errors.nationality}
                          required
                        />
                        <FormError message={errors.nationality} />
                      </div>
                    )}
                  </div>
                </div>

                {/* Third Row: Email, Phone */}
                <div className="grid grid-cols-12 gap-4">
                  {/* Phone Number */}
                  <div className="col-span-full sm:col-span-6 space-y-2">
                    <Label htmlFor="phone">Phone Number *</Label>
                    {mode === "view" ? (
                      <div className="min-h-[40px] px-3 py-2 bg-gray-50 rounded-md border border-gray-200 flex items-center text-sm text-gray-800 w-full">
                        {formData.phone || "-"}
                      </div>
                    ) : (
                      <div className="w-full">
                        <Input
                          id="phone"
                          name="phone"
                          type="tel"
                          value={formData.phone || ""}
                          onChange={handleChange}
                          placeholder="e.g., 09123456789"
                          pattern="[0-9]*"
                          className={`w-full ${
                            errors.phone ? "border-red-500" : ""
                          }`}
                          data-error={!!errors.phone}
                        />
                        <FormError message={errors.phone} />
                      </div>
                    )}
                  </div>

                  {/* Email */}
                  <div className="col-span-full sm:col-span-6 space-y-2">
                    <Label htmlFor="email">
                      Email Address {!formData.email && "*"}
                    </Label>
                    {mode === "view" ? (
                      <div className="min-h-[40px] px-3 py-2 bg-gray-50 rounded-md border border-gray-200 flex items-center text-sm text-gray-800 w-full">
                        {formData.email || "-"}
                      </div>
                    ) : (
                      <div className="w-full">
                        <Input
                          id="email"
                          name="email"
                          type="email"
                          value={formData.email || ""}
                          onChange={handleChange}
                          placeholder="example@company.com"
                          className={`w-full ${
                            errors.email ? "border-red-500" : ""
                          }`}
                          data-error={!!errors.email}
                        />
                        <FormError message={errors.email} />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        {/* ========== EMPLOYEE DESCRIPTION SECTION ========== */}
        <div className="space-y-2 pt-4 border-t border-gray-200">
          <Label htmlFor="description" className="mb-1 block">
            Description
          </Label>
          {mode === "view" ? (
            <div className="min-h-[100px] px-3 py-2 bg-gray-50 rounded-md border border-gray-200 text-sm text-gray-800 w-full">
              {formData.description || "-"}
            </div>
          ) : (
            <textarea
              id="description"
              name="description"
              value={formData.description || ""}
              onChange={handleChange}
              className="flex rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 min-h-[100px] w-full"
            />
          )}
        </div>

        {/* ========== CONTACT INFORMATION SECTION ========== */}
        <div className="space-y-4 pt-4 border-t border-gray-200">
          <h4 className="font-medium">Contact Information</h4>
          <div className="space-y-4">
            {/* Address */}
            <div>
              <Label htmlFor="address" className="mb-1 block">
                Address
              </Label>
              {mode === "view" ? (
                <div className="min-h-[40px] px-3 py-2 bg-gray-50 rounded-md border border-gray-200 flex items-center text-sm text-gray-800 w-full">
                  {formData.address || "-"}
                </div>
              ) : (
                <Input
                  id="address"
                  name="address"
                  value={formData.address || ""}
                  onChange={handleChange}
                  placeholder="Street address"
                />
              )}
            </div>

            {/* City and State/Province */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="city" className="mb-1 block">
                  City
                </Label>
                {mode === "view" ? (
                  <div className="min-h-[40px] px-3 py-2 bg-gray-50 rounded-md border border-gray-200 flex items-center text-sm text-gray-800 w-full">
                    {formData.city || "-"}
                  </div>
                ) : (
                  <Input
                    id="city"
                    name="city"
                    value={formData.city || ""}
                    onChange={handleChange}
                    placeholder="City"
                  />
                )}
              </div>
              <div>
                <Label htmlFor="state" className="mb-1 block">
                  State/Province
                </Label>
                {mode === "view" ? (
                  <div className="min-h-[40px] px-3 py-2 bg-gray-50 rounded-md border border-gray-200 flex items-center text-sm text-gray-800 w-full">
                    {formData.state || "-"}
                  </div>
                ) : (
                  <Input
                    id="state"
                    name="state"
                    value={formData.state || ""}
                    onChange={handleChange}
                    placeholder="State/Province"
                  />
                )}
              </div>
            </div>

            {/* Postal Code and Country */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="postalCode" className="mb-1 block">
                  Postal Code
                </Label>
                {mode === "view" ? (
                  <div className="min-h-[40px] px-3 py-2 bg-gray-50 rounded-md border border-gray-200 flex items-center text-sm text-gray-800 w-full">
                    {formData.postalCode || "-"}
                  </div>
                ) : (
                  <Input
                    id="postalCode"
                    name="postalCode"
                    value={formData.postalCode || ""}
                    onChange={handleChange}
                    placeholder="Postal code"
                  />
                )}
              </div>
              <div>
                <Label htmlFor="country" className="mb-1 block">
                  Country
                </Label>
                {mode === "view" ? (
                  <div className="min-h-[40px] px-3 py-2 bg-gray-50 rounded-md border border-gray-200 flex items-center text-sm text-gray-800 w-full">
                    {formData.country || "-"}
                  </div>
                ) : (
                  <Input
                    id="country"
                    name="country"
                    value={formData.country || ""}
                    onChange={handleChange}
                    placeholder="Country"
                  />
                )}
              </div>
            </div>
          </div>
        </div>
        {/* ========== EMPLOYEMENT INFORMATION SECTION ========== */}
        <div className="space-y-4 pt-4 border-t border-gray-200">
          <h4 className="font-medium">Employment Information</h4>
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            <div className="md:col-span-3">
              <Label htmlFor="employeeCode" className="mb-1 block">
                Employee Code
              </Label>
              {mode === "view" ? (
                <div className="min-h-[40px] px-3 py-2 bg-gray-50 rounded-md border border-gray-200 flex items-center text-sm text-gray-800 w-full">
                  {formData.employeeCode || "-"}
                </div>
              ) : (
                <div className="w-full">
                  <Input
                    id="employeeCode"
                    name="employeeCode"
                    value={formData.employeeCode || ""}
                    onChange={handleChange}
                    className={errors.employeeCode ? "border-red-500" : ""}
                    data-error={!!errors.employeeCode}
                  />
                  <FormError message={errors.employeeCode} />
                </div>
              )}
            </div>
            <div className="md:col-span-5">
              <Label htmlFor="department" className="mb-1 block">
                Department
              </Label>
              {mode === "view" ? (
                <div className="min-h-[40px] px-3 py-2 bg-gray-50 rounded-md border border-gray-200 flex items-center text-sm text-gray-800 w-full">
                  {formData.department || "-"}
                </div>
              ) : (
                <div className="w-full">
                  <Input
                    id="department"
                    name="department"
                    value={formData.department || ""}
                    onChange={handleChange}
                    className={errors.department ? "border-red-500" : ""}
                    data-error={!!errors.department}
                  />
                  <FormError message={errors.department} />
                </div>
              )}
            </div>
            <div className="md:col-span-4">
              <Label htmlFor="position" className="mb-1 block">
                Position
              </Label>
              {mode === "view" ? (
                <div className="min-h-[40px] px-3 py-2 bg-gray-50 rounded-md border border-gray-200 flex items-center text-sm text-gray-800 w-full">
                  {formData.position || "-"}
                </div>
              ) : (
                <div className="w-full">
                  <Input
                    id="position"
                    name="position"
                    value={formData.position || ""}
                    onChange={handleChange}
                    className={errors.position ? "border-red-500" : ""}
                    data-error={!!errors.position}
                  />
                  <FormError message={errors.position} />
                </div>
              )}
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            <div>
              <Label htmlFor="startDate" className="mb-1 block">
                Start Date
              </Label>
              {mode === "view" ? (
                <div className="min-h-[40px] px-3 py-2 bg-gray-50 rounded-md border border-gray-200 flex items-center text-sm text-gray-800 w-full">
                  {formData.startDate
                    ? new Date(formData.startDate).toLocaleDateString()
                    : "-"}
                </div>
              ) : (
                <Input
                  id="startDate"
                  name="startDate"
                  type="date"
                  value={
                    formData.startDate
                      ? new Date(formData.startDate).toISOString().split("T")[0]
                      : ""
                  }
                  onChange={handleChange}
                />
              )}
            </div>
            <div>
              <Label htmlFor="endDate" className="mb-1 block">
                End Date
              </Label>
              {mode === "view" ? (
                <div className="min-h-[40px] px-3 py-2 bg-gray-50 rounded-md border border-gray-200 flex items-center text-sm text-gray-800 w-full">
                  {formData.endDate
                    ? new Date(formData.endDate).toLocaleDateString()
                    : "-"}
                </div>
              ) : (
                <Input
                  id="endDate"
                  name="endDate"
                  type="date"
                  value={
                    formData.endDate
                      ? new Date(formData.endDate).toISOString().split("T")[0]
                      : ""
                  }
                  onChange={handleChange}
                />
              )}
            </div>
          </div>
        </div>

        {/* ========== EMERGENCY CONTACT SECTION ========== */}
        <div className="space-y-4 pt-4 border-t border-gray-200">
          <h4 className="font-medium">Emergency Contact</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="emergencyContactName" className="mb-1 block">
                Full Name
              </Label>
              {mode === "view" ? (
                <div className="min-h-[40px] px-3 py-2 bg-gray-50 rounded-md border border-gray-200 flex items-center text-sm text-gray-800 w-full">
                  {formData.emergencyContactName || "-"}
                </div>
              ) : (
                <div className="w-full">
                  <Input
                    id="emergencyContactName"
                    name="emergencyContactName"
                    value={formData.emergencyContactName || ""}
                    onChange={handleChange}
                    className={
                      errors.emergencyContactName ? "border-red-500" : ""
                    }
                    data-error={!!errors.emergencyContactName}
                  />
                  <FormError message={errors.emergencyContactName} />
                </div>
              )}
            </div>
            <div>
              <Label
                htmlFor="emergencyContactRelationship"
                className="mb-1 block"
              >
                Relationship
              </Label>
              {mode === "view" ? (
                <div className="min-h-[40px] px-3 py-2 bg-gray-50 rounded-md border border-gray-200 flex items-center text-sm text-gray-800 w-full">
                  {formData.emergencyContactRelationship || "-"}
                </div>
              ) : (
                <div className="w-full">
                  <Input
                    id="emergencyContactRelationship"
                    name="emergencyContactRelationship"
                    value={formData.emergencyContactRelationship || ""}
                    onChange={handleChange}
                    className={
                      errors.emergencyContactRelationship
                        ? "border-red-500"
                        : ""
                    }
                    data-error={!!errors.emergencyContactRelationship}
                  />
                  <FormError message={errors.emergencyContactRelationship} />
                </div>
              )}
            </div>
            <div>
              <Label htmlFor="emergencyContactPhone" className="mb-1 block">
                Phone Number
              </Label>
              {mode === "view" ? (
                <div className="min-h-[40px] px-3 py-2 bg-gray-50 rounded-md border border-gray-200 flex items-center text-sm text-gray-800 w-full">
                  {formData.emergencyContactPhone || "-"}
                </div>
              ) : (
                <div className="w-full">
                  <Input
                    id="emergencyContactPhone"
                    name="emergencyContactPhone"
                    value={formData.emergencyContactPhone || ""}
                    onChange={handleChange}
                    className={
                      errors.emergencyContactPhone ? "border-red-500" : ""
                    }
                    data-error={!!errors.emergencyContactPhone}
                  />
                  <FormError message={errors.emergencyContactPhone} />
                </div>
              )}
            </div>
            <div>
              <Label htmlFor="emergencyContactEmail" className="mb-1 block">
                Email
              </Label>
              {mode === "view" ? (
                <div className="min-h-[40px] px-3 py-2 bg-gray-50 rounded-md border border-gray-200 flex items-center text-sm text-gray-800 w-full">
                  {formData.emergencyContactEmail || "-"}
                </div>
              ) : (
                <div className="w-full">
                  <Input
                    id="emergencyContactEmail"
                    name="emergencyContactEmail"
                    type="email"
                    value={formData.emergencyContactEmail || ""}
                    onChange={handleChange}
                    className={
                      errors.emergencyContactEmail ? "border-red-500" : ""
                    }
                    data-error={!!errors.emergencyContactEmail}
                  />
                  <FormError message={errors.emergencyContactEmail} />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-4 pt-6 border-t border-gray-200">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
        {mode !== "view" && (
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting
              ? "Saving..."
              : mode === "create"
              ? "Create Employee"
              : "Save Changes"}
          </Button>
        )}
      </div>
    </form>
  );
}
