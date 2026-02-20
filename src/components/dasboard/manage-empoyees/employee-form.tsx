"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
  CURRENT_STATUS,
  EMPLOYMENT_STATUS,
  Employee,
  validateEmployee,
  validatePartialEmployee,
} from "@/lib/validations/employees";
import { useCallback, useState, useEffect, useMemo } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { listDepartmentOptions } from "@/actions/organization/departments-action";
import {
  createEmployee,
  getEmployeeById,
  getGeneratedEmployeeCode,
  updateEmployee,
} from "@/actions/employees/employees-action";
import { listPositions } from "@/actions/organization/positions-action";
import {
  NATIONALITIES,
  EMERGENCY_RELATIONSHIPS,
} from "@/lib/employees/options";

const ensureOption = (
  options: readonly string[],
  current?: string | null,
): string[] => {
  const list = Array.from(options);
  if (current && !list.includes(current)) {
    list.push(current);
  }
  return list;
};

const ACCEPTED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
];
const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;

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
  employeeId: string | null; // Changed from 'id' to 'employeeId'
  mode: "create" | "view" | "edit";
  initialData?: Partial<Employee> | null;
};

function getEmployeesBasePath(pathname: string): string {
  const segments = pathname.split("/").filter(Boolean);
  const employeesIndex = segments.indexOf("employees");

  if (employeesIndex === -1) {
    return "/admin/employees";
  }

  return `/${segments.slice(0, employeesIndex + 1).join("/")}`;
}

