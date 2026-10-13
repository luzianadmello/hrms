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
  Box,
  Button,
  CircularProgress,
  Divider,
  TextField,
  Typography,
  createFilterOptions,
} from "@mui/material";
import {
  ArrowForwardRounded,
  BusinessOutlined,
  HomeOutlined,
  PersonOutlined,
} from "@mui/icons-material";
import { City, Country, State } from "country-state-city";
import type { ICountry, IState } from "country-state-city";
import { useNavigate } from "react-router-dom";

import api from "../../services/api";
import { logout } from "../../services/session";
import { getErrorMessage } from "../../utils/errors";

const FONT = "'Montserrat', sans-serif";

const INK = "#16181D";
const TEAL = "#16181D";
const MUTED = "#6B6F76";
const BORDER = "#DAD7CF";

interface Profile {
  employee_code: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  role_name: string | null;
  department_name: string | null;
  designation_name: string | null;
  manager_name: string | null;
  phone: string | null;
  dob: string | null;
  date_of_joining: string;
  employment_type: string;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  pincode: string | null;
}

/* ---------- Location + phone helpers ---------- */

const ALL_COUNTRIES: ICountry[] = Country.getAllCountries();

// Some countries list several codes ("1-809 and 1-829"); use the first one.
function dialCode(country: ICountry): string {
  const first = country.phonecode.split(/\s*(?:and|,|&)\s*/i)[0];
  return "+" + first.replace(/\D/g, "");
}

const TODAY = new Date().toISOString().split("T")[0];

function parsePhone(phone: string | null) {
  const india = ALL_COUNTRIES.find((c) => c.isoCode === "IN") ?? null;

  if (!phone) {
    return { country: india, number: "" };
  }

  const match = phone.trim().match(/^(\+\d+)\s*(.*)$/);

  if (!match) {
    return { country: india, number: phone.replace(/\D/g, "") };
  }

  const found = ALL_COUNTRIES.find((c) => dialCode(c) === match[1]);

  return {
    country: found ?? india,
    number: match[2].replace(/\D/g, ""),
  };
}

const countryFilter = createFilterOptions<ICountry>({
  stringify: (c) => `${c.name} ${dialCode(c)} ${c.isoCode}`,
});

/* ---------- Styles ---------- */

