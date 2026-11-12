import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  Box,
  Button,
  CircularProgress,
  Divider,
  FormControl,
  MenuItem,
  Select,
  TextField,
  Typography,
} from "@mui/material";
import {
  ArrowBackRounded,
  ArrowForwardRounded,
  PersonAddAltOutlined,
  WorkOutlined,
} from "@mui/icons-material";
import { useNavigate } from "react-router-dom";

import AppLayout from "../../components/layout/AppLayout";
import api from "../../services/api";
import { getErrorMessage } from "../../utils/errors";
import type { StatusChangeResponse } from "../../types/employee";
import ActionToast from "../../components/common/ActionToast";

const FONT = "'Montserrat', sans-serif";
const INK = "#16181D";
const TEAL = "#16181D";
const MUTED = "#6B6F76";
const BORDER = "#DAD7CF";

interface LookupItem {
  id: number;
  name: string;
}

interface Lookups {
  roles: LookupItem[];
  departments: LookupItem[];
  designations: LookupItem[];
  managers: LookupItem[];
}

const fieldSx = {
  "& .MuiOutlinedInput-root": {
    minHeight: 48,
    borderRadius: "10px",
    backgroundColor: "#FFFFFF",
    fontFamily: FONT,
    fontSize: "13px",

    "& fieldset": {
      border: `1px solid ${BORDER}`,
    },

    "&:hover fieldset": {
      borderColor: "#A9A69D",
    },

    "&.Mui-focused fieldset": {
      borderColor: TEAL,
      borderWidth: "1.5px",
    },
  },

  "& input::placeholder": {
    color: "#9A9CA2",
    opacity: 1,
  },
};

const labelSx = {
  display: "block",
  fontFamily: FONT,
  fontSize: "12px",
  fontWeight: 600,
  color: INK,
  marginBottom: "6px",
};

const twoColumnSx = {
  display: "grid",
  gridTemplateColumns: {
    xs: "1fr",
    md: "1fr 1fr",
  },
  gap: 2.5,
};

const sectionTitleSx = {
  fontFamily: FONT,
  fontSize: "16px",
  fontWeight: 700,
  color: INK,
};

const sectionHeaderSx = {
  display: "flex",
  alignItems: "center",
  gap: 1.2,
  mb: 2,
};

interface SelectFieldProps {
  label: string;
  placeholder: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
  error?: string;
}