export default function EmployeeForm({
  employeeId,
  mode,
  initialData = null,
}: EmployeeFormProps) {
  const router = useRouter();
  const pathname = usePathname();
  const employeesBasePath = useMemo(
    () => getEmployeesBasePath(pathname),
    [pathname],
  );
  const [formData, setFormData] = useState<Partial<Employee>>(() => {
    if (initialData) {
      return {
        employeeCode: initialData.employeeCode || "",
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
        img: initialData.img ?? null,
        isEnded: initialData.isEnded ?? false,
      };
    }
    return {
      employeeCode: "",
      firstName: "",
      lastName: "",
      suffix: "",
      email: "",
      phone: "",
      emergencyContactName: "",
      emergencyContactRelationship: "",
      emergencyContactPhone: "",
      emergencyContactEmail: "",
      isEnded: false,
      img: null,
    };
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isImageUploading, setIsImageUploading] = useState(false);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const nationalityOptions = ensureOption(
    NATIONALITIES,
    formData.nationality || null,
  );
  const emergencyRelationshipOptions = ensureOption(
    EMERGENCY_RELATIONSHIPS,
    formData.emergencyContactRelationship || null,
  );
  const [departments, setDepartments] = useState<
    { departmentId: string; name: string }[]
  >([]);
  const [positions, setPositions] = useState<
    {
      positionId: string;
      name: string;
      departmentId: string;
      department?: { departmentId: string; name: string } | null;
    }[]
  >([]);

  const fetchGeneratedEmployeeCode = useCallback(async () => {
    try {
      const result = await getGeneratedEmployeeCode();
      if (!result.success || typeof result.employeeCode !== "string") {
        throw new Error("Invalid employee code response");
      }
      return result.employeeCode;
    } catch (error) {
      console.error("Error fetching employee code:", error);
      // Fallback to a local random code if the API fails
      return `EMP-${Math.floor(Math.random() * 1000)
        .toString()
        .padStart(3, "0")}`;
    }
  }, []);

  // Initialize form data
  useEffect(() => {
    const fetchEmployee = async () => {
      try {
        if (mode !== "create" && employeeId && !initialData) {
          const result = await getEmployeeById(employeeId);
          if (!result.success || !result.data) {
            throw new Error(result.error || "Failed to fetch employee data");
          }
          const data = result.data;
          setFormData({
            ...data,
            img: data.img ?? null,
            isEnded: data.isEnded ?? false,
          });
          return;
        }

        if (initialData) {
          setFormData({
            ...initialData,
            img: initialData.img ?? null,
            isEnded: initialData.isEnded ?? false,
          });
          return;
        }

        const employeeCode = await fetchGeneratedEmployeeCode();
        setFormData({
          employeeCode,
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
          isEnded: false,
          endDate: null,
          positionId: null,
          departmentId: null,
          sex: "MALE",
          civilStatus: "SINGLE",
          nationality: "",
          birthdate: new Date(),
          address: "",
          img: null,
        });
      } catch (error) {
        console.error("Error fetching employee:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchEmployee();

    // Load departments/positions from API for selects
    const fetchLookups = async () => {
      try {
        const [deptResult, posResult] = await Promise.all([
          listDepartmentOptions(),
          listPositions(),
        ]);
        if (deptResult.success) {
          setDepartments(deptResult.data ?? []);
        }
        if (posResult.success) {
          setPositions(posResult.data ?? []);
        }
      } catch (err) {
        console.error("Failed to load departments/positions", err);
      }
    };

    fetchLookups();
  }, [employeeId, mode, initialData, fetchGeneratedEmployeeCode]);

  const filteredPositions = useMemo(() => {
    if (!formData.departmentId) return positions;
    return positions.filter((p) => p.departmentId === formData.departmentId);
  }, [positions, formData.departmentId]);

  const handleDepartmentChange = (value: string) => {
    handleSelectChange("departmentId", value);
    handleSelectChange("positionId", "");
  };

  const validateField = (name: string, value: unknown) => {
    // Create a temporary object with the new value
    const tempData = { ...formData, [name]: value };

    // Prepare data for validation
    const validationData = {
      ...tempData,
      // Ensure img is either a valid URL, base64 string, or null
      img: tempData.img || null,
    };

    // Validate the field using the appropriate schema
    const schema =
      mode === "create" ? validateEmployee : validatePartialEmployee;
    const result = schema(validationData);

    if (!result.success) {
      // Find the error for this specific field
      const fieldError = result.error.issues.find(
        (issue) => issue.path[0] === name,
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
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    if (mode === "view") return; // Prevent changes in view mode

    const { name, value } = e.target;

    if (name === "employeeCode") {
      return;
    }

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

    setFormData((prev) => {
      const updated: Partial<Employee> = {
        ...prev,
        [name]: value,
      };

      if (name === "currentStatus") {
        const requiresEndDate = value === "ENDED" || value === "INACTIVE";
        updated.isEnded = requiresEndDate;
        if (!requiresEndDate) {
          updated.endDate = null;
        }
      }

      return updated;
    });

    validateField(name as string, value);
  };

  const uploadEmployeeImage = async (file: File) => {
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      setErrors((prev) => ({
        ...prev,
        img: "Invalid image type. Use JPG, PNG, WEBP, or GIF.",
      }));
      return;
    }

    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      setErrors((prev) => ({
        ...prev,
        img: "Image must be 5 MB or smaller.",
      }));
      return;
    }

    setIsImageUploading(true);
    setErrors((prev) => {
      const next = { ...prev };
      delete next.img;
      return next;
    });

    try {
      const body = new FormData();
      body.append("file", file);

      const response = await fetch("/api/uploads/employee-photo", {
        method: "POST",
        body,
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok || typeof payload?.url !== "string") {
        throw new Error(payload?.error || "Failed to upload image");
      }

      setFormData((prev) => ({
        ...prev,
        img: payload.url,
      }));
      validateField("img", payload.url);
    } catch (error) {
      setErrors((prev) => ({
        ...prev,
        img: error instanceof Error ? error.message : "Failed to upload image",
      }));
    } finally {
      setIsImageUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === "view") return; // Prevent form submission in view mode
    if (isImageUploading) {
      setErrors((prev) => ({
        ...prev,
        img: "Please wait for the image upload to finish.",
      }));
      return;
    }

    // Prepare form data for submission
    const submissionData = {
      ...formData,
      // The schema will handle the img transformation}
      isEnded: Boolean(formData.isEnded),
      img: formData.img || null,
    };

    if (mode !== "create") {
      delete submissionData.employeeCode;
    }

    console.log("Form submitted with data:", submissionData);
    setIsSubmitting(true);
    setErrors({});

    try {
      // Validate the form data with the prepared submission data
      const validationResult =
        mode === "create"
          ? validateEmployee(submissionData)
          : validatePartialEmployee(submissionData);

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
        console.log("Creating new employee with data:", submissionData);
        result = await createEmployee(
          submissionData as Parameters<typeof createEmployee>[0],
        );
        console.log("Create employee result:", result);
      } else if (employeeId) {
        console.log(
          "Updating employee with ID:",
          employeeId,
          "Data:",
          submissionData,
        );
        result = await updateEmployee({
          ...submissionData,
          employeeId: employeeId, // Changed from 'id' to 'employeeId'
        } as Parameters<typeof updateEmployee>[0]);
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
        `Employee ${mode === "create" ? "created" : "updated"} successfully!`,
      );

      // Redirect back to employees list
      router.push(employeesBasePath);
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

  const shouldShowEndDateField =
    formData.currentStatus === "ENDED" || formData.currentStatus === "INACTIVE";

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8 p-6">
      <div className="space-y-5">
        {/* ========== PROFILE & PERSONAL INFO SECTION ========== */}
        <section className="space-y-6 rounded-xl border border-border/70 bg-muted/10 p-4 md:p-6">
          <div className="flex flex-col md:flex-row gap-8">
          {/* ========== PROFILE IMAGE SECTION ========== */}
          <div className="w-full md:w-48 space-y-4">
            <h4 className="font-medium text-sm text-foreground">
              Profile Image
            </h4>
            <div className="flex justify-center">
              <div className="relative">
                {mode === "view" && formData.img ? (
                  <button
                    type="button"
                    className="h-32 w-32 rounded-full overflow-hidden border border-border bg-muted cursor-zoom-in focus:outline-none focus:ring-2 focus:ring-ring"
                    onClick={() => setIsImageModalOpen(true)}
                    aria-label="View profile image"
                  >
                    <img
                      src={formData.img}
                      alt={formData.firstName || "Profile"}
                      className="h-full w-full object-cover"
                    />
                  </button>
                ) : (
                  <div className="h-32 w-32 rounded-full overflow-hidden border border-border bg-muted">
                    <img
                      src={formData.img || "/default-avatar.png"}
                      alt={formData.firstName || "Profile"}
                      className="h-full w-full object-cover"
                    />
                  </div>
                )}
                {mode !== "view" && (
                  <>
                    <input
                      id="image-upload"
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={async (e) => {
                        const input = e.currentTarget;
                        const file = input.files?.[0];
                        if (file) {
                          await uploadEmployeeImage(file);
                        }
                        input.value = "";
                      }}
                    />
                    <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-card/90 backdrop-blur-sm rounded-full border border-border px-2 py-1 shadow-sm">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        disabled={isImageUploading}
                        className="h-7 w-7 text-foreground hover:text-foreground"
                        onClick={() =>
                          document.getElementById("image-upload")?.click()
                        }
                        aria-label="Change photo"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      {formData.img && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          disabled={isImageUploading}
                          className="h-7 w-7 text-destructive hover:text-destructive/80"
                          onClick={() => {
                            setFormData((prev) => ({ ...prev, img: null }));
                          }}
                          aria-label="Remove photo"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
            {mode !== "view" && (
              <div className="text-center">
                {isImageUploading && (
                  <p className="text-xs text-muted-foreground">Uploading...</p>
                )}
                <FormError message={errors.img} />
              </div>
            )}
            {mode === "view" && formData.img && (
              <Dialog
                open={isImageModalOpen}
                onOpenChange={setIsImageModalOpen}
              >
                <DialogContent className="max-w-3xl p-2">
                  <DialogTitle className="sr-only">
                    Employee profile image
                  </DialogTitle>
                  <img
                    src={formData.img}
                    alt={formData.firstName || "Profile"}
                    className="w-full max-h-[80vh] object-contain rounded-md"
                  />
                </DialogContent>
              </Dialog>
            )}
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
                      <div className="min-h-[46px] px-3 py-2 bg-muted/30 rounded-lg border border-border flex items-center text-sm text-foreground w-full">
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
                      <div className="min-h-[46px] px-3 py-2 bg-muted/30 rounded-lg border border-border flex items-center text-sm text-foreground w-full">
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
                      <div className="min-h-[46px] px-3 py-2 bg-muted/30 rounded-lg border border-border flex items-center text-sm text-foreground w-24">
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
                            errors.suffix
                              ? "border-destructive"
                              : "border-border"
                          } bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring`}
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
                      <div className="min-h-[46px] px-3 py-2 bg-muted/30 rounded-lg border border-border flex items-center text-sm text-foreground w-full">
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
                      <div className="min-h-[46px] px-3 py-2 bg-muted/30 rounded-lg border border-border flex items-center text-sm text-foreground w-full">
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
                      <div className="min-h-[46px] px-3 py-2 bg-muted/30 rounded-lg border border-border flex items-center text-sm text-foreground w-24">
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
                              errors.sex
                                ? "border-destructive"
                                : "border-border"
                            } bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring`}
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
                      <div className="min-h-[46px] px-3 py-2 bg-muted/30 rounded-lg border border-border flex items-center text-sm text-foreground w-full">
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
                              ? "border-destructive"
                              : "border-border"
                          } bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring`}
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
                      <div className="min-h-[46px] px-3 py-2 bg-muted/30 rounded-lg border border-border flex items-center text-sm text-foreground w-full">
                        {formData.nationality || "-"}
                      </div>
                    ) : (
                      <div className="w-full">
                        <select
                          id="nationality"
                          name="nationality"
                          value={formData.nationality || ""}
                          onChange={(e) =>
                            handleSelectChange("nationality", e.target.value)
                          }
                          className={`w-full h-10 px-3 py-2 rounded-md border ${
                            errors.nationality
                              ? "border-destructive"
                              : "border-border"
                          } bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring`}
                          required
                        >
                          <option value="">Select nationality</option>
                          {nationalityOptions.map((nationality) => (
                            <option key={nationality} value={nationality}>
                              {nationality}
                            </option>
                          ))}
                        </select>
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
                      <div className="min-h-[46px] px-3 py-2 bg-muted/30 rounded-lg border border-border flex items-center text-sm text-foreground w-full">
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
                      <div className="min-h-[46px] px-3 py-2 bg-muted/30 rounded-lg border border-border flex items-center text-sm text-foreground w-full">
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
        </section>
        {/* ========== EMPLOYEE DESCRIPTION SECTION ========== */}
        <section className="space-y-2 rounded-xl border border-border/70 bg-muted/10 p-4 md:p-6">
          <Label htmlFor="description" className="mb-1 block">
            Description
          </Label>
          {mode === "view" ? (
            <div className="min-h-[100px] px-3 py-2 bg-muted/30 rounded-lg border border-border text-sm text-foreground w-full">
              {formData.description || "-"}
            </div>
          ) : (
            <textarea
              id="description"
              name="description"
              value={formData.description || ""}
              onChange={handleChange}
              className="flex rounded-md border border-input bg-card px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 min-h-[100px] w-full"
            />
          )}
        </section>

        {/* ========== CONTACT INFORMATION SECTION ========== */}
        <section className="space-y-4 rounded-xl border border-border/70 bg-muted/10 p-4 md:p-6">
          <h4 className="font-medium">Contact Information</h4>
          <div className="space-y-4">
            {/* Address */}
            <div>
              <Label htmlFor="address" className="mb-1 block">
                Address
              </Label>
              {mode === "view" ? (
                <div className="min-h-[46px] px-3 py-2 bg-muted/30 rounded-lg border border-border flex items-center text-sm text-foreground w-full">
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
                  <div className="min-h-[46px] px-3 py-2 bg-muted/30 rounded-lg border border-border flex items-center text-sm text-foreground w-full">
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
                  <div className="min-h-[46px] px-3 py-2 bg-muted/30 rounded-lg border border-border flex items-center text-sm text-foreground w-full">
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
                  <div className="min-h-[46px] px-3 py-2 bg-muted/30 rounded-lg border border-border flex items-center text-sm text-foreground w-full">
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
                  <div className="min-h-[46px] px-3 py-2 bg-muted/30 rounded-lg border border-border flex items-center text-sm text-foreground w-full">
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
        </section>
        {/* ========== EMPLOYEMENT INFORMATION SECTION ========== */}
        <section className="space-y-4 rounded-xl border border-border/70 bg-muted/10 p-4 md:p-6">
          <h4 className="font-medium">Employment Information</h4>
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            <div className="md:col-span-3">
              <Label htmlFor="employeeCode" className="mb-1 block">
                Employee Code
              </Label>
              {mode === "view" ? (
                <div className="min-h-[46px] px-3 py-2 bg-muted/30 rounded-lg border border-border flex items-center text-sm text-foreground w-full">
                  {formData.employeeCode || "-"}
                </div>
              ) : (
                <div className="w-full">
                  <Input
                    id="employeeCode"
                    name="employeeCode"
                    value={formData.employeeCode || ""}
                    readOnly
                    className={errors.employeeCode ? "border-red-500" : ""}
                    data-error={!!errors.employeeCode}
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    Employee code is auto-generated and cannot be edited.
                  </p>
                  <FormError message={errors.employeeCode} />
                </div>
              )}
            </div>
            <div className="md:col-span-5">
              <Label htmlFor="departmentId" className="mb-1 block">
                Department
              </Label>
              {mode === "view" ? (
                <div className="min-h-[46px] px-3 py-2 bg-muted/30 rounded-lg border border-border flex items-center text-sm text-foreground w-full">
                  {departments.find(
                    (d) => d.departmentId === formData.departmentId,
                  )?.name || "-"}
                </div>
              ) : (
                <div className="w-full">
                  <select
                    id="departmentId"
                    name="departmentId"
                    value={formData.departmentId || ""}
                    onChange={(e) =>
                      handleDepartmentChange(e.target.value || "")
                    }
                    className={`w-full h-10 px-3 py-2 rounded-md border ${
                      errors.departmentId
                        ? "border-destructive"
                        : "border-border"
                    } bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring`}
                  >
                    <option value="">Select department</option>
                    {departments.map((department) => (
                      <option
                        key={department.departmentId}
                        value={department.departmentId}
                      >
                        {department.name}
                      </option>
                    ))}
                  </select>
                  <FormError message={errors.departmentId} />
                </div>
              )}
            </div>
            <div className="md:col-span-4">
              <Label htmlFor="positionId" className="mb-1 block">
                Position
              </Label>
              {mode === "view" ? (
                <div className="min-h-[46px] px-3 py-2 bg-muted/30 rounded-lg border border-border flex items-center text-sm text-foreground w-full">
                  {positions.find((p) => p.positionId === formData.positionId)
                    ?.name || "-"}
                </div>
              ) : (
                <div className="w-full">
                  <select
                    id="positionId"
                    name="positionId"
                    value={formData.positionId || ""}
                    onChange={(e) =>
                      handleSelectChange("positionId", e.target.value || "")
                    }
                    className={`w-full h-10 px-3 py-2 rounded-md border ${
                      errors.positionId ? "border-destructive" : "border-border"
                    } bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring`}
                    disabled={
                      !filteredPositions.length && !!formData.departmentId
                    }
                  >
                    <option value="">Select position</option>
                    {filteredPositions.map((position) => (
                      <option
                        key={position.positionId}
                        value={position.positionId}
                      >
                        {position.name}
                      </option>
                    ))}
                  </select>
                  <FormError message={errors.positionId} />
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
                <div className="min-h-[46px] px-3 py-2 bg-muted/30 rounded-lg border border-border flex items-center text-sm text-foreground w-full">
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
                formData.endDate && shouldShowEndDateField ? (
                  <div className="min-h-[46px] px-3 py-2 bg-muted/30 rounded-lg border border-border flex items-center text-sm text-foreground w-full">
                    {new Date(formData.endDate).toLocaleDateString()}
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">
                    Not applicable
                  </div>
                )
              ) : shouldShowEndDateField ? (
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
              ) : (
                <div className="text-sm text-muted-foreground">
                  Select ENDED or INACTIVE to set an end date
                </div>
              )}
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="employmentStatus" className="mb-1 block">
                Employment Status
              </Label>
              {mode === "view" ? (
                <div className="min-h-[46px] px-3 py-2 bg-muted/30 rounded-lg border border-border flex items-center text-sm text-foreground w-full">
                  {formData.employmentStatus || "-"}
                </div>
              ) : (
                <select
                  id="employmentStatus"
                  name="employmentStatus"
                  value={formData.employmentStatus || ""}
                  onChange={(e) =>
                    handleSelectChange("employmentStatus", e.target.value)
                  }
                  className="w-full h-10 px-3 py-2 rounded-md border border-border bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring"
                >
                  <option value="">Select employment status</option>
                  {EMPLOYMENT_STATUS.map((status) => (
                    <option key={status} value={status}>
                      {status.charAt(0) + status.slice(1).toLowerCase()}
                    </option>
                  ))}
                </select>
              )}
            </div>
            <div>
              <Label htmlFor="currentStatus" className="mb-1 block">
                Current Status
              </Label>
              {mode === "view" ? (
                <div className="min-h-[46px] px-3 py-2 bg-muted/30 rounded-lg border border-border flex items-center text-sm text-foreground w-full">
                  {formData.currentStatus || "-"}
                </div>
              ) : (
                <select
                  id="currentStatus"
                  name="currentStatus"
                  value={formData.currentStatus || ""}
                  onChange={(e) =>
                    handleSelectChange("currentStatus", e.target.value)
                  }
                  className="w-full h-10 px-3 py-2 rounded-md border border-border bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring"
                >
                  <option value="">Select current status</option>
                  {CURRENT_STATUS.map((status) => (
                    <option key={status} value={status}>
                      {status
                        .split("_")
                        .map(
                          (word) =>
                            word.charAt(0) + word.slice(1).toLowerCase(),
                        )
                        .join(" ")}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>
        </section>

        {/* ========== EMERGENCY CONTACT SECTION ========== */}
        <section className="space-y-4 rounded-xl border border-border/70 bg-muted/10 p-4 md:p-6">
          <h4 className="font-medium">Emergency Contact</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="emergencyContactName" className="mb-1 block">
                Full Name
              </Label>
              {mode === "view" ? (
                <div className="min-h-[46px] px-3 py-2 bg-muted/30 rounded-lg border border-border flex items-center text-sm text-foreground w-full">
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
                <div className="min-h-[46px] px-3 py-2 bg-muted/30 rounded-lg border border-border flex items-center text-sm text-foreground w-full">
                  {formData.emergencyContactRelationship || "-"}
                </div>
              ) : (
                <div className="w-full">
                  <select
                    id="emergencyContactRelationship"
                    name="emergencyContactRelationship"
                    value={formData.emergencyContactRelationship || ""}
                    onChange={(e) =>
                      handleSelectChange(
                        "emergencyContactRelationship",
                        e.target.value,
                      )
                    }
                    className={`w-full h-10 px-3 py-2 rounded-md border ${
                      errors.emergencyContactRelationship
                        ? "border-destructive"
                        : "border-border"
                    } bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring`}
                  >
                    <option value="">Select relationship</option>
                    {emergencyRelationshipOptions.map((relationship) => (
                      <option key={relationship} value={relationship}>
                        {relationship}
                      </option>
                    ))}
                  </select>
                  <FormError message={errors.emergencyContactRelationship} />
                </div>
              )}
            </div>
            <div>
              <Label htmlFor="emergencyContactPhone" className="mb-1 block">
                Phone Number
              </Label>
              {mode === "view" ? (
                <div className="min-h-[46px] px-3 py-2 bg-muted/30 rounded-lg border border-border flex items-center text-sm text-foreground w-full">
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
                <div className="min-h-[46px] px-3 py-2 bg-muted/30 rounded-lg border border-border flex items-center text-sm text-foreground w-full">
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
        </section>
      </div>

      <div className="flex justify-end gap-4 pt-6">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
        {mode !== "view" && (
          <Button type="submit" disabled={isSubmitting || isImageUploading}>
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