const fieldSx = {
  "& .MuiOutlinedInput-root": {
    minHeight: 50,
    borderRadius: "10px",
    backgroundColor: "#FFFFFF",
    fontFamily: FONT,
    fontSize: "14px",

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

const readOnlyFieldSx = {
  "& .MuiOutlinedInput-root": {
    minHeight: 50,
    borderRadius: "10px",
    backgroundColor: "#F7F6F2",
    fontFamily: FONT,
    fontSize: "14px",

    "& fieldset": {
      border: `1px solid ${BORDER}`,
    },
  },

  "& .MuiInputBase-input.Mui-disabled": {
    WebkitTextFillColor: INK,
    color: INK,
    opacity: 0.8,
  },
};

const labelSx = {
  display: "block",
  fontFamily: FONT,
  fontSize: "12px",
  fontWeight: 600,
  color: INK,
  marginBottom: "8px",
};

const gridSx = {
  display: "grid",
  gridTemplateColumns: {
    xs: "1fr",
    md: "1fr 1fr",
  },
  gap: 2.5,
};

const sectionTitleSx = {
  fontFamily: FONT,
  fontSize: "17px",
  fontWeight: 700,
  color: INK,
};

const sectionHeaderSx = {
  display: "flex",
  alignItems: "center",
  gap: 1.2,
  mb: 2.5,
};

const fullWidthSx = {
  gridColumn: {
    xs: "auto",
    md: "1 / -1",
  },
};

const optionTextSx = {
  fontFamily: FONT,
  fontSize: "13px",
};

/* ---------- Component ---------- */

function CompleteProfile() {
  const navigate = useNavigate();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [phoneCountry, setPhoneCountry] = useState<ICountry | null>(
    ALL_COUNTRIES.find((c) => c.isoCode === "IN") ?? null
  );
  const [phoneNumber, setPhoneNumber] = useState("");

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const response = await api.get("/employees/me");
        const data: Profile = response.data;

        setProfile(data);

        const parsed = parsePhone(data.phone);
        setPhoneCountry(parsed.country);
        setPhoneNumber(parsed.number);
      } catch (err: unknown) {
        setError(getErrorMessage(err, "Unable to load your profile."));
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, []);

  /* Country -> State -> City, derived from the saved names */

  const selectedCountry = useMemo(
    () => ALL_COUNTRIES.find((c) => c.name === profile?.country) ?? null,
    [profile?.country]
  );

  const states: IState[] = useMemo(
    () =>
      selectedCountry ? State.getStatesOfCountry(selectedCountry.isoCode) : [],
    [selectedCountry]
  );

  const selectedState = useMemo(
    () => states.find((s) => s.name === profile?.state) ?? null,
    [states, profile?.state]
  );

  const cityOptions: string[] = useMemo(() => {
    if (!selectedCountry) {
      return [];
    }

    const cities = selectedState
      ? City.getCitiesOfState(selectedCountry.isoCode, selectedState.isoCode)
      : states.length === 0
        ? City.getCitiesOfCountry(selectedCountry.isoCode) ?? []
        : [];

    return Array.from(new Set(cities.map((c) => c.name)));
  }, [selectedCountry, selectedState, states]);

  const updateField = (field: keyof Profile, value: string) => {
    setProfile((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        [field]: value,
      };
    });
  };

  const handleCountryChange = (country: ICountry | null) => {
    setProfile((current) =>
      current
        ? {
            ...current,
            country: country?.name ?? "",
            state: "",
            city: "",
          }
        : current
    );
  };

  const handleStateChange = (state: IState | null) => {
    setProfile((current) =>
      current
        ? {
            ...current,
            state: state?.name ?? "",
            city: "",
          }
        : current
    );
  };

  const handleSignOut = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!profile) {
      return;
    }

    setError("");
    setSuccess("");

    // Everything on this page is mandatory except Address Line 2
    const missing: string[] = [];

    if (!profile.first_name?.trim()) missing.push("first name");
    if (!profile.last_name?.trim()) missing.push("last name");
    if (phoneNumber.length < 6) missing.push("a valid phone number");
    if (!profile.dob) missing.push("date of birth");
    if (!profile.address_line1?.trim()) missing.push("address line 1");
    if (!profile.country?.trim()) missing.push("country");
    if (states.length > 0 && !profile.state?.trim()) missing.push("state");
    if (!profile.city?.trim()) missing.push("city");
    if (!profile.pincode?.trim()) missing.push("pincode");

    if (missing.length > 0) {
      setError(`Please fill in: ${missing.join(", ")}.`);
      return;
    }

    setSaving(true);

    const fullPhone =
      phoneNumber && phoneCountry
        ? `${dialCode(phoneCountry)} ${phoneNumber}`
        : null;

    try {
      await api.put("/employees/me", {
        first_name: profile.first_name?.trim() || null,
        last_name: profile.last_name?.trim() || null,
        phone: fullPhone,
        dob: profile.dob || null,
        address_line1: profile.address_line1?.trim() || null,
        address_line2: profile.address_line2?.trim() || null,
        city: profile.city?.trim() || null,
        state: profile.state?.trim() || null,
        country: profile.country?.trim() || null,
        pincode: profile.pincode?.trim() || null,
      });

      setSuccess("Your profile has been completed successfully.");

      setTimeout(() => {
        navigate("/dashboard", { replace: true });
      }, 800);
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Unable to save your profile."));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Box
        sx={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#F5F4F0",
        }}
      >
        <CircularProgress sx={{ color: TEAL }} />
      </Box>
    );
  }

  if (!profile) {
    return (
      <Box
        sx={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          px: 2,
          backgroundColor: "#F5F4F0",
        }}
      >
        <Alert
          severity="error"
          sx={{ fontFamily: FONT, borderRadius: "10px" }}
        >
          {error || "Profile not found."}
        </Alert>
      </Box>
    );
  }

  const employmentType = profile.employment_type
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

  return (
    <Box
      sx={{
        position: "relative",
        minHeight: "100vh",
        overflow: "hidden",
        backgroundColor: "#F5F4F0",
        fontFamily: FONT,
        py: { xs: 3, md: 6 },
        px: { xs: 2, md: 4 },

        "&::before, &::after": {
          content: '""',
          position: "fixed",
          borderRadius: "50%",
          filter: "blur(90px)",
          pointerEvents: "none",
        },

        "&::before": {
          width: 460,
          height: 460,
          top: -150,
          left: -120,
          background: "rgba(22,24,29,0.16)",
        },

        "&::after": {
          width: 420,
          height: 420,
          bottom: -150,
          right: -100,
          background: "rgba(214,190,150,0.35)",
        },
      }}
    >
      <Box
        sx={{
          position: "relative",
          zIndex: 1,
          width: "100%",
          maxWidth: 1050,
          mx: "auto",
        }}
      >
        <Box sx={{ mb: 3 }}>
          <Typography
            sx={{
              fontFamily: FONT,
              fontSize: "12px",
              fontWeight: 600,
              color: TEAL,
              textTransform: "uppercase",
              letterSpacing: "0.8px",
              mb: 1,
            }}
          >
            Employee onboarding
          </Typography>

          <Typography
            component="h1"
            sx={{
              fontFamily: FONT,
              fontSize: { xs: "28px", md: "34px" },
              fontWeight: 700,
              color: INK,
              letterSpacing: "-0.7px",
            }}
          >
            Complete your profile
          </Typography>

          <Typography
            sx={{
              fontFamily: FONT,
              fontSize: "14px",
              color: MUTED,
              mt: 0.8,
            }}
          >
            Review your company information and add your personal details.
          </Typography>
        </Box>

        <Box
          component="form"
          onSubmit={handleSubmit}
          sx={{
            backgroundColor: "#FFFFFF",
            border: `1px solid ${BORDER}`,
            borderRadius: "20px",
            p: { xs: 2.5, md: 4 },
          }}
        >
          {error && (
            <Alert
              severity="error"
              sx={{ mb: 3, borderRadius: "10px", fontFamily: FONT }}
            >
              {error}
            </Alert>
          )}

          {success && (
            <Alert
              severity="success"
              sx={{ mb: 3, borderRadius: "10px", fontFamily: FONT }}
            >
              {success}
            </Alert>
          )}

          {/* Personal information */}

          <Box sx={sectionHeaderSx}>
            <PersonOutlined sx={{ color: TEAL }} />
            <Typography sx={sectionTitleSx}>Personal information</Typography>
          </Box>

          <Box sx={gridSx}>
            <Box>
              <Typography sx={labelSx}>First Name</Typography>
              <TextField
                fullWidth
                value={profile.first_name || ""}
                onChange={(event) =>
                  updateField("first_name", event.target.value)
                }
                sx={fieldSx}
              />
            </Box>

            <Box>
              <Typography sx={labelSx}>Last Name</Typography>
              <TextField
                fullWidth
                value={profile.last_name || ""}
                onChange={(event) =>
                  updateField("last_name", event.target.value)
                }
                sx={fieldSx}
              />
            </Box>

            {/* Phone with country code */}

            <Box>
              <Typography sx={labelSx}>Phone</Typography>

              <Box sx={{ display: "flex", gap: 1.2 }}>
                <Autocomplete<ICountry, false, true>
                  disableClearable
                  options={ALL_COUNTRIES}
                  value={phoneCountry ?? ALL_COUNTRIES[0]}
                  onChange={(_, value) => setPhoneCountry(value)}
                  filterOptions={countryFilter}
                  getOptionLabel={(option) => dialCode(option)}
                  isOptionEqualToValue={(option, value) =>
                    option.isoCode === value.isoCode
                  }
                  renderOption={(props, option) => {
                    const { key, ...rest } = props as HTMLAttributes<HTMLLIElement> & {
                      key?: string;
                    };

                    return (
                      <li key={key ?? option.isoCode} {...rest}>
                        <Typography sx={optionTextSx}>
                          {option.name} ({dialCode(option)})
                        </Typography>
                      </li>
                    );
                  }}
                  renderInput={(params) => (
                    <TextField {...params} sx={fieldSx} />
                  )}
                  sx={{ width: 150, flexShrink: 0 }}
                />

                <TextField
                  fullWidth
                  value={phoneNumber}
                  onChange={(event) =>
                    setPhoneNumber(event.target.value.replace(/\D/g, ""))
                  }
                  placeholder="Phone number"
                  sx={fieldSx}
                />
              </Box>
            </Box>

            <Box>
              <Typography sx={labelSx}>Date of Birth</Typography>
              <TextField
                fullWidth
                type="date"
                value={profile.dob || ""}
                onChange={(event) => updateField("dob", event.target.value)}
                sx={fieldSx}
                slotProps={{ htmlInput: { max: TODAY } }}
              />
            </Box>
          </Box>

          <Divider sx={{ my: 4, borderColor: BORDER }} />

          {/* Company information */}

          <Box sx={sectionHeaderSx}>
            <BusinessOutlined sx={{ color: TEAL }} />
            <Typography sx={sectionTitleSx}>Company information</Typography>
          </Box>

          <Box sx={gridSx}>
            <Box>
              <Typography sx={labelSx}>Employee Code</Typography>
              <TextField
                fullWidth
                value={profile.employee_code}
                disabled
                sx={readOnlyFieldSx}
              />
            </Box>

            <Box>
              <Typography sx={labelSx}>Role</Typography>
              <TextField
                fullWidth
                value={profile.role_name || "—"}
                disabled
                sx={readOnlyFieldSx}
              />
            </Box>

            <Box>
              <Typography sx={labelSx}>Email</Typography>
              <TextField
                fullWidth
                value={profile.email}
                disabled
                sx={readOnlyFieldSx}
              />
            </Box>

            <Box>
              <Typography sx={labelSx}>Department</Typography>
              <TextField
                fullWidth
                value={profile.department_name || "—"}
                disabled
                sx={readOnlyFieldSx}
              />
            </Box>

            <Box>
              <Typography sx={labelSx}>Designation</Typography>
              <TextField
                fullWidth
                value={profile.designation_name || "—"}
                disabled
                sx={readOnlyFieldSx}
              />
            </Box>

            <Box>
              <Typography sx={labelSx}>Reporting Manager</Typography>
              <TextField
                fullWidth
                value={profile.manager_name || "—"}
                disabled
                sx={readOnlyFieldSx}
              />
            </Box>

            <Box>
              <Typography sx={labelSx}>Date of Joining</Typography>
              <TextField
                fullWidth
                value={profile.date_of_joining}
                disabled
                sx={readOnlyFieldSx}
              />
            </Box>

            <Box>
              <Typography sx={labelSx}>Employment Type</Typography>
              <TextField
                fullWidth
                value={employmentType}
                disabled
                sx={readOnlyFieldSx}
              />
            </Box>
          </Box>

          <Divider sx={{ my: 4, borderColor: BORDER }} />

          {/* Address */}

          <Box sx={sectionHeaderSx}>
            <HomeOutlined sx={{ color: TEAL }} />
            <Typography sx={sectionTitleSx}>Address</Typography>
          </Box>

          <Box sx={gridSx}>
            <Box sx={fullWidthSx}>
              <Typography sx={labelSx}>Address Line 1</Typography>
              <TextField
                fullWidth
                value={profile.address_line1 || ""}
                onChange={(event) =>
                  updateField("address_line1", event.target.value)
                }
                sx={fieldSx}
              />
            </Box>

            <Box sx={fullWidthSx}>
              <Typography sx={labelSx}>Address Line 2</Typography>
              <TextField
                fullWidth
                value={profile.address_line2 || ""}
                onChange={(event) =>
                  updateField("address_line2", event.target.value)
                }
                sx={fieldSx}
              />
            </Box>

            {/* Country */}

            <Box>
              <Typography sx={labelSx}>Country</Typography>
              <Autocomplete<ICountry, false, false>
                options={ALL_COUNTRIES}
                value={selectedCountry}
                onChange={(_, value) => handleCountryChange(value)}
                getOptionLabel={(option) => option.name}
                isOptionEqualToValue={(option, value) =>
                  option.isoCode === value.isoCode
                }
                renderInput={(params) => (
                  <TextField
                    {...params}
                    placeholder="Start typing a country"
                    sx={fieldSx}
                  />
                )}
              />
            </Box>

            {/* State */}

            <Box>
              <Typography sx={labelSx}>State</Typography>
              <Autocomplete<IState, false, false>
                options={states}
                value={selectedState}
                disabled={!selectedCountry || states.length === 0}
                onChange={(_, value) => handleStateChange(value)}
                getOptionLabel={(option) => option.name}
                isOptionEqualToValue={(option, value) =>
                  option.isoCode === value.isoCode
                }
                renderInput={(params) => (
                  <TextField
                    {...params}
                    placeholder={
                      !selectedCountry
                        ? "Select a country first"
                        : states.length === 0
                          ? "No states available"
                          : "Start typing a state"
                    }
                    sx={fieldSx}
                  />
                )}
              />
            </Box>

            {/* City */}

            <Box>
              <Typography sx={labelSx}>City</Typography>
              <Autocomplete
                freeSolo
                options={cityOptions}
                disabled={!selectedCountry}
                inputValue={profile.city || ""}
                onInputChange={(_, value) => updateField("city", value)}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    placeholder={
                      !selectedCountry
                        ? "Select a country first"
                        : "Start typing a city"
                    }
                    sx={fieldSx}
                  />
                )}
              />
            </Box>

            {/* Pincode */}

            <Box>
              <Typography sx={labelSx}>Pincode</Typography>
              <TextField
                fullWidth
                value={profile.pincode || ""}
                onChange={(event) =>
                  updateField("pincode", event.target.value)
                }
                sx={fieldSx}
              />
            </Box>
          </Box>

          <Box
            sx={{
              display: "flex",
              justifyContent: "flex-end",
              alignItems: "center",
              gap: 1.5,
              mt: 4,
            }}
          >
            <Button
              type="button"
              onClick={handleSignOut}
              disabled={saving}
              sx={{
                height: 50,
                px: 3,
                borderRadius: "10px",
                textTransform: "none",
                fontFamily: FONT,
                fontWeight: 600,
                color: MUTED,
              }}
            >
              Sign out
            </Button>

            <Button
              type="submit"
              disabled={saving}
              endIcon={!saving ? <ArrowForwardRounded /> : undefined}
              sx={{
                minWidth: 180,
                height: 50,
                borderRadius: "10px",
                backgroundColor: INK,
                color: "#FFFFFF",
                textTransform: "none",
                fontFamily: FONT,
                fontWeight: 600,

                "&:hover": { backgroundColor: "#2B2F38" },

                "&.Mui-disabled": {
                  backgroundColor: "#D9D7D0",
                  color: "#FFFFFF",
                },
              }}
            >
              {saving ? (
                <CircularProgress size={18} sx={{ color: "#FFFFFF" }} />
              ) : (
                "Complete Profile"
              )}
            </Button>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}

export default CompleteProfile;