function SelectField({
  label,
  placeholder,
  value,
  options,
  onChange,
  error,
}: SelectFieldProps) {
  return (
    <Box>
      <Typography sx={labelSx}>{label}</Typography>

      <FormControl fullWidth sx={fieldSx} error={Boolean(error)}>
        <Select
          displayEmpty
          value={value}
          onChange={(event) => onChange(event.target.value as string)}
          renderValue={(selected) =>
            selected ? (
              options.find((option) => option.value === selected)?.label
            ) : (
              <span style={{ color: "#9A9CA2" }}>{placeholder}</span>
            )
          }
        >
          {options.map((option) => (
            <MenuItem
              key={option.value}
              value={option.value}
              sx={{ fontFamily: FONT, fontSize: "13px" }}
            >
              {option.label}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      {error && (
        <Typography sx={{ fontFamily: FONT, fontSize: "11px", color: "#DC2626", mt: 0.5 }}>
          {error}
        </Typography>
      )}
    </Box>
  );
}

const TODAY = new Date().toISOString().split("T")[0];

export default function CreateEmployee() {
  const navigate = useNavigate();

  const [lookups, setLookups] = useState<Lookups | null>(null);

  // Form Fields (preserved on submission failure)
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [roleId, setRoleId] = useState("");
  const [dateOfJoining, setDateOfJoining] = useState("");
  const [dob, setDob] = useState("");
  const [employmentType, setEmploymentType] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [designationId, setDesignationId] = useState("");
  const [managerId, setManagerId] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState("");
  const [success, setSuccess] = useState("");
  const [created, setCreated] = useState<{
    employee_id: number;
    employee_code: string;
    email: string;
  } | null>(null);
  const [inviting, setInviting] = useState(false);
  const [inviteMessage, setInviteMessage] = useState("");

  const fetchLookups = useCallback(async () => {
    try {
      const response = await api.get("/employees/lookups");
      setLookups(response.data);
    } catch (err: unknown) {
      setGeneralError(getErrorMessage(err, "Unable to load employee options."));
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      await fetchLookups();
      setLoading(false);
    };

    init();
  }, [fetchLookups]);

  // Client-side validation function
  const validate = (): boolean => {
    const errors: Record<string, string> = {};

    // 1. First & Last Names: reject empty or whitespace-only
    const trimmedFirst = firstName.trim();
    const trimmedLast = lastName.trim();
    if (!trimmedFirst) {
      errors.firstName = "First name is required and cannot be whitespace only.";
    }
    if (!trimmedLast) {
      errors.lastName = "Last name is required and cannot be whitespace only.";
    }

    // 2. Email format & normalization
    const trimmedEmail = email.trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!trimmedEmail) {
      errors.email = "Email is required.";
    } else if (!emailRegex.test(trimmedEmail)) {
      errors.email = "Please enter a valid email address.";
    }

    // 3. Required selections
    if (!roleId) errors.roleId = "Role selection is required.";
    if (!employmentType) errors.employmentType = "Employment type is required.";
    if (!departmentId) errors.departmentId = "Department is required.";
    if (!designationId) errors.designationId = "Designation is required.";

    // 4. Date of Joining: past, today or a future start date are all fine
    if (!dateOfJoining) {
      errors.dateOfJoining = "Date of joining is required.";
    }

    // 5. Date of Birth and Age: not in future, at least 18 years old
    if (dob) {
      if (dob > TODAY) {
        errors.dob = "Date of birth cannot be in the future.";
      } else {
        const birthDate = new Date(dob);
        const todayDate = new Date();
        let age = todayDate.getFullYear() - birthDate.getFullYear();
        const m = todayDate.getMonth() - birthDate.getMonth();
        if (m < 0 || (m === 0 && todayDate.getDate() < birthDate.getDate())) {
          age--;
        }
        if (age < 18) {
          errors.dob = "Employee must be at least 18 years old.";
        }
      }
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!validate()) {
      setGeneralError("Please fix the validation errors below.");
      return;
    }

    setGeneralError("");
    setSuccess("");
    setCreated(null);
    setInviteMessage("");
    setSaving(true);

    try {
      const response = await api.post("/employees", {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        email: email.trim().toLowerCase(),
        role_id: Number(roleId),
        date_of_joining: dateOfJoining,
        dob: dob || null,
        employment_type: employmentType,
        department_id: Number(departmentId),
        designation_id: Number(designationId),
        manager_id: managerId ? Number(managerId) : null,
      });

      setSuccess(
        `Employee ${response.data.employee_code} created successfully as Inactive.`
      );

      setCreated({
        employee_id: response.data.employee_id,
        employee_code: response.data.employee_code,
        email: response.data.email,
      });

      // Reset form
      setFirstName("");
      setLastName("");
      setEmail("");
      setRoleId("");
      setDateOfJoining("");
      setDob("");
      setEmploymentType("");
      setDepartmentId("");
      setDesignationId("");
      setManagerId("");
      setFormErrors({});

      await fetchLookups();
    } catch (err: unknown) {
      setGeneralError(getErrorMessage(err, "Unable to create employee."));
    } finally {
      setSaving(false);
    }
  };

  const handleInviteNow = async () => {
    if (!created) return;

    setInviting(true);
    setGeneralError("");
    setSuccess("");

    try {
      await api.patch<StatusChangeResponse>(
        `/employees/${created.employee_id}/status`,
        { status: "ACTIVE" }
      );

      setInviteMessage(
        `Employee activated successfully. Login details sent to ${created.email}.`
      );
      setCreated(null);
    } catch (err: unknown) {
      setGeneralError(getErrorMessage(err, "Unable to activate this employee."));
    } finally {
      setInviting(false);
    }
  };

  if (loading) {
    return (
      <AppLayout pageTitle="Create Employee">
        <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "60vh" }}>
          <CircularProgress sx={{ color: TEAL }} />
        </Box>
      </AppLayout>
    );
  }

  return (
    <AppLayout pageTitle="Create Employee">
      <Box sx={{ maxWidth: 980, mx: "auto" }}>
        <Button
          startIcon={<ArrowBackRounded />}
          onClick={() => navigate("/employees")}
          sx={{
            mb: 2,
            color: MUTED,
            fontFamily: FONT,
            textTransform: "none",
            fontWeight: 600,
            fontSize: "13px",
            "&:hover": { backgroundColor: "rgba(22,24,29,0.06)", color: TEAL },
          }}
        >
          Back to Employees
        </Button>

        <Box sx={{ mb: 3 }}>
          <Typography
            sx={{
              fontFamily: FONT,
              fontSize: "12px",
              fontWeight: 700,
              color: TEAL,
              textTransform: "uppercase",
              letterSpacing: "0.8px",
              mb: 0.5,
            }}
          >
            Provisioning
          </Typography>

          <Typography
            component="h2"
            sx={{
              fontFamily: FONT,
              fontSize: { xs: "24px", md: "30px" },
              fontWeight: 700,
              color: INK,
              letterSpacing: "-0.6px",
            }}
          >
            Create Employee
          </Typography>

          <Typography sx={{ fontFamily: FONT, fontSize: "14px", color: MUTED, mt: 0.5 }}>
            Create an employee account and assign their company details. Every new account starts Inactive. Activating it generates a temporary password and prints the formal login email in the backend terminal until email delivery is configured.
          </Typography>
        </Box>

        <Box
          component="form"
          onSubmit={handleSubmit}
          noValidate
          sx={{
            backgroundColor: "#FFFFFF",
            border: `1px solid ${BORDER}`,
            borderRadius: "20px",
            p: { xs: 2.5, md: 4 },
            boxShadow: "0 4px 20px rgba(0,0,0,0.02)",
          }}
        >
          <ActionToast
            open={Boolean(generalError)}
            severity="error"
            message={generalError}
            onClose={() => setGeneralError("")}
          />

          <ActionToast
            open={Boolean(success)}
            severity="success"
            message={success}
            onClose={() => setSuccess("")}
          />

          {created && (
            <Box
              sx={{
                mb: 3,
                p: 2.5,
                borderRadius: "14px",
                backgroundColor: "rgba(59,130,246,0.07)",
                border: "1px solid rgba(59,130,246,0.25)",
              }}
            >
              <Typography sx={{ fontFamily: FONT, fontSize: "12px", fontWeight: 700, color: "#1D4ED8", textTransform: "uppercase", mb: 0.5 }}>
                Created as Inactive
              </Typography>

              <Typography sx={{ fontFamily: FONT, fontSize: "14px", color: INK, lineHeight: 1.6 }}>
                Activate {created.employee_code} now? A new temporary password will be generated and the login email prepared for <strong>{created.email}</strong>. For now, the complete email is printed in the backend terminal. You can also activate this employee later from the Employees page.
              </Typography>

              <Box sx={{ display: "flex", gap: 1.5, mt: 2 }}>
                <Button
                  variant="contained"
                  disableElevation
                  disabled={inviting}
                  onClick={handleInviteNow}
                  sx={{ textTransform: "none", fontFamily: FONT, fontWeight: 650, borderRadius: "10px", px: 2.5, backgroundColor: "var(--hrms-btn-primary-bg)", color: "var(--hrms-btn-primary-text)", "&:hover": { backgroundColor: "var(--hrms-btn-primary-hover)" } }}
                >
                  {inviting ? <CircularProgress size={18} sx={{ color: "var(--hrms-btn-primary-text)" }} /> : "Activate now"}
                </Button>

                <Button
                  disabled={inviting}
                  onClick={() => setCreated(null)}
                  sx={{ textTransform: "none", fontFamily: FONT, fontWeight: 600, color: MUTED }}
                >
                  Later
                </Button>
              </Box>
            </Box>
          )}

          <ActionToast
            open={Boolean(inviteMessage)}
            severity="success"
            message={inviteMessage}
            onClose={() => setInviteMessage("")}
          />

          {/* Basic information */}
          <Box sx={sectionHeaderSx}>
            <PersonAddAltOutlined sx={{ color: TEAL }} />
            <Typography sx={sectionTitleSx}>Basic Information</Typography>
          </Box>

          <Box sx={twoColumnSx}>
            <Box>
              <Typography sx={labelSx}>First Name *</Typography>
              <TextField
                fullWidth
                value={firstName}
                onChange={(e) => {
                  setFirstName(e.target.value);
                  if (formErrors.firstName) setFormErrors({ ...formErrors, firstName: "" });
                }}
                error={Boolean(formErrors.firstName)}
                helperText={formErrors.firstName}
                placeholder="Enter first name"
                sx={fieldSx}
              />
            </Box>

            <Box>
              <Typography sx={labelSx}>Last Name *</Typography>
              <TextField
                fullWidth
                value={lastName}
                onChange={(e) => {
                  setLastName(e.target.value);
                  if (formErrors.lastName) setFormErrors({ ...formErrors, lastName: "" });
                }}
                error={Boolean(formErrors.lastName)}
                helperText={formErrors.lastName}
                placeholder="Enter last name"
                sx={fieldSx}
              />
            </Box>

            <Box>
              <Typography sx={labelSx}>Email Address *</Typography>
              <TextField
                fullWidth
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (formErrors.email) setFormErrors({ ...formErrors, email: "" });
                }}
                error={Boolean(formErrors.email)}
                helperText={formErrors.email}
                placeholder="employee@company.com"
                sx={fieldSx}
              />
            </Box>

            <Box>
              <Typography sx={labelSx}>Date of Birth (Optional)</Typography>
              <TextField
                fullWidth
                type="date"
                value={dob}
                onChange={(e) => {
                  setDob(e.target.value);
                  if (formErrors.dob) setFormErrors({ ...formErrors, dob: "" });
                }}
                error={Boolean(formErrors.dob)}
                helperText={formErrors.dob || "Must be at least 18 years old"}
                slotProps={{ htmlInput: { max: TODAY } }}
                sx={fieldSx}
              />
            </Box>
          </Box>

          <Divider sx={{ my: 3.5, borderColor: BORDER }} />

          {/* Employment details */}
          <Box sx={sectionHeaderSx}>
            <WorkOutlined sx={{ color: TEAL }} />
            <Typography sx={sectionTitleSx}>Employment Details</Typography>
          </Box>

          <Box sx={twoColumnSx}>
            <SelectField
              label="Assigned Role *"
              placeholder="Select role"
              value={roleId}
              onChange={(val) => {
                setRoleId(val);
                if (formErrors.roleId) setFormErrors({ ...formErrors, roleId: "" });
              }}
              error={formErrors.roleId}
              options={(lookups?.roles ?? []).map((r) => ({
                value: String(r.id),
                label: r.name,
              }))}
            />

            <SelectField
              label="Employment Type *"
              placeholder="Select employment type"
              value={employmentType}
              onChange={(val) => {
                setEmploymentType(val);
                if (formErrors.employmentType) setFormErrors({ ...formErrors, employmentType: "" });
              }}
              error={formErrors.employmentType}
              options={[
                { value: "FULL_TIME", label: "Full Time" },
                { value: "PART_TIME", label: "Part Time" },
                { value: "CONTRACT", label: "Contract" },
                { value: "INTERN", label: "Intern" },
              ]}
            />

            <Box>
              <Typography sx={labelSx}>Date of Joining *</Typography>
              <TextField
                fullWidth
                type="date"
                value={dateOfJoining}
                onChange={(e) => {
                  setDateOfJoining(e.target.value);
                  if (formErrors.dateOfJoining) setFormErrors({ ...formErrors, dateOfJoining: "" });
                }}
                error={Boolean(formErrors.dateOfJoining)}
                helperText={formErrors.dateOfJoining || "Any date, including a future start date"}
                sx={fieldSx}
              />
            </Box>

            <SelectField
              label="Department *"
              placeholder="Select department"
              value={departmentId}
              onChange={(val) => {
                setDepartmentId(val);
                if (formErrors.departmentId) setFormErrors({ ...formErrors, departmentId: "" });
              }}
              error={formErrors.departmentId}
              options={(lookups?.departments ?? []).map((d) => ({
                value: String(d.id),
                label: d.name,
              }))}
            />

            <SelectField
              label="Designation *"
              placeholder="Select designation"
              value={designationId}
              onChange={(val) => {
                setDesignationId(val);
                if (formErrors.designationId) setFormErrors({ ...formErrors, designationId: "" });
              }}
              error={formErrors.designationId}
              options={(lookups?.designations ?? []).map((d) => ({
                value: String(d.id),
                label: d.name,
              }))}
            />

            <SelectField
              label="Reporting Manager (Optional)"
              placeholder="Select manager"
              value={managerId}
              onChange={setManagerId}
              options={[
                { value: "", label: "None" },
                ...(lookups?.managers ?? []).map((m) => ({
                  value: String(m.id),
                  label: m.name,
                })),
              ]}
            />
          </Box>

          <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 1.5, mt: 4 }}>
            <Button
              type="button"
              onClick={() => navigate("/employees")}
              sx={{
                height: 48,
                px: 3,
                borderRadius: "10px",
                textTransform: "none",
                fontFamily: FONT,
                fontWeight: 600,
                color: MUTED,
              }}
            >
              Cancel
            </Button>

            <Button
              type="submit"
              disabled={saving}
              endIcon={!saving ? <ArrowForwardRounded /> : undefined}
              sx={{
                height: 48,
                px: 3.5,
                borderRadius: "10px",
                textTransform: "none",
                fontFamily: FONT,
                fontWeight: 650,
                color: "var(--hrms-btn-primary-text)",
                backgroundColor: "var(--hrms-btn-primary-bg)",
                "&:hover": { backgroundColor: "var(--hrms-btn-primary-hover)" },
                "&.Mui-disabled": {
                  backgroundColor: "var(--hrms-border)",
                  color: "var(--hrms-muted)",
                },
              }}
            >
              {saving ? <CircularProgress size={18} sx={{ color: "#FFFFFF" }} /> : "Create Employee"}
            </Button>
          </Box>
        </Box>
      </Box>
    </AppLayout>
  );
}