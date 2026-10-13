import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type HTMLAttributes,
} from "react";
import {
  Alert,
  Autocomplete,
  Avatar,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  TextField,
  Typography,
  createFilterOptions,
} from "@mui/material";
import {
  ArrowBackRounded,
  BusinessOutlined,
  EditOutlined,
  LocationOnOutlined,
  LockResetRounded,
  PersonOutlined,
  SaveOutlined,
} from "@mui/icons-material";
import { City, Country, State } from "country-state-city";
import type { ICountry, IState } from "country-state-city";
import { useNavigate, useParams } from "react-router-dom";

import AppLayout from "../../components/layout/AppLayout";
import api from "../../services/api";
import { getRoleId } from "../../utils/auth";
import { getErrorMessage } from "../../utils/errors";
import type { EmployeeProfile } from "../../types/employee";

const FONT = "'Montserrat', sans-serif";
const INK = "#16181D";
const TEAL = "#16181D";
const MUTED = "#6B6F76";
const BORDER = "#DAD7CF";

const ALL_COUNTRIES: ICountry[] = Country.getAllCountries();

function dialCode(country: ICountry): string {
  const first = country.phonecode.split(/\s*(?:and|,|&)\s*/i)[0];
  return "+" + first.replace(/\D/g, "");
}

const countryFilter = createFilterOptions<ICountry>({
  stringify: (c) => `${c.name} ${dialCode(c)} ${c.isoCode}`,
});

function parsePhone(phone: string | null) {
  const india = ALL_COUNTRIES.find((c) => c.isoCode === "IN") ?? null;
  if (!phone) return { country: india, number: "" };
  const match = phone.trim().match(/^(\+\d+)\s*(.*)$/);
  if (!match) return { country: india, number: phone.replace(/\D/g, "") };
  const found = ALL_COUNTRIES.find((c) => dialCode(c) === match[1]);
  return {
    country: found ?? india,
    number: match[2].replace(/\D/g, ""),
  };
}

const fieldSx = {
  "& .MuiOutlinedInput-root": {
    minHeight: 48,
    borderRadius: "10px",
    backgroundColor: "#FFFFFF",
    fontFamily: FONT,
    fontSize: "13px",
    "& fieldset": { borderColor: BORDER },
    "&:hover fieldset": { borderColor: "#A9A69D" },
    "&.Mui-focused fieldset": { borderColor: TEAL, borderWidth: "1.5px" },
  },
};



const labelSx = {
  display: "block",
  fontFamily: FONT,
  fontSize: "11px",
  fontWeight: 700,
  color: MUTED,
  textTransform: "uppercase",
  letterSpacing: "0.5px",
  mb: 0.6,
};

