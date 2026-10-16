import { Alert, Snackbar, type AlertColor } from "@mui/material";

interface ActionToastProps {
  open: boolean;
  severity: AlertColor;
  message: string;
  onClose: () => void;
}

export default function ActionToast({
  open,
  severity,
  message,
  onClose,
}: ActionToastProps) {
  return (
    <Snackbar
      open={open}
      autoHideDuration={4000}
      onClose={(_, reason) => {
        if (reason !== "clickaway") onClose();
      }}
      anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
    >
      <Alert
        onClose={onClose}
        severity={severity}
        variant="filled"
        sx={{ width: "100%", fontFamily: "'Montserrat', sans-serif" }}
      >
        {message}
      </Alert>
    </Snackbar>
  );
}
