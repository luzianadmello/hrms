import { StrictMode, useEffect, useMemo, useState } from "react";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import { ArrowDropDownRounded } from "@mui/icons-material";
import { createRoot } from "react-dom/client";
import { ThemeModeContext, type ThemeMode } from "./contexts/ThemeModeContext";
import "./index.css";
import App from "./App.tsx";

// ── Palette tokens ─────────────────────────────────────────────────────────
const LIGHT = {
  pageBg:    "#F5F4F0",
  surface:   "#FFFFFF",
  surfaceAlt: "#FAF9F6",
  text:      "#16181D",
  muted:     "#6B6F76",
  border:    "#DAD7CF",
  input:     "#FFFFFF",
  inputBorder: "#DAD7CF",
  focus:     "#343741",
};

const DARK = {
  pageBg:    "#1E2026",
  surface:   "#2C2F36",
  surfaceAlt: "#252830",
  text:      "#F0F0EE",
  muted:     "#9DA0A8",
  border:    "#3E434D",
  input:     "#353940",
  inputBorder: "#4E5460",
  focus:     "#C8CBD2",
};

function Root() {
  const [mode, setMode] = useState<ThemeMode>(() => {
    try {
      return window.localStorage.getItem("hrms-theme-mode") === "dark" ? "dark" : "light";
    } catch {
      return "light";
    }
  });

  useEffect(() => {
    document.documentElement.dataset.themeMode = mode;
    document.body.dataset.themeMode = mode;
    try {
      window.localStorage.setItem("hrms-theme-mode", mode);
    } catch {
      // Theme still works for the current session when storage is unavailable.
    }
  }, [mode]);

  const palette = mode === "dark" ? DARK : LIGHT;

  const theme = useMemo(() => createTheme({
    palette: mode === "dark" ? {
      mode: "dark",
      primary: { main: "#D64A36", dark: "#B93C2B", contrastText: "#FFFFFF" },
      text: { primary: DARK.text, secondary: DARK.muted },
      background: { default: DARK.pageBg, paper: DARK.surface },
      divider: DARK.border,
    } : {
      mode: "light",
      primary: { main: "#E0442E", dark: "#BD3524", contrastText: "#FFFFFF" },
      text: { primary: LIGHT.text, secondary: LIGHT.muted },
      background: { default: LIGHT.pageBg, paper: LIGHT.surface },
      divider: LIGHT.border,
    },
    typography: { fontFamily: "'Montserrat', sans-serif" },
    shape: { borderRadius: 10 },
    components: {
      MuiSelect: {
        defaultProps: { IconComponent: ArrowDropDownRounded },
      },
      MuiButton: {
        styleOverrides: {
          root: { textTransform: "none", fontWeight: 650, borderRadius: 10, boxShadow: "none" },
          contained: {
            backgroundColor: mode === "dark" ? "#2C303A" : "#16181D",
            color: "#FFFFFF",
            border: mode === "dark" ? "1px solid #4A5060" : "none",
            boxShadow: "none",
            "&:hover": {
              backgroundColor: mode === "dark" ? "#3A3F4C" : "#2B2F38",
              boxShadow: "none",
            },
          },
          outlined: {
            borderColor: mode === "dark" ? DARK.border : LIGHT.border,
            color: palette.text,
            "&:hover": {
              borderColor: mode === "dark" ? "#858A95" : "#A9A69D",
              backgroundColor: mode === "dark" ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)",
            },
          },
        },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            borderRadius: 10,
            backgroundColor: palette.input,
            color: palette.text,
            "& .MuiOutlinedInput-notchedOutline": { borderColor: palette.inputBorder },
            "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: mode === "dark" ? "#858A95" : "#A9A69D" },
            "&.Mui-focused .MuiOutlinedInput-notchedOutline": { borderColor: mode === "dark" ? "#E0442E" : "#343741", borderWidth: 1.5 },
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: "none",
            backgroundColor: palette.surface,
            color: palette.text,
          },
          rounded: { borderRadius: 14 },
        },
      },
      MuiDialog: {
        styleOverrides: {
          paper: {
            backgroundColor: palette.surface,
            color: palette.text,
            backgroundImage: "none",
          },
        },
      },
      MuiDialogTitle: {
        styleOverrides: {
          root: {
            backgroundColor: palette.surface,
            color: palette.text,
          },
        },
      },
      MuiDialogContent: {
        styleOverrides: {
          root: {
            backgroundColor: palette.surface,
            color: palette.text,
          },
        },
      },
      MuiDialogActions: {
        styleOverrides: {
          root: {
            backgroundColor: palette.surface,
            color: palette.text,
          },
        },
      },
      MuiTypography: {
        styleOverrides: {
          root: {
            color: "inherit",
          },
        },
      },
      MuiTableCell: {
        styleOverrides: {
          head: {
            fontWeight: 700,
            color: mode === "dark" ? DARK.muted : "#4B4E55",
            backgroundColor: mode === "dark" ? DARK.surfaceAlt : "#FAF9F6",
          },
          body: {
            color: palette.text,
          },
        },
      },
      MuiTableContainer: {
        styleOverrides: {
          root: {
            backgroundColor: palette.surface,
          },
        },
      },
      MuiTablePagination: {
        styleOverrides: {
          root: {
            backgroundColor: palette.surface,
            color: palette.text,
          },
          selectLabel: { color: palette.muted },
          displayedRows: { color: palette.muted },
        },
      },
      MuiMenuItem: {
        styleOverrides: {
          root: {
            color: palette.text,
            "&:hover": { backgroundColor: mode === "dark" ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)" },
            "&.Mui-selected": { backgroundColor: mode === "dark" ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.06)" },
          },
        },
      },
      MuiDivider: {
        styleOverrides: {
          root: { borderColor: palette.border },
        },
      },
      MuiTooltip: {
        styleOverrides: {
          tooltip: {
            backgroundColor: mode === "dark" ? "#454952" : "#1E2026",
            color: "#F0F0EE",
          },
        },
      },
      MuiAutocomplete: {
        styleOverrides: {
          paper: {
            backgroundColor: palette.surface,
            color: palette.text,
          },
          listbox: {
            backgroundColor: palette.surface,
            color: palette.text,
          },
          option: {
            color: palette.text,
            "&:hover": { backgroundColor: mode === "dark" ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)" },
          },
        },
      },
    },
  }), [mode, palette]);

  return (
    <ThemeModeContext.Provider value={{ mode, toggleMode: () => setMode((current) => current === "light" ? "dark" : "light") }}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <App />
      </ThemeProvider>
    </ThemeModeContext.Provider>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