export default function ProfilePage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const roleId = getRoleId();
  const isHR = roleId === 1 || roleId === 2;

  // If `id` is provided in route and user is HR, we view/edit that specific employee
  const targetEmployeeId = id ? Number(id) : null;
  const isViewingSelf = !targetEmployeeId;

  const [profile, setProfile] = useState<EmployeeProfile | null>(null);
  const [employeeStatus, setEmployeeStatus] = useState<string>("ACTIVE");
  const [profileCompleted, setProfileCompleted] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  // Edit form state
  const [formData, setFormData] = useState<Partial<EmployeeProfile>>({});
  const [phoneCountry, setPhoneCountry] = useState<ICountry | null>(
    ALL_COUNTRIES.find((c) => c.isoCode === "IN") ?? null
  );
  const [phoneNumber, setPhoneNumber] = useState("");

  // Feedback banner
  const [banner, setBanner] = useState<{
    severity: "success" | "error";
    message: string;
    tempPassword?: string;
  } | null>(null);

  // Reset password dialog for HR
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [resettingPassword, setResettingPassword] = useState(false);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      if (isViewingSelf) {
        const { data } = await api.get<EmployeeProfile>("/employees/me");
        setProfile(data);
        setFormData(data);
        const parsed = parsePhone(data.phone);
        setPhoneCountry(parsed.country);
        setPhoneNumber(parsed.number);
      } else {
        const { data } = await api.get(`/employees/${targetEmployeeId}`);
        setProfile(data);
        setFormData(data);
        setEmployeeStatus(data.status || "ACTIVE");
        setProfileCompleted(Boolean(data.profile_completed));
        const parsed = parsePhone(data.phone);
        setPhoneCountry(parsed.country);
        setPhoneNumber(parsed.number);
      }
    } catch (err: unknown) {
      setBanner({
        severity: "error",
        message: getErrorMessage(err, "Failed to load employee profile."),
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, [id]);

  // Derived location selectors
  const selectedCountry = useMemo(
    () => ALL_COUNTRIES.find((c) => c.name === formData.country) ?? null,
    [formData.country]
  );

  const states: IState[] = useMemo(
    () => (selectedCountry ? State.getStatesOfCountry(selectedCountry.isoCode) : []),
    [selectedCountry]
  );

  const selectedState = useMemo(
    () => states.find((s) => s.name === formData.state) ?? null,
    [states, formData.state]
  );

  const cityOptions: string[] = useMemo(() => {
    if (!selectedCountry) return [];
    const cities = selectedState
      ? City.getCitiesOfState(selectedCountry.isoCode, selectedState.isoCode)
      : states.length === 0
      ? City.getCitiesOfCountry(selectedCountry.isoCode) ?? []
      : [];
    return Array.from(new Set(cities.map((c) => c.name)));
  }, [selectedCountry, selectedState, states]);

  const handleCountryChange = (country: ICountry | null) => {
    setFormData((prev) => ({
      ...prev,
      country: country?.name ?? "",
      state: "",
      city: "",
    }));
  };

  const handleStateChange = (state: IState | null) => {
    setFormData((prev) => ({
      ...prev,
      state: state?.name ?? "",
      city: "",
    }));
  };

  const handleStartEdit = () => {
    if (!profile) return;
    setFormData(profile);
    const parsed = parsePhone(profile.phone);
    setPhoneCountry(parsed.country);
    setPhoneNumber(parsed.number);
    setBanner(null);
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    if (!profile) return;
    setFormData(profile);
    const parsed = parsePhone(profile.phone);
    setPhoneCountry(parsed.country);
    setPhoneNumber(parsed.number);
    setBanner(null);
    setIsEditing(false);
  };

  const handleSaveProfile = async (e: FormEvent) => {
    e.preventDefault();
    setBanner(null);

    // Frontend validations
    const firstName = (formData.first_name || "").trim();
    const lastName = (formData.last_name || "").trim();

    if (!firstName || !lastName) {
      setBanner({
        severity: "error",
        message: "First Name and Last Name cannot be empty or whitespace only.",
      });
      return;
    }

    if (formData.dob) {
      const today = new Date();
      const birth = new Date(formData.dob);
      if (birth > today) {
        setBanner({
          severity: "error",
          message: "Date of birth cannot be in the future.",
        });
        return;
      }
      let age = today.getFullYear() - birth.getFullYear();
      const m = today.getMonth() - birth.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
        age--;
      }
      if (age < 18) {
        setBanner({
          severity: "error",
          message: "Employee must be at least 18 years old.",
        });
        return;
      }
    }

    const fullPhone =
      phoneNumber && phoneCountry
        ? `${dialCode(phoneCountry)} ${phoneNumber}`
        : null;

    setSaving(true);

    const payload = {
      first_name: firstName,
      last_name: lastName,
      phone: fullPhone,
      dob: formData.dob || null,
      address_line1: formData.address_line1?.trim() || null,
      address_line2: formData.address_line2?.trim() || null,
      city: formData.city?.trim() || null,
      state: formData.state?.trim() || null,
      country: formData.country?.trim() || null,
      pincode: formData.pincode?.trim() || null,
    };

    try {
      if (isViewingSelf) {
        const { data } = await api.put<EmployeeProfile>("/employees/me", payload);
        setProfile(data);
        setFormData(data);
      } else {
        const { data } = await api.put(`/employees/${targetEmployeeId}`, payload);
        setProfile(data);
        setFormData(data);
      }

      setBanner({
        severity: "success",
        message: "Profile updated successfully.",
      });
      setIsEditing(false);
    } catch (err: unknown) {
      setBanner({
        severity: "error",
        message: getErrorMessage(err, "Failed to save profile changes."),
      });
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmPasswordReset = async () => {
    if (!targetEmployeeId) return;
    setResettingPassword(true);
    setBanner(null);

    try {
      const { data } = await api.post(`/employees/${targetEmployeeId}/reset-password`);
      setBanner({
        severity: "success",
        message: data.message || "Password reset successfully.",
        tempPassword: data.temporary_password,
      });
      setResetDialogOpen(false);
    } catch (err: unknown) {
      setBanner({
        severity: "error",
        message: getErrorMessage(err, "Failed to reset password."),
      });
    } finally {
      setResettingPassword(false);
    }
  };

  const pageTitle = isViewingSelf ? "My Profile" : "Employee Profile";

  if (loading) {
    return (
      <AppLayout pageTitle={pageTitle}>
        <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "60vh" }}>
          <CircularProgress sx={{ color: TEAL }} />
        </Box>
      </AppLayout>
    );
  }

  if (!profile) {
    return (
      <AppLayout pageTitle={pageTitle}>
        <Alert severity="error" sx={{ borderRadius: "12px", fontFamily: FONT }}>
          Unable to find employee profile.
        </Alert>
      </AppLayout>
    );
  }

  const fullName = `${profile.first_name || ""} ${profile.last_name || ""}`.trim() || "Employee";
  const initials = `${(profile.first_name?.[0] || "").toUpperCase()}${(profile.last_name?.[0] || "").toUpperCase()}` || "EM";

  const fullAddress = [
    profile.address_line1,
    profile.address_line2,
    profile.city,
    profile.state,
    profile.country ? `${profile.country} - ${profile.pincode || ""}` : profile.pincode,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <AppLayout pageTitle={pageTitle}>
      {/* Back button if navigating from Directory */}
      {!isViewingSelf && (
        <Button
          startIcon={<ArrowBackRounded />}
          onClick={() => navigate("/employees")}
          sx={{
            mb: 2.5,
            color: MUTED,
            fontFamily: FONT,
            textTransform: "none",
            fontWeight: 600,
            fontSize: "13px",
            "&:hover": { backgroundColor: "rgba(22,24,29,0.06)", color: TEAL },
          }}
        >
          Back to Employee Management
        </Button>
      )}

      {/* Banner Message */}
      {banner && (
        <Alert
          severity={banner.severity}
          onClose={() => setBanner(null)}
          sx={{
            mb: 3,
            borderRadius: "12px",
            fontFamily: FONT,
            fontSize: "13px",
            border: `1px solid ${
              banner.severity === "success" ? "rgba(16, 185, 129, 0.3)" : "rgba(239, 68, 68, 0.3)"
            }`,
          }}
        >
          <Box>
            <Typography sx={{ fontFamily: FONT, fontSize: "13px", fontWeight: 600 }}>
              {banner.message}
            </Typography>
            {banner.tempPassword && (
              <Box sx={{ mt: 1, p: 1, backgroundColor: "rgba(0,0,0,0.04)", borderRadius: "6px" }}>
                <Typography sx={{ fontFamily: FONT, fontSize: "12px", fontWeight: 700, color: INK }}>
                  Temporary Password (Dev mode): <code>{banner.tempPassword}</code>
                </Typography>
              </Box>
            )}
          </Box>
        </Alert>
      )}

      {/* Header Profile Badge Card */}
      <Box
        sx={{
          p: { xs: 2.5, sm: 3.5 },
          borderRadius: "20px",
          backgroundColor: "#FFFFFF",
          border: `1px solid ${BORDER}`,
          boxShadow: "0 4px 20px rgba(0,0,0,0.03)",
          display: "flex",
          flexDirection: { xs: "column", sm: "row" },
          alignItems: { xs: "flex-start", sm: "center" },
          justifyContent: "space-between",
          gap: 2.5,
          mb: 3.5,
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 2.5 }}>
          <Avatar
            sx={{
              width: 72,
              height: 72,
              bgcolor: TEAL,
              color: "#FFFFFF",
              fontFamily: FONT,
              fontSize: "24px",
              fontWeight: 700,
              boxShadow: "0 6px 16px rgba(22,24,29,0.25)",
            }}
          >
            {initials}
          </Avatar>

          <Box>
            <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 1.2, mb: 0.5 }}>
              <Typography
                sx={{
                  fontFamily: FONT,
                  fontSize: { xs: "22px", sm: "26px" },
                  fontWeight: 700,
                  color: INK,
                  letterSpacing: "-0.5px",
                }}
              >
                {fullName}
              </Typography>

              <Chip
                label={profile.employee_code}
                size="small"
                sx={{
                  fontFamily: FONT,
                  fontWeight: 700,
                  fontSize: "11px",
                  backgroundColor: "rgba(22,24,29,0.12)",
                  color: TEAL,
                  borderRadius: "6px",
                }}
              />

              {!isViewingSelf && (
                <Chip
                  label={employeeStatus}
                  size="small"
                  sx={{
                    fontFamily: FONT,
                    fontWeight: 700,
                    fontSize: "11px",
                    backgroundColor:
                      employeeStatus === "ACTIVE"
                        ? "rgba(16, 185, 129, 0.12)"
                        : "rgba(239, 68, 68, 0.12)",
                    color: employeeStatus === "ACTIVE" ? "#059669" : "#DC2626",
                    borderRadius: "6px",
                  }}
                />
              )}
            </Box>

            <Typography sx={{ fontFamily: FONT, fontSize: "14px", color: MUTED }}>
              {profile.designation_name || "Designation not set"} •{" "}
              {profile.department_name || "Department not set"}
            </Typography>
          </Box>
        </Box>

        {/* Top Actions: Edit / Password Reset */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap" }}>
          {!isEditing && (
            <Button
              variant="contained"
              startIcon={<EditOutlined />}
              onClick={handleStartEdit}
              sx={{
                borderRadius: "10px",
                backgroundColor: TEAL,
                color: "#FFFFFF",
                textTransform: "none",
                fontFamily: FONT,
                fontSize: "13px",
                fontWeight: 600,
                px: 2.5,
                height: 42,
                boxShadow: "none",
                "&:hover": { backgroundColor: "#0C5F58" },
              }}
            >
              Edit Profile
            </Button>
          )}

          {!isViewingSelf && isHR && (
            <Button
              variant="outlined"
              startIcon={<LockResetRounded />}
              onClick={() => setResetDialogOpen(true)}
              sx={{
                borderRadius: "10px",
                borderColor: BORDER,
                color: INK,
                textTransform: "none",
                fontFamily: FONT,
                fontSize: "13px",
                fontWeight: 600,
                px: 2,
                height: 42,
                "&:hover": { borderColor: INK, backgroundColor: "#FAF9F6" },
              }}
            >
              Reset Password
            </Button>
          )}
        </Box>
      </Box>

      {/* Main Profile Form / View Sections */}
      <Box component={isEditing ? "form" : "div"} onSubmit={handleSaveProfile}>
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "1.1fr 1fr" }, gap: 3, mb: 4 }}>
          {/* Section 1: Personal Information */}
          <Box
            sx={{
              p: { xs: 2.5, md: 3.5 },
              borderRadius: "18px",
              backgroundColor: "#FFFFFF",
              border: `1px solid ${BORDER}`,
              boxShadow: "0 4px 20px rgba(0,0,0,0.02)",
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.2, mb: 2 }}>
              <PersonOutlined sx={{ color: TEAL, fontSize: 22 }} />
              <Typography sx={{ fontFamily: FONT, fontSize: "17px", fontWeight: 700, color: INK }}>
                Personal Information
              </Typography>
            </Box>
            <Divider sx={{ mb: 2.5, borderColor: "#EBE8E1" }} />

            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2.5 }}>
              <Box>
                <Typography sx={labelSx}>First Name</Typography>
                {isEditing ? (
                  <TextField
                    fullWidth
                    required
                    value={formData.first_name || ""}
                    onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                    sx={fieldSx}
                  />
                ) : (
                  <Typography sx={{ fontFamily: FONT, fontSize: "14px", fontWeight: 600, color: INK }}>
                    {profile.first_name || "—"}
                  </Typography>
                )}
              </Box>

              <Box>
                <Typography sx={labelSx}>Last Name</Typography>
                {isEditing ? (
                  <TextField
                    fullWidth
                    required
                    value={formData.last_name || ""}
                    onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                    sx={fieldSx}
                  />
                ) : (
                  <Typography sx={{ fontFamily: FONT, fontSize: "14px", fontWeight: 600, color: INK }}>
                    {profile.last_name || "—"}
                  </Typography>
                )}
              </Box>

              {/* Phone */}
              <Box sx={{ gridColumn: { xs: "auto", sm: "1 / -1" } }}>
                <Typography sx={labelSx}>Phone Number</Typography>
                {isEditing ? (
                  <Box sx={{ display: "flex", gap: 1.2 }}>
                    <Autocomplete<ICountry, false, true>
                      disableClearable
                      options={ALL_COUNTRIES}
                      value={phoneCountry ?? ALL_COUNTRIES[0]}
                      onChange={(_, value) => setPhoneCountry(value)}
                      filterOptions={countryFilter}
                      getOptionLabel={(option) => dialCode(option)}
                      isOptionEqualToValue={(option, value) => option.isoCode === value.isoCode}
                      renderOption={(props, option) => {
                        const { key, ...rest } = props as HTMLAttributes<HTMLLIElement> & { key?: string };
                        return (
                          <li key={key ?? option.isoCode} {...rest}>
                            <Typography sx={{ fontFamily: FONT, fontSize: "13px" }}>
                              {option.name} ({dialCode(option)})
                            </Typography>
                          </li>
                        );
                      }}
                      renderInput={(params) => <TextField {...params} sx={fieldSx} />}
                      sx={{ width: 140, flexShrink: 0 }}
                    />
                    <TextField
                      fullWidth
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, ""))}
                      placeholder="Phone digits"
                      sx={fieldSx}
                    />
                  </Box>
                ) : (
                  <Typography sx={{ fontFamily: FONT, fontSize: "14px", fontWeight: 600, color: INK }}>
                    {profile.phone || "—"}
                  </Typography>
                )}
              </Box>

              {/* Date of Birth */}
              <Box>
                <Typography sx={labelSx}>Date of Birth</Typography>
                {isEditing ? (
                  <TextField
                    fullWidth
                    type="date"
                    value={formData.dob || ""}
                    onChange={(e) => setFormData({ ...formData, dob: e.target.value })}
                    sx={fieldSx}
                  />
                ) : (
                  <Typography sx={{ fontFamily: FONT, fontSize: "14px", fontWeight: 600, color: INK }}>
                    {profile.dob || "—"}
                  </Typography>
                )}
              </Box>

              <Box>
                <Typography sx={labelSx}>Official Email</Typography>
                <Typography sx={{ fontFamily: FONT, fontSize: "14px", fontWeight: 600, color: INK, pt: isEditing ? 1.5 : 0 }}>
                  {profile.email}
                </Typography>
              </Box>
            </Box>
          </Box>

          {/* Section 2: Residential Address */}
          <Box
            sx={{
              p: { xs: 2.5, md: 3.5 },
              borderRadius: "18px",
              backgroundColor: "#FFFFFF",
              border: `1px solid ${BORDER}`,
              boxShadow: "0 4px 20px rgba(0,0,0,0.02)",
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.2, mb: 2 }}>
              <LocationOnOutlined sx={{ color: TEAL, fontSize: 22 }} />
              <Typography sx={{ fontFamily: FONT, fontSize: "17px", fontWeight: 700, color: INK }}>
                Residential Address
              </Typography>
            </Box>
            <Divider sx={{ mb: 2.5, borderColor: "#EBE8E1" }} />

            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2.5 }}>
              <Box sx={{ gridColumn: { xs: "auto", sm: "1 / -1" } }}>
                <Typography sx={labelSx}>Address Line 1</Typography>
                {isEditing ? (
                  <TextField
                    fullWidth
                    value={formData.address_line1 || ""}
                    onChange={(e) => setFormData({ ...formData, address_line1: e.target.value })}
                    placeholder="Street address, apartment, suite"
                    sx={fieldSx}
                  />
                ) : (
                  <Typography sx={{ fontFamily: FONT, fontSize: "14px", fontWeight: 600, color: INK }}>
                    {profile.address_line1 || "—"}
                  </Typography>
                )}
              </Box>

              <Box sx={{ gridColumn: { xs: "auto", sm: "1 / -1" } }}>
                <Typography sx={labelSx}>Address Line 2 (Optional)</Typography>
                {isEditing ? (
                  <TextField
                    fullWidth
                    value={formData.address_line2 || ""}
                    onChange={(e) => setFormData({ ...formData, address_line2: e.target.value })}
                    placeholder="Landmark, building"
                    sx={fieldSx}
                  />
                ) : (
                  <Typography sx={{ fontFamily: FONT, fontSize: "14px", fontWeight: 600, color: INK }}>
                    {profile.address_line2 || "—"}
                  </Typography>
                )}
              </Box>

              <Box>
                <Typography sx={labelSx}>Country</Typography>
                {isEditing ? (
                  <Autocomplete<ICountry, false, false>
                    options={ALL_COUNTRIES}
                    value={selectedCountry}
                    onChange={(_, value) => handleCountryChange(value)}
                    getOptionLabel={(option) => option.name}
                    isOptionEqualToValue={(option, value) => option.isoCode === value.isoCode}
                    renderInput={(params) => <TextField {...params} placeholder="Select country" sx={fieldSx} />}
                  />
                ) : (
                  <Typography sx={{ fontFamily: FONT, fontSize: "14px", fontWeight: 600, color: INK }}>
                    {profile.country || "—"}
                  </Typography>
                )}
              </Box>

              <Box>
                <Typography sx={labelSx}>State</Typography>
                {isEditing ? (
                  <Autocomplete<IState, false, false>
                    options={states}
                    value={selectedState}
                    disabled={!selectedCountry || states.length === 0}
                    onChange={(_, value) => handleStateChange(value)}
                    getOptionLabel={(option) => option.name}
                    isOptionEqualToValue={(option, value) => option.isoCode === value.isoCode}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        placeholder={!selectedCountry ? "Select country first" : "Select state"}
                        sx={fieldSx}
                      />
                    )}
                  />
                ) : (
                  <Typography sx={{ fontFamily: FONT, fontSize: "14px", fontWeight: 600, color: INK }}>
                    {profile.state || "—"}
                  </Typography>
                )}
              </Box>

              <Box>
                <Typography sx={labelSx}>City</Typography>
                {isEditing ? (
                  <Autocomplete
                    freeSolo
                    options={cityOptions}
                    disabled={!selectedCountry}
                    inputValue={formData.city || ""}
                    onInputChange={(_, value) => setFormData({ ...formData, city: value })}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        placeholder={!selectedCountry ? "Select country first" : "City name"}
                        sx={fieldSx}
                      />
                    )}
                  />
                ) : (
                  <Typography sx={{ fontFamily: FONT, fontSize: "14px", fontWeight: 600, color: INK }}>
                    {profile.city || "—"}
                  </Typography>
                )}
              </Box>

              <Box>
                <Typography sx={labelSx}>Pincode</Typography>
                {isEditing ? (
                  <TextField
                    fullWidth
                    value={formData.pincode || ""}
                    onChange={(e) => setFormData({ ...formData, pincode: e.target.value })}
                    sx={fieldSx}
                  />
                ) : (
                  <Typography sx={{ fontFamily: FONT, fontSize: "14px", fontWeight: 600, color: INK }}>
                    {profile.pincode || "—"}
                  </Typography>
                )}
              </Box>
            </Box>
          </Box>
        </Box>

        {/* Section 3: Company & Employment Information (Company-controlled, Read-Only) */}
        <Box
          sx={{
            p: { xs: 2.5, md: 3.5 },
            borderRadius: "18px",
            backgroundColor: "#FFFFFF",
            border: `1px solid ${BORDER}`,
            boxShadow: "0 4px 20px rgba(0,0,0,0.02)",
            mb: 4,
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.2 }}>
              <BusinessOutlined sx={{ color: TEAL, fontSize: 22 }} />
              <Typography sx={{ fontFamily: FONT, fontSize: "17px", fontWeight: 700, color: INK }}>
                Employment Information
              </Typography>
            </Box>
            <Chip
              label="Company Controlled (Read-only)"
              size="small"
              sx={{
                fontFamily: FONT,
                fontSize: "11px",
                fontWeight: 600,
                backgroundColor: "#F0EFEB",
                color: MUTED,
              }}
            />
          </Box>
          <Divider sx={{ mb: 2.5, borderColor: "#EBE8E1" }} />

          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", md: "repeat(4, 1fr)" },
              gap: 2.5,
            }}
          >
            <Box>
              <Typography sx={labelSx}>Employee Code</Typography>
              <Typography sx={{ fontFamily: FONT, fontSize: "14px", fontWeight: 700, color: INK }}>
                {profile.employee_code}
              </Typography>
            </Box>

            <Box>
              <Typography sx={labelSx}>Assigned Role</Typography>
              <Typography sx={{ fontFamily: FONT, fontSize: "14px", fontWeight: 600, color: INK }}>
                {profile.role_name || "Employee"}
              </Typography>
            </Box>

            <Box>
              <Typography sx={labelSx}>Department</Typography>
              <Typography sx={{ fontFamily: FONT, fontSize: "14px", fontWeight: 600, color: INK }}>
                {profile.department_name || "—"}
              </Typography>
            </Box>

            <Box>
              <Typography sx={labelSx}>Designation</Typography>
              <Typography sx={{ fontFamily: FONT, fontSize: "14px", fontWeight: 600, color: INK }}>
                {profile.designation_name || "—"}
              </Typography>
            </Box>

            <Box>
              <Typography sx={labelSx}>Reporting Manager</Typography>
              <Typography sx={{ fontFamily: FONT, fontSize: "14px", fontWeight: 600, color: INK }}>
                {profile.manager_name || "None"}
              </Typography>
            </Box>

            <Box>
              <Typography sx={labelSx}>Date of Joining</Typography>
              <Typography sx={{ fontFamily: FONT, fontSize: "14px", fontWeight: 600, color: INK }}>
                {profile.date_of_joining}
              </Typography>
            </Box>

            <Box>
              <Typography sx={labelSx}>Employment Type</Typography>
              <Typography sx={{ fontFamily: FONT, fontSize: "14px", fontWeight: 600, color: INK }}>
                {profile.employment_type?.replace(/_/g, " ")}
              </Typography>
            </Box>
          </Box>
        </Box>

        {/* Bottom Actions: Edit / Save / Cancel */}
        <Box sx={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 2 }}>
          {isEditing ? (
            <>
              <Button
                type="button"
                onClick={handleCancelEdit}
                disabled={saving}
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
                variant="contained"
                disabled={saving}
                startIcon={!saving ? <SaveOutlined /> : undefined}
                sx={{
                  height: 48,
                  px: 3.5,
                  borderRadius: "10px",
                  backgroundColor: INK,
                  color: "#FFFFFF",
                  textTransform: "none",
                  fontFamily: FONT,
                  fontWeight: 600,
                  fontSize: "14px",
                  boxShadow: "none",
                  "&:hover": { backgroundColor: "#2B2F38" },
                }}
              >
                {saving ? <CircularProgress size={18} sx={{ color: "#FFFFFF" }} /> : "Save Changes"}
              </Button>
            </>
          ) : (
            <Button
              variant="contained"
              startIcon={<EditOutlined />}
              onClick={handleStartEdit}
              sx={{
                height: 48,
                px: 3.5,
                borderRadius: "10px",
                backgroundColor: TEAL,
                color: "#FFFFFF",
                textTransform: "none",
                fontFamily: FONT,
                fontWeight: 600,
                fontSize: "14px",
                boxShadow: "none",
                "&:hover": { backgroundColor: "#0C5F58" },
              }}
            >
              Edit Profile
            </Button>
          )}
        </Box>
      </Box>

      {/* Password Reset Dialog (HR view) */}
      <Dialog
        open={resetDialogOpen}
        onClose={() => !resettingPassword && setResetDialogOpen(false)}
        slotProps={{ paper: { sx: { borderRadius: "16px", p: 1, maxWidth: 440 } } }}
      >
        <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1.5, pb: 1 }}>
          <Box
            sx={{
              width: 40,
              height: 40,
              borderRadius: "10px",
              backgroundColor: "rgba(22,24,29,0.1)",
              color: TEAL,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <LockResetRounded sx={{ fontSize: 24 }} />
          </Box>
          <Typography sx={{ fontFamily: FONT, fontSize: "18px", fontWeight: 700, color: INK }}>
            Reset Employee Password?
          </Typography>
        </DialogTitle>

        <DialogContent sx={{ py: 1 }}>
          <Typography sx={{ fontFamily: FONT, fontSize: "13px", color: MUTED, lineHeight: 1.6 }}>
            Are you sure you want to reset the password for{" "}
            <strong style={{ color: INK }}>{fullName}</strong> ({profile.email})?
            <br />
            <br />
            A secure temporary password will be generated and dispatched to the employee's email.
            Existing login sessions will be terminated immediately.
          </Typography>
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 2, pt: 1, gap: 1 }}>
          <Button
            onClick={() => setResetDialogOpen(false)}
            disabled={resettingPassword}
            sx={{ textTransform: "none", fontFamily: FONT, fontWeight: 600, color: MUTED }}
          >
            Cancel
          </Button>

          <Button
            variant="contained"
            onClick={handleConfirmPasswordReset}
            disabled={resettingPassword}
            sx={{
              textTransform: "none",
              fontFamily: FONT,
              fontWeight: 600,
              borderRadius: "10px",
              px: 2.5,
              backgroundColor: INK,
              "&:hover": { backgroundColor: "#2B2F38" },
            }}
          >
            {resettingPassword ? (
              <CircularProgress size={18} sx={{ color: "#FFFFFF" }} />
            ) : (
              "Confirm Reset Password"
            )}
          </Button>
        </DialogActions>
      </Dialog>
    </AppLayout>
  );
}